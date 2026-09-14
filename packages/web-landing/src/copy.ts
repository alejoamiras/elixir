// Every sentence on the page, so it can be edited as text. The numbers come from the protocol
// parameters, so the testnet and mainnet pages state their own schedule.
import { PARAMS } from '../../miner-core/src/generated/params.ts';
import { scheduledClaimsPerHour } from '../../miner-core/src/metrics.ts';

const RULES = { N: PARAMS.N, EXPECTED_EPOCH_SECONDS: PARAMS.EXPECTED_EPOCH_SECONDS, T_MAX: PARAMS.T_MAX };
const reward = Number(PARAMS.REWARD / 10n ** BigInt(PARAMS.DECIMALS));
const claimsPerHour = scheduledClaimsPerHour(RULES);
const perHour = claimsPerHour * reward;
const epochMinutes = Number(PARAMS.EXPECTED_EPOCH_SECONDS) / 60;
const symbol = PARAMS.TOKEN_SYMBOL;
/** No reveal window, no launch lottery on this network (the testnet profile); mainnet's opens epoch 0 by lottery. */
const lottery = PARAMS.REVEAL_WINDOW_SECONDS > 0n;
const MINUTES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const minutesWord = MINUTES[epochMinutes] ?? String(epochMinutes);

export const REPO = 'https://github.com/alejoamiras/elixir';
export const LINKS = {
  github: REPO,
  docs: `${REPO}#readme`,
  threatModel: `${REPO}/blob/main/docs/threat-model.md`,
  launchDocs: `${REPO}/blob/main/docs/deployments.md`,
};
export const commitUrl = (sha: string): string => `${REPO}/commit/${sha}`;

/** Section ids, in page order; the bar's anchors and the tests' expectations. */
export const SECTIONS = ['hero', 'money', 'chain', 'how', 'verify', 'ask'] as const;
export type SectionId = (typeof SECTIONS)[number];

export const copy = {
  bar: {
    anchors: [
      { id: 'money', label: 'Money' },
      { id: 'chain', label: 'Chain' },
      { id: 'how', label: 'How' },
      { id: 'verify', label: 'Verify' },
    ] satisfies { id: SectionId; label: string }[],
    mine: 'Mine on testnet',
    stats: 'Stats',
  },
  hero: {
    headline: 'Bitcoin made money need no bank. YACA makes it need no witness.',
    subhead: 'Proof-of-work money on Aztec, mined in your browser: earned by anyone, private to everyone.',
    reassurance:
      'An Aztec-standards token: private notes, private transfers, no gas on testnet. Mining needs a desktop browser; 20 MB once.',
    mobile: 'Mining needs a desktop browser. Send yourself the link, or watch the network from here.',
    share: 'Send me the link',
    copied: 'link copied',
    watch: 'Watch the stats',
    live: 'live from the chain',
    unreachable: 'the node is not answering; these are the last numbers read',
    loading: 'reading the chain…',
    noHistory: 'no closed epoch yet',
    unlaunched: 'epoch 0 has not opened yet',
    mintedSub: 'by browsers',
    barSub: 'what a proof has to clear',
    caption: 'the bar over the last six epochs · a dot per accepted claim, spread across its epoch',
    captionShort: 'the bar over every epoch so far · a dot per accepted claim, spread across its epoch',
    rule: `${PARAMS.N} claims close an epoch, then the bar moves`,
    allStats: 'all stats →',
  },
  money: {
    heading: 'Nobody prints it. Nobody sees who has it.',
    lede: `${reward} ${symbol} per accepted proof, ${PARAMS.N} claims every ${minutesWord} minutes, forever. No premine, no admin key, no special hardware.`,
    table: {
      columns: ['Bitcoin', 'Zcash', symbol],
      rows: [
        { k: 'issuance', cells: ['21 M, halvings', '21 M, halvings', `${perHour} an hour, constant`] },
        {
          k: 'who got coins first',
          cells: [
            'miners only',
            '20 % to founders, then a dev fund',
            lottery
              ? 'miners only · a public launch lottery'
              : 'miners only (mainnet: a public launch lottery)',
          ],
        },
        { k: 'who can mine', cells: ['ASIC farms', 'ASIC farms', 'any desktop browser'] },
        { k: 'your balance', cells: ['public', 'private if you shield', 'private notes'] },
        {
          k: 'who mined a coin',
          cells: ['an address, forever', 'an address, unless shielded', 'no address on the claim'],
        },
        {
          k: 'rules can change',
          cells: ['by network consensus', 'by network upgrades', 'never · immutable'],
        },
      ],
    },
  },
  chain: {
    heading: 'Public: that a coin was mined. Private: the notes and the transfers.',
    body: 'A claim writes a nullifier, a note hash and a counter. Not the recipient, not the secret, not how many proofs it took. A public withdraw shows its amount and address, which is why it is a choice.',
    ledger: {
      public: 'public · one claim, as recorded',
      nullifier: 'a nullifier',
      noteHash: 'a note hash',
      claims: (epoch: number) => `claims in epoch ${epoch}`,
      fee: 'fee paid by',
      sponsor: 'the sponsor',
      private: 'private · never on the chain',
      rows: ['who claimed', 'how much they hold', 'how many proofs it took', 'who they pay, and how much'],
      handshake:
        'a first claim carries Aztec’s delivery handshake, which someone who already knows that address can match',
    },
  },
  how: {
    label: 'how it works',
    heading: 'Prove. Score. Claim.',
    steps: [
      {
        n: 'prove',
        title: 'Your browser proves a fixed circuit',
        body: 'A 150k-gate Noir circuit, proved by Barretenberg in WASM, a few seconds each. The work is the proof itself; there is nothing to buy and nothing to install.',
      },
      {
        n: 'score',
        title: 'The proof gets a score against the bar',
        body: `Poseidon2 over the whole proof. The bar moves every epoch, by at most ×4, so that ${PARAMS.N} claims take about ${epochMinutes} minutes.`,
      },
      {
        n: 'claim',
        title: 'A private transaction verifies it and mints',
        body: `The claim checks the proof inside a private Aztec function and mints ${reward} ${symbol} to an account only you hold. A nullifier makes sure it can be claimed once.`,
      },
    ],
  },
  verify: {
    heading: 'See for yourself.',
    body: 'The contracts are immutable, the verifier key is pinned inside the claim circuit, and every number on this page is read or derived from public storage. Each address below opens on the explorer.',
    source: 'Read the source',
  },
  ask: {
    heading: 'A tab is enough.',
    watch: 'Watch the stats',
  },
  footer: {
    line: 'no trackers, no cookies, no requests except to the Aztec node you choose',
    links: [
      { label: 'GitHub', href: LINKS.github },
      { label: 'Docs', href: LINKS.docs },
      { label: 'Stats', href: 'stats' },
      { label: 'FAQ', href: 'faq' },
      { label: 'Threat model', href: LINKS.threatModel },
    ],
  },
  /** The one line every page carries while a migration is announced; `day` is the expected flip's. */
  announcement: (version: string, day: string) =>
    `Aztec's next version arrives around ${day}. Mining on ${version} ends at the flip; send what you hold ahead from the miner before then.`,
  announcementLink: 'what happens →',
  faq: {
    title: 'What happens, and what can go wrong',
    lede: `${symbol} is mined on one Aztec version at a time. When Aztec moves to the next, what you hold moves with you if you send it ahead; the bridge to Ethereum works the same way every day. Six panels, then the questions.`,
    panels: [
      {
        id: 'announced',
        title: 'Aztec announces the next version',
        body: 'Every Yacana page says so, with the day it is expected. Mining goes on until the flip.',
      },
      {
        id: 'send',
        title: 'You send ahead',
        body: `A private burn on the current version, proved in your browser in about 20 s. The amount, under a one-time secret only your passkey derives, is now the portal's to hold.`,
      },
      {
        id: 'proven',
        title: 'The version proves the epoch',
        body: 'Usually within a few epochs. Until then nothing has left; if the version never proves it in time, the burn is undone on the version, and your balance shows again once the node you read from has followed the prune.',
      },
      {
        id: 'held',
        title: 'Held on Ethereum',
        body: 'The portal holds it for this account alone. Ethereum sees the amount and when it crossed, not who.',
      },
      {
        id: 'flip',
        title: 'The flip, then the forward',
        body: "Aztec names the next version. Yacana forwards held sends into it by hand; you may forward yours from the miner, or redeem it to Ethereum instead, while the old version's exits are open.",
      },
      {
        id: 'landed',
        title: 'You claim on the next version',
        body: 'Sign in with the same passkey; one tap, a private mint. Anything still on the old version when it goes quiet is lost — it goes quiet days after the flip, without notice.',
      },
    ],
    questions: [
      {
        q: 'How is it mined?',
        a: `Your browser proves a fixed circuit per nonce; a ticket below the target wins, and the claim is a private transaction that mints ${reward} ${symbol}. ${PARAMS.N} claims close an epoch and the bar moves. No address on the claim, no sponsor's view of who won.`,
      },
      {
        q: 'How does the everyday bridge work?',
        a: `To Ethereum: a private burn here, proven to Ethereum with the epoch, then minted as YACA (an ERC-20) to the address you named — Yacana forwards exits by hand, and anyone may forward one. From Ethereum: one deposit from your Ethereum wallet, then a tap on the arrival card. The amount and the address are public on Ethereum; that is why it is a choice.`,
      },
      {
        q: 'Who may forward a held send, and why the rule?',
        a: "Only you — from a device that holds your passkey — or Yacana's listed forwarder. A stranger could otherwise push your send into a rollup about to stop, where it would be stranded. The forwarder holds no funds and cannot redirect them: a forward lands on the version Aztec names, under your secret.",
      },
      {
        q: 'What is public?',
        a: 'On Aztec: that a coin was mined — a nullifier, a note hash, a counter — never who. On Ethereum: every crossing’s amount and time, and the address an exit names or a deposit comes from. Someone matching amounts and times across the two sides could link them.',
      },
      {
        q: 'What can go wrong?',
        a: `The version never proves the epoch in time: the burn is undone on the version, your balance shows again once your node has followed the prune, and you send again. The portal is paused: exits and deposits wait, 30 days at most per call and 60 in total per version. More has left the version than its schedule allows: before the flip, exits wait for the limit to grow; after the flip the limit is frozen, and what is beyond it cannot leave that version. A version's exits close at its deadline, 180 days after the flip at the earliest: nothing leaves after it. The old version goes quiet with something still on it: that is lost. Your device forgot the journal: the recovery file restores it, and the twelve words restore the account.`,
      },
      {
        q: 'What does Yacana hold?',
        a: 'Nothing of yours. The contracts are immutable and no one can raise a limit or move a balance. The operators register which miner a version trusts, once and for good (a wrong first registration would let that miner issue up to the version’s limit and strand sends forwarded into it, which is why the forwarder refuses a version whose miner is not the announced one), pause the portal within its limits, list a forwarder, close deposits before a flip, and may hand the role to another address.',
      },
    ],
    back: '← the argument',
    mine: 'Open the miner',
    stats: 'The bridge on stats',
  },
  launch: {
    eyebrow: 'Yacana mainnet · launch',
    phases: {
      commit: 'reveals begin in',
      reveal: 'the reveal window closes in',
      launch: 'epoch 0 opens with the next launch()',
      open: 'epoch 0 is open',
    },
    anyone: 'anyone may call it',
    body: 'The first seed is drawn from everyone who commits before launch and reveals in the 10 minutes after. Commit a random number now; reveal it late. One late honest reveal is what keeps the seed unpredictable.',
    commit: 'Commit my entropy',
    commitSub: 'from any Aztec wallet · a public tx · the docs show the command',
    reveals: 'reveals so far',
  },
} as const;

export { claimsPerHour, perHour, reward, symbol };
