import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LensEyes, LENS_BEZEL_LIMIT, LENS_WIDE_SEC, lensStateFor } from './LensEyes';

const source = (values: Record<string, unknown>) => ({ effective: { values } });
const html = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node);

describe('el guion de los ojos del lente', () => {
  it('en reposo y trabajando los ojos están abiertos', () => {
    expect(lensStateFor('rest')).toBe('rest');
    expect(lensStateFor('work')).toBe('ready');
  });

  it('crecen exactamente a dos segundos del disparo, no antes', () => {
    expect(lensStateFor('countdown', LENS_WIDE_SEC + 1)).toBe('ready');
    expect(lensStateFor('countdown', LENS_WIDE_SEC)).toBe('wide');
    expect(lensStateFor('countdown', 1)).toBe('wide');
  });

  it('el parpadeo ES el obturador: en el disparo se cierran', () => {
    expect(lensStateFor('shot')).toBe('shut');
    expect(lensStateFor('shot', 0)).toBe('shut');
  });
});

describe('el anclaje de los ojos', () => {
  it('sin configuración se quedan donde la cámara viene de fábrica', () => {
    const markup = html(<LensEyes bundle={undefined} />);
    expect(markup).toContain('left:50%');
    expect(markup).toContain('top:6%');
  });

  it('el sitio del lente lo manda el bundle, porque cambia con el aparato', () => {
    const markup = html(<LensEyes bundle={source({ 'kiosk.lens.offsetX': 38, 'kiosk.lens.offsetY': 11 })} />);
    expect(markup).toContain('left:38%');
    expect(markup).toContain('top:11%');
  });

  it('con la cámara en el bisel bajan del canto y sale la flecha, en vez de recortarse', () => {
    const markup = html(<LensEyes bundle={source({ 'kiosk.lens.offsetY': 1 })} />);
    expect(markup).toContain(`top:${LENS_BEZEL_LIMIT}%`);
    expect(markup).toContain('kiosk-lens__arrow');
  });

  it('con la cámara donde se ve, no hay flecha', () => {
    expect(html(<LensEyes bundle={source({ 'kiosk.lens.offsetY': 6 })} />)).not.toContain('kiosk-lens__arrow');
  });

  it('el estado viaja al DOM, que es donde el CSS lo lee', () => {
    expect(html(<LensEyes bundle={undefined} state="shut" />)).toContain('data-state="shut"');
  });
});
