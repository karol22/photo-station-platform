import { describe, expect, it } from 'vitest';
import { machinesInScope, resolveRolloutTargets, scopeChain, scopeContains, selectPercentage } from './hierarchy';
import { FR_BAJIO, FR_NORTE, LOC_N1, LOC_N2, ORG, REG_NORTE, demoHierarchy, scope } from './__tests__/fixtures';

const index = demoHierarchy();

describe('scopeChain', () => {
  it('construye la cadena completa hasta una máquina', () => {
    expect(scopeChain(index, scope.machine('mch_n1'))).toEqual([
      scope.platform(),
      scope.organization(ORG),
      scope.franchise(FR_NORTE),
      scope.region(REG_NORTE),
      scope.location(LOC_N1),
      scope.machine('mch_n1'),
    ]);
  });

  it('hereda franquicia y región de la ubicación cuando la máquina no los declara', () => {
    expect(scopeChain(index, scope.machine('mch_n3'))).toEqual([
      scope.platform(),
      scope.organization(ORG),
      scope.franchise(FR_NORTE),
      scope.location(LOC_N2),
      scope.machine('mch_n3'),
    ]);
  });

  it('omite niveles que no existen y devuelve sólo plataforma + destino si es desconocido', () => {
    expect(scopeChain(index, scope.machine('mch_hq'))).toEqual([scope.platform(), scope.organization(ORG), scope.location('loc_hq'), scope.machine('mch_hq')]);
    expect(scopeChain(index, scope.platform())).toEqual([scope.platform()]);
    expect(scopeChain(index, scope.machine('mch_fantasma'))).toEqual([scope.platform(), scope.machine('mch_fantasma')]);
  });
});

describe('scopeContains', () => {
  it('la plataforma contiene todo; una franquicia no contiene a otra', () => {
    expect(scopeContains(index, scope.platform(), scope.machine('mch_b1'))).toBe(true);
    expect(scopeContains(index, scope.organization(ORG), scope.machine('mch_b1'))).toBe(true);
    expect(scopeContains(index, scope.franchise(FR_NORTE), scope.machine('mch_n3'))).toBe(true);
    expect(scopeContains(index, scope.franchise(FR_NORTE), scope.machine('mch_b1'))).toBe(false);
    expect(scopeContains(index, scope.franchise(FR_NORTE), scope.franchise(FR_BAJIO))).toBe(false);
    expect(scopeContains(index, scope.franchise(FR_NORTE), scope.franchise(FR_NORTE))).toBe(true);
    expect(scopeContains(index, scope.machine('mch_n1'), scope.franchise(FR_NORTE))).toBe(false);
    expect(scopeContains(index, scope.organization(ORG), scope.machine('mch_fantasma'))).toBe(false);
  });
});

describe('machinesInScope', () => {
  it('devuelve las máquinas de cada nivel en el orden del índice', () => {
    expect(machinesInScope(index, scope.franchise(FR_NORTE)).map((m) => m.id)).toEqual(['mch_n1', 'mch_n2', 'mch_n3', 'mch_n4', 'mch_n5']);
    expect(machinesInScope(index, scope.franchise(FR_BAJIO)).map((m) => m.id)).toEqual(['mch_b1', 'mch_b2']);
    expect(machinesInScope(index, scope.location(LOC_N2)).map((m) => m.id)).toEqual(['mch_n3', 'mch_n4', 'mch_n5']);
    expect(machinesInScope(index, scope.organization(ORG))).toHaveLength(8);
    expect(machinesInScope(index, scope.platform())).toHaveLength(9);
  });
});

describe('resolveRolloutTargets', () => {
  it('une objetivos sin duplicar y resuelve perfil, canal y etiquetas', () => {
    const ids = resolveRolloutTargets(index, [
      { kind: 'machines', machineIds: ['mch_n1', 'mch_b1'] },
      { kind: 'location', locationId: LOC_N1 },
      { kind: 'tags', tags: ['piloto'] },
    ]).map((m) => m.id);
    expect(ids).toEqual(['mch_n1', 'mch_n2', 'mch_b1', 'mch_b2']);
    expect(resolveRolloutTargets(index, [{ kind: 'hardwareProfile', hardwareProfileId: 'hwp_thermal' }]).map((m) => m.id)).toEqual(['mch_n4']);
    expect(resolveRolloutTargets(index, [{ kind: 'channel', channel: 'pilot' }]).map((m) => m.id)).toEqual(['mch_n3']);
    expect(resolveRolloutTargets(index, [{ kind: 'region', regionId: REG_NORTE }]).map((m) => m.id)).toEqual(['mch_n1', 'mch_n2']);
  });

  it('el porcentaje es determinista: mismo seed → mismas máquinas; redondea hacia arriba', () => {
    const first = resolveRolloutTargets(index, [{ kind: 'percentage', percent: 50, seed: 'rollout-1' }]).map((m) => m.id);
    const again = resolveRolloutTargets(index, [{ kind: 'percentage', percent: 50, seed: 'rollout-1' }]).map((m) => m.id);
    expect(first).toEqual(again);
    expect(first).toHaveLength(5); // ceil(9 * 0.5)
    expect(resolveRolloutTargets(index, [{ kind: 'percentage', percent: 1, seed: 'rollout-1' }])).toHaveLength(1);
    expect(resolveRolloutTargets(index, [{ kind: 'percentage', percent: 100, seed: 'x' }])).toHaveLength(9);
  });

  it('el porcentaje filtra la población de los demás objetivos y conserva el orden del índice', () => {
    const pilot = resolveRolloutTargets(index, [
      { kind: 'franchise', franchiseId: FR_NORTE },
      { kind: 'percentage', percent: 40, seed: 'piloto' },
    ]);
    expect(pilot).toHaveLength(2); // ceil(5 * 0.4)
    for (const m of pilot) expect(['mch_n1', 'mch_n2', 'mch_n3', 'mch_n4', 'mch_n5']).toContain(m.id);
    const expanded = resolveRolloutTargets(index, [{ kind: 'franchise', franchiseId: FR_NORTE }, { kind: 'percentage', percent: 80, seed: 'piloto' }]);
    // Ampliar el porcentaje con el mismo seed conserva a las máquinas ya elegidas.
    for (const m of pilot) expect(expanded.map((x) => x.id)).toContain(m.id);
    expect(selectPercentage([], 50, 'x')).toEqual([]);
  });
});
