# @psp/control-plane

## Propósito
Servidor central multi-tenant. Fuente de verdad de jerarquía, usuarios, catálogo, presets, plantillas, campañas, activos, features, configuración (bundles), releases, flota, libro de sesiones, auditoría, incidencias y métricas.

Expone dos APIs sobre Fastify:

- `/admin/v1`: administración con `Authorization: Bearer <token>`. Toda entrada se valida con `safeParse`, todo listado se filtra por el alcance del principal (una franquicia nunca ve a otra) y toda mutación escribe un `AuditEntry`.
- `/fleet/v1`: protocolo estación ↔ nube (`docs/protocolos/fleet-sync-v1.md`) con `Authorization: Machine <machineId>:<secret>` y cabecera `X-PSP-Contracts: v1`.

Nunca almacena ni sirve fotografías: de las sesiones sólo viaja `SessionRecord`.

## Cómo se usa

Variables de entorno:

| Variable | Por defecto | Uso |
|---|---|---|
| `PSP_VAR_DIR` | `var/` (raíz del repo); usa `<PSP_VAR_DIR>/control-plane` | Base SQLite (`control-plane.sqlite`) y activos (`assets/<hash>`) |
| `PORT` | `4000` | Puerto HTTP |
| `HOST` | `127.0.0.1` | Interfaz |
| `PSP_SIMULATOR` | — | `1` arranca el simulador de flota al iniciar (también lo arranca `POST /fleet/simulate`) |

```bash
pnpm --filter @psp/control-plane seed    # siembra demoDataset() de @psp/fixtures y reporta conteos
pnpm --filter @psp/control-plane start   # http://localhost:4000
```

El seed (`seed/index.ts`, `seedDatabase(db, dataset, { now, users, assetsDir, assetContent })`) es idempotente: borra y reinserta cada colección, las credenciales de usuario (`sha256` de la contraseña, en `entities` tipo `credentials`), las credenciales de máquina (`secret = stableHash('secret:' + machineId)`), heartbeats coherentes con `online/lastSeenAt`, estados de release (objetivo según rollouts `in_progress`) y eventos de ejemplo.

Ejemplos:

```bash
# Login (usuarios y contraseñas en DEMO_USERS de @psp/fixtures)
curl -s localhost:4000/admin/v1/auth/login -H 'content-type: application/json' \
  -d '{"email":"owner@lumina.demo","password":"..."}'

# Listado con alcance, búsqueda, filtros y paginación
curl -s 'localhost:4000/admin/v1/machines?q=norte&filters[status]=active&page=1&pageSize=20&sort=-lastSeenAt' \
  -H "Authorization: Bearer $TOKEN"

# Dashboard
curl -s localhost:4000/admin/v1/dashboard -H "Authorization: Bearer $TOKEN"

# Heartbeat de una máquina (secret = stableHash('secret:' + machineId))
curl -s localhost:4000/fleet/v1/heartbeat -H "Authorization: Machine mch_demo_doc_01:$SECRET" \
  -H 'X-PSP-Contracts: v1' -H 'content-type: application/json' -d @heartbeat.json
```

### Rutas `/admin/v1`

- `POST /auth/login`, `GET /auth/me`.
- CRUD genérico por recurso (tabla abajo): `GET /<recurso>` (`AdminListQuery`: `q`, `filters[campo]=valor`, `page`, `pageSize`, `sort`, filtro de alcance), `GET /<recurso>/:id`, `POST`, `PATCH /:id` (merge + validación + auditoría before/after), `DELETE /:id` (`assets`: 409 con `AssetUsage` si está en uso).
- Especiales: `GET|POST /presets/:id/versions`, `GET /assets/:id/content`, `GET /assets/:id/usage`, `POST /campaigns/:id/preview`, `POST /rollouts/:id/actions` (`start|pause|resume|cancel|expand`), `GET /rollouts/:id/machines`, `GET /dashboard`, `POST /metrics/query`, `GET /audit`, `GET /machines/:id/timeline`, `GET /machines/:id/bundle`, `POST /machines/:id/commands`, `GET /config/effective?level=&id=`, `POST /config`, `POST /bulk/preview|apply`, `POST /import/preview|apply`, `POST /export` (CSV), `POST /features/resolve?level=&id=`, `POST /fleet/simulate`, `GET /catalog`, `GET /sessions[/:id]` (sólo lectura).
- Errores: `ApiError` con `code` ∈ `unauthorized | forbidden | not_found | validation | conflict`.

### Rutas `/fleet/v1`

`POST /enroll` (token `stableHash('provision:' + organizationId)` o `demo-provisioning-token` → `org_lumina`), `POST /heartbeat`, `GET /bundle?version=`, `GET /assets/:hash`, `POST /events` (idempotente por `id`; validación por evento), `POST /commands/ack`, `GET /release`.

### Recurso → permiso → alcance

| Recurso | Tipo | Lectura | Escritura | Alcance |
|---|---|---|---|---|
| organizations | organizations | organizations.view | organizations.edit | organización (propio id) |
| franchises | franchises | franchises.view | franchises.edit | franquicia (propio id) |
| territories | territories | franchises.view | franchises.edit | franquicia |
| regions | regions | locations.view | locations.edit | región (propio id) |
| locations | locations | locations.view | locations.edit | ubicación (propio id) |
| machines | machines | machines.view | machines.edit | máquina (propio id) |
| hardware-profiles | hardwareProfiles | machines.view | machines.edit | organización o plataforma |
| blueprints | blueprints | machines.view | machines.edit | organización o plataforma |
| users | users | users.manage | users.manage | alcance de sus asignaciones |
| role-assignments | roleAssignments | users.manage | permissions.edit | `scope` |
| support-accesses | supportAccesses | support.grant | support.grant | `scope` |
| products | products | organizations.view | products.manage | organización |
| product-availabilities | productAvailabilities | organizations.view | products.manage | `scope` |
| price-rules | priceRules | pricing.edit | pricing.edit | `scope` (valida contra reglas padre) |
| promotions | promotions | organizations.view | pricing.edit | `scope` / franquicia |
| presets | presets | organizations.view | presets.manage | organización o plataforma |
| templates | templates | organizations.view | templates.manage | organización o plataforma |
| experiences | experiences | organizations.view | templates.manage | organización o plataforma |
| editing-presets | editingPresets | organizations.view | templates.manage | organización o plataforma |
| campaigns | campaigns | organizations.view | campaigns.publish | organización / franquicia |
| assets | assets | organizations.view | assets.manage | `ownerScope` |
| retention-policies | retentionPolicies | organizations.view | privacy.edit | organización o plataforma |
| maintenance-checklists | maintenanceChecklists | machines.maintenance | machines.maintenance | organización o plataforma |
| feature-overrides | featureOverrides | features.manage | features.manage | `scope` |
| entitlement-plans | entitlementPlans | organizations.view | features.manage | plataforma |
| entitlements | entitlements | organizations.view | features.manage | `scope` |
| releases | releases | releases.manage | releases.manage | plataforma |
| rollouts | rollouts | releases.manage | releases.manage | plataforma |
| incidents | incidents | incidents.manage | incidents.manage | máquina / franquicia |
| maintenance-logs | maintenanceLogs | machines.maintenance | maintenance.log | máquina |
| consumables | consumables | machines.view | machines.maintenance | máquina |
| announcements | announcements | organizations.view | announcements.publish | organización |
| internal-documents | internalDocuments | docs.manage | docs.manage | organización o plataforma |
| saved-views | savedViews | metrics.view | metrics.view | usuario |
| sessions | session_records | sessions.view | — (sólo lectura) | máquina |

Regla de visibilidad: un elemento se ve cuando el permiso se tiene en un alcance que lo contiene, o cuando el elemento es un contenedor (o entidad compartida de plataforma) de algo que el usuario administra; nunca un hermano. Las entidades de jerarquía usan `narrowListToPrincipal` de `@psp/domain`.

## Cómo se prueba
```bash
pnpm --filter @psp/control-plane typecheck
pnpm --filter @psp/control-plane test
```

Las pruebas (`src/app.test.ts`) usan `fastify.inject`, base `:memory:` y un dataset mínimo propio (`src/test-dataset.ts`) sin depender de `@psp/fixtures`: login y aislamiento entre franquicias (escenario D), 403 del analista, bundle válido y cambio de versión tras un patch de configuración, bloqueo de claves, heartbeat con comandos, idempotencia de eventos, rollout start → pending → completed con stats, enrolamiento, dashboard (`DashboardSummary.safeParse`), métricas y un ciclo del simulador.
