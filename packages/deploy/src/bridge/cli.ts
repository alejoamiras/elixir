// The bridge CLI's arguments, checked before any connection is opened: positionals in order, and
// only the flags a command declares.
export type FlagKind = 'switch' | 'integer';

export interface CliArgs {
  positional: string[];
  flags: Map<string, true | number>;
}

export function parseCliArgs(argv: string[], known: Record<string, FlagKind>): CliArgs {
  const positional: string[] = [];
  const flags = new Map<string, true | number>();
  const words = argv.filter((a) => a !== '--');
  for (let i = 0; i < words.length; i++) {
    const word = words[i] as string;
    if (!word.startsWith('--')) {
      positional.push(word);
      continue;
    }
    const kind = known[word];
    if (!kind) throw new Error(`unknown flag ${word}`);
    if (flags.has(word)) throw new Error(`${word} given twice`);
    if (kind === 'switch') {
      flags.set(word, true);
      continue;
    }
    const value = words[++i];
    if (value === undefined || !/^\d+$/.test(value)) throw new Error(`${word} takes a whole number`);
    flags.set(word, Number(value));
  }
  return { positional, flags };
}
