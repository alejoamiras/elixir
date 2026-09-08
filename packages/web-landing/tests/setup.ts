import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// The build defines these from packages/site; the component tests run without that config.
const record = {
  chainId: '31337',
  rollupVersion: '1',
  miner: '0x0000000000000000000000000000000000000000000000000000000000000001',
  token: '0x0000000000000000000000000000000000000000000000000000000000000002',
  minerClassId: '0x03',
  tokenClassId: '0x04',
  launchedAt: '1788600000',
};
vi.stubEnv('VITE_SITE_MODE', 'e2e');
vi.stubEnv('VITE_AZTEC_NODE_URL', 'http://localhost:8080');
vi.stubEnv('VITE_CHAIN_ID', record.chainId);
vi.stubEnv('VITE_ROLLUP_VERSION', record.rollupVersion);
vi.stubEnv('VITE_YACANA_MINER', record.miner);
vi.stubEnv('VITE_YACANA_TOKEN', record.token);
vi.stubEnv('VITE_YACANA_MINER_CLASS', record.minerClassId);
vi.stubEnv('VITE_YACANA_TOKEN_CLASS', record.tokenClassId);
vi.stubEnv('VITE_SOURCE_COMMIT', 'abcdef0123456789');
vi.stubEnv('VITE_DEPLOYMENT_RECORD', JSON.stringify(record));
vi.stubEnv('VITE_LAUNCH_MODE', '');
vi.stubEnv('VITE_EXPLORER_URL', 'https://testnet.aztecscan.xyz');
vi.stubEnv('VITE_EXAMPLE_CLAIM', '');
