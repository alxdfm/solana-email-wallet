# CONTEXT.md — packages/adapter-privy

**Pacote:** `@callydus/email-wallet-adapter-privy`  
**Versão:** 0.1.0  
**Estágio:** STUB — não implementado. Cada método lança `NotImplementedError`.

---

## O que este pacote faz (quando implementado)

Implementará a interface `EmailWalletAdapter` usando o SDK do Privy.

Privy é um provedor de embedded wallets que suporta autenticação por email OTP e
carteiras Solana (Ed25519). A implementação seria similar ao `adapter-openfort`.

---

## Como implementar este adapter

1. Leia `CONTRIBUTING.md` na raiz do repositório
2. Instale o SDK do Privy: `pnpm add @privy-io/react-auth` (ou a variante headless)
3. Crie `src/config.ts` com um schema Zod para `PrivyAdapterConfig`
4. Substitua os métodos stub em `src/adapter.ts` por chamadas reais ao SDK do Privy
5. Adicione testes em `src/__tests__/adapter.test.ts` mockando o SDK do Privy
6. Remova a nota "STUB" do `package.json` e atualize a versão

---

## Referências

- Documentação do Privy: https://docs.privy.io
- Privy headless SDK (sem React): `@privy-io/js-sdk-core`
- Autenticação OTP: `privy.sendCode()` e `privy.loginWithCode()`

---

## Changelog

| Versão | Data | Mudanças |
|---|---|---|
| 0.1.0 | 2026-05-28 | Stub inicial criado |
