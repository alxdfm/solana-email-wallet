/**
 * @file adapter.ts
 * @module @callydus/email-wallet-adapter-openfort
 *
 * Full implementation of `EmailWalletAdapter` using the Openfort SDK v1.x.
 *
 * ## SDK version note
 *
 * This adapter targets `@openfort/openfort-js@^1.3.4`.
 * v1.x introduced native email OTP — `requestEmailOtp` and `logInWithEmailOtp` —
 * replacing the email+password workaround used in v0.9.x.
 *
 * ## Authentication model
 *
 * Openfort v1.x delivers OTP natively: the SDK sends the code to the user's email
 * via the Openfort infrastructure. No backend endpoint is required for OTP delivery.
 *
 * Flow:
 * 1. `requestOtp(email)` → `openfort.auth.requestEmailOtp({ email })`
 *    Openfort sends a 6-digit code to the user's inbox.
 * 2. `signIn(email, otp)` → `openfort.auth.logInWithEmailOtp({ email, otp })`
 *    Openfort verifies the code and returns an authenticated session.
 *    On first sign-in, the embedded Solana wallet is created automatically.
 *
 * ## Embedded Wallet states
 *
 * `EmbeddedState` is a numeric enum:
 * - `0 = NONE`: SDK not initialized
 * - `1 = UNAUTHENTICATED`: Not signed in
 * - `2 = EMBEDDED_SIGNER_NOT_CONFIGURED`: Signed in, wallet not yet created
 * - `3 = CREATING_ACCOUNT`: Wallet creation in progress
 * - `4 = READY`: Signed in and wallet is available
 *
 * ## Transaction signing for Solana
 *
 * Solana uses Ed25519 with **raw bytes** — no keccak256 hashing.
 * Pass `hashMessage: false` to `embeddedWallet.signMessage()`.
 *
 * Flow:
 * 1. Serialize: `tx.serializeMessage()` (legacy) or `tx.message.serialize()` (versioned)
 * 2. Sign: `openfort.embeddedWallet.signMessage(bytes, { hashMessage: false })`
 * 3. Decode: `bs58.decode(signatureBase58)` → `Uint8Array`
 * 4. Attach: `tx.addSignature(publicKey, Buffer.from(signatureBytes))`
 */

import {
  AuthenticationError,
  ConfigurationError,
  SigningError,
  WalletNotFoundError,
} from '@callydus/email-wallet-core';
import type { EmailWalletAdapter, WalletAccount } from '@callydus/email-wallet-core';
import {
  AccountTypeEnum,
  ChainTypeEnum,
  EmbeddedState,
  Openfort,
  OpenfortConfiguration,
  RecoveryMethod,
  ShieldConfiguration,
} from '@openfort/openfort-js';
import { PublicKey, Transaction, type VersionedTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { type OpenfortAdapterConfig, openfortAdapterConfigSchema } from './config.js';

/**
 * Implements `EmailWalletAdapter` using the Openfort SDK v1.x.
 *
 * Provides email-based Solana wallet creation, authentication, and signing
 * via the Openfort embedded wallet infrastructure.
 *
 * ## Authentication pattern
 *
 * Openfort v1.x supports native email OTP — no backend required for delivery:
 * - `requestOtp(email)`: calls `auth.requestEmailOtp({ email })` — Openfort sends the code
 * - `signIn(email, otp)`: calls `auth.logInWithEmailOtp({ email, otp })` — Openfort verifies
 *
 * ## Usage
 *
 * ```ts
 * const adapter = new OpenfortAdapter({
 *   publishableKey: process.env.OPENFORT_PUBLISHABLE_KEY!,
 *   shieldPublishableKey: process.env.OPENFORT_SHIELD_KEY!,
 * });
 * ```
 */
export class OpenfortAdapter implements EmailWalletAdapter {
  /**
   * The Openfort SDK instance.
   *
   * Initialized once in the constructor using `OpenfortConfiguration` and
   * `ShieldConfiguration` class instances (required by SDK v0.9+).
   *
   * @internal
   */
  private readonly openfort: Openfort;

  /**
   * Creates a new `OpenfortAdapter`.
   *
   * Validates the configuration using Zod and initializes the Openfort SDK.
   * Throws `ConfigurationError` immediately on invalid config.
   *
   * @param config - Openfort publishable key and Shield publishable key.
   * @throws {ConfigurationError} If the config fails validation.
   */
  constructor(config: OpenfortAdapterConfig) {
    const parsed = openfortAdapterConfigSchema.safeParse(config);
    if (!parsed.success) {
      throw new ConfigurationError(
        `Invalid OpenfortAdapter configuration: ${parsed.error.message}`,
        parsed.error,
      );
    }

    // SDK v0.9.x requires class instances, not plain objects.
    // OpenfortConfiguration wraps the publishableKey.
    // ShieldConfiguration wraps the shieldPublishableKey.
    this.openfort = new Openfort({
      baseConfiguration: new OpenfortConfiguration({
        publishableKey: parsed.data.publishableKey,
      }),
      shieldConfiguration: new ShieldConfiguration({
        shieldPublishableKey: parsed.data.shieldPublishableKey,
      }),
    });
  }

  // ─── OTP Flow ─────────────────────────────────────────────────────────────

  /**
   * Step 1: Sends a one-time code to the user's email via Openfort.
   *
   * Calls `openfort.auth.requestEmailOtp` — Openfort delivers the 6-digit code
   * to the user's inbox. No backend endpoint required.
   *
   * @param email - The email address to send the OTP to.
   * @throws {AuthenticationError} If the email is invalid or Openfort fails to send.
   */
  async requestOtp(email: string): Promise<void> {
    try {
      await this.openfort.auth.requestEmailOtp({ email });
    } catch (err) {
      throw new AuthenticationError(
        `Failed to send OTP to ${email}: ${errorMessage(err)}`,
        err,
      );
    }
  }

  /**
   * Step 2: Verifies the OTP and creates/recovers the Solana wallet.
   *
   * ## Authentication
   *
   * Calls `openfort.auth.logInWithEmailOtp({ email, otp })`. Openfort verifies the
   * code against what was sent in `requestOtp`. On first sign-in, `logInWithEmailOtp`
   * also creates the Openfort account — no separate signup step needed.
   *
   * ## Wallet lifecycle
   *
   * After authentication:
   * - `EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED` (2): First sign-in — creates the wallet
   * - `EmbeddedState.READY` (4): Subsequent sign-in — wallet already exists
   *
   * @param email - The user's email address.
   * @param otp   - The 6-digit code received by email.
   * @returns The authenticated `WalletAccount`.
   * @throws {AuthenticationError} If the OTP is invalid or expired.
   * @throws {WalletNotFoundError} If wallet cannot be created or retrieved.
   */
  async signIn(email: string, otp: string): Promise<WalletAccount> {
    try {
      await this.openfort.auth.logInWithEmailOtp({ email, otp });
    } catch (err) {
      // "Already logged in" means a previous session is still active (e.g. wallet
      // creation failed mid-flow). The user IS authenticated — proceed to wallet check.
      if (!errorMessage(err).toLowerCase().includes('already logged in')) {
        throw new AuthenticationError(
          `OTP verification failed for ${email}: ${errorMessage(err)}`,
          err,
        );
      }
    }

    // After successful auth, check the embedded wallet state.
    try {
      const state = await this.openfort.embeddedWallet.getEmbeddedState();

      if (state === EmbeddedState.EMBEDDED_SIGNER_NOT_CONFIGURED) {
        // First sign-in: create the Solana EOA wallet.
        // EOA (Externally Owned Account) = standard keypair for Solana.
        // SVM (Solana Virtual Machine) = tells Openfort to use Ed25519.
        //
        // TODO(EW-05): RecoveryMethod.AUTOMATIC requires a backend endpoint
        // to generate an `encryptionSession` via the Openfort Shield API.
        // Until that endpoint exists, we use RecoveryMethod.PASSWORD with a
        // per-email password stored in localStorage. This ensures the same
        // browser always recovers the same wallet (consistent address).
        // Limitation: different browsers/devices will create different wallets
        // for the same email until EW-05 is implemented.
        // See: discoveries/openfort-adapter-gaps.md — Gap sobre encryptionSession.
        const recoveryPassword = getOrCreateRecoveryPassword(email);
        await this.openfort.embeddedWallet.create({
          accountType: AccountTypeEnum.EOA,
          chainType: ChainTypeEnum.SVM,
          recoveryParams: {
            recoveryMethod: RecoveryMethod.PASSWORD,
            password: recoveryPassword,
          },
        });
      } else if (state === EmbeddedState.READY) {
        // Wallet already exists — no action needed.
      } else if (state === EmbeddedState.CREATING_ACCOUNT) {
        // Wallet creation is in progress (race condition) — wait briefly.
        // In production, poll until state reaches READY.
        await waitForReady(this.openfort);
      } else {
        throw new WalletNotFoundError(
          `Unexpected embedded wallet state after authentication: ${state}`,
        );
      }
    } catch (err) {
      if (err instanceof WalletNotFoundError) throw err;
      throw new WalletNotFoundError(
        `Failed to initialize embedded wallet: ${errorMessage(err)}`,
        err,
      );
    }

    return this.fetchWalletAccount(email);
  }

  /**
   * Signs out the current user.
   *
   * @throws {AuthenticationError} If the sign-out request fails.
   */
  async signOut(): Promise<void> {
    try {
      await this.openfort.auth.logout();
    } catch (err) {
      throw new AuthenticationError(`Sign-out failed: ${errorMessage(err)}`, err);
    }
  }

  // ─── Transaction signing ──────────────────────────────────────────────────

  /**
   * Signs a Solana transaction with the embedded wallet.
   *
   * **Critical**: `hashMessage: false` must be passed to disable keccak256 hashing.
   * Solana uses raw Ed25519 signing — no hash transformation.
   *
   * @param tx - The transaction to sign.
   * @returns The signed transaction.
   * @throws {SigningError} If signing fails.
   * @throws {WalletNotFoundError} If not authenticated.
   */
  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    await this.assertReady();

    try {
      // `instanceof Transaction` falha quando o Anchor e o adapter carregam instâncias
      // diferentes de @solana/web3.js (problema de deduplicação entre workspaces).
      // Duck typing é mais confiável: `serializeMessage` existe apenas em Transaction legado,
      // enquanto VersionedTransaction expõe `message.serialize()`.
      if ('serializeMessage' in tx && typeof (tx as Transaction).serializeMessage === 'function') {
        return (await this.signLegacyTransaction(tx as unknown as Transaction)) as T;
      }
      return (await this.signVersionedTransaction(tx as VersionedTransaction)) as T;
    } catch (err) {
      if (err instanceof SigningError || err instanceof WalletNotFoundError) throw err;
      throw new SigningError(`Transaction signing failed: ${errorMessage(err)}`, err);
    }
  }

  /**
   * Signs multiple Solana transactions in a batch.
   *
   * @param txs - The transactions to sign.
   * @returns All transactions with signatures attached.
   * @throws {SigningError} If any signing fails.
   * @throws {WalletNotFoundError} If not authenticated.
   */
  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    const signed: T[] = [];
    for (const tx of txs) {
      signed.push(await this.signTransaction(tx));
    }
    return signed;
  }

  // ─── Wallet info ──────────────────────────────────────────────────────────

  /**
   * Returns the Solana public key of the authenticated wallet.
   *
   * Calls `embeddedWallet.get()` which returns an `EmbeddedAccount` with
   * the wallet's `address` (Base58 string). We convert it to a `PublicKey`.
   *
   * @returns The wallet's `PublicKey`.
   * @throws {WalletNotFoundError} If not authenticated or wallet not created.
   */
  async getAddress(): Promise<PublicKey> {
    try {
      const account = await this.openfort.embeddedWallet.get();
      if (!account?.address) {
        throw new WalletNotFoundError('Openfort returned no wallet address.');
      }
      return new PublicKey(account.address);
    } catch (err) {
      if (err instanceof WalletNotFoundError) throw err;
      throw new WalletNotFoundError(`Could not retrieve wallet address: ${errorMessage(err)}`, err);
    }
  }

  /**
   * Checks whether the wallet is in the `READY` state.
   *
   * `EmbeddedState.READY === 4` in SDK v0.9.x.
   * Never throws — returns `false` on any error.
   *
   * @returns `true` if authenticated and wallet is ready.
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const state = await this.openfort.embeddedWallet.getEmbeddedState();
      return state === EmbeddedState.READY;
    } catch {
      return false;
    }
  }

  // ─── Key export ───────────────────────────────────────────────────────────

  /**
   * Exports the raw private key of the embedded wallet.
   *
   * **SECURITY WARNING**: After export, the user is solely responsible for
   * securing the key. This cannot be undone.
   *
   * @returns Base58-encoded private key string.
   * @throws {WalletNotFoundError} If not authenticated.
   * @throws {SigningError} If the export request fails.
   */
  async exportPrivateKey(): Promise<string> {
    await this.assertReady();
    try {
      return await this.openfort.embeddedWallet.exportPrivateKey();
    } catch (err) {
      throw new SigningError(`Failed to export private key: ${errorMessage(err)}`, err);
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Asserts that the wallet is in `READY` state.
   *
   * @throws {WalletNotFoundError} If the wallet is not ready.
   */
  private async assertReady(): Promise<void> {
    const authenticated = await this.isAuthenticated();
    if (!authenticated) {
      throw new WalletNotFoundError(
        'The embedded wallet is not ready. Authenticate first with requestOtp() and signIn().',
      );
    }
  }

  /**
   * Fetches the `WalletAccount` for the authenticated user.
   *
   * @param email - The authenticated user's email.
   * @returns `WalletAccount` with `address` and `email`.
   */
  private async fetchWalletAccount(email: string): Promise<WalletAccount> {
    try {
      const account = await this.openfort.embeddedWallet.get();
      if (!account?.address) {
        throw new WalletNotFoundError(
          'Wallet was created but address could not be retrieved. Please try again.',
        );
      }
      return {
        address: new PublicKey(account.address),
        email,
      };
    } catch (err) {
      if (err instanceof WalletNotFoundError) throw err;
      throw new WalletNotFoundError(
        `Failed to retrieve wallet after authentication: ${errorMessage(err)}`,
        err,
      );
    }
  }

  /**
   * Signs a legacy (non-versioned) Solana `Transaction`.
   *
   * Serializes with `tx.serializeMessage()` and signs the raw bytes
   * with `hashMessage: false` (critical for Solana).
   *
   * @param tx - The legacy transaction.
   * @returns The signed transaction.
   */
  private async signLegacyTransaction(tx: Transaction): Promise<Transaction> {
    let messageBytes: Uint8Array;
    try {
      messageBytes = tx.serializeMessage();
    } catch (err) {
      throw new SigningError(`Failed to serialize transaction message: ${errorMessage(err)}`, err);
    }

    // hashMessage: false is critical — Solana signs raw bytes, not keccak256(bytes)
    const signatureBase58 = await this.openfort.embeddedWallet.signMessage(messageBytes, {
      hashMessage: false,
    });

    const signatureBytes = bs58.decode(signatureBase58);
    const address = await this.getAddress();
    tx.addSignature(address, Buffer.from(signatureBytes));

    return tx;
  }

  /**
   * Signs a versioned (`VersionedTransaction`) Solana transaction.
   *
   * Uses `tx.message.serialize()` (not `serializeMessage()` which is for legacy).
   * Attaches the signature at index 0 (the fee payer position).
   *
   * @param tx - The versioned transaction.
   * @returns The signed versioned transaction.
   */
  private async signVersionedTransaction(tx: VersionedTransaction): Promise<VersionedTransaction> {
    let messageBytes: Uint8Array;
    try {
      messageBytes = tx.message.serialize();
    } catch (err) {
      throw new SigningError(
        `Failed to serialize versioned transaction message: ${errorMessage(err)}`,
        err,
      );
    }

    const signatureBase58 = await this.openfort.embeddedWallet.signMessage(messageBytes, {
      hashMessage: false,
    });

    const signatureBytes = bs58.decode(signatureBase58);
    // Get the wallet address to attach the signature to the correct signer slot
    const address = await this.getAddress();
    tx.addSignature(address, signatureBytes);

    return tx;
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Polls the embedded wallet state until it reaches `READY`.
 *
 * Used when the state is `CREATING_ACCOUNT` (wallet creation in progress).
 * Polls every 500ms with a maximum of 20 attempts (10 seconds total).
 *
 * @param openfort - The Openfort SDK instance.
 * @throws {WalletNotFoundError} If the wallet doesn't become ready in time.
 *
 * @internal
 */
async function waitForReady(openfort: Openfort): Promise<void> {
  const MAX_ATTEMPTS = 20;
  const POLL_INTERVAL_MS = 500;

  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const state = await openfort.embeddedWallet.getEmbeddedState();
    if (state === EmbeddedState.READY) return;
    await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new WalletNotFoundError('Wallet creation timed out. Please try signing in again.');
}

/**
 * Extracts a human-readable message from an unknown caught value.
 *
 * @param err - The caught value.
 * @returns A string representation.
 *
 * @internal
 */
function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/**
 * Returns a stable recovery password for the given email, creating one if needed.
 *
 * Stored in localStorage so the same browser always recovers the same wallet.
 * Temporary workaround until EW-05 implements RecoveryMethod.AUTOMATIC via the
 * Shield API — at which point this function and its localStorage key can be removed.
 *
 * @param email - The authenticated user's email address.
 * @returns A UUID string used as the Shield recovery password.
 *
 * @internal
 */
function getOrCreateRecoveryPassword(email: string): string {
  const key = `__openfort_rp_${email}`;
  const stored = localStorage.getItem(key);
  if (stored) return stored;
  const password = crypto.randomUUID();
  localStorage.setItem(key, password);
  return password;
}
