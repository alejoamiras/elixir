import { describe, expect, test } from 'vitest';
import type { NodeHealth } from '../../../site/src/browser/node-health.ts';
import { type EditState, editReducer, probeFailure, rebuildFailure, rowWords } from './node-check.ts';

const A = 'https://a.example/rpc';
const B = 'https://b.example/rpc';

describe('the node row’s edit machine', () => {
  test('Change opens the field, Cancel closes it; a save owns its answers, another URL’s are dropped', () => {
    let s: EditState = editReducer({ kind: 'row' }, { type: 'change', url: A });
    expect(s).toEqual({ kind: 'editing', url: A });
    expect(editReducer(s, { type: 'cancel' })).toEqual({ kind: 'row' });
    s = editReducer(s, { type: 'edit', url: B });
    s = editReducer(s, { type: 'probe', url: B });
    expect(s).toEqual({ kind: 'probing', url: B });
    expect(editReducer(s, { type: 'reachable', url: A, latencyMs: 1 })).toBe(s);
    expect(editReducer(s, { type: 'cancel' })).toBe(s); // a save under way is not cancelled
    s = editReducer(s, { type: 'reachable', url: B, latencyMs: 600 });
    expect(s).toEqual({ kind: 'switching', url: B, latencyMs: 600 });
    expect(editReducer(s, { type: 'saved' })).toEqual({ kind: 'row' });
    // A failure keeps the field, with the message under it.
    expect(editReducer(s, { type: 'failed', url: B, message: 'Kept a.' })).toEqual({
      kind: 'editing',
      url: B,
      error: 'Kept a.',
    });
  });

  test('the deployment check’s refusals in the row’s words; a rebuild failure names both nodes', () => {
    expect(probeFailure('node serves rollup 0x17, this build expects 0x05', 'v5.example')).toBe(
      "Not this deployment's node (it serves rollup 0x17). Kept v5.example.",
    );
    expect(probeFailure('node is on chain 1, this build expects 31337', 'v5.example')).toBe(
      "Not this deployment's node (it is on chain 1). Kept v5.example.",
    );
    expect(probeFailure('not a URL', 'v5.example')).toBe('not a URL. Kept v5.example.');
    expect(rebuildFailure('my-node.example.net', 'it stopped answering.', 'v5.example')).toBe(
      "Couldn't rebuild your view from my-node.example.net: it stopped answering. Kept v5.example.",
    );
    expect(rebuildFailure('my-node.example.net', 'it stopped answering', null)).toBe(
      "Couldn't rebuild your view from my-node.example.net: it stopped answering. The former node did not answer either; reload the page.",
    );
  });
});

describe('the row’s words', () => {
  const now = 1_700_000_000_000;
  const h = (over: Partial<NodeHealth>): NodeHealth => ({
    transport: { kind: 'ok', latencyMs: 12 },
    lastReadAt: now - 30_000,
    tip: { block: 83117, checkpoint: 10, timestamp: now / 1000 - 12, observedAt: now },
    l1: null,
    deploymentOk: true,
    behind: false,
    ...over,
  });
  test('healthy and unknown carry the block and its age; behind and silent say what is paused', () => {
    expect(rowWords('healthy', h({}), now, 12, false)).toEqual({
      chip: { word: 'healthy', tone: 'ok' },
      line: 'block 83,117 · 12 s ago',
      retry: false,
    });
    expect(rowWords('unknown', h({}), now, 12, false).chip).toEqual({ word: 'healthy', tone: 'ok' });
    expect(rowWords('unknown', h({ deploymentOk: null }), now, 12, false).chip).toEqual({
      word: 'checking',
      tone: 'dim',
    });
    expect(rowWords('behind', h({ behind: true }), now, 240, true)).toEqual({
      chip: { word: 'behind · 4 min', tone: 'warn' },
      line: 'block 83,117 · 4 min ago · the node answers, but its chain is old · mining paused',
      retry: false,
    });
    const silent = h({
      transport: { kind: 'silent', since: now - 120_000, retryAt: now + 10_000, backoffMs: 20_000 },
      lastReadAt: Date.UTC(2026, 0, 1, 14, 2),
    });
    expect(rowWords('silent', silent, now, 120, true)).toEqual({
      chip: { word: 'no answer · 2 min', tone: 'warn' },
      line: 'your view is from 14:02 · mining paused',
      retry: true,
    });
    expect(rowWords('throttled', h({}), now, 40, false).line).toBe(
      'block 83,117 · 40 s ago · public nodes throttle busy pages; it recovers on its own · mining pauses if it lasts a minute',
    );
  });
});
