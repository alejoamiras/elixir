// Sub-ephemeral port windows for every local harness. A listener parked inside the kernel's
// ephemeral range can be handed to an outgoing connection between claim and bind; every window
// here sits strictly below the LIVE floor read from /proc, not a hardcoded constant.
import { readFileSync } from 'node:fs';

/** Lowest port the kernel auto-assigns to outgoing connections (Linux default 32768). */
export function ephemeralFloor(): number {
  try {
    const first = readFileSync('/proc/sys/net/ipv4/ip_local_port_range', 'utf8').trim().split(/\s+/)[0];
    const parsed = Number(first);
    if (Number.isInteger(parsed) && parsed > 1024) return parsed;
  } catch {
    /* non-linux */
  }
  return 32768;
}

/** Width of one run's window; all of a run's service lanes must fit inside it. */
export const WINDOW_STRIDE = 100;

/** Lowest port this allocator ever hands out (clear of well-known ranges). */
export const RANGE_START = 10240;

/** Deterministic per-run window base, strictly below the ephemeral floor for every run id. */
export function runPortWindowBase(runId: string): number {
  const floor = ephemeralFloor();
  const windows = Math.floor((floor - RANGE_START) / WINDOW_STRIDE);
  if (windows < 1) throw new Error(`port-window: ephemeral floor ${floor} leaves no sub-ephemeral window`);
  // FNV-1a over the whole id: a constant prefix must not collapse every run into one window.
  let hash = 2166136261;
  for (let i = 0; i < runId.length; i += 1) {
    hash ^= runId.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return RANGE_START + (hash % windows) * WINDOW_STRIDE;
}

/** Base for one service lane inside a run window; throws rather than let a lane escape it. */
export function lanePortBase(windowBase: number, laneIndex: number, span: number): number {
  const base = windowBase + laneIndex * span;
  const limit = Math.min(windowBase + WINDOW_STRIDE, ephemeralFloor());
  if (base + span > limit) {
    throw new Error(
      `port-window: lane ${laneIndex} (span ${span}) escapes its window [${windowBase}, ${limit})`,
    );
  }
  return base;
}
