import { ServiceUnavailableException } from '@nestjs/common';
import { createClerkClient, type ClerkClient } from '@clerk/backend';

/**
 * Clerk Backend API client (session revocation, user lookups).
 * Built per call so the API can boot in dev without Clerk keys.
 */
export function getClerkClient(): ClerkClient {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new ServiceUnavailableException('CLERK_SECRET_KEY no esta configurada');
  }
  return createClerkClient({ secretKey });
}

/** Authorized session token origins (azp). Defaults to the dev frontend. */
export function getAuthorizedParties(): string[] {
  return (process.env.CLERK_AUTHORIZED_PARTIES ?? 'http://localhost:5173')
    .split(',')
    .map((party) => party.trim())
    .filter((party) => party.length > 0);
}
