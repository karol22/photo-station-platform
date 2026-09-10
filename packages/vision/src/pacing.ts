/**
 * Ritmo del análisis. La vista previa tiene que sentirse viva
 * (`docs/producto/03-en-que-trabajar-ahora.md`): el análisis corre a resolución reducida y **no
 * necesariamente en cada cuadro**. Con esto el kiosco segmenta cada N cuadros (o cada N ms) y en
 * los cuadros intermedios reutiliza el último resultado, interpolando las cajas para que la guía
 * no dé saltos.
 *
 * Puro y determinista: el tiempo llega en `atMs`, no hay reloj propio ni temporizadores.
 */
import type { Box } from './types';
import { clamp01 } from './util';

export interface FramePacerOptions {
  /** Cuadros mínimos entre análisis (1 = todos los cuadros). */
  everyFrames?: number;
  /** Milisegundos mínimos entre análisis. Ambas condiciones deben cumplirse. */
  everyMs?: number;
}

/**
 * Decide qué cuadros se analizan y guarda el último resultado para los que no.
 *
 * `shouldRun` cuenta cuadros, así que se llama **exactamente una vez por cuadro**, antes de decidir
 * si se ejecuta el modelo.
 */
export class FramePacer<T> {
  private readonly everyFrames: number;
  private readonly everyMs: number;
  private framesSinceRun = 0;
  private lastRunMs: number | undefined;
  private kept: { value: T; atMs: number } | undefined;

  constructor(opts: FramePacerOptions = {}) {
    this.everyFrames = Math.max(1, Math.floor(opts.everyFrames ?? 1));
    this.everyMs = Math.max(0, opts.everyMs ?? 0);
  }

  shouldRun(atMs: number): boolean {
    this.framesSinceRun++;
    // El primer cuadro siempre se analiza: sin resultado no hay nada que reutilizar.
    if (this.lastRunMs !== undefined) {
      if (this.framesSinceRun < this.everyFrames) return false;
      if (atMs - this.lastRunMs < this.everyMs) return false;
    }
    this.framesSinceRun = 0;
    this.lastRunMs = atMs;
    return true;
  }

  /** Guarda el resultado del análisis que sí corrió. */
  keep(value: T, atMs: number): void {
    this.kept = { value, atMs };
  }

  /** Último resultado con su instante, o `undefined` si todavía no corrió ninguno. */
  get last(): { value: T; atMs: number } | undefined {
    return this.kept;
  }

  /** Antigüedad del último resultado en ms; `Infinity` si no hay ninguno. */
  ageMs(atMs: number): number {
    return this.kept ? atMs - this.kept.atMs : Infinity;
  }

  reset(): void {
    this.framesSinceRun = 0;
    this.lastRunMs = undefined;
    this.kept = undefined;
  }
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Interpola dos cajas para suavizar la guía entre dos análisis. `t` se recorta a 0..1. */
export function lerpBox(a: Box, b: Box, t: number): Box {
  const k = clamp01(t);
  return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k) };
}
