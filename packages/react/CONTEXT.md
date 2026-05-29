# CONTEXT.md — packages/react

**Pacote:** `@callydus/email-wallet-react`  
**Versão:** 0.1.0  
**Estágio:** Estável — pronto para uso em produção

---

## O que este pacote faz

Fornece integração React para `@callydus/email-wallet-core` via:
- `<EmailWalletProvider>` — Context Provider que encapsula o `EmailWalletClient`
- `useEmailWallet()` — hook principal para acessar estado e ações da wallet

---

## Quando usar este pacote

- Em apps React (Next.js, Vite, CRA, etc.) que precisam de wallet por email
- Quando você quer gerenciamento de estado automático (`isLoading`, `error`, `wallet`)
- Em componentes que precisam de `signTransaction` sem gerenciar o client diretamente

Para uso fora de React (Node.js, scripts, testes), use `@callydus/email-wallet-core` diretamente.

---

## Estrutura interna

```
src/
├── EmailWalletContext.tsx  ← Context + Provider + useEmailWalletContext
├── useEmailWallet.ts       ← Hook principal (wrapper fino sobre o context)
├── types.ts                ← UseEmailWalletReturn interface
└── index.ts                ← API pública do pacote
```

---

## Fluxo de uso

```tsx
// 1. Na raiz da app:
<EmailWalletProvider client={client}>
  <App />
</EmailWalletProvider>

// 2. Em qualquer componente filho:
const { requestOtp, signIn, wallet, isAuthenticated } = useEmailWallet();
```

---

## Dependências

| Pacote | Tipo | Motivo |
|---|---|---|
| `@callydus/email-wallet-core` | workspace | Tipos e client |
| `react` | peer | `useState`, `useContext`, `useMemo`, `useCallback` |
| `@solana/web3.js` | peer | `Transaction`, `VersionedTransaction` |

---

## Changelog

| Versão | Data | Mudanças |
|---|---|---|
| 0.1.0 | 2026-05-28 | Versão inicial — Provider, hook, testes |
