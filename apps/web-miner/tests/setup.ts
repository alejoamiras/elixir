import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// The explorer base is a build-time define; the specs get the testnet one so links render.
vi.stubEnv('VITE_EXPLORER_URL', 'https://testnet.aztecscan.xyz');

// jsdom has no ResizeObserver; radix's popper (tooltips, popovers) measures with it. A no-op keeps
// the geometry out of the specs, which assert content and state, never placement.
if (typeof globalThis.ResizeObserver === 'undefined')
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
