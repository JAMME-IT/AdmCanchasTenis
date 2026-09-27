/// <reference types="node" />
/**
 * Shared Clerk session-token minting for local dev scripts.
 *
 * The API's ClerkAuthGuard verifies tokens with authorizedParties (azp), and
 * Backend API tokens have no azp claim (they are rejected with 401). This flow
 * uses the FAPI ticket sign-in (Backend API sign-in token + a fresh dev
 * browser) so the JWT carries azp=<origin>. Tokens live ~60s: mint right before
 * use and re-mint when close to expiring.
 */
import { createClerkClient, type ClerkClient } from '@clerk/backend';

export interface SessionClaims {
  sub?: string;
  sid?: string;
  azp?: string;
  exp?: number;
}

export interface SessionToken {
  jwt: string;
  claims: SessionClaims;
}

export interface MintSessionTokenOptions {
  /** Token azp/origin; defaults to the first CLERK_AUTHORIZED_PARTIES entry. */
  origin?: string;
  /** Clerk JS version query param used by the FAPI. */
  clerkJsVersion?: string;
}

/** First CLERK_AUTHORIZED_PARTIES entry: must match the token azp (default dev front). */
export function resolveTokenOrigin(): string {
  return (
    (process.env.CLERK_AUTHORIZED_PARTIES ?? 'http://localhost:5173')
      .split(',')
      .map((party) => party.trim())
      .find((party) => party.length > 0) ?? 'http://localhost:5173'
  );
}

export function createClerkClientFromEnv(): ClerkClient {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Falta CLERK_SECRET_KEY. Corre el script desde apps/api (usa su .env).');
  }
  return createClerkClient({ secretKey });
}

/**
 * Mints a session token through the FAPI ticket flow: Backend API sign-in token
 * -> fresh dev browser -> client sign-in -> session token. Every call uses a
 * new dev browser, so signing in several users does not hit "session_exists".
 */
export async function mintSessionToken(
  clerk: ClerkClient,
  clerkUserId: string,
  options: MintSessionTokenOptions = {},
): Promise<SessionToken> {
  const origin = options.origin ?? resolveTokenOrigin();
  const clerkJsVersion = options.clerkJsVersion ?? '5.0.0';

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
  // Dev instances require the dev browser as a query param; a plain cookie is rejected.
  const dbjwt = `__clerk_db_jwt=${devBrowser.token}`;

  const signIn = (await fetchJson(
    `https://${fapiHost}/v1/client/sign_ins?_clerk_js_version=${clerkJsVersion}&${dbjwt}`,
    {
      method: 'POST',
      headers: {
        Origin: origin,
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ strategy: 'ticket', ticket: signInToken.token }).toString(),
    },
  )) as { response?: { created_session_id?: string; status?: string } };
  const sessionId = signIn.response?.created_session_id;
  if (!sessionId) {
    throw new Error(
      `Clerk no creo la sesion (status=${signIn.response?.status ?? 'desconocido'})`,
    );
  }

  const token = (await fetchJson(
    `https://${fapiHost}/v1/client/sessions/${sessionId}/tokens?_clerk_js_version=${clerkJsVersion}&${dbjwt}`,
    { method: 'POST', headers: { Origin: origin, Accept: 'application/json' } },
  )) as { jwt?: string };
  if (!token.jwt) {
    throw new Error('Clerk no devolvio el session token');
  }

  const claims = decodeJwtPayload(token.jwt);
  if (claims.azp !== origin) {
    throw new Error(
      `El token no trae azp=${origin} (azp=${claims.azp ?? 'ausente'});` +
        ' revisa CLERK_AUTHORIZED_PARTIES en apps/api/.env',
    );
  }
  return { jwt: token.jwt, claims };
}

/**
 * Dev instances: the sign-in token URL points to the account portal
 * (<slug>.accounts.dev) while the Frontend API lives at
 * <slug>.clerk.accounts.dev. Custom domains use the same host for both.
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

function decodeJwtPayload(jwt: string): SessionClaims {
  const payload = jwt.split('.')[1] ?? '';
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionClaims;
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    const parsed = new URL(url);
    throw new Error(
      `HTTP ${response.status} en ${parsed.host}${parsed.pathname}${text ? `: ${text.slice(0, 200)}` : ''}`,
    );
  }
  return response.json();
}
