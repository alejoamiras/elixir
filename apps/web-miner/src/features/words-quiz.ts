// The write-down gate: three of the twelve words, typed back with paste blocked. Pure so the rule
// is tested without a DOM; the component owns the timers (hide after 60 s, hide on tab hide).
export const QUIZ_INDICES = [2, 6, 10] as const; // words 3, 7 and 11

export interface Quiz {
  words: string[];
  answers: Record<number, string>;
}

export const startQuiz = (phrase: string): Quiz => ({ words: phrase.split(' '), answers: {} });

export const answer = (q: Quiz, index: number, value: string): Quiz => ({
  ...q,
  answers: { ...q.answers, [index]: value.trim().toLowerCase() },
});

export const correct = (q: Quiz, index: number): boolean => q.answers[index] === q.words[index];

export const passed = (q: Quiz): boolean => QUIZ_INDICES.every((i) => correct(q, i));

/** Which of the three is still wrong or empty; the form marks them, the phrase stays hidden. */
export const pending = (q: Quiz): number[] => QUIZ_INDICES.filter((i) => !correct(q, i));

export const HIDE_AFTER_MS = 60_000;
