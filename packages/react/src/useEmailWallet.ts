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

import { useEmailWalletContext } from './EmailWalletContext.js';
import type { UseEmailWalletReturn } from './types.js';

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
