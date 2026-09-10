/**
 * Forma orgánica con cara: el recurso ilustrado del kiosco.
 *
 * Son seis siluetas distintas y deterministas, cada una con su expresión, pensadas para dar
 * personalidad a los momentos sin texto: la cuenta regresiva, la elección de cuántas personas son,
 * la celebración del resultado. El color entra por props o por los tokens de acento del tema, así
 * que cada marca las viste con su propia paleta.
 */
import type { CSSProperties, ReactElement } from 'react';
import { cx } from '../internal';
import type { BaseProps } from '../types';

/** Las seis siluetas. Números y no nombres: la identidad la pone cada marca, no el design system. */
export type BlobVariant = 1 | 2 | 3 | 4 | 5 | 6;

export type BlobExpression = 'open' | 'happy' | 'calm' | 'grin' | 'curious' | 'wink';

export interface BlobFaceProps extends BaseProps {
  variant: BlobVariant;
  /** Color de relleno. Si falta, usa el token de acento correspondiente a la variante. */
  color?: string;
  size?: number;
  /** Expresión; por defecto la propia de cada silueta. */
  expression?: BlobExpression;
  /** Balanceo suave, para pantallas en reposo. */
  animated?: boolean;
  title?: string;
}

interface Shape {
  /** Ocho radios alrededor del centro, en fracción del radio base. */
  radii: [number, number, number, number, number, number, number, number];
  expression: BlobExpression;
  /** Desplazamiento del par de ojos respecto al centro, en unidades de lienzo. */
  eyes: { x: number; y: number; gap: number };
}

/**
 * Siluetas ajustadas a mano para que ninguna parezca un círculo y todas se distingan de lejos,
 * que es como se ven en una cabina: de pie y a un metro de la pantalla.
 */
const SHAPES: Record<BlobVariant, Shape> = {
  1: { radii: [1.02, 0.72, 0.88, 1.16, 0.94, 0.8, 1.1, 0.86], expression: 'open', eyes: { x: 2, y: -4, gap: 15 } },
  2: { radii: [0.84, 1.14, 0.9, 0.76, 1.06, 1.2, 0.82, 0.94], expression: 'happy', eyes: { x: -1, y: -2, gap: 17 } },
  3: { radii: [1.06, 0.98, 1.08, 0.96, 1.04, 0.98, 1.06, 0.96], expression: 'calm', eyes: { x: 0, y: 0, gap: 16 } },
  4: { radii: [0.9, 0.86, 1.18, 1.22, 1.04, 0.8, 0.86, 0.92], expression: 'grin', eyes: { x: 1, y: -6, gap: 18 } },
  5: { radii: [1.18, 0.9, 0.78, 0.88, 1.14, 1.02, 0.86, 1.08], expression: 'curious', eyes: { x: 5, y: -3, gap: 14 } },
  6: { radii: [0.8, 1.22, 0.84, 1.1, 0.82, 1.16, 0.88, 1.06], expression: 'wink', eyes: { x: -2, y: -3, gap: 16 } },
};

const CENTER = 50;
const BASE_RADIUS = 34;

/** Curva cerrada y suave a partir de los ocho puntos, con tangentes tipo Catmull-Rom. */
function blobPath(radii: readonly number[]): string {
  const n = radii.length;
  const pts = radii.map((r, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const radius = BASE_RADIUS * (r ?? 1);
    return { x: CENTER + Math.cos(angle) * radius, y: CENTER + Math.sin(angle) * radius };
  });
  const at = (i: number) => pts[((i % n) + n) % n]!;
  let d = `M${at(0).x.toFixed(2)} ${at(0).y.toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return `${d}Z`;
}

function face(expression: BlobExpression, eyes: Shape['eyes']): ReactElement {
  const cxLeft = CENTER + eyes.x - eyes.gap / 2;
  const cxRight = CENTER + eyes.x + eyes.gap / 2;
  const cy = CENTER + eyes.y;
  const ink = '#111111';
  switch (expression) {
    case 'happy':
      return (
        <g fill="none" stroke={ink} strokeWidth={3.2} strokeLinecap="round">
          <path d={`M${cxLeft - 4} ${cy + 1}q4 -5 8 0`} />
          <path d={`M${cxRight - 4} ${cy + 1}q4 -5 8 0`} />
        </g>
      );
    case 'calm':
      return (
        <g fill="none" stroke={ink} strokeWidth={3.2} strokeLinecap="round">
          <path d={`M${cxLeft - 4} ${cy}q4 4 8 0`} />
          <path d={`M${cxRight - 4} ${cy}q4 4 8 0`} />
          <path d={`M${CENTER + eyes.x - 5} ${cy + 12}q5 4 10 0`} strokeWidth={2.6} />
        </g>
      );
    case 'grin':
      return (
        <g>
          <ellipse cx={cxLeft} cy={cy} rx={3.1} ry={3.9} fill={ink} />
          <ellipse cx={cxRight} cy={cy} rx={3.1} ry={3.9} fill={ink} />
          <path d={`M${CENTER + eyes.x - 7} ${cy + 10}q7 8 14 0`} fill="none" stroke={ink} strokeWidth={3} strokeLinecap="round" />
        </g>
      );
    case 'curious':
      return (
        <g>
          <ellipse cx={cxLeft + 2} cy={cy} rx={3.1} ry={4.1} fill={ink} />
          <ellipse cx={cxRight + 2} cy={cy} rx={3.1} ry={4.1} fill={ink} />
        </g>
      );
    case 'wink':
      return (
        <g>
          <ellipse cx={cxLeft} cy={cy} rx={3.1} ry={3.9} fill={ink} />
          <path d={`M${cxRight - 4} ${cy}q4 -4 8 0`} fill="none" stroke={ink} strokeWidth={3.2} strokeLinecap="round" />
        </g>
      );
    default:
      return (
        <g>
          <ellipse cx={cxLeft} cy={cy} rx={3.2} ry={4.2} fill={ink} />
          <ellipse cx={cxRight} cy={cy} rx={3.2} ry={4.2} fill={ink} />
        </g>
      );
  }
}

export function BlobFace({ variant, color, size = 96, expression, animated, title, className, ...rest }: BlobFaceProps): ReactElement {
  const shape = SHAPES[variant];
  const style: CSSProperties = { animationDelay: `${(variant - 1) * 0.18}s` };
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      className={cx('psp-blob', animated && 'psp-blob--animated', className)}
      style={style}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <path d={blobPath(shape.radii)} fill={color ?? `var(--psp-color-accent-${variant})`} />
      {face(expression ?? shape.expression, shape.eyes)}
    </svg>
  );
}

/** Las seis variantes en orden, para pintar la familia completa. */
export const BLOB_VARIANTS: BlobVariant[] = [1, 2, 3, 4, 5, 6];
