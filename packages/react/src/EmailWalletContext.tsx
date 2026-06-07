/**
 * @file EmailWalletContext.tsx
 * @module @callydus/email-wallet-react
 *
 * React Context and Provider for the email wallet.
 *
 * ## What is React Context?
 *
 * React Context allows sharing state across a component tree without prop drilling.
 * Instead of passing `client` and `wallet` down through every component, you wrap
 * your app with `<EmailWalletProvider>` once, and any component can call
 * `useEmailWallet()` to access the wallet state.
 *
 * ## Architecture
 *
 * ```
 * <EmailWalletProvider client={client}>
 *   <App>
 *     <SignInForm />     ← calls useEmailWallet().requestOtp()
 *     <WalletDisplay />  ← reads useEmailWallet().wallet
 *     <SendButton />     ← calls useEmailWallet().signTransaction()
 *   </App>
 * </EmailWalletProvider>
 * ```
 *
 * ## Usage
 *
 * ```tsx
 * // In your app root:
 * import { EmailWalletProvider } from '@callydus/email-wallet-react';
 * import { createEmailWalletClient } from '@callydus/email-wallet-core';
 * import { OpenfortAdapter } from '@callydus/email-wallet-adapter-openfort';
 *
 * const client = createEmailWalletClient({
 *   adapter: new OpenfortAdapter({ publishableKey: 'pk_...', shieldPublishableKey: 'shpk_...' }),
 *   network: 'devnet',
 * });
 *
 * function App() {
 *   return (
 *     <EmailWalletProvider client={client}>
 *       <YourApp />
 *     </EmailWalletProvider>
 *   );
 * }
 * ```
 */

'use client'; // Required for Next.js App Router — this is a Client Component

import type {
  EmailWalletAdapter,
  EmailWalletClient,
  WalletAccount,
} from '@callydus/email-wallet-core';
import type React from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// ─── Context value type ───────────────────────────────────────────────────────

/**
 * The shape of the value stored in `EmailWalletContext`.
 *
 * This is what `useEmailWallet()` returns. Every field has a JSDoc comment
 * explaining its purpose and how to use it.
 *
 * All async operations follow the same pattern:
 * - Set `isLoading = true` before the async call
 * - Set `isLoading = false` after (success or error)
 * - Set `error` if the operation fails, clear it on success
 */
export interface EmailWalletContextValue {
  /**
   * Step 1 of the OTP flow. Sends a code to the user's email.
   *
   * Call this when the user submits the email form. Show a success indicator
   * and advance the UI to the OTP input. If it fails, `error` will be set.
   *
   * @param email - The email to send the OTP to.
   * @throws Never — errors are stored in the `error` state instead.
   */
  requestOtp: (email: string) => Promise<void>;

  /**
   * Step 2 of the OTP flow. Verifies the code and authenticates the wallet.
   *
   * Call this when the user submits the OTP code. On success, `wallet` will
   * be set and `isAuthenticated` will become `true`.
   *
   * @param email - The same email used in `requestOtp`.
   * @param otp   - The 6-digit code from the user's inbox.
   * @throws Never — errors are stored in the `error` state instead.
   */
  signIn: (email: string, otp: string) => Promise<void>;

  /**
   * Signs out the current user.
   *
   * Clears the session, sets `wallet` to `null`, and `isAuthenticated` to `false`.
   *
   * @throws Never — errors are stored in the `error` state instead.
   */
  signOut: () => Promise<void>;

  /**
   * The currently authenticated wallet, or `null` if not authenticated.
   *
   * Contains `address` (Solana `PublicKey`) and `email` (string).
   * Set after a successful `signIn()` call.
   */
  wallet: WalletAccount | null;

  /**
   * Whether the user is currently authenticated with a ready wallet.
   *
   * Derived from `wallet !== null`. Use this for conditional rendering:
   * ```tsx
   * {isAuthenticated ? <WalletDisplay /> : <SignInForm />}
   * ```
   */
  isAuthenticated: boolean;

  /**
   * Whether an async operation (requestOtp, signIn, signOut) is in progress.
   *
   * Use this to disable forms and show loading spinners:
   * ```tsx
   * <button disabled={isLoading}>
   *   {isLoading ? 'Sending...' : 'Send OTP'}
   * </button>
   * ```
   */
  isLoading: boolean;

  /**
   * The last error that occurred, or `null` if no error.
   *
   * Reset to `null` at the start of each new operation. Check `err.message`
   * for a human-readable description to show in the UI.
   *
   * The error is a typed `EmailWalletError` from the core package — use
   * `instanceof` checks to handle specific error types differently if needed.
   */
  error: Error | null;

  /**
   * Signs a single Solana transaction using the embedded wallet.
   *
   * Delegates to the adapter's `signTransaction` method. The transaction
   * must have its `recentBlockhash` set before calling this.
   *
   * @param tx - The transaction to sign.
   * @returns The signed transaction.
   * @throws {Error} If signing fails (not wrapped in Result — callers handle directly).
   */
  signTransaction: EmailWalletAdapter['signTransaction'];

  /**
   * Signs multiple Solana transactions in a batch.
   *
   * @param txs - The transactions to sign.
   * @returns All transactions with signatures attached.
   * @throws {Error} If any signing fails.
   */
  signAllTransactions: EmailWalletAdapter['signAllTransactions'];

  /**
   * Exports the raw private key of the embedded wallet.
   *
   * **SECURITY WARNING**: Only call after explicit user confirmation.
   *
   * @returns The Base58-encoded private key.
   * @throws {Error} If not authenticated or export fails.
   */
  exportPrivateKey: () => Promise<string>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

/**
 * The React Context that stores the email wallet state.
 *
 * The default value is `null` — a `null` context signals that the component
 * is rendered outside a `<EmailWalletProvider>`. The `useEmailWallet()` hook
 * checks for this and throws a helpful error.
 *
 * @internal Do not import this context directly — use `useEmailWallet()` instead.
 */
export const EmailWalletContext = createContext<EmailWalletContextValue | null>(null);

// ─── Provider props ───────────────────────────────────────────────────────────

/**
 * Props for the `<EmailWalletProvider>` component.
 */
export interface EmailWalletProviderProps {
  /**
   * The `EmailWalletClient` instance to use for all wallet operations.
   *
   * Create this once outside the component tree (module scope or a singleton)
   * to avoid recreating the Openfort SDK on every render.
   *
   * @example
   * ```tsx
   * // Create once at module level:
   * const client = createEmailWalletClient({ adapter, network: 'devnet' });
   *
   * // Then use in JSX:
   * <EmailWalletProvider client={client}>...</EmailWalletProvider>
   * ```
   */
  client: EmailWalletClient;

  /**
   * The child components that will have access to the wallet context.
   * Wrap your entire app (or the parts that need wallet access) here.
   */
  children: React.ReactNode;
}

// ─── Provider component ───────────────────────────────────────────────────────

/**
 * Provides the email wallet context to all child components.
 *
 * Place this high in your component tree — at or near the root.
 * Wrap only the components that need wallet access, but it is fine
 * to wrap the entire app.
 *
 * @example
 * ```tsx
 * <EmailWalletProvider client={client}>
 *   <Router>
 *     <App />
 *   </Router>
 * </EmailWalletProvider>
 * ```
 */
export function EmailWalletProvider({
  client,
  children,
}: EmailWalletProviderProps): React.JSX.Element {
  // ─── State ───────────────────────────────────────────────────────────────

  /**
   * The currently authenticated wallet, or null.
   * Set on successful `signIn()`, cleared on `signOut()`.
   */
  const [wallet, setWallet] = useState<WalletAccount | null>(null);

  /**
   * Whether an async operation is in progress.
   * Prevents concurrent operations and drives loading UI.
   */
  const [isLoading, setIsLoading] = useState<boolean>(false);

  /**
   * The last error that occurred.
   * Cleared at the start of each new operation.
   */
  const [error, setError] = useState<Error | null>(null);

  // ─── Restore session on mount ─────────────────────────────────────────────

  /**
   * On mount, check if there is an existing authenticated session.
   *
   * This handles the case where the user has already signed in (session stored
   * by the provider's SDK) and refreshes the page. Without this effect, the
   * `wallet` state would start as `null` even though the user is authenticated.
   *
   * We check `isAuthenticated()` first (cheap, no network call on most providers)
   * and only call `getAddress()` if authenticated.
   */
  useEffect(() => {
    let cancelled = false;

    async function restoreSession(): Promise<void> {
      const authenticated = await client.isAuthenticated();
      if (!authenticated || cancelled) return;

      const addressResult = await client.getAddress();
      if (!addressResult.success || cancelled) return;

      // We don't have the email from a restored session — use empty string as placeholder.
      // In a real app, you might store the email in localStorage or derive it from
      // the provider's session data.
      setWallet({ address: addressResult.data, email: '' });
    }

    void restoreSession();

    // Cleanup function: if the component unmounts before the async work completes,
    // we set `cancelled = true` to avoid calling `setWallet` on an unmounted component.
    return () => {
      cancelled = true;
    };
  }, [client]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  /**
   * Sends an OTP to the user's email.
   *
   * Wrapped in `useCallback` to maintain a stable reference across renders.
   * The dependency array includes `client` — if the client changes (unlikely
   * but possible in tests), the callback will be recreated.
   */
  const requestOtp = useCallback(
    async (email: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await client.requestOtp(email);
        if (!result.success) {
          setError(result.error);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [client],
  );

  /**
   * Verifies the OTP and authenticates the wallet.
   *
   * On success, sets `wallet` state with the returned `WalletAccount`.
   */
  const signIn = useCallback(
    async (email: string, otp: string): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await client.signIn(email, otp);
        if (result.success) {
          setWallet(result.data);
        } else {
          setError(result.error);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [client],
  );

  /**
   * Signs out the current user and clears the wallet state.
   */
  const signOut = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await client.signOut();
      if (result.success) {
        setWallet(null);
      } else {
        setError(result.error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  /**
   * Signs a transaction. Errors propagate directly — not stored in state.
   *
   * Signing is typically triggered by a specific user action. If it fails,
   * the component that initiated the signing should handle the error locally
   * (e.g., show a toast) rather than overwriting the global error state.
   */
  const signTransaction: EmailWalletAdapter['signTransaction'] = useCallback(
    async <T extends Parameters<EmailWalletAdapter['signTransaction']>[0]>(tx: T): Promise<T> => {
      const result = await client.signTransaction(tx);
      if (!result.success) throw result.error;
      return result.data;
    },
    [client],
  );

  /**
   * Signs all transactions in a batch.
   */
  const signAllTransactions: EmailWalletAdapter['signAllTransactions'] = useCallback(
    async <T extends Parameters<EmailWalletAdapter['signAllTransactions']>[0][number]>(
      txs: T[],
    ): Promise<T[]> => {
      const result = await client.signAllTransactions(txs);
      if (!result.success) throw result.error;
      return result.data;
    },
    [client],
  );

  /**
   * Exports the private key. Errors propagate directly — not stored in state.
   */
  const exportPrivateKey = useCallback(async (): Promise<string> => {
    const result = await client.exportPrivateKey();
    if (!result.success) throw result.error;
    return result.data;
  }, [client]);

  // ─── Context value ────────────────────────────────────────────────────────

  /**
   * The context value object.
   *
   * Wrapped in `useMemo` to prevent unnecessary re-renders of consumers.
   * The memo only recomputes when its dependencies change.
   *
   * Note: `wallet` changes cause a re-render of all consumers, which is
   * expected — it signals that the wallet state has changed.
   */
  const value = useMemo<EmailWalletContextValue>(
    () => ({
      requestOtp,
      signIn,
      signOut,
      wallet,
      isAuthenticated: wallet !== null,
      isLoading,
      error,
      signTransaction,
      signAllTransactions,
      exportPrivateKey,
    }),
    [
      requestOtp,
      signIn,
      signOut,
      wallet,
      isLoading,
      error,
      signTransaction,
      signAllTransactions,
      exportPrivateKey,
    ],
  );

  return <EmailWalletContext.Provider value={value}>{children}</EmailWalletContext.Provider>;
}

// ─── useEmailWalletContext ─────────────────────────────────────────────────────

/**
 * Low-level hook to access the `EmailWalletContext` directly.
 *
 * Throws a helpful error if used outside a `<EmailWalletProvider>`.
 * Prefer the higher-level `useEmailWallet()` hook from `useEmailWallet.ts`.
 *
 * @returns The `EmailWalletContextValue`.
 * @throws {Error} If called outside an `<EmailWalletProvider>`.
 *
 * @internal
 */
export function useEmailWalletContext(): EmailWalletContextValue {
  const context = useContext(EmailWalletContext);
  if (context === null) {
    throw new Error(
      'useEmailWallet must be called inside an <EmailWalletProvider>. ' +
        'Wrap your application (or the relevant subtree) with: ' +
        '<EmailWalletProvider client={client}>...</EmailWalletProvider>',
    );
  }
  return context;
}
