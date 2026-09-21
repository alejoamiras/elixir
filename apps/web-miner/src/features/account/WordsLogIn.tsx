import { isWord, normaliseWords, validWords, WORDS } from '@yacana/miner-core/keys/mnemonic';
import { Textarea } from '@yacana/ui';
import { useEffect, useState } from 'react';
import type { AccountError } from '../../state';
import { AccountNote } from './Notes';
import { Primary, Screen } from './Screen';

/** What the line under the field says of the phrase so far: the count, or the first thing wrong. */
export function checkWords(text: string): { count: number; problem?: string } {
  const typed = normaliseWords(text);
  const words = typed ? typed.split(' ') : [];
  const off = words.findIndex((w) => !isWord(w));
  if (off !== -1)
    return { count: words.length, problem: `Word ${off + 1} isn't in the list: check "${words[off]}".` };
  if (words.length === WORDS && !validWords(typed))
    return {
      count: words.length,
      problem:
        "These 12 words don't form a valid phrase. Check each word, and their order, against what you saved.",
    };
  return { count: words.length };
}

/** Log in from a phrase: the hostname line, a textarea that accepts paste but no drop, no clipboard reads. */
export function WordsLogIn({
  error,
  busy,
  onOpen,
  onBack,
}: {
  error?: AccountError;
  busy: boolean;
  onOpen: (phrase: string) => void;
  onBack: () => void;
}) {
  const [text, setText] = useState('');
  useEffect(() => () => setText(''), []);
  const check = checkWords(text);
  const valid = check.problem === undefined && check.count === WORDS && validWords(text);
  return (
    <Screen
      eyebrow="log in · 12 words"
      title="Enter your 12 words."
      body="Type or paste the words you saved."
      onBack={onBack}
      data-testid="words-restore"
    >
      <p className="text-[13px] leading-[1.45] text-ink-3" data-testid="host-banner">
        You're on <b className="font-medium text-ink-2">{location.hostname}</b>. Yacana never asks for your
        words in chat, email or support.
      </p>
      {error && <AccountNote error={error} context="login" />}
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onDrop={(e) => e.preventDefault()}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="ripple canyon shadow …"
        className="min-h-[92px] px-3 py-2.5 text-[13px] leading-[1.6]"
        aria-invalid={check.problem ? true : undefined}
        data-testid="words-input"
        aria-label="twelve words"
      />
      <div
        className="flex items-start justify-between gap-3 px-0.5 font-mono text-xs text-ink-3"
        data-testid="words-under"
      >
        <span className={check.problem && 'text-bad'}>{check.problem}</span>
        <span className="shrink-0 whitespace-nowrap">
          {check.count} of {WORDS}
        </span>
      </div>
      <Primary disabled={!valid || busy} onClick={() => onOpen(text)} data-testid="words-open">
        Log in
      </Primary>
    </Screen>
  );
}
