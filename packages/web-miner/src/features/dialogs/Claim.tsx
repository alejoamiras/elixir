// What the holder does with a crossing on Ethereum, from the connected wallet: claim a proven exit
// for the recipient chosen at the send, forward a held send-ahead into the version it lands on, or
// redeem one as YACA for the connected account. The rows name the payer and the fixed recipient;
// the chain switch is a visible step; the wallet's ETH is read before it is asked; a portal refusal
// is said in the row's own words.
import { useAtomValue } from 'jotai';
import { useEffect, useRef, useState } from 'react';
import type { Hex } from 'viem';
import { useAccount } from 'wagmi';
import type { Crossing } from '../../../../bridge/src/journal.ts';
import { PARAMS } from '../../../../miner-core/src/generated/params.ts';
import { Alert, AlertDescription, ExternalLink, Note, Stepper } from '../../../../ui/src/index.ts';
import { revertLine } from '../../bridge/copy';
import { nextVersionName, versionNameOf } from '../../bridge/env';
import type { PayerAsk } from '../../bridge/session';
import { l1Links } from '../../explorer';
import { amount as fmt, shortAddress } from '../../lib/format';
import type { Session } from '../../session';
import { bridgeAtom } from '../../state';
import { Actions, firstLine, Primary, Quiet, Row, Rows, TxDialog } from './Frame';
import {
  ConnectWallet,
  chain,
  noEth,
  useWalletChain,
  useWalletName,
  useYacaBalance,
  WalletChip,
  WrongNetwork,
  YacaAvailable,
} from './Wallet';

export type HeldAction = 'forward' | 'redeem';
type Kind = 'claim' | 'forward' | 'redeem';

const VERBS: Record<Kind, { verb: string; ing: string; done: string; eyebrow: string }> = {
  claim: { verb: 'claim', ing: 'Claiming', done: 'Claimed', eyebrow: 'claim' },
  forward: { verb: 'forward', ing: 'Forwarding', done: 'Forwarded', eyebrow: 'forward' },
  redeem: { verb: 'redeem', ing: 'Redeeming', done: 'Redeemed', eyebrow: 'redeem' },
};

/** The wallet said no: viem's name for it, or its sentence. */
const rejected = (e: unknown): boolean =>
  e instanceof Error && (e.name === 'UserRejectedRequestError' || /user rejected/i.test(e.message));

type Step =
  | { kind: 'ready' }
  | { kind: 'waiting' }
  | { kind: 'rejected' }
  | { kind: 'done'; crossing?: Crossing };

/** A held action's failure: the row's own words when the portal refused, else the error's first line. */
const explain = (
  e: unknown,
  c: Crossing,
  flipped: boolean,
  pausedUntil: bigint | undefined,
  wallet: string,
) =>
  revertLine(e, c, {
    version: versionNameOf(c.version),
    target: versionNameOf(c.target),
    flipped,
    pausedUntil,
    money: `${fmt(BigInt(c.amount), PARAMS.DECIMALS)} YACA`,
    who: shortAddress(c.ethAddress),
    chain: chain(),
    wallet,
  }) ?? firstLine(e);

function Summary({ kind, c, target }: { kind: Kind; c: Crossing; target: string }) {
  const account = useAccount();
  const wallet = useWalletName();
  const yaca = fmt(BigInt(c.amount), PARAMS.DECIMALS);
  return (
    <Rows>
      {kind === 'claim' && (
        <Row label="To" sub="chosen when you bridged">
          {shortAddress(c.ethAddress)}
        </Row>
      )}
      {kind === 'forward' && (
        <Row label="To" sub="this account, the same passkey">
          {target}
        </Row>
      )}
      {kind === 'redeem' && (
        <Row label="To" sub="the connected wallet">
          {account.address ? shortAddress(account.address) : '…'}
        </Row>
      )}
      <Row label="Paid by" sub="the gas, nothing else">
        {wallet} · in {chain()} ETH
      </Row>
      <Row label="Then">
        {kind === 'forward' ? `claimable on ${target} with one tap` : `${yaca} YACA at that address`}
      </Row>
    </Rows>
  );
}

function Progress({ kind, step, crossing }: { kind: Kind; step: Step; crossing: Crossing }) {
  const wallet = useWalletName();
  const v = VERBS[kind];
  if (step.kind === 'done') {
    const tx = step.crossing?.l1TxHash ?? crossing.l1TxHash;
    return (
      <Stepper
        steps={[
          { id: 'confirm', label: `Confirmed in ${wallet}`, state: 'done' },
          {
            id: 'done',
            label: v.done,
            state: 'done',
            right: tx ? (
              <ExternalLink href={l1Links.tx(tx)} full={tx}>
                View on Etherscan ↗
              </ExternalLink>
            ) : undefined,
            detail:
              kind === 'forward'
                ? 'Claimable here in a few minutes; the Wallet shows a Claim button then.'
                : `${fmt(BigInt(crossing.amount), PARAMS.DECIMALS)} YACA at ${kind === 'claim' ? shortAddress(crossing.ethAddress) : 'the connected wallet'}.`,
          },
        ]}
      />
    );
  }
  return (
    <Stepper
      data-testid={`${kind}-progress`}
      steps={[
        step.kind === 'rejected'
          ? {
              id: 'confirm',
              label: `${wallet} rejected it`,
              state: 'failed',
              detail: `Nothing was ${v.done.toLowerCase()}; the YACA is still yours to ${v.verb}.`,
            }
          : {
              id: 'confirm',
              label: `Confirm in ${wallet}`,
              state: 'active',
              detail: `${wallet} asks you to confirm the ${v.verb} and shows the gas.`,
            },
        { id: 'ing', label: v.ing, state: 'pending', right: 'waiting for Ethereum' },
        { id: 'done', label: v.done, state: 'pending' },
      ]}
    />
  );
}

/** The dialog's body once a wallet is connected: the rows, the notes, the one button. */
function Body({
  session,
  crossing,
  action,
  onClose,
}: {
  session: Session;
  crossing: Crossing;
  action: HeldAction;
  onClose: () => void;
}) {
  const account = useAccount();
  const view = useAtomValue(bridgeAtom);
  const wallet = useWalletName();
  const net = useWalletChain();
  const yaca = useYacaBalance(account.address);
  const kind: Kind = action === 'forward' && crossing.kind === 1 ? 'claim' : action;
  const target = crossing.target
    ? versionNameOf(crossing.target, view.canonical)
    : nextVersionName(view.canonical);
  const [step, setStep] = useState<Step>({ kind: 'ready' });
  const [error, setError] = useState<string>();
  const [funds, setFunds] = useState<string | null>(null);
  const latest = useRef(0);
  const address = account.address;
  /** The refusal, null when the wallet can pay or there is nothing to price, `stale` when overtaken. */
  const readFunds = async (): Promise<string | null | 'stale'> => {
    // An exit's claim carries no signature, so pricing it authorises nothing; a forward and a redeem
    // are signed by the redeem key, and that signature is not made to fill in a number.
    if (kind !== 'claim' || !address || !session.bridge) return null;
    const ask: PayerAsk = { kind: 'claim', crossing };
    const mine = ++latest.current;
    const refused = noEth(await session.bridge.payerFunds(address, ask), wallet);
    if (mine !== latest.current) return 'stale';
    setFunds(refused);
    return refused;
  };
  // On open and at every account change: the wallet's ETH against this claim's gas, before it is asked.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-read on the crossing and the account alone
  useEffect(() => {
    latest.current++;
    setFunds(null);
    if (address) void readFunds().catch(() => {});
  }, [crossing.id, address]);
  const failed = (e: unknown): void => {
    if (rejected(e)) {
      setStep({ kind: 'rejected' });
      return;
    }
    const flipped = view.canonical !== undefined && view.canonical.version !== BigInt(crossing.version);
    const pausedUntil = view.standing?.paused ? view.standing.pausedUntil : undefined;
    setError(explain(e, crossing, flipped, pausedUntil, wallet));
    setStep({ kind: 'ready' });
  };
  const perform = async (to: Hex) => {
    setStep({ kind: 'waiting' });
    try {
      const done =
        action === 'redeem'
          ? await session.bridge?.redeem(crossing, to)
          : await session.bridge?.selfForward(crossing);
      setStep({ kind: 'done', crossing: done ?? undefined });
    } catch (e) {
      failed(e);
    }
  };
  const go = async () => {
    if (!address) return;
    setError(undefined);
    if (net.wrong) {
      await net.switchTo().catch((e) => setError(rejected(e) ? `${wallet} did not switch.` : firstLine(e)));
      return;
    }
    // Read again on the click: the balance may have moved since the dialog opened.
    if ((await readFunds().catch(() => null)) === null) await perform(address as Hex);
  };
  const v = VERBS[kind];
  const label = net.wrong ? `Switch ${wallet} to ${chain()}` : `${v.done.replace(/ed$/, '')} with ${wallet}`;
  return (
    <>
      <WalletChip aside={<YacaAvailable yaca={yaca} />} />
      {error && (
        <Alert variant="bad" data-testid={`${action}-error`}>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {step.kind === 'ready' && <Summary kind={kind} c={crossing} target={target} />}
      {step.kind === 'ready' && net.wrong && (
        <WrongNetwork wallet={wallet} onChain={net.onChain} verb={v.verb} />
      )}
      {step.kind === 'ready' && funds && !net.wrong && address && (
        <Note title={funds} tone="warn" data-testid="payer-no-eth">
          Add some to {shortAddress(address)}, then {v.verb}. The YACA waits for you.
        </Note>
      )}
      {step.kind !== 'ready' && <Progress kind={kind} step={step} crossing={crossing} />}
      {step.kind === 'ready' && (
        <Actions quiet={<Quiet onClick={onClose}>Not now</Quiet>}>
          <Primary
            disabled={net.switching || (!net.wrong && funds !== null)}
            onClick={() => void go()}
            data-testid={`${action}-go`}
          >
            {label}
          </Primary>
        </Actions>
      )}
      {step.kind === 'rejected' && (
        <Actions quiet={<Quiet onClick={onClose}>Not now</Quiet>}>
          <Primary onClick={() => void go()} data-testid={`${action}-go`}>
            Try again
          </Primary>
        </Actions>
      )}
      {step.kind === 'done' && (
        <Actions>
          <Primary variant="primary" onClick={onClose} data-testid={`${action}-done`}>
            Done
          </Primary>
        </Actions>
      )}
    </>
  );
}

export function ClaimDialog({
  session,
  crossing,
  action,
  onOpenChange,
}: {
  session: Session;
  crossing: Crossing | null;
  action: HeldAction;
  onOpenChange: (open: boolean) => void;
}) {
  const account = useAccount();
  const view = useAtomValue(bridgeAtom);
  const close = () => onOpenChange(false);
  if (!crossing) return null;
  const kind: Kind = action === 'forward' && crossing.kind === 1 ? 'claim' : action;
  const yaca = fmt(BigInt(crossing.amount), PARAMS.DECIMALS);
  const target = crossing.target
    ? versionNameOf(crossing.target, view.canonical)
    : nextVersionName(view.canonical);
  const title =
    kind === 'claim'
      ? `Claim ${yaca} YACA on Ethereum.`
      : kind === 'forward'
        ? `Forward ${yaca} ${PARAMS.TOKEN_SYMBOL} to ${target}.`
        : `Redeem ${yaca} YACA on Ethereum.`;
  const connected = account.isConnected && account.address !== undefined;
  return (
    <TxDialog
      open
      onOpenChange={(o) => !o && close()}
      eyebrow={VERBS[kind].eyebrow}
      title={title}
      body={
        connected ? undefined : 'Connect the wallet that pays the gas. It learns nothing about this account.'
      }
      data-testid={`${action}-dialog`}
    >
      {connected ? (
        <Body key={crossing.id} session={session} crossing={crossing} action={action} onClose={close} />
      ) : (
        <ConnectWallet onCancel={close} />
      )}
    </TxDialog>
  );
}
