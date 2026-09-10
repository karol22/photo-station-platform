/**
 * El sonido del kiosco: una sola mesa de avisos para toda la aplicación, con el volumen que la
 * máquina tenga configurado.
 *
 * El volumen sale de `kiosk.volume`. Vale cero y entonces la cabina trabaja en silencio: ninguna
 * instrucción del recorrido depende de oírse, así que apagar el sonido no quita información.
 *
 * La mesa vive fuera de React porque un contexto de audio es caro y no debe rehacerse en cada
 * montaje; el enlace con React es sólo mantener el volumen al día.
 */
import { useEffect, useMemo } from 'react';
import { SoundBoard, buzz, type SoundCue } from '@psp/ui';
import { useKioskStore } from '../store';
import { configNumber } from '../theme/assets';

const board = new SoundBoard();

export interface KioskSound {
  /** Toca un aviso. Sin volumen o sin Web Audio no hace nada. */
  play: (cue: SoundCue) => void;
  /** Vibración corta de confirmación, donde el aparato la tenga. */
  buzz: (ms?: number) => void;
  /** Aviso y vibración a la vez: la confirmación de un toque. */
  confirm: (cue?: SoundCue) => void;
}

/** Volumen efectivo: el ajuste local del técnico manda sobre el del bundle. */
export function useVolume(): number {
  const bundle = useKioskStore((s) => s.bundle);
  const status = useKioskStore((s) => s.techStatus);
  const local = status?.effectiveConfigSummary?.['kiosk.volume'];
  if (typeof local === 'number' && Number.isFinite(local)) return local;
  return configNumber(bundle, 'kiosk.volume', 50);
}

export function useSound(): KioskSound {
  const volume = useVolume();
  useEffect(() => {
    board.setVolume(volume);
  }, [volume]);
  return useMemo(
    () => ({
      play: (cue) => board.play(cue),
      buzz: (ms) => buzz(ms),
      confirm: (cue = 'tap') => {
        board.play(cue);
        buzz();
      },
    }),
    [],
  );
}
