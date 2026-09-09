/**
 * Gestos de mano: reconocedor mock y controlador de disparo.
 *
 * El controlador es lo que permite disparar sin tocar la pantalla a un metro de distancia. Exige
 * **sostener** el gesto (`holdMs`), no un destello, porque una mano que pasa por delante no es una
 * intención; e ignora las lecturas de poca confianza, que es de donde salen los disparos fantasma.
 * Determinista: el tiempo llega en `reading.atMs`, nunca de un reloj propio.
 */
import type {
  GestureName,
  GestureReading,
  GestureRecognizer,
  GestureTriggerUpdate,
  HandGesture,
  ImageDataLike,
  MockGestureScript,
} from './types';
import { clamp01 } from './util';

export interface GestureTriggerOptions {
  /** Gesto que dispara. Por defecto la palma abierta: es el más fácil de explicar en pantalla. */
  requiredGesture?: GestureName;
  /** Milisegundos que hay que sostener el gesto antes de disparar. */
  holdMs: number;
  /** Enfriamiento tras el disparo, para no encadenar capturas. */
  cooldownMs?: number;
  /** Confianza mínima; por debajo la lectura se ignora como si no hubiera mano. */
  minScore?: number;
}

type Phase = 'idle' | 'holding' | 'cooldown';

const NO_GESTURE: GestureName = 'none';

export class GestureTriggerController {
  private readonly requiredGesture: GestureName;
  private readonly holdMs: number;
  private readonly cooldownMs: number;
  private readonly minScore: number;
  private phase: Phase = 'idle';
  /** Inicio del sostén, o instante del disparo durante el enfriamiento. */
  private since = 0;

  constructor(opts: GestureTriggerOptions) {
    this.requiredGesture = opts.requiredGesture ?? 'open_palm';
    this.holdMs = Math.max(0, opts.holdMs);
    this.cooldownMs = Math.max(0, opts.cooldownMs ?? 1500);
    this.minScore = clamp01(opts.minScore ?? 0.6);
  }

  /** Mano del gesto pedido con más confianza, o `undefined` si ninguna llega al mínimo. */
  private match(reading: GestureReading): HandGesture | undefined {
    let best: HandGesture | undefined;
    for (const hand of reading.hands) {
      if (hand.gesture !== this.requiredGesture) continue;
      if (hand.score < this.minScore) continue;
      if (!best || hand.score > best.score) best = hand;
    }
    return best;
  }

  update(reading: GestureReading): GestureTriggerUpdate {
    const atMs = reading.atMs;
    if (this.phase === 'cooldown') {
      const elapsed = atMs - this.since;
      if (elapsed < this.cooldownMs) {
        return {
          state: 'cooldown',
          progress: clamp01(elapsed / this.cooldownMs),
          shouldCapture: false,
          gesture: NO_GESTURE,
        };
      }
      // Vencido el enfriamiento, esta misma lectura se procesa ya como `idle`.
      this.phase = 'idle';
    }

    const hand = this.match(reading);
    if (!hand) {
      // El gesto desapareció (o nunca fue creíble): el sostén se reinicia desde cero.
      this.phase = 'idle';
      return { state: 'idle', progress: 0, shouldCapture: false, gesture: NO_GESTURE };
    }

    if (this.phase === 'idle') {
      this.phase = 'holding';
      this.since = atMs;
    }
    const elapsed = atMs - this.since;
    if (elapsed < this.holdMs) {
      return {
        state: 'holding',
        progress: clamp01(elapsed / this.holdMs),
        shouldCapture: false,
        gesture: hand.gesture,
      };
    }
    this.phase = 'cooldown';
    this.since = atMs;
    return { state: 'fired', progress: 1, shouldCapture: true, gesture: hand.gesture };
  }

  reset(): void {
    this.phase = 'idle';
    this.since = 0;
  }
}

/** Guion por defecto: no hay manos. El mock sólo ve lo que se le inyecta. */
export const emptyGestureScript: MockGestureScript = () => [];

export class MockGestureRecognizer implements GestureRecognizer {
  readonly kind = 'mock' as const;
  private readonly script: MockGestureScript;

  /** Acepta una lista fija de manos o un guion que las calcula por instante. */
  constructor(script: MockGestureScript | HandGesture[] = emptyGestureScript) {
    this.script = typeof script === 'function' ? script : () => script;
  }

  init(): Promise<void> {
    return Promise.resolve();
  }

  recognize(frame: ImageDataLike, atMs: number): Promise<GestureReading> {
    const hands = this.script(atMs, { width: frame.width, height: frame.height });
    return Promise.resolve({ hands, atMs });
  }

  dispose(): void {
    // Nada que liberar.
  }
}
