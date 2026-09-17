// The record's lifecycle block: what no chain records about a retired version — when it stopped
// proving, when its node was taken down. A write to the version's own record and nothing else;
// the old origin's redeploy carries it to the page (docs/upgrades.md). Never copied to a
// continuation: the deploy builds that record from the source's epochs alone.
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { LifecycleRecord } from '@yacana/bridge/src/record.ts';
import type { Deployment } from '../deploy.ts';

const repo = resolve(import.meta.dir, '../../../..');

export type LifecycleCommand = 'note-stop' | 'retire-node';
export const LIFECYCLE_COMMANDS: readonly string[] = ['note-stop', 'retire-node'];

/**
 * The block after the command, or a refusal: the record must be the version named (a stop noted on
 * the wrong record would silence the wrong origin), a stop is a past unix time noted once, and a
 * node is retired only after the stop it implies.
 */
export function lifecycleAfter(
  record: Pick<Deployment, 'rollupVersion' | 'lifecycle'>,
  command: LifecycleCommand,
  version: string,
  at: string,
  now = Math.floor(Date.now() / 1000),
): LifecycleRecord {
  if (version !== record.rollupVersion)
    throw new Error(
      `the record is version ${record.rollupVersion}: point YACANA_RECORD at version ${version}'s`,
    );
  const current = record.lifecycle ?? {};
  if (command === 'note-stop') {
    if (!/^\d{1,10}$/.test(at)) throw new Error(`${at} is not a unix time in seconds`);
    if (Number(at) > now) throw new Error(`${at} is in the future: note the stop after it happened`);
    if (current.stoppedProvingAt !== undefined)
      throw new Error(`the stop is already noted at ${current.stoppedProvingAt}`);
    return { ...current, stoppedProvingAt: at };
  }
  if (current.stoppedProvingAt === undefined)
    throw new Error('note-stop first: a node is retired after the version stopped proving');
  if (current.nodeRetired) throw new Error('the node is already noted as retired');
  return { ...current, nodeRetired: true };
}

/**
 * Applies the command to the record at `path` (relative to the repo) and writes it back whole,
 * through a rename so a cut write leaves the record as it was; returns the block written.
 */
export function writeLifecycle(
  path: string,
  command: LifecycleCommand,
  version: string,
  at = Math.floor(Date.now() / 1000).toString(),
): LifecycleRecord {
  const file = resolve(repo, path);
  const record = JSON.parse(readFileSync(file, 'utf8')) as Deployment;
  const lifecycle = lifecycleAfter(record, command, version, at);
  writeFileSync(`${file}.tmp`, `${JSON.stringify({ ...record, lifecycle }, null, 2)}\n`);
  renameSync(`${file}.tmp`, file);
  return lifecycle;
}
