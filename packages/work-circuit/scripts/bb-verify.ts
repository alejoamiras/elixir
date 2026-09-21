// `bb verify` as a three-way answer. bb 5.2.0 exits 1 for a proof it refuses and for a file it
// cannot open alike, so the exit status cannot tell a refusal from a verifier that never ran: the
// diagnostic does, against a closed list, and anything off that list is not a verdict.
import { BB } from './toolchain.ts';

export interface VerifyFiles {
  proof: string;
  publicInputs: string;
  vk: string;
}

/** `wellFormed`: every element decoded and the proof failed the checks, rather than failing to parse. */
export type Verdict = { verified: true } | { verified: false; wellFormed: boolean };

/** bb gave no verdict: an input it could not read, a binary that did not run or was killed, a diagnostic never seen. */
export class OperationalError extends Error {
  readonly operational = true;
}

// The last of these is bb's limb-range assertion on a commitment coordinate.
const MALFORMED =
  /Deserialized point is not on the curve|Non-canonical proof element|invalid proof size|bad proof serde or parsing/;
const REFUSED = /Proof verification failed/;

interface Ran {
  exitCode: number | null;
  signal: string | null;
  stderr: string;
}

async function run(files: VerifyFiles, bb: string): Promise<Ran> {
  try {
    const child = Bun.spawn(
      [
        bb,
        'verify',
        '-p',
        files.proof,
        '-i',
        files.publicInputs,
        '-k',
        files.vk,
        '--scheme',
        'ultra_honk',
        '-t',
        'noir-recursive-no-zk',
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    const stderr = await new Response(child.stderr).text();
    const exitCode = await child.exited;
    return { exitCode: child.signalCode ? null : exitCode, signal: child.signalCode, stderr };
  } catch (e) {
    throw new OperationalError(`bb did not run: ${(e as Error).message}`);
  }
}

/** Throws {@link OperationalError} unless bb answered; a refusal is a value, never a throw. */
export async function verify(files: VerifyFiles, bb: string = BB): Promise<Verdict> {
  const { exitCode, signal, stderr } = await run(files, bb);
  if (exitCode === 0) return { verified: true };
  if (exitCode === 1) {
    // A truncated proof is reported as a failed verification too: the parse errors are read first.
    if (MALFORMED.test(stderr)) return { verified: false, wellFormed: false };
    if (REFUSED.test(stderr)) return { verified: false, wellFormed: true };
  }
  const last = stderr.trim().split('\n').at(-1) ?? '';
  throw new OperationalError(
    `bb verify gave no verdict (exit ${exitCode}, signal ${signal ?? 'none'}): ${last}`,
  );
}
