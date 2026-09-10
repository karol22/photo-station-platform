/**
 * Selección de variante de plantilla: una variante aplica cuando todas las claves definidas en su selector
 * coinciden con el selector pedido. Gana la primera en orden de declaración; sin coincidencia, la base.
 */
import type { PrintTemplate } from '@psp/contracts';
import { templateCanvas } from '../primitives';
import type { TemplateVariant, TemplateVariantSelector, VariantSelection } from '../primitives';

function matches(variant: TemplateVariant, selector: TemplateVariantSelector): boolean {
  const wanted = selector as Record<string, unknown>;
  for (const [key, value] of Object.entries(variant.selector as Record<string, unknown>)) {
    if (value === undefined) continue;
    if (wanted[key] !== value) return false;
  }
  return true;
}

function selection(template: PrintTemplate, variant: TemplateVariant | undefined): VariantSelection {
  const out: VariantSelection = { elements: variant?.elements ?? template.elements, canvas: templateCanvas(template, variant) };
  if (variant) out.variantKey = variant.key;
  return out;
}

/** Primera variante cuyo selector coincide; sin selector o sin coincidencias devuelve elementos y lienzo base. */
export function selectVariant(template: PrintTemplate, selector: TemplateVariantSelector = {}): VariantSelection {
  const variant = (template.variants ?? []).find((v) => matches(v, selector));
  return selection(template, variant);
}

/** Variante por clave explícita (previsualizaciones del admin). Sin esa clave devuelve `undefined`. */
export function variantByKey(template: PrintTemplate, key: string): VariantSelection | undefined {
  const variant = (template.variants ?? []).find((v) => v.key === key);
  return variant ? selection(template, variant) : undefined;
}
