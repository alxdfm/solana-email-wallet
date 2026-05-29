# CONTEXT.md — packages/adapter-openfort

**Pacote:** `@callydus/email-wallet-adapter-openfort`  
**Versão:** 0.1.0  
**Estágio:** Estável — implementação completa do Openfort SDK

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

```
1. requestOtp(email)
   └─► openfort.auth.requestEmailOtp({ email })

2. signIn(email, otp)
   ├─► openfort.auth.logInWithEmailOtp({ email, otp })
   ├─► openfort.embeddedWallet.getEmbeddedState()
   │   ├─► EMBEDDED_SIGNER_NOT_CONFIGURED → create({ accountType: EOA, chainType: SVM })
   │   └─► READY → wallet já existe, pular
   └─► openfort.embeddedWallet.get() → { address: string base58 }
```

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
