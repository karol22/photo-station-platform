import { z } from 'zod';
import { Id, LocaleCode, LocalizedText, Money, Timestamp } from './common';
import { EditingTool, ProductKind } from './catalog';

/** Etapas del ciclo de sesión (requisito 4.4). */
export const SessionStage = z.enum([
  'started',
  'product_selected',
  'configuring',
  'consent',
  'awaiting_payment',
  'capturing',
  'reviewing',
  'editing',
  'selecting',
  'composing',
  'confirming',
  'printing',
  'delivering',
  'finishing',
  'done',
  'cancelled',
  'failed',
  'expired',
  'abandoned',
]);
export type SessionStage = z.infer<typeof SessionStage>;

export const TERMINAL_STAGES: SessionStage[] = ['done', 'cancelled', 'failed', 'expired', 'abandoned'];

/** Estados de pago representables (requisito 10.3). */
export const PaymentState = z.enum([
  'not_required',
  'awaiting',
  'initiated',
  'approved',
  'declined',
  'cancelled',
  'expired',
  'under_review',
  'unavailable',
  'device_out_of_service',
  'free',
  'demo',
  'operator_started',
]);
export type PaymentState = z.infer<typeof PaymentState>;

/** Estado comercial registrado por sesión (requisito 10.4). */
export const CommercialState = z.enum([
  'free',
  'demo',
  'paid_simulated',
  'courtesy',
  'promotion',
  'voided',
  'failed',
  'paid',
]);
export type CommercialState = z.infer<typeof CommercialState>;

export const SessionResult = z.enum(['completed', 'cancelled', 'failed', 'expired', 'abandoned']);
export type SessionResult = z.infer<typeof SessionResult>;

export const ConsentKind = z.enum(['service', 'storage_optional', 'external_future', 'marketing_future', 'campaign']);
export type ConsentKind = z.infer<typeof ConsentKind>;

export const ConsentRecord = z.object({
  kind: ConsentKind,
  given: z.boolean(),
  at: Timestamp,
  textVersion: z.string(),
});
export type ConsentRecord = z.infer<typeof ConsentRecord>;

export const RetentionMode = z.enum([
  'none',
  'temporary',
  'period',
  'derivatives_only',
  'delete_originals',
  'metadata_only',
]);
export type RetentionMode = z.infer<typeof RetentionMode>;

/** Política de retención (requisito 23.1). */
export const RetentionPolicy = z.object({
  id: Id,
  organizationId: Id.optional(),
  name: LocalizedText,
  mode: RetentionMode,
  durationMinutes: z.number().int().min(0).optional(),
  deleteIncomplete: z.boolean().default(true),
  appliesToKinds: z.array(ProductKind).default([]),
  customerText: LocalizedText,
  leavesDevice: z.boolean().default(false),
});
export type RetentionPolicy = z.infer<typeof RetentionPolicy>;

export const SessionError = z.object({
  code: z.string(),
  message: z.string(),
  at: Timestamp,
  stage: SessionStage.optional(),
  incidentCode: z.string().optional(),
});
export type SessionError = z.infer<typeof SessionError>;

export const SessionCommercial = z.object({
  state: CommercialState,
  listPrice: Money.optional(),
  finalPrice: Money.optional(),
  promotionIds: z.array(Id).default([]),
  paymentState: PaymentState,
  paymentRef: z.string().optional(),
  adapter: z.string().optional(),
});
export type SessionCommercial = z.infer<typeof SessionCommercial>;

/** Registro de sesión sin fotografías (requisito 22). Es lo único que viaja a la nube. */
export const SessionRecord = z.object({
  id: Id,
  code: z.string(),
  machineId: Id,
  locationId: Id.optional(),
  organizationId: Id,
  franchiseId: Id.optional(),
  startedAt: Timestamp,
  endedAt: Timestamp.optional(),
  stage: SessionStage,
  result: SessionResult.optional(),
  productId: Id,
  productName: z.string(),
  productKind: ProductKind,
  presetId: Id.optional(),
  presetVersion: z.number().int().optional(),
  templateId: Id.optional(),
  templateVersion: z.number().int().optional(),
  experienceId: Id.optional(),
  captures: z.number().int().default(0),
  retakes: z.number().int().default(0),
  printsRequested: z.number().int().default(0),
  printsCompleted: z.number().int().default(0),
  durationSec: z.number().int().optional(),
  commercial: SessionCommercial,
  softwareVersion: z.string(),
  bundleVersion: z.string(),
  errors: z.array(SessionError).default([]),
  consents: z.array(ConsentRecord).default([]),
  retention: z.object({
    policyId: Id,
    mode: RetentionMode,
    deleteAt: Timestamp.optional(),
    deletedAt: Timestamp.optional(),
  }),
  isDemo: z.boolean().default(false),
  operatorStarted: z.boolean().default(false),
  locale: LocaleCode,
  editingUsed: z.boolean().default(false),
  editingTools: z.array(EditingTool).default([]),
  abandonedAtStage: SessionStage.optional(),
  recoveredFrom: z.enum(['app_restart', 'machine_restart', 'print_failed', 'corrupt', 'incomplete']).optional(),
  campaignId: Id.optional(),
});
export type SessionRecord = z.infer<typeof SessionRecord>;
