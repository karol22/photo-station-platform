/**
 * Fuentes de cámara. `WebcamSource` usa `getUserMedia`; `SyntheticSource` dibuja un rostro
 * estilizado en un canvas y expone sus landmarks (`syntheticFace`) para que la guía visual funcione
 * sin webcam. Los "casos" (lejos, cerca, ladeado, dos rostros, oscuro) los fuerza el panel técnico.
 */
import { create } from 'zustand';
import { DEFAULT_SYNTHETIC_FACE, syntheticFace, type FaceLandmarks, type SyntheticFaceOptions } from '@psp/vision';

export type SyntheticScenario = 'ok' | 'far' | 'close' | 'tilted' | 'two_faces' | 'dark' | 'off_center' | 'eyes_closed';
export const SYNTHETIC_SCENARIOS: SyntheticScenario[] = ['ok', 'far', 'close', 'tilted', 'two_faces', 'dark', 'off_center', 'eyes_closed'];

export const useSyntheticStore = create<{ scenario: SyntheticScenario; setScenario: (s: SyntheticScenario) => void }>()((set) => ({
  scenario: 'ok',
  setScenario: (scenario) => set({ scenario }),
}));

export interface CameraSource {
  readonly kind: 'webcam' | 'synthetic';
  readonly width: number;
  readonly height: number;
  /** Elemento dibujable: `<video>` real o canvas sintético. */
  readonly element: HTMLVideoElement | HTMLCanvasElement;
  start(): Promise<void>;
  stop(): void;
  /**
   * Avisa cuando la fuente deja de dar imagen sola: cable desconectado, cámara tomada por otra
   * aplicación, permiso revocado. Sin esto, el `<video>` se congela en el último cuadro y la
   * cabina sigue «capturando» un fotograma muerto.
   */
  onLost?(handler: () => void): () => void;
  /** Sólo la fuente sintética conoce sus rostros; alimenta al `MockFaceAnalyzer`. */
  landmarks?(atMs: number, frame: { width: number; height: number }): FaceLandmarks[];
}

export const FRAME_WIDTH = 1280;
export const FRAME_HEIGHT = 720;

export class WebcamSource implements CameraSource {
  readonly kind = 'webcam' as const;
  readonly element: HTMLVideoElement;
  private stream: MediaStream | undefined;
  private lostHandlers = new Set<() => void>();
  private stopped = false;
  width = FRAME_WIDTH;
  height = FRAME_HEIGHT;

  constructor() {
    this.element = document.createElement('video');
    this.element.autoplay = true;
    this.element.muted = true;
    this.element.playsInline = true;
  }

  async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('getUserMedia unavailable');
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: FRAME_WIDTH }, height: { ideal: FRAME_HEIGHT } },
      audio: false,
    });
    this.element.srcObject = this.stream;
    await this.element.play();
    this.width = this.element.videoWidth || FRAME_WIDTH;
    this.height = this.element.videoHeight || FRAME_HEIGHT;
    for (const track of this.stream.getVideoTracks()) {
      track.addEventListener('ended', this.onTrackLost);
      track.addEventListener('mute', this.onTrackLost);
    }
  }

  private readonly onTrackLost = (): void => this.reportLost();

  private reportLost(): void {
    if (this.stopped) return;
    for (const handler of this.lostHandlers) handler();
  }

  onLost(handler: () => void): () => void {
    this.lostHandlers.add(handler);
    return () => this.lostHandlers.delete(handler);
  }

  stop(): void {
    this.stopped = true;
    this.lostHandlers.clear();
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    this.element.srcObject = null;
  }
}

function scenarioOptions(scenario: SyntheticScenario, tMs: number): Partial<SyntheticFaceOptions>[] {
  const wobble = Math.sin(tMs / 2400) * 0.015;
  const base: Partial<SyntheticFaceOptions> = { ...DEFAULT_SYNTHETIC_FACE, cx: 0.5 + wobble, cy: 0.44 + Math.cos(tMs / 3100) * 0.01, aspect: FRAME_WIDTH / FRAME_HEIGHT };
  switch (scenario) {
    case 'far':
      return [{ ...base, height: 0.3 }];
    case 'close':
      return [{ ...base, height: 0.95 }];
    case 'tilted':
      return [{ ...base, rollDeg: 14, yawDeg: 12 }];
    case 'two_faces':
      return [{ ...base, cx: 0.36, height: 0.5 }, { ...base, cx: 0.66, height: 0.48 }];
    case 'off_center':
      return [{ ...base, cx: 0.22 }];
    case 'eyes_closed':
      return [{ ...base, eyesOpen: 0.05 }];
    case 'dark':
    case 'ok':
    default:
      return [base];
  }
}

export class SyntheticSource implements CameraSource {
  readonly kind = 'synthetic' as const;
  readonly element: HTMLCanvasElement;
  readonly width = FRAME_WIDTH;
  readonly height = FRAME_HEIGHT;
  private raf = 0;
  private startedAt = 0;

  constructor() {
    this.element = document.createElement('canvas');
    this.element.width = FRAME_WIDTH;
    this.element.height = FRAME_HEIGHT;
  }

  private scenario(): SyntheticScenario {
    return useSyntheticStore.getState().scenario;
  }

  landmarks(atMs: number, frame: { width: number; height: number }): FaceLandmarks[] {
    const aspect = frame.height > 0 ? frame.width / frame.height : 1;
    return scenarioOptions(this.scenario(), atMs).map((o) => syntheticFace({ ...o, aspect }));
  }

  async start(): Promise<void> {
    this.startedAt = performance.now();
    const draw = () => {
      this.render(performance.now() - this.startedAt);
      this.raf = requestAnimationFrame(draw);
    };
    draw();
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
  }

  private render(tMs: number): void {
    const ctx = this.element.getContext('2d');
    if (!ctx) return;
    const W = this.width;
    const H = this.height;
    const dark = this.scenario() === 'dark';
    ctx.fillStyle = dark ? '#3a3a3a' : '#e9ecef';
    ctx.fillRect(0, 0, W, H);
    for (const face of scenarioOptions(this.scenario(), tMs)) {
      const cx = (face.cx ?? 0.5) * W;
      const cy = (face.cy ?? 0.44) * H;
      const fh = (face.height ?? 0.64) * H;
      const fw = fh * 0.74;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(((face.rollDeg ?? 0) * Math.PI) / 180);
      // Hombros
      ctx.fillStyle = dark ? '#4a4f5a' : '#7c8798';
      ctx.beginPath();
      ctx.ellipse(0, fh * 0.95, fw * 1.6, fh * 0.55, 0, Math.PI, 2 * Math.PI);
      ctx.fill();
      // Rostro
      ctx.fillStyle = dark ? '#7a6a5a' : '#f1c9a5';
      ctx.beginPath();
      ctx.ellipse(0, 0, fw / 2, fh / 2, 0, 0, 2 * Math.PI);
      ctx.fill();
      // Ojos (línea de ojos = centro)
      const open = face.eyesOpen ?? 1;
      ctx.fillStyle = '#2b2b2b';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(side * fw * 0.2, 0, fw * 0.06, Math.max(1.5, fw * 0.06 * open), 0, 0, 2 * Math.PI);
        ctx.fill();
      }
      // Boca
      ctx.strokeStyle = '#a8534d';
      ctx.lineWidth = Math.max(2, fh * 0.02);
      ctx.beginPath();
      const smile = face.smile ?? 0;
      ctx.arc(0, fh * 0.22, fw * 0.16, 0.15 * Math.PI, 0.85 * Math.PI, smile < 0.2);
      ctx.stroke();
      ctx.restore();
    }
  }
}
