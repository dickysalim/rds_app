/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  // Set only on the staging-rds-app Pages project (unreleased-feature's
  // isolated deploy target) -- its worker is staging-locked unconditionally,
  // so show the STAGING DATABASE badge for every role, not just the ones
  // that can normally flip to staging.
  readonly VITE_STAGING_LOCKED?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
