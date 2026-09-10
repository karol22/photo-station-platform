/** Preferencias de interfaz: idioma y estado del sidebar. Persisten entre sesiones. */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { Locale } from '@psp/i18n';

interface PrefsState {
  locale: Locale;
  sidebarCollapsed: boolean;
  setLocale: (locale: Locale) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      locale: 'es',
      sidebarCollapsed: false,
      setLocale: (locale) => set({ locale }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
    }),
    { name: 'psp-admin-prefs', storage: createJSONStorage(() => localStorage) },
  ),
);
