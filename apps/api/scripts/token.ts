/// <reference types="node" />
/**
 * Prints an admin session token for manual API testing (Scalar Authorize, curl).
 * Run from apps/api:
 *   npx ts-node scripts/token.ts
 *
 * Valid ~60s: mint it right before using it. It is also copied to the clipboard
 * best-effort via clip.exe (WSL). Override the target with PROBE_ADMIN_EMAIL.
 */
import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { createClerkClientFromEnv, mintSessionToken } from './lib/mint-session-token';

if (!process.env.CLERK_SECRET_KEY) {
  // Fallback for runs from the repo root instead of apps/api.
  loadDotenv({ path: join(__dirname, '..', '.env') });
}

const ADMIN_EMAIL = process.env.PROBE_ADMIN_EMAIL ?? 'admin+clerk_test@admcanchastenis.dev';

async function main(): Promise<void> {
  const clerk = createClerkClientFromEnv();
  const { data } = await clerk.users.getUserList({ emailAddress: [ADMIN_EMAIL] });
  const user = data.find((candidate) =>
    candidate.emailAddresses.some(
      (address) => address.emailAddress.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
    ),
  );
  if (!user) {
    throw new Error(`No se encontro el usuario admin en Clerk (${ADMIN_EMAIL})`);
  }

  const token = await mintSessionToken(clerk, user.id);
  const remaining = Math.max(0, (token.claims.exp ?? 0) - Math.floor(Date.now() / 1000));

  console.log(
    `\nSession token admin (azp=${token.claims.azp ?? 'ausente'}) - valido ~${remaining}s:\n`,
  );
  console.log(token.jwt);
  console.log(
    '\nUsalo en Scalar -> Authorize -> Bearer, o como "Authorization: Bearer <token>" en curl.',
  );
  console.log('Si expira, volve a correr el script.\n');

  try {
    execFileSync('clip.exe', [], { input: token.jwt });
    console.log('Copiado al portapapeles (clip.exe).');
  } catch {
    console.log('No se pudo copiar al portapapeles: clip.exe no disponible (fuera de WSL?).');
  }
}

void main().catch((error: unknown) => {
  console.error(`\nError: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
