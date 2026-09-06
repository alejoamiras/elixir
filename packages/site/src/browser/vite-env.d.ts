/// <reference types="vite/client" />

// Every value is a build-time constant from packages/site (site.env + the deployment record).
interface ImportMetaEnv {
  readonly VITE_SITE_MODE: 'production' | 'e2e' | 'dev';
  readonly VITE_AZTEC_NODE_URL: string;
  readonly VITE_ALLOWED_NODE_ORIGINS: string;
  readonly VITE_RP_ID: string;
  readonly VITE_SOURCE_COMMIT: string;
  readonly VITE_BB_VERSION: string;
  readonly VITE_CHAIN_ID: string;
  readonly VITE_ROLLUP_VERSION: string;
  readonly VITE_YACANA_MINER: string;
  readonly VITE_YACANA_TOKEN: string;
  readonly VITE_YACANA_MINER_CLASS: string;
  readonly VITE_YACANA_TOKEN_CLASS: string;
  readonly VITE_E2E_QUERY_OVERRIDES: string;
  readonly VITE_LAUNCH_MODE: string;
  /** JSON of the deployment record the build was made for. */
  readonly VITE_DEPLOYMENT_RECORD: string;
}
