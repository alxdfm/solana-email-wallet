/**
 * @file index.ts
 * @module @callydus/email-wallet-react
 *
 * Public API of `@callydus/email-wallet-react`.
 *
 * ## What to import from this package
 *
 * - **Provider**: `EmailWalletProvider` — wraps your app to provide context
 * - **Hook**: `useEmailWallet` — the primary hook for components
 * - **Types**: `UseEmailWalletReturn`, `EmailWalletContextValue`
 *
 * @example
 * ```tsx
 * import {
 *   EmailWalletProvider,
 *   useEmailWallet,
 *   type UseEmailWalletReturn,
 * } from '@callydus/email-wallet-react';
 * ```
 */

// ─── Provider ─────────────────────────────────────────────────────────────────
export { EmailWalletProvider } from './EmailWalletContext.js';
export type { EmailWalletProviderProps, EmailWalletContextValue } from './EmailWalletContext.js';

// ─── Hook ─────────────────────────────────────────────────────────────────────
export { useEmailWallet, useEmailWalletSafe } from './useEmailWallet.js';

// ─── Types ────────────────────────────────────────────────────────────────────
export type { UseEmailWalletReturn } from './types.js';
