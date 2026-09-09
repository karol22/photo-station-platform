/**
 * Vista previa de cámara en espejo (como un espejo real) con capa de superposición SVG en
 * coordenadas del frame de análisis (640×360), que el CSS escala junto con el video.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { Spinner } from '@psp/ui';
import type { CameraSource } from '../camera/source';
import { ANALYSIS_HEIGHT, ANALYSIS_WIDTH } from '../camera/useCamera';

export interface CameraViewProps {
  source: CameraSource | undefined;
  overlay?: ReactNode;
  loadingLabel: string;
  mirror?: boolean;
  className?: string;
}

export function CameraView({ source, overlay, loadingLabel, mirror = true, className }: CameraViewProps) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = host.current;
    if (!container || !source) return;
    const element = source.element;
    element.className = 'kiosk-camera__media';
    container.appendChild(element);
    return () => {
      if (element.parentElement === container) container.removeChild(element);
    };
  }, [source]);

  return (
    <div className={`kiosk-camera${mirror ? ' kiosk-camera--mirror' : ''}${className ? ` ${className}` : ''}`} data-testid="camera-view">
      <div ref={host} className="kiosk-camera__host" />
      {!source ? (
        <div className="kiosk-camera__loading">
          <Spinner size="lg" label={loadingLabel} />
          <p>{loadingLabel}</p>
        </div>
      ) : null}
      {overlay ? (
        <svg className="kiosk-camera__overlay" viewBox={`0 0 ${ANALYSIS_WIDTH} ${ANALYSIS_HEIGHT}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          {overlay}
        </svg>
      ) : null}
    </div>
  );
}
