import type { AiJobState, LocalizedText } from '@psp/contracts';

const text = (es: string, en: string): LocalizedText => ({ es, en });

/** Texto al cliente por estado de un job de IA (requisito 11.3). */
export const AI_JOB_STATE_MESSAGES: Readonly<Record<AiJobState, LocalizedText>> = {
  unavailable: text(
    'Esta función no está disponible en esta máquina.',
    'This feature is not available on this machine.',
  ),
  coming_soon: text('Próximamente.', 'Coming soon.'),
  consent_required: text(
    'Necesitamos tu consentimiento para procesar la foto con un proveedor externo.',
    'We need your consent to process the photo with an external provider.',
  ),
  processing: text('Procesando tu foto…', 'Processing your photo…'),
  ready: text('Tu resultado está listo.', 'Your result is ready.'),
  error: text('No pudimos procesar tu foto.', 'We could not process your photo.'),
  retry: text('Reintentando…', 'Retrying…'),
  rejected: text(
    'El resultado fue rechazado o la experiencia no está disponible con este proveedor.',
    'The result was rejected or the experience is not available with this provider.',
  ),
  disabled: text(
    'El servicio está temporalmente deshabilitado.',
    'The service is temporarily disabled.',
  ),
};

export function aiJobMessage(state: AiJobState): LocalizedText {
  return { ...AI_JOB_STATE_MESSAGES[state] };
}
