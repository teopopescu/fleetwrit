/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Fleetwrit server. When set, the dashboard runs in live mode. */
  readonly VITE_FLEETWRIT_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
