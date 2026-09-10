import { createContext, useContext, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import {
  buildThemeVariables,
  readBrandingPalette,
  resolvePalette,
  type BrandingPalette,
  type ThemeRoot,
} from './theme';

export type ThemeMode = 'kiosk' | 'admin';

export interface ThemeContextValue {
  palette: Required<BrandingPalette>;
  variables: Record<string, string>;
  mode: ThemeMode | undefined;
}

const DEFAULT_CONTEXT: ThemeContextValue = {
  palette: resolvePalette({}),
  variables: buildThemeVariables({}),
  mode: undefined,
};

const ThemeContext = createContext<ThemeContextValue>(DEFAULT_CONTEXT);

export interface ThemeProviderProps {
  /** Valores efectivos del bundle (`effective.values`); se leen las claves `branding.palette.*`. */
  values?: Record<string, unknown>;
  /** Paleta explícita; tiene prioridad sobre `values`. */
  palette?: BrandingPalette;
  /** Si se indica, agrega la clase raíz `psp-kiosk` / `psp-admin` al `root`. */
  mode?: ThemeMode;
  /** Elemento donde se fijan las variables; por defecto `document.documentElement`. */
  root?: ThemeRoot | null;
  children?: ReactNode;
}

/** Aplica el tema de branding en `useEffect` y lo expone por contexto (`useTheme`). */
export function ThemeProvider({ values, palette, mode, root, children }: ThemeProviderProps) {
  const resolved = useMemo(
    () => resolvePalette({ ...readBrandingPalette(values ?? {}), ...(palette ?? {}) }),
    [values, palette],
  );
  const variables = useMemo(() => buildThemeVariables(resolved), [resolved]);

  useEffect(() => {
    const target = root ?? (typeof document !== 'undefined' ? document.documentElement : null);
    if (!target) return undefined;
    for (const [name, value] of Object.entries(variables)) target.style.setProperty(name, value);
    if (mode) target.classList?.add(`psp-${mode}`);
    return () => {
      if (mode) target.classList?.remove(`psp-${mode}`);
    };
  }, [variables, root, mode]);

  const value = useMemo<ThemeContextValue>(() => ({ palette: resolved, variables, mode }), [resolved, variables, mode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Paleta y variables activas; fuera de un `ThemeProvider` devuelve los defaults. */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
