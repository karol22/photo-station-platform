import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BLOB_VARIANTS, BlobFace } from './BlobFace';
import { applyBrandingTheme, readBrandingAccents, DEFAULT_ACCENTS } from '../theme';

describe('formas ilustradas', () => {
  it('cada variante dibuja una silueta cerrada y distinta de las demás', () => {
    const paths = BLOB_VARIANTS.map((variant) => {
      const markup = renderToStaticMarkup(<BlobFace variant={variant} />);
      const match = /<path d="([^"]+)"/.exec(markup);
      expect(match, `variante ${variant} sin trazo`).not.toBeNull();
      const d = match![1]!;
      expect(d.endsWith('Z')).toBe(true);
      return d;
    });
    expect(new Set(paths).size).toBe(BLOB_VARIANTS.length);
  });

  it('ninguna silueta es una circunferencia: los radios varían', () => {
    for (const variant of BLOB_VARIANTS) {
      const markup = renderToStaticMarkup(<BlobFace variant={variant} />);
      const numbers = [...markup.matchAll(/C([\d.]+) ([\d.]+)/g)].map(([, x]) => Number(x));
      const spread = Math.max(...numbers) - Math.min(...numbers);
      expect(spread, `variante ${variant} demasiado uniforme`).toBeGreaterThan(20);
    }
  });

  it('es determinista: el mismo dibujo dos veces es idéntico', () => {
    expect(renderToStaticMarkup(<BlobFace variant={4} />)).toBe(renderToStaticMarkup(<BlobFace variant={4} />));
  });

  it('toma el color del token de acento y admite uno explícito', () => {
    expect(renderToStaticMarkup(<BlobFace variant={2} />)).toContain('var(--psp-color-accent-2)');
    expect(renderToStaticMarkup(<BlobFace variant={2} color="#123456" />)).toContain('#123456');
  });

  it('sin título es decorativa para quien usa lector de pantalla', () => {
    expect(renderToStaticMarkup(<BlobFace variant={1} />)).toContain('aria-hidden="true"');
    expect(renderToStaticMarkup(<BlobFace variant={1} title="Una forma" />)).toContain('<title>Una forma</title>');
  });
});

describe('colores de acento de la marca', () => {
  it('usa los de la marca cuando existen', () => {
    const accents = readBrandingAccents({ 'branding.palette.accents': ['#FF0000', '#00FF00'] });
    expect(accents).toHaveLength(6);
    expect(accents[0]).toBe('#FF0000');
    expect(accents[2]).toBe('#FF0000');
  });

  it('cae a la paleta de reserva sin configuración y descarta valores inválidos', () => {
    expect(readBrandingAccents({})).toEqual([...DEFAULT_ACCENTS]);
    expect(readBrandingAccents({ 'branding.palette.accents': ['no-es-color'] })).toEqual([...DEFAULT_ACCENTS]);
  });

  it('publica seis variables de acento en el tema', () => {
    const applied: Record<string, string> = {};
    applyBrandingTheme({ 'branding.palette.accents': ['#111111', '#222222'] }, {
      style: { setProperty: (name, value) => { applied[name] = value; } },
    });
    expect(applied['--psp-color-accent-1']).toBe('#111111');
    expect(applied['--psp-color-accent-6']).toBe('#222222');
  });
});

describe('la familia en movimiento', () => {
  const html = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node);

  it('sin gesto declarado se queda quieta, para no mover nada por accidente', () => {
    expect(html(<BlobFace variant={1} />)).toContain('data-mood="still"');
  });

  it('`animated` sigue significando el gesto en reposo', () => {
    expect(html(<BlobFace variant={1} animated />)).toContain('data-mood="idle"');
  });

  it('el gesto declarado manda sobre `animated`', () => {
    expect(html(<BlobFace variant={2} animated mood="excited" />)).toContain('data-mood="excited"');
  });

  it('la mirada desplaza la cara, no la silueta', () => {
    const markup = html(<BlobFace variant={3} gaze={{ x: 1, y: -1 }} />);
    expect(markup).toContain('psp-blob__face');
    expect(markup).toMatch(/translate\(3\.20 -3\.20\)/);
  });

  it('una mirada fuera de rango se recorta en vez de sacar los ojos de la cara', () => {
    expect(html(<BlobFace variant={3} gaze={{ x: 9, y: -9 }} />)).toMatch(/translate\(3\.20 -3\.20\)/);
  });

  it('sin mirada no se emite transformación alguna', () => {
    expect(html(<BlobFace variant={4} />)).not.toContain('translate(');
  });

  it('cada variante entra desfasada, para que seis juntas parezcan una bandada', () => {
    const a = html(<BlobFace variant={1} animated />);
    const f = html(<BlobFace variant={6} animated />);
    expect(a).toContain('animation-delay:0s');
    expect(f).not.toContain('animation-delay:0s');
  });
});
