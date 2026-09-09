/**
 * Puerta única del kiosco hacia el codificador de QR de `@psp/imaging`.
 *
 * El código que se muestra en pantalla tiene que ser escaneable de verdad por el teléfono del
 * cliente. Si el codificador no está disponible en tiempo de ejecución, esta función devuelve
 * `undefined` y el panel muestra el código corto en vez de un QR falso: es preferible pedirle al
 * cliente que teclee seis caracteres en su teléfono que enseñarle un cuadro que no lee.
 */
import * as imaging from '@psp/imaging';

type Encoder = (payload: string) => boolean[][];

const encoder: Encoder | undefined =
  typeof (imaging as { qrModules?: unknown }).qrModules === 'function'
    ? ((imaging as unknown as { qrModules: Encoder }).qrModules)
    : undefined;

export const qrAvailable = encoder !== undefined;

export function qrMatrix(payload: string): boolean[][] | undefined {
  if (!encoder) return undefined;
  try {
    const modules = encoder(payload);
    return modules.length > 0 ? modules : undefined;
  } catch {
    return undefined;
  }
}
