# CONTEXT.md — packages/adapter-openfort

**Pacote:** `@callydus/email-wallet-adapter-openfort`  
**Versão:** 0.1.0  
**Estágio:** Estável — requer validação em browser (SDK não inicializa em Node.js)

---

## O que este pacote faz

Implementa a interface `EmailWalletAdapter` usando o SDK `@openfort/openfort-js`.

Fornece:
- Autenticação OTP por email via Openfort Auth
- Criação de wallet Solana EOA (Ed25519) no primeiro sign-in
- Recuperação automática de wallet em sign-ins subsequentes
- Assinatura de `Transaction` e `VersionedTransaction` com `hashMessage: false` (crítico para Solana)
- Export de chave privada

---

## Detalhe crítico: `hashMessage: false`

Ethereum assina `keccak256(mensagem)`. Solana assina os bytes brutos diretamente com Ed25519.

Ao chamar `openfort.embeddedWallet.signMessage()`, você **deve** passar `{ hashMessage: false }`.
Sem isso, Openfort aplica keccak256 e a assinatura será inválida no Solana.

---

## Fluxo de autenticação

O SDK v0.9.x usa email+password — não há método OTP nativo. O "OTP" é uma senha gerada
pelo backend e entregue por email. O adapter mapeia isso assim:

```
1. requestOtp(email)
   └─► no-op no adapter — o backend do consumidor deve gerar e enviar o código

2. signIn(email, otp)
   ├─► openfort.auth.logInWithEmailPassword({ email, password: otp })
   │   └─► se falhar (novo usuário):
   │       openfort.auth.signUpWithEmailPassword({ email, password: otp })
   ├─► openfort.embeddedWallet.getEmbeddedState()
   │   ├─► EMBEDDED_SIGNER_NOT_CONFIGURED → create({ accountType: EOA, chainType: SVM })
   │   └─► READY → wallet já existe, pular
   └─► openfort.embeddedWallet.get() → { address: string base58 }
```

**SDK é browser-only.** O Openfort SDK usa `window` e `localStorage` — não inicializa em Node.js.
Testes de integração reais devem rodar via dev server do Next.js ou Playwright.

---

## Dependências

| Pacote | Tipo | Motivo |
|---|---|---|
| `@callydus/email-wallet-core` | workspace | Contrato `EmailWalletAdapter` e tipos de erro |
| `@openfort/openfort-js` | direct | SDK oficial do Openfort |
| `bs58` | direct | Decode de assinaturas Base58 → Uint8Array |
| `zod` | direct | Validação de `OpenfortAdapterConfig` |
| `@solana/web3.js` | peer | `Transaction`, `VersionedTransaction`, `PublicKey` |

---

## Changelog

| Versão | Data | Mudanças |
|---|---|---|
| 0.1.0 | 2026-05-28 | Versão inicial — implementação completa do Openfort SDK |
| 0.1.1 | 2026-06-07 | Fix: `signIn` agora tenta signup para novos usuários; removida validação `shpk_` incorreta |
