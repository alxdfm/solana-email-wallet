# Changelog

All notable changes to this project are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

No unreleased changes.

---

## [0.1.0] — 2026-05-28

Initial release of the `solana-email-wallet` monorepo.

### Added

**`@callydus/email-wallet-core`**
- `EmailWalletAdapter` interface — contract for all provider implementations
- `EmailWalletClient` class with `Result<T>` API (never throws in business logic)
- `createEmailWalletClient(config)` factory function
- `WalletAccount` interface — `{ address: PublicKey, email: string }`
- `Network` type — `'mainnet-beta' | 'devnet' | 'testnet'`
- `Result<T, E>` discriminated union type
- Typed error classes: `EmailWalletError`, `AuthenticationError`, `WalletNotFoundError`, `SigningError`, `ConfigurationError`, `NotImplementedError`
- Zod schema validation for `EmailWalletClientConfig`

**`@callydus/email-wallet-adapter-openfort`**
- `OpenfortAdapter` — full implementation using `@openfort/openfort-js` v0.9.x
- Two-step OTP flow: `requestOtp()` → `signIn()`
- Solana wallet creation (`ChainTypeEnum.SVM`, `AccountTypeEnum.EOA`)
- Transaction signing with `hashMessage: false` (required for Solana Ed25519)
- `bs58` decode for converting Openfort's base58 signature to `Uint8Array`
- `OpenfortAdapterConfig` with Zod validation
- Automatic wallet recovery on subsequent sign-ins

**`@callydus/email-wallet-adapter-privy`**
- Stub — all methods throw `NotImplementedError`
- Documented as a contribution target in `CONTEXT.md`

**`@callydus/email-wallet-adapter-turnkey`**
- Stub — all methods throw `NotImplementedError`
- Documented as a contribution target in `CONTEXT.md`

**`@callydus/email-wallet-react`**
- `EmailWalletContext` and `EmailWalletProvider`
- `useEmailWallet()` hook with `requestOtp`, `signIn`, `signOut`, `wallet`, `isAuthenticated`, `isLoading`, `error`, `signTransaction`, `signAllTransactions`, `exportPrivateKey`

**Repository**
- Turborepo + pnpm workspace monorepo setup
- Biome for lint and formatting
- Vitest test suite — 80 tests across 4 packages
- GitHub Actions CI: type-check, build, test, lint
- `UBIQUITOUS_LANGUAGE.md`, `CONVENTIONS.md`, `CLAUDE.md`
- `CONTRIBUTING.md` with step-by-step guide for adding new adapters
- MIT License

[Unreleased]: https://github.com/callydus/solana-email-wallet/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/callydus/solana-email-wallet/releases/tag/v0.1.0
