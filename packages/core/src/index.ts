/**
 * @file index.ts
 * @module @callydus/email-wallet-core
 *
 * Public API of `@callydus/email-wallet-core`.
 *
 * This file is the single entry point for consumers. Everything exported here
 * is stable and part of the public contract. Anything not exported here is
 * considered internal and may change without notice.
 *
 * ## What to import from this package
 *
 * - **Types**: `Result`, `Network`, `WalletAccount`, `EmailWalletAdapter`,
 *   `EmailWalletClientConfig`
 * - **Client**: `EmailWalletClient`, `createEmailWalletClient`
 * - **Errors**: All typed error classes for `instanceof` checks
 * - **Schemas**: `emailWalletClientConfigSchema` for advanced validation
 *
 * @example
 * ```ts
 * import {
 *   createEmailWalletClient,
 *   type EmailWalletAdapter,
 *   type WalletAccount,
 *   type Result,
 *   AuthenticationError,
 *   WalletNotFoundError,
 * } from '@callydus/email-wallet-core';
 * ```
 */

// ─── Client ───────────────────────────────────────────────────────────────────
export { EmailWalletClient, createEmailWalletClient } from './client.js';

// ─── Types ────────────────────────────────────────────────────────────────────
export type {
  Result,
  Network,
  WalletAccount,
  EmailWalletAdapter,
  EmailWalletClientConfig,
} from './types.js';

// ─── Schemas ──────────────────────────────────────────────────────────────────
export { emailWalletClientConfigSchema } from './types.js';

// ─── Errors ───────────────────────────────────────────────────────────────────
export {
  EmailWalletError,
  AuthenticationError,
  WalletNotFoundError,
  SigningError,
  ConfigurationError,
  NotImplementedError,
} from './errors.js';
