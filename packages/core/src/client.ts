/**
 * @file client.ts
 * @module @callydus/email-wallet-core
 *
 * The `EmailWalletClient` class — the primary entry point for consumers.
 *
 * ## Responsibilities
 *
 * - Validates configuration at construction time via Zod
 * - Exposes a `Result<T>`-based API so consumers never need try/catch
 * - Delegates all provider-specific logic to the injected `EmailWalletAdapter`
 * - Exposes `network` for consumers that need to build Solana connections
 *
 * ## Architecture: Dependency Inversion
 *
 * `EmailWalletClient` depends on the **abstraction** (`EmailWalletAdapter`)
 * rather than any concrete provider. This means:
 * - You can swap Openfort for Privy by changing the adapter — zero client changes
 * - You can inject a mock adapter in tests
 * - The client has no knowledge of Openfort, Privy, or any SDK
 *
 * ```
 * Consumer code
 *      │
 *      ▼
 * EmailWalletClient      ← generic, no provider knowledge
 *      │
 *      ▼
 * EmailWalletAdapter     ← interface (contract)
 *      │
 *      ├── OpenfortAdapter  ← uses @openfort/openfort-js
 *      ├── PrivyAdapter     ← stub (not yet implemented)
 *      └── TurnkeyAdapter   ← stub (not yet implemented)
 * ```
 */

import type { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { ConfigurationError } from './errors.js';
import {
  type EmailWalletAdapter,
  type EmailWalletClientConfig,
  type Network,
  type Result,
  type WalletAccount,
  emailWalletClientConfigSchema,
} from './types.js';

/**
 * The primary consumer-facing class for email-based Solana wallet operations.
 *
 * Use `createEmailWalletClient()` to construct an instance — prefer the
 * factory function over `new EmailWalletClient()` for a cleaner API.
 *
 * ## Result<T> contract
 *
 * Every method (except `isAuthenticated`) returns `Promise<Result<T>>`.
 * On success: `{ success: true, data: T }`
 * On failure: `{ success: false, error: Error }`
 *
 * The client catches all errors thrown by the adapter and wraps them.
 * Consumer code never needs try/catch in business logic.
 *
 * @example
 * ```ts
 * import { createEmailWalletClient } from '@callydus/email-wallet-core';
 * import { OpenfortAdapter } from '@callydus/email-wallet-adapter-openfort';
 *
 * const client = createEmailWalletClient({
 *   adapter: new OpenfortAdapter({ publishableKey: 'pk_...' }),
 *   network: 'devnet',
 * });
 *
 * // Step 1: request OTP
 * const step1 = await client.requestOtp('user@example.com');
 * if (!step1.success) {
 *   showError(step1.error.message);
 *   return;
 * }
 *
 * // Step 2: sign in with OTP
 * const step2 = await client.signIn('user@example.com', '123456');
 * if (step2.success) {
 *   console.log(step2.data.address.toBase58());
 * }
 * ```
 */
export class EmailWalletClient {
  /**
   * The Solana network this client is configured for.
   *
   * Exposed as a `readonly` property so consumers can read it without
   * having to store the network separately. Useful when building
   * `Connection` objects or displaying network status in UI.
   *
   * @example
   * ```ts
   * const connection = new Connection(clusterApiUrl(client.network));
   * ```
   */
  readonly network: Network;

  /**
   * The injected adapter instance.
   *
   * Kept private to enforce that all adapter calls go through the
   * `Result<T>`-wrapping methods defined on this class.
   * Direct adapter access would bypass error handling.
   */
  private readonly adapter: EmailWalletAdapter;

  /**
   * Creates a new `EmailWalletClient`.
   *
   * Validates the configuration at construction time using Zod. If the
   * configuration is invalid, throws `ConfigurationError` immediately rather
   * than producing mysterious errors on the first method call.
   *
   * Prefer the `createEmailWalletClient()` factory function for cleaner syntax.
   *
   * @param config - The client configuration (adapter + network).
   * @throws {ConfigurationError} If the configuration fails Zod validation.
   */
  constructor(config: EmailWalletClientConfig) {
    const parsed = emailWalletClientConfigSchema.safeParse(config);
    if (!parsed.success) {
      throw new ConfigurationError(
        `Invalid EmailWalletClient configuration: ${parsed.error.message}`,
        parsed.error,
      );
    }
    this.adapter = parsed.data.adapter;
    this.network = parsed.data.network;
  }

  // ─── OTP Flow ─────────────────────────────────────────────────────────────

  /**
   * Step 1 of the OTP authentication flow.
   *
   * Asks the provider to send a one-time passcode to the user's email.
   * On success, the caller should show an OTP input form and then call
   * `signIn(email, otp)` with the code the user receives.
   *
   * @param email - The email address to send the OTP to.
   * @returns `Result<void>` — success means the email was sent; failure
   *          means the provider could not send it (network error, invalid email, etc.)
   *
   * @example
   * ```ts
   * const result = await client.requestOtp('user@example.com');
   * if (!result.success) {
   *   setError(result.error.message); // 'Could not send OTP...'
   *   return;
   * }
   * setStep('enter-otp'); // advance to step 2
   * ```
   */
  async requestOtp(email: string): Promise<Result<void>> {
    try {
      await this.adapter.requestOtp(email);
      return { success: true, data: undefined };
    } catch (err) {
      return { success: false, error: toError(err) };
    }
  }

  /**
   * Step 2 of the OTP authentication flow.
   *
   * Verifies the one-time passcode. On success, the adapter has authenticated
   * the user and created (or recovered) the embedded Solana wallet.
   *
   * @param email - The same email used in `requestOtp`.
   * @param otp   - The one-time passcode from the user's inbox.
   * @returns `Result<WalletAccount>` with the wallet's public key and email.
   *
   * @example
   * ```ts
   * const result = await client.signIn(email, otpInput);
   * if (!result.success) {
   *   setError('Invalid or expired code. Try again.');
   *   return;
   * }
   * setWallet(result.data); // { address: PublicKey, email: string }
   * ```
   */
  async signIn(email: string, otp: string): Promise<Result<WalletAccount>> {
    try {
      const account = await this.adapter.signIn(email, otp);
      return { success: true, data: account };
    } catch (err) {
      return { success: false, error: toError(err) };
    }
  }

  // ─── Session ──────────────────────────────────────────────────────────────

  /**
   * Signs out the current user and invalidates the session.
   *
   * After this call succeeds, `isAuthenticated()` returns `false` and all
   * wallet operations will fail until the user authenticates again.
   *
   * @returns `Result<void>` — success means the session was cleared.
   *
   * @example
   * ```ts
   * const result = await client.signOut();
   * if (result.success) {
   *   redirectToHome();
   * }
   * ```
   */
  async signOut(): Promise<Result<void>> {
    try {
      await this.adapter.signOut();
      return { success: true, data: undefined };
    } catch (err) {
      return { success: false, error: toError(err) };
    }
  }

  /**
   * Checks whether the current session has a ready, authenticated wallet.
   *
   * Unlike other methods, this returns a plain `boolean` — not `Result<boolean>`.
   * It is designed to be used in conditional checks without error-handling
   * boilerplate. It never throws.
   *
   * @returns `true` if authenticated and wallet is ready; `false` otherwise.
   *
   * @example
   * ```ts
   * if (await client.isAuthenticated()) {
   *   const addr = await client.getAddress();
   * } else {
   *   showSignInModal();
   * }
   * ```
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      return await this.adapter.isAuthenticated();
    } catch {
      return false;
    }
  }

  // ─── Wallet info ─────────────────────────────────────────────────────────

  /**
   * Returns the Solana public key of the currently authenticated wallet.
   *
   * @returns `Result<PublicKey>` with the wallet's 32-byte public key.
   *
   * @example
   * ```ts
   * const result = await client.getAddress();
   * if (result.success) {
   *   const base58Address = result.data.toBase58();
   * }
   * ```
   */
  async getAddress(): Promise<Result<PublicKey>> {
    try {
      const address = await this.adapter.getAddress();
      return { success: true, data: address };
    } catch (err) {
      return { success: false, error: toError(err) };
    }
  }

  // ─── Transaction signing ──────────────────────────────────────────────────

  /**
   * Signs a single Solana transaction with the embedded wallet.
   *
   * The transaction type is preserved — `Transaction` in, `Transaction` out;
   * `VersionedTransaction` in, `VersionedTransaction` out.
   *
   * The transaction must have its `recentBlockhash` set before calling this.
   *
   * @param tx - The unsigned (or partially-signed) transaction.
   * @returns `Result<T>` with the same transaction, now signed.
   *
   * @example
   * ```ts
   * const result = await client.signTransaction(transaction);
   * if (result.success) {
   *   const txId = await connection.sendRawTransaction(result.data.serialize());
   * }
   * ```
   */
  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<Result<T>> {
    try {
      const signed = await this.adapter.signTransaction(tx);
      return { success: true, data: signed };
    } catch (err) {
      return { success: false, error: toError(err) };
    }
  }

  /**
   * Signs multiple Solana transactions in a single batch.
   *
   * All transactions must have their `recentBlockhash` set.
   *
   * @param txs - The transactions to sign.
   * @returns `Result<T[]>` with all transactions signed.
   *
   * @example
   * ```ts
   * const result = await client.signAllTransactions([tx1, tx2, tx3]);
   * if (result.success) {
   *   for (const tx of result.data) {
   *     await connection.sendRawTransaction(tx.serialize());
   *   }
   * }
   * ```
   */
  async signAllTransactions<T extends Transaction | VersionedTransaction>(
    txs: T[],
  ): Promise<Result<T[]>> {
    try {
      const signed = await this.adapter.signAllTransactions(txs);
      return { success: true, data: signed };
    } catch (err) {
      return { success: false, error: toError(err) };
    }
  }

  // ─── Key export ───────────────────────────────────────────────────────────

  /**
   * Exports the raw private key of the embedded wallet.
   *
   * **SECURITY WARNING**: Only call this after explicit user confirmation.
   * Once exported, the key is the user's sole responsibility — the provider
   * no longer has a copy and cannot help with recovery.
   *
   * @returns `Result<string>` with the Base58-encoded private key.
   *
   * @example
   * ```ts
   * // Always show a warning dialog before calling this
   * const result = await client.exportPrivateKey();
   * if (result.success) {
   *   showOnceDialog(result.data); // display key once, never store it
   * }
   * ```
   */
  async exportPrivateKey(): Promise<Result<string>> {
    try {
      const key = await this.adapter.exportPrivateKey();
      return { success: true, data: key };
    } catch (err) {
      return { success: false, error: toError(err) };
    }
  }
}

// ─── Factory function ─────────────────────────────────────────────────────────

/**
 * Creates and returns a new `EmailWalletClient` instance.
 *
 * This factory function is the preferred way to create a client — it reads
 * more naturally than `new EmailWalletClient(config)` and follows the
 * convention used by other Solana libraries (e.g. `createConnection()`).
 *
 * @param config - The client configuration with `adapter` and `network`.
 * @returns A configured `EmailWalletClient` ready for use.
 * @throws {ConfigurationError} If the config fails Zod validation.
 *
 * @example
 * ```ts
 * import { createEmailWalletClient } from '@callydus/email-wallet-core';
 * import { OpenfortAdapter } from '@callydus/email-wallet-adapter-openfort';
 *
 * const client = createEmailWalletClient({
 *   adapter: new OpenfortAdapter({
 *     publishableKey: process.env.OPENFORT_PUBLISHABLE_KEY,
 *     shieldPublishableKey: process.env.OPENFORT_SHIELD_KEY,
 *   }),
 *   network: 'devnet',
 * });
 * ```
 */
export function createEmailWalletClient(config: EmailWalletClientConfig): EmailWalletClient {
  return new EmailWalletClient(config);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Normalizes an unknown caught value into a proper `Error` instance.
 *
 * JavaScript allows throwing any value (`throw 'string'`, `throw 42`, etc.).
 * This helper ensures that the `Result.error` field is always an `Error`
 * object, which has a `.message` and `.stack` property.
 *
 * @param err - The caught value from a try/catch block.
 * @returns An `Error` instance. If `err` is already an `Error`, returns it as-is.
 *
 * @internal This function is not exported — it is an implementation detail
 *           of `EmailWalletClient` error handling.
 */
function toError(err: unknown): Error {
  if (err instanceof Error) {
    return err;
  }
  return new Error(String(err));
}
