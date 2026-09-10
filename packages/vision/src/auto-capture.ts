/**
 * Controlador de captura automática (requisito 5.6). Determinista: el tiempo llega inyectado en `atMs`.
 *
 * idle → stabilizing (mientras `canAutoCapture`) → ready (al completar `stabilityMs` continuo)
 *      → fired (`shouldCapture` = true una sola vez, en el siguiente frame válido) → cooldown (`cooldownMs`) → idle.
 * Cualquier frame no válido durante idle/stabilizing/ready reinicia a idle. Durante cooldown se ignora la
 * validez hasta que vence el enfriamiento; ese mismo frame se procesa ya como idle.
 */
import type { AutoCaptureUpdate, ComplianceResult } from './types';
import { clamp01 } from './util';

type Phase = 'idle' | 'stabilizing' | 'ready' | 'cooldown';

export class AutoCaptureController {
  private readonly stabilityMs: number;
  private readonly cooldownMs: number;
  private phase: Phase = 'idle';
  /** Inicio de la ventana de estabilidad, o instante del disparo durante cooldown. */
  private since = 0;

  constructor(opts: { stabilityMs: number; cooldownMs?: number }) {
    this.stabilityMs = Math.max(0, opts.stabilityMs);
    this.cooldownMs = Math.max(0, opts.cooldownMs ?? 1500);
  }

  update(result: ComplianceResult, atMs: number): AutoCaptureUpdate {
    if (this.phase === 'cooldown') {
      const elapsed = atMs - this.since;
      if (elapsed < this.cooldownMs) {
        return { state: 'cooldown', progress: clamp01(elapsed / this.cooldownMs), shouldCapture: false };
      }
      this.phase = 'idle';
    }
    if (!result.canAutoCapture) {
      this.phase = 'idle';
      return { state: 'idle', progress: 0, shouldCapture: false };
    }
    if (this.phase === 'idle') {
      this.phase = 'stabilizing';
      this.since = atMs;
    }
    if (this.phase === 'stabilizing') {
      const elapsed = atMs - this.since;
      if (elapsed < this.stabilityMs) {
        return { state: 'stabilizing', progress: clamp01(elapsed / this.stabilityMs), shouldCapture: false };
      }
      this.phase = 'ready';
      return { state: 'ready', progress: 1, shouldCapture: false };
    }
    // ready → fired
    this.phase = 'cooldown';
    this.since = atMs;
    return { state: 'fired', progress: 1, shouldCapture: true };
  }

  reset(): void {
    this.phase = 'idle';
    this.since = 0;
  }
}
