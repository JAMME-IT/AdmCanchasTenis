import { SetMetadata } from '@nestjs/common';

export const ALLOW_INCOMPLETE_PROFILE_KEY = 'allowIncompleteProfile';

/**
 * Allows access for a Clerk-authenticated user who has no `usuarios` row yet
 * (domain sign-up pending, RF-1).
 */
export const AllowIncompleteProfile = (): ReturnType<typeof SetMetadata> =>
  SetMetadata(ALLOW_INCOMPLETE_PROFILE_KEY, true);
