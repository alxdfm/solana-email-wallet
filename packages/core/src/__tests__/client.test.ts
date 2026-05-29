/**
 * @file client.test.ts
 * @module @callydus/email-wallet-core/__tests__
 *
 * Tests for `EmailWalletClient` and `createEmailWalletClient`.
 *
 * ## Testing strategy
 *
 * The client delegates all work to the injected adapter. Tests use a
 * **mock adapter** that controls exactly what succeeds and what fails.
 * This way we test:
 * 1. That the client correctly calls adapter methods
 * 2. That the client wraps success values in `Result<T>`
 * 3. That the client catches adapter errors and wraps them in `Result<T>`
 * 4. That `isAuthenticated` never throws (returns false on error)
 * 5. That the constructor validates config and throws `ConfigurationError`
 *
 * We never test Openfort, Privy or any provider here — that is the job of
 * the adapter packages.
 */

import { PublicKey, Transaction, type VersionedTransaction } from '@solana/web3.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailWalletClient, createEmailWalletClient } from '../client.js';
import { AuthenticationError, ConfigurationError, WalletNotFoundError } from '../errors.js';
import type { EmailWalletAdapter, WalletAccount } from '../types.js';

// ─── Mock adapter factory ─────────────────────────────────────────────────────

/**
 * Creates a mock `EmailWalletAdapter` using Vitest's `vi.fn()`.
 *
 * Every method is a spy — we can assert how many times it was called,
 * with what arguments, and make it return specific values or throw.
 *
 * The default implementation resolves successfully with sensible values.
 * Override individual methods per test with `.mockRejectedValueOnce()` etc.
 */
function createMockAdapter(): EmailWalletAdapter {
  const mockAddress = new PublicKey('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
  const mockAccount: WalletAccount = {
    address: mockAddress,
    email: 'user@example.com',
  };

  return {
    requestOtp: vi.fn().mockResolvedValue(undefined),
    signIn: vi.fn().mockResolvedValue(mockAccount),
    signOut: vi.fn().mockResolvedValue(undefined),
    signTransaction: vi.fn().mockImplementation((tx: unknown) => Promise.resolve(tx)),
    signAllTransactions: vi.fn().mockImplementation((txs: unknown[]) => Promise.resolve(txs)),
    exportPrivateKey: vi.fn().mockResolvedValue('5JKf8BZg...privateKeyBase58'),
    getAddress: vi.fn().mockResolvedValue(mockAddress),
    isAuthenticated: vi.fn().mockResolvedValue(true),
  };
}

// ─── Test fixtures ────────────────────────────────────────────────────────────

const MOCK_EMAIL = 'user@example.com';
const MOCK_OTP = '123456';
const MOCK_ADDRESS = new PublicKey('7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU');
const MOCK_ACCOUNT: WalletAccount = { address: MOCK_ADDRESS, email: MOCK_EMAIL };

// ─── Constructor / factory ────────────────────────────────────────────────────

describe('createEmailWalletClient / constructor', () => {
  it('creates a client with valid config', () => {
    const adapter = createMockAdapter();
    const client = createEmailWalletClient({ adapter, network: 'devnet' });
    expect(client).toBeInstanceOf(EmailWalletClient);
    expect(client.network).toBe('devnet');
  });

  it('throws ConfigurationError for invalid network', () => {
    const adapter = createMockAdapter();
    expect(() =>
      // @ts-expect-error — intentionally passing invalid value
      createEmailWalletClient({ adapter, network: 'invalid-net' }),
    ).toThrow(ConfigurationError);
  });

  it('throws ConfigurationError when adapter is null', () => {
    expect(() =>
      // @ts-expect-error — intentionally passing null
      createEmailWalletClient({ adapter: null, network: 'devnet' }),
    ).toThrow(ConfigurationError);
  });

  it('exposes the configured network', () => {
    const adapter = createMockAdapter();
    const client = createEmailWalletClient({ adapter, network: 'mainnet-beta' });
    expect(client.network).toBe('mainnet-beta');
  });
});

// ─── requestOtp ───────────────────────────────────────────────────────────────

describe('EmailWalletClient.requestOtp', () => {
  let adapter: EmailWalletAdapter;
  let client: EmailWalletClient;

  beforeEach(() => {
    adapter = createMockAdapter();
    client = createEmailWalletClient({ adapter, network: 'devnet' });
  });

  it('returns success:true when adapter resolves', async () => {
    const result = await client.requestOtp(MOCK_EMAIL);
    expect(result.success).toBe(true);
    expect(adapter.requestOtp).toHaveBeenCalledOnce();
    expect(adapter.requestOtp).toHaveBeenCalledWith(MOCK_EMAIL);
  });

  it('returns success:false when adapter throws AuthenticationError', async () => {
    const error = new AuthenticationError('Invalid email address');
    vi.mocked(adapter.requestOtp).mockRejectedValueOnce(error);

    const result = await client.requestOtp(MOCK_EMAIL);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe(error);
      expect(result.error).toBeInstanceOf(AuthenticationError);
    }
  });

  it('returns success:false when adapter throws non-Error value', async () => {
    vi.mocked(adapter.requestOtp).mockRejectedValueOnce('network timeout');

    const result = await client.requestOtp(MOCK_EMAIL);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toContain('network timeout');
    }
  });
});

// ─── signIn ───────────────────────────────────────────────────────────────────

describe('EmailWalletClient.signIn', () => {
  let adapter: EmailWalletAdapter;
  let client: EmailWalletClient;

  beforeEach(() => {
    adapter = createMockAdapter();
    client = createEmailWalletClient({ adapter, network: 'devnet' });
  });

  it('returns success:true with WalletAccount on valid OTP', async () => {
    const result = await client.signIn(MOCK_EMAIL, MOCK_OTP);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(MOCK_ACCOUNT);
    }
    expect(adapter.signIn).toHaveBeenCalledWith(MOCK_EMAIL, MOCK_OTP);
  });

  it('returns success:false when OTP is wrong', async () => {
    const error = new AuthenticationError('OTP code has expired');
    vi.mocked(adapter.signIn).mockRejectedValueOnce(error);

    const result = await client.signIn(MOCK_EMAIL, '000000');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe('OTP code has expired');
    }
  });

  it('returns success:false when wallet cannot be created', async () => {
    const error = new WalletNotFoundError();
    vi.mocked(adapter.signIn).mockRejectedValueOnce(error);

    const result = await client.signIn(MOCK_EMAIL, MOCK_OTP);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(WalletNotFoundError);
    }
  });
});

// ─── signOut ──────────────────────────────────────────────────────────────────

describe('EmailWalletClient.signOut', () => {
  let adapter: EmailWalletAdapter;
  let client: EmailWalletClient;

  beforeEach(() => {
    adapter = createMockAdapter();
    client = createEmailWalletClient({ adapter, network: 'devnet' });
  });

  it('returns success:true when adapter resolves', async () => {
    const result = await client.signOut();
    expect(result.success).toBe(true);
    expect(adapter.signOut).toHaveBeenCalledOnce();
  });

  it('returns success:false when adapter throws', async () => {
    vi.mocked(adapter.signOut).mockRejectedValueOnce(new Error('Session already invalidated'));

    const result = await client.signOut();
    expect(result.success).toBe(false);
  });
});

// ─── isAuthenticated ──────────────────────────────────────────────────────────

describe('EmailWalletClient.isAuthenticated', () => {
  let adapter: EmailWalletAdapter;
  let client: EmailWalletClient;

  beforeEach(() => {
    adapter = createMockAdapter();
    client = createEmailWalletClient({ adapter, network: 'devnet' });
  });

  it('returns true when adapter returns true', async () => {
    vi.mocked(adapter.isAuthenticated).mockResolvedValueOnce(true);
    const result = await client.isAuthenticated();
    expect(result).toBe(true);
  });

  it('returns false when adapter returns false', async () => {
    vi.mocked(adapter.isAuthenticated).mockResolvedValueOnce(false);
    const result = await client.isAuthenticated();
    expect(result).toBe(false);
  });

  it('returns false (never throws) when adapter throws', async () => {
    vi.mocked(adapter.isAuthenticated).mockRejectedValueOnce(new Error('unexpected'));
    const result = await client.isAuthenticated();
    expect(result).toBe(false);
  });
});

// ─── getAddress ───────────────────────────────────────────────────────────────

describe('EmailWalletClient.getAddress', () => {
  let adapter: EmailWalletAdapter;
  let client: EmailWalletClient;

  beforeEach(() => {
    adapter = createMockAdapter();
    client = createEmailWalletClient({ adapter, network: 'devnet' });
  });

  it('returns success:true with PublicKey', async () => {
    const result = await client.getAddress();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBeInstanceOf(PublicKey);
      expect(result.data.toBase58()).toBe(MOCK_ADDRESS.toBase58());
    }
  });

  it('returns success:false when not authenticated', async () => {
    vi.mocked(adapter.getAddress).mockRejectedValueOnce(new WalletNotFoundError());
    const result = await client.getAddress();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(WalletNotFoundError);
    }
  });
});

// ─── signTransaction ──────────────────────────────────────────────────────────

describe('EmailWalletClient.signTransaction', () => {
  let adapter: EmailWalletAdapter;
  let client: EmailWalletClient;

  beforeEach(() => {
    adapter = createMockAdapter();
    client = createEmailWalletClient({ adapter, network: 'devnet' });
  });

  it('returns success:true with signed transaction', async () => {
    const tx = new Transaction();
    const result = await client.signTransaction(tx);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(tx);
    }
    expect(adapter.signTransaction).toHaveBeenCalledWith(tx);
  });

  it('returns success:false when signing fails', async () => {
    const tx = new Transaction();
    vi.mocked(adapter.signTransaction).mockRejectedValueOnce(new Error('User rejected signing'));

    const result = await client.signTransaction(tx);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.message).toBe('User rejected signing');
    }
  });
});

// ─── signAllTransactions ──────────────────────────────────────────────────────

describe('EmailWalletClient.signAllTransactions', () => {
  let adapter: EmailWalletAdapter;
  let client: EmailWalletClient;

  beforeEach(() => {
    adapter = createMockAdapter();
    client = createEmailWalletClient({ adapter, network: 'devnet' });
  });

  it('returns success:true with all transactions signed', async () => {
    const txs = [new Transaction(), new Transaction()];
    const result = await client.signAllTransactions(txs);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toBe(txs[0]);
    }
    expect(adapter.signAllTransactions).toHaveBeenCalledWith(txs);
  });

  it('returns success:false when batch signing fails', async () => {
    const txs = [new Transaction()];
    vi.mocked(adapter.signAllTransactions).mockRejectedValueOnce(
      new Error('Batch signing rejected'),
    );

    const result = await client.signAllTransactions(txs);
    expect(result.success).toBe(false);
  });
});

// ─── exportPrivateKey ─────────────────────────────────────────────────────────

describe('EmailWalletClient.exportPrivateKey', () => {
  let adapter: EmailWalletAdapter;
  let client: EmailWalletClient;

  beforeEach(() => {
    adapter = createMockAdapter();
    client = createEmailWalletClient({ adapter, network: 'devnet' });
  });

  it('returns success:true with Base58 private key string', async () => {
    const result = await client.exportPrivateKey();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data).toBe('string');
      expect(result.data.length).toBeGreaterThan(0);
    }
  });

  it('returns success:false when not authenticated', async () => {
    vi.mocked(adapter.exportPrivateKey).mockRejectedValueOnce(new WalletNotFoundError());
    const result = await client.exportPrivateKey();
    expect(result.success).toBe(false);
  });
});

// ─── VersionedTransaction support ────────────────────────────────────────────

describe('VersionedTransaction support', () => {
  let adapter: EmailWalletAdapter;
  let client: EmailWalletClient;

  beforeEach(() => {
    adapter = createMockAdapter();
    client = createEmailWalletClient({ adapter, network: 'devnet' });
  });

  it('preserves VersionedTransaction type through signTransaction', async () => {
    // Create a minimal VersionedTransaction for type checking
    const mockVersionedTx = {
      message: { serialize: () => new Uint8Array([1, 2, 3]) },
      signatures: [],
      addSignature: vi.fn(),
    } as unknown as VersionedTransaction;

    vi.mocked(adapter.signTransaction).mockResolvedValueOnce(mockVersionedTx);

    const result = await client.signTransaction(mockVersionedTx);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(mockVersionedTx);
    }
  });
});
