/**
 * @file types.ts
 * @module @callydus/email-wallet-react
 *
 * Local types for the `@callydus/email-wallet-react` package.
 *
 * These types are local to the react package — they are not part of the
 * core package because they depend on React-specific concepts.
 */

import type { EmailWalletAdapter, WalletAccount } from '@callydus/email-wallet-core';

/**
 * The return type of the `useEmailWallet()` hook.
 *
 * This interface documents every value returned by the hook, providing
 * full type safety and IntelliSense for consumers.
 *
 * All async operations (except `signTransaction`, `signAllTransactions`,
 * `exportPrivateKey`) store their results in state and never throw.
 * The signing operations propagate errors directly since they are typically
 * triggered by specific user actions with local error handling.
 */
export interface UseEmailWalletReturn {
  /**
   * Step 1 of the OTP flow.
   *
   * Sends a one-time passcode to the user's email. On failure, `error` is set.
   * On success, advance the UI to the OTP input form.
   *
   * @param email - The user's email address.
   */
  requestOtp: (email: string) => Promise<void>;

  /**
   * Step 2 of the OTP flow.
   *
   * Verifies the OTP and authenticates the wallet. On success, `wallet` is set
   * and `isAuthenticated` becomes `true`. On failure, `error` is set.
   *
   * @param email - The same email used in `requestOtp`.
   * @param otp   - The one-time passcode from the user's inbox.
   */
  signIn: (email: string, otp: string) => Promise<void>;

  /**
   * Signs out the current user.
   *
   * Clears the wallet state. On success, `wallet` becomes `null` and
   * `isAuthenticated` becomes `false`. On failure, `error` is set.
   */
  signOut: () => Promise<void>;

  /**
   * The currently authenticated wallet, or `null` if not signed in.
   *
   * Set after a successful `signIn()` call. Contains `address` (Solana
   * `PublicKey`) and `email` (string).
   */
  wallet: WalletAccount | null;

  /**
   * Whether the user is currently signed in with a ready wallet.
   *
   * Equivalent to `wallet !== null`. Provided for convenience to avoid
   * the `wallet !== null` check in JSX.
   */
  isAuthenticated: boolean;

  /**
   * Whether an async operation is currently in progress.
   *
   * `true` during `requestOtp()`, `signIn()`, and `signOut()` calls.
   * Use to disable form inputs and show loading spinners.
   */
  isLoading: boolean;

  /**
   * The last error from a wallet operation, or `null` if no error.
   *
   * Cleared at the start of each new operation. The error is a typed
   * `EmailWalletError` from `@callydus/email-wallet-core` — use
   * `instanceof` to handle specific error types.
   */
  error: Error | null;

  /**
   * Signs a single Solana transaction.
   *
   * Errors propagate directly (not stored in `error` state). Handle them
   * locally in the component or feature that initiates the signing.
   *
   * @param tx - The transaction to sign (must have `recentBlockhash` set).
   * @returns The signed transaction.
   */
  signTransaction: EmailWalletAdapter['signTransaction'];

  /**
   * Signs multiple Solana transactions in a batch.
   *
   * @param txs - The transactions to sign.
   * @returns All transactions with signatures.
   */
  signAllTransactions: EmailWalletAdapter['signAllTransactions'];

  /**
   * Exports the raw private key.
   *
   * **SECURITY WARNING**: Only call after explicit user confirmation.
   *
   * @returns Base58-encoded private key.
   */
  exportPrivateKey: () => Promise<string>;
}
