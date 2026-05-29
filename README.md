# solana-email-wallet

[![CI](https://github.com/callydus/solana-email-wallet/actions/workflows/ci.yml/badge.svg)](https://github.com/callydus/solana-email-wallet/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@callydus/email-wallet-core)](https://www.npmjs.com/package/@callydus/email-wallet-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)

Email-based Solana wallet authentication with a pluggable adapter architecture.

---

## Why this library?

The standard [Solana Wallet Adapter](https://github.com/anza-xyz/wallet-adapter) requires users to
install a browser extension (Phantom, Backpack, Solflare…) and manage a seed phrase.
That works great for experienced crypto users — but it's a hard barrier for everyone else.

`solana-email-wallet` lets users authenticate with just their email address:

1. They enter their email → receive a 6-digit code
2. They enter the code → a Solana wallet is created (or recovered) automatically
3. They sign transactions with a button click — no seed phrase, no extension

The private key is managed by a custodial provider inside a secure enclave.
The user never sees or touches it. This removes the single biggest adoption blocker
for web3 apps targeting mainstream audiences.

**When NOT to use this library:** if your users are already crypto-native and have
wallets, use the standard Wallet Adapter instead. This library targets the onboarding
of new users who have no existing wallet.

---

## Packages

| Package | Description | Status |
|---|---|---|
| [`@callydus/email-wallet-core`](./packages/core) | Core abstractions: `EmailWalletAdapter`, `EmailWalletClient`, `Result<T>`, typed errors | Stable |
| [`@callydus/email-wallet-adapter-openfort`](./packages/adapter-openfort) | Openfort SDK adapter — full implementation | Stable |
| [`@callydus/email-wallet-adapter-privy`](./packages/adapter-privy) | Privy adapter stub | Not implemented |
| [`@callydus/email-wallet-adapter-turnkey`](./packages/adapter-turnkey) | Turnkey adapter stub | Not implemented |
| [`@callydus/email-wallet-react`](./packages/react) | React hooks and Context Provider | Stable |

---

## Quick start

### Install

```bash
pnpm add @callydus/email-wallet-core @callydus/email-wallet-adapter-openfort
# For React apps:
pnpm add @callydus/email-wallet-react
```

### Vanilla TypeScript

```ts
import { createEmailWalletClient } from '@callydus/email-wallet-core';
import { OpenfortAdapter } from '@callydus/email-wallet-adapter-openfort';

// 1. Create the client once (module scope, not inside components)
const client = createEmailWalletClient({
  adapter: new OpenfortAdapter({
    publishableKey: process.env.OPENFORT_PUBLISHABLE_KEY!,
    shieldPublishableKey: process.env.OPENFORT_SHIELD_KEY!,
  }),
  network: 'devnet', // use 'mainnet-beta' in production
});

// 2. Step 1 — send OTP
const step1 = await client.requestOtp('user@example.com');
if (!step1.success) {
  console.error('Could not send OTP:', step1.error.message);
  return;
}
console.log('OTP sent! Check your inbox.');

// 3. Step 2 — verify OTP (user enters the code from their email)
const step2 = await client.signIn('user@example.com', '123456');
if (!step2.success) {
  console.error('Sign-in failed:', step2.error.message);
  return;
}

const { address, email } = step2.data;
console.log('Signed in!', address.toBase58(), email);

// 4. Sign a transaction
const txResult = await client.signTransaction(myTransaction);
if (txResult.success) {
  const txId = await connection.sendRawTransaction(txResult.data.serialize());
  console.log('Transaction sent:', txId);
}

// 5. Sign out
await client.signOut();
```

### React

```tsx
// app/layout.tsx (Next.js) or App.tsx (Vite)
import { EmailWalletProvider } from '@callydus/email-wallet-react';
import { createEmailWalletClient } from '@callydus/email-wallet-core';
import { OpenfortAdapter } from '@callydus/email-wallet-adapter-openfort';

const client = createEmailWalletClient({
  adapter: new OpenfortAdapter({
    publishableKey: process.env.NEXT_PUBLIC_OPENFORT_KEY!,
    shieldPublishableKey: process.env.NEXT_PUBLIC_OPENFORT_SHIELD_KEY!,
  }),
  network: 'devnet',
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <EmailWalletProvider client={client}>
          {children}
        </EmailWalletProvider>
      </body>
    </html>
  );
}
```

```tsx
// components/SignInForm.tsx
'use client';
import { useState } from 'react';
import { useEmailWallet } from '@callydus/email-wallet-react';

export function SignInForm() {
  const { requestOtp, signIn, wallet, isAuthenticated, isLoading, error } = useEmailWallet();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await requestOtp(email);
    if (!error) setStep('otp');
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await signIn(email, otp);
  };

  if (isAuthenticated && wallet) {
    return (
      <div>
        <p>Wallet: {wallet.address.toBase58()}</p>
        <p>Email: {wallet.email}</p>
      </div>
    );
  }

  return (
    <div>
      {error && <p style={{ color: 'red' }}>{error.message}</p>}

      {step === 'email' ? (
        <form onSubmit={handleEmailSubmit}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Sending...' : 'Send OTP'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleOtpSubmit}>
          <input
            type="text"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="123456"
            maxLength={6}
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Verifying...' : 'Verify'}
          </button>
        </form>
      )}
    </div>
  );
}
```

---

## Implementing a custom adapter

Implement all methods of `EmailWalletAdapter` from `@callydus/email-wallet-core`:

```ts
import type { EmailWalletAdapter, WalletAccount } from '@callydus/email-wallet-core';
import { AuthenticationError, WalletNotFoundError, SigningError } from '@callydus/email-wallet-core';
import { PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js';

export class MyCustomAdapter implements EmailWalletAdapter {
  async requestOtp(email: string): Promise<void> {
    // Step 1: send OTP to email
    // Throw AuthenticationError on failure
  }

  async signIn(email: string, otp: string): Promise<WalletAccount> {
    // Step 2: verify OTP, create/recover wallet
    // Return WalletAccount { address: PublicKey, email: string }
    // Throw AuthenticationError if OTP is invalid
    // Throw WalletNotFoundError if wallet cannot be created/recovered
  }

  async signOut(): Promise<void> { /* ... */ }

  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    // CRITICAL for Solana: sign raw bytes, no keccak256 hashing
    // Throw SigningError on failure
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    return Promise.all(txs.map((tx) => this.signTransaction(tx)));
  }

  async exportPrivateKey(): Promise<string> { /* ... */ }

  async getAddress(): Promise<PublicKey> { /* ... */ }

  async isAuthenticated(): Promise<boolean> {
    // Never throw — return false on any error
  }
}
```

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for the step-by-step guide.

---

## Architecture

```
Consumer code
     │
     ▼
EmailWalletClient      ← generic, Result<T> API, no provider knowledge
     │
     ▼
EmailWalletAdapter     ← interface (contract)
     │
     ├── OpenfortAdapter  ← @openfort/openfort-js  (stable)
     ├── PrivyAdapter     ← stub — PRs welcome
     └── TurnkeyAdapter   ← stub — PRs welcome
```

The `core` package has **zero runtime dependency** on any provider SDK.
Provider code only enters the bundle if the consumer explicitly installs and imports an adapter.

---

## Error handling

All `EmailWalletClient` methods return `Result<T>` — they never throw:

```ts
const result = await client.signIn(email, otp);

if (!result.success) {
  // result.error is typed — use instanceof for specific handling
  if (result.error instanceof AuthenticationError) {
    showOtpErrorMessage();
  } else if (result.error instanceof WalletNotFoundError) {
    showWalletSetupError();
  } else {
    showGenericError(result.error.message);
  }
  return;
}

// result.data is typed as WalletAccount — no type assertion needed
console.log(result.data.address.toBase58());
```

### Error types

| Error class | When thrown |
|---|---|
| `AuthenticationError` | Invalid/expired OTP, sign-in rejected by provider |
| `WalletNotFoundError` | Wallet cannot be created or recovered |
| `SigningError` | Transaction or message signing failed |
| `ConfigurationError` | Invalid adapter configuration (caught at startup) |
| `NotImplementedError` | Stub adapter method called |

---

## Development

```bash
git clone https://github.com/callydus/solana-email-wallet
cd solana-email-wallet
pnpm install
pnpm build
pnpm test
pnpm lint
```

---

## License

MIT — 2026 Callydus. See [LICENSE](./LICENSE).
