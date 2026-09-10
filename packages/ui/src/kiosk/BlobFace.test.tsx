import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BLOB_VARIANTS, BlobFace } from './BlobFace';
import { applyBrandingTheme, readBrandingAccents, DEFAULT_ACCENTS } from '../theme';

/** Los bultos de una variante, leídos del dibujo. */
function lobes(variant: (typeof BLOB_VARIANTS)[number]) {
  const markup = renderToStaticMarkup(<BlobFace variant={variant} />);
  return [...markup.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)].map(([, cx, cy, r]) => ({
    cx: Number(cx),
    cy: Number(cy),
    r: Number(r),
  }));
}

describe('formas ilustradas', () => {
  it('cada variante es un montón de bultos, y ninguna es un solo círculo', () => {
    for (const variant of BLOB_VARIANTS) {
      expect(lobes(variant).length, `variante ${variant}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('los bultos se solapan, para que se fundan en una nube en vez de leerse como pelotas', () => {
    for (const variant of BLOB_VARIANTS) {
      const list = lobes(variant);
      for (const lobe of list.slice(1)) {
        // Cada bulto toca a alguno de los demás con holgura: distancia menor que la suma de radios.
        const tocaAAlguno = list.some((otro) => otro !== lobe && Math.hypot(otro.cx - lobe.cx, otro.cy - lobe.cy) < otro.r + lobe.r - 4);
        expect(tocaAAlguno, `variante ${variant}: un bulto suelto`).toBe(true);
      }
    }
  });

  it('las seis siluetas son distintas entre sí', () => {
    const firmas = BLOB_VARIANTS.map((variant) => JSON.stringify(lobes(variant)));
    expect(new Set(firmas).size).toBe(BLOB_VARIANTS.length);
  });

  it('ninguna silueta se sale del lienzo', () => {
    for (const variant of BLOB_VARIANTS) {
      for (const lobe of lobes(variant)) {
        expect(lobe.cx - lobe.r, `variante ${variant}`).toBeGreaterThanOrEqual(0);
        expect(lobe.cx + lobe.r, `variante ${variant}`).toBeLessThanOrEqual(100);
        expect(lobe.cy - lobe.r, `variante ${variant}`).toBeGreaterThanOrEqual(0);
        expect(lobe.cy + lobe.r, `variante ${variant}`).toBeLessThanOrEqual(100);
      }
    }
  });

  it('la silueta va sin contorno: el color es plano, como en la lámina de marca', () => {
    expect(renderToStaticMarkup(<BlobFace variant={1} />)).not.toContain('stroke=');
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
