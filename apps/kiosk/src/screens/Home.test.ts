import { describe, expect, it } from 'vitest';
import { blobBoxPath } from './Home';

/**
 * Distancia al centro de los ocho puntos por los que pasa la curva. Se miden sólo los anclajes
 * (el `M` y el final de cada `C`): las tangentes intermedias no están sobre el trazo.
 */
function radii(path: string): number[] {
  const numbers = path.match(/-?\d+\.\d+/g)?.map(Number) ?? [];
  const anchors: Array<[number, number]> = [[numbers[0] ?? 0, numbers[1] ?? 0]];
  for (let i = 2; i + 5 < numbers.length; i += 6) anchors.push([numbers[i + 4] ?? 0, numbers[i + 5] ?? 0]);
  return anchors.map(([x, y]) => Math.hypot(x - 50, y - 50));
}

describe('contenedor de curva completa', () => {
  it('es una curva cerrada, no un rectángulo con esquinas', () => {
    const path = blobBoxPath(0.45);
    expect(path.startsWith('M')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
    // Ocho tramos de curva: uno por punto de control.
    expect(path.match(/C/g)).toHaveLength(8);
  });

  it('es determinista: la misma ficha se dibuja igual en cada render', () => {
    expect(blobBoxPath(0.3, 2)).toBe(blobBoxPath(0.3, 2));
  });

  it('sin amplitud es una circunferencia, y con amplitud deja de serlo', () => {
    const round = radii(blobBoxPath(0));
    expect(Math.max(...round) - Math.min(...round)).toBeLessThan(0.05);
    const blob = radii(blobBoxPath(0.45));
    expect(Math.max(...blob) - Math.min(...blob)).toBeGreaterThan(3);
  });

  it('la habitación se nota más curva que la ficha', () => {
    const spread = (amplitude: number) => {
      const r = radii(blobBoxPath(amplitude));
      return Math.max(...r) - Math.min(...r);
    };
    expect(spread(0.45)).toBeGreaterThan(spread(0.3));
  });

  it('el giro cambia el dibujo sin cambiar de familia', () => {
    expect(blobBoxPath(0.3, 0)).not.toBe(blobBoxPath(0.3, 1));
    const withSpin = radii(blobBoxPath(0.3, 1));
    const without = radii(blobBoxPath(0.3, 0));
    const spread = (r: number[]) => Math.max(...r) - Math.min(...r);
    expect(Math.abs(spread(withSpin) - spread(without))).toBeLessThan(1);
  });

  it('nunca se sale del lienzo, así que el canto nunca queda recortado', () => {
    for (const amplitude of [0, 0.14, 0.3, 0.45, 1]) {
      const numbers = blobBoxPath(amplitude).match(/-?\d+\.\d+/g)?.map(Number) ?? [];
      for (const n of numbers) {
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(100);
      }
    }
  });
});
