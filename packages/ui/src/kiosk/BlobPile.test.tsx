import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BlobPile, BrandSmile } from './BlobPile';

const slots = (markup: string) => markup.split('psp-blobpile__slot').length - 1;
const positions = (markup: string) => [...markup.matchAll(/left:([\d.]+)%;top:([\d.]+)%;width:([\d.]+)%/g)].map(([, l, t, w]) => ({ l: +l!, t: +t!, w: +w! }));

describe('BlobPile', () => {
  it('apila seis formas por omisión', () => {
    expect(slots(renderToStaticMarkup(<BlobPile />))).toBe(6);
  });

  it('ninguna forma mide lo mismo que su vecina: una fila pareja diría catálogo, no montón', () => {
    const anchos = positions(renderToStaticMarkup(<BlobPile />)).map((p) => p.w);
    expect(new Set(anchos.map((w) => w.toFixed(2))).size).toBeGreaterThan(4);
  });

  it('las formas se solapan: no hay una rejilla escondida', () => {
    const p = positions(renderToStaticMarkup(<BlobPile />));
    const solapes = p.filter((a, i) => p.some((b, j) => j !== i && Math.abs(a.l - b.l) < a.w && Math.abs(a.t - b.t) < 40));
    expect(solapes.length).toBeGreaterThanOrEqual(4);
  });

  it('el montón no late al unísono: hay más de un gesto', () => {
    const markup = renderToStaticMarkup(<BlobPile />);
    const moods = new Set([...markup.matchAll(/data-mood="([a-z]+)"/g)].map(([, m]) => m));
    expect(moods.size).toBeGreaterThan(1);
  });

  it('un gesto declarado manda sobre el reparto', () => {
    const markup = renderToStaticMarkup(<BlobPile mood="excited" />);
    const moods = new Set([...markup.matchAll(/data-mood="([a-z]+)"/g)].map(([, m]) => m));
    expect([...moods]).toEqual(['excited']);
  });

  it('es determinista: la misma semilla da el mismo montón', () => {
    expect(renderToStaticMarkup(<BlobPile seed={3} />)).toBe(renderToStaticMarkup(<BlobPile seed={3} />));
  });

  it('otra semilla da otra composición, con el mismo carácter', () => {
    expect(renderToStaticMarkup(<BlobPile seed={1} />)).not.toBe(renderToStaticMarkup(<BlobPile seed={0} />));
  });

  it('con más de seis, las repeticiones quedan más chicas y al fondo', () => {
    const p = positions(renderToStaticMarkup(<BlobPile count={9} />));
    expect(p.length).toBe(9);
    expect(Math.max(...p.slice(6).map((x) => x.w))).toBeLessThan(Math.max(...p.slice(0, 6).map((x) => x.w)));
  });

  it('un número absurdo se recorta en vez de llenar la pantalla de formas', () => {
    expect(slots(renderToStaticMarkup(<BlobPile count={400} />))).toBe(12);
    expect(slots(renderToStaticMarkup(<BlobPile count={0} />))).toBe(2);
  });

  it('es decorativo: quien usa lector de pantalla no oye seis formas sin nombre', () => {
    expect(renderToStaticMarkup(<BlobPile />)).toContain('aria-hidden="true"');
  });
});

describe('BrandSmile', () => {
  it('es un solo arco que hereda el color de donde se ponga', () => {
    const markup = renderToStaticMarkup(<BrandSmile />);
    expect(markup).toContain('stroke="currentColor"');
    expect(markup.split('<path').length - 1).toBe(1);
  });
});
