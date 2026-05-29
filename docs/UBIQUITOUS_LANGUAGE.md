# UBIQUITOUS_LANGUAGE.md — solana-email-wallet

> Este glossário define os termos exatos usados em todo o código, comentários,
> PRs, issues e conversas com agentes de IA deste repositório.
>
> **Se um termo não está aqui, ele não existe neste projeto.**
> Usar sinônimos causa confusão e bugs. Use estes termos exatos.
>
> **Versão 1.0** — 2026-05-28

---

## Termos centrais do domínio

### EmailWalletAdapter

A interface que todo provider de embedded wallet deve implementar.
É o contrato entre o `EmailWalletClient` genérico e um provider específico.

Em código: `EmailWalletAdapter` (PascalCase, interface TypeScript).  
Nunca: `WalletProvider`, `WalletConnector`, `WalletPlugin`.

Um *adapter* é uma instância que implementa essa interface — e.g., `new OpenfortAdapter(config)`.

---

### EmailWalletClient

A classe principal que consumidores usam. Recebe um `EmailWalletAdapter` injetado
e expõe uma API `Result<T>` que nunca lança erros em business logic.

Em código: `EmailWalletClient` (classe) ou `createEmailWalletClient()` (factory).  
Nunca: `WalletManager`, `WalletService`, `WalletClient` (ambíguo).

---

### WalletAccount

A conta de wallet criada ou recuperada após autenticação por OTP.
Contém `address` (Solana `PublicKey`) e `email` (string).

Em código: `WalletAccount` (interface TypeScript).  
Nunca: `UserWallet`, `EmailAccount`, `AuthenticatedUser`.

---

### EmbeddedWallet

Uma wallet Solana cujo keypair (chave privada) é gerenciado por um provider custodial
(Openfort, Privy, Turnkey). O usuário nunca vê ou gerencia a chave privada diretamente.

Em código: `embeddedWallet` (camelCase para variáveis e campos do SDK Openfort).  
Nunca: `custodialWallet`, `managedWallet`.

---

### OTP (One-Time Password)

O código numérico (geralmente 6 dígitos) enviado por email para autenticar o usuário.
O fluxo é sempre em **duas etapas**: `requestOtp(email)` → `signIn(email, otp)`.

Em código: `otp` (parâmetro), `requestOtp` (método), `signIn` (método).  
Nunca: `code`, `pin`, `token`, `verificationCode`.

---

### Network

A rede Solana alvo. Valores válidos: `'mainnet-beta'`, `'devnet'`, `'testnet'`.

Em código: `network` (field do client), tipo `Network`.  
Nunca: `chain`, `cluster` (use apenas quando se referir ao conceito Solana interno), `environment`.

---

### Result<T>

O padrão de retorno para operações que podem falhar.
Discriminated union: `{ success: true; data: T } | { success: false; error: E }`.

Em código: `Result<T>` (tipo TypeScript).  
Nunca use `throw` em business logic — adapters podem lançar, client sempre converte para `Result<T>`.

---

### Adapter

Uma implementação concreta de `EmailWalletAdapter` para um provider específico.
Exemplos: `OpenfortAdapter`, `PrivyAdapter`, `TurnkeyAdapter`.

Em código: sufixo `Adapter` em PascalCase — e.g., `OpenfortAdapter`.  
Nunca: `OpenfortProvider`, `OpenfortConnector`, `OpenfortPlugin`.

---

## Anti-glossário — termos a nunca usar

| ❌ Nunca usar | ✅ Usar em vez |
|---|---|
| `WalletProvider` (para adapter) | `EmailWalletAdapter` |
| `connect()` (para autenticar) | `requestOtp()` → `signIn()` |
| `disconnect()` | `signOut()` |
| `code` ou `pin` | `otp` |
| `cluster` (em código de negócio) | `network` |
| `chain` | `network` |
| `custodialWallet` | `embeddedWallet` |
| `throw` em business logic | `return { success: false, error }` |
| `any` (TypeScript) | tipos explícitos, ou `unknown` com narrowing |
| `environment` (para network) | `network` |

---

## Changelog

| Versão | Data | Mudanças |
|---|---|---|
| 1.0 | 2026-05-28 | Versão inicial |
