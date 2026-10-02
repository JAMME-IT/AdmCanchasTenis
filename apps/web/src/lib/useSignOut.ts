import { useAuth } from '@clerk/react';
import { api } from './api';

/**
 * Signs out everywhere: revokes the Clerk session on the server
 * (POST /auth/logout, RF-46) and then clears the client session.
 */
export function useSignOut(): () => Promise<void> {
  const { getToken, signOut } = useAuth();
  return async () => {
    try {
      const token = await getToken();
      await api.logout(token);
    } catch {
      // The client session is closed below even if the API call fails.
    } finally {
      await signOut();
    }
  };
}
