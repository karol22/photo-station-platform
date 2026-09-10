/**
 * Ayudas puras sobre el catálogo del bundle: disponibilidad, precio resuelto y agrupación por
 * categoría para las pantallas de atracción, inicio y producto.
 */
import type { KioskBundle, Product, ProductAvailabilityState, ProductCategory, ResolvedPrice } from '@psp/contracts';
import { choiceStateFromAvailability, type ChoiceCardState } from '@psp/ui';

export interface ProductView {
  product: Product;
  availability: ProductAvailabilityState;
  price: ResolvedPrice | undefined;
  state: ChoiceCardState;
}

const DEFAULT_AVAILABILITY = (productId: string): ProductAvailabilityState => ({ productId, available: true, presentation: 'show', reasons: [] });

export function productViews(bundle: Pick<KioskBundle, 'products' | 'availability' | 'prices'> | undefined): ProductView[] {
  if (!bundle) return [];
  return bundle.products
    .filter((p) => p.status === 'active')
    .map((product) => {
      const availability = bundle.availability.find((a) => a.productId === product.id) ?? DEFAULT_AVAILABILITY(product.id);
      const price = bundle.prices.find((p) => p.productId === product.id);
      return { product, availability, price, state: choiceStateFromAvailability(availability) ?? "unavailable" };
    })
    .filter((v) => v.availability.presentation !== 'hidden')
    .sort((a, b) => a.product.priority - b.product.priority);
}

export function groupByCategory(views: ProductView[]): Array<{ category: ProductCategory; items: ProductView[] }> {
  const groups = new Map<ProductCategory, ProductView[]>();
  for (const view of views) {
    const list = groups.get(view.product.category) ?? [];
    list.push(view);
    groups.set(view.product.category, list);
  }
  return [...groups.entries()].map(([category, items]) => ({ category, items }));
}

export function finalPrice(view: Pick<ProductView, 'product' | 'price'>) {
  return view.price?.final ?? view.product.basePrice;
}

export function listPrice(view: Pick<ProductView, 'product' | 'price'>) {
  return view.price?.list ?? view.product.basePrice;
}

/** Precio mínimo entre los productos disponibles (para "Desde …" en atracción). */
export function minPrice(views: ProductView[]) {
  const available = views.filter((v) => v.availability.available);
  if (available.length === 0) return undefined;
  return available.map(finalPrice).reduce((min, p) => (p.amount < min.amount ? p : min));
}

/**
 * El riel de la pantalla de elección: hasta seis fichas, nunca más.
 *
 * Seis no es un número redondo: es cuántas caras tiene la familia y cuántas fichas caben en la
 * banda de la repisa sin scroll y con área táctil de sobra. Con más de seis productos activos, la
 * cabina enseña los que se pueden comprar ahora —quien está de pie no quiere descubrir a la
 * tercera ficha que la que le gustaba no está disponible— y dentro de eso respeta el orden por
 * categoría y prioridad que trae el bundle.
 */
export function railViews(views: ProductView[], max = 6): ProductView[] {
  const byCategory = groupByCategory(views).flatMap((group) => group.items);
  const available = byCategory.filter((v) => v.availability.available);
  const rest = byCategory.filter((v) => !v.availability.available);
  return [...available, ...rest].slice(0, Math.max(1, max));
}

/**
 * La que viene elegida al entrar. Siempre hay una: una pantalla de elección que empieza sin nada
 * elegido obliga a dos toques para lo mismo, y el primero no decide nada.
 */
export function defaultView(views: ProductView[], preferredId?: string): ProductView | undefined {
  const preferred = preferredId ? views.find((v) => v.product.id === preferredId) : undefined;
  if (preferred) return preferred;
  return views.find((v) => v.availability.available) ?? views[0];
}

/**
 * A qué acento le toca cada posición del riel. Ninguna pantalla escribe un índice a mano: la
 * marca es el conjunto de seis, y si un día son menos, el ciclo se encarga.
 */
export function accentIndex(position: number): 1 | 2 | 3 | 4 | 5 | 6 {
  return ((((position % 6) + 6) % 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6;
}
