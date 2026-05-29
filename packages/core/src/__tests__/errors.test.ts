/**
 * @file errors.test.ts
 * @module @callydus/email-wallet-core/__tests__
 *
 * Tests for all typed error classes in `errors.ts`.
 *
 * ## What is being tested
 *
 * - Every error class creates instances with correct `.name`, `.message`, `.code`
 * - `instanceof` checks work correctly (important for TypeScript class hierarchies)
 * - `cause` is preserved for debugging
 * - `NotImplementedError` generates a well-formed message from a method name
 */

import { describe, expect, it } from 'vitest';
import {
  AuthenticationError,
  ConfigurationError,
  EmailWalletError,
  NotImplementedError,
  SigningError,
  WalletNotFoundError,
} from '../errors.js';

describe('EmailWalletError (base class)', () => {
  it('creates an instance with correct name, message, and default code', () => {
    const err = new EmailWalletError('Something went wrong');
    expect(err.name).toBe('EmailWalletError');
    expect(err.message).toBe('Something went wrong');
    expect(err.code).toBe('EMAIL_WALLET_ERROR');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(EmailWalletError);
  });

  it('accepts a custom code', () => {
    const err = new EmailWalletError('Custom error', 'MY_CUSTOM_CODE');
    expect(err.code).toBe('MY_CUSTOM_CODE');
  });

  it('preserves cause for debugging', () => {
    const cause = new Error('underlying network failure');
    const err = new EmailWalletError('Wrapped error', 'EMAIL_WALLET_ERROR', cause);
    expect(err.cause).toBe(cause);
  });
});

describe('AuthenticationError', () => {
  it('has correct name and code', () => {
    const err = new AuthenticationError('Invalid OTP');
    expect(err.name).toBe('AuthenticationError');
    expect(err.message).toBe('Invalid OTP');
    expect(err.code).toBe('AUTHENTICATION_ERROR');
  });

  it('is instanceof EmailWalletError and Error', () => {
    const err = new AuthenticationError('test');
    expect(err).toBeInstanceOf(AuthenticationError);
    expect(err).toBeInstanceOf(EmailWalletError);
    expect(err).toBeInstanceOf(Error);
  });

  it('preserves cause', () => {
    const cause = new Error('provider error');
    const err = new AuthenticationError('Auth failed', cause);
    expect(err.cause).toBe(cause);
  });
});

describe('WalletNotFoundError', () => {
  it('has correct name and code', () => {
    const err = new WalletNotFoundError();
    expect(err.name).toBe('WalletNotFoundError');
    expect(err.code).toBe('WALLET_NOT_FOUND');
  });

  it('uses default message when none is provided', () => {
    const err = new WalletNotFoundError();
    expect(err.message).toBe('No embedded wallet found for this account.');
  });

  it('uses custom message when provided', () => {
    const err = new WalletNotFoundError('Wallet not configured on devnet');
    expect(err.message).toBe('Wallet not configured on devnet');
  });

  it('is instanceof EmailWalletError', () => {
    expect(new WalletNotFoundError()).toBeInstanceOf(EmailWalletError);
  });
});

describe('SigningError', () => {
  it('has correct name and code', () => {
    const err = new SigningError('Failed to sign transaction');
    expect(err.name).toBe('SigningError');
    expect(err.code).toBe('SIGNING_ERROR');
    expect(err.message).toBe('Failed to sign transaction');
  });

  it('is instanceof EmailWalletError', () => {
    expect(new SigningError('test')).toBeInstanceOf(EmailWalletError);
  });
});

describe('ConfigurationError', () => {
  it('has correct name and code', () => {
    const err = new ConfigurationError('publishableKey is required');
    expect(err.name).toBe('ConfigurationError');
    expect(err.code).toBe('CONFIGURATION_ERROR');
    expect(err.message).toBe('publishableKey is required');
  });

  it('is instanceof EmailWalletError', () => {
    expect(new ConfigurationError('test')).toBeInstanceOf(EmailWalletError);
  });
});

describe('NotImplementedError', () => {
  it('generates a well-formed message from a method name', () => {
    const err = new NotImplementedError('PrivyAdapter.requestOtp');
    expect(err.name).toBe('NotImplementedError');
    expect(err.code).toBe('NOT_IMPLEMENTED');
    expect(err.message).toContain('PrivyAdapter.requestOtp');
    expect(err.message).toContain('CONTRIBUTING.md');
  });

  it('is instanceof EmailWalletError', () => {
    expect(new NotImplementedError('SomeAdapter.someMethod')).toBeInstanceOf(EmailWalletError);
  });
});

describe('instanceof discrimination — multiple error types', () => {
  /**
   * This test verifies that error classes can be told apart with instanceof.
   * This is critical for consumer code that handles different failure cases
   * differently (e.g. retry on AuthenticationError, redirect on WalletNotFoundError).
   */
  it('can discriminate between different error subclasses', () => {
    const errors: EmailWalletError[] = [
      new AuthenticationError('auth'),
      new WalletNotFoundError(),
      new SigningError('sign'),
      new ConfigurationError('config'),
      new NotImplementedError('method'),
    ];

    for (const err of errors) {
      // All are EmailWalletError
      expect(err).toBeInstanceOf(EmailWalletError);
    }

    // Only the first is AuthenticationError
    expect(errors[0]).toBeInstanceOf(AuthenticationError);
    expect(errors[1]).not.toBeInstanceOf(AuthenticationError);

    // Only the second is WalletNotFoundError
    expect(errors[1]).toBeInstanceOf(WalletNotFoundError);
    expect(errors[0]).not.toBeInstanceOf(WalletNotFoundError);
  });
});
