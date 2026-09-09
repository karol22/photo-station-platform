/**
 * Sesión administrativa: token en `sessionStorage` (nunca sobrevive a cerrar la pestaña) y el
 * `Principal` resuelto. Conecta el cliente HTTP (`configureApi`) con este store: el token viaje
 * en cada petición y un 401 cierra la sesión.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Principal } from '@psp/contracts';
import { auth } from '../api/special';
import { configureApi, errorMessage } from '../api/client';

export type SessionStatus = 'idle' | 'loading' | 'authenticated' | 'error';

interface SessionState {
  token: string | undefined;
  principal: Principal | undefined;
  status: SessionStatus;
  error: string | undefined;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  /** Recupera el `Principal` a partir del token guardado (recarga de página). */
  restore: () => Promise<void>;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set, get) => ({
      token: undefined,
      principal: undefined,
      status: 'idle',
      error: undefined,
      async login(email, password) {
        set({ status: 'loading', error: undefined });
        try {
          const response = await auth.login(email, password);
          set({ token: response.token, principal: response.principal, status: 'authenticated', error: undefined });
        } catch (error) {
          set({ status: 'error', error: errorMessage(error) });
          throw error;
        }
      },
      logout() {
        set({ token: undefined, principal: undefined, status: 'idle', error: undefined });
        void auth.logout();
      },
      async restore() {
        if (!get().token) return;
        set({ status: 'loading' });
        try {
          const principal = await auth.me();
          set({ principal, status: 'authenticated' });
        } catch {
          set({ token: undefined, principal: undefined, status: 'idle' });
        }
      },
    }),
    {
      name: 'psp-admin-session',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ token: state.token }),
    },
  ),
);

// Se registra una sola vez al cargar el módulo: el cliente HTTP nunca importa el store directamente.
configureApi({
  getToken: () => useSessionStore.getState().token,
  onUnauthorized: () => useSessionStore.getState().logout(),
});
