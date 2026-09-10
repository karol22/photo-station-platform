/**
 * Retoque de piel. La regla de producto es que la persona siga reconociéndose: suaviza el grano sin
 * convertir la cara en plástico y sin borrar ojos, cejas ni el contorno de los labios.
 */
import { blurBox } from './ops/filters';
import { resampleMask } from './mask';
import type { Mask } from './mask';
import { clamp, clampByte, createRaster, luma709 } from './raster';
import type { Raster } from './raster';

export type SmoothSkinOptions = {
  /** Radio del promediado, en píxeles. 2 por defecto: suficiente para el grano, corto para no arrastrar rasgos. */
  radius?: number;
  /**
   * Umbral de detalle en unidades de luma 0..255. Por debajo se considera grano y se suaviza; por encima
   * se considera rasgo y se conserva. 18 por defecto.
   */
  threshold?: number;
};

/**
 * Suavizado que **preserva bordes**, como un bilateral simplificado: en vez de pesar cada vecino (caro), se
 * calcula un promedio separable de una pasada y luego se decide **por píxel** cuánto de ese promedio entra,
 * según la diferencia local `d = |luma(original) − luma(promedio)|`:
 *
 * ```
 * w = amount / (1 + (d / threshold)²)
 * out = original + (promedio − original) · w
 * ```
 *
 * Donde el píxel apenas se aparta de su entorno (mejilla, frente) `w ≈ amount` y el grano desaparece; en un
 * borde marcado (pestaña, labio, perfil) `d` es grande, `w` cae con el cuadrado y el píxel se queda casi
 * intacto. Con `mask` el peso se multiplica además por la cobertura, así que el fondo no se toca.
 *
 * Coste: **medio**. Un desenfoque separable (dos pasadas, independientes del radio) más una pasada de mezcla.
 */
export function smoothSkin(r: Raster, mask: Mask | undefined, amount: number, opts: SmoothSkinOptions = {}): Raster {
  const strength = clamp(amount, 0, 1);
  const out = createRaster(r.width, r.height);
  if (strength === 0) {
    out.data.set(r.data);
    return out;
  }
  const radius = Math.max(1, Math.floor(opts.radius ?? 2));
  const threshold = Math.max(1, opts.threshold ?? 18);
  const blurred = blurBox(r, radius);
  const matte = mask ? (mask.width === r.width && mask.height === r.height ? mask : resampleMask(mask, r.width, r.height)) : undefined;
  const n = r.width * r.height;
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    out.data[i + 3] = r.data[i + 3]!;
    const coverage = matte ? matte.data[p]! / 255 : 1;
    if (coverage <= 0) {
      out.data[i] = r.data[i]!;
      out.data[i + 1] = r.data[i + 1]!;
      out.data[i + 2] = r.data[i + 2]!;
      continue;
    }
    const l = luma709(r.data[i]!, r.data[i + 1]!, r.data[i + 2]!);
    const lb = luma709(blurred.data[i]!, blurred.data[i + 1]!, blurred.data[i + 2]!);
    const d = Math.abs(l - lb) / threshold;
    const w = (strength * coverage) / (1 + d * d);
    for (let c = 0; c < 3; c++) {
      const v = r.data[i + c]!;
      out.data[i + c] = clampByte(v + (blurred.data[i + c]! - v) * w);
    }
  }
  return out;
}
