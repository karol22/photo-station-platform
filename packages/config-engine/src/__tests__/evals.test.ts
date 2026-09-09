// Ejecuta los casos de evaluación de src/__evals__/config.json: capas → efectivo esperado.
import {
  Campaign,
  ConfigLayer,
  ConfigLevel,
  ConfigLock,
  Id,
  JsonValue,
  ProvenanceEntry,
  Timestamp,
} from '@psp/contracts';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { resolveEffectiveConfig, stableStringify } from '../index';
import evalFile from '../__evals__/config.json';

const EvalCase = z.object({
  name: z.string(),
  description: z.string().optional(),
  input: z.object({
    layers: z.array(ConfigLayer),
    blueprint: ConfigLayer.optional(),
    campaigns: z.array(z.object({ campaign: Campaign, layer: ConfigLayer })).optional(),
    now: Timestamp,
    timezone: z.string(),
  }),
  expected: z.object({
    values: z.record(z.string(), JsonValue).optional(),
    provenance: z.record(z.string(), ProvenanceEntry.partial()).optional(),
    locks: z.record(z.string(), ConfigLock.partial()).optional(),
    absentLocks: z.array(z.string()).optional(),
    rejected: z
      .array(
        z.object({
          key: z.string(),
          level: ConfigLevel,
          entityId: Id.optional(),
          reason: z.string(),
        }),
      )
      .optional(),
  }),
});

const EvalFile = z.object({
  version: z.literal(1),
  description: z.string(),
  cases: z.array(EvalCase).min(1),
});

const sortedBy = <T>(items: T[]) =>
  [...items].sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)));

describe('evaluaciones: __evals__/config.json', () => {
  const file = EvalFile.parse(evalFile);

  it('tiene nombres únicos', () => {
    expect(new Set(file.cases.map((c) => c.name)).size).toBe(file.cases.length);
  });

  for (const testCase of file.cases) {
    it(testCase.name, () => {
      const { layers, blueprint, campaigns, now, timezone } = testCase.input;
      const effective = resolveEffectiveConfig({
        layers,
        ...(blueprint ? { blueprint } : {}),
        ...(campaigns ? { campaigns } : {}),
        now: new Date(now),
        timezone,
      });
      const { expected } = testCase;
      for (const [key, value] of Object.entries(expected.values ?? {})) {
        expect(effective.values[key], `values[${key}]`).toEqual(value);
      }
      for (const [key, entry] of Object.entries(expected.provenance ?? {})) {
        expect(effective.provenance[key], `provenance[${key}]`).toMatchObject(entry);
      }
      for (const [key, lock] of Object.entries(expected.locks ?? {})) {
        expect(effective.locks[key], `locks[${key}]`).toMatchObject(lock);
      }
      for (const key of expected.absentLocks ?? []) {
        expect(effective.locks[key], `locks[${key}]`).toBeUndefined();
      }
      if (expected.rejected) {
        expect(sortedBy(effective.rejected)).toEqual(sortedBy(expected.rejected));
      }
      expect(effective.hash).toMatch(/^[0-9a-f]{64}$/);
    });
  }
});
