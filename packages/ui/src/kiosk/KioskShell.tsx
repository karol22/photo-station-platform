import type { ComponentProps, ReactNode } from 'react';
import { cx } from '../internal';

export interface KioskShellProps extends Omit<ComponentProps<'div'>, 'children'> {
  /** Slot de branding (logo, nombre público) en el encabezado. */
  brand?: ReactNode;
  /** Slot para `LangSwitch` en el encabezado. */
  langSwitch?: ReactNode;
  /** Contenido adicional al inicio / final del encabezado. */
  headerStart?: ReactNode;
  headerEnd?: ReactNode;
  /** Slot del pie (normalmente `TimeoutBar`). */
  footer?: ReactNode;
  /** Capa de fondo (imágenes de atracción, degradados). */
  background?: ReactNode;
  hideHeader?: boolean;
  /**
   * Modo a sangre: el color llega al borde del vidrio, sin márgenes ni encabezado.
   *
   * Es obligatorio donde la pantalla tiene que verse desde el pasillo o donde la persona se está
   * mirando a sí misma. Un margen alrededor del color convierte la cabina en una ventana de
   * aplicación, que es exactamente lo que no es.
   */
  bleed?: boolean;
  /** La marquesina: la banda que no se mueve de sitio en ninguna pantalla. */
  marquee?: ReactNode;
  /** Alineación vertical del contenido principal. */
  contentAlign?: 'start' | 'center';
  /** Texto accesible del área principal. */
  mainLabel?: string;
  children?: ReactNode;
  'data-testid'?: string;
}

/**
 * Marco de pantalla del kiosco: encabezado (branding + idioma), contenido y pie (tiempo restante).
 * Bloquea la selección de texto y usa `touch-action: manipulation`.
 */
export function KioskShell({
  brand,
  langSwitch,
  headerStart,
  headerEnd,
  footer,
  background,
  hideHeader = false,
  bleed = false,
  marquee,
  contentAlign = 'start',
  mainLabel,
  className,
  children,
  ...rest
}: KioskShellProps) {
  return (
    <div className={cx('psp-kiosk-shell', className)} data-bleed={bleed ? 'true' : undefined} {...rest}>
      {marquee}
      {background !== undefined ? (
        <div className="psp-kiosk-shell__background" aria-hidden="true">
          {background}
        </div>
      ) : null}
      {hideHeader ? null : (
        <header className="psp-kiosk-shell__header">
          <div className="psp-kiosk-shell__header-start">
            {headerStart}
            {brand !== undefined ? <div className="psp-kiosk-shell__brand">{brand}</div> : null}
          </div>
          <div className="psp-kiosk-shell__header-end">
            {headerEnd}
            {langSwitch}
          </div>
        </header>
      )}
      <main className="psp-kiosk-shell__main" data-align={contentAlign} aria-label={mainLabel}>
        {children}
      </main>
      {footer !== undefined ? <footer className="psp-kiosk-shell__footer">{footer}</footer> : null}
    </div>
  );
}
