/**
 * @file vitest.config.ts
 * @module @callydus/email-wallet-react
 *
 * Vitest configuration for the react package.
 *
 * Uses `jsdom` environment for React Testing Library compatibility.
 * See packages/core/vitest.config.ts for the explanation of `server.deps.inline`.
 */

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'jsdom',
    include: ['src/__tests__/**/*.test.ts', 'src/__tests__/**/*.test.tsx'],
    server: {
      deps: {
        inline: ['@solana/web3.js', 'rpc-websockets', 'uuid'],
      },
    },
  },
});
