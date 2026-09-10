# @psp/contracts

## Propósito
Única fuente de verdad de formas: entidades de negocio, configuración, catálogo, presets, plantillas, campañas, features, releases, sesiones, operación, métricas y los tres protocolos (`admin.v1`, `fleet.v1`, `station.v1`). Todo es zod; los tipos TypeScript se infieren.

## Cómo se usa
```ts
import { Product, HeartbeatRequest, CONFIG_KEYS } from '@psp/contracts';
const parsed = HeartbeatRequest.safeParse(body);
```
- Toda entrada de red se valida con `safeParse` en el borde.
- Las listas cerradas (`FeatureKey`, `PermissionKey`, `CapabilityKey`, `CONFIG_KEYS`, `EditingTool`) se extienden aquí y sólo aquí.
- Cambios dentro de `v1` son aditivos: campos nuevos opcionales o con default. Un cambio incompatible crea `v2`.

## Módulos
| Archivo | Contenido |
|---|---|
| `common.ts` | Id, Timestamp, LocalizedText, Money, Scope, ListQuery, paginación, ApiError |
| `capabilities.ts` | CapabilityKey, estado de capacidad, impresoras, tamaños de papel |
| `hierarchy.ts` | Organization, Franchise, Territory, Region, Location, Machine, HardwareProfile, Blueprint |
| `rbac.ts` | PermissionKey, RoleKey, User, RoleAssignment, SupportAccess, Principal |
| `config.ts` | Capas, bloqueos, EffectiveConfig, registro `CONFIG_KEYS` |
| `catalog.ts` | Product, disponibilidad, PriceRule, Promotion, ResolvedPrice, EditingTool |
| `presets.ts` | DocumentPreset y DocumentPresetVersion con spec inmutable |
| `features.ts` | FeatureKey, FeatureMode, definiciones, planes, overrides |
| `templates.ts` | PrintTemplate con elementos y variantes |
| `experiences.ts` | Experience, poses, EditingPreset, claves de IA futura |
| `campaigns.ts` | Campaign, Asset, manifiesto, anuncios, documentos internos |
| `releases.ts` | Release, Rollout, MachineReleaseState |
| `sessions.ts` | Etapas, pago, estado comercial, consentimiento, retención, SessionRecord |
| `ops.ts` | Incident, MaintenanceLog, Consumable, AuditEntry, MachineEvent, PrintJob |
| `metrics.ts` | Consultas y respuestas de métricas, DashboardSummary |
| `bundle.ts` | ConfigBundle, disponibilidad de producto |
| `fleet-protocol.ts` | Enroll, Heartbeat, FleetCommand, FleetEvent, lotes |
| `station-api.ts` | StationStatus, KioskBundle, StationSession, pagos, IA, panel técnico |
| `admin-api.ts` | Login, vistas de configuración, acciones masivas, import/export, soporte |
| `registry.ts` | CatalogEntry para `pnpm catalog` |

## Cómo se prueba
```bash
pnpm --filter @psp/contracts test
```
Las pruebas verifican que las listas cerradas sean consistentes y que los esquemas apliquen defaults y rechacen entradas inválidas.
