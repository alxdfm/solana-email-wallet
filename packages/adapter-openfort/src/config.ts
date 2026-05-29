/**
 * @file config.ts
 * @module @callydus/email-wallet-adapter-openfort
 *
 * Configuration schema and type for the Openfort adapter.
 *
 * ## What is Openfort?
 *
 * Openfort is a custodial embedded-wallet provider that allows users to create
 * Solana wallets authenticated via email OTP instead of managing seed phrases.
 * The private key lives in Openfort's secure infrastructure — the user
 * authenticates with email and OTP and never sees the key directly.
 *
 * ## Keys
 *
 * Openfort uses two keys:
 *
 * 1. **publishableKey** (`pk_...`) — Safe to include in client-side code (browser, app).
 *    Used to initialize the Openfort SDK and make API calls.
 *
 * 2. **shieldPublishableKey** (`shpk_...`) — Also client-safe. Used by Openfort Shield,
 *    the service that manages automatic key recovery. Required to create wallets with
 *    `RecoveryMethod.AUTOMATIC`.
 *
 * Neither key is secret — they identify your Openfort project but do not grant admin access.
 * Store them in environment variables as a best practice, but they can be in client bundles.
 *
 * ## Zod as single source of truth
 *
 * The schema validates the config at runtime (construction time) and also defines the
 * TypeScript type. Never create a separate interface that mirrors this schema — they
 * will diverge over time.
 */

import { z } from 'zod';

/**
 * Zod schema for validating `OpenfortAdapterConfig`.
 *
 * Validates:
 * - `publishableKey`: must start with `pk_` — identifies your Openfort project
 * - `shieldPublishableKey`: must start with `shpk_` — required for automatic recovery
 *
 * Both keys are validated with prefix checks to catch misconfiguration early
 * (e.g., accidentally swapping keys or using a secret key instead of publishable).
 *
 * @example
 * ```ts
 * const config = openfortAdapterConfigSchema.parse({
 *   publishableKey: process.env.OPENFORT_PUBLISHABLE_KEY,
 *   shieldPublishableKey: process.env.OPENFORT_SHIELD_KEY,
 * });
 * ```
 */
export const openfortAdapterConfigSchema = z.object({
  /**
   * Your Openfort project's publishable key.
   *
   * Format: `pk_test_...` (test environment) or `pk_live_...` (production).
   * Found in your Openfort dashboard under Settings > API Keys.
   *
   * This key is safe to include in client-side code. It identifies your project
   * but does not grant administrative access to your Openfort account.
   */
  publishableKey: z
    .string()
    .min(1, 'publishableKey is required')
    .startsWith('pk_', 'publishableKey must start with "pk_"'),

  /**
   * Your Openfort Shield publishable key.
   *
   * Format: `shpk_...`
   * Found in your Openfort dashboard under Shield > Configuration.
   *
   * Openfort Shield is the recovery infrastructure that allows wallets to be
   * recovered automatically across sessions without the user storing a seed phrase.
   * This key is required to use `RecoveryMethod.AUTOMATIC`.
   */
  shieldPublishableKey: z
    .string()
    .min(1, 'shieldPublishableKey is required')
    .startsWith('shpk_', 'shieldPublishableKey must start with "shpk_"'),
});

/**
 * Configuration for `OpenfortAdapter`.
 *
 * Derived from the Zod schema to guarantee type/runtime consistency.
 *
 * @example
 * ```ts
 * const adapter = new OpenfortAdapter({
 *   publishableKey: process.env.OPENFORT_PUBLISHABLE_KEY!,
 *   shieldPublishableKey: process.env.OPENFORT_SHIELD_KEY!,
 * });
 * ```
 */
export type OpenfortAdapterConfig = z.infer<typeof openfortAdapterConfigSchema>;
