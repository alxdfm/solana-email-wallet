# CONTRIBUTING.md — solana-email-wallet

Thank you for contributing to `solana-email-wallet`!

This guide explains how to add a new adapter implementation.
If you are fixing a bug or improving existing code, skip to the [Development setup](#development-setup) section.

---

## Development setup

```bash
# Prerequisites: pnpm >= 9, Node.js >= 20

git clone https://github.com/callydus/solana-email-wallet.git
cd solana-email-wallet
pnpm install
pnpm build
pnpm test
```

---

## Adding a new adapter

An adapter is a bridge between the generic `EmailWalletClient` and a specific embedded-wallet provider.

### Step 1 — Create the package directory

```bash
mkdir -p packages/adapter-<provider>/src/__tests__
```

### Step 2 — Write `package.json`

Copy `packages/adapter-privy/package.json` and update:
- `"name"`: `"@callydus/email-wallet-adapter-<provider>"`
- `"description"`: describe the provider
- Add the provider's SDK to `"dependencies"`

### Step 3 — Write `tsconfig.json`

Copy from any existing adapter — it just extends `../../tsconfig.base.json`.

### Step 4 — Write `src/config.ts`

Define a Zod schema for your adapter's configuration:

```ts
import { z } from 'zod';

export const myAdapterConfigSchema = z.object({
  apiKey: z.string().min(1, 'apiKey is required'),
  // ... other fields
});

export type MyAdapterConfig = z.infer<typeof myAdapterConfigSchema>;
```

**Rule**: The schema IS the type. Never create a separate interface.

### Step 5 — Implement `src/adapter.ts`

Implement every method of `EmailWalletAdapter` from `@callydus/email-wallet-core`.

#### Critical: error contract

- **Throw** typed errors from `@callydus/email-wallet-core/errors`
- **Never** return `null` or `undefined` to signal failure — throw
- `isAuthenticated()` is the only exception — it must **never** throw

```ts
import {
  AuthenticationError,
  WalletNotFoundError,
  SigningError,
  ConfigurationError,
} from '@callydus/email-wallet-core';
```

#### Critical: Solana transaction signing

Solana uses Ed25519 with raw byte signing (no keccak256 hashing).
When calling your provider's signing API, ensure you pass the **raw transaction bytes**
without any hashing transformation. See `adapter-openfort/src/adapter.ts` for reference.

For `Transaction` (legacy format):
```ts
const messageBytes = tx.serializeMessage(); // raw bytes to sign
```

For `VersionedTransaction` (v0 format):
```ts
const messageBytes = tx.message.serialize(); // raw bytes to sign
```

### Step 6 — Write `src/index.ts`

Export only the adapter class and its config type/schema:

```ts
export { MyAdapter } from './adapter.js';
export type { MyAdapterConfig } from './config.js';
export { myAdapterConfigSchema } from './config.js';
```

### Step 7 — Write tests

Create `src/__tests__/adapter.test.ts`. Mock the provider's SDK module entirely.

Your tests must cover:
- Constructor validates config (throws `ConfigurationError` on invalid input)
- `requestOtp` delegates to the SDK, throws `AuthenticationError` on SDK error
- `signIn` handles first sign-in (wallet creation) and subsequent sign-ins (wallet recovery)
- `signIn` throws `AuthenticationError` on invalid OTP
- `signOut` delegates to the SDK
- `isAuthenticated` returns `false` when not authenticated, never throws
- `getAddress` returns `PublicKey`, throws `WalletNotFoundError` when not authenticated
- `signTransaction` signs and returns the transaction, throws `SigningError` on failure
- `exportPrivateKey` returns the key string, throws when not authenticated

### Step 8 — Write `CONTEXT.md`

Document:
- What the provider is
- Current implementation status
- Key SDK calls used
- Any provider-specific quirks

### Step 9 — Register in `pnpm-workspace.yaml`

The workspace already includes `packages/*`, so no changes needed.

### Step 10 — Open a Pull Request

- Title: `feat(adapter-<provider>): implement <Provider> adapter`
- Include a summary of the provider's auth model
- Ensure `pnpm build && pnpm test && pnpm lint` all pass

---

## Code style

- Zero `any` — use explicit types or `unknown` with narrowing
- JSDoc on every exported type, interface, class, method, and field
- `Result<T>` is for the **client** — adapters throw, client wraps
- Zod schemas as single source of type truth
- `vitest` for tests — mock SDKs, never make real network calls in tests

---

## Questions?

Open an issue or start a discussion on GitHub.
