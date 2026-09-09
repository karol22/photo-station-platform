import { describe, expect, it } from 'vitest';
import { createRaster, getPixel, setPixel } from '../raster';
import type { RGBA, Raster } from '../raster';
import { brightness, contrast, crop, grayscale, mirrorH, resize, rotate90 } from './index';

function rasterOf(width: number, height: number, at: (x: number, y: number) => RGBA): Raster {
  const r = createRaster(width, height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) setPixel(r, x, y, at(x, y));
  return r;
}

const RED: RGBA = [255, 0, 0, 255];
const GREEN: RGBA = [0, 255, 0, 255];
const BLUE: RGBA = [0, 0, 255, 255];
const GRAY: RGBA = [128, 128, 128, 255];

describe('ajustes', () => {
  it('brightness suma amount·255 y satura en los extremos', () => {
    const r = rasterOf(1, 1, () => [200, 100, 50, 200]);
    expect(getPixel(brightness(r, 1), 0, 0)).toEqual([255, 255, 255, 200]);
    expect(getPixel(brightness(r, -1), 0, 0)).toEqual([0, 0, 0, 200]);
    expect(getPixel(brightness(r, 0.2), 0, 0)).toEqual([251, 151, 101, 200]);
    expect(getPixel(brightness(r, 0), 0, 0)).toEqual([200, 100, 50, 200]);
  });

  it('contrast deja el gris medio intacto y separa el resto', () => {
    const r = rasterOf(2, 1, (x) => (x === 0 ? GRAY : [192, 64, 128, 255]));
    const out = contrast(r, 0.5);
    expect(getPixel(out, 0, 0)).toEqual([128, 128, 128, 255]);
    expect(getPixel(out, 1, 0)).toEqual([255, 0, 128, 255]);
  });

  it('grayscale usa la luma Rec.709 y conserva alpha', () => {
    const r = rasterOf(3, 1, (x) => (x === 0 ? [255, 0, 0, 255] : x === 1 ? [0, 255, 0, 128] : [0, 0, 255, 255]));
    const out = grayscale(r);
    expect(getPixel(out, 0, 0)).toEqual([54, 54, 54, 255]);
    expect(getPixel(out, 1, 0)).toEqual([182, 182, 182, 128]);
    expect(getPixel(out, 2, 0)).toEqual([18, 18, 18, 255]);
  });
});

describe('geometría', () => {
  it('mirrorH invierte cada fila', () => {
    const r = rasterOf(3, 2, (x, y) => (y === 0 ? [x, 0, 0, 255] : [0, x, 0, 255]));
    const out = mirrorH(r);
    expect(getPixel(out, 0, 0)).toEqual([2, 0, 0, 255]);
    expect(getPixel(out, 2, 0)).toEqual([0, 0, 0, 255]);
    expect(getPixel(out, 0, 1)).toEqual([0, 2, 0, 255]);
    expect(out.width).toBe(3);
    expect(out.height).toBe(2);
  });

  it('crop copia el rect exacto y lanza fuera de la imagen', () => {
    const r = rasterOf(4, 4, (x, y) => [x * 10, y * 10, 0, 255]);
    const out = crop(r, { x: 1, y: 2, w: 2, h: 2 });
    expect([out.width, out.height]).toEqual([2, 2]);
    expect(getPixel(out, 0, 0)).toEqual([10, 20, 0, 255]);
    expect(getPixel(out, 1, 1)).toEqual([20, 30, 0, 255]);
    // Un rect que desborda se intersecta con la imagen.
    expect(crop(r, { x: 3, y: 3, w: 5, h: 5 }).width).toBe(1);
    expect(() => crop(r, { x: 10, y: 10, w: 2, h: 2 })).toThrow(/outside/);
  });

  it('rotate90 gira en sentido horario y cuatro giros devuelven el original', () => {
    const r = rasterOf(2, 1, (x) => (x === 0 ? RED : BLUE));
    const once = rotate90(r, 1);
    expect([once.width, once.height]).toEqual([1, 2]);
    expect(getPixel(once, 0, 0)).toEqual(RED);
    expect(getPixel(once, 0, 1)).toEqual(BLUE);
    const twice = rotate90(r, 2);
    expect(getPixel(twice, 0, 0)).toEqual(BLUE);
    expect(getPixel(twice, 1, 0)).toEqual(RED);
    expect(rotate90(once, 3).data).toEqual(r.data);
    expect(rotate90(r, 4).data).toEqual(r.data);
    expect(rotate90(r, -1).data).toEqual(rotate90(r, 3).data);
  });

  it('resize 4×4 → 2×2 promedia cada bloque 2×2', () => {
    const r = rasterOf(4, 4, (x, y) => (x < 2 ? (y < 2 ? RED : GREEN) : y < 2 ? BLUE : GRAY));
    const out = resize(r, 2, 2);
    expect([out.width, out.height]).toEqual([2, 2]);
    expect(getPixel(out, 0, 0)).toEqual(RED);
    expect(getPixel(out, 1, 0)).toEqual(BLUE);
    expect(getPixel(out, 0, 1)).toEqual(GREEN);
    expect(getPixel(out, 1, 1)).toEqual(GRAY);
    const mixed = resize(rasterOf(2, 2, (x) => (x === 0 ? [0, 0, 0, 255] : [255, 255, 255, 255])), 1, 1);
    expect(getPixel(mixed, 0, 0)).toEqual([128, 128, 128, 255]);
  });

  it('resize amplía con bilineal manteniendo colores planos', () => {
    const out = resize(rasterOf(2, 2, () => GREEN), 5, 3);
    expect([out.width, out.height]).toEqual([5, 3]);
    for (let y = 0; y < 3; y++) for (let x = 0; x < 5; x++) expect(getPixel(out, x, y)).toEqual(GREEN);
  });
});
