import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MARQUEE_BULBS, Marquee } from './Marquee';

const html = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node);
const bulbs = (markup: string) => markup.split('psp-marquee__bulb').length - 1;
const lit = (markup: string) => markup.split('data-lit="true"').length - 1;

describe('Marquee', () => {
  it('pinta veinticuatro focos por defecto', () => {
    expect(bulbs(html(<Marquee />))).toBe(MARQUEE_BULBS);
  });

  it('con `wait` los focos encendidos son el tiempo que queda', () => {
    expect(lit(html(<Marquee cadence="wait" remaining={0.5} bulbs={24} />))).toBe(12);
    expect(lit(html(<Marquee cadence="wait" remaining={1} bulbs={24} />))).toBe(24);
  });

  it('mientras quede algo de tiempo queda al menos un foco encendido', () => {
    expect(lit(html(<Marquee cadence="wait" remaining={0.01} bulbs={24} />))).toBe(1);
  });

  it('agotado el tiempo no queda ninguno', () => {
    expect(lit(html(<Marquee cadence="wait" remaining={0} bulbs={24} />))).toBe(0);
  });

  it('un tiempo fuera de rango se recorta en vez de romper la banda', () => {
    expect(lit(html(<Marquee cadence="wait" remaining={5} bulbs={24} />))).toBe(24);
    expect(lit(html(<Marquee cadence="wait" remaining={-3} bulbs={24} />))).toBe(0);
  });

  it('fuera de `wait` todos los focos participan, y el tiempo no los apaga', () => {
    expect(lit(html(<Marquee cadence="call" remaining={0} />))).toBe(MARQUEE_BULBS);
  });

  it('nunca baja de cuatro focos, para que siga leyéndose como una banda', () => {
    expect(bulbs(html(<Marquee bulbs={1} />))).toBe(4);
  });

  it('los focos recorren los seis acentos de la marca, no uno solo', () => {
    const markup = html(<Marquee bulbs={12} />);
    for (let i = 1; i <= 6; i++) expect(markup).toContain(`--psp-color-accent-${i}`);
  });

  it('es decorativa para quien usa lector de pantalla: el tiempo se dice con palabras en otro sitio', () => {
    expect(html(<Marquee />)).toContain('aria-hidden="true"');
  });
});
