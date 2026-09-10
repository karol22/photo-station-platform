import { describe, expect, it } from 'vitest';
import { SOUND_SCORES, SoundBoard, cueDuration, volumeToGain, type AudioContextLike, type SoundCue } from './sound';

const CUES = Object.keys(SOUND_SCORES) as SoundCue[];

describe('partitura de los avisos', () => {
  it('cada aviso tiene al menos un tono', () => {
    for (const cue of CUES) expect(SOUND_SCORES[cue].length).toBeGreaterThan(0);
  });

  it('ningún aviso dura más de medio segundo salvo la celebración', () => {
    for (const cue of CUES) {
      const limit = cue === 'complete' ? 0.7 : 0.5;
      expect(cueDuration(cue), cue).toBeLessThanOrEqual(limit);
    }
  });

  it('todos los tonos son audibles y con ganancia dentro de rango', () => {
    for (const cue of CUES) {
      for (const tone of SOUND_SCORES[cue]) {
        expect(tone.hz, cue).toBeGreaterThan(20);
        expect(tone.hz, cue).toBeLessThan(20000);
        expect(tone.gain, cue).toBeGreaterThan(0);
        expect(tone.gain, cue).toBeLessThanOrEqual(1);
        expect(tone.dur, cue).toBeGreaterThan(0);
      }
    }
  });

  it('la cuenta final suena más aguda que la cuenta normal', () => {
    expect(SOUND_SCORES.tick_last[0]!.hz).toBeGreaterThan(SOUND_SCORES.tick[0]!.hz);
  });
});

describe('volumeToGain', () => {
  it('en cero deja la cabina muda', () => {
    expect(volumeToGain(0)).toBe(0);
  });

  it('crece con el volumen y nunca pasa del techo', () => {
    expect(volumeToGain(50)).toBeGreaterThan(volumeToGain(20));
    expect(volumeToGain(100)).toBeLessThanOrEqual(0.35);
  });

  it('recorta los valores fuera de rango en vez de romperse', () => {
    expect(volumeToGain(-40)).toBe(0);
    expect(volumeToGain(400)).toBe(volumeToGain(100));
  });
});

/** Doble mínimo de la Web Audio API que registra qué se pidió tocar. */
function fakeContext() {
  const started: number[] = [];
  const param = () => ({ setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} });
  const node = () => ({ connect() {} });
  const ctx = {
    currentTime: 0,
    sampleRate: 48000,
    destination: {},
    state: 'running',
    async resume() {},
    async close() {},
    createOscillator: () => ({ ...node(), type: 'sine', frequency: param(), start: (at: number) => started.push(at), stop() {} }),
    createGain: () => ({ ...node(), gain: param() }),
    createBufferSource: () => ({ ...node(), buffer: null, start: (at: number) => started.push(at), stop() {} }),
    createBuffer: (_c: number, length: number) => ({ getChannelData: () => new Float32Array(length) }),
    createBiquadFilter: () => ({ ...node(), type: 'bandpass', frequency: param(), Q: param() }),
  } as unknown as AudioContextLike;
  return { ctx, started };
}

describe('SoundBoard', () => {
  it('con volumen cero no crea ni siquiera el contexto de audio', () => {
    let created = 0;
    const board = new SoundBoard({ volume: 0, createContext: () => { created++; return fakeContext().ctx; } });
    board.play('shutter');
    expect(created).toBe(0);
    expect(board.muted).toBe(true);
  });

  it('toca un tono por cada entrada de la partitura', () => {
    const fake = fakeContext();
    const board = new SoundBoard({ volume: 80, createContext: () => fake.ctx });
    board.play('shutter');
    expect(fake.started.length).toBe(SOUND_SCORES.shutter.length);
  });

  it('crea el contexto una sola vez aunque se toque muchas veces', () => {
    let created = 0;
    const fake = fakeContext();
    const board = new SoundBoard({ volume: 60, createContext: () => { created++; return fake.ctx; } });
    board.play('tick');
    board.play('tick');
    board.play('complete');
    expect(created).toBe(1);
  });

  it('un aparato sin Web Audio deja la cabina muda sin lanzar error', () => {
    const board = new SoundBoard({ volume: 100, createContext: () => undefined });
    expect(() => board.play('complete')).not.toThrow();
  });

  it('un contexto que falla al crearse no rompe la pantalla', () => {
    const board = new SoundBoard({ volume: 100, createContext: () => { throw new Error('sin audio'); } });
    expect(() => board.play('tap')).not.toThrow();
  });

  it('bajar el volumen a cero silencia sin cerrar el contexto', () => {
    const fake = fakeContext();
    const board = new SoundBoard({ volume: 90, createContext: () => fake.ctx });
    board.play('tick');
    const afterFirst = fake.started.length;
    board.setVolume(0);
    board.play('tick');
    expect(fake.started.length).toBe(afterFirst);
  });
});
