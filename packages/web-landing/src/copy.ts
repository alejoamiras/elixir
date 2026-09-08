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
      { label: 'Threat model', href: LINKS.threatModel },
    ],
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
