# CONVENTIONS.md — solana-email-wallet

> Padrões obrigatórios. Todo arquivo neste repositório segue estas regras.
> Em caso de dúvida: explícito > inteligente, simples > criativo, legível > breve.
>
> **Versão 1.0** — 2026-05-28

---

## Naming Conventions

### TypeScript

```
PascalCase    → tipos, interfaces, classes, enums, componentes React
camelCase     → variáveis, funções, hooks, props, parâmetros
SCREAMING     → constantes verdadeiras (nunca mudam em runtime)
kebab-case    → nomes de arquivo (exceto componentes e hooks)
```

### Arquivos

| O quê | Padrão | Exemplo |
|---|---|---|
| Componente React | `PascalCase.tsx` | `EmailWalletContext.tsx` |
| Hook React | `useCamelCase.ts` | `useEmailWallet.ts` |
| Serviço/adapter | `kebab-case.ts` | `adapter.ts`, `config.ts` |
| Arquivo de tipos | `types.ts` (local) ou `kebab.types.ts` | `types.ts` |
| Arquivo de teste | mesmo nome + `.test.ts` | `client.test.ts` |

---

## TypeScript

### Sem `any` — sempre tipos explícitos

```ts
// ✅
function parseConfig(raw: unknown): OpenfortAdapterConfig {
  return openfortAdapterConfigSchema.parse(raw);
}

// ❌
function parseConfig(raw: any) { ... }
```

### Return types explícitos em toda função pública

```ts
// ✅
async function requestOtp(email: string): Promise<Result<void>> { ... }

// ❌
async function requestOtp(email) { ... }
```

### Result<T> em vez de throw em business logic

```ts
// ✅ — client wraps adapter errors in Result<T>
async requestOtp(email: string): Promise<Result<void>> {
  try {
    await this.adapter.requestOtp(email);
    return { success: true, data: undefined };
  } catch (err) {
    return { success: false, error: toError(err) };
  }
}

// ❌ — throw em business logic (aceitável apenas em adapters)
async requestOtp(email: string): Promise<void> {
  await this.adapter.requestOtp(email); // pode lançar — não é business logic
}
```

### Zod como fonte única de tipo

```ts
// ✅
export const openfortAdapterConfigSchema = z.object({
  publishableKey: z.string().startsWith('pk_'),
  shieldPublishableKey: z.string().startsWith('shpk_'),
});
export type OpenfortAdapterConfig = z.infer<typeof openfortAdapterConfigSchema>;

// ❌ — nunca criar interface separada que espelha um schema Zod
interface OpenfortAdapterConfig {
  publishableKey: string;
  shieldPublishableKey: string;
}
```

---

## JSDoc obrigatório

JSDoc em **todo** `type`, `interface`, `class`, `function`, `hook`, `field`.
Os comentários devem explicar **o que é**, **por que existe** e **como usar** —
não apenas o que o código faz mecanicamente.

```ts
// ✅
/**
 * The Solana public key of the embedded wallet.
 *
 * This is the address that appears on-chain — safe to share publicly.
 * Base58 representation: 32–44 characters.
 */
readonly address: PublicKey;

// ❌
readonly address: PublicKey; // the address
```

---

## Erros tipados

Adapters **lançam** erros tipados de `@callydus/email-wallet-core/errors`.
O client **captura** e converte em `Result<T>`.

```
Hierarquia:
EmailWalletError
  ├── AuthenticationError    → OTP inválido, sessão expirada
  ├── WalletNotFoundError    → wallet não encontrada ou não criada
  ├── SigningError           → falha ao assinar transação
  ├── ConfigurationError     → config inválida
  └── NotImplementedError    → adapter stub não implementado
```

---

## Testes

- Framework: **Vitest**
- Localização: `src/__tests__/*.test.ts`
- Naming: arquivo de teste tem o mesmo nome do arquivo testado + `.test.ts`
- Mocking: use `vi.fn()` e `vi.mock()` — nunca dependências reais de rede
- Coverage mínima: todos os caminhos de sucesso e falha de cada método público

---

## Estrutura de pacote (obrigatória)

```
packages/[nome]/
├── src/
│   ├── index.ts         ← API pública — único ponto de importação externa
│   ├── [módulo].ts      ← implementação
│   └── __tests__/
│       └── [módulo].test.ts
├── CONTEXT.md           ← documentação do pacote
├── package.json
└── tsconfig.json
```

O `index.ts` define o que é exportado. Nada que não esteja em `index.ts`
é considerado API pública — pode mudar sem aviso.

---

## Changelog

| Versão | Data | Mudanças |
|---|---|---|
| 1.0 | 2026-05-28 | Versão inicial |
