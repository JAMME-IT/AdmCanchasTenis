import { createClerkClient, type ClerkClient } from '@clerk/backend';
import { Logger } from '@nestjs/common';
import type { ApiReferenceOptions } from '@scalar/nestjs-api-reference';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Dev-only: mints a fresh admin session token and returns the Scalar
 * `authentication` config to prefill the bearer field at /api/docs, so manual
 * testing does not require pasting tokens by hand (Clerk session tokens live
 * ~60 seconds, so the prefill happens on every docs page load).
 *
 * Two safety gates keep it out of deployments: NODE_ENV === 'production'
 * disables it, and it only applies to requests whose host is local
 * (localhost/127.0.0.1/::1) — a real deployment serves the docs page without
 * the prefill even if NODE_ENV is forgotten. Any failure degrades to a plain
 * docs page.
 */

const logger = new Logger('DocsPrefill');

/** Reloads inside this window reuse the last token (keeps F5 from minting a session each time). */
const CACHE_TTL_MS = 20_000;
const CLERK_JS_VERSION = '5.0.0';

type DocsAuthentication = NonNullable<ApiReferenceOptions['authentication']>;

interface CachedToken {
  jwt: string;
  mintedAt: number;
  clerkUserId: string;
}

let cache: CachedToken | null = null;

function resolveOrigin(): string {
  return (
    (process.env.CLERK_AUTHORIZED_PARTIES ?? 'http://localhost:5173')
      .split(',')
      .map((party) => party.trim())
      .find((party) => party.length > 0) ?? 'http://localhost:5173'
  );
}

/**
 * Dev instances: the sign-in token URL points to the account portal
 * (<slug>.accounts.dev) while the Frontend API lives at
 * <slug>.clerk.accounts.dev.
 */
function resolveFapiHost(signInUrl: string): string {
  const override = process.env.CLERK_FAPI_URL?.trim();
  if (override) {
    return override.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  }
  const host = new URL(signInUrl).host;
  if (host.endsWith('.accounts.dev') && !host.endsWith('.clerk.accounts.dev')) {
    return host.replace(/\.accounts\.dev$/, '.clerk.accounts.dev');
  }
  return host;
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `HTTP ${response.status} en ${new URL(url).host}${text ? `: ${text.slice(0, 160)}` : ''}`,
    );
  }
  return response.json();
}

/** FAPI ticket flow (same as scripts/lib/mint-session-token.ts), runtime copy. */
async function mintSessionToken(clerk: ClerkClient, clerkUserId: string): Promise<string> {
  const origin = resolveOrigin();
  const signInToken = await clerk.signInTokens.createSignInToken({
    userId: clerkUserId,
    expiresInSeconds: 600,
  });
  const fapiHost = resolveFapiHost(signInToken.url);

  const devBrowser = (await fetchJson(`https://${fapiHost}/v1/dev_browser`, {
    method: 'POST',
    headers: { Origin: origin, Accept: 'application/json' },
  })) as { token?: string };
  if (!devBrowser.token) {
    throw new Error('Clerk no devolvio el token de dev_browser');
  }
  const dbjwt = `__clerk_db_jwt=${devBrowser.token}`;

  const signIn = (await fetchJson(
    `https://${fapiHost}/v1/client/sign_ins?_clerk_js_version=${CLERK_JS_VERSION}&${dbjwt}`,
    {
      method: 'POST',
      headers: {
        Origin: origin,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ strategy: 'ticket', ticket: signInToken.token }).toString(),
    },
  )) as { response?: { created_session_id?: string } };
  const sessionId = signIn.response?.created_session_id;
  if (!sessionId) {
    throw new Error('Clerk no creo la sesion para el prefill');
  }

  const token = (await fetchJson(
    `https://${fapiHost}/v1/client/sessions/${sessionId}/tokens?_clerk_js_version=${CLERK_JS_VERSION}&${dbjwt}`,
    { method: 'POST', headers: { Origin: origin, Accept: 'application/json' } },
  )) as { jwt?: string };
  if (!token.jwt) {
    throw new Error('Clerk no devolvio el session token para el prefill');
  }
  return token.jwt;
}

async function resolveAdminClerkUserId(prisma: PrismaService): Promise<string | null> {
  const adminRoles = await prisma.usuarios_roles.findMany({
    where: { fecha_fin: null, roles: { nombre: 'admin' } },
    select: { usuario_id: true },
  });
  const admin = adminRoles.length
    ? await prisma.usuarios.findFirst({
        where: { id: { in: adminRoles.map((row) => row.usuario_id) } },
        orderBy: { created_at: 'asc' },
      })
    : null;
  return admin?.clerk_user_id ?? null;
}

function toAuthentication(token: string): DocsAuthentication {
  return {
    preferredSecurityScheme: 'bearer',
    securitySchemes: {
      bearer: { token },
    },
  };
}

export interface DocsPrefillOptions {
  /** Request hostname (Express req.hostname); the prefill only applies to local requests. */
  host: string;
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Scalar auth config with a fresh admin token for /api/docs, or null when the
 * prefill is disabled (production, non-local host, missing Clerk setup) or the
 * mint fails.
 */
export async function buildDocsPrefillAuthentication(
  prisma: PrismaService,
  options: DocsPrefillOptions,
): Promise<DocsAuthentication | null> {
  if (process.env.NODE_ENV === 'production' || !process.env.CLERK_SECRET_KEY) {
    return null;
  }
  if (!LOCAL_HOSTS.has(options.host.toLowerCase())) {
    return null;
  }

  try {
    const clerkUserId = await resolveAdminClerkUserId(prisma);
    if (!clerkUserId) {
      return null;
    }

    const ahora = Date.now();
    if (cache && cache.clerkUserId === clerkUserId && ahora - cache.mintedAt < CACHE_TTL_MS) {
      return toAuthentication(cache.jwt);
    }

    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    const jwt = await mintSessionToken(clerk, clerkUserId);
    cache = { jwt, mintedAt: ahora, clerkUserId };
    return toAuthentication(jwt);
  } catch (error) {
    logger.warn(
      `Prefill de token deshabilitado para /api/docs: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    cache = null;
    return null;
  }
}
