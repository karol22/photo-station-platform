import { describe, expect, it } from 'vitest';
import type { KioskBundle } from '@psp/contracts';
import { GROUP_OPTIONS, fitsGroup, optionForSize, viewsForGroup } from './groups';
import type { ProductView } from './products';

const option = (key: string) => GROUP_OPTIONS.find((o) => o.key === key)!;

const view = (id: string, kind: 'document' | 'entertainment', experienceId?: string): ProductView =>
  ({
    product: { id, kind, experienceId },
    availability: { productId: id, available: true, presentation: 'show', reasons: [] },
  }) as unknown as ProductView;

const bundle = (expected: Record<string, number>): KioskBundle =>
  ({
    experiences: Object.entries(expected).map(([id, people]) => ({
      id,
      poses: [{ guidance: { expectedPeople: people } }],
    })),
  }) as unknown as KioskBundle;

describe('cuántos son hoy', () => {
  it('cada tamaño cae en un solo grupo', () => {
    expect(optionForSize(1)?.key).toBe('solo');
    expect(optionForSize(2)?.key).toBe('duo');
    expect(optionForSize(4)?.key).toBe('squad');
    expect(optionForSize(9)?.key).toBe('crew');
    expect(optionForSize(undefined)).toBeUndefined();
  });

  it('el recorrido documental sólo aparece para una persona', () => {
    const doc = view('prd_doc', 'document');
    expect(fitsGroup(doc, option('solo'), undefined)).toBe(true);
    expect(fitsGroup(doc, option('duo'), undefined)).toBe(false);
    expect(fitsGroup(doc, option('crew'), undefined)).toBe(false);
  });

  it('una experiencia sin gente declarada sirve para cualquier grupo', () => {
    const any = view('prd_any', 'entertainment');
    for (const o of GROUP_OPTIONS) expect(fitsGroup(any, o, undefined)).toBe(true);
  });

  it('una experiencia de pareja no se ofrece a un grupo de cinco', () => {
    const duo = view('prd_duo', 'entertainment', 'exp_duo');
    expect(fitsGroup(duo, option('duo'), 2)).toBe(true);
    expect(fitsGroup(duo, option('crew'), 2)).toBe(false);
  });

  it('el grupo abierto acepta a partir de su mínimo', () => {
    const big = view('prd_big', 'entertainment', 'exp_big');
    expect(fitsGroup(big, option('crew'), 8)).toBe(true);
    expect(fitsGroup(big, option('squad'), 8)).toBe(false);
  });

  it('filtra el catálogo con la experiencia de cada producto', () => {
    const views = [
      view('prd_doc', 'document'),
      view('prd_duo', 'entertainment', 'exp_duo'),
      view('prd_any', 'entertainment'),
    ];
    const data = bundle({ exp_duo: 2 });
    expect(viewsForGroup(data, views, option('duo')).map((v) => v.product.id)).toEqual(['prd_duo', 'prd_any']);
    expect(viewsForGroup(data, views, option('solo')).map((v) => v.product.id)).toEqual(['prd_doc', 'prd_any']);
  });

  it('sin respuesta al paso, el catálogo se muestra completo', () => {
    const views = [view('prd_doc', 'document'), view('prd_any', 'entertainment')];
    expect(viewsForGroup(bundle({}), views, undefined)).toHaveLength(2);
  });
});
