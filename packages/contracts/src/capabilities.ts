import { z } from 'zod';
import { Timestamp } from './common';

/** Capacidades de hardware que una máquina declara (requisito 1.3, 14). Lista cerrada. */
export const CapabilityKey = z.enum([
  'camera.primary',
  'camera.secondary',
  'display.touch',
  'printer.photo',
  'printer.thermal',
  'printer.color',
  'printer.bw',
  'lighting.controllable',
  'payment.terminal',
  'connectivity.online',
  'storage.local',
  'audio.output',
  'sensor.presence',
  'sensor.temperature',
]);
export type CapabilityKey = z.infer<typeof CapabilityKey>;

export const MachineCapabilityState = z.object({
  key: CapabilityKey,
  present: z.boolean(),
  operational: z.boolean(),
  detail: z.string().optional(),
  updatedAt: Timestamp.optional(),
});
export type MachineCapabilityState = z.infer<typeof MachineCapabilityState>;

export const PaperSize = z.enum([
  '4x6in',
  '5x7in',
  '6x8in',
  '2x6in-strip',
  '58mm-thermal',
  '80mm-thermal',
  'A4',
  'A5',
  'custom',
]);
export type PaperSize = z.infer<typeof PaperSize>;

export const PrinterType = z.enum(['photo', 'thermal']);
export type PrinterType = z.infer<typeof PrinterType>;

export const PrinterStatus = z.enum(['ready', 'busy', 'no_paper', 'jam', 'error', 'offline', 'unknown']);
export type PrinterStatus = z.infer<typeof PrinterStatus>;

export const PrinterDefinition = z.object({
  id: z.string(),
  name: z.string(),
  type: PrinterType,
  paperSizes: z.array(PaperSize),
  color: z.boolean(),
  consumableType: z.string().optional(),
  priority: z.number().int().default(0),
});
export type PrinterDefinition = z.infer<typeof PrinterDefinition>;

export const PrinterRuntime = PrinterDefinition.extend({
  status: PrinterStatus,
  paperEstimate: z.number().int().min(0).optional(),
  lastJobAt: Timestamp.optional(),
  message: z.string().optional(),
});
export type PrinterRuntime = z.infer<typeof PrinterRuntime>;
