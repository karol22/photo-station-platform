/**
 * Cada `ResourceDefinition` genérica tiene columnas y campos consistentes con el esquema zod de
 * su recurso (la clave de primer nivel de cada `key` con punto existe en el esquema) y con el
 * catálogo de traducción (cada `labelKey` produce un texto, nunca la clave cruda salvo que falte
 * a propósito en `i18n/extra.ts`).
 */
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { api } from '../api/resources';
import { t } from '../i18n/extra';
import { ALL_RESOURCES } from './definitions';

const schemaByPath = new Map<string, z.ZodTypeAny>(Object.values(api).map((client) => [client.path, client.schema as z.ZodTypeAny]));

function topLevelKey(path: string): string {
  return path.split('.')[0] as string;
}

function shapeOf(schema: z.ZodTypeAny): Record<string, unknown> {
  const candidate = schema as unknown as { shape?: Record<string, unknown> };
  return candidate.shape ?? {};
}

describe('ALL_RESOURCES', () => {
  it('no está vacío y cada clave es única', () => {
    expect(ALL_RESOURCES.length).toBeGreaterThan(15);
    const keys = ALL_RESOURCES.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('cada recurso resuelve un esquema real registrado en api/resources.ts', () => {
    for (const definition of ALL_RESOURCES) {
      expect(schemaByPath.has(definition.key), `sin esquema para ${definition.key}`).toBe(true);
    }
  });

  it('cada columna y campo referencia una clave que existe en el esquema del recurso', () => {
    for (const definition of ALL_RESOURCES) {
      const schema = schemaByPath.get(definition.key);
      if (!schema) continue;
      const shape = shapeOf(schema);
      for (const column of definition.columns) {
        const top = topLevelKey(column.key);
        expect(Object.hasOwn(shape, top), `${definition.key}: columna "${column.key}" no existe en el esquema`).toBe(true);
      }
      for (const field of definition.fields) {
        const top = topLevelKey(field.key);
        expect(Object.hasOwn(shape, top), `${definition.key}: campo "${field.key}" no existe en el esquema`).toBe(true);
      }
    }
  });

  it('cada recurso tiene al menos una columna, y campos cuando admite edición', () => {
    for (const definition of ALL_RESOURCES) {
      expect(definition.columns.length, definition.key).toBeGreaterThan(0);
      if (definition.permissions.edit) expect(definition.fields.length, definition.key).toBeGreaterThan(0);
      expect(definition.permissions.view, definition.key).toBeTruthy();
    }
  });

  it('cada labelKey de columna y campo tiene texto es/en (propio o de @psp/i18n, nunca vacío)', () => {
    for (const definition of ALL_RESOURCES) {
      for (const column of definition.columns) {
        expect(t('es', column.labelKey).length, `${definition.key}.${column.key}`).toBeGreaterThan(0);
        expect(t('en', column.labelKey).length, `${definition.key}.${column.key}`).toBeGreaterThan(0);
      }
      for (const field of definition.fields) {
        expect(t('es', field.labelKey).length, `${definition.key}.${field.key}`).toBeGreaterThan(0);
      }
    }
  });

  it('los recursos con selección múltiple exigen permiso de edición', () => {
    for (const definition of ALL_RESOURCES) {
      if (definition.bulkDelete) expect(definition.permissions.edit, definition.key).toBeTruthy();
    }
  });
});
