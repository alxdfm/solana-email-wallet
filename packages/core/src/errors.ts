/**
 * @file errors.ts
 * @module @callydus/email-wallet-core
 *
 * Typed error classes for the email-wallet domain.
 *
 * ## Why typed errors instead of plain `throw new Error()`?
 *
 * Using typed error classes allows callers to distinguish failure modes
 * programmatically, display user-facing messages without parsing strings,
 * and handle each error category differently (e.g. retry on network error,
 * show OTP form on auth error, redirect on wallet-not-found).
 *
 * All errors extend `EmailWalletError` so callers can do a single
 * `catch (err)` and check `err instanceof EmailWalletError` before casting.
 *
 * ## Usage pattern
 *
 * These errors are thrown by **adapters** (which have direct access to
 * third-party SDKs and know the failure cause). The `EmailWalletClient`
 * catches them and converts them into `Result<T>` objects so that
 * consuming code never needs try/catch in business logic.
 *
 * ```ts
 * // Inside an adapter implementation:
 * throw new AuthenticationError('Invalid OTP code');
 *
 * // Inside EmailWalletClient (catches and converts):
 * return { success: false, error: err };
 * ```
 */

// ─── Base error ──────────────────────────────────────────────────────────────

/**
 * Base class for every error originating from the solana-email-wallet library.
 *
 * Extend this class to create domain-specific errors. Never throw plain
 * `Error` objects from adapter or client code — always use a subclass
 * so that callers can distinguish library errors from unexpected runtime errors.
 *
 * @example
 * ```ts
 * if (err instanceof EmailWalletError) {
 *   // Known library error — safe to show to user
 *   showToast(err.message);
 * } else {
 *   // Unknown error — log and show generic message
 *   console.error(err);
 * }
 * ```
 */
export class EmailWalletError extends Error {
  /**
   * The name of the error class, used for serialization and logging.
   * Overridden in every subclass to return the concrete class name.
   */
  override readonly name: string = 'EmailWalletError';

  /**
   * An optional machine-readable code that identifies the specific failure.
   * Useful when you need to map errors to i18n keys or HTTP status codes.
   *
   * @example 'INVALID_OTP' | 'WALLET_NOT_FOUND' | 'SIGNING_FAILED'
   */
  readonly code: string;

  /**
   * Creates a new `EmailWalletError`.
   *
   * @param message - Human-readable description of the failure.
   * @param code    - Machine-readable error code (defaults to the class name).
   * @param cause   - The underlying error that triggered this one, if any.
   *                  Preserved in the `.cause` property for debugging.
   */
  constructor(message: string, code = 'EMAIL_WALLET_ERROR', cause?: unknown) {
    super(message, { cause });
    this.code = code;
    // Fix for TypeScript class hierarchy — ensures instanceof checks work correctly
    // when the code is transpiled to ES5 or older targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ─── Authentication errors ────────────────────────────────────────────────────

/**
 * Thrown when an authentication operation fails.
 *
 * This covers the full OTP flow:
 * - OTP request fails (network error, invalid email format at provider level)
 * - OTP sign-in fails (wrong code, expired code, too many attempts)
 * - Session is expired and a new sign-in is required
 *
 * @example
 * ```ts
 * // In an adapter:
 * throw new AuthenticationError('The OTP code has expired. Please request a new one.');
 *
 * // In consuming code:
 * if (err instanceof AuthenticationError) {
 *   setStep('request-otp'); // send user back to step 1
 * }
 * ```
 */
export class AuthenticationError extends EmailWalletError {
  override readonly name = 'AuthenticationError';

  constructor(message: string, cause?: unknown) {
    super(message, 'AUTHENTICATION_ERROR', cause);
  }
}

// ─── Wallet errors ────────────────────────────────────────────────────────────

/**
 * Thrown when the embedded wallet account cannot be located.
 *
 * This typically happens when:
 * - The user is authenticated but has not yet created a wallet
 * - The wallet was created on a different network than the one configured
 * - The adapter's wallet retrieval call returns null or an empty result
 *
 * @example
 * ```ts
 * // In an adapter:
 * if (!account) {
 *   throw new WalletNotFoundError('No embedded wallet found for this account.');
 * }
 * ```
 */
export class WalletNotFoundError extends EmailWalletError {
  override readonly name = 'WalletNotFoundError';

  constructor(message = 'No embedded wallet found for this account.', cause?: unknown) {
    super(message, 'WALLET_NOT_FOUND', cause);
  }
}

// ─── Signing errors ───────────────────────────────────────────────────────────

/**
 * Thrown when a transaction or message signing operation fails.
 *
 * This covers:
 * - The embedded wallet refusing to sign (user-rejected, policy violation)
 * - Serialization failures before the signature call
 * - Deserialization failures when parsing the signature result
 * - Network errors during the signing request
 *
 * For Solana specifically: Openfort's embedded wallet signs with Ed25519,
 * without keccak256 hashing (`hashMessage: false`). Any error in that
 * pipeline should be wrapped in `SigningError`.
 *
 * @example
 * ```ts
 * throw new SigningError('Failed to sign transaction: user rejected the request.');
 * ```
 */
export class SigningError extends EmailWalletError {
  override readonly name = 'SigningError';

  constructor(message: string, cause?: unknown) {
    super(message, 'SIGNING_ERROR', cause);
  }
}

// ─── Configuration errors ─────────────────────────────────────────────────────

/**
 * Thrown when an adapter or client is initialized with invalid configuration.
 *
 * This is different from a Zod `ZodError` — `ConfigurationError` is thrown
 * after validation when the configuration is syntactically valid but
 * semantically incorrect (e.g., a publishable key for the wrong environment).
 *
 * Zod validation errors are converted to `ConfigurationError` by adapter
 * constructors so that consumers see a unified error type.
 *
 * @example
 * ```ts
 * throw new ConfigurationError('publishableKey must start with "pk_"');
 * ```
 */
export class ConfigurationError extends EmailWalletError {
  override readonly name = 'ConfigurationError';

  constructor(message: string, cause?: unknown) {
    super(message, 'CONFIGURATION_ERROR', cause);
  }
}

// ─── Not implemented errors ───────────────────────────────────────────────────

/**
 * Thrown by stub adapter implementations that have not yet been built.
 *
 * The `adapter-privy` and `adapter-turnkey` packages ship as stubs.
 * Every method on those adapters throws `NotImplementedError` with a
 * message pointing to the contributing guide.
 *
 * This is intentional: it lets consumers import the package, configure it,
 * and get a clear compile-time + runtime error rather than a silent no-op.
 *
 * @example
 * ```ts
 * // In a stub adapter:
 * async requestOtp(_email: string): Promise<void> {
 *   throw new NotImplementedError('PrivyAdapter.requestOtp');
 * }
 * ```
 */
export class NotImplementedError extends EmailWalletError {
  override readonly name = 'NotImplementedError';

  /**
   * @param methodName - The fully-qualified method name that is not yet
   *                     implemented (e.g. `'PrivyAdapter.requestOtp'`).
   */
  constructor(methodName: string) {
    super(
      `${methodName} is not yet implemented. See CONTRIBUTING.md for instructions on implementing a new adapter.`,
      'NOT_IMPLEMENTED',
    );
  }
}
