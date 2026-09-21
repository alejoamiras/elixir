import { describe, expect, test } from 'vitest';
import { parseAmount } from './withdraw-form';
import { answer, passed, pending, QUIZ_INDICES, startQuiz } from './words-quiz';

const phrase = 'ripple canyon shadow immune basket lunar quantum orbit glove steel river cactus';

describe('words quiz', () => {
  test('asks words 3, 7 and 11; passes only when all three match, case- and space-insensitive', () => {
    expect(QUIZ_INDICES).toEqual([2, 6, 10]);
    let q = startQuiz(phrase);
    expect(passed(q)).toBe(false);
    expect(pending(q)).toEqual([2, 6, 10]);
    q = answer(q, 2, ' Shadow ');
    q = answer(q, 6, 'quantum');
    expect(pending(q)).toEqual([10]);
    q = answer(q, 10, 'rivers');
    expect(passed(q)).toBe(false);
    q = answer(q, 10, 'river');
    expect(passed(q)).toBe(true);
  });
});

describe('withdraw amounts', () => {
  test('decimal strings become integers without floats; garbage is refused', () => {
    expect(parseAmount('1', 18)).toBe(10n ** 18n);
    expect(parseAmount('1.5', 18)).toBe(15n * 10n ** 17n);
    expect(parseAmount('0.000000000000000001', 18)).toBe(1n);
    expect(parseAmount('4.1234', 2 + 2)).toBe(41234n);
    for (const bad of ['', '0', '1e3', '-1', '1,5', '.5', '1.', 'abc'])
      expect(() => parseAmount(bad, 18), bad).toThrow();
    expect(() => parseAmount('1.0000000000000000001', 18)).toThrow(/decimal places/);
  });
});
