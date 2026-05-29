# CLAUDE.md — solana-email-wallet

> Este arquivo é lido automaticamente pelo Claude em cada sessão.
> Ele substitui a necessidade de re-explicar o projeto. Não o altere sem atualizar os arquivos-fonte.

---

## O que é este projeto

**solana-email-wallet** é uma biblioteca open-source que fornece autenticação por email OTP para wallets Solana.

Usuários autenticam com email + código OTP (nenhuma seed phrase, nenhuma extensão de browser).
A wallet é um keypair Ed25519 gerenciado por um provider custodial (Openfort, Privy, Turnkey).

**Esta lib é completamente genérica** — não tem conhecimento direto de nenhum produto Callydus.
Pode ser usada em qualquer projeto que precise de wallets Solana com autenticação por email.

---

## Mapa de documentação

Antes de tocar qualquer arquivo, leia:

| Arquivo | Quando ler |
|---|---|
| `docs/UBIQUITOUS_LANGUAGE.md` | Sempre — termos exatos do domínio |
| `docs/CONVENTIONS.md` | Sempre — naming, patterns, estrutura obrigatória |
| `packages/core/CONTEXT.md` | Ao tocar `core` — types, client, errors |
| `packages/adapter-openfort/CONTEXT.md` | Ao tocar o adapter Openfort |
| `packages/adapter-privy/CONTEXT.md` | Ao implementar o adapter Privy |
| `packages/adapter-turnkey/CONTEXT.md` | Ao implementar o adapter Turnkey |
| `packages/react/CONTEXT.md` | Ao tocar hooks React |
| `CONTRIBUTING.md` | Ao adicionar novo adapter |

---

## Estrutura do repositório

```
solana-email-wallet/
├── packages/
│   ├── core/                       ← interfaces públicas + EmailWalletClient + erros
│   ├── adapter-openfort/           ← implementação completa com Openfort SDK
│   ├── adapter-privy/              ← stub — não implementado
│   ├── adapter-turnkey/            ← stub — não implementado
│   └── react/                      ← hooks + Context Provider
├── docs/
│   ├── UBIQUITOUS_LANGUAGE.md
│   └── CONVENTIONS.md
├── .github/workflows/ci.yml        ← build + test + lint
├── pnpm-workspace.yaml
├── turbo.json
├── biome.json
└── tsconfig.base.json
```

---

## Linguagem ubíqua — termos obrigatórios

| Termo | ❌ Nunca usar |
|---|---|
| `EmailWalletAdapter` | `WalletProvider`, `WalletConnector` |
| `EmailWalletClient` | `WalletManager`, `WalletService` |
| `WalletAccount` | `UserWallet`, `AuthenticatedUser` |
| `requestOtp()` / `signIn()` | `connect()`, `authenticate()` |
| `signOut()` | `disconnect()` |
| `otp` | `code`, `pin`, `token` |
| `network` | `chain`, `cluster`, `environment` |
| `Result<T>` | `throw` em business logic |

---

## Patterns obrigatórios

### Result<T> em vez de throw

```ts
// ✅ — client retorna Result<T>
async requestOtp(email: string): Promise<Result<void>> {
  try {
    await this.adapter.requestOtp(email);
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: toError(err) };
  }
}

// ❌ — throw em business logic
async requestOtp(email: string): Promise<void> {
  await this.adapter.requestOtp(email); // pode lançar sem tratamento
}
```

### Zod como fonte única de tipo

```ts
// ✅
export const openfortAdapterConfigSchema = z.object({ ... });
export type OpenfortAdapterConfig = z.infer<typeof openfortAdapterConfigSchema>;

// ❌ — interface separada que espelha o schema (vão divergir)
interface OpenfortAdapterConfig { ... }
```

### JSDoc em tudo

```ts
// ✅
/**
 * Step 1 of the OTP flow. Sends a one-time passcode to the user's email.
 * @param email - The email to send the OTP to.
 * @throws {AuthenticationError} If the provider cannot send the OTP.
 */
async requestOtp(email: string): Promise<void>;

// ❌ — sem JSDoc
async requestOtp(email: string): Promise<void>;
```

---

## Fluxo de autenticação OTP

```
1. requestOtp(email)       → provider envia OTP por email
2. signIn(email, otp)      → provider verifica OTP
                           → cria wallet (primeiro sign-in) OU recupera (subsequente)
                           → retorna WalletAccount { address: PublicKey, email: string }
```

## Assinatura de transação Solana (CRÍTICO)

Solana usa Ed25519 com bytes brutos — SEM keccak256.

```ts
// Transaction legacy:
const bytes = tx.serializeMessage();

// VersionedTransaction:
const bytes = tx.message.serialize();

// Chamar provider com hashMessage: false (Openfort):
const sig = await openfort.embeddedWallet.signMessage(bytes, { hashMessage: false });
```

---

## Hierarquia de erros

```
EmailWalletError (base)
  ├── AuthenticationError    → OTP inválido, sessão expirada
  ├── WalletNotFoundError    → wallet não encontrada
  ├── SigningError           → falha ao assinar
  ├── ConfigurationError     → config inválida
  └── NotImplementedError    → adapter stub
```

Adapters **lançam**. Client **converte em Result<T>**. Consumidor **verifica success**.

---

## Comandos essenciais

```bash
pnpm install        # instalar dependências
pnpm build          # compilar todos os pacotes
pnpm test           # rodar testes (Vitest)
pnpm lint           # checar estilo (Biome)
pnpm type-check     # verificar tipos TypeScript
```

---

## O que NÃO fazer

- Não importar nenhum pacote Callydus externo nesta lib
- Não usar `any`
- Não omitir JSDoc "por brevidade"
- Não criar interface que espelha schema Zod
- Não usar `throw` em business logic no client (apenas em adapters)
- Não chamar `isAuthenticated()` em loops — é uma chamada de rede no Openfort

---

## Pacotes npm

```
@callydus/email-wallet-core
@callydus/email-wallet-adapter-openfort
@callydus/email-wallet-adapter-privy      ← stub
@callydus/email-wallet-adapter-turnkey    ← stub
@callydus/email-wallet-react
```
