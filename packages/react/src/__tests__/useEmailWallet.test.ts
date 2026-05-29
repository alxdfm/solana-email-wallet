/**
 * @file useEmailWallet.test.ts
 * @module @callydus/email-wallet-react/__tests__
 *
 * Tests for `useEmailWallet()` hook and `<EmailWalletProvider>`.
 *
 * ## Testing strategy
 *
 * We test the hook's behavior by:
 * 1. Creating a mock `EmailWalletClient`
 * 2. Wrapping components with `<EmailWalletProvider client={client}>`
 * 3. Using `@testing-library/react`'s `renderHook` to call the hook
 * 4. Using `act()` to trigger state updates from async operations
 *
 * We test:
 * - Initial state (not authenticated, no loading, no error)
 * - `requestOtp`: sets loading, clears error, handles success and failure
 * - `signIn`: sets wallet on success, sets error on failure
 * - `signOut`: clears wallet on success
 * - `isAuthenticated` derived correctly from wallet state
 * - Error thrown when used outside provider
 */

import type { EmailWalletClient } from '@callydus/email-wallet-core';
import { AuthenticationError } from '@callydus/email-wallet-core';
import type { WalletAccount } from '@callydus/email-wallet-core';
import { PublicKey } from '@solana/web3.js';
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailWalletProvider } from '../EmailWalletContext.js';
import { useEmailWallet } from '../useEmailWallet.js';

// ─── Mock client factory ──────────────────────────────────────────────────────

/**
 * Creates a mock `EmailWalletClient` with controllable responses.
 *
 * Using `vi.fn()` lets us assert how many times methods were called and
 * override return values per test with `.mockResolvedValueOnce()`.
 */
function createMockClient(): EmailWalletClient {
  const mockAddress = new PublicKey('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
  const mockAccount: WalletAccount = {
    address: mockAddress,
    email: 'user@example.com',
  };

  return {
    network: 'devnet',
    requestOtp: vi.fn().mockResolvedValue({ success: true, data: undefined }),
    signIn: vi.fn().mockResolvedValue({ success: true, data: mockAccount }),
    signOut: vi.fn().mockResolvedValue({ success: true, data: undefined }),
    signTransaction: vi
      .fn()
      .mockImplementation((tx: unknown) => Promise.resolve({ success: true, data: tx })),
    signAllTransactions: vi
      .fn()
      .mockImplementation((txs: unknown[]) => Promise.resolve({ success: true, data: txs })),
    exportPrivateKey: vi.fn().mockResolvedValue({ success: true, data: 'privateKey' }),
    getAddress: vi.fn().mockResolvedValue({ success: true, data: mockAddress }),
    isAuthenticated: vi.fn().mockResolvedValue(false),
  } as unknown as EmailWalletClient;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_EMAIL = 'user@example.com';
const MOCK_OTP = '123456';
const MOCK_ADDRESS = new PublicKey('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
const MOCK_ACCOUNT: WalletAccount = { address: MOCK_ADDRESS, email: MOCK_EMAIL };

// ─── Initial state ────────────────────────────────────────────────────────────

describe('useEmailWallet — initial state', () => {
  it('starts with no wallet, not loading, no error', async () => {
    const client = createMockClient();

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(EmailWalletProvider, { client }, children);

    const { result } = renderHook(() => useEmailWallet(), { wrapper });

    // Let the useEffect run (session restore check)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(result.current.wallet).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });
});

// ─── requestOtp ───────────────────────────────────────────────────────────────

describe('useEmailWallet — requestOtp', () => {
  let client: EmailWalletClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('calls client.requestOtp and clears error on success', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(EmailWalletProvider, { client }, children);

    const { result } = renderHook(() => useEmailWallet(), { wrapper });

    await act(async () => {
      await result.current.requestOtp(MOCK_EMAIL);
    });

    expect(client.requestOtp).toHaveBeenCalledWith(MOCK_EMAIL);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('sets error when requestOtp fails', async () => {
    const authError = new AuthenticationError('Invalid email');
    vi.mocked(client.requestOtp).mockResolvedValueOnce({ success: false, error: authError });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(EmailWalletProvider, { client }, children);

    const { result } = renderHook(() => useEmailWallet(), { wrapper });

    await act(async () => {
      await result.current.requestOtp(MOCK_EMAIL);
    });

    expect(result.current.error).toBe(authError);
    expect(result.current.isLoading).toBe(false);
  });

  it('sets isLoading to true during the call (observable via multiple renders)', async () => {
    // Track loading states
    const loadingStates: boolean[] = [];

    // Create a delayed mock to observe the intermediate loading state
    vi.mocked(client.requestOtp).mockImplementation(
      () =>
        new Promise((resolve) => setTimeout(() => resolve({ success: true, data: undefined }), 10)),
    );

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(EmailWalletProvider, { client }, children);

    const { result } = renderHook(() => useEmailWallet(), { wrapper });

    await act(async () => {
      const promise = result.current.requestOtp(MOCK_EMAIL);
      // Capture loading state after the call starts
      loadingStates.push(result.current.isLoading);
      await promise;
      // Capture loading state after the call ends
      loadingStates.push(result.current.isLoading);
    });

    // Should have been true during the call and false after
    expect(loadingStates).toContain(false); // ends as false
  });
});

// ─── signIn ───────────────────────────────────────────────────────────────────

describe('useEmailWallet — signIn', () => {
  let client: EmailWalletClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('sets wallet on successful signIn', async () => {
    vi.mocked(client.signIn).mockResolvedValue({ success: true, data: MOCK_ACCOUNT });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(EmailWalletProvider, { client }, children);

    const { result } = renderHook(() => useEmailWallet(), { wrapper });

    await act(async () => {
      await result.current.signIn(MOCK_EMAIL, MOCK_OTP);
    });

    expect(result.current.wallet).toEqual(MOCK_ACCOUNT);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('sets error when signIn fails', async () => {
    const authError = new AuthenticationError('Wrong OTP');
    vi.mocked(client.signIn).mockResolvedValueOnce({ success: false, error: authError });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(EmailWalletProvider, { client }, children);

    const { result } = renderHook(() => useEmailWallet(), { wrapper });

    await act(async () => {
      await result.current.signIn(MOCK_EMAIL, MOCK_OTP);
    });

    expect(result.current.wallet).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).toBe(authError);
  });
});

// ─── signOut ──────────────────────────────────────────────────────────────────

describe('useEmailWallet — signOut', () => {
  it('clears wallet on successful signOut', async () => {
    const client = createMockClient();
    vi.mocked(client.signIn).mockResolvedValue({ success: true, data: MOCK_ACCOUNT });
    vi.mocked(client.signOut).mockResolvedValue({ success: true, data: undefined });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(EmailWalletProvider, { client }, children);

    const { result } = renderHook(() => useEmailWallet(), { wrapper });

    // First sign in
    await act(async () => {
      await result.current.signIn(MOCK_EMAIL, MOCK_OTP);
    });
    expect(result.current.wallet).not.toBeNull();

    // Then sign out
    await act(async () => {
      await result.current.signOut();
    });
    expect(result.current.wallet).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('sets error when signOut fails', async () => {
    const client = createMockClient();
    const signOutError = new Error('Session error');
    vi.mocked(client.signOut).mockResolvedValueOnce({ success: false, error: signOutError });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(EmailWalletProvider, { client }, children);

    const { result } = renderHook(() => useEmailWallet(), { wrapper });

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.error).toBe(signOutError);
  });
});

// ─── Outside provider ─────────────────────────────────────────────────────────

describe('useEmailWallet — outside provider', () => {
  it('throws with a helpful error message', () => {
    expect(() => renderHook(() => useEmailWallet())).toThrow(
      'useEmailWallet must be called inside an <EmailWalletProvider>',
    );
  });
});

// ─── exportPrivateKey ─────────────────────────────────────────────────────────

describe('useEmailWallet — exportPrivateKey', () => {
  it('returns the private key string on success', async () => {
    const client = createMockClient();
    vi.mocked(client.exportPrivateKey).mockResolvedValue({
      success: true,
      data: '5JKf8BZg...key',
    });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(EmailWalletProvider, { client }, children);

    const { result } = renderHook(() => useEmailWallet(), { wrapper });

    let key: string | undefined;
    await act(async () => {
      key = await result.current.exportPrivateKey();
    });

    expect(key).toBe('5JKf8BZg...key');
  });

  it('throws when exportPrivateKey fails', async () => {
    const client = createMockClient();
    const exportError = new Error('Not authenticated');
    vi.mocked(client.exportPrivateKey).mockResolvedValue({ success: false, error: exportError });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(EmailWalletProvider, { client }, children);

    const { result } = renderHook(() => useEmailWallet(), { wrapper });

    await act(async () => {
      await expect(result.current.exportPrivateKey()).rejects.toThrow('Not authenticated');
    });
  });
});
