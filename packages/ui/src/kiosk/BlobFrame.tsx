/**
 * Contenedor con forma de la familia.
 *
 * La marca no tiene tarjetas: tiene siluetas. Este componente permite que un botón, una ficha o un
 * marco tengan la forma de la familia sin ser el personaje escalado, que es el error que vuelve
 * ilegible cualquier contenido puesto encima.
 *
 * La amplitud es la única decisión: `1` es el personaje y aquí nunca se usa; `0.45` sirve para un
 * botón o una ficha grande; `0.30` para una miniatura; y `0.14` —casi recto— para todo lo que
 * contenga la cara de una persona, que vino a verse y no a verse deformada.
 *
 * Se dibuja con `clip-path: url(#…)` sobre un SVG en línea porque `clip-path` recorta el contenido
 * real —una foto, un vídeo— sin repintarlo, y el compositor lo resuelve solo. El giro hace que dos
 * fichas de la misma variante puestas lado a lado sean parientes en vez de copias.
 */
import { useId, type CSSProperties, type ReactNode } from 'react';
import { blobPath, BLOB_RADII, type BlobVariant } from './BlobFace';
import { cx } from '../internal';

export interface BlobFrameProps {
  variant: BlobVariant;
  /** Cuánto se aparta de un óvalo, de 0 a 1. Lo que contenga una cara humana no pasa de 0.14. */
  amplitude?: number;
  /** Gira el arranque de los radios, para que dos fichas iguales no se vean calcadas. */
  spin?: number;
  /** Color de relleno. Sin él, el marco sólo recorta y no pinta. */
  color?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  'data-testid'?: string;
}

/** La amplitud máxima que se permite sobre la cara de una persona. */
export const FACE_SAFE_AMPLITUDE = 0.14;

export function BlobFrame({ variant, amplitude = 0.45, spin = 0, color, className, style, children, ...rest }: BlobFrameProps) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const clipId = `psp-blob-clip-${id}`;
  const d = blobPath(BLOB_RADII[variant], { amplitude, spin });
  return (
    <div
      className={cx('psp-blobframe', className)}
      style={{ ...style, clipPath: `url(#${clipId})`, ...(color ? { background: color } : {}) }}
      {...rest}
    >
      <svg className="psp-blobframe__def" aria-hidden="true" focusable="false">
        <defs>
          {/* `objectBoundingBox` hace que el recorte siga al tamaño del contenedor sin recalcular
              el camino: el mismo path sirve a una ficha de 150 px y a un espejo de 1080. */}
          <clipPath id={clipId} clipPathUnits="objectBoundingBox">
            <path d={d} transform="scale(0.01)" />
          </clipPath>
        </defs>
      </svg>
      {children}
    </div>
  );
}
