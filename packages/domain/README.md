# @psp/domain

## Propósito
Lógica pura de negocio sin I/O: jerarquía y contención de alcance, RBAC con alcance, gating por capacidades y disponibilidad de productos, resolución de features y entitlements, precios y promociones, tiempo local, máquina de estados de sesión, temporizadores, retención, registro de sesión sin fotografías, estados de release y utilidades de auditoría. Todo es determinista: el reloj entra como parámetro (`now`) y no hay acceso a red ni disco.

## Cómo se usa
```ts
import {
  buildHierarchyIndex, scopeChain, can, resolvePrincipal, computeAvailability,
  resolveFeatures, resolvePrice, stagesForProduct, computeTimers, sessionRecordFrom,
} from '@psp/domain';

const index = buildHierarchyIndex({ organizations, franchises, regions, locations, machines });
const chain = scopeChain(index, { level: 'machine', id: 'mch_demo_doc_01' });

const principal = resolvePrincipal(user, assignments, supportAccesses, now);
can(principal, 'machines.view', { level: 'machine', id: 'mch_demo_doc_01' }, index); // true|false

const features = resolveFeatures({ chain, overrides, entitlements, plans, machine, now });
const price = resolvePrice({ product, rules, promotions, campaigns, chain, now, timezone, businessMode: 'paid' });
const availability = computeAvailability({ products, machine, features, printers, availabilities, chain, now, timezone, maintenance: false });

const stages = stagesForProduct(product, { paymentRequired: true, consentRequired: false });
const timers = computeTimers(effective.values, product, /* accessible */ false);
const record = sessionRecordFrom(session, { machine, softwareVersion: '0.1.0' }); // nunca copia URLs de fotos
```

Módulos y funciones principales:

| Módulo | Exporta |
|---|---|
| `ids` | `makeId`, `shortCode`, `stableStringify`, `stableHash`, `sha256Hex`, `sha256Bytes` |
| `hierarchy` | `buildHierarchyIndex`, `scopeChain`, `scopeContains`, `machinesInScope`, `resolveRolloutTargets`, `selectPercentage`, `scopeKey`, `sameScope`, `PLATFORM_SCOPE`, `SCOPE_LEVEL_RANK` |
| `rbac` | `ROLE_DEFINITIONS`, `ROLE_INDEX`, `PERMISSION_DESCRIPTIONS`, `VIEW_PERMISSIONS`, `permissionsForRole`, `resolvePrincipal`, `can`, `visibleScopes`, `narrowListToPrincipal`, `isAssignmentActive`, `isSupportAccessActive` |
| `capabilities` | `capabilityMap`, `checkCapabilities`, `compatiblePrinters`, `computeAvailability`, `effectiveAvailability`, `IMPLICIT_FEATURE_BY_KIND` |
| `features` | `resolveFeatures`, `featureMode`, `activeEntitlement` |
| `pricing` | `resolvePrice`, `validatePriceRule`, `applyPromotion`, `isPromotionApplicable`, `isCampaignActive` |
| `time` | `localTimeParts`, `scheduleMatches`, `windowMatches`, `inMaintenanceWindow`, `hhmmToMinutes`, `compareSemver` |
| `sessions` | `SESSION_TRANSITIONS`, `ABORT_STAGES`, `canTransition`, `stagesForProduct`, `computeTimers`, `resolveRetentionPolicy`, `retentionDeadline`, `commercialStateFor`, `sessionRecordFrom`, `nextReleaseStatus`, `canReleaseTransition`, `InvalidTransitionError`, `DEFAULT_RETENTION_POLICY` |
| `audit` | `auditDiff`, `deepEqual` |
| `catalog` | `CATALOG` (paquete, permisos con descripción, features) |

Reglas que implementa y conviene conocer:
- Un permiso aplica cuando el alcance de la asignación contiene el alcance objetivo según la jerarquía (`scopeContains`). Un franquiciatario nunca ve otra franquicia.
- El precio más específico de la cadena gana; un bloqueo `mandatory` del padre gana siempre; un `range` descarta reglas hijas fuera de rango. Después aplican promociones activas y `priceOverrides` de campañas vigentes. Con `businessMode` distinto de `paid` el precio final es 0 y el de lista se conserva.
- Las features resuelven en orden: definición → plan del entitlement vigente → overrides del más general al más específico → dependencias → capacidades de la máquina.
- La disponibilidad devuelve además cómo presentar el producto: `show`, `hidden`, `locked` o `coming_soon` (requisito 18.4).
- El porcentaje de un rollout es determinista: ordena por `stableHash(seed + machineId)`.

## Cómo se prueba
```bash
pnpm --filter @psp/domain test
```
Las pruebas cubren alcance y aislamiento entre franquicias (escenario D), precios con herencia y bloqueos, disponibilidad con impresora sin papel y features `coming_soon`, override de feature sólo en una franquicia piloto (escenario I), rollout por porcentaje determinista, transiciones de sesión, retención y registro de sesión sin fotografías. Los casos de evaluación viven en `src/__evals__/`.
