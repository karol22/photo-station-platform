import { VISION_CAPABILITIES } from '@psp/contracts';
import { describe, expect, it } from 'vitest';
import { capabilityBinding, capabilityReport } from './capabilities';
import { CATALOG } from './catalog';

describe('capabilityReport', () => {
  it('cubre todas las capacidades del contrato, en el mismo orden', () => {
    expect(capabilityReport().map((c) => c.key)).toEqual(VISION_CAPABILITIES.map((c) => c.key));
  });

  it('cada capacidad lista viene con adaptador, modelo y mock', () => {
    for (const c of capabilityReport().filter((c) => c.status === 'ready')) {
      expect(c.port, c.key).toBeDefined();
      expect(c.adapter?.model, c.key).toMatch(/^\/models\//);
      expect(c.adapter?.importPath, c.key).toMatch(/^@psp\/vision\//);
      expect(c.mock, c.key).toBeDefined();
    }
  });

  it('ninguna capacidad lista entra sin equivalente en Android', () => {
    for (const c of capabilityReport().filter((c) => c.status === 'ready')) {
      expect(c.android.supported, c.key).toBe(true);
      expect(c.android.className, c.key).toMatch(/^com\.google\.mediapipe\.tasks\.vision\./);
    }
  });

  it('las cuatro capacidades con modelo empaquetado están listas y el esqueleto no', () => {
    const status = Object.fromEntries(capabilityReport().map((c) => [c.key, c.status]));
    expect(status).toEqual({
      'face.landmarks': 'ready',
      'face.detection': 'ready',
      'segmentation.person': 'ready',
      'gesture.hands': 'ready',
      'pose.landmarks': 'mock',
    });
    expect(capabilityBinding('pose.landmarks')?.adapter).toBeUndefined();
    // La capacidad cara no corre en vivo: el contrato lo dice y el registro lo repite.
    expect(capabilityBinding('pose.landmarks')?.liveCapable).toBe(false);
  });

  it('copia coste y peso del catálogo de contratos, sin inventar números', () => {
    const segmentation = capabilityBinding('segmentation.person');
    const contract = VISION_CAPABILITIES.find((c) => c.key === 'segmentation.person');
    expect(segmentation?.cost).toBe(contract?.cost);
    expect(segmentation?.modelMb).toBe(contract?.modelMb);
    expect(capabilityBinding('gesture.hands')?.liveCapable).toBe(true);
  });
});

describe('CATALOG', () => {
  it('registra los puertos, los adaptadores y las capacidades nuevas', () => {
    const keys = CATALOG.map((e) => e.key);
    for (const key of [
      'vision.port.PersonSegmenter',
      'vision.port.GestureRecognizer',
      'vision.port.FaceDetector',
      'vision.segmenter',
      'vision.gestures',
      'vision.faceDetector',
      'vision.segmentation.person',
      'vision.gesture.hands',
      'vision.face.detection',
    ]) {
      expect(keys, key).toContain(key);
    }
  });

  it('no repite claves', () => {
    const keys = CATALOG.map((e) => e.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
