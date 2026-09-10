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

/**
 * Cómo se comporta la forma, no sólo cómo está dibujada.
 *
 * Una cara quieta es un icono; una que parpadea y se mueve es un personaje, y un personaje es lo
 * que hace que alguien se acerque a mirar. Cada gesto es una animación de `transform` sobre el
 * SVG entero más un parpadeo sobre los ojos, así que cuesta lo que cuesta componer dos capas.
 */
export type BlobMood =
  /** Respira y parpadea. El estado por omisión de cualquier forma en pantalla. */
  | 'idle'
  /** Se inclina y mira: acompaña a algo que la persona debe mirar. */
  | 'curious'
  /** Rebota. La celebración. */
  | 'excited'
  /** Se encoge. Para lo que todavía no está disponible. */
  | 'shy'
  /** Se aplasta y estira, como quien habla. Para una instrucción. */
  | 'talk'
  /** Quieta del todo. Para el recorrido documental, donde nada debe distraer. */
  | 'still';

export interface BlobFaceProps extends BaseProps {
  variant: BlobVariant;
  /** Color de relleno. Si falta, usa el token de acento correspondiente a la variante. */
  color?: string;
  size?: number;
  /** Expresión; por defecto la propia de cada silueta. */
  expression?: BlobExpression;
  /** Balanceo suave, para pantallas en reposo. Equivale a `mood="idle"`. */
  animated?: boolean;
  /** Cómo se comporta la forma. Manda sobre `animated`. */
  mood?: BlobMood;
  /**
   * Hacia dónde mira, de -1 a 1 en cada eje. Sirve para dirigir la atención sin escribir una
   * palabra: seis formas mirando el precio dicen «mira el precio» en cualquier idioma.
   */
  gaze?: { x: number; y: number };
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

export interface BlobPathOptions {
  /**
   * Cuánto se aparta la silueta de un óvalo, de 0 a 1.
   *
   * `1` es el personaje. Un contenedor no es el personaje escalado: llevar el mismo `1` a un botón
   * o a un marco lo vuelve ilegible y, sobre una cara humana, la deforma. `0.45` sirve para
   * botones y fichas grandes, `0.30` para miniaturas, y `0.14` —casi recto— para todo lo que
   * contenga la cara de una persona, que vino a verse, no a verse deformada.
   */
  amplitude?: number;
  /**
   * Gira el arranque de los ocho radios. Dos contenedores de la misma variante puestos uno al lado
   * del otro se ven calcados; con un giro distinto son parientes en vez de copias.
   */
  spin?: number;
  /**
   * Proporción ancho/alto del lienzo. Con `1` la silueta es cuadrada; con otro valor se estira
   * para llenar un contenedor que no lo es, sin que los radios pierdan su relación.
   */
  ratio?: number;
}

/** Curva cerrada y suave a partir de los ocho puntos, con tangentes tipo Catmull-Rom. */
export function blobPath(radii: readonly number[], options: BlobPathOptions = {}): string {
  const amplitude = options.amplitude ?? 1;
  const spin = Math.round(options.spin ?? 0);
  const ratio = options.ratio ?? 1;
  const n = radii.length;
  const pts = radii.map((_unused, i) => {
    // El giro se aplica a QUÉ radio toca cada punto, no al ángulo: así la silueta rota su
    // personalidad sin rotar el lienzo, y los ojos siguen mirando al frente.
    const r = radii[(((i + spin) % n) + n) % n] ?? 1;
    // La amplitud interpola entre el óvalo (1) y la silueta completa (r).
    const shaped = 1 + (r - 1) * Math.min(1, Math.max(0, amplitude));
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const radius = BASE_RADIUS * shaped;
    return { x: CENTER + Math.cos(angle) * radius * ratio, y: CENTER + Math.sin(angle) * radius };
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

/** Cuánto se desplaza la mirada dentro de la cara, en unidades de lienzo. */
const GAZE_RANGE = 3.2;

export function BlobFace({ variant, color, size = 96, expression, animated, mood, gaze, title, className, ...rest }: BlobFaceProps): ReactElement {
  const shape = SHAPES[variant];
  const behaviour: BlobMood = mood ?? (animated ? 'idle' : 'still');
  // El retraso por variante desincroniza una fila de seis: seis formas moviéndose al unísono
  // parecen un banner; desfasadas, parecen una bandada.
  const style: CSSProperties = { animationDelay: `${(variant - 1) * 0.18}s` };
  const look = gaze
    ? { x: Math.max(-1, Math.min(1, gaze.x)) * GAZE_RANGE, y: Math.max(-1, Math.min(1, gaze.y)) * GAZE_RANGE }
    : { x: 0, y: 0 };
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      className={cx('psp-blob', className)}
      data-mood={behaviour}
      style={style}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <path d={blobPath(shape.radii)} fill={color ?? `var(--psp-color-accent-${variant})`} />
      <g className="psp-blob__face" transform={look.x || look.y ? `translate(${look.x.toFixed(2)} ${look.y.toFixed(2)})` : undefined}>
        {face(expression ?? shape.expression, shape.eyes)}
      </g>
    </svg>
  );
}

/** Las seis variantes en orden, para pintar la familia completa. */
export const BLOB_VARIANTS: BlobVariant[] = [1, 2, 3, 4, 5, 6];

/**
 * Los ocho radios de cada silueta, sin la cara. Los usa `BlobFrame` para que un contenedor con
 * forma de la familia salga de la MISMA geometría que el personaje: si algún día se retocan las
 * siluetas, los contenedores cambian con ellas y no se separan en silencio.
 */
export const BLOB_RADII: Record<BlobVariant, readonly number[]> = {
  1: SHAPES[1].radii,
  2: SHAPES[2].radii,
  3: SHAPES[3].radii,
  4: SHAPES[4].radii,
  5: SHAPES[5].radii,
  6: SHAPES[6].radii,
};
