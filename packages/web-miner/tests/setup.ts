import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// The explorer base is a build-time define; the specs get the testnet one so links render.
vi.stubEnv('VITE_EXPLORER_URL', 'https://testnet.aztecscan.xyz');
