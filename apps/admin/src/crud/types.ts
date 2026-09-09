/**
 * Mecanismo genérico de CRUD: una `ResourceDefinition` declara columnas y campos de un recurso;
 * `ResourceList` y `ResourceForm` (mismo directorio) los interpretan. Cubre rápidamente las
 * entidades que no necesitan una pantalla a medida.
 *
 * Todo opera sobre `Record<string, unknown>` (no genérico por entidad): así cualquier
 * `ResourceClient<T>` de `api/resources.ts` encaja sin conflictos de varianza, y `columns`/
 * `fields` pueden vivir en un registro heterogéneo (`crud/definitions/index.ts`).
 */
import type { ReactNode } from 'react';
import type { PermissionKey, ScopeLevel } from '@psp/contracts';
import type { RequestOptions } from '../api/client';
import type { ListQueryInput } from '../lib/listQuery';

export interface GenericResourceApi {
  list(query?: ListQueryInput, options?: RequestOptions): Promise<{ items: Record<string, unknown>[]; page: number; pageSize: number; total: number }>;
  create(body: Record<string, unknown>, options?: RequestOptions): Promise<Record<string, unknown>>;
  update(id: string, body: Record<string, unknown>, options?: RequestOptions): Promise<Record<string, unknown>>;
  remove(id: string, options?: RequestOptions): Promise<void>;
}

export type FieldType = 'text' | 'number' | 'select' | 'switch' | 'color' | 'localized' | 'money' | 'json' | 'tags';

export interface FieldOption {
  value: string;
  label: string;
}

/** Campo de `ResourceForm`. `key` acepta rutas con punto (`address.city`) vía `lib/paths.ts`. */
export interface ResourceFieldDef {
  key: string;
  labelKey: string;
  type: FieldType;
  options?: FieldOption[];
  hintKey?: string;
  required?: boolean;
  placeholder?: string;
}

/** Columna de `ResourceList` (adapta 1:1 a `DataTableColumn` de `@psp/ui`). */
export interface ResourceColumnDef {
  key: string;
  labelKey: string;
  render?: (row: Record<string, unknown>, index: number) => ReactNode;
  sortable?: boolean;
  width?: number | string;
  align?: 'start' | 'center' | 'end';
}

/** Filtro de la barra de filtros: se envía como `filters[key]` (requisito de `AdminListQuery`). */
export interface ResourceFilterDef {
  key: string;
  labelKey: string;
  options: FieldOption[];
}

export type ExportEntityType = 'machines' | 'locations' | 'sessions' | 'incidents' | 'maintenance' | 'consumables' | 'products' | 'prices' | 'presets' | 'metrics';

export interface ResourceDefinition {
  key: string;
  titleKey: string;
  resource: GenericResourceApi;
  permissions: { view: PermissionKey; edit?: PermissionKey };
  scopeLevel?: ScopeLevel;
  columns: ResourceColumnDef[];
  fields: ResourceFieldDef[];
  filters?: ResourceFilterDef[];
  exportEntityType?: ExportEntityType;
  /** Ofrece "eliminar selección" en la tabla (requiere `permissions.edit`). */
  bulkDelete?: boolean;
  /** Valores de partida al crear (además de lo que el usuario complete). */
  createDefaults?: Record<string, unknown>;
  /** Antes de confirmar el borrado: nombres de lo que referencia esta entidad (`GET .../usage`). */
  warnBeforeDelete?: (id: string) => Promise<string[] | undefined>;
}
