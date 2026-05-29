/**
 * @file types.ts
 * @module @callydus/email-wallet-core
 *
 * Public type definitions for the solana-email-wallet domain.
 *
 * ## Design principles
 *
 * 1. **Single source of truth** — every type lives here. Adapter packages
 *    import from this file; they never re-declare types locally.
 * 2. **No runtime cost** — this file has zero imports at runtime. Types are
 *    erased by TypeScript. The only exception is the `z` import used to
 *    derive types from Zod schemas.
 * 3. **Explicit over implicit** — every field has a JSDoc comment explaining
 *    not just what it is but *why* it exists and what constraints apply.
 *
 * ## Key concept: Embedded Wallet
 *
 * An *embedded wallet* is a Solana keypair managed entirely by a custodial
 * provider (Openfort, Privy, Turnkey…). The user authenticates via email OTP
 * instead of managing a seed phrase. The private key never leaves the
 * provider's secure enclave — the user just signs transactions.
 *
 * The `EmailWalletAdapter` interface abstracts away all provider-specific
 * details. Consumers only deal with `WalletAccount`, `Transaction`, and
 * the `Result<T>` pattern.
 */

import type { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';
import { z } from 'zod';

// ─── Result<T> ────────────────────────────────────────────────────────────────

/**
 * Discriminated union representing the outcome of an operation that can fail.
 *
 * ## Why Result<T> instead of `throw`?
 *
 * `throw` forces callers to remember to wrap every call in try/catch. When
 * they forget, errors propagate silently and crash the app at unpredictable
 * points. `Result<T>` makes failures explicit in the type signature: if a
 * function returns `Result<WalletAccount>`, TypeScript forces you to handle
 * both the success and failure case before you can access `.data`.
 *
 * This is the same pattern used by Rust (`Result<T, E>`) and Go (returning
 * `(value, error)` tuples). It produces code that is easier to reason about
 * and test.
 *
 * ## Usage
 *
 * ```ts
 * const result = await client.signIn(email, otp);
 *
 * if (!result.success) {
 *   // result.error is typed as E (defaults to Error)
 *   showErrorMessage(result.error.message);
 *   return;
 * }
 *
 * // result.data is typed as T — TypeScript knows it exists here
 * console.log(result.data.address.toBase58());
 * ```
 *
 * @typeParam T - The value type on success.
 * @typeParam E - The error type on failure. Defaults to `Error`.
 */
export type Result<T, E = Error> =
  | { readonly success: true; readonly data: T }
  | { readonly success: false; readonly error: E };

// ─── Network ─────────────────────────────────────────────────────────────────

/**
 * The Solana network cluster the wallet should connect to.
 *
 * - `mainnet-beta` — production network with real SOL and real assets.
 *   Use this for production deployments only.
 * - `devnet` — the primary development and testing network.
 *   Tokens have no real value; SOL can be airdropped for free.
 * - `testnet` — a validator-focused test network, rarely used by app devs.
 *
 * The network is provided at client construction time and passed to adapters.
 * Adapters use it to configure which Solana cluster they target.
 *
 * @example
 * ```ts
 * const client = createEmailWalletClient({
 *   adapter: openfortAdapter,
 *   network: 'devnet', // use 'mainnet-beta' in production
 * });
 * ```
 */
export type Network = 'mainnet-beta' | 'devnet' | 'testnet';

// ─── WalletAccount ────────────────────────────────────────────────────────────

/**
 * Represents a Solana embedded wallet account tied to a user's email address.
 *
 * This is the core domain object of the library. When a user authenticates
 * via OTP, the adapter creates (or recovers) an embedded wallet and returns
 * a `WalletAccount` describing it.
 *
 * ## What is a PublicKey?
 *
 * In Solana, every account is identified by a 32-byte Ed25519 public key,
 * typically encoded as a Base58 string (e.g. `"7xKXtg2CW87d..."`). The
 * `PublicKey` class from `@solana/web3.js` wraps that 32-byte value and
 * provides helpers like `.toBase58()`, `.toBytes()`, and `.equals()`.
 *
 * The user never sees or manages the corresponding private key — the
 * embedded wallet provider handles key custody securely.
 *
 * @example
 * ```ts
 * const result = await client.signIn('alice@example.com', '123456');
 * if (result.success) {
 *   console.log(result.data.address.toBase58()); // "7xKXtg2CW87d..."
 *   console.log(result.data.email);              // "alice@example.com"
 * }
 * ```
 */
export interface WalletAccount {
  /**
   * The Solana public key of the embedded wallet.
   *
   * This is the address that appears on-chain — it can be used to receive SOL,
   * tokens, and NFTs. It is derived from the wallet's private key and is safe
   * to share publicly.
   *
   * Base58 representation: 32–44 characters, e.g. `"7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"`
   */
  readonly address: PublicKey;

  /**
   * The email address used to authenticate and create this wallet.
   *
   * This is normalized to lowercase before storage. It is the stable
   * identifier used to recover the wallet across sessions: same email
   * always maps to the same wallet.
   *
   * Note: email addresses are **never** stored on-chain. They live only
   * in the adapter's backend (e.g. Openfort's servers).
   */
  readonly email: string;
}

// ─── EmailWalletAdapter ───────────────────────────────────────────────────────

/**
 * The contract that every adapter implementation must satisfy.
 *
 * An adapter is a bridge between the generic `EmailWalletClient` and a
 * specific embedded-wallet provider (Openfort, Privy, Turnkey, etc.).
 * The client calls adapter methods; the adapter translates those calls
 * into provider-specific SDK calls.
 *
 * ## OTP flow (two-step authentication)
 *
 * 1. **Step 1 — Request**: Call `requestOtp(email)`. The provider sends a
 *    one-time passcode to the user's email inbox.
 * 2. **Step 2 — Verify**: Call `signIn(email, otp)`. The provider verifies
 *    the code and returns the authenticated `WalletAccount`.
 *
 * ## Error handling contract
 *
 * Adapter methods **throw** typed errors from `@callydus/email-wallet-core/errors`.
 * The `EmailWalletClient` catches these and wraps them in `Result<T>`.
 * Consumer code never needs try/catch — they always deal with `Result<T>`.
 *
 * ## Implementing a new adapter
 *
 * See `CONTRIBUTING.md` at the repo root for the full guide. In short:
 * 1. Create a new package `packages/adapter-<provider>/`
 * 2. Implement every method of this interface
 * 3. Export your adapter class and its config schema
 *
 * @example
 * ```ts
 * // Consuming the adapter via the client (recommended):
 * const client = createEmailWalletClient({ adapter, network: 'devnet' });
 * const result = await client.signIn(email, otp);
 *
 * // Consuming the adapter directly (advanced use cases only):
 * const account = await adapter.signIn(email, otp); // throws on failure
 * ```
 */
export interface EmailWalletAdapter {
  /**
   * Step 1 of the OTP authentication flow.
   *
   * Requests that the provider sends a one-time passcode to the given email.
   * The email must be a valid address; the provider may reject syntactically
   * invalid addresses with an `AuthenticationError`.
   *
   * This method has no return value — either it succeeds (code was sent) or
   * it throws an `AuthenticationError`.
   *
   * @param email - The email address to send the OTP to.
   *                Must be a valid email format.
   * @throws {AuthenticationError} If the provider cannot send the OTP.
   *
   * @example
   * ```ts
   * await adapter.requestOtp('user@example.com');
   * // Now show the OTP input form to the user
   * ```
   */
  requestOtp(email: string): Promise<void>;

  /**
   * Step 2 of the OTP authentication flow.
   *
   * Verifies the one-time passcode and returns the authenticated wallet.
   * If the wallet does not yet exist for this email, the adapter creates it.
   * If it already exists, the adapter recovers and returns it.
   *
   * @param email - The same email address used in `requestOtp`.
   * @param otp   - The 6-digit (or provider-defined length) code from the email.
   * @returns The authenticated `WalletAccount` with the wallet's public key.
   * @throws {AuthenticationError} If the OTP is invalid or expired.
   * @throws {WalletNotFoundError} If the wallet cannot be created or recovered.
   *
   * @example
   * ```ts
   * const account = await adapter.signIn('user@example.com', '123456');
   * console.log(account.address.toBase58()); // "7xKX..."
   * ```
   */
  signIn(email: string, otp: string): Promise<WalletAccount>;

  /**
   * Signs out the current user and clears the active session.
   *
   * After this call, `isAuthenticated()` must return `false` and
   * `getAddress()` must throw `WalletNotFoundError`.
   *
   * @throws {AuthenticationError} If the sign-out request fails at the provider.
   *
   * @example
   * ```ts
   * await adapter.signOut();
   * // Session cleared — user must authenticate again
   * ```
   */
  signOut(): Promise<void>;

  /**
   * Signs a Solana transaction using the embedded wallet's private key.
   *
   * The transaction is signed with Ed25519. For Solana, no message hashing
   * (keccak256) is applied — the raw transaction bytes are signed directly.
   *
   * The method preserves the transaction type: if you pass a `Transaction`,
   * you get back a `Transaction`; if you pass a `VersionedTransaction`, you
   * get back a `VersionedTransaction`.
   *
   * ## How transaction signing works
   *
   * 1. Serialize the transaction message to bytes
   *    - `Transaction`: use `tx.serializeMessage()`
   *    - `VersionedTransaction`: use `tx.message.serialize()`
   * 2. Call the provider's signing API with `hashMessage: false`
   * 3. Decode the Base58-encoded signature to `Uint8Array`
   * 4. Attach the signature to the transaction
   *
   * @param tx - The transaction to sign. Must have its `recentBlockhash` set.
   * @returns The same transaction object, now with the signature attached.
   * @throws {SigningError} If the signing operation fails.
   * @throws {WalletNotFoundError} If the user is not authenticated.
   *
   * @example
   * ```ts
   * const signedTx = await adapter.signTransaction(transaction);
   * const txId = await connection.sendRawTransaction(signedTx.serialize());
   * ```
   */
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;

  /**
   * Signs multiple Solana transactions in a single batch.
   *
   * Equivalent to calling `signTransaction` for each transaction, but
   * may be more efficient depending on the provider's API.
   *
   * @param txs - The transactions to sign. All must have their `recentBlockhash` set.
   * @returns The same transaction objects, each with its signature attached.
   * @throws {SigningError} If any signing operation fails (entire batch fails).
   * @throws {WalletNotFoundError} If the user is not authenticated.
   *
   * @example
   * ```ts
   * const [signedTx1, signedTx2] = await adapter.signAllTransactions([tx1, tx2]);
   * ```
   */
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>;

  /**
   * Exports the raw Base58-encoded private key of the embedded wallet.
   *
   * **SECURITY WARNING**: Exporting the private key permanently removes
   * the wallet from the provider's custody. The user is now responsible
   * for securing the key. This operation cannot be undone.
   *
   * This method exists for advanced use cases (migrating to a hardware wallet,
   * using the key in a CLI, etc.). It should never be called automatically
   * by application code — always require explicit user confirmation first.
   *
   * @returns The private key as a Base58-encoded string.
   * @throws {WalletNotFoundError} If the user is not authenticated.
   * @throws {SigningError} If the export request fails.
   *
   * @example
   * ```ts
   * // Only after explicit user confirmation:
   * const privateKey = await adapter.exportPrivateKey();
   * // Show to user once — never store it
   * ```
   */
  exportPrivateKey(): Promise<string>;

  /**
   * Returns the Solana public key of the currently authenticated wallet.
   *
   * @returns The wallet's `PublicKey`.
   * @throws {WalletNotFoundError} If the user is not authenticated or has no wallet.
   *
   * @example
   * ```ts
   * const address = await adapter.getAddress();
   * console.log(address.toBase58()); // "7xKX..."
   * ```
   */
  getAddress(): Promise<PublicKey>;

  /**
   * Checks whether the current session has an authenticated, ready wallet.
   *
   * Returns `true` only if:
   * - The user has completed the OTP sign-in
   * - The embedded wallet is created and accessible
   * - The session has not expired
   *
   * Returns `false` in all other cases (unauthenticated, wallet not created,
   * session expired, etc.) — it never throws.
   *
   * @returns `true` if authenticated and wallet is ready; `false` otherwise.
   *
   * @example
   * ```ts
   * if (await adapter.isAuthenticated()) {
   *   const address = await adapter.getAddress();
   * } else {
   *   // Redirect to sign-in flow
   * }
   * ```
   */
  isAuthenticated(): Promise<boolean>;
}

// ─── EmailWalletClientConfig ──────────────────────────────────────────────────

/**
 * Zod schema for validating `EmailWalletClientConfig`.
 *
 * Using a Zod schema as the single source of truth ensures that runtime
 * validation and TypeScript types are always in sync. Never create a
 * separate interface that mirrors this schema — they will diverge.
 *
 * The schema validates:
 * - `adapter`: must be a non-null object (duck-typed as `EmailWalletAdapter`)
 * - `network`: must be one of the three valid Solana cluster names
 *
 * @internal Used by `EmailWalletClient` constructor to fail fast on
 *           misconfiguration rather than producing mysterious runtime errors.
 */
export const emailWalletClientConfigSchema = z.object({
  /**
   * The adapter instance that implements `EmailWalletAdapter`.
   * This is the bridge to the specific embedded-wallet provider.
   */
  adapter: z.custom<EmailWalletAdapter>((val) => val !== null && typeof val === 'object', {
    message: 'adapter must be a non-null object implementing EmailWalletAdapter',
  }),

  /**
   * The Solana network this client targets.
   * Must be 'mainnet-beta', 'devnet', or 'testnet'.
   */
  network: z.enum(['mainnet-beta', 'devnet', 'testnet']),
});

/**
 * Configuration object for `EmailWalletClient`.
 *
 * Derived from the Zod schema to guarantee type/runtime consistency.
 *
 * @example
 * ```ts
 * const config: EmailWalletClientConfig = {
 *   adapter: new OpenfortAdapter({ publishableKey: 'pk_...' }),
 *   network: 'devnet',
 * };
 * const client = createEmailWalletClient(config);
 * ```
 */
export type EmailWalletClientConfig = z.infer<typeof emailWalletClientConfigSchema>;
