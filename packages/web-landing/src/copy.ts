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

export const REPO = 'https://github.com/alejoamiras/elixir';
export const LINKS = {
  github: REPO,
  docs: `${REPO}#readme`,
  threatModel: `${REPO}/blob/main/docs/threat-model.md`,
  launchDocs: `${REPO}/blob/main/docs/deployments.md`,
};

/** Section ids, in page order; the bar's anchors and the tests' expectations. */
export const SECTIONS = ['hero', 'money', 'chain', 'how', 'live', 'verify', 'ask'] as const;
export type SectionId = (typeof SECTIONS)[number];

export const copy = {
  bar: {
    anchors: [
      { id: 'money', label: 'Money' },
      { id: 'chain', label: 'Chain' },
      { id: 'how', label: 'How' },
      { id: 'live', label: 'Live' },
      { id: 'verify', label: 'Verify' },
    ] satisfies { id: SectionId; label: string }[],
    mine: 'Mine on testnet',
    stats: 'Stats',
  },
  hero: {
    headline: 'Bitcoin made money need no bank. YACA makes it need no witness.',
    subhead:
      'Proof-of-work money on Aztec, mined in your browser: earned by anyone, private to everyone. Your browser proves work; the chain learns no worker.',
    prove: 'Prove one now',
    reassurance:
      'An Aztec-standards token: private notes, private transfers, no gas on testnet. Mining needs a desktop browser; 20 MB once.',
    mobile: 'Mining needs a desktop browser. Send yourself the link, or watch the network from here.',
    share: 'Send me the link',
    copied: 'link copied',
    watch: 'Watch the stats',
  },
  money: {
    heading: 'Nobody prints it. Nobody holds a key to it. Nobody sees who has it.',
    rules: [
      {
        k: 'issued',
        v: `${reward} ${symbol} per accepted proof · ${PARAMS.N} per ${epochMinutes} minutes · about ${perHour} an hour, forever`,
      },
      { k: 'supply', v: 'no cap; constant issuance, so the inflation rate falls every year' },
      { k: 'premine', v: 'none; epoch 0 was opened by a public lottery, not by us' },
      { k: 'admin', v: 'none; the contracts are immutable, there is no upgrade key' },
      { k: 'held as', v: 'private notes on Aztec; a public balance only if you choose it' },
      { k: 'mined by', v: 'a desktop browser today, a native prover later, never an ASIC farm' },
    ],
    table: {
      columns: ['Bitcoin', 'Zcash', symbol],
      rows: [
        {
          k: 'issuance',
          cells: ['21 M, halvings', '21 M, halvings', `${perHour} / hour, constant`],
          tone: ['amber', 'amber', 'green'],
        },
        {
          k: 'who got coins first',
          cells: [
            'miners only',
            '20 % of rewards to founders, then a dev fund',
            'miners only · public launch lottery',
          ],
          tone: ['green', 'red', 'green'],
        },
        {
          k: 'who can mine',
          cells: ['ASIC farms', 'ASIC farms', 'any desktop browser'],
          tone: ['red', 'red', 'green'],
        },
        {
          k: 'your balance',
          cells: ['public', 'private if you shield', 'private, always'],
          tone: ['red', 'amber', 'green'],
        },
        {
          k: 'who mined a coin',
          cells: ['an address, forever', 'an address, unless shielded', 'nobody'],
          tone: ['red', 'amber', 'green'],
        },
        {
          k: 'rules can change',
          cells: ['by network consensus', 'by network upgrades', 'never · immutable'],
          tone: ['amber', 'amber', 'green'],
        },
      ],
    },
  },
  chain: {
    heading: 'Public: that a coin was mined. Private: everything else.',
    body: 'A claim writes a nullifier, a note hash and a counter. Not the recipient, not the secret, not how many proofs it took. Never who, how fast, how much.',
    holding:
      'The same is true of holding and spending it: a transfer is a nullifier and a note hash, nothing more. On testnet the sponsor pays the fee, so not even the payer is you; on mainnet a private fee path is the roadmap, and the page will say which it is.',
    footprint: [
      { k: 'a claim reveals', v: '1 nullifier · 1 note hash · claims + 1' },
      { k: 'a transfer reveals', v: '1 nullifier · 1 note hash' },
      { k: 'never', v: 'who · how fast · how much' },
    ],
  },
  how: {
    heading: 'How it works',
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
        body: `The claim checks the proof inside a private Aztec function and mints ${reward} ${symbol} to a key only you hold. A nullifier makes sure it can be claimed once.`,
      },
    ],
    more: 'Read the mechanism in full: the docs and the threat model →',
  },
  live: {
    heading: 'Live',
    sub: 'difficulty since launch · all stats →',
    unreachable: 'the node is not answering; these are the last numbers read',
    loading: 'reading the chain…',
    noHistory: 'no closed epoch yet',
  },
  verify: {
    heading: "Don't trust this page.",
    body: 'The contracts are immutable, the verifier key is pinned inside the claim circuit, the proving keys are hash-checked before use, and the miner makes no request except to the node you choose.',
    source: 'Read the source',
    threatModel: 'Threat model',
    build: 'Build it yourself',
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
      { label: 'Threat model', href: LINKS.threatModel },
    ],
  },
  demo: {
    before: 'Each dot is a proof scored against today’s bar. Press Prove one now to add your own.',
    proving: 'proving on this machine',
    nothingSent: 'Nothing is sent anywhere. Your CPU, your proof.',
    steps: {
      crs: 'proving keys · 20 MB · sha256 ✓',
      prover: 'prover ready',
      proof: 'proof · 410 fields',
      score: 'score · Poseidon2 over the proof',
    },
    proved: 'proved on this machine',
    yourScore: 'your score',
    bar: 'the bar',
    odds: 'odds per proof',
    again: 'Prove another',
    keepGoing: 'Keep going: mine on testnet',
    failed: 'the proof did not finish',
    timeout: 'no proof in 90 s: this machine may be too slow for the demo, or the tab was in the background',
    needsChain: 'the demo needs the open epoch from the chain',
  },
  launch: {
    eyebrow: 'Yacana mainnet · launch',
    opensIn: 'epoch 0 opens in',
    open: 'epoch 0 is open',
    body: 'The first seed is drawn from everyone who commits before launch and reveals in the 10 minutes after. Commit a random number now; reveal it late. One late honest reveal is what keeps the seed unpredictable.',
    commit: 'Commit my entropy',
    commitSub: 'from any Aztec wallet · a public tx · the docs show the command',
    reveals: 'reveals so far',
  },
} as const;

export { claimsPerHour, perHour, reward, symbol };
