/**
 * El montón: las seis formas apiladas y solapadas.
 *
 * Es el recurso central de la marca, y no es decorativo: el montón ES el significado. Formas
 * distintas, de tamaños distintos, apretadas unas contra otras y cabiendo todas. Una fila ordenada
 * de seis siluetas del mismo tamaño dice otra cosa —dice catálogo— así que aquí se solapan a
 * propósito y ninguna mide lo mismo que su vecina.
 *
 * La disposición es determinista: la misma semilla da el mismo montón siempre, de modo que la
 * pantalla en reposo no cambia de composición cada vez que React vuelve a dibujar.
 */
import type { CSSProperties } from 'react';
import { BlobFace, BLOB_VARIANTS, type BlobMood, type BlobVariant } from './BlobFace';
import { cx } from '../internal';
import type { BaseProps } from '../types';

export interface BlobPileProps extends BaseProps {
  /** Cuántas formas. Con más de seis, se repiten las variantes con otro tamaño y otra posición. */
  count?: number;
  /** Cómo se comportan. Se reparte para que el montón no lata al unísono. */
  mood?: BlobMood;
  /** Hacia dónde mira el montón entero. */
  gaze?: { x: number; y: number };
  /**
   * Cambia la composición sin cambiar su carácter. Dos montones con semillas distintas son
   * parientes, no copias; el mismo número da siempre el mismo montón.
   */
  seed?: number;
}

/** Posiciones del montón, en porcentaje del contenedor. Ajustadas a mano, no generadas. */
const LAYOUT: Array<{ left: number; top: number; scale: number; z: number }> = [
  { left: 6, top: 30, scale: 1.0, z: 3 },
  { left: 26, top: 6, scale: 0.72, z: 2 },
  { left: 40, top: 34, scale: 1.18, z: 5 },
  { left: 62, top: 14, scale: 0.84, z: 4 },
  { left: 70, top: 44, scale: 1.02, z: 6 },
  { left: 18, top: 56, scale: 0.66, z: 1 },
];

const MOODS: BlobMood[] = ['idle', 'curious', 'idle', 'excited', 'idle', 'curious'];

export function BlobPile({ count = 6, mood, gaze, seed = 0, className, ...rest }: BlobPileProps) {
  const total = Math.max(2, Math.min(12, Math.round(count)));
  return (
    <div className={cx('psp-blobpile', className)} aria-hidden="true" {...rest}>
      {Array.from({ length: total }, (_unused, i) => {
        const slot = LAYOUT[(i + seed) % LAYOUT.length]!;
        const variant = BLOB_VARIANTS[(i + seed) % BLOB_VARIANTS.length] as BlobVariant;
        // Cada vuelta encoge el montón un poco, para que las repeticiones queden al fondo y no
        // compitan con las seis primeras.
        const shrink = 1 - Math.floor(i / LAYOUT.length) * 0.22;
        const style: CSSProperties = {
          left: `${slot.left}%`,
          top: `${slot.top}%`,
          width: `${34 * slot.scale * shrink}%`,
          zIndex: slot.z,
        };
        return (
          <div key={i} className="psp-blobpile__slot" style={style}>
            <BlobFace
              variant={variant}
              mood={mood ?? MOODS[(i + seed) % MOODS.length]}
              gaze={gaze}
              size={200}
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * El arco de sonrisa: el elemento firma de la marca.
 *
 * En la lámina va encima del logotipo, como si fuera un signo diacrítico, y también solo debajo
 * de un botón. Es la marca reducida a un trazo, así que se dibuja aparte y se puede poner en
 * cualquier sitio donde haga falta firmar sin escribir el nombre.
 */
export function BrandSmile({ className, ...rest }: BaseProps) {
  return (
    <svg viewBox="0 0 100 34" className={cx('psp-smile', className)} aria-hidden="true" {...rest}>
      <path d="M6 6 C 26 30, 74 30, 94 6" fill="none" stroke="currentColor" strokeWidth={11} strokeLinecap="round" />
    </svg>
  );
}
