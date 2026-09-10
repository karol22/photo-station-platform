/**
 * Panel de enlace efímero (ADR-011): la cabina muestra un QR de un solo uso que el cliente escanea
 * con su teléfono. No se crea cuenta, no se escribe nada en la pantalla y el código rota cada pocos
 * segundos, así que una foto de la pantalla ajena queda inservible enseguida.
 *
 * El enlace identifica a la persona ante el Club. **Nunca transporta la fotografía**: las imágenes
 * no salen de la máquina, ni por aquí ni por ningún otro sitio. Por eso el panel habla de
 * membresía y de un reloj corto, y jamás de descargar fotos.
 *
 * Reglas de la última pulgada, que es donde se pierde el producto entero: el cuadro va sobre papel
 * blanco puro con zona de silencio de cuatro módulos, grande, sin nada animado debajo y nunca
 * encima de la fotografía ni sobre un campo de color. Un QR sobre color no escanea.
 */
import { useEffect, useState, type ReactElement } from 'react';
import type { CustomerHandoff } from '@psp/contracts';
import { formatClock } from '@psp/ui';
import { qrMatrix } from '../lib/qr';
import { useT } from '../i18n';

/** Módulos de zona de silencio alrededor del código. Sin ella muchos teléfonos no enganchan. */
export const QR_QUIET_MODULES = 4;

/**
 * Dibuja la matriz del QR como SVG: nítido a cualquier tamaño y sin depender del canvas.
 *
 * El papel y la tinta salen de los tokens del sistema, no de literales: `--psp-qr-paper` es el
 * blanco puro reservado al código y la tinta es la única del producto, que ya garantiza contraste
 * contra el papel. El tamaño real lo pone la hoja de estilo.
 */
export function QrMatrix({ modules }: { modules: boolean[][] }): ReactElement | null {
  if (modules.length === 0) return null;
  const n = modules.length;
  const quiet = QR_QUIET_MODULES;
  const total = n + quiet * 2;
  const rects: string[] = [];
  for (let y = 0; y < n; y++) {
    const row = modules[y];
    if (!row) continue;
    for (let x = 0; x < n; x++) if (row[x]) rects.push(`M${x + quiet} ${y + quiet}h1v1h-1z`);
  }
  return (
    <svg width={total} height={total} viewBox={`0 0 ${total} ${total}`} role="img" aria-hidden="true" className="kiosk-handoff__qr">
      <rect width={total} height={total} fill="var(--psp-qr-paper)" />
      <path d={rects.join('')} fill="var(--psp-color-text)" shapeRendering="crispEdges" />
    </svg>
  );
}

/** Segundos que le quedan al enlace antes de caducar, según su propia marca de tiempo. */
export function secondsLeft(handoff: Pick<CustomerHandoff, 'expiresAt'>, nowMs: number): number {
  return Math.max(0, Math.ceil((Date.parse(handoff.expiresAt) - nowMs) / 1000));
}

export function HandoffPanel({ handoff, onSimulate, canSimulate }: {
  handoff: CustomerHandoff | undefined;
  onSimulate?: (outcome: 'link' | 'expire') => void;
  canSimulate?: boolean;
}): ReactElement | null {
  const { t } = useT();
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (!handoff) return undefined;
    const update = (): void => setLeft(secondsLeft(handoff, Date.now()));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [handoff]);

  if (!handoff || handoff.state === 'unavailable') return null;

  if (handoff.state === 'coming_soon') {
    return (
      <div className="kiosk-handoff" data-testid="handoff-coming-soon">
        <p className="kiosk-handoff__instruccion">{t('kiosk.handoff.coming_soon')}</p>
      </div>
    );
  }

  if (handoff.state === 'linked') {
    return (
      <div className="kiosk-handoff kiosk-handoff--done" data-testid="handoff-linked">
        <p className="kiosk-handoff__instruccion">{t('kiosk.handoff.linked')}</p>
        <p className="kiosk-handoff__nota">{t('kiosk.handoff.linked_hint')}</p>
      </div>
    );
  }

  if (handoff.state === 'expired' || handoff.state === 'cancelled' || handoff.state === 'failed') {
    return (
      <div className="kiosk-handoff kiosk-handoff--done" data-testid="handoff-expired">
        <p className="kiosk-handoff__instruccion">{t('kiosk.handoff.expired')}</p>
      </div>
    );
  }

  const scanning = handoff.method === 'scan_qr' || handoff.method === 'nfc_tap';
  // Si el código no se puede dibujar, el mecanismo real pasa a ser el código corto y el texto lo dice:
  // más vale pedir seis caracteres que enseñar un cuadro que el teléfono no lee.
  const modules = handoff.url && !scanning ? qrMatrix(handoff.url) : undefined;
  const instruction = scanning ? handoff.method : modules ? 'display_qr' : 'short_code';

  return (
    <div className="kiosk-handoff" data-testid="handoff">
      <p className="kiosk-handoff__instruccion">{t(`kiosk.handoff.instruction.${instruction}`)}</p>
      {modules ? (
        <div className="kiosk-handoff__papel" data-testid="handoff-paper">
          <QrMatrix modules={modules} />
        </div>
      ) : null}
      {/* El único texto que un ser humano transcribe de pie: el más grande después del rótulo. */}
      {handoff.code ? (
        <p className="kiosk-handoff__code" aria-label={t('kiosk.handoff.code')} data-testid="handoff-code">
          {handoff.code}
        </p>
      ) : null}
      <p className="kiosk-handoff__reloj" data-testid="handoff-clock">{t('kiosk.done.scan_window', { clock: formatClock(left) })}</p>
      <p className="kiosk-handoff__nota">{t('kiosk.handoff.privacy')} · {t('kiosk.done.link_is_membership')}</p>
      {canSimulate && onSimulate ? (
        <div className="kiosk-handoff__sim">
          <span className="kiosk-handoff__nota">{t('kiosk.handoff.simulate')}</span>
          <button type="button" className="kiosk-chip" onClick={() => onSimulate('link')} data-testid="handoff-simulate-link">
            {t('kiosk.handoff.simulate_link')}
          </button>
          <button type="button" className="kiosk-chip" onClick={() => onSimulate('expire')}>
            {t('kiosk.handoff.simulate_expire')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
