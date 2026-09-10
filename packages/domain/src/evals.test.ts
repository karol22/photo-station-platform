import { readFileSync } from 'node:fs';
import { Campaign, Money, PriceRule, Promotion, Scope } from '@psp/contracts';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { resolvePrice } from './pricing';
import { product } from './__tests__/fixtures';

const EvalFile = z.object({
  product: z.object({ id: z.string(), organizationId: z.string(), basePrice: Money }),
  chain: z.array(Scope),
  timezone: z.string(),
  cases: z.array(
    z.object({
      name: z.string(),
      now: z.string(),
      businessMode: z.string().default('paid'),
      rules: z.array(PriceRule).default([]),
      promotions: z.array(Promotion).default([]),
      campaigns: z.array(Campaign).default([]),
      expected: z.object({
        list: z.number().int(),
        final: z.number().int(),
        appliedRuleId: z.string().optional(),
        appliedPromotionIds: z.array(z.string()),
        provenance: Scope,
        lockedBy: Scope.optional(),
      }),
    }),
  ),
});

const file = EvalFile.parse(JSON.parse(readFileSync(new URL('./__evals__/precios.json', import.meta.url), 'utf8')));

describe('evals: precios', () => {
  const base = product(file.product.id, { organizationId: file.product.organizationId, basePrice: file.product.basePrice });
  for (const testCase of file.cases) {
    it(testCase.name, () => {
      const result = resolvePrice({
        product: base,
        rules: testCase.rules,
        promotions: testCase.promotions,
        campaigns: testCase.campaigns,
        chain: file.chain,
        now: new Date(testCase.now),
        timezone: file.timezone,
        businessMode: testCase.businessMode,
      });
      expect(result.list.amount).toBe(testCase.expected.list);
      expect(result.final.amount).toBe(testCase.expected.final);
      expect(result.appliedRuleId).toBe(testCase.expected.appliedRuleId);
      expect(result.appliedPromotionIds).toEqual(testCase.expected.appliedPromotionIds);
      expect(result.provenance).toEqual(testCase.expected.provenance);
      expect(result.lockedBy).toEqual(testCase.expected.lockedBy);
    });
  }
});
