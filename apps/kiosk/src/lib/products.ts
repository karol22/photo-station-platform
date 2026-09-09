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
