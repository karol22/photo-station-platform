import { z } from 'zod';

/** Identificadores: cadenas con prefijo por tipo (org_, fr_, reg_, loc_, mch_, usr_, prd_, pst_, tpl_, cmp_, ast_, rel_, ses_, evt_, inc_). */
export const Id = z.string().min(1);
export type Id = z.infer<typeof Id>;

/** Marca de tiempo ISO 8601. Siempre con zona (Z u offset). */
export const Timestamp = z.iso.datetime({ offset: true });
export type Timestamp = z.infer<typeof Timestamp>;

export const LocaleCode = z.enum(['es', 'en']);
export type LocaleCode = z.infer<typeof LocaleCode>;

/** Texto localizable. Español es obligatorio; inglés opcional (cae a español si falta). */
export const LocalizedText = z.object({
  es: z.string(),
  en: z.string().optional(),
});
export type LocalizedText = z.infer<typeof LocalizedText>;

/** Dinero en unidades menores (centavos). Nunca flotantes. */
export const Money = z.object({
  amount: z.number().int(),
  currency: z.string().length(3),
});
export type Money = z.infer<typeof Money>;

export const ScopeLevel = z.enum([
  'platform',
  'organization',
  'franchise',
  'region',
  'location',
  'machine',
]);
export type ScopeLevel = z.infer<typeof ScopeLevel>;

/** Alcance: nivel + id de la entidad (platform no lleva id). */
export const Scope = z.object({
  level: ScopeLevel,
  id: Id.optional(),
});
export type Scope = z.infer<typeof Scope>;

export const JsonPrimitive = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export type JsonValue = z.infer<typeof JsonPrimitive> | JsonValue[] | { [k: string]: JsonValue };
export const JsonValue: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([JsonPrimitive, z.array(JsonValue), z.record(z.string(), JsonValue)]),
);

export const PixelSize = z.object({ width: z.number().int().positive(), height: z.number().int().positive() });
export type PixelSize = z.infer<typeof PixelSize>;

export const PhysicalSize = z.object({ widthMm: z.number().positive(), heightMm: z.number().positive() });
export type PhysicalSize = z.infer<typeof PhysicalSize>;

export const TimeWindow = z.object({ start: Timestamp, end: Timestamp.optional() });
export type TimeWindow = z.infer<typeof TimeWindow>;

/** Horario semanal en hora local: días 0=domingo..6=sábado, 'HH:mm'. */
export const DailySchedule = z.object({
  days: z.array(z.number().int().min(0).max(6)).min(1),
  from: z.string().regex(/^\d{2}:\d{2}$/),
  to: z.string().regex(/^\d{2}:\d{2}$/),
});
export type DailySchedule = z.infer<typeof DailySchedule>;

export const Address = z.object({
  line1: z.string(),
  line2: z.string().optional(),
  city: z.string(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().length(2),
});
export type Address = z.infer<typeof Address>;

export const Contact = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  url: z.string().optional(),
});
export type Contact = z.infer<typeof Contact>;

export const AuditFields = z.object({
  createdAt: Timestamp,
  updatedAt: Timestamp.optional(),
  createdBy: Id.optional(),
  updatedBy: Id.optional(),
});

/** Consulta de listado estándar para toda lista administrativa. */
export const ListQuery = z.object({
  q: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(500).default(50),
  sort: z.string().optional(),
  filters: z.record(z.string(), z.string()).default({}),
});
export type ListQuery = z.infer<typeof ListQuery>;

export function paginated<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
  });
}

export const ApiError = z.object({
  code: z.string(),
  message: z.string(),
  details: JsonValue.optional(),
  incidentCode: z.string().optional(),
});
export type ApiError = z.infer<typeof ApiError>;
