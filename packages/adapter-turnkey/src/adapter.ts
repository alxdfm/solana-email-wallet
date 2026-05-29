/**
 * @file adapter.ts
 * @module @callydus/email-wallet-adapter-turnkey
 *
 * Stub implementation of `EmailWalletAdapter` for Turnkey.
 *
 * ## Status: NOT IMPLEMENTED
 *
 * This file is a placeholder. Every method throws `NotImplementedError`.
 *
 * ## How to implement this adapter
 *
 * See `CONTRIBUTING.md` at the repo root for a step-by-step guide.
 * In summary:
 *
 * 1. Install Turnkey SDK: `pnpm add @turnkey/sdk-browser` (or `@turnkey/http`)
 * 2. Add Turnkey to the dependencies in `packages/adapter-turnkey/package.json`
 * 3. Create a `config.ts` with a Zod schema for `TurnkeyAdapterConfig`
 * 4. Replace the stub methods below with real Turnkey API calls
 *
 * ## Turnkey concepts (reference)
 *
 * - **Organization**: Your Turnkey account container
 * - **Sub-organization**: Created per user, stores their wallet
 * - **Wallet**: A Turnkey managed keypair (Ed25519 for Solana)
 * - **Auth bundle**: Used for email OTP auth via Turnkey's OTP flow
 *
 * Turnkey uses a different auth model than Openfort/Privy. Instead of OTP
 * codes entered by the user, Turnkey uses "auth bundles" delivered via email
 * and a client-side `iframeStamper` for cryptographic authentication.
 *
 * Reference: https://docs.turnkey.com/authentication/email
 */

import { NotImplementedError } from '@callydus/email-wallet-core';
import type { EmailWalletAdapter, WalletAccount } from '@callydus/email-wallet-core';
import type { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

/**
 * Stub implementation of `EmailWalletAdapter` for the Turnkey provider.
 *
 * **Not yet implemented.** Every method throws `NotImplementedError`.
 *
 * To implement this adapter, see `CONTRIBUTING.md` at the repo root.
 * Turnkey documentation: https://docs.turnkey.com
 *
 * @example
 * ```ts
 * // This will compile but throw at runtime:
 * const adapter = new TurnkeyAdapter({ organizationId: 'org_...' });
 * await adapter.requestOtp('user@example.com');
 * // Throws: NotImplementedError: TurnkeyAdapter.requestOtp is not yet implemented.
 * ```
 */
export class TurnkeyAdapter implements EmailWalletAdapter {
  /**
   * @throws {NotImplementedError} Always — Turnkey adapter is not yet implemented.
   */
  async requestOtp(_email: string): Promise<void> {
    throw new NotImplementedError('TurnkeyAdapter.requestOtp');
  }

  /**
   * @throws {NotImplementedError} Always — Turnkey adapter is not yet implemented.
   */
  async signIn(_email: string, _otp: string): Promise<WalletAccount> {
    throw new NotImplementedError('TurnkeyAdapter.signIn');
  }

  /**
   * @throws {NotImplementedError} Always — Turnkey adapter is not yet implemented.
   */
  async signOut(): Promise<void> {
    throw new NotImplementedError('TurnkeyAdapter.signOut');
  }

  /**
   * @throws {NotImplementedError} Always — Turnkey adapter is not yet implemented.
   */
  async signTransaction<T extends Transaction | VersionedTransaction>(_tx: T): Promise<T> {
    throw new NotImplementedError('TurnkeyAdapter.signTransaction');
  }

  /**
   * @throws {NotImplementedError} Always — Turnkey adapter is not yet implemented.
   */
  async signAllTransactions<T extends Transaction | VersionedTransaction>(_txs: T[]): Promise<T[]> {
    throw new NotImplementedError('TurnkeyAdapter.signAllTransactions');
  }

  /**
   * @throws {NotImplementedError} Always — Turnkey adapter is not yet implemented.
   */
  async exportPrivateKey(): Promise<string> {
    throw new NotImplementedError('TurnkeyAdapter.exportPrivateKey');
  }

  /**
   * @throws {NotImplementedError} Always — Turnkey adapter is not yet implemented.
   */
  async getAddress(): Promise<PublicKey> {
    throw new NotImplementedError('TurnkeyAdapter.getAddress');
  }

  /**
   * Returns `false` without throwing — consistent with the `isAuthenticated`
   * contract of never throwing.
   */
  async isAuthenticated(): Promise<boolean> {
    return false;
  }
}
