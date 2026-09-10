import type { LocalizedText, PaymentState } from '@psp/contracts';

const text = (es: string, en: string): LocalizedText => ({ es, en });

/**
 * Texto al cliente por estado de pago (requisito 10.3). Viaja en `PaymentIntent.message`;
 * el kiosco lo resuelve con `tl()` de `@psp/i18n` según el idioma de la sesión.
 */
export const PAYMENT_STATE_MESSAGES: Readonly<Record<PaymentState, LocalizedText>> = {
  not_required: text('Esta sesión no requiere pago.', 'This session does not require payment.'),
  awaiting: text(
    'Esperando tu pago. Sigue las indicaciones del lector.',
    'Waiting for your payment. Follow the reader instructions.',
  ),
  initiated: text('Procesando tu pago…', 'Processing your payment…'),
  approved: text('Pago aprobado. ¡Gracias!', 'Payment approved. Thank you!'),
  declined: text(
    'Pago rechazado. Puedes intentar de nuevo o usar otro medio de pago.',
    'Payment declined. You can try again or use another payment method.',
  ),
  cancelled: text('Pago cancelado.', 'Payment cancelled.'),
  expired: text('Se agotó el tiempo para pagar.', 'The time to pay has run out.'),
  under_review: text(
    'Tu pago está en revisión. Espera un momento.',
    'Your payment is under review. Please wait a moment.',
  ),
  unavailable: text('El pago no está disponible en este momento.', 'Payment is not available right now.'),
  device_out_of_service: text(
    'El dispositivo de pago está fuera de servicio.',
    'The payment device is out of service.',
  ),
  free: text('Esta sesión es gratuita.', 'This session is free.'),
  demo: text('Modo demostración: sin cobro.', 'Demo mode: no charge.'),
  operator_started: text('Sesión iniciada por el operador.', 'Session started by the operator.'),
};

export function paymentMessage(state: PaymentState): LocalizedText {
  return { ...PAYMENT_STATE_MESSAGES[state] };
}
