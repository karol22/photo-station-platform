import { z } from 'zod';
import { Id, LocalizedText, Timestamp } from './common';

/**
 * Identidad efímera del cliente (ADR-011). El cliente es anónimo por defecto; cuando hace falta
 * enlazarlo con su teléfono o una credencial, se crea un enlace temporal que muere con la sesión.
 * Ninguno de estos métodos pide escribir una contraseña ni crea una cuenta.
 */
export const HandoffMethod = z.enum([
  /** La cabina muestra un QR con una URL de un solo uso; el cliente lo escanea con su teléfono. */
  'display_qr',
  /** El cliente acerca su cupón, boleto o tarjeta de socio a la cámara de la cabina. */
  'scan_qr',
  /** Acerca tarjeta o teléfono al lector sin contacto. */
  'nfc_tap',
  /** La cabina muestra un código corto que el cliente escribe en su propio teléfono. */
  'short_code',
  /** Sin enlace: recorrido anónimo. */
  'none',
]);
export type HandoffMethod = z.infer<typeof HandoffMethod>;

/** Para qué sirve el enlace. Determina qué se ofrece y qué texto ve el cliente. */
export const HandoffPurpose = z.enum(['delivery', 'loyalty', 'coupon', 'campaign']);
export type HandoffPurpose = z.infer<typeof HandoffPurpose>;

export const HandoffState = z.enum([
  'unavailable',
  'coming_soon',
  'offered',
  'pending',
  'linked',
  'expired',
  'cancelled',
  'failed',
]);
export type HandoffState = z.infer<typeof HandoffState>;

/**
 * Enlace efímero entre la sesión en curso y el teléfono o credencial del cliente.
 * Nunca transporta datos personales: `reference` es un identificador opaco.
 */
export const CustomerHandoff = z.object({
  id: Id,
  sessionId: Id,
  method: HandoffMethod,
  purpose: HandoffPurpose,
  state: HandoffState,
  /** Token de un solo uso; se regenera en cada rotación. Nunca se registra en logs. */
  token: z.string().optional(),
  /** Lo que codifica el QR de pantalla. Vacío cuando el método no muestra QR. */
  url: z.string().optional(),
  /** Código corto legible para teclear en el teléfono del cliente. */
  code: z.string().optional(),
  /** Referencia opaca de lo que se escaneó o enlazó. Nunca nombre, correo ni teléfono. */
  reference: z.string().optional(),
  message: LocalizedText.optional(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
  /** Momento de la próxima regeneración del token mientras el enlace está en pantalla. */
  rotatesAt: Timestamp.optional(),
  /** Caducidad dura del enlace; al llegar pasa a `expired`. */
  expiresAt: Timestamp,
});
export type CustomerHandoff = z.infer<typeof CustomerHandoff>;

export const CreateHandoffRequest = z.object({
  sessionId: Id,
  purpose: HandoffPurpose,
  /** Método preferido; el agente cae al primero disponible de la configuración si no puede. */
  method: HandoffMethod.optional(),
});
export type CreateHandoffRequest = z.infer<typeof CreateHandoffRequest>;

/** Simulación local del lado del cliente, sin proveedor externo: panel técnico y modo demo. */
export const SimulateHandoffRequest = z.object({
  handoffId: Id,
  outcome: z.enum(['scan', 'link', 'expire', 'cancel', 'fail']),
  /** Referencia opaca simulada (por ejemplo el identificador de un cupón). */
  reference: z.string().optional(),
});
export type SimulateHandoffRequest = z.infer<typeof SimulateHandoffRequest>;
