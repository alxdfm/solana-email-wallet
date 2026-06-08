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
 * Async callback that fetches a single-use `encryptionSession` token from the
 * application backend (which calls Openfort Shield server-side).
 *
 * When provided, the adapter uses `RecoveryMethod.AUTOMATIC` — wallets are
 * recoverable across browsers and devices without any seed phrase.
 *
 * When omitted, the adapter falls back to `RecoveryMethod.PASSWORD` (same-browser only).
 *
 * ## Why a callback?
 *
 * The `encryptionSession` token is single-use and must be fetched fresh each time
 * a wallet is created (first sign-in). Accepting a callback keeps the adapter
 * decoupled from the application's HTTP client and error handling.
 *
 * @returns A Promise resolving to the `encryptionSession` string.
 * @throws Any error propagates up — the adapter maps it to `WalletNotFoundError`.
 */
export type GetEncryptionSession = () => Promise<string>;

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
   * Found in your Openfort dashboard under Shield > Configuration.
   * The format varies by Openfort account — it may be a UUID or start with `shpk_`.
   *
   * Openfort Shield is the recovery infrastructure that allows wallets to be
   * recovered automatically across sessions without the user storing a seed phrase.
   * This key is required to use `RecoveryMethod.AUTOMATIC`.
   */
  shieldPublishableKey: z
    .string()
    .min(1, 'shieldPublishableKey is required'),

  /**
   * Optional async callback that returns a single-use `encryptionSession` token
   * fetched from the application backend.
   *
   * When provided: wallet creation uses `RecoveryMethod.AUTOMATIC` (cross-device recovery).
   * When omitted: falls back to `RecoveryMethod.PASSWORD` (same-browser only).
   *
   * See `GetEncryptionSession` type for the expected signature.
   */
  getEncryptionSession: z
    .custom<GetEncryptionSession>((v) => typeof v === 'function')
    .optional(),
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
