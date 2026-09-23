import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// RTL only auto-cleans with vitest globals on; unmount between tests so queries stay unique.
afterEach(cleanup);

// jsdom has no ResizeObserver; radix's popper (tooltips, popovers) measures with it. A no-op keeps
// the geometry out of the specs, which assert content and state, never placement.
if (typeof globalThis.ResizeObserver === 'undefined')
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
