import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BLOB_RADII, blobPath } from './BlobFace';
import { BlobFrame, FACE_SAFE_AMPLITUDE } from './BlobFrame';

/** Los puntos de un camino, para poder medir cuánto se aparta de un óvalo. */
function points(d: string): Array<{ x: number; y: number }> {
  return [...d.matchAll(/(-?\d+\.\d+) (-?\d+\.\d+)(?=C|Z|$)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
}

/** Cuánto varía el radio alrededor del centro: 0 en un óvalo perfecto. */
function irregularity(d: string): number {
  const radii = points(d).map((p) => Math.hypot(p.x - 50, p.y - 50));
  return Math.max(...radii) - Math.min(...radii);
}

describe('blobPath con amplitud', () => {
  it('con amplitud cero la silueta es un óvalo', () => {
    expect(irregularity(blobPath(BLOB_RADII[1], { amplitude: 0 }))).toBeLessThan(0.01);
  });

  it('con amplitud uno es la silueta del personaje, igual que antes', () => {
    expect(blobPath(BLOB_RADII[4], { amplitude: 1 })).toBe(blobPath(BLOB_RADII[4]));
  });

  it('más amplitud es más irregular, siempre', () => {
    const suave = irregularity(blobPath(BLOB_RADII[2], { amplitude: 0.14 }));
    const media = irregularity(blobPath(BLOB_RADII[2], { amplitude: 0.45 }));
    const plena = irregularity(blobPath(BLOB_RADII[2], { amplitude: 1 }));
    expect(suave).toBeLessThan(media);
    expect(media).toBeLessThan(plena);
  });

  it('la amplitud segura para caras deja la forma casi recta', () => {
    // Menos de un 8 % del radio base: se reconoce la familia sin deformar a nadie.
    expect(irregularity(blobPath(BLOB_RADII[5], { amplitude: FACE_SAFE_AMPLITUDE }))).toBeLessThan(34 * 0.08);
  });

  it('una amplitud fuera de rango se recorta en vez de romper la curva', () => {
    expect(blobPath(BLOB_RADII[3], { amplitude: 5 })).toBe(blobPath(BLOB_RADII[3], { amplitude: 1 }));
    expect(blobPath(BLOB_RADII[3], { amplitude: -2 })).toBe(blobPath(BLOB_RADII[3], { amplitude: 0 }));
  });

  it('el giro cambia la silueta sin cambiar cuánto se aparta del óvalo', () => {
    const sin = blobPath(BLOB_RADII[6], { amplitude: 0.45 });
    const con = blobPath(BLOB_RADII[6], { amplitude: 0.45, spin: 3 });
    expect(con).not.toBe(sin);
    // El camino se serializa a dos decimales, así que dos giros del mismo conjunto de radios no
    // dan exactamente el mismo número: la tolerancia es la del redondeo, no la del cálculo.
    expect(irregularity(con)).toBeCloseTo(irregularity(sin), 1);
  });

  it('un giro de una vuelta completa devuelve la misma silueta', () => {
    expect(blobPath(BLOB_RADII[1], { spin: 8 })).toBe(blobPath(BLOB_RADII[1], { spin: 0 }));
  });

  it('es determinista: dos llamadas iguales dan el mismo camino', () => {
    const opts = { amplitude: 0.3, spin: 2 };
    expect(blobPath(BLOB_RADII[2], opts)).toBe(blobPath(BLOB_RADII[2], opts));
  });
});

describe('BlobFrame', () => {
  it('recorta su contenido con la forma de la familia', () => {
    const html = renderToStaticMarkup(
      <BlobFrame variant={2}>
        <img src="foto.jpg" alt="" />
      </BlobFrame>,
    );
    expect(html).toContain('clipPath');
    expect(html).toContain('clip-path:url(');
    expect(html).toContain('foto.jpg');
  });

  it('cada marco tiene su propio recorte, para que dos no se pisen', () => {
    const html = renderToStaticMarkup(
      <div>
        <BlobFrame variant={1} />
        <BlobFrame variant={2} />
      </div>,
    );
    const ids = [...html.matchAll(/id="(psp-blob-clip-[^"]+)"/g)].map((m) => m[1]);
    expect(new Set(ids).size).toBe(2);
  });
});
