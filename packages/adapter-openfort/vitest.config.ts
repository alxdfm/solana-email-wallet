/**
 * @file vitest.config.ts
 * @module @callydus/email-wallet-adapter-openfort
 *
 * Vitest configuration for the adapter-openfort package.
 *
 * See packages/core/vitest.config.ts for the explanation of `server.deps.inline`.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    server: {
      deps: {
        inline: ['@solana/web3.js', 'rpc-websockets', 'uuid'],
      },
    },
  },
});
