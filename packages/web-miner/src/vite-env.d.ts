/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AZTEC_NODE_URL?: string;
  readonly VITE_AZTEC_CROSS_CHECK_URL?: string;
  readonly VITE_YACANA_MINER?: string;
  readonly VITE_YACANA_TOKEN?: string;
  readonly VITE_ALLOWED_NODE_ORIGINS?: string;
}
