/**
 * @file vitest.config.ts
 * @module @callydus/email-wallet-core
 *
 * Vitest configuration for the core package.
 *
 * ## Why the special configuration?
 *
 * `@solana/web3.js` has a transitive dependency on `rpc-websockets` (CJS)
 * which tries to `require()` `uuid@14` (ESM-only). This causes a runtime
 * error in Node.js ESM mode.
 *
 * Solution: use `resolve.alias` to redirect `uuid` to a CJS-compatible build,
 * and mark the problematic packages as `external: false` (inline) so Vite
 * can transform them.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      // Redirect uuid to its browser-compatible ESM build to avoid the
      // CJS→ESM require() error from rpc-websockets
      uuid: 'uuid',
    },
  },
  ssr: {
    noExternal: ['@solana/web3.js', 'rpc-websockets', 'uuid'],
  },
});
