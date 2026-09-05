import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// RTL only auto-cleans with vitest globals on; unmount between tests so queries stay unique.
afterEach(cleanup);
