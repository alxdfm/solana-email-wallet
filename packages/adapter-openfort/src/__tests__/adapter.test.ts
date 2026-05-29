/**
 * @file adapter.test.ts
 * @module @callydus/email-wallet-adapter-openfort/__tests__
 *
 * Tests for `OpenfortAdapter`.
 *
 * ## Testing strategy
 *
 * The Openfort SDK makes real HTTP calls to Openfort's servers. In tests,
 * we **mock the entire `@openfort/openfort-js` module** using Vitest's module
 * mocking. This gives us full control over what the SDK returns or throws.
 *
 * The tests verify:
 * 1. Constructor validates config and throws `ConfigurationError` on invalid input
 * 2. `requestOtp` validates email format
 * 3. `signIn` handles the full auth + wallet creation flow
 * 4. `signTransaction` serializes, signs, and reattaches the signature correctly
 * 5. Error mapping: SDK errors → typed `EmailWalletError` subclasses
 * 6. `isAuthenticated` returns `false` when state is not `READY`
 *
 * ## SDK version note
 *
 * This test mocks `@openfort/openfort-js@^0.9.x` API.
 * The real `EmbeddedState` is a numeric enum (READY = 4).
 */

import {
  AuthenticationError,
  ConfigurationError,
  SigningError,
  WalletNotFoundError,
} from '@callydus/email-wallet-core';
import { PublicKey, Transaction } from '@solana/web3.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock the Openfort SDK ────────────────────────────────────────────────────

const mockLogInWithEmailPassword = vi.fn();
const mockLogout = vi.fn();
const mockGetEmbeddedState = vi.fn();
const mockCreate = vi.fn();
const mockGet = vi.fn();
const mockSignMessage = vi.fn();
const mockExportPrivateKey = vi.fn();

vi.mock('@openfort/openfort-js', () => {
  /**
   * Mock `Openfort` class.
   *
   * Instantiated instead of the real Openfort when `new Openfort(config)` is called.
   * All methods are pre-configured `vi.fn()` spies.
   */
  class MockOpenfort {
    auth = {
      logInWithEmailPassword: mockLogInWithEmailPassword,
      logout: mockLogout,
    };
    embeddedWallet = {
      getEmbeddedState: mockGetEmbeddedState,
      create: mockCreate,
      get: mockGet,
      signMessage: mockSignMessage,
      exportPrivateKey: mockExportPrivateKey,
    };
  }

  /**
   * Mock `OpenfortConfiguration` class.
   * The real class wraps the publishableKey.
   */
  class MockOpenfortConfiguration {
    readonly publishableKey: string;
    constructor({ publishableKey }: { publishableKey: string }) {
      this.publishableKey = publishableKey;
    }
  }

  /**
   * Mock `ShieldConfiguration` class.
   * The real class wraps the shieldPublishableKey.
   */
  class MockShieldConfiguration {
    readonly shieldPublishableKey: string;
    constructor({ shieldPublishableKey }: { shieldPublishableKey: string }) {
      this.shieldPublishableKey = shieldPublishableKey;
    }
  }

  // EmbeddedState is a numeric enum in v0.9.x:
  // NONE=0, UNAUTHENTICATED=1, EMBEDDED_SIGNER_NOT_CONFIGURED=2, CREATING_ACCOUNT=3, READY=4
  const EmbeddedState = {
    NONE: 0,
    UNAUTHENTICATED: 1,
    EMBEDDED_SIGNER_NOT_CONFIGURED: 2,
    CREATING_ACCOUNT: 3,
    READY: 4,
  };

  return {
    Openfort: MockOpenfort,
    OpenfortConfiguration: MockOpenfortConfiguration,
    ShieldConfiguration: MockShieldConfiguration,
    AccountTypeEnum: { EOA: 'EOA' },
    ChainTypeEnum: { SVM: 'SVM' },
    RecoveryMethod: { AUTOMATIC: 'automatic', PASSWORD: 'password' },
    EmbeddedState,
  };
});

// ─── Import adapter AFTER mocking ────────────────────────────────────────────

import { OpenfortAdapter } from '../adapter.js';

// ─── Test fixtures ────────────────────────────────────────────────────────────

const VALID_CONFIG = {
  publishableKey: 'pk_test_abc123',
  shieldPublishableKey: 'shpk_test_xyz789',
};

const MOCK_EMAIL = 'user@example.com';
const MOCK_OTP = '123456';
const MOCK_ADDRESS_BASE58 = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';

// EmbeddedState values as used in the mock (numeric)
const STATE_READY = 4;
const STATE_NOT_CONFIGURED = 2;
const STATE_UNAUTHENTICATED = 1;
const STATE_NONE = 0;

// ─── Constructor tests ────────────────────────────────────────────────────────

describe('OpenfortAdapter constructor', () => {
  it('creates adapter with valid config', () => {
    expect(() => new OpenfortAdapter(VALID_CONFIG)).not.toThrow();
  });

  it('throws ConfigurationError when publishableKey is missing', () => {
    expect(() => new OpenfortAdapter({ ...VALID_CONFIG, publishableKey: '' })).toThrow(
      ConfigurationError,
    );
  });

  it('throws ConfigurationError when publishableKey has wrong prefix', () => {
    expect(
      () => new OpenfortAdapter({ ...VALID_CONFIG, publishableKey: 'sk_test_abc123' }),
    ).toThrow(ConfigurationError);
  });

  it('throws ConfigurationError when shieldPublishableKey has wrong prefix', () => {
    expect(
      () => new OpenfortAdapter({ ...VALID_CONFIG, shieldPublishableKey: 'pk_shield_wrong' }),
    ).toThrow(ConfigurationError);
  });
});

// ─── requestOtp tests ─────────────────────────────────────────────────────────

describe('OpenfortAdapter.requestOtp', () => {
  let adapter: OpenfortAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new OpenfortAdapter(VALID_CONFIG);
  });

  it('resolves without error for a valid email', async () => {
    await expect(adapter.requestOtp(MOCK_EMAIL)).resolves.toBeUndefined();
  });

  it('throws AuthenticationError for an invalid email format', async () => {
    await expect(adapter.requestOtp('not-an-email')).rejects.toThrow(AuthenticationError);
  });

  it('throws AuthenticationError for an empty string', async () => {
    await expect(adapter.requestOtp('')).rejects.toThrow(AuthenticationError);
  });
});

// ─── signIn tests ─────────────────────────────────────────────────────────────

describe('OpenfortAdapter.signIn', () => {
  let adapter: OpenfortAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new OpenfortAdapter(VALID_CONFIG);
    mockLogInWithEmailPassword.mockResolvedValue({});
    mockGetEmbeddedState.mockResolvedValue(STATE_READY);
    mockGet.mockResolvedValue({ address: MOCK_ADDRESS_BASE58 });
  });

  it('returns WalletAccount on success (wallet already exists)', async () => {
    const account = await adapter.signIn(MOCK_EMAIL, MOCK_OTP);
    expect(account.email).toBe(MOCK_EMAIL);
    expect(account.address).toBeInstanceOf(PublicKey);
    expect(account.address.toBase58()).toBe(MOCK_ADDRESS_BASE58);
  });

  it('creates wallet when state is EMBEDDED_SIGNER_NOT_CONFIGURED', async () => {
    mockGetEmbeddedState.mockResolvedValue(STATE_NOT_CONFIGURED);
    mockCreate.mockResolvedValue({});

    const account = await adapter.signIn(MOCK_EMAIL, MOCK_OTP);
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        accountType: 'EOA',
        chainType: 'SVM',
      }),
    );
    expect(account.email).toBe(MOCK_EMAIL);
  });

  it('does not call create when state is READY', async () => {
    mockGetEmbeddedState.mockResolvedValue(STATE_READY);
    await adapter.signIn(MOCK_EMAIL, MOCK_OTP);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('throws AuthenticationError when logInWithEmailPassword fails', async () => {
    mockLogInWithEmailPassword.mockRejectedValueOnce(new Error('Invalid credentials'));
    await expect(adapter.signIn(MOCK_EMAIL, MOCK_OTP)).rejects.toThrow(AuthenticationError);
  });

  it('throws WalletNotFoundError when state is unexpected (NONE)', async () => {
    mockGetEmbeddedState.mockResolvedValue(STATE_NONE);
    await expect(adapter.signIn(MOCK_EMAIL, MOCK_OTP)).rejects.toThrow(WalletNotFoundError);
  });

  it('throws WalletNotFoundError when get() returns object with no address', async () => {
    mockGetEmbeddedState.mockResolvedValue(STATE_READY);
    mockGet.mockResolvedValue({ address: null });
    await expect(adapter.signIn(MOCK_EMAIL, MOCK_OTP)).rejects.toThrow(WalletNotFoundError);
  });
});

// ─── signOut tests ────────────────────────────────────────────────────────────

describe('OpenfortAdapter.signOut', () => {
  let adapter: OpenfortAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new OpenfortAdapter(VALID_CONFIG);
  });

  it('calls openfort.auth.logout', async () => {
    mockLogout.mockResolvedValue(undefined);
    await adapter.signOut();
    expect(mockLogout).toHaveBeenCalledOnce();
  });

  it('throws AuthenticationError when logout fails', async () => {
    mockLogout.mockRejectedValueOnce(new Error('Network error'));
    await expect(adapter.signOut()).rejects.toThrow(AuthenticationError);
  });
});

// ─── isAuthenticated tests ────────────────────────────────────────────────────

describe('OpenfortAdapter.isAuthenticated', () => {
  let adapter: OpenfortAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new OpenfortAdapter(VALID_CONFIG);
  });

  it('returns true when state is READY (4)', async () => {
    mockGetEmbeddedState.mockResolvedValue(STATE_READY);
    expect(await adapter.isAuthenticated()).toBe(true);
  });

  it('returns false when state is UNAUTHENTICATED (1)', async () => {
    mockGetEmbeddedState.mockResolvedValue(STATE_UNAUTHENTICATED);
    expect(await adapter.isAuthenticated()).toBe(false);
  });

  it('returns false (never throws) when getEmbeddedState throws', async () => {
    mockGetEmbeddedState.mockRejectedValueOnce(new Error('SDK error'));
    expect(await adapter.isAuthenticated()).toBe(false);
  });
});

// ─── getAddress tests ─────────────────────────────────────────────────────────

describe('OpenfortAdapter.getAddress', () => {
  let adapter: OpenfortAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new OpenfortAdapter(VALID_CONFIG);
  });

  it('returns PublicKey from wallet address', async () => {
    mockGet.mockResolvedValue({ address: MOCK_ADDRESS_BASE58 });
    const address = await adapter.getAddress();
    expect(address).toBeInstanceOf(PublicKey);
    expect(address.toBase58()).toBe(MOCK_ADDRESS_BASE58);
  });

  it('throws WalletNotFoundError when get() returns object with no address', async () => {
    mockGet.mockResolvedValue({ address: null });
    await expect(adapter.getAddress()).rejects.toThrow(WalletNotFoundError);
  });

  it('throws WalletNotFoundError when get() rejects', async () => {
    mockGet.mockRejectedValueOnce(new Error('Not authenticated'));
    await expect(adapter.getAddress()).rejects.toThrow(WalletNotFoundError);
  });
});

// ─── signTransaction tests ────────────────────────────────────────────────────

describe('OpenfortAdapter.signTransaction', () => {
  let adapter: OpenfortAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new OpenfortAdapter(VALID_CONFIG);
    mockGetEmbeddedState.mockResolvedValue(STATE_READY);
    mockGet.mockResolvedValue({ address: MOCK_ADDRESS_BASE58 });
  });

  it('signs a legacy Transaction and returns it', async () => {
    const fakeSignatureBytes = new Uint8Array(64).fill(1);
    const { default: bs58 } = await import('bs58');
    const fakeSignatureBase58 = bs58.encode(fakeSignatureBytes);

    mockSignMessage.mockResolvedValue(fakeSignatureBase58);

    const tx = new Transaction();
    tx.recentBlockhash = '11111111111111111111111111111111';
    tx.feePayer = new PublicKey(MOCK_ADDRESS_BASE58);

    const result = await adapter.signTransaction(tx);
    expect(result).toBe(tx);
    expect(mockSignMessage).toHaveBeenCalledWith(expect.any(Uint8Array), { hashMessage: false });
  });

  it('throws WalletNotFoundError when not authenticated', async () => {
    mockGetEmbeddedState.mockResolvedValue(STATE_UNAUTHENTICATED);
    const tx = new Transaction();
    await expect(adapter.signTransaction(tx)).rejects.toThrow(WalletNotFoundError);
  });

  it('throws SigningError when signMessage fails', async () => {
    mockSignMessage.mockRejectedValueOnce(new Error('Signer rejected'));

    const tx = new Transaction();
    tx.recentBlockhash = '11111111111111111111111111111111';
    tx.feePayer = new PublicKey(MOCK_ADDRESS_BASE58);

    await expect(adapter.signTransaction(tx)).rejects.toThrow(SigningError);
  });
});

// ─── exportPrivateKey tests ───────────────────────────────────────────────────

describe('OpenfortAdapter.exportPrivateKey', () => {
  let adapter: OpenfortAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new OpenfortAdapter(VALID_CONFIG);
    mockGetEmbeddedState.mockResolvedValue(STATE_READY);
  });

  it('returns the private key string', async () => {
    mockExportPrivateKey.mockResolvedValue('5JKf8BZg...privateKey');
    const key = await adapter.exportPrivateKey();
    expect(key).toBe('5JKf8BZg...privateKey');
    expect(mockExportPrivateKey).toHaveBeenCalledOnce();
  });

  it('throws WalletNotFoundError when not authenticated', async () => {
    mockGetEmbeddedState.mockResolvedValue(STATE_UNAUTHENTICATED);
    await expect(adapter.exportPrivateKey()).rejects.toThrow(WalletNotFoundError);
  });

  it('throws SigningError when exportPrivateKey fails', async () => {
    mockExportPrivateKey.mockRejectedValueOnce(new Error('Export not allowed'));
    await expect(adapter.exportPrivateKey()).rejects.toThrow(SigningError);
  });
});

// ─── signAllTransactions tests ────────────────────────────────────────────────

describe('OpenfortAdapter.signAllTransactions', () => {
  let adapter: OpenfortAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new OpenfortAdapter(VALID_CONFIG);
    mockGetEmbeddedState.mockResolvedValue(STATE_READY);
    mockGet.mockResolvedValue({ address: MOCK_ADDRESS_BASE58 });
  });

  it('signs all transactions in the batch', async () => {
    const fakeSignatureBytes = new Uint8Array(64).fill(2);
    const { default: bs58 } = await import('bs58');
    mockSignMessage.mockResolvedValue(bs58.encode(fakeSignatureBytes));

    const tx1 = new Transaction();
    tx1.recentBlockhash = '11111111111111111111111111111111';
    tx1.feePayer = new PublicKey(MOCK_ADDRESS_BASE58);

    const tx2 = new Transaction();
    tx2.recentBlockhash = '11111111111111111111111111111111';
    tx2.feePayer = new PublicKey(MOCK_ADDRESS_BASE58);

    const results = await adapter.signAllTransactions([tx1, tx2]);
    expect(results).toHaveLength(2);
    // signMessage is called once per signTransaction call (2 txs) + once per getAddress
    expect(mockSignMessage).toHaveBeenCalledTimes(2);
  });
});
