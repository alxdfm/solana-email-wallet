/**
 * @file integration.ts
 *
 * Script de integração manual contra a API real do Openfort sandbox.
 *
 * NÃO faz parte da suite de testes automáticos (Vitest).
 * Roda manualmente para validar o fluxo real antes de integrar no Sign.
 *
 * Uso:
 *   cd packages/adapter-openfort
 *   npx tsx scripts/integration.ts
 *
 * Requer .env.test.local na raiz do pacote com:
 *   OPENFORT_PUBLISHABLE_KEY=pk_test_...
 *   OPENFORT_SHIELD_KEY=<uuid ou shpk_...>
 *   OPENFORT_TEST_EMAIL=<seu email de teste>
 *   OPENFORT_TEST_PASSWORD=<senha fixa para o usuário de teste>
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Carrega .env.test.local manualmente (sem dotenv como dependência)
function loadEnv(): void {
  try {
    const envPath = resolve(import.meta.dirname, '../.env.test.local');
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    console.error('❌  .env.test.local não encontrado. Crie o arquivo com as keys do Openfort sandbox.');
    process.exit(1);
  }
}

loadEnv();

const PUBLISHABLE_KEY = process.env.OPENFORT_PUBLISHABLE_KEY ?? '';
const SHIELD_KEY = process.env.OPENFORT_SHIELD_KEY ?? '';
const TEST_EMAIL = process.env.OPENFORT_TEST_EMAIL ?? '';
const TEST_PASSWORD = process.env.OPENFORT_TEST_PASSWORD ?? '';

if (!PUBLISHABLE_KEY || !SHIELD_KEY || !TEST_EMAIL || !TEST_PASSWORD) {
  console.error('❌  Variáveis ausentes no .env.test.local. Necessário: OPENFORT_PUBLISHABLE_KEY, OPENFORT_SHIELD_KEY, OPENFORT_TEST_EMAIL, OPENFORT_TEST_PASSWORD');
  process.exit(1);
}

// Importar após carregar env
const { OpenfortAdapter } = await import('../src/adapter.js');
const { Connection, PublicKey, SystemProgram, Transaction } = await import('@solana/web3.js');

console.log('\n=== Openfort Adapter — Integração Sandbox ===\n');
console.log(`Email de teste : ${TEST_EMAIL}`);
console.log(`Publishable key: ${PUBLISHABLE_KEY.slice(0, 12)}...`);
console.log(`Shield key     : ${SHIELD_KEY.slice(0, 8)}...`);

// ── Passo 1: Construção do adapter ────────────────────────────────────────────

console.log('\n[1] Construindo OpenfortAdapter...');
let adapter: InstanceType<typeof OpenfortAdapter>;
try {
  adapter = new OpenfortAdapter({
    publishableKey: PUBLISHABLE_KEY,
    shieldPublishableKey: SHIELD_KEY,
  });
  console.log('    ✅  Adapter construído');
} catch (err) {
  console.error('    ❌  Falha ao construir adapter:', err);
  process.exit(1);
}

// ── Passo 2: isAuthenticated antes do login ───────────────────────────────────

console.log('\n[2] isAuthenticated() antes do login...');
const authBefore = await adapter.isAuthenticated();
console.log(`    ${authBefore ? '⚠️  true (esperado: false)' : '✅  false (correto)'}`);

// ── Passo 3: requestOtp ───────────────────────────────────────────────────────

console.log('\n[3] requestOtp() — valida email...');
try {
  await adapter.requestOtp(TEST_EMAIL);
  console.log('    ✅  requestOtp resolveu sem erro');
} catch (err) {
  console.error('    ❌  requestOtp lançou:', err);
  process.exit(1);
}

// ── Passo 4: signIn (login ou signup automático) ──────────────────────────────

console.log(`\n[4] signIn(${TEST_EMAIL}, password)...`);
let account: Awaited<ReturnType<typeof adapter.signIn>>;
try {
  account = await adapter.signIn(TEST_EMAIL, TEST_PASSWORD);
  console.log('    ✅  Autenticado');
  console.log(`    Endereço: ${account.address.toBase58()}`);
  console.log(`    Email   : ${account.email}`);
} catch (err) {
  console.error('    ❌  signIn falhou:', err);
  process.exit(1);
}

// ── Passo 5: isAuthenticated após login ───────────────────────────────────────

console.log('\n[5] isAuthenticated() após login...');
const authAfter = await adapter.isAuthenticated();
console.log(`    ${authAfter ? '✅  true (correto)' : '❌  false (esperado: true)'}`);

// ── Passo 6: getAddress ───────────────────────────────────────────────────────

console.log('\n[6] getAddress()...');
try {
  const address = await adapter.getAddress();
  const match = address.toBase58() === account.address.toBase58();
  console.log(`    ✅  ${address.toBase58()}`);
  console.log(`    ${match ? '✅  Bate com endereço do signIn' : '❌  Diverge do endereço do signIn'}`);
} catch (err) {
  console.error('    ❌  getAddress falhou:', err);
}

// ── Passo 7: signTransaction ──────────────────────────────────────────────────

console.log('\n[7] signTransaction() — transação de transferência nula...');
try {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const { blockhash } = await connection.getLatestBlockhash();

  const tx = new Transaction();
  tx.recentBlockhash = blockhash;
  tx.feePayer = account.address;

  // Transferência de 0 lamports para si mesmo — apenas para ter uma instrução válida
  tx.add(
    SystemProgram.transfer({
      fromPubkey: account.address,
      toPubkey: account.address,
      lamports: 0,
    }),
  );

  const signed = await adapter.signTransaction(tx);
  const sigBytes = signed.signature;
  console.log(`    ✅  Transação assinada`);
  console.log(`    Assinatura (primeiros 8 bytes): ${sigBytes ? Buffer.from(sigBytes).slice(0, 8).toString('hex') : 'null'}`);
} catch (err) {
  console.error('    ❌  signTransaction falhou:', err);
}

// ── Passo 8: signOut ──────────────────────────────────────────────────────────

console.log('\n[8] signOut()...');
try {
  await adapter.signOut();
  console.log('    ✅  Logout realizado');
} catch (err) {
  console.error('    ❌  signOut falhou:', err);
}

console.log('\n=== Integração concluída ===\n');
