/**
 * @file adapter.ts
 * @module @callydus/email-wallet-adapter-privy
 *
 * Stub implementation of `EmailWalletAdapter` for Privy.
 *
 * ## Status: NOT IMPLEMENTED
 *
 * This file is a placeholder. Every method throws `NotImplementedError`.
 * This allows the package to exist in the monorepo and be imported, but
 * attempting to use it at runtime will produce a clear error pointing to
 * the contributing guide.
 *
 * ## How to implement this adapter
 *
 * See `CONTRIBUTING.md` at the repo root for a step-by-step guide.
 * In summary:
 *
 * 1. Install the Privy SDK: `pnpm add @privy-io/react-auth` (or the headless variant)
 * 2. Add Privy to the dependencies in `packages/adapter-privy/package.json`
 * 3. Create a `config.ts` with a Zod schema for `PrivyAdapterConfig`
 * 4. Replace the stub methods below with real Privy SDK calls
 *
 * ## Privy OTP email auth (reference)
 *
 * As of 2026, Privy's headless SDK supports email OTP authentication via:
 * ```ts
 * await privy.sendCode({ type: 'email', value: email });
 * await privy.loginWithCode({ type: 'email', value: email, code: otp });
 * ```
 *
 * For Solana wallet signing, Privy's embedded wallet uses Ed25519.
 * Consult the Privy documentation for the exact signing API.
 *
 * ## Do not delete this file
 *
 * Even as a stub, this file serves as documentation of the expected adapter
 * contract. Users who import this package get a clear `NotImplementedError`
 * with an actionable message rather than a confusing module-not-found error.
 */

import { NotImplementedError } from '@callydus/email-wallet-core';
import type { EmailWalletAdapter, WalletAccount } from '@callydus/email-wallet-core';
import type { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

/**
 * Stub implementation of `EmailWalletAdapter` for the Privy provider.
 *
 * **Not yet implemented.** Every method throws `NotImplementedError`.
 *
 * To implement this adapter, see `CONTRIBUTING.md` at the repo root.
 * Privy documentation: https://docs.privy.io
 *
 * @example
 * ```ts
 * // This will compile but throw at runtime:
 * const adapter = new PrivyAdapter({ appId: 'clxxxxx' });
 * await adapter.requestOtp('user@example.com');
 * // Throws: NotImplementedError: PrivyAdapter.requestOtp is not yet implemented.
 * //         See CONTRIBUTING.md for instructions on implementing a new adapter.
 * ```
 */
export class PrivyAdapter implements EmailWalletAdapter {
  /**
   * @throws {NotImplementedError} Always — Privy adapter is not yet implemented.
   */
  async requestOtp(_email: string): Promise<void> {
    throw new NotImplementedError('PrivyAdapter.requestOtp');
  }

  /**
   * @throws {NotImplementedError} Always — Privy adapter is not yet implemented.
   */
  async signIn(_email: string, _otp: string): Promise<WalletAccount> {
    throw new NotImplementedError('PrivyAdapter.signIn');
  }

  /**
   * @throws {NotImplementedError} Always — Privy adapter is not yet implemented.
   */
  async signOut(): Promise<void> {
    throw new NotImplementedError('PrivyAdapter.signOut');
  }

  /**
   * @throws {NotImplementedError} Always — Privy adapter is not yet implemented.
   */
  async signTransaction<T extends Transaction | VersionedTransaction>(_tx: T): Promise<T> {
    throw new NotImplementedError('PrivyAdapter.signTransaction');
  }

  /**
   * @throws {NotImplementedError} Always — Privy adapter is not yet implemented.
   */
  async signAllTransactions<T extends Transaction | VersionedTransaction>(_txs: T[]): Promise<T[]> {
    throw new NotImplementedError('PrivyAdapter.signAllTransactions');
  }

  /**
   * @throws {NotImplementedError} Always — Privy adapter is not yet implemented.
   */
  async exportPrivateKey(): Promise<string> {
    throw new NotImplementedError('PrivyAdapter.exportPrivateKey');
  }

  /**
   * @throws {NotImplementedError} Always — Privy adapter is not yet implemented.
   */
  async getAddress(): Promise<PublicKey> {
    throw new NotImplementedError('PrivyAdapter.getAddress');
  }

  /**
   * Returns `false` without throwing — consistent with the `isAuthenticated`
   * contract of never throwing.
   *
   * When this adapter is properly implemented, replace this with a real
   * Privy session check.
   */
  async isAuthenticated(): Promise<boolean> {
    return false;
  }
}
