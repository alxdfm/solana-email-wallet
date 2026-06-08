/**
 * @file useEmailWallet.ts
 * @module @callydus/email-wallet-react
 *
 * The primary React hook for email-based Solana wallet operations.
 *
 * ## What is a React Hook?
 *
 * A hook is a special function (starting with `use`) that lets you access
 * React features (state, effects, context) inside function components.
 * This hook reads the email wallet state from `EmailWalletContext` and
 * returns it in a convenient, typed object.
 *
 * ## Usage
 *
 * ```tsx
 * import { useEmailWallet } from '@callydus/email-wallet-react';
 *
 * function SignInForm() {
 *   const { requestOtp, signIn, isLoading, error } = useEmailWallet();
 *   const [email, setEmail] = useState('');
 *   const [otp, setOtp] = useState('');
 *   const [step, setStep] = useState<'email' | 'otp'>('email');
 *
 *   const handleEmailSubmit = async () => {
 *     await requestOtp(email);
 *     if (!error) setStep('otp');
 *   };
 *
 *   const handleOtpSubmit = async () => {
 *     await signIn(email, otp);
 *   };
 *
 *   return step === 'email' ? (
 *     <EmailInput value={email} onChange={setEmail} onSubmit={handleEmailSubmit} />
 *   ) : (
 *     <OtpInput value={otp} onChange={setOtp} onSubmit={handleOtpSubmit} />
 *   );
 * }
 * ```
 *
 * ## Requirements
 *
 * The component calling this hook must be inside an `<EmailWalletProvider>`.
 * Calling outside a provider will throw an error with an actionable message.
 */

import { useContext } from 'react';
import { EmailWalletContext, useEmailWalletContext } from './EmailWalletContext.js';
import type { UseEmailWalletReturn } from './types.js';

/**
 * Defaults returned by `useEmailWalletSafe()` when called outside a provider.
 *
 * `signTransaction` and `signAllTransactions` throw by design — they should
 * never be reached via `useCurrentWallet` when `isAuthenticated` is false.
 * The cast is necessary because the generic constraint on those types cannot
 * be satisfied by a throwing stub without a full type-assertion.
 */
const UNAUTHENTICATED: UseEmailWalletReturn = {
  wallet: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  requestOtp: async () => {},
  signIn: async () => {},
  signOut: async () => {},
  // biome-ignore lint/suspicious/noExplicitAny: unreachable — useCurrentWallet returns null when !isAuthenticated
  signTransaction: (async () => {
    throw new Error('Email wallet not authenticated');
  }) as unknown as UseEmailWalletReturn['signTransaction'],
  // biome-ignore lint/suspicious/noExplicitAny: unreachable — useCurrentWallet returns null when !isAuthenticated
  signAllTransactions: (async () => {
    throw new Error('Email wallet not authenticated');
  }) as unknown as UseEmailWalletReturn['signAllTransactions'],
  exportPrivateKey: async () => {
    throw new Error('Email wallet not authenticated');
  },
};

/**
 * Returns the email wallet state and actions from the nearest `<EmailWalletProvider>`.
 *
 * This is the primary way to interact with the email wallet in React components.
 * Prefer this hook over importing context directly.
 *
 * ## Returned values
 *
 * | Property | Type | Description |
 * |---|---|---|
 * | `requestOtp` | `(email) => Promise<void>` | Step 1: send OTP |
 * | `signIn` | `(email, otp) => Promise<void>` | Step 2: verify OTP |
 * | `signOut` | `() => Promise<void>` | Clear session |
 * | `wallet` | `WalletAccount \| null` | Authenticated wallet or null |
 * | `isAuthenticated` | `boolean` | `wallet !== null` |
 * | `isLoading` | `boolean` | Operation in progress |
 * | `error` | `Error \| null` | Last error, or null |
 * | `signTransaction` | `(tx) => Promise<T>` | Sign a transaction |
 * | `signAllTransactions` | `(txs) => Promise<T[]>` | Sign multiple transactions |
 * | `exportPrivateKey` | `() => Promise<string>` | Export private key |
 *
 * @returns `UseEmailWalletReturn` — all wallet state and actions.
 * @throws {Error} If called outside an `<EmailWalletProvider>`.
 *
 * @example
 * ```tsx
 * function WalletStatus() {
 *   const { wallet, isAuthenticated, signOut } = useEmailWallet();
 *
 *   if (!isAuthenticated) {
 *     return <p>Not signed in</p>;
 *   }
 *
 *   return (
 *     <div>
 *       <p>Wallet: {wallet!.address.toBase58()}</p>
 *       <button onClick={signOut}>Sign out</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useEmailWallet(): UseEmailWalletReturn {
  return useEmailWalletContext();
}

/**
 * Safe variant of `useEmailWallet()` intended for compositing hooks that must
 * be called unconditionally (e.g. `useCurrentWallet` in callydus-sign).
 *
 * ## Why this exists
 *
 * React's rules of hooks forbid conditional hook calls. `useCurrentWallet`
 * must always call both `useWallet()` and `useEmailWallet()` so that the
 * hook count stays constant across renders — even when `<EmailWalletProvider>`
 * is not mounted. The regular `useEmailWallet()` throws in that case, which
 * would crash the app. This variant returns unauthenticated defaults instead.
 *
 * ## When NOT to use this
 *
 * Do not use this in UI components. For components that live inside
 * `<EmailWalletProvider>`, use `useEmailWallet()` — it throws a helpful error
 * if the provider is missing, which catches configuration mistakes early.
 *
 * @returns The email wallet context value, or unauthenticated defaults if no
 *          `<EmailWalletProvider>` is mounted.
 */
export function useEmailWalletSafe(): UseEmailWalletReturn {
  const context = useContext(EmailWalletContext);
  return context ?? UNAUTHENTICATED;
}
