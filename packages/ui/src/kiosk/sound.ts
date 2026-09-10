/**
 * El sonido de la cabina.
 *
 * Una cabina en una plaza suena. No suena mucho: el contrato de un local comercial suele
 * restringir el audio continuo, y una instrucción que sólo viaja por el oído deja fuera a quien
 * no oye. Así que aquí no hay música ni voz: hay avisos cortos que confirman lo que la pantalla
 * ya dice por su cuenta.
 *
 * Con el volumen en cero no se pierde una sola instrucción, porque cada aviso tiene gemelo visual
 * obligatorio: la cuenta se ve en el anillo, el obturador en el destello y en los ojos que se
 * cierran, el aterrizaje en el foco que se enciende, la tanda completa en las formas que entran,
 * y el cobro aprobado en la pantalla entera cambiando de color.
 *
 * No se empaqueta ni un archivo de audio: los avisos se sintetizan con osciladores. Eso deja el
 * paquete sin activos que descargar, funciona sin conexión y suena igual en cualquier aparato.
 *
 * La partitura es datos puros y se prueba en Node. Tocarla es I/O y vive en `SoundBoard`, que no
 * crea el contexto de audio hasta el primer toque, porque un navegador no deja sonar antes.
 */

/** Los avisos que la cabina sabe dar. */
export type SoundCue =
  /** Cada segundo de la cuenta regresiva. */
  | 'tick'
  /** El último segundo antes del disparo. */
  | 'tick_last'
  /** El obturador. */
  | 'shutter'
  /** La tanda completa. */
  | 'complete'
  /** Confirmación de un toque. */
  | 'tap'
  /** Una miniatura aterriza en su hueco. */
  | 'land'
  /** El cobro quedó aprobado. */
  | 'approved'
  /** Algo no se pudo hacer. */
  | 'reject';

/** Un tono de la partitura. Los tiempos son segundos desde el inicio del aviso. */
export interface SoundTone {
  /** Cuándo entra, en segundos desde el inicio. */
  at: number;
  /** Frecuencia en hercios. Con `noise` se usa como corte del filtro. */
  hz: number;
  /** Cuánto dura, en segundos. */
  dur: number;
  /** Timbre. `noise` es ruido filtrado: así suena el obturador. */
  shape: 'sine' | 'triangle' | 'square' | 'noise';
  /** Volumen relativo del tono, de 0 a 1, antes del volumen de la máquina. */
  gain: number;
  /** Frecuencia final para un barrido; sin ella el tono es fijo. */
  toHz?: number;
}

/**
 * La partitura de cada aviso.
 *
 * Los avisos de cuenta suben de tono hacia el disparo, que es como se entiende sin explicación
 * que el momento se acerca. El obturador es ruido corto con un golpe grave debajo: nadie lo
 * confunde con otra cosa. El de tanda completa es el único acorde, y es el único momento del
 * recorrido que se celebra.
 */
export const SOUND_SCORES: Record<SoundCue, readonly SoundTone[]> = {
  tick: [{ at: 0, hz: 880, dur: 0.07, shape: 'sine', gain: 0.5 }],
  tick_last: [
    { at: 0, hz: 1320, dur: 0.12, shape: 'sine', gain: 0.7 },
    { at: 0, hz: 660, dur: 0.12, shape: 'triangle', gain: 0.3 },
  ],
  shutter: [
    { at: 0, hz: 2600, dur: 0.045, shape: 'noise', gain: 0.85 },
    { at: 0, hz: 180, dur: 0.06, shape: 'triangle', gain: 0.5, toHz: 90 },
    { at: 0.07, hz: 1800, dur: 0.05, shape: 'noise', gain: 0.4 },
  ],
  complete: [
    { at: 0, hz: 523.25, dur: 0.13, shape: 'triangle', gain: 0.55 },
    { at: 0.1, hz: 659.25, dur: 0.13, shape: 'triangle', gain: 0.55 },
    { at: 0.2, hz: 783.99, dur: 0.13, shape: 'triangle', gain: 0.55 },
    { at: 0.3, hz: 1046.5, dur: 0.34, shape: 'triangle', gain: 0.6 },
  ],
  tap: [{ at: 0, hz: 1500, dur: 0.022, shape: 'sine', gain: 0.28 }],
  land: [{ at: 0, hz: 440, dur: 0.12, shape: 'sine', gain: 0.22 }],
  approved: [
    { at: 0, hz: 523.25, dur: 0.1, shape: 'triangle', gain: 0.5 },
    { at: 0.1, hz: 783.99, dur: 0.1, shape: 'triangle', gain: 0.5 },
  ],
  reject: [
    { at: 0, hz: 320, dur: 0.1, shape: 'square', gain: 0.32 },
    { at: 0.11, hz: 240, dur: 0.16, shape: 'square', gain: 0.32 },
  ],
};

/** Cuánto dura un aviso completo, en segundos. Útil para encadenarlos sin que se pisen. */
export function cueDuration(cue: SoundCue): number {
  return SOUND_SCORES[cue].reduce((max, tone) => Math.max(max, tone.at + tone.dur), 0);
}

/**
 * Volumen de la máquina (0 a 100) convertido a ganancia.
 *
 * La curva es cuadrática y no lineal porque el oído no es lineal: al 50 % de la barra se espera
 * algo claramente más bajo que la mitad, no la mitad exacta de la presión sonora. El techo es
 * 0.35 para que una cabina al máximo se oiga desde el pasillo sin molestar al local de al lado.
 */
export function volumeToGain(volume: number): number {
  const clamped = Math.min(100, Math.max(0, volume));
  return (clamped / 100) ** 2 * 0.35;
}

/** Generador determinista para el ruido del obturador: sin `Math.random`, mismo sonido siempre. */
function noiseSample(seed: number): { value: number; seed: number } {
  // Congruencial lineal de 32 bits; sólo se necesita que no repita patrón audible.
  const next = (seed * 1664525 + 1013904223) >>> 0;
  return { value: (next / 0x100000000) * 2 - 1, seed: next };
}

/**
 * Lo mínimo que `SoundBoard` necesita de la Web Audio API. Se declara aquí, y no se usan los tipos
 * del DOM, para poder pasarle un doble en las pruebas y para que el paquete siga compilando en un
 * entorno sin `AudioContext`.
 */
export interface AudioParamLike {
  setValueAtTime(value: number, at: number): void;
  linearRampToValueAtTime(value: number, at: number): void;
  exponentialRampToValueAtTime(value: number, at: number): void;
}

export interface AudioNodeLike {
  connect(destination: unknown): unknown;
}

export interface GainNodeLike extends AudioNodeLike {
  readonly gain: AudioParamLike;
}

export interface OscillatorNodeLike extends AudioNodeLike {
  type: string;
  readonly frequency: AudioParamLike;
  start(at: number): void;
  stop(at: number): void;
}

export interface AudioBufferLike {
  getChannelData(channel: number): Float32Array;
}

export interface BufferSourceNodeLike extends AudioNodeLike {
  buffer: AudioBufferLike | null;
  start(at: number): void;
  stop(at: number): void;
}

export interface BiquadFilterNodeLike extends AudioNodeLike {
  type: string;
  readonly frequency: AudioParamLike;
  readonly Q: AudioParamLike;
}

export interface AudioContextLike {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly destination: unknown;
  readonly state: string;
  resume(): Promise<void>;
  close(): Promise<void>;
  createOscillator(): OscillatorNodeLike;
  createGain(): GainNodeLike;
  createBufferSource(): BufferSourceNodeLike;
  createBuffer(channels: number, length: number, rate: number): AudioBufferLike;
  createBiquadFilter(): BiquadFilterNodeLike;
}

export interface SoundBoardOptions {
  /** Volumen de la máquina, de 0 a 100. */
  volume?: number;
  /** Fábrica del contexto; por defecto la del navegador. Sin ella, la cabina queda muda. */
  createContext?: () => AudioContextLike | undefined;
}

function browserContext(): AudioContextLike | undefined {
  const Ctor = (globalThis as { AudioContext?: new () => AudioContextLike }).AudioContext;
  return Ctor ? new Ctor() : undefined;
}

/**
 * Toca los avisos. Se construye una vez por aplicación y se le cambia el volumen cuando cambia la
 * configuración de la máquina.
 *
 * El contexto de audio nace en el primer `play` y no antes: los navegadores no dejan sonar hasta
 * que hay un gesto de la persona, y crearlo en el arranque sólo deja un contexto suspendido.
 * Si el aparato no tiene Web Audio, cada llamada no hace nada y nadie se entera.
 */
export class SoundBoard {
  private context: AudioContextLike | undefined;
  private created = false;
  private gain = 0;
  private readonly factory: () => AudioContextLike | undefined;

  constructor(options: SoundBoardOptions = {}) {
    this.gain = volumeToGain(options.volume ?? 0);
    this.factory = options.createContext ?? browserContext;
  }

  /** Volumen de la máquina, de 0 a 100. En cero la cabina queda muda sin cerrar nada. */
  setVolume(volume: number): void {
    this.gain = volumeToGain(volume);
  }

  get muted(): boolean {
    return this.gain <= 0;
  }

  play(cue: SoundCue): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    const start = ctx.currentTime + 0.005;
    for (const tone of SOUND_SCORES[cue]) this.playTone(ctx, tone, start + tone.at);
  }

  /** Libera el contexto. Se llama al desmontar la aplicación; volver a tocar lo crea de nuevo. */
  close(): void {
    const ctx = this.context;
    this.context = undefined;
    this.created = false;
    void ctx?.close().catch(() => undefined);
  }

  private ensureContext(): AudioContextLike | undefined {
    if (this.created) return this.context;
    this.created = true;
    try {
      this.context = this.factory();
    } catch {
      // Un aparato sin Web Audio es una cabina muda, no una cabina rota.
      this.context = undefined;
    }
    return this.context;
  }

  private playTone(ctx: AudioContextLike, tone: SoundTone, at: number): void {
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0, at);
    amp.gain.linearRampToValueAtTime(this.gain * tone.gain, at + 0.006);
    amp.gain.exponentialRampToValueAtTime(0.0001, at + tone.dur);
    amp.connect(ctx.destination);

    if (tone.shape === 'noise') {
      const length = Math.max(1, Math.ceil(ctx.sampleRate * tone.dur));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let seed = 0x9e3779b9;
      for (let i = 0; i < length; i++) {
        const sample = noiseSample(seed);
        seed = sample.seed;
        data[i] = sample.value;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(tone.hz, at);
      filter.Q.setValueAtTime(0.8, at);
      source.connect(filter);
      filter.connect(amp);
      source.start(at);
      source.stop(at + tone.dur);
      return;
    }

    const osc = ctx.createOscillator();
    osc.type = tone.shape;
    osc.frequency.setValueAtTime(tone.hz, at);
    if (tone.toHz !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, tone.toHz), at + tone.dur);
    osc.connect(amp);
    osc.start(at);
    osc.stop(at + tone.dur);
  }
}

/**
 * Vibración corta de confirmación. Android la tiene y iOS no; donde no existe simplemente no
 * pasa nada, que es el comportamiento correcto para un adorno de realimentación.
 */
export function buzz(ms = 12): void {
  const nav = (globalThis as { navigator?: { vibrate?: (pattern: number) => boolean } }).navigator;
  try {
    nav?.vibrate?.(ms);
  } catch {
    // Un aparato que rechaza la vibración no debe interrumpir nada.
  }
}
