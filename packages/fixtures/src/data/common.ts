/** Helpers compartidos por los módulos de datos. */
import type { LocalizedText, Money } from '@psp/contracts';

export const L = (es: string, en?: string): LocalizedText => (en === undefined ? { es } : { es, en });
export const mxn = (amount: number): Money => ({ amount, currency: 'MXN' });
export const cop = (amount: number): Money => ({ amount, currency: 'COP' });

/** Fecha de creación por defecto de las entidades "de catálogo" (anterior a DEMO_NOW). */
export const CREATED_AT = '2026-06-01T12:00:00Z';
export const UPDATED_AT = '2026-09-01T12:00:00Z';

export const audit = (createdBy?: string) => ({
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
  ...(createdBy === undefined ? {} : { createdBy, updatedBy: createdBy }),
});

export const TZ_MX = 'America/Mexico_City';
export const TZ_MTY = 'America/Monterrey';
export const TZ_BOG = 'America/Bogota';
