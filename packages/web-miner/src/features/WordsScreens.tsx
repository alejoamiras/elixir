import { useEffect, useRef, useState } from 'react';
import { validWords } from '../../../miner-core/src/keys/mnemonic.ts';
import { Alert, AlertDescription, AlertTitle, Button, Input, Textarea } from '../../../ui/src/index.ts';
import { answer, HIDE_AFTER_MS, passed, pending, QUIZ_INDICES, type Quiz, startQuiz } from './words-quiz';

/** The grid: dots replace the words in the DOM once hidden (not a blur anyone can undo in CSS). */
function WordGrid({ words, hidden }: { words: string[]; hidden: boolean }) {
  return (
    <ol className="grid grid-cols-3 gap-2" data-testid="words-grid" data-hidden={hidden || undefined}>
      {words.map((w, i) => (
        <li
          key={`${i.toString()}-${w}`}
          className="rounded-sm border border-line bg-panel px-2.5 py-1.5 font-mono text-xs"
        >
          <span className="mr-2 text-ink-4">{i + 1}</span>
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
    <div className="grid grid-cols-3 gap-2" data-testid="quiz">
      {QUIZ_INDICES.map((i) => (
        <label key={i} htmlFor={`quiz-${i + 1}`} className="flex flex-col gap-1 text-xs text-ink-2">
          word {i + 1}
          <Input
            id={`quiz-${i + 1}`}
            value={quiz.answers[i] ?? ''}
            onChange={(e) => onAnswer(i, e.target.value)}
            onPaste={noPaste}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            data-testid={`quiz-${i + 1}`}
            aria-invalid={quiz.answers[i] !== undefined && pending(quiz).includes(i) ? true : undefined}
          />
        </label>
      ))}
    </div>
  );
}

/** Reveal → checkbox (words become dots) → quiz. Also hides on tab hide and after 60 s. */
export function WordsBackup({
  phrase,
  onDone,
  onSkip,
  error,
}: {
  phrase: string;
  onDone: () => Promise<void>;
  onSkip?: () => Promise<void>;
  error?: string;
}) {
  const [written, setWritten] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [quiz, setQuiz] = useState(() => startQuiz(phrase));
  const [busy, setBusy] = useState(false);
  const quizRef = useRef(quiz);
  quizRef.current = quiz;
  useEffect(() => {
    const hide = () => setHidden(true);
    const timer = setTimeout(hide, HIDE_AFTER_MS);
    const onVisibility = () => document.hidden && hide();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      // The quiz forgets its answers; the phrase itself lives on in the session for the backup screen.
      setQuiz(startQuiz(''));
    };
  }, []);
  const words = phrase.split(' ');
  const go = (fn: () => Promise<void>) => {
    setBusy(true);
    void fn().finally(() => setBusy(false));
  };
  return (
    <div className="flex flex-col gap-5" data-testid="words-backup">
      <div>
        <h1 className="text-2xl">Your twelve words</h1>
        <p className="mt-2 text-ink-2">
          Write them down, in order, somewhere offline. They are the only way back into this account and its
          balance.
        </p>
      </div>
      {error && (
        <Alert variant="bad" data-testid="key-error">
          <AlertTitle>That did not work</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <WordGrid words={words} hidden={hidden || written} />
      <label className="flex items-center gap-3 text-sm text-ink-2">
        <input
          type="checkbox"
          checked={written}
          onChange={(e) => setWritten(e.target.checked)}
          className="accent-uv"
          data-testid="written"
        />
        I've written them down.
      </label>
      {written && (
        <>
          <p className="label-mono">confirm · type word 3, 7 and 11</p>
          <QuizForm quiz={quiz} onAnswer={(i, v) => setQuiz((q) => answer(q, i, v))} />
          <p className="text-xs text-ink-2">
            Paste is disabled here: it keeps an attacker from confirming a phrase you never read. The words
            above are hidden while you type.
          </p>
        </>
      )}
      <div className="flex gap-3">
        <Button
          variant="uv"
          disabled={!passed(quiz) || busy}
          onClick={() => go(onDone)}
          data-testid="words-done"
        >
          {busy ? 'Opening…' : 'Done'}
        </Button>
        {onSkip && (
          <Button variant="link" disabled={busy} onClick={() => go(onSkip)} data-testid="words-skip">
            Skip for now (the account stays "not backed up")
          </Button>
        )}
      </div>
    </div>
  );
}

/** Restore from a phrase: the hostname banner, a textarea that accepts paste but no drop, no clipboard reads. */
export function WordsRestore({
  onOpen,
  onBack,
  error,
}: {
  onOpen: (phrase: string) => Promise<void>;
  onBack: () => void;
  error?: string;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => () => setText(''), []);
  const valid = validWords(text);
  return (
    <div className="flex flex-col gap-5" data-testid="words-restore">
      <div>
        <h1 className="text-2xl">Enter your twelve words</h1>
      </div>
      <Alert variant="warn" data-testid="host-banner">
        <AlertDescription>
          You are on <span className="font-mono">{location.hostname}</span>. Yacana never asks for your words
          in chat, email or support. If anyone does, it is not us.
        </AlertDescription>
      </Alert>
      {error && (
        <Alert variant="bad" data-testid="key-error">
          <AlertTitle>That did not work</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onDrop={(e) => e.preventDefault()}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        placeholder="ripple canyon shadow …"
        data-testid="words-input"
        aria-label="twelve words"
      />
      <p className="text-xs text-ink-2">No drag-and-drop, no clipboard reads.</p>
      <div className="flex gap-3">
        <Button
          variant="uv"
          disabled={!valid || busy}
          onClick={() => {
            setBusy(true);
            void onOpen(text).finally(() => setBusy(false));
          }}
          data-testid="words-open"
        >
          {busy ? 'Opening…' : 'Open account'}
        </Button>
        <Button variant="link" disabled={busy} onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}
