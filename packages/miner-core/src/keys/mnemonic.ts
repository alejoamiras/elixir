// Twelve English words (128 bits, bip39); the phrase is normalised before validation so a
// re-typed phrase with odd spacing or case still opens the key.
import {
  entropyToMnemonic,
  generateMnemonic,
  mnemonicToEntropy,
  mnemonicToSeed,
  validateMnemonic,
} from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { masterFromSeed } from './derive.ts';

export const WORDS = 12;

export const generateWords = (): string => generateMnemonic(wordlist, 128);

export const normaliseWords = (input: string): string =>
  input.normalize('NFKD').toLowerCase().trim().split(/\s+/).join(' ');

export const validWords = (input: string): boolean => {
  const phrase = normaliseWords(input);
  return phrase.split(' ').length === WORDS && validateMnemonic(phrase, wordlist);
};

/** Validates, then bip39 seed → the master (no passphrase: the words alone are the key). */
export async function masterFromMnemonic(input: string): Promise<Uint8Array> {
  if (!validWords(input)) throw new Error('not a valid twelve-word phrase');
  return masterFromSeed(await mnemonicToSeed(normaliseWords(input)));
}

/** The 16 bytes behind a valid phrase; what a device stores so the words can be shown again. */
export function entropyOf(input: string): Uint8Array<ArrayBuffer> {
  if (!validWords(input)) throw new Error('not a valid twelve-word phrase');
  return new Uint8Array(mnemonicToEntropy(normaliseWords(input), wordlist));
}

export const phraseFromEntropy = (entropy: Uint8Array): string => entropyToMnemonic(entropy, wordlist);

export const isWord = (w: string): boolean => wordlist.includes(w);
