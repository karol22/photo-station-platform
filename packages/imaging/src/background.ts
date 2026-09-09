/**
 * Efectos de fondo: lo que la persona ve cuando cambia lo que hay detrás de ella.
 *
 * Todos parten de una `Mask` de recorte de persona (que llega del motor de visión, casi siempre a menor
 * resolución) y **componen con alfa gradual**: `prepareMask` escala y afina el contorno, y la mezcla es
 * una interpolación por píxel, nunca un umbral. Ver `refineMaskEdge` para la técnica del borde.
 */
import { blurBox } from './ops/filters';
import { crop, resize } from './ops/geometry';
import { prepareMask } from './mask';
import type { EdgeOptions, Mask } from './mask';
import { clampByte, createRaster, parseColor } from './raster';
import type { Fit, Raster, RGBA } from './raster';

export type BackgroundOptions = {
  /** Calidad del borde del recorte. Ver `refineMaskEdge`. */
  edge?: EdgeOptions;
  /**
   * `true` cuando la máscara ya viene al tamaño del raster y con el borde afinado (por ejemplo porque el
   * kiosco la reutiliza entre efectos). Evita repetir escalado y suavizado en la vista previa.
   */
  prepared?: boolean;
};

function matteFor(r: Raster, mask: Mask, opts: BackgroundOptions | undefined): Mask {
  if (opts?.prepared && mask.width === r.width && mask.height === r.height) return mask;
  return prepareMask(mask, r.width, r.height, opts?.edge ?? {});
}

/**
 * Mezcla `person` sobre `background` con la cobertura de `matte` (mismo tamaño que ambos).
 * `out = person·a + background·(1−a)` canal a canal, alpha incluido: con `a = 1` el píxel de la persona
 * sale **idéntico** al original, y con `a = 0` sale idéntico al del fondo.
 */
export function compositeWithMask(person: Raster, background: Raster, matte: Mask): Raster {
  if (person.width !== background.width || person.height !== background.height) {
    throw new Error(`compositeWithMask: size mismatch ${person.width}x${person.height} vs ${background.width}x${background.height}`);
  }
  if (person.width !== matte.width || person.height !== matte.height) {
    throw new Error(`compositeWithMask: matte ${matte.width}x${matte.height} does not match ${person.width}x${person.height}`);
  }
  const out = createRaster(person.width, person.height);
  const n = person.width * person.height;
  for (let p = 0; p < n; p++) {
    const a = matte.data[p]! / 255;
    const i = p * 4;
    if (a >= 1) {
      out.data[i] = person.data[i]!;
      out.data[i + 1] = person.data[i + 1]!;
      out.data[i + 2] = person.data[i + 2]!;
      out.data[i + 3] = person.data[i + 3]!;
      continue;
    }
    if (a <= 0) {
      out.data[i] = background.data[i]!;
      out.data[i + 1] = background.data[i + 1]!;
      out.data[i + 2] = background.data[i + 2]!;
      out.data[i + 3] = background.data[i + 3]!;
      continue;
    }
    for (let c = 0; c < 4; c++) {
      out.data[i + c] = clampByte(person.data[i + c]! * a + background.data[i + c]! * (1 - a));
    }
  }
  return out;
}

/** Ajusta un raster a otro tamaño recortando el sobrante (`cover`) o encajándolo entero (`contain`, deforma menos que estirar). */
function fitRaster(src: Raster, width: number, height: number, fit: Fit): Raster {
  if (src.width === width && src.height === height) return src;
  const scale = fit === 'cover' ? Math.max(width / src.width, height / src.height) : Math.min(width / src.width, height / src.height);
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const scaled = resize(src, w, h);
  if (w === width && h === height) return scaled;
  if (fit === 'contain') {
    const out = createRaster(width, height);
    const x0 = Math.floor((width - w) / 2);
    const y0 = Math.floor((height - h) / 2);
    for (let y = 0; y < Math.min(h, height); y++) {
      const dy = y + y0;
      if (dy < 0 || dy >= height) continue;
      for (let x = 0; x < Math.min(w, width); x++) {
        const dx = x + x0;
        if (dx < 0 || dx >= width) continue;
        const si = (y * w + x) * 4;
        const di = (dy * width + dx) * 4;
        out.data[di] = scaled.data[si]!;
        out.data[di + 1] = scaled.data[si + 1]!;
        out.data[di + 2] = scaled.data[si + 2]!;
        out.data[di + 3] = scaled.data[si + 3]!;
      }
    }
    return out;
  }
  return crop(scaled, { x: Math.floor((w - width) / 2), y: Math.floor((h - height) / 2), w: width, h: height });
}

export type ReplaceBackgroundOptions = BackgroundOptions & {
  /** Cómo se ajusta la escena al tamaño de la foto. `cover` por defecto: llena el cuadro sin deformar. */
  fit?: Fit;
};

/**
 * Pone otra escena detrás de la persona. La escena se ajusta al tamaño de la foto (`cover` por defecto) y
 * la mezcla usa la cobertura afinada, así que el contorno de la persona no queda recortado con tijera.
 *
 * Coste: **medio**. Una pasada por píxel más el escalado de la escena; el trabajo caro es el de la máscara.
 */
export function replaceBackground(r: Raster, mask: Mask, background: Raster, opts: ReplaceBackgroundOptions = {}): Raster {
  const scene = fitRaster(background, r.width, r.height, opts.fit ?? 'cover');
  return compositeWithMask(r, scene, matteFor(r, mask, opts));
}

export type BlurBackgroundOptions = BackgroundOptions & { radius: number };

/**
 * Deja a la persona nítida y difumina lo de atrás. Desenfoca **toda** la foto con el desenfoque de caja
 * separable y luego devuelve la persona encima: así el fondo cerca del contorno arrastra color de la
 * persona y no aparece el halo duro que deja desenfocar sólo el fondo recortado.
 *
 * Donde la cobertura es 255 el píxel sale idéntico al original: la persona no se toca.
 *
 * Coste: **medio**. Dos pasadas separables (independientes del radio) más la mezcla.
 */
export function blurBackground(r: Raster, mask: Mask, opts: BlurBackgroundOptions): Raster {
  const radius = Math.max(0, Math.floor(opts.radius));
  const blurred = blurBox(r, radius);
  return compositeWithMask(r, blurred, matteFor(r, mask, opts));
}

/**
 * Sustituye el fondo por un color plano. Es el **único efecto de fondo seguro para documentos**: un retrato
 * de pasaporte pide precisamente un fondo uniforme. Aun así sólo se aplica si el preset habilita la
 * herramienta `backgroundAdjust`; `validateEditOps` sigue siendo la puerta.
 *
 * Coste: **bajo**. Una pasada por píxel sobre un fondo constante.
 */
export function colorBackground(r: Raster, mask: Mask, color: string | RGBA, opts: BackgroundOptions = {}): Raster {
  const flat = createRaster(r.width, r.height, parseColor(color, [255, 255, 255, 255]));
  return compositeWithMask(r, flat, matteFor(r, mask, opts));
}

/**
 * Deja sólo a la persona, con transparencia real: el color se conserva y el alfa pasa a ser
 * `alfa_original · cobertura`, de modo que fuera de la persona queda alfa 0 y el contorno queda
 * semitransparente en vez de dentado.
 *
 * Coste: **bajo** (aparte de la máscara).
 */
export function cutoutPerson(r: Raster, mask: Mask, opts: BackgroundOptions = {}): Raster {
  const matte = matteFor(r, mask, opts);
  const out = createRaster(r.width, r.height);
  const n = r.width * r.height;
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    const a = matte.data[p]! / 255;
    out.data[i] = r.data[i]!;
    out.data[i + 1] = r.data[i + 1]!;
    out.data[i + 2] = r.data[i + 2]!;
    out.data[i + 3] = a >= 1 ? r.data[i + 3]! : clampByte(r.data[i + 3]! * a);
  }
  return out;
}
