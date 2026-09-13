// The FAQ: three sections of question rows, the six panels of the upgrade between them. The
// questions the other pages link to keep their words (`copy.faq.questions`). Yacana forwards by
// hand, a deposit is one transaction, a claim is a tap, a held send can be redeemed any time.
import { PARAMS } from '../../miner-core/src/generated/params.ts';
import { copy } from './copy';

export interface FaqQuestion {
  q: string;
  a: string;
}

export interface FaqSection {
  id: string;
  title: string;
  /** A line under the title; the upgrade section carries the six panels after it. */
  lede?: string;
  panels?: boolean;
  questions: FaqQuestion[];
}

const symbol = PARAMS.TOKEN_SYMBOL;

/** One of the questions the pages link to, by its words. */
const linked = (q: string): FaqQuestion => {
  const found = copy.faq.questions.find((x) => x.q === q);
  if (!found) throw new Error(`no FAQ question ${JSON.stringify(q)}`);
  return found;
};

export const faq = {
  eyebrow: 'questions',
  title: 'What happens to your coins, in plain words.',
  sections: [
    {
      id: 'mining',
      title: 'Mining',
      questions: [
        linked('How is it mined?'),
        {
          q: 'What does the chain see?',
          a: 'A claim writes a nullifier, a note hash and a counter. Not who claimed, not how much they hold, not how many proofs it took.',
        },
        {
          q: 'Can the rules change?',
          a: 'The contracts are immutable. What can change is Aztec itself: a new version of the rollup replaces the old one, and that is what the next section is about.',
        },
      ],
    },
    {
      id: 'upgrade',
      title: 'When Aztec upgrades',
      lede: 'Aztec’s Alpha rollups do not carry balances to the next version. Yacana moves yours through Ethereum in six steps; you act at step 2 and step 6.',
      panels: true,
      questions: [
        {
          q: 'What do I do?',
          a: 'When an upgrade is announced, Yacana shows one button: Send ahead. Press it before the upgrade, and again for what you mine after that. Then, once the next version is live, sign in with the same passkey or words; the arrival card offers a Claim, one tap, and your balance lands there.',
        },
        {
          q: 'What if I miss it?',
          a: `After the upgrade, mining on the old version ends: its contract refuses every mining claim from then on. But it keeps proving epochs for hours or days, without notice of when it stops, and while it does the old app still lets you send ahead what you hold: a bet that it proves one more epoch, against the sure loss of leaving it. A send it never proves is undone back onto it.`,
        },
        {
          q: 'What if Yacana never opens the next version?',
          a: 'Your send is proven and held on Ethereum, not on any Yacana contract. A send that could not be forwarded can be redeemed on Ethereum as YACA at any time, by the account that made it.',
        },
        {
          q: 'Is it the same account on the next version?',
          a: 'Same passkey or words, same keys; a new address, because Aztec derives addresses from the account contract of each version. What you sent ahead lands under the new address; nothing on the old version knows it.',
        },
        linked('Who may forward a held send, and why the rule?'),
        linked('What is public?'),
        linked('What can go wrong?'),
      ],
    },
    {
      id: 'ethereum',
      title: 'To Ethereum and back',
      questions: [
        {
          q: 'Can I hold it on Ethereum?',
          a: `Yes: To Ethereum in the wallet burns ${symbol} here and mints YACA, an ERC-20, to an address you choose. The amount and the address are public there. Yacana forwards exits by hand, and anyone may forward one.`,
        },
        {
          q: 'Can I bring it back?',
          a: `Yes: Deposit from Ethereum burns YACA there in one transaction and the portal sends it across; a tap on the arrival card mints it privately here, to your account.`,
        },
        linked('How does the everyday bridge work?'),
        linked('What does Yacana hold?'),
        {
          q: 'Who can stop it?',
          a: 'The operators can pause the bridge for a bounded time, 30 days at a time and 60 in total per version, and register each new version once. They cannot redirect a send or keep an exit from landing once a pause lifts.',
        },
      ],
    },
  ] as FaqSection[],
} as const;
