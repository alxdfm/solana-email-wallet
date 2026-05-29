# CONTEXT.md — packages/core

**Pacote:** `@callydus/email-wallet-core`  
**Versão:** 0.1.0  
**Estágio:** Estável — pronto para uso em produção

---

## O que este pacote faz

`@callydus/email-wallet-core` é o núcleo da biblioteca `solana-email-wallet`.  
Ele define as **abstrações genéricas** — sem conhecimento de nenhum provedor específico.

Este pacote contém:
- A interface `EmailWalletAdapter` — o contrato que todo adapter deve implementar
- A classe `EmailWalletClient` — o ponto de entrada para consumidores
- O tipo `Result<T>` — padrão de erro sem throw em business logic
- Todos os tipos de domínio (`WalletAccount`, `Network`, etc.)
- Todas as classes de erro tipadas

**Este pacote não depende de nenhum provedor de wallet.** Ele depende apenas de:
- `@solana/web3.js` (peer dependency) — tipos `PublicKey`, `Transaction`, `VersionedTransaction`
- `zod` — validação de configuração

---

## Quando usar este pacote diretamente

- Ao **implementar um novo adapter**: importe `EmailWalletAdapter` e os tipos de erro
- Ao **escrever código genérico** que aceita qualquer adapter
- Ao usar o `EmailWalletClient` com um adapter já construído

Consumidores que usam React devem preferir `@callydus/email-wallet-react`, que encapsula
o client em hooks e context.

---

## Estrutura interna

```
src/
├── types.ts    ← interfaces públicas + Result<T> + schemas Zod
├── client.ts   ← EmailWalletClient class + createEmailWalletClient()
├── errors.ts   ← classes de erro tipadas
└── index.ts    ← re-exports públicos (API pública do pacote)

src/__tests__/
├── client.test.ts  ← testa o client com adapter mockado (Vitest)
└── errors.test.ts  ← testa todas as classes de erro
```

---

## Padrão de erro: adapters throw, client wraps

Os **adapters** lançam erros (`throw`). O **client** captura esses erros e os converte em `Result<T>`.

```
adapter.requestOtp()  → throw AuthenticationError
client.requestOtp()   → { success: false, error: AuthenticationError }
```

O código consumidor **nunca** precisa de try/catch em business logic.

---

## Dependências

| Pacote | Tipo | Motivo |
|---|---|---|
| `@solana/web3.js` | peer | Tipos `PublicKey`, `Transaction`, `VersionedTransaction` |
| `zod` | direct | Validação de `EmailWalletClientConfig` no constructor |

---

## Changelog

| Versão | Data | Mudanças |
|---|---|---|
| 0.1.0 | 2026-05-28 | Versão inicial — tipos, client, erros, testes |
