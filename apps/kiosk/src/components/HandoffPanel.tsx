/**
 * Panel de enlace efímero (ADR-011): la cabina muestra un QR de un solo uso que el cliente escanea
 * con su teléfono. No se crea cuenta, no se escribe nada en la pantalla y el código rota cada pocos
 * segundos, así que una foto de la pantalla ajena queda inservible enseguida.
 */
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import type { CustomerHandoff } from '@psp/contracts';
import { Icon, Spinner, StatusPill } from '@psp/ui';
import { qrMatrix } from '../lib/qr';
import { useT } from '../i18n';

/** Dibuja la matriz del QR como SVG: nítido a cualquier tamaño y sin depender del canvas. */
function QrMatrix({ payload, size = 220 }: { payload: string; size?: number }): ReactElement | null {
  const modules = useMemo(() => qrMatrix(payload), [payload]);
  if (!modules || modules.length === 0) return null;
  const n = modules.length;
  // Zona tranquila de 4 módulos: sin ella muchos teléfonos no enganchan el código.
  const quiet = 4;
  const total = n + quiet * 2;
  const rects: string[] = [];
  for (let y = 0; y < n; y++) {
    const row = modules[y];
    if (!row) continue;
    for (let x = 0; x < n; x++) if (row[x]) rects.push(`M${x + quiet} ${y + quiet}h1v1h-1z`);
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${total} ${total}`} role="img" aria-hidden="true" className="kiosk-handoff__qr">
      <rect width={total} height={total} fill="#FFFFFF" />
      <path d={rects.join('')} fill="#000000" shapeRendering="crispEdges" />
    </svg>
  );
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
    const update = (): void => setLeft(Math.max(0, Math.ceil((Date.parse(handoff.expiresAt) - Date.now()) / 1000)));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [handoff]);

  if (!handoff || handoff.state === 'unavailable') return null;

  if (handoff.state === 'coming_soon') {
    return (
      <StatusPill tone="info" icon={<Icon name="clock" />}>
        {t('kiosk.handoff.coming_soon')}
      </StatusPill>
    );
  }

  if (handoff.state === 'linked') {
    return (
      <div className="kiosk-handoff kiosk-handoff--done" data-testid="handoff-linked">
        <StatusPill tone="ok" icon={<Icon name="check" />} size="lg">{t('kiosk.handoff.linked')}</StatusPill>
        <p className="kiosk-small kiosk-muted">{t('kiosk.handoff.linked_hint')}</p>
      </div>
    );
  }

  if (handoff.state === 'expired' || handoff.state === 'cancelled' || handoff.state === 'failed') {
    return (
      <div className="kiosk-handoff" data-testid="handoff-expired">
        <StatusPill tone="warn" icon={<Icon name="clock" />} size="lg">{t('kiosk.handoff.expired')}</StatusPill>
      </div>
    );
  }

  const scanning = handoff.method === 'scan_qr' || handoff.method === 'nfc_tap';

  return (
    <div className="kiosk-handoff" data-testid="handoff">
      <p className="kiosk-lead" style={{ margin: 0 }}>
        {scanning ? t(`kiosk.handoff.instruction.${handoff.method}`) : t('kiosk.handoff.instruction.display_qr')}
      </p>
      {scanning ? (
        <div className="kiosk-handoff__scan">
          <Icon name="camera" size={72} />
          {handoff.state === 'pending' ? <Spinner size="lg" label={t('kiosk.handoff.reading')} /> : null}
        </div>
      ) : handoff.url ? (
        <QrMatrix payload={handoff.url} />
      ) : null}
      {handoff.code && !scanning ? (
        <p className="kiosk-handoff__code" aria-label={t('kiosk.handoff.code')}>
          {handoff.code}
        </p>
      ) : null}
      <p className="kiosk-small kiosk-muted">
        {t('kiosk.handoff.privacy')} · {t('kiosk.handoff.expires_in', { seconds: left })}
      </p>
      {canSimulate && onSimulate ? (
        <div className="kiosk-handoff__sim">
          <span className="kiosk-small kiosk-muted">{t('kiosk.handoff.simulate')}</span>
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
