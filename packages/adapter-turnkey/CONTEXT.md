# CONTEXT.md — packages/adapter-turnkey

**Pacote:** `@callydus/email-wallet-adapter-turnkey`  
**Versão:** 0.1.0  
**Estágio:** STUB — não implementado. Cada método lança `NotImplementedError`.

---

## O que este pacote faz (quando implementado)

Implementará a interface `EmailWalletAdapter` usando a API do Turnkey.

Turnkey é um provedor de infraestrutura de chaves que suporta wallets Solana com
autenticação por email. Diferente do Openfort e Privy, o modelo de auth do Turnkey
usa "auth bundles" em vez de códigos OTP diretos — mas a interface `EmailWalletAdapter`
abstrai esse detalhe.

---

## Como implementar este adapter

1. Leia `CONTRIBUTING.md` na raiz do repositório
2. Instale o SDK do Turnkey: `pnpm add @turnkey/sdk-browser`
3. Crie `src/config.ts` com schema Zod para `TurnkeyAdapterConfig`
4. Substitua os métodos stub em `src/adapter.ts` por chamadas reais ao Turnkey
5. Adicione testes em `src/__tests__/adapter.test.ts` mockando o SDK do Turnkey
6. Remova a nota "STUB" e atualize a versão

---

## Conceitos Turnkey relevantes

- **Organization**: Container da sua conta Turnkey
- **Sub-organization**: Criada por usuário — guarda a wallet
- **Auth bundle**: Entregue por email; usado com `iframeStamper` para auth criptográfica
- **Wallet**: Keypair gerenciado pelo Turnkey (Ed25519 para Solana)

---

## Referências

- Documentação: https://docs.turnkey.com
- Auth por email: https://docs.turnkey.com/authentication/email
- SDK browser: `@turnkey/sdk-browser`

---

## Changelog

| Versão | Data | Mudanças |
|---|---|---|
| 0.1.0 | 2026-05-28 | Stub inicial criado |
