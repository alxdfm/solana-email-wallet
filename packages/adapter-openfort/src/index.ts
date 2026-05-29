/**
 * @file index.ts
 * @module @callydus/email-wallet-adapter-openfort
 *
 * Public API of `@callydus/email-wallet-adapter-openfort`.
 *
 * This file is the single entry point for consumers.
 *
 * ## What to import from this package
 *
 * - **Adapter class**: `OpenfortAdapter` — the main class
 * - **Config type**: `OpenfortAdapterConfig` — for typed configuration
 * - **Config schema**: `openfortAdapterConfigSchema` — for runtime validation
 *
 * @example
 * ```ts
 * import { OpenfortAdapter } from '@callydus/email-wallet-adapter-openfort';
 * import { createEmailWalletClient } from '@callydus/email-wallet-core';
 *
 * const adapter = new OpenfortAdapter({
 *   publishableKey: process.env.OPENFORT_PUBLISHABLE_KEY!,
 *   shieldPublishableKey: process.env.OPENFORT_SHIELD_KEY!,
 * });
 *
 * const client = createEmailWalletClient({ adapter, network: 'devnet' });
 * ```
 */

// ─── Adapter ──────────────────────────────────────────────────────────────────
export { OpenfortAdapter } from './adapter.js';

// ─── Config ───────────────────────────────────────────────────────────────────
export type { OpenfortAdapterConfig } from './config.js';
export { openfortAdapterConfigSchema } from './config.js';
