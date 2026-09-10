/**
 * Ciclo de cámara + visión: elige la fuente (webcam o sintética), crea el analizador y corre un bucle
 * `requestAnimationFrame` limitado a ~12 fps que analiza un frame reducido (640×360).
 */
import { useEffect, useRef, useState } from 'react';
import type { FaceAnalyzer, FrameAnalysis } from '@psp/vision';
import { MockFaceAnalyzer } from '@psp/vision';
import { useKioskStore } from '../store';
import { effectiveCameraKind } from '../store/reducers';
import { createAnalyzer } from '../vision/analyzer';
import { SyntheticSource, WebcamSource, type CameraSource } from './source';

export const ANALYSIS_WIDTH = 640;
export const ANALYSIS_HEIGHT = 360;
const TARGET_FPS = 12;

export type CameraPhase = 'starting' | 'ready' | 'failed';

export interface CameraState {
  source: CameraSource | undefined;
  analyzer: FaceAnalyzer | undefined;
  phase: CameraPhase;
  visionKind: 'mediapipe' | 'mock' | undefined;
}

/** Arranca la cámara al montar y la libera al desmontar. */
export function useCamera(enabled = true): CameraState {
  const forced = useKioskStore((s) => s.cameraForced);
  // Sólo el estado operativo de la cámara principal (booleano estable): el objeto `status` cambia con cada evento SSE.
  const cameraOperational = useKioskStore((s) => {
    const cam = s.status?.capabilities.find((c) => c.key === 'camera.primary');
    return cam ? cam.present && cam.operational : true;
  });
  const setCameraKind = useKioskStore((s) => s.setCameraKind);
  const setVisionLimited = useKioskStore((s) => s.setVisionLimited);
  const [state, setState] = useState<CameraState>({ source: undefined, analyzer: undefined, phase: 'starting', visionKind: undefined });

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    let source: CameraSource | undefined;
    let analyzer: FaceAnalyzer | undefined;
    let ownsAnalyzer = false;

    (async () => {
      const webcamAvailable = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
      let kind = effectiveCameraKind({ cameraForced: forced, status: cameraOperational ? undefined : { capabilities: [{ key: 'camera.primary', present: true, operational: false }] } }, webcamAvailable);
      if (kind === 'webcam') {
        source = new WebcamSource();
        try {
          await source.start();
        } catch {
          source.stop();
          // La cámara sintética es una herramienta de desarrollo y del panel técnico, no un
          // respaldo silencioso: vender una foto de un rostro dibujado sería un fraude. Sólo
          // sustituye a la real cuando el técnico la forzó o cuando corremos en desarrollo.
          if (forced === 'synthetic' || import.meta.env.DEV) {
            kind = 'synthetic';
          } else {
            if (!disposed) setState({ source: undefined, analyzer: undefined, phase: 'failed', visionKind: undefined });
            return;
          }
        }
      }
      if (kind === 'synthetic') {
        source = new SyntheticSource();
        await source.start();
      }
      if (disposed || !source) {
        source?.stop();
        return;
      }
      setCameraKind(kind);
      if (source.landmarks) {
        const synthetic = source;
        analyzer = new MockFaceAnalyzer((atMs, frame) => synthetic.landmarks?.(atMs, frame) ?? []);
        ownsAnalyzer = true;
        await analyzer.init();
        setVisionLimited(false);
      } else {
        const created = await createAnalyzer();
        analyzer = created.analyzer;
        setVisionLimited(created.limited);
      }
      if (disposed) {
        source.stop();
        if (ownsAnalyzer) analyzer.dispose();
        return;
      }
      // Perder la cámara a media sesión es un fallo, no un cuadro congelado: la pantalla pasa a
      // 'failed' y quien la usa se entera en vez de posar frente a una imagen muerta.
      source.onLost?.(() => {
        if (!disposed) setState({ source: undefined, analyzer: undefined, phase: 'failed', visionKind: undefined });
      });
      setState({ source, analyzer, phase: 'ready', visionKind: analyzer.kind });
    })().catch(() => {
      if (!disposed) setState((s) => ({ ...s, phase: 'failed' }));
    });

    return () => {
      disposed = true;
      source?.stop();
      // El analizador MediaPipe es compartido (caché); sólo se libera el mock propio de la fuente sintética.
      if (ownsAnalyzer) analyzer?.dispose();
      setState({ source: undefined, analyzer: undefined, phase: 'starting', visionKind: undefined });
    };
  }, [enabled, forced, cameraOperational, setCameraKind, setVisionLimited]);

  return state;
}

/** Bucle de análisis: dibuja el frame en un canvas oculto, extrae `ImageData` y llama al analizador. */
export function useFrameLoop(
  source: CameraSource | undefined,
  analyzer: FaceAnalyzer | undefined,
  onFrame: (analysis: FrameAnalysis, source: CameraSource) => void,
  active = true,
): void {
  const callback = useRef(onFrame);
  callback.current = onFrame;

  useEffect(() => {
    if (!source || !analyzer || !active) return;
    const canvas = document.createElement('canvas');
    canvas.width = ANALYSIS_WIDTH;
    canvas.height = ANALYSIS_HEIGHT;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    let raf = 0;
    let last = 0;
    let busy = false;
    let disposed = false;
    const interval = 1000 / TARGET_FPS;

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (busy || now - last < interval) return;
      last = now;
      busy = true;
      try {
        ctx.drawImage(source.element, 0, 0, ANALYSIS_WIDTH, ANALYSIS_HEIGHT);
        const frame = ctx.getImageData(0, 0, ANALYSIS_WIDTH, ANALYSIS_HEIGHT);
        analyzer
          .analyze(frame, now)
          .then((analysis) => {
            if (!disposed) callback.current(analysis, source);
          })
          .catch(() => undefined)
          .finally(() => {
            busy = false;
          });
      } catch {
        busy = false;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
    };
  }, [source, analyzer, active]);
}
