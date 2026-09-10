import { DOCUMENT_SAFE_TOOLS, PHOTO_EFFECTS } from '@psp/contracts';
import { describe, expect, it } from 'vitest';
import { blurBackground, colorBackground, cutoutPerson, replaceBackground } from './background';
import { COLOR_FILTERS, COLOR_FILTER_KEYS, colorFilterOps } from './color-filters';
import { applyEditOps, validateEditOps } from './edit-ops';
import { EFFECT_IMPLEMENTATIONS, applyEffect, documentSafeEffects } from './effects';
import { createMask, edgeSoftness, prepareMask, refineMaskEdge, resampleMask } from './mask';
import type { Mask } from './mask';
import { duotone } from './ops/duotone';
import { anchorProp, drawProp } from './props';
import type { FaceLandmarks } from './props';
import { createRaster, getPixel, setPixel } from './raster';
import type { RGBA, Raster } from './raster';
import { smoothSkin } from './retouch';

function rasterOf(width: number, height: number, at: (x: number, y: number) => RGBA): Raster {
  const r = createRaster(width, height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) setPixel(r, x, y, at(x, y));
  return r;
}

function maskOf(width: number, height: number, at: (x: number, y: number) => number): Mask {
  const m = createMask(width, height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) m.data[y * width + x] = at(x, y);
  return m;
}

const RED: RGBA = [255, 0, 0, 255];
const GREEN: RGBA = [0, 255, 0, 255];
const BLUE: RGBA = [0, 0, 255, 255];

/** Persona en la mitad izquierda; el borde cae entre x=3 y x=4 de un raster de 8. */
const leftHalf = (w: number, h: number) => maskOf(w, h, (x) => (x < w / 2 ? 255 : 0));

describe('máscara', () => {
  it('resampleMask escala una máscara a media resolución con valores intermedios verificables', () => {
    const half = maskOf(2, 2, (x) => (x === 0 ? 255 : 0));
    const full = resampleMask(half, 4, 4);
    expect(full.width).toBe(4);
    expect(full.height).toBe(4);
    // Centros de píxel alineados como en `resize`: 255, 191.25, 63.75, 0 en cada fila.
    for (let y = 0; y < 4; y++) {
      expect([...full.data.slice(y * 4, y * 4 + 4)]).toEqual([255, 191, 64, 0]);
    }
  });

  it('resampleMask al mismo tamaño copia sin tocar los valores', () => {
    const m = leftHalf(4, 4);
    const same = resampleMask(m, 4, 4);
    expect([...same.data]).toEqual([...m.data]);
    expect(same.data).not.toBe(m.data);
  });

  it('refineMaskEdge deja el interior sólido y el borde en valores intermedios, no sólo 0 y 255', () => {
    const refined = refineMaskEdge(leftHalf(8, 8), { feather: 2, band: 0.55, shrink: 0 });
    const row = [...refined.data.slice(0, 8)];
    expect(row[0]).toBe(255);
    expect(row[1]).toBe(255);
    expect(row[7]).toBe(0);
    const middle = row.filter((v) => v > 0 && v < 255);
    expect(middle.length).toBeGreaterThan(0);
    expect(edgeSoftness(refined)).toBeGreaterThan(0);
    // Sin afinar, la máscara sólo tiene extremos: eso es el borde de tijera que se quiere evitar.
    expect(edgeSoftness(leftHalf(8, 8))).toBe(0);
  });

  it('refineMaskEdge con shrink positivo mete el borde hacia la persona', () => {
    const base = leftHalf(16, 4);
    const neutral = refineMaskEdge(base, { feather: 2, band: 0.5, shrink: 0 });
    const shrunk = refineMaskEdge(base, { feather: 2, band: 0.5, shrink: 0.2 });
    const sum = (m: Mask) => m.data.reduce((a, v) => a + v, 0);
    expect(sum(shrunk)).toBeLessThan(sum(neutral));
  });

  it('prepareMask escala primero y afina después: el borde suave se mide en píxeles de la foto', () => {
    const matte = prepareMask(leftHalf(4, 4), 16, 16, { feather: 2, band: 0.5, shrink: 0 });
    expect(matte.width).toBe(16);
    expect(matte.data[0]).toBe(255);
    expect(matte.data[15]).toBe(0);
    expect(edgeSoftness(matte)).toBeGreaterThan(0);
  });
});

describe('efectos de fondo', () => {
  it('colorBackground deja intacta a la persona y pinta el fondo con el color plano', () => {
    const photo = rasterOf(8, 8, () => RED);
    const out = colorBackground(photo, leftHalf(8, 8), '#0000FF', { prepared: true });
    expect(getPixel(out, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(getPixel(out, 7, 0)).toEqual([0, 0, 255, 255]);
  });

  it('colorBackground escala una máscara a media resolución antes de componer', () => {
    const photo = rasterOf(8, 8, () => RED);
    const out = colorBackground(photo, leftHalf(4, 4), '#0000FF');
    // El interior de la persona sigue siendo la foto y el fondo lejano el color plano.
    expect(getPixel(out, 0, 4)).toEqual([255, 0, 0, 255]);
    expect(getPixel(out, 7, 4)).toEqual([0, 0, 255, 255]);
    // Y en el contorno hay mezcla, no un salto.
    const edge = getPixel(out, 4, 4);
    expect(edge[0]).toBeGreaterThan(0);
    expect(edge[0]).toBeLessThan(255);
    expect(edge[2]).toBeGreaterThan(0);
    expect(edge[2]).toBeLessThan(255);
  });

  it('replaceBackground ajusta la escena al cuadro y sólo la usa donde no hay persona', () => {
    const photo = rasterOf(8, 8, () => RED);
    const scene = rasterOf(4, 4, () => GREEN);
    const out = replaceBackground(photo, leftHalf(8, 8), scene, { prepared: true });
    expect(getPixel(out, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(getPixel(out, 7, 7)).toEqual([0, 255, 0, 255]);
  });

  it('blurBackground no toca ni un píxel de la persona', () => {
    const photo = rasterOf(8, 8, (x, y) => (x + y) % 2 === 0 ? RED : BLUE);
    const out = blurBackground(photo, leftHalf(8, 8), { radius: 3, prepared: true });
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 4; x++) expect(getPixel(out, x, y)).toEqual(getPixel(photo, x, y));
    }
    // Y el fondo sí cambió: el desenfoque promedió el damero.
    expect(getPixel(out, 6, 4)).not.toEqual(getPixel(photo, 6, 4));
  });

  it('cutoutPerson deja alfa 0 fuera de la persona y conserva el color dentro', () => {
    const photo = rasterOf(8, 8, () => RED);
    const out = cutoutPerson(photo, leftHalf(8, 8), { prepared: true });
    expect(getPixel(out, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(getPixel(out, 7, 0)).toEqual([255, 0, 0, 0]);
  });

  it('cutoutPerson con borde afinado deja alfa intermedio en el contorno, no dentado', () => {
    const photo = rasterOf(16, 4, () => RED);
    const out = cutoutPerson(photo, leftHalf(16, 4), { edge: { feather: 2, band: 0.5, shrink: 0 } });
    const alphas: number[] = [];
    for (let x = 0; x < 16; x++) alphas.push(getPixel(out, x, 1)[3]);
    expect(alphas[0]).toBe(255);
    expect(alphas[15]).toBe(0);
    expect(alphas.some((a) => a > 0 && a < 255)).toBe(true);
  });
});

describe('elementos pegados a la cara', () => {
  const face = (leftX: number, leftY: number, rightX: number, rightY: number): FaceLandmarks => ({
    leftEye: { x: leftX, y: leftY },
    rightEye: { x: rightX, y: rightY },
  });
  const SIZE = { width: 100, height: 100 };

  it('una cara a nivel coloca el elemento centrado entre los ojos y sin girar', () => {
    const p = anchorProp(face(0.4, 0.5, 0.6, 0.5), { anchor: 'eyes', scale: 1 }, SIZE);
    expect(p.rotationDeg).toBe(0);
    expect(p.w).toBeCloseTo(44, 6); // 20 px entre ojos × 2.2
    expect(p.h).toBeCloseTo(44, 6);
    expect(p.x + p.w / 2).toBeCloseTo(50, 6);
    expect(p.y + p.h / 2).toBeCloseTo(50, 6);
  });

  it('una cara inclinada produce un elemento inclinado igual', () => {
    const tilted = face(0.4, 0.45, 0.6, 0.55);
    const p = anchorProp(tilted, { anchor: 'eyes', scale: 1 }, SIZE);
    const expected = (Math.atan2(10, 20) * 180) / Math.PI;
    expect(p.rotationDeg).toBeCloseTo(expected, 6);
    expect(p.rotationDeg).toBeCloseTo(26.565, 3);
    // Con followRoll: false el elemento se queda a nivel.
    expect(anchorProp(tilted, { anchor: 'eyes', scale: 1, followRoll: false }, SIZE).rotationDeg).toBe(0);
  });

  it('la frente sigue la inclinación: el ancla se mueve perpendicular a la línea de los ojos', () => {
    const level = anchorProp(face(0.4, 0.5, 0.6, 0.5), { anchor: 'forehead', scale: 1 }, SIZE);
    expect(level.x + level.w / 2).toBeCloseTo(50, 6);
    expect(level.y + level.h / 2).toBeCloseTo(50 - 0.45 * 44, 6);
    const tilted = anchorProp(face(0.4, 0.45, 0.6, 0.55), { anchor: 'forehead', scale: 1 }, SIZE);
    // Al inclinarse la cabeza, la frente se desplaza también en x.
    expect(tilted.x + tilted.w / 2).toBeGreaterThan(50);
    expect(tilted.y + tilted.h / 2).toBeLessThan(50);
  });

  it('una cara más grande produce un elemento más grande, en la misma proporción', () => {
    const small = anchorProp(face(0.4, 0.5, 0.6, 0.5), { anchor: 'eyes', scale: 1 }, SIZE);
    const big = anchorProp(face(0.3, 0.5, 0.7, 0.5), { anchor: 'eyes', scale: 1 }, SIZE);
    expect(big.w).toBeCloseTo(small.w * 2, 6);
    expect(big.h).toBeCloseTo(small.h * 2, 6);
  });

  it('anchorProp respeta faceWidth declarado, la escala, el aspecto y el desplazamiento', () => {
    const l: FaceLandmarks = { ...face(0.4, 0.5, 0.6, 0.5), faceWidth: 0.5 };
    const p = anchorProp(l, { anchor: 'eyes', scale: 0.5, aspect: 0.25, offset: { x: 0, y: 0.1 } }, SIZE);
    expect(p.w).toBeCloseTo(25, 6); // 0.5 × 50 px
    expect(p.h).toBeCloseTo(6.25, 6);
    expect(p.y + p.h / 2).toBeCloseTo(55, 6); // 0.1 × 50 px hacia la barbilla
  });

  it('sin size devuelve coordenadas normalizadas', () => {
    const p = anchorProp(face(0.4, 0.5, 0.6, 0.5), { anchor: 'eyes', scale: 1 });
    expect(p.w).toBeCloseTo(0.44, 6);
    expect(p.x + p.w / 2).toBeCloseTo(0.5, 6);
  });

  it('drawProp dibuja dentro y recorta lo que se sale del raster, sin lanzar ni cambiar el tamaño', () => {
    const photo = rasterOf(10, 10, () => [255, 255, 255, 255]);
    const prop = rasterOf(4, 4, () => RED);
    const out = drawProp(photo, prop, { x: -2, y: -2, w: 4, h: 4, rotationDeg: 0 });
    expect(out.width).toBe(10);
    expect(out.height).toBe(10);
    expect(getPixel(out, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(getPixel(out, 1, 1)).toEqual([255, 0, 0, 255]);
    expect(getPixel(out, 2, 2)).toEqual([255, 255, 255, 255]);
    // Fuera del todo: la foto queda igual.
    const away = drawProp(photo, prop, { x: 40, y: 40, w: 4, h: 4, rotationDeg: 45 });
    expect([...away.data]).toEqual([...photo.data]);
  });

  it('un elemento anclado a una cara grande no se sale del raster ni lo agranda', () => {
    const photo = rasterOf(64, 64, () => [255, 255, 255, 255]);
    const prop = rasterOf(8, 8, () => BLUE);
    const placement = anchorProp({ leftEye: { x: 0.2, y: 0.3 }, rightEye: { x: 0.8, y: 0.45 } }, { anchor: 'head', scale: 1.2 }, photo);
    const out = drawProp(photo, prop, placement);
    expect(out.width).toBe(64);
    expect(out.height).toBe(64);
    expect(out.data.length).toBe(photo.data.length);
    expect(placement.rotationDeg).toBeGreaterThan(0);
  });

  it('drawProp respeta la opacidad', () => {
    const photo = rasterOf(4, 4, () => [255, 255, 255, 255]);
    const prop = rasterOf(4, 4, () => [0, 0, 0, 255]);
    const out = drawProp(photo, prop, { x: 0, y: 0, w: 4, h: 4, rotationDeg: 0 }, { opacity: 0.5 });
    expect(getPixel(out, 1, 1)).toEqual([128, 128, 128, 255]);
  });
});

describe('retoque', () => {
  /** Damero de ±8 sobre gris 128 en la izquierda, plano 250 en la derecha: grano y un borde marcado. */
  const noisy = () => rasterOf(16, 16, (x, y) => (x < 8 ? [128 + ((x + y) % 2 === 0 ? 8 : -8), 128 + ((x + y) % 2 === 0 ? 8 : -8), 128 + ((x + y) % 2 === 0 ? 8 : -8), 255] : [250, 250, 250, 255]));

  const grain = (r: Raster) => {
    let sum = 0;
    for (let y = 2; y < 14; y++) for (let x = 2; x < 6; x++) sum += Math.abs(getPixel(r, x, y)[0] - 128);
    return sum;
  };

  it('smoothSkin reduce el grano pero conserva el borde marcado', () => {
    const photo = noisy();
    const out = smoothSkin(photo, undefined, 1);
    expect(grain(out)).toBeLessThan(grain(photo) / 3);
    // El escalón sigue ahí: el lado claro no se apaga y el salto entre x=7 y x=8 sigue siendo grande.
    expect(getPixel(out, 8, 8)[0]).toBeGreaterThan(235);
    expect(getPixel(out, 8, 8)[0] - getPixel(out, 7, 8)[0]).toBeGreaterThan(90);
  });

  it('smoothSkin con amount 0 devuelve la foto tal cual', () => {
    const photo = noisy();
    const out = smoothSkin(photo, undefined, 0);
    expect([...out.data]).toEqual([...photo.data]);
    expect(out.data).not.toBe(photo.data);
  });

  it('smoothSkin con máscara sólo actúa sobre la persona', () => {
    const photo = noisy();
    const mask = maskOf(16, 16, (x) => (x >= 8 ? 255 : 0));
    const out = smoothSkin(photo, mask, 1);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) expect(getPixel(out, x, y)).toEqual(getPixel(photo, x, y));
  });

  it('smoothSkin es determinista', () => {
    const photo = noisy();
    expect([...smoothSkin(photo, undefined, 0.7).data]).toEqual([...smoothSkin(photo, undefined, 0.7).data]);
  });
});

describe('filtros con nombre', () => {
  const sample = () => rasterOf(4, 4, (x, y) => [40 * x + 20, 30 * y + 10, 200 - 20 * x, 255]);

  it('duotone mapea la luminancia entre los dos colores', () => {
    const r = rasterOf(2, 1, (x) => (x === 0 ? [0, 0, 0, 255] : [255, 255, 255, 255]));
    const out = duotone(r, '#000080', '#FFFF00', 1);
    expect(getPixel(out, 0, 0)).toEqual([0, 0, 128, 255]);
    expect(getPixel(out, 1, 0)).toEqual([255, 255, 0, 255]);
  });

  it('duotone con amount 0.5 queda a medio camino y no toca el alfa', () => {
    const r = rasterOf(1, 1, () => [0, 0, 0, 120]);
    expect(getPixel(duotone(r, '#FFFFFF', '#FFFFFF', 0.5), 0, 0)).toEqual([128, 128, 128, 120]);
  });

  it('cada filtro con nombre es determinista y cambia la imagen', () => {
    const photo = sample();
    for (const key of COLOR_FILTER_KEYS) {
      const a = applyEditOps(photo, COLOR_FILTERS[key]);
      const b = applyEditOps(photo, colorFilterOps(key));
      expect([...a.data], key).toEqual([...b.data]);
      expect([...a.data], key).not.toEqual([...photo.data]);
    }
  });

  it('colorFilterOps devuelve una copia: mutarla no toca el catálogo', () => {
    const ops = colorFilterOps('warm');
    ops[0]!.params['amount'] = -1;
    expect(COLOR_FILTERS.warm[0]!.params['amount']).toBe(0.3);
  });

  it('validateEditOps rechaza todos los filtros con nombre para una foto de documento', () => {
    for (const key of COLOR_FILTER_KEYS) {
      expect(validateEditOps(COLOR_FILTERS[key], DOCUMENT_SAFE_TOOLS).ok, key).toBe(false);
    }
  });

  it('bw_contrast tiene ops documentales, pero basta una creativa para que el filtro no pase', () => {
    expect(validateEditOps([{ op: 'grayscale', params: {} }], DOCUMENT_SAFE_TOOLS).ok).toBe(true);
    expect(validateEditOps([{ op: 'contrast', params: { amount: 0.25 } }], DOCUMENT_SAFE_TOOLS).ok).toBe(true);
    const v = validateEditOps(COLOR_FILTERS.bw_contrast, DOCUMENT_SAFE_TOOLS);
    expect(v.ok).toBe(false);
    expect(v.rejected.map((o) => o.op)).toEqual(['vignette']);
  });
});

describe('ops nuevas en el pipeline', () => {
  const photo = () => rasterOf(8, 8, () => RED);

  it('el fondo de color plano es la única op de fondo apta para documentos', () => {
    expect(validateEditOps([{ op: 'backgroundColor', params: { color: '#FFFFFF' } }], DOCUMENT_SAFE_TOOLS).ok).toBe(true);
    expect(validateEditOps([{ op: 'backgroundBlur', params: { radius: 4 } }], DOCUMENT_SAFE_TOOLS).ok).toBe(false);
    expect(validateEditOps([{ op: 'backgroundReplace', params: { assetId: 'ast_scene' } }], DOCUMENT_SAFE_TOOLS).ok).toBe(false);
    expect(validateEditOps([{ op: 'cutout', params: {} }], DOCUMENT_SAFE_TOOLS).ok).toBe(false);
    expect(validateEditOps([{ op: 'duotone', params: {} }], DOCUMENT_SAFE_TOOLS).ok).toBe(false);
    expect(validateEditOps([{ op: 'smoothSkin', params: { amount: 0.5 } }], DOCUMENT_SAFE_TOOLS).ok).toBe(false);
  });

  it('validateEditOps sigue exigiendo rangos en las ops nuevas', () => {
    expect(validateEditOps([{ op: 'smoothSkin', params: { amount: 5 } }], ['filterIntensity']).ok).toBe(false);
    expect(validateEditOps([{ op: 'backgroundReplace', params: { fit: 'stretch', assetId: 'a' } }], ['backgrounds']).ok).toBe(false);
    expect(validateEditOps([{ op: 'backgroundReplace', params: { assetId: 'a' } }], ['backgrounds']).ok).toBe(true);
  });

  it('las ops de fondo se omiten sin máscara y se aplican con ella', () => {
    const ops = [{ op: 'backgroundColor', params: { color: '#0000FF' } }];
    expect([...applyEditOps(photo(), ops).data]).toEqual([...photo().data]);
    const out = applyEditOps(photo(), ops, { mask: leftHalf(8, 8) });
    expect(getPixel(out, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(getPixel(out, 7, 0)).toEqual([0, 0, 255, 255]);
  });

  it('backgroundReplace necesita máscara y activo', () => {
    const scene = rasterOf(8, 8, () => GREEN);
    const ops = [{ op: 'backgroundReplace', params: { assetId: 'ast_scene' } }];
    expect([...applyEditOps(photo(), ops, { mask: leftHalf(8, 8) }).data]).toEqual([...photo().data]);
    const out = applyEditOps(photo(), ops, { mask: leftHalf(8, 8), assets: { ast_scene: scene } });
    expect(getPixel(out, 7, 7)).toEqual([0, 255, 0, 255]);
  });

  it('cutout deja alfa 0 fuera de la persona', () => {
    const out = applyEditOps(photo(), [{ op: 'cutout', params: { feather: 0 } }], { mask: leftHalf(8, 8) });
    expect(getPixel(out, 7, 0)[3]).toBe(0);
    expect(getPixel(out, 0, 0)[3]).toBe(255);
  });
});

describe('registro de efectos', () => {
  it('cubre todas las claves del contrato y copia su marca de documento', () => {
    for (const info of PHOTO_EFFECTS) {
      const impl = EFFECT_IMPLEMENTATIONS[info.key];
      expect(impl, info.key).toBeDefined();
      expect(impl.key).toBe(info.key);
      expect(impl.documentSafe).toBe(info.documentSafe);
      expect(impl.requires).toEqual(info.requires);
      expect(impl.stages).toEqual(info.stages);
      expect(['low', 'medium', 'high']).toContain(impl.cost);
    }
    expect(Object.keys(EFFECT_IMPLEMENTATIONS).length).toBe(PHOTO_EFFECTS.length);
  });

  it('el único efecto de píxel seguro para documentos es el fondo de color plano', () => {
    expect(documentSafeEffects().map((e) => e.key)).toEqual(['background.color']);
  });

  it('los efectos que no producen píxeles no tienen implementación', () => {
    for (const key of ['pose.guide', 'capture.smile', 'capture.gesture'] as const) {
      expect(EFFECT_IMPLEMENTATIONS[key].run).toBeNull();
      expect(EFFECT_IMPLEMENTATIONS[key].fn).toBeNull();
    }
  });

  it('applyEffect devuelve la foto intacta cuando le falta la máscara o el activo', () => {
    const photo = rasterOf(4, 4, () => RED);
    for (const key of ['background.blur', 'background.replace', 'background.color', 'face.sticker', 'pose.guide'] as const) {
      const out = applyEffect(key, { raster: photo });
      expect([...out.data], key).toEqual([...photo.data]);
      expect(out.data, key).not.toBe(photo.data);
    }
  });

  it('applyEffect aplica el efecto cuando recibe lo que necesita', () => {
    const photo = rasterOf(8, 8, () => RED);
    const blurred = applyEffect('background.color', { raster: photo, mask: leftHalf(8, 8), color: '#00FF00' });
    expect(getPixel(blurred, 7, 0)).toEqual([0, 255, 0, 255]);
    const filtered = applyEffect('filter.color', { raster: photo, filter: 'bw_contrast' });
    const [r, g, b] = getPixel(filtered, 0, 0);
    expect(r).toBe(g);
    expect(g).toBe(b);
  });

  it('los efectos declarados para la vista previa son los baratos', () => {
    for (const impl of Object.values(EFFECT_IMPLEMENTATIONS)) {
      if (impl.liveCapable) expect(impl.cost, impl.key).not.toBe('high');
    }
  });
});
