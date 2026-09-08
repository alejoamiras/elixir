/** Human scale for large counts: 1.2k, 3.4M, 5.6G. */
export function compact(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  const units = ['', 'k', 'M', 'G', 'T', 'P'];
  let i = 0;
  let v = n;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)}${units[i]}`;
}

/** `duration` as a KPI's value and unit: ["21", "min"]; ["—", ""] when there is none. */
export function durationParts(seconds: number): [string, string] {
  const text = duration(seconds);
  const i = text.lastIndexOf(' ');
  return i < 0 ? [text, ''] : [text.slice(0, i), text.slice(i + 1)];
}

export function duration(seconds: number): string {
  if (!Number.isFinite(seconds)) return '—';
  if (seconds < 60) return `${Math.round(seconds)} s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} h`;
  return `${(seconds / 86400).toFixed(1)} d`;
}

/** A live counter as `m:ss` (minutes unbounded): 312 → "5:12". */
export const clockMinutes = (seconds: number): string => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Token amount with `decimals`, trimmed to at most `places` fractional digits. */
export function amount(raw: bigint, decimals: number, places = 4): string {
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const frac = (raw % base).toString().padStart(decimals, '0').slice(0, places).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole.toString();
}

export const shortAddress = (a: string): string => (a.length > 14 ? `${a.slice(0, 8)}…${a.slice(-4)}` : a);
