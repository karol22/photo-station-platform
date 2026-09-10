import { describe, expect, it } from 'vitest';
import type { ProductCategory } from '@psp/contracts';
import { accentIndex, defaultView, railViews, type ProductView } from './products';

/** Vista mínima: al riel sólo le importan identidad, categoría y disponibilidad. */
function view(id: string, category: ProductCategory, available = true): ProductView {
  return {
    product: { id, category } as ProductView['product'],
    availability: { productId: id, available, presentation: 'show', reasons: [] },
    price: undefined,
    state: available ? 'available' : 'unavailable',
  };
}

describe('riel de la pantalla de elección', () => {
  it('nunca enseña más de seis fichas', () => {
    const views = Array.from({ length: 9 }, (_unused, i) => view(`p${i}`, 'fun'));
    expect(railViews(views)).toHaveLength(6);
  });

  it('pone delante lo que se puede comprar ahora', () => {
    const views = [view('a', 'fun', false), view('b', 'fun'), view('c', 'fun', false), view('d', 'fun')];
    expect(railViews(views).map((v) => v.product.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('mantiene juntas las de una misma categoría', () => {
    const views = [view('a', 'fun'), view('b', 'documents'), view('c', 'fun'), view('d', 'documents')];
    expect(railViews(views).map((v) => v.product.id)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('con más de seis, las disponibles desplazan a las que no lo están', () => {
    const views = [
      ...Array.from({ length: 3 }, (_unused, i) => view(`off${i}`, 'fun', false)),
      ...Array.from({ length: 6 }, (_unused, i) => view(`on${i}`, 'fun')),
    ];
    expect(railViews(views).map((v) => v.product.id)).toEqual(['on0', 'on1', 'on2', 'on3', 'on4', 'on5']);
  });
});

describe('la que viene elegida al entrar', () => {
  it('respeta la que pide la ruta', () => {
    const views = [view('a', 'fun'), view('b', 'fun')];
    expect(defaultView(views, 'b')?.product.id).toBe('b');
  });

  it('con una ruta que ya no existe, elige la primera disponible', () => {
    const views = [view('a', 'fun', false), view('b', 'fun')];
    expect(defaultView(views, 'fantasma')?.product.id).toBe('b');
  });

  it('siempre hay una elegida aunque ninguna esté disponible', () => {
    const views = [view('a', 'fun', false), view('b', 'fun', false)];
    expect(defaultView(views)?.product.id).toBe('a');
  });

  it('sin catálogo no hay elegida', () => {
    expect(defaultView([])).toBeUndefined();
  });
});

describe('acento por posición', () => {
  it('cicla sobre los seis de la marca', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(accentIndex)).toEqual([1, 2, 3, 4, 5, 6, 1, 2]);
  });
});
