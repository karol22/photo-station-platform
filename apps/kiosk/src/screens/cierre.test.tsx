/**
 * Hechos del final del recorrido que no se pueden perder en un rediseño.
 *
 * No se prueba «se ve bonito»: se prueban las tres cosas que hacen que la entrega funcione o se
 * caiga en la última pulgada —el papel del código, la ventana para escanear y no pedir dos
 * enlaces— más las reglas de color que el plan visual fija para estas pantallas.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CustomerHandoff } from '@psp/contracts';
import { QR_QUIET_MODULES, QrMatrix, secondsLeft } from '../components/HandoffPanel';
import { ClosingFlock, existingHandoff } from './Finish';
import { CIERRE } from '../i18n/pantallas/cierre';
import { COMPOSICION } from '../i18n/pantallas/composicion';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Matriz mínima con la que se puede comprobar geometría sin depender del codificador real. */
const MODULES: boolean[][] = [
  [true, false, true],
  [false, true, false],
  [true, true, false],
];

function handoff(overrides: Partial<CustomerHandoff>): CustomerHandoff {
  return {
    id: 'hnd_1',
    sessionId: 'ses_1',
    method: 'display_qr',
    purpose: 'loyalty',
    state: 'offered',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-01-01T00:03:00.000Z',
    ...overrides,
  } as CustomerHandoff;
}

describe('el cuadro del código', () => {
  it('lleva zona de silencio de cuatro módulos por cada lado', () => {
    const markup = renderToStaticMarkup(<QrMatrix modules={MODULES} />);
    const total = MODULES.length + QR_QUIET_MODULES * 2;
    expect(QR_QUIET_MODULES).toBe(4);
    expect(markup).toContain(`viewBox="0 0 ${total} ${total}"`);
  });

  it('se dibuja sobre el papel blanco del sistema y con la tinta del sistema, nunca con un color de marca', () => {
    const markup = renderToStaticMarkup(<QrMatrix modules={MODULES} />);
    expect(markup).toContain('fill="var(--psp-qr-paper)"');
    expect(markup).toContain('fill="var(--psp-color-text)"');
    expect(markup).not.toMatch(/--psp-color-accent/);
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}/);
  });

  it('los módulos apagados no dibujan nada: el papel se ve entero entre ellos', () => {
    const markup = renderToStaticMarkup(<QrMatrix modules={MODULES} />);
    const path = /<path d="([^"]*)"/.exec(markup)?.[1] ?? '';
    expect(path.match(/M/g)?.length).toBe(MODULES.flat().filter(Boolean).length);
  });

  it('una matriz vacía no dibuja un cuadro falso', () => {
    expect(renderToStaticMarkup(<QrMatrix modules={[]} />)).toBe('');
  });
});

describe('la ventana para escanear', () => {
  it('se cuenta contra la caducidad del propio enlace', () => {
    expect(secondsLeft(handoff({}), Date.parse('2026-01-01T00:00:00.000Z'))).toBe(180);
    expect(secondsLeft(handoff({}), Date.parse('2026-01-01T00:02:38.000Z'))).toBe(22);
  });

  it('nunca es negativa: un enlace vencido dice cero, no un número al revés', () => {
    expect(secondsLeft(handoff({}), Date.parse('2026-01-01T00:10:00.000Z'))).toBe(0);
  });
});

describe('el enlace ya existe cuando se llega al cierre', () => {
  it('reconoce el que nació en la composición, para no hacer esperar por un código nuevo', () => {
    const live = handoff({ id: 'hnd_live', state: 'offered' });
    expect(existingHandoff([live])?.id).toBe('hnd_live');
  });

  it('ignora los que ya no sirven, así el cierre pide otro en vez de enseñar un cuadro muerto', () => {
    expect(existingHandoff([handoff({ state: 'expired' })])).toBeUndefined();
    expect(existingHandoff([handoff({ state: 'cancelled' })])).toBeUndefined();
    expect(existingHandoff([handoff({ state: 'failed' })])).toBeUndefined();
  });

  it('un enlace ya consumido sigue contando: no se pide un segundo a quien ya se enlazó', () => {
    expect(existingHandoff([handoff({ state: 'linked' })])).toBeDefined();
  });

  it('un enlace de otro propósito no vale como membresía', () => {
    expect(existingHandoff([handoff({ purpose: 'coupon' })])).toBeUndefined();
  });

  it('con varios, se queda con el último', () => {
    const first = handoff({ id: 'hnd_a' });
    const second = handoff({ id: 'hnd_b' });
    expect(existingHandoff([first, second])?.id).toBe('hnd_b');
  });
});

describe('la celebración', () => {
  it('enseña los seis, no tres: la marca es el conjunto de colores', () => {
    const markup = renderToStaticMarkup(<ClosingFlock />);
    expect(markup.match(/<svg/g)?.length).toBe(6);
  });
});

describe('las reglas de color de estas pantallas', () => {
  const sheets = { cierre: read('../styles/cierre.css'), composicion: read('../styles/composicion.css') };

  for (const [name, css] of Object.entries(sheets)) {
    it(`${name}: el único literal de color es el blanco de respaldo del sistema`, () => {
      const hexes = css.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
      expect(new Set(hexes.map((h) => h.toLowerCase()))).toEqual(hexes.length ? new Set(['#ffffff']) : new Set());
    });

    it(`${name}: ninguna sombra difuminada y ningún radio: el relieve es un desplazamiento duro`, () => {
      expect(css).not.toMatch(/box-shadow:\s*[^;]*rgba\(/);
      const radii = [...css.matchAll(/border-radius:\s*([^;]+);/g)].map(([, value]) => (value ?? '').trim());
      expect(new Set(radii.filter((value) => value !== '0'))).toEqual(new Set());
      expect(css).not.toMatch(/\bblur\(/);
    });

    it(`${name}: sólo se anima transform y opacity`, () => {
      const animated = [...css.matchAll(/@keyframes[^{]*\{([\s\S]*?)\n\}/g)].map(([, body]) => body ?? '');
      expect(animated.length).toBeGreaterThan(0);
      for (const body of animated) {
        const properties = [...body.matchAll(/^\s*([a-z-]+):/gm)].map(([, p]) => p);
        expect(new Set(properties.filter((p) => p !== 'transform' && p !== 'opacity'))).toEqual(new Set());
      }
    });

    it(`${name}: el movimiento se apaga cuando la persona lo pidió`, () => {
      expect(css).toContain('prefers-reduced-motion');
    });
  }

  it('el papel del código no se pinta con un color de marca', () => {
    expect(sheets.cierre).toMatch(/\.kiosk-handoff__papel[\s\S]*?background:\s*var\(--psp-qr-paper/);
    expect(sheets.cierre).not.toMatch(/\.kiosk-handoff__papel[\s\S]*?background:\s*var\(--psp-(field|color-accent)/);
  });
});

describe('los textos de estas pantallas', () => {
  for (const [name, table] of Object.entries({ cierre: CIERRE, composicion: COMPOSICION })) {
    it(`${name}: cada clave trae español e inglés, y ninguno vacío`, () => {
      expect(Object.keys(table).length).toBeGreaterThan(0);
      for (const [key, [es, en]] of Object.entries(table)) {
        expect(es.length, key).toBeGreaterThan(0);
        expect(en.length, key).toBeGreaterThan(0);
      }
    });

    it(`${name}: ninguna cadena trae marca, precio ni ciudad`, () => {
      for (const [key, pair] of Object.entries(table)) {
        for (const text of pair) expect(text, key).not.toMatch(/\$\s?\d|Una de Todos|Monterrey/);
      }
    });
  }
});
