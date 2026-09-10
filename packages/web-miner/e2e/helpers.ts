// Shared by the specs: the run record, page URLs, the virtual authenticator, the key screen.
import { readFileSync } from 'node:fs';
import { type CDPSession, expect, type Page } from '@playwright/test';
import { type E2eRun, RUN_FILE } from './run.ts';

/** The page's E2E hooks (main.tsx); only what the specs use. */
declare global {
  interface Window {
    yacana?: {
      crashProver(): void;
      log(): string[];
      proverless: boolean;
      tamperNextClaim(): void;
      session: { publicBalance(owner: string): Promise<bigint> };
      controller():
        | {
            lastClaim?: {
              txHash: string;
              nullifiers: string[];
              noteHashes: string[];
              ticketNullifier: string;
              prover?: string;
            };
          }
        | undefined;
    };
  }
}

export const run = (): E2eRun => JSON.parse(readFileSync(RUN_FILE, 'utf8')) as E2eRun;
/**
 * The page for this run. Presto is switched off unless a spec asks for it (`presto: 'on'` uses the
 * lane's port the build carries; a port number points elsewhere): the browser-prover regressions stay
 * on WASM while a headless Presto serves the run.
 */
export const pageUrl = (r: E2eRun, extra: Record<string, string> = {}) => {
  const q: Record<string, string> = {
    node: r.nodeUrl,
    miner: r.miner,
    token: r.token,
    presto: 'off',
    ...extra,
  };
  if (q.presto === 'on') delete q.presto;
  return `${r.baseURL}/?${new URLSearchParams(q)}`;
};

export const BOOT_MS = 8 * 60_000; // CRS verification, wallet + PXE boot, bb.js init

/** A CTAP2.1 platform authenticator with PRF that confirms every touch by itself. */
export async function virtualAuthenticator(
  page: Page,
): Promise<{ cdp: CDPSession; id: string; remove: () => Promise<void> }> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable', { enableUI: false });
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      ctap2Version: 'ctap2_1',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      hasPrf: true,
      automaticPresenceSimulation: true,
    },
  });
  return {
    cdp,
    id: authenticatorId,
    remove: async () => {
      await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
    },
  };
}

/** Through the key screen: create a passkey key on a first visit, open the known one on a later one. */
export async function passKeyScreen(page: Page): Promise<void> {
  // The dialog opens by itself over the signed-out cockpit; a dismissed one reopens from the cockpit.
  await expect(page.getByTestId('cockpit')).toBeVisible({ timeout: BOOT_MS });
  const screen = page.getByTestId('key-screen');
  if (!(await screen.isVisible())) await page.getByTestId('sign-in-mine').click();
  await expect(screen).toBeVisible({ timeout: 10_000 });
  const create = page.getByTestId('create-passkey');
  if (await create.isVisible()) {
    await page.getByTestId('consent').check();
    await create.click();
  } else {
    await page.getByTestId('open-key').first().click();
  }
}

export async function bootPage(
  page: Page,
  url: string,
): Promise<Awaited<ReturnType<typeof virtualAuthenticator>>> {
  page.on('pageerror', (e) => console.log(`[page error] ${e.message}`));
  const auth = await virtualAuthenticator(page);
  await page.goto(url);
  await passKeyScreen(page);
  await expect(page.getByTestId('account')).toBeVisible({ timeout: BOOT_MS });
  return auth;
}
