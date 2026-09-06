// Two short notes on a win; no asset to fetch. Browsers refuse audio before any user gesture, so a
// first Start is what unlocks it.
let ctx: AudioContext | undefined;

export function chime(): void {
  if (typeof AudioContext === 'undefined') return;
  ctx ??= new AudioContext();
  const at = ctx.currentTime;
  for (const [i, hz] of [660, 990].entries()) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = hz;
    gain.gain.setValueAtTime(0.0001, at + i * 0.12);
    gain.gain.exponentialRampToValueAtTime(0.2, at + i * 0.12 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + i * 0.12 + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at + i * 0.12);
    osc.stop(at + i * 0.12 + 0.3);
  }
}
