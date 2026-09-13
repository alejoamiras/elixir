// The bridge's operations from the page, each through the one queue and under the miner's
// `bridge` pause so a proof never fights the prover for memory: a send-ahead, an exit to Ethereum,
// a claim of an arrival, and the holder's own forward or redeem of a held send-ahead with the
// redeem key's signature. Every operation writes its crossing before it sends and after it lands.
import type { AztecAddress } from '@aztec/aztec.js/addresses';
import { type Contract, NO_WAIT } from '@aztec/aztec.js/contracts';
import { waitForL1ToL2MessageReady } from '@aztec/aztec.js/messaging';
import { waitForTx } from '@aztec/aztec.js/node';
import { EthAddress } from '@aztec/foundation/eth-address';
import type { AztecNode } from '@aztec/stdlib/interfaces/client';
import { Tag } from '@aztec/stdlib/logs';
import { TxExecutionResult, type TxHash, TxStatus } from '@aztec/stdlib/tx';
import type { EmbeddedWallet } from '@aztec/wallets/embedded';
import type { Hex } from 'viem';
import { claimLeaf } from '../../../bridge/src/inbox.ts';
import { advance, type Crossing, type CrossingKind, crossingId } from '../../../bridge/src/journal.ts';
import type { OperationQueue } from '../../../bridge/src/queue.ts';
import { type CrossingSecrets, deriveCrossingSecrets, exitLogTag } from '../../../bridge/src/secrets.ts';
import { signForward, signRedeem } from '../../../bridge/src/signatures.ts';
import { forwardArgsFromArchive } from '../../../bridge/src/witness.ts';
import type { FeeFor } from '../feePayer';
import { depositOnEthereum, forwardOnEthereum, redeemOnEthereum, type WagmiConfig } from './eth.ts';
import { type BridgeStore, scanNextIndex } from './store.ts';

/** The wallet and the contracts bound to it; read at every operation, so a rebuilt chain view is what sends. */
export interface L2Handles {
  wallet: EmbeddedWallet;
  miner: Contract;
  token: Contract;
  fee: FeeFor;
}

export interface BridgeContext {
  node: AztecNode;
  l2: () => L2Handles;
  from: AztecAddress;
  master: Uint8Array;
  chainId: bigint;
  /** This build's version: the source of a send-ahead or an exit, the destination of a claim. */
  version: bigint;
  portal: Hex;
  yaca: Hex;
  store: BridgeStore;
  queue: OperationQueue;
  /** The miner's pause around a proof; absent when no miner runs (the old app). */
  pause?: (reason: 'bridge') => void;
  release?: (reason: 'bridge') => void;
  /** Ethereum's clock in seconds: what the portal holds a signature's expiry against. */
  l1Now: () => Promise<bigint>;
  /** Asked once the queue reaches the operation, just before anything is signed: throws to refuse it. */
  preflight?: () => Promise<void>;
  /** The device's clock, for the journal's timestamps; a test's stand-in. */
  now?: () => number;
}

const WAIT = { timeout: 600 };

const scopeOf = (ctx: BridgeContext) => ({
  chainId: ctx.chainId,
  portal: EthAddress.fromString(ctx.portal),
  version: ctx.version,
});

export const secretsFor = (
  ctx: BridgeContext,
  index: number,
  version = ctx.version,
): Promise<CrossingSecrets> => deriveCrossingSecrets(ctx.master, { ...scopeOf(ctx), version }, index);

/** Under the queue and the pause; the pause lifts however the operation ends. */
async function guarded<T>(ctx: BridgeContext, op: () => Promise<T>): Promise<T> {
  return ctx.queue.run(async () => {
    await ctx.preflight?.();
    ctx.pause?.('bridge');
    try {
      return await op();
    } finally {
      ctx.release?.('bridge');
    }
  });
}

/** The burn the miner performs on the holder's behalf, authorised for this one call. */
async function burnAuthwit(ctx: BridgeContext, amount: bigint) {
  const nonce = (await import('@aztec/aztec.js/fields')).Fr.random();
  const { wallet, miner, token } = ctx.l2();
  const call = await token.methods.burn_private(ctx.from, amount, nonce).getFunctionCall();
  const witness = await wallet.createAuthWit(ctx.from, { caller: miner.address, call });
  return { nonce, witness };
}

/** The account's next unused index on `version`, from the miner's exit log, by the tags of both kinds. */
export const nextIndexFromChain = (ctx: BridgeContext, version = ctx.version): Promise<number> =>
  scanNextIndex(async (indices) => {
    const tags: Tag[] = [];
    for (const i of indices) {
      const s = await secretsFor(ctx, i, version);
      tags.push(new Tag(await exitLogTag(s.tag)), new Tag(await exitLogTag(s.secretHash)));
    }
    const logs = await ctx.node.getPublicLogsByTags({ contractAddress: ctx.l2().miner.address, tags });
    return indices.map((_, i) => (logs[2 * i]?.length ?? 0) > 0 || (logs[2 * i + 1]?.length ?? 0) > 0);
  });

const fresh = (
  ctx: BridgeContext,
  kind: CrossingKind,
  index: number,
  amount: bigint,
  ethAddress: Hex,
): Crossing => {
  const now = ctx.now?.() ?? Date.now();
  const base = {
    kind,
    chainId: ctx.chainId.toString(),
    portal: ctx.portal,
    version: ctx.version.toString(),
    index,
  };
  return {
    ...base,
    id: crossingId(base),
    amount: amount.toString(),
    state: 'proving',
    createdAt: now,
    updatedAt: now,
    ethAddress,
  };
};

/**
 * Sends, records the hash the moment the node has the transaction, then waits for its block. A
 * transaction sent may still be included after the page is gone: the record must find it by its hash.
 */
async function sendRecorded(
  ctx: BridgeContext,
  c: Crossing,
  send: () => Promise<{ txHash: TxHash }>,
): Promise<Crossing> {
  const { txHash } = await send();
  await ctx.store.update(c.id, (x) =>
    advance(
      { ...x, txHash: txHash.toString() },
      { now: ctx.now?.() ?? Date.now(), tx: { status: 'pending' } },
    ),
  );
  await waitForTx(ctx.node, txHash, {
    timeout: WAIT.timeout,
    initialDelay: 1,
    waitForStatus: TxStatus.PROPOSED,
  });
  const receipt = await ctx.node.getTxReceipt(txHash);
  if (receipt.executionResult === TxExecutionResult.REVERTED)
    throw new Error(`transaction ${txHash.toString()} reverted`);
  return ctx.store.update(c.id, (x) =>
    advance(x, {
      now: ctx.now?.() ?? Date.now(),
      tx: { status: 'mined', block: Number(receipt.blockNumber ?? 0) },
    }),
  );
}

/** K2: burn `amount` here, commit to the master's secret for this index; lands on the next version. */
export function sendAhead(ctx: BridgeContext, amount: bigint): Promise<Crossing> {
  return guarded(ctx, async () => {
    const c = await ctx.store.create(
      ctx.version.toString(),
      () => nextIndexFromChain(ctx),
      (index) => fresh(ctx, 2, index, amount, `0x${'00'.repeat(20)}`),
    );
    const secrets = await secretsFor(ctx, c.index);
    await ctx.store.update(c.id, (x) => ({ ...x, ethAddress: secrets.redeemAddress.toString() as Hex }));
    const { nonce, witness } = await burnAuthwit(ctx, amount);
    const { miner, fee } = ctx.l2();
    return sendRecorded(ctx, c, () =>
      miner.methods
        .send_ahead(amount, secrets.secretHash, secrets.redeemAddress, nonce)
        .send({ from: ctx.from, fee: fee as never, authWitnesses: [witness], wait: NO_WAIT }),
    );
  });
}

/** K1: burn `amount` here for `recipient` on Ethereum. */
export function exitToL1(ctx: BridgeContext, amount: bigint, recipient: Hex): Promise<Crossing> {
  return guarded(ctx, async () => {
    const c = await ctx.store.create(
      ctx.version.toString(),
      () => nextIndexFromChain(ctx),
      (index) => fresh(ctx, 1, index, amount, recipient),
    );
    const secrets = await secretsFor(ctx, c.index);
    const { nonce, witness } = await burnAuthwit(ctx, amount);
    const { miner, fee } = ctx.l2();
    return sendRecorded(ctx, c, () =>
      miner.methods
        .exit_to_l1(amount, EthAddress.fromString(recipient), secrets.tag, nonce)
        .send({ from: ctx.from, fee: fee as never, authWitnesses: [witness], wait: NO_WAIT }),
    );
  });
}

/** Claims a forwarded send-ahead or a deposit here, to this account, with the secret its index derives. */
export function claimArrival(ctx: BridgeContext, c: Crossing, timeoutSeconds = 600): Promise<Crossing> {
  return guarded(ctx, async () => {
    if (!c.inboxIndex) throw new Error('nothing to claim: the crossing has no Inbox message yet');
    const secrets = await secretsFor(ctx, c.index, BigInt(c.version));
    const { miner, fee } = ctx.l2();
    const leaf = claimLeaf(
      {
        chainId: ctx.chainId,
        rollupVersion: ctx.version,
        miner: miner.address,
        portal: EthAddress.fromString(ctx.portal),
      },
      BigInt(c.amount),
      secrets.secretHash,
      BigInt(c.inboxIndex),
    );
    await waitForL1ToL2MessageReady(ctx.node, leaf, { timeoutSeconds });
    const { receipt } = await miner.methods
      .claim_from_l1(BigInt(c.amount), secrets.secret, ctx.from, BigInt(c.inboxIndex))
      .send({ from: ctx.from, fee: fee as never, wait: WAIT });
    return ctx.store.update(c.id, (x) =>
      advance(x, {
        now: ctx.now?.() ?? Date.now(),
        claimed: { txHash: receipt.txHash.toString(), block: Number(receipt.blockNumber ?? 0) },
      }),
    );
  });
}

/**
 * K3: two wallet transactions on Ethereum; the crossing is recorded before the first, under an
 * index of its own every time. A deposit the wallet never answered is never sent again under the
 * same secret — the wallet may have sent it after all — so the page cannot tell one message from
 * two; its record waits for Ethereum's event or gives itself up after the deposit's deadline.
 */
export function deposit(
  ctx: BridgeContext,
  config: WagmiConfig,
  amount: bigint,
  deadline: bigint,
  onStep?: (step: 'approve' | 'deposit') => void,
): Promise<Crossing> {
  return guarded(ctx, async () => {
    const c = await ctx.store.create(
      ctx.version.toString(),
      () => nextIndexFromChain(ctx),
      (index) => fresh(ctx, 3, index, amount, `0x${'00'.repeat(20)}`),
    );
    const secrets = await secretsFor(ctx, c.index);
    const done = await depositOnEthereum(
      config,
      {
        portal: ctx.portal,
        yaca: ctx.yaca,
        amount,
        secretHash: secrets.secretHash.toString() as Hex,
        version: ctx.version,
        deadline,
      },
      onStep,
      async (txHash) => {
        await ctx.store.update(c.id, (x) => ({
          ...x,
          l1TxHash: txHash,
          updatedAt: ctx.now?.() ?? Date.now(),
        }));
      },
    );
    return ctx.store.update(c.id, (x) =>
      advance(x, {
        now: ctx.now?.() ?? Date.now(),
        deposited: { txHash: done.txHash, inboxIndex: done.inboxIndex.toString() },
      }),
    );
  });
}

const HOUR = 3600n;

/** The redeem key's Forward signature over the send-ahead's leaf and `target`, good for an hour of Ethereum's clock. */
async function holderSignature(
  ctx: BridgeContext,
  c: Crossing,
  args: ReturnType<typeof forwardArgsFromArchive>,
  target: bigint,
): Promise<{ sig: Hex; expiry: bigint }> {
  const secrets = await secretsFor(ctx, c.index, BigInt(c.version));
  const expiry = (await ctx.l1Now()) + HOUR;
  const sig = await signForward(
    secrets.redeemKey,
    { chainId: ctx.chainId, portal: ctx.portal, version: BigInt(c.version), expiry },
    args,
    target,
  );
  return { sig, expiry };
}

/**
 * The holder forwards a witnessed exit or held send-ahead themselves; the wallet pays. A
 * send-ahead's forward into `target` carries the redeem key's signature; an exit to Ethereum is
 * anyone's to forward, and the portal reads no signature for it.
 */
export function selfForward(
  ctx: BridgeContext,
  config: WagmiConfig,
  c: Crossing,
  target: bigint,
): Promise<Crossing> {
  return guarded(ctx, async () => {
    if (!c.witness) throw new Error('the send-ahead has no witness yet');
    const args = forwardArgsFromArchive(c.witness);
    const signed =
      c.kind === 2 ? await holderSignature(ctx, c, args, target) : { sig: '0x' as Hex, expiry: 0n };
    const done = await forwardOnEthereum(config, {
      portal: ctx.portal,
      version: BigInt(c.version),
      args: { ...args, ...signed },
    });
    return ctx.store.update(c.id, (x) =>
      advance(x, {
        now: ctx.now?.() ?? Date.now(),
        forwarded: {
          txHash: done.txHash,
          inboxIndex: done.inboxIndex.toString(),
          target: done.target.toString(),
        },
      }),
    );
  });
}

/** A held send-ahead becomes YACA on Ethereum for `recipient` instead. */
export function redeem(
  ctx: BridgeContext,
  config: WagmiConfig,
  c: Crossing,
  recipient: Hex,
): Promise<Crossing> {
  return guarded(ctx, async () => {
    if (!c.witness) throw new Error('the send-ahead has no witness yet');
    const secrets = await secretsFor(ctx, c.index, BigInt(c.version));
    const expiry = (await ctx.l1Now()) + HOUR;
    const args = forwardArgsFromArchive(c.witness);
    const sig = await signRedeem(
      secrets.redeemKey,
      { chainId: ctx.chainId, portal: ctx.portal, version: BigInt(c.version), expiry },
      args,
      recipient,
    );
    const done = await redeemOnEthereum(config, {
      portal: ctx.portal,
      version: BigInt(c.version),
      args,
      recipient,
      expiry,
      sig,
    });
    return ctx.store.update(c.id, (x) =>
      advance(x, { now: ctx.now?.() ?? Date.now(), redeemed: { txHash: done.txHash } }),
    );
  });
}
