// The specs' `test`: Playwright's, with the page metered — the prover's proof events and every
// `aztec_sendTx` — and the meter attached to the result and held to the inventory on a pass.
// E2E_DELAY_SENDTX_MS holds every submission that long first: proving must not move with it.
import { test as base, type ConsoleMessage, type Page, type Request } from '@playwright/test';
import { type ProofMeter, proofShortfall } from './proof-inventory.ts';

const PROOF_EVENT = 'client-ivc-proof-generation';

/**
 * The page's pino logs `console.info(bindings, data, message)`: the event's fields are in the data
 * object, so every object argument is read until one names the event.
 */
async function proofDuration(msg: ConsoleMessage): Promise<number | null> {
  if (msg.type() !== 'info') return null;
  for (const arg of msg.args()) {
    let value: unknown;
    try {
      value = await arg.jsonValue();
    } catch {
      return null; // the page went away under the handle
    }
    if (typeof value !== 'object' || value === null) continue;
    const { eventName, duration } = value as { eventName?: unknown; duration?: unknown };
    if (eventName !== PROOF_EVENT) continue;
    return typeof duration === 'number' ? duration : Number.NaN;
  }
  return null;
}

const isSendTx = (req: Request) => req.method() === 'POST' && (req.postData() ?? '').includes('aztec_sendTx');

function meterPage(page: Page, meter: ProofMeter): { settled: () => Promise<unknown> } {
  const pending: Promise<void>[] = [];
  page.on('console', (msg) => {
    pending.push(
      proofDuration(msg).then((durationMs) => {
        if (durationMs !== null) meter.proofs.push({ durationMs, at: Date.now() });
      }),
    );
  });
  const open = new Map<Request, number>();
  page.on('request', (req) => {
    if (isSendTx(req)) open.set(req, Date.now());
  });
  const done = (req: Request) => {
    const startedAt = open.get(req);
    if (startedAt === undefined) return;
    open.delete(req);
    meter.sends.push({ startedAt, endedAt: Date.now() });
  };
  page.on('requestfinished', done);
  page.on('requestfailed', done);
  return { settled: () => Promise.allSettled(pending) };
}

export const test = base.extend<{ proofMeter: ProofMeter }>({
  proofMeter: [
    async ({ page }, use, testInfo) => {
      const meter: ProofMeter = { proofs: [], sends: [] };
      const { settled } = meterPage(page, meter);
      const delayMs = Number(process.env.E2E_DELAY_SENDTX_MS ?? 0);
      if (delayMs > 0) {
        // The node and the proxies answer on 127.0.0.1; the page itself is served from localhost.
        await page.route(
          (url) => url.hostname === '127.0.0.1',
          async (route) => {
            if (isSendTx(route.request())) await new Promise((r) => setTimeout(r, delayMs));
            await route.fallback();
          },
        );
      }
      await use(meter);
      await settled();
      await testInfo.attach('proofs.json', { body: JSON.stringify(meter), contentType: 'application/json' });
      // A failed or skipped test reports its own reason; the inventory judges the ones that passed.
      if (testInfo.status !== 'passed') return;
      const shortfall = proofShortfall(testInfo.title, meter, process.env.E2E_PROVERLESS === '1');
      if (shortfall) throw new Error(shortfall);
    },
    { auto: true },
  ],
});

export { expect, type Page } from '@playwright/test';
