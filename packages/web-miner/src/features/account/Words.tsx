import { useEffect, useState } from 'react';
import { Button, Input } from '../../../../ui/src/index.ts';
import type { AccountError } from '../../state';
import { answer, HIDE_AFTER_MS, passed, pending, QUIZ_INDICES, type Quiz, startQuiz } from '../words-quiz';
import { AccountNote } from './Notes';
import { Consent, Primary, Quiet, QuietRow, Screen } from './Screen';

/** The grid: dots replace the words in the DOM once hidden (not a blur anyone can undo in CSS). */
function WordGrid({ words, hidden }: { words: string[]; hidden: boolean }) {
  return (
    <ol className="grid grid-cols-3 gap-2" data-testid="words-grid" data-hidden={hidden || undefined}>
      {words.map((w, i) => (
        <li
          key={`${i.toString()}-${w}`}
          className="flex items-baseline gap-2 rounded-[6px] border border-line px-2.5 py-2 font-mono text-[13px] font-medium"
        >
          <span className="text-[10.5px] text-ink-3">{String(i + 1).padStart(2, '0')}</span>
          {hidden ? '••••••' : w}
        </li>
      ))}
    </ol>
  );
}

const noPaste = (e: React.ClipboardEvent) => e.preventDefault();

/** Words 3, 7 and 11 typed back; paste is blocked so a phrase never read cannot be confirmed. */
function QuizForm({ quiz, onAnswer }: { quiz: Quiz; onAnswer: (index: number, value: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] text-ink-2">Confirm: type words 3, 7 and 11. Paste is off here.</span>
      <div className="grid grid-cols-3 gap-2" data-testid="quiz">
        {QUIZ_INDICES.map((i) => (
          <label key={i} htmlFor={`quiz-${i + 1}`} className="flex flex-col gap-1">
            <span className="label-mono">word {i + 1}</span>
            <Input
              id={`quiz-${i + 1}`}
              value={quiz.answers[i] ?? ''}
              onChange={(e) => onAnswer(i, e.target.value)}
              onPaste={noPaste}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="font-mono text-[13px]"
              data-testid={`quiz-${i + 1}`}
              aria-invalid={quiz.answers[i] !== undefined && pending(quiz).includes(i) ? true : undefined}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

/**
 * The twelve words, written down and confirmed: reveal → checkbox (the words become dots) → the
 * quiz → Finish setup. Also hides on tab hide and after 60 s. `onSkip` is "Back up later" (the
 * account then reads "not backed up" until the Wallet's backup passes the same quiz).
 */
export function WordsBackup({
  phrase,
  onDone,
  onSkip,
  onBack,
  error,
  eyebrow = 'create account · 12 words',
}: {
  phrase: string;
  onDone: () => Promise<void>;
  onSkip?: () => Promise<void>;
  onBack?: () => void;
  error?: AccountError;
  eyebrow?: string;
}) {
  const [written, setWritten] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [quiz, setQuiz] = useState(() => startQuiz(phrase));
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const hide = () => setHidden(true);
    const timer = setTimeout(hide, HIDE_AFTER_MS);
    const onVisibility = () => document.hidden && hide();
    document.addEventListener('visibilitychange', onVisibility);
    // No state reset here: the answers die with the component, and a reset from an effect's cleanup
    // ran under StrictMode's rehearsal too, leaving a mounted quiz that no answer could pass.
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
  const words = phrase.split(' ');
  const go = (fn: () => Promise<void>) => {
    setBusy(true);
    void fn().finally(() => setBusy(false));
  };
  const copy = () =>
    void navigator.clipboard
      ?.writeText(phrase)
      .then(() => setCopied(true))
      .catch(() => {});
  return (
    <Screen
      eyebrow={eyebrow}
      title="Write down your 12 words."
      body="Made on this device, never sent anywhere. They are the only way back into this account."
      onBack={onBack}
      data-testid="words-backup"
    >
      <div className="flex items-center justify-between">
        <span className="label-mono">your words</span>
        <Button size="sm" onClick={copy} disabled={hidden || written} data-testid="words-copy">
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
      <WordGrid words={words} hidden={hidden || written} />
      {error && <AccountNote error={error} context="create" />}
      <Consent checked={written} onChange={setWritten} testId="written">
        I've written them down.
      </Consent>
      {written && <QuizForm quiz={quiz} onAnswer={(i, v) => setQuiz((q) => answer(q, i, v))} />}
      <Primary disabled={!passed(quiz) || busy} onClick={() => go(onDone)} data-testid="words-done">
        Finish setup
      </Primary>
      {onSkip && (
        <QuietRow>
          <Quiet disabled={busy} onClick={() => go(onSkip)} data-testid="words-skip">
            Back up later
          </Quiet>
        </QuietRow>
      )}
    </Screen>
  );
}
