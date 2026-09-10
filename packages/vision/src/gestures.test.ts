import { describe, expect, it } from 'vitest';
import { GestureTriggerController, MockGestureRecognizer } from './gestures';
import type { GestureName, GestureReading, HandGesture, ImageDataLike } from './types';

const hand = (gesture: GestureName, score = 0.9): HandGesture => ({
  gesture,
  score,
  box: { x: 0.4, y: 0.35, w: 0.15, h: 0.2 },
});

const reading = (hands: HandGesture[], atMs: number): GestureReading => ({ hands, atMs });

const frame: ImageDataLike = { data: new Uint8ClampedArray(0), width: 640, height: 480 };

describe('GestureTriggerController', () => {
  it('dispara una sola vez tras sostener el gesto y pasa a enfriamiento', () => {
    const c = new GestureTriggerController({ holdMs: 800, cooldownMs: 1000 });
    expect(c.update(reading([hand('open_palm')], 0))).toEqual({
      state: 'holding',
      progress: 0,
      shouldCapture: false,
      gesture: 'open_palm',
    });
    expect(c.update(reading([hand('open_palm')], 400)).progress).toBe(0.5);
    expect(c.update(reading([hand('open_palm')], 799)).state).toBe('holding');
    expect(c.update(reading([hand('open_palm')], 800))).toEqual({
      state: 'fired',
      progress: 1,
      shouldCapture: true,
      gesture: 'open_palm',
    });
    // Sostener más no vuelve a disparar: primero hay que esperar el enfriamiento.
    expect(c.update(reading([hand('open_palm')], 900))).toEqual({
      state: 'cooldown',
      progress: 0.1,
      shouldCapture: false,
      gesture: 'none',
    });
    expect(c.update(reading([hand('open_palm')], 1799)).shouldCapture).toBe(false);
    expect(c.update(reading([hand('open_palm')], 1800))).toEqual({
      state: 'holding',
      progress: 0,
      shouldCapture: false,
      gesture: 'open_palm',
    });
  });

  it('se reinicia si el gesto desaparece: un destello no dispara', () => {
    const c = new GestureTriggerController({ holdMs: 800 });
    expect(c.update(reading([hand('open_palm')], 0)).state).toBe('holding');
    expect(c.update(reading([hand('open_palm')], 400)).progress).toBe(0.5);
    expect(c.update(reading([], 500))).toEqual({
      state: 'idle',
      progress: 0,
      shouldCapture: false,
      gesture: 'none',
    });
    // El sostén vuelve a empezar de cero, no continúa donde iba.
    expect(c.update(reading([hand('open_palm')], 600)).progress).toBe(0);
    expect(c.update(reading([hand('open_palm')], 1000)).state).toBe('holding');
    expect(c.update(reading([hand('open_palm')], 1400)).shouldCapture).toBe(true);
  });

  it('ignora las lecturas de baja confianza y los gestos que no son el pedido', () => {
    const c = new GestureTriggerController({ holdMs: 500, minScore: 0.6 });
    expect(c.update(reading([hand('open_palm', 0.3)], 0)).state).toBe('idle');
    expect(c.update(reading([hand('victory', 0.99)], 500)).state).toBe('idle');
    expect(c.update(reading([hand('open_palm', 0.3), hand('open_palm', 0.8)], 600)).state).toBe('holding');
    expect(c.update(reading([hand('open_palm', 0.8)], 1100)).shouldCapture).toBe(true);
  });

  it('acepta otro gesto como disparador y se reinicia con reset()', () => {
    const c = new GestureTriggerController({ requiredGesture: 'victory', holdMs: 400 });
    expect(c.update(reading([hand('open_palm')], 0)).state).toBe('idle');
    expect(c.update(reading([hand('victory')], 0)).state).toBe('holding');
    c.reset();
    expect(c.update(reading([hand('victory')], 300)).progress).toBe(0);
    expect(c.update(reading([hand('victory')], 700)).shouldCapture).toBe(true);
  });
});

describe('MockGestureRecognizer', () => {
  it('sin guion no ve ninguna mano', async () => {
    const mock = new MockGestureRecognizer();
    await mock.init();
    expect(await mock.recognize(frame, 120)).toEqual({ hands: [], atMs: 120 });
    mock.dispose();
  });

  it('devuelve el guion inyectado, con lista fija o por instante', async () => {
    const fixed = new MockGestureRecognizer([hand('thumb_up')]);
    expect((await fixed.recognize(frame, 0)).hands[0]?.gesture).toBe('thumb_up');

    const scripted = new MockGestureRecognizer((atMs) => (atMs >= 1000 ? [hand('open_palm')] : []));
    expect((await scripted.recognize(frame, 0)).hands).toEqual([]);
    expect((await scripted.recognize(frame, 1000)).hands).toHaveLength(1);
  });

  it('alimenta al controlador sin reloj propio: mismo guion, mismo disparo', async () => {
    const mock = new MockGestureRecognizer((atMs) => (atMs >= 200 ? [hand('open_palm')] : []));
    const c = new GestureTriggerController({ holdMs: 600 });
    const fired: number[] = [];
    for (let atMs = 0; atMs <= 1200; atMs += 100) {
      const step = c.update(await mock.recognize(frame, atMs));
      if (step.shouldCapture) fired.push(atMs);
    }
    expect(fired).toEqual([800]);
  });
});
