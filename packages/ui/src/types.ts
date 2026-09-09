import type { ReactNode } from 'react';

/** Tono semántico compartido por badges, alertas, avisos y pastillas de estado. */
export type Tone = 'neutral' | 'ok' | 'warn' | 'danger' | 'info';

/** Props que acepta todo componente del design system. */
export interface BaseProps {
  className?: string;
  'data-testid'?: string;
}

/**
 * Renderizador de enlaces: permite integrar react-router (u otro router) sin que `@psp/ui`
 * dependa de él. Recibe el ítem, el contenido ya compuesto y los atributos que el enlace debe
 * conservar (clase, `aria-current`, `title`).
 */
export type LinkRenderer<T> = (
  item: T,
  content: ReactNode,
  attrs: { className: string; 'aria-current'?: 'page'; title?: string },
) => ReactNode;
