/**
 * Guía orientativa para entretenimiento (requisito 6.3). Nunca bloquea: devuelve pistas.
 * `guidance.zone` se interpreta como caja normalizada 0..1 del frame. No hay instrucciones verticales
 * en `InstructionKey`; la posición vertical se sugiere sólo vía `headroomRatio` (`move_back`).
 */
import { measureFace } from './face-model';
import type { FrameAnalysis, InstructionKey, PoseGuidance } from './types';

export function evaluatePoseGuidance(
  analysis: FrameAnalysis,
  guidance: PoseGuidance | undefined,
): { ok: boolean; hints: InstructionKey[] } {
  if (!guidance) return { ok: true, hints: [] };
  const hints: InstructionKey[] = [];
  const push = (k: InstructionKey) => {
    if (!hints.includes(k)) hints.push(k);
  };

  const n = analysis.faces.length;
  if (n === 0) {
    push('no_face');
    return { ok: false, hints };
  }
  if (guidance.expectedPeople === 1 && n > 1) push('only_one_person');

  for (const face of analysis.faces) {
    const m = measureFace(face, analysis);
    if (guidance.zone) {
      const z = guidance.zone;
      const bx = face.box.x + face.box.w / 2;
      if (bx < z.x) push('move_right');
      else if (bx > z.x + z.w) push('move_left');
    }
    if (guidance.maxTiltDeg !== undefined && Math.abs(m.rollDeg) > guidance.maxTiltDeg) push('head_straight');
    if (guidance.minFaceRatio !== undefined && m.heightRatio < guidance.minFaceRatio) push('move_closer');
    if (guidance.headroomRatio !== undefined && m.crown.y / analysis.height < guidance.headroomRatio) {
      push('move_back');
    }
  }
  return { ok: hints.length === 0, hints };
}
