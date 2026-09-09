import { deflateSync, inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { decodePNG, encodePNG } from './png';
import { createRaster, setPixel } from './raster';
import type { Raster } from './raster';

function sample(width: number, height: number): Raster {
  const r = createRaster(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) setPixel(r, x, y, [(x * 37) & 255, (y * 91) & 255, (x * y) & 255, x === y ? 128 : 255]);
  }
  return r;
}

describe('PNG', () => {
  it('encodePNG produce la firma PNG y es determinista', () => {
    const bytes = encodePNG(sample(3, 2));
    expect(Array.from(bytes.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(encodePNG(sample(3, 2))).toEqual(bytes);
  });

  it('round-trip exacto con el deflate stored y el inflate propios', () => {
    const r = sample(7, 5);
    const back = decodePNG(encodePNG(r));
    expect(back.width).toBe(7);
    expect(back.height).toBe(5);
    expect(back.data).toEqual(r.data);
  });

  it('decodifica un PNG comprimido con node:zlib, con el inflate propio y con el inyectado', () => {
    const r = sample(64, 48);
    const deflate = (data: Uint8Array) => new Uint8Array(deflateSync(data));
    const inflate = (data: Uint8Array) => new Uint8Array(inflateSync(data));
    const compressed = encodePNG(r, { deflate });
    expect(compressed.length).toBeLessThan(encodePNG(r).length);
    expect(decodePNG(compressed).data).toEqual(r.data);
    expect(decodePNG(compressed, { inflate }).data).toEqual(r.data);
  });

  it('rechaza bytes que no son PNG', () => {
    expect(() => decodePNG(new Uint8Array([1, 2, 3]))).toThrow(/signature/);
  });
});
