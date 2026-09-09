# Protocolo `admin.v1` · consola de administración ↔ nube

API REST entre `apps/admin` (consola de administración y portal de franquicia) y `apps/control-plane`, bajo `/admin/v1`. Toda forma de mensaje vive en `packages/contracts/src/admin-api.ts`, con las entidades de `hierarchy.ts`, `rbac.ts`, `catalog.ts`, `config.ts`, `presets.ts`, `campaigns.ts`, `releases.ts`, `ops.ts` y `metrics.ts`. Los ejemplos JSON validan contra los esquemas indicados en el comentario que los precede.

## 1. Convenciones

| Aspecto | Regla |
|---|---|
| Base | `https://<control-plane>/admin/v1` (desarrollo: `http://localhost:4000/admin/v1`) |
| Autenticación | `Authorization: Bearer <token>` obtenido en `POST /admin/v1/auth/login`. Ninguna ruta salvo `/auth/login` acepta peticiones sin token |
| Listados | Todo `GET` de colección acepta `AdminListQuery`: `q` (búsqueda libre), `page` (≥1, default 1), `pageSize` (1–500, default 50), `sort`, `filters[campo]=valor` (uno o más), más `ScopeFilter` (`organizationId`, `franchiseId`, `regionId`, `locationId`, `machineId`) para acotar por jerarquía. Responde siempre `{ items, page, pageSize, total }` |
| Alcance | Todo listado y toda lectura filtran por el alcance del `Principal` (`narrowListToPrincipal`, `visibleScopes` de `@psp/domain`): un usuario nunca ve, ni por error, una entidad fuera de su alcance — no es un filtro de UI, es lo que la ruta consulta |
| Auditoría | Toda mutación (`POST`/`PATCH`/`DELETE`) escribe un `AuditEntry` con `origin: "admin"`, el `before`/`after` (sólo claves que cambian, `auditDiff` de `@psp/domain`) y el actor. Es inmutable y se lee en `GET /audit` |
| Errores | `ApiError` con `code` en `unauthorized`, `forbidden`, `not_found`, `validation`, `conflict` |

### 1.1 Errores

<!-- contract: ApiError -->
```json
{ "code": "forbidden", "message": "No tienes el permiso machines.edit sobre esta ubicación.", "details": { "permission": "machines.edit", "scope": { "level": "location", "id": "loc_uni_norte" } } }
```

| `code` | HTTP | Cuándo |
|---|---|---|
| `unauthorized` | 401 | Token ausente, expirado o inválido |
| `forbidden` | 403 | El `Principal` no tiene el permiso o el alcance no cubre el objetivo (`can` de `@psp/domain` devuelve `false`) |
| `not_found` | 404 | La entidad no existe **o** existe pero está fuera del alcance visible (no se distingue una de otra: evita filtrar existencia) |
| `validation` | 400 | El cuerpo no valida contra el esquema; `details` lleva el detalle de zod |
| `conflict` | 409 | La operación choca con el estado actual (borrar un activo en uso, publicar una versión sobre otra más nueva, `BulkApplyRequest` con `confirmToken` vencido) |

## 2. Autenticación

<!-- contract: LoginRequest -->
```json
{ "email": "usr_tecnico_norte@example.com", "password": "demo-password" }
```

<!-- contract: LoginResponse -->
```json
{
  "token": "adm_9f1c2e4b7a3d5f6e8091c2a4",
  "expiresAt": "2026-09-10T08:00:00Z",
  "principal": {
    "user": { "id": "usr_tecnico_norte", "email": "usr_tecnico_norte@example.com", "name": "Ana Torres", "status": "active", "locale": "es", "createdAt": "2026-01-15T00:00:00Z" },
    "assignments": [
      { "id": "ra_1", "userId": "usr_tecnico_norte", "roleKey": "technician", "scope": { "level": "franchise", "id": "fr_norte" }, "grantedAt": "2026-01-20T00:00:00Z" }
    ],
    "supportAccesses": [],
    "permissions": [
      { "key": "machines.maintenance", "scope": { "level": "franchise", "id": "fr_norte" } },
      { "key": "machines.commands", "scope": { "level": "franchise", "id": "fr_norte" } }
    ]
  }
}
```

`GET /admin/v1/auth/me` devuelve el mismo `Principal` recalculado con `resolvePrincipal(user, assignments, supportAccesses, now)`, así que un acceso de soporte que venció desaparece solo sin que el usuario tenga que volver a iniciar sesión.

## 3. CRUD por recurso

Todos siguen la misma forma: `GET /admin/v1/<recurso>` (lista, `AdminListQuery` → paginado), `POST /admin/v1/<recurso>` (crea), `GET /admin/v1/<recurso>/:id`, `PATCH /admin/v1/<recurso>/:id`, `DELETE /admin/v1/<recurso>/:id`. `sessions` es de sólo lectura (`GET` lista y por id; ninguna mutación: el libro de sesiones lo escribe `fleet.v1`, nunca la consola).

| Recurso | Entidad (`@psp/contracts`) |
|---|---|
| `organizations` | `Organization` |
| `franchises` | `Franchise` |
| `territories` | `Territory` |
| `regions` | `Region` |
| `locations` | `Location` |
| `machines` | `Machine` |
| `hardware-profiles` | `HardwareProfile` |
| `blueprints` | `Blueprint` |
| `users` | `User` |
| `role-assignments` | `RoleAssignment` |
| `support-accesses` | `SupportAccess` |
| `products` | `Product` |
| `product-availabilities` | `ProductAvailability` |
| `price-rules` | `PriceRule` |
| `promotions` | `Promotion` |
| `presets` | `DocumentPreset` (§4.1 para versiones) |
| `templates` | `PrintTemplate` |
| `experiences` | `Experience` |
| `editing-presets` | `EditingPreset` |
| `campaigns` | `Campaign` |
| `assets` | `Asset` (§4.2 y §4.3 para contenido y uso) |
| `retention-policies` | `RetentionPolicy` |
| `maintenance-checklists` | `MaintenanceChecklist` |
| `feature-overrides` | `FeatureOverride` |
| `entitlement-plans` | `EntitlementPlan` |
| `entitlements` | `Entitlement` |
| `releases` | `Release` |
| `rollouts` | `Rollout` (§4.5 y §4.6 para acciones y progreso) |
| `incidents` | `Incident` |
| `maintenance-logs` | `MaintenanceLog` |
| `consumables` | `Consumable` |
| `announcements` | `Announcement` |
| `internal-documents` | `InternalDocument` |
| `saved-views` | `SavedView` |
| `sessions` | `SessionRecord` (sólo lectura) |

<!-- contract: AdminListQuery -->
```json
{ "q": "norte", "page": 1, "pageSize": 20, "sort": "-createdAt", "filters": { "status": "active" }, "franchiseId": "fr_norte" }
```

Respuesta de `GET /admin/v1/machines?franchiseId=fr_norte&pageSize=20` (forma `paginated(Machine)`):

```json
{
  "items": [
    { "id": "mch_demo_doc_01", "code": "DOC-01", "name": "Estación documental 01", "organizationId": "org_lumina", "franchiseId": "fr_norte", "locationId": "loc_uni_norte", "hardwareProfileId": "hwp_doc_station", "status": "active", "capabilities": [], "printers": [], "releaseChannel": "stable", "online": true, "localContact": {}, "tags": [], "createdAt": "2026-01-15T00:00:00Z" }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 1
}
```

## 4. Rutas especiales

### 4.1 Presets: versiones inmutables

`GET /admin/v1/presets/:id/versions` → `DocumentPresetVersion[]`. Publicar una versión nueva nunca edita la anterior (requisito 5.2, ADR-007):

<!-- contract: PresetPublishRequest -->
```json
{ "spec": { "physical": { "widthMm": 25, "heightMm": 30, "orientation": "portrait", "dpi": 300 }, "color": "color", "background": "white", "face": { "heightRatio": { "min": 0.55, "max": 0.69 }, "eyeLineFromTop": { "min": 0.33, "max": 0.42 }, "centerXTolerance": 0.05, "topMarginMin": 0.08, "sideMarginMin": 0.1, "shouldersVisible": true }, "expression": "neutral", "smile": "forbidden", "glasses": "allowed", "hairCoveringFace": "forbidden", "accessories": "allowed", "headCover": "forbidden", "retouch": "none", "paper": { "type": "photo", "finish": "matte" }, "defaultCopies": 4, "sheetTemplateId": "tpl_sheet_4x6_25x30", "customerInstructions": { "es": "Fondo blanco, sin lentes oscuros, expresión neutra." }, "editing": { "enabled": true, "allowedTools": ["crop", "brightness"] }, "autoCapture": { "enabled": true, "stabilityMs": 1200 }, "thresholds": {} }, "changeNote": "Ajusta el rango de altura de rostro según observación de rechazos en ventanilla." }
```

Responde el `DocumentPreset` con `currentVersion` incrementado y el `DocumentPresetVersion` nuevo agregado a la lista; las sesiones que ya usaron la versión anterior conservan su `presetVersion` en el registro.

### 4.2–4.3 Activos: contenido y uso

`GET /admin/v1/assets/:id/content` devuelve los bytes (mismo mecanismo content-addressed que `fleet.v1` §2.4, servidos aquí por id de administración en vez de por hash).

<!-- contract: AssetUsage -->
```json
{ "assetId": "ast_logo_lumina", "usedBy": [{ "type": "organization", "id": "org_lumina", "name": "Lumina" }, { "type": "template", "id": "tpl_sheet_4x6", "name": "Hoja 4x6" }] }
```

`DELETE /admin/v1/assets/:id` con `usedBy` no vacío responde `409 conflict`; hay que desasignar el uso primero. `GET /admin/v1/assets/:id/usage` es lo que la consola consulta antes de ofrecer el botón de borrar.

### 4.4 Campañas: previsualización

<!-- contract: CampaignPreviewRequest -->
```json
{ "machineId": "mch_demo_doc_01", "at": "2026-12-01T12:00:00Z" }
```

Materializa el bundle de esa máquina como si `at` fuera el instante actual (`@psp/bundler`, sin persistir nada), para ver el efecto de una campaña en borrador antes de publicarla (requisito 16.3):

<!-- contract: CampaignPreviewResponse -->
```json
{ "bundle": { "...": "KioskBundle completo, ver docs/protocolos/station-api-v1.md §2.2" } }
```

### 4.5–4.6 Rollouts: acciones y progreso

<!-- contract: RolloutActionRequest -->
```json
{ "action": "start" }
```

`action` en `start`, `pause`, `resume`, `cancel`, `expand` (agrega objetivos con `expandTargets`, arreglo de `RolloutTarget`). `GET /admin/v1/rollouts/:id/machines` devuelve `MachineReleaseState[]`, una fila por máquina alcanzada, para la vista de progreso por máquina del requisito 19.5.

### 4.7 Dashboard y métricas

`GET /admin/v1/dashboard` (`DashboardSummary`, requisito 20) resume máquinas por estado, sesiones de hoy, productos y ubicaciones top, consumibles a atender, rollouts pendientes e incidencias abiertas — acotado también por el alcance del `Principal`.

<!-- contract: MetricsQuery -->
```json
{ "organizationId": "org_lumina", "franchiseId": "fr_norte", "from": "2026-09-01T00:00:00Z", "to": "2026-09-09T00:00:00Z", "granularity": "day", "groupBy": "location", "includeDemo": false }
```

`POST /admin/v1/metrics/query` → `MetricsResponse`: totales de sesiones y comercial (`realMoney: false` siempre, §42/44), una serie por punto de `groupBy`, y `products` con conversión y uso de edición por producto (requisito 21).

### 4.8 Auditoría y línea temporal

<!-- contract: AuditQuery -->
```json
{ "page": 1, "pageSize": 50, "filters": {}, "entityType": "machine", "entityId": "mch_demo_doc_01", "from": "2026-09-01T00:00:00Z" }
```

`GET /admin/v1/audit` pagina `AuditEntry` (requisito 24: inmutable, con `before`/`after`, nunca se edita ni se borra). `GET /admin/v1/machines/:id/timeline` acepta `TimelineQuery` (`from?`, `to?`, `types?: MachineEventType[]`, `limit` hasta 1000) y devuelve `MachineEvent[]` — la vista de página de detalle de máquina (requisito 13.2).

### 4.9 Bundle y comandos de una máquina

`GET /admin/v1/machines/:id/bundle` devuelve el `KioskBundle` que esa máquina tiene o tendría activo (mismo esquema que `docs/protocolos/station-api-v1.md` §2.2), para que soporte vea exactamente lo que ve el kiosco sin pararse frente a él.

<!-- contract: MachineCommandRequest -->
```json
{ "command": { "type": "set_maintenance", "on": true, "message": "Cambio de papel programado" }, "reason": "Mantenimiento preventivo semanal" }
```

<!-- contract: MachineCommandResponse -->
```json
{ "commandId": "cmd_01J7Q4A0M1" }
```

El `command` es el cuerpo de un `FleetCommand` sin `id`/`issuedAt`/`issuedBy` (el control-plane los agrega); viaja al agente en el siguiente heartbeat y su ciclo de vida es el de `docs/protocolos/fleet-sync-v1.md` §3.4. Los tipos reservados al motor de rollouts (`apply_release`, `rollback_release`, `pause_release`) responden `400 command_reserved` si se piden por esta ruta.

### 4.10 Configuración

<!-- contract: EffectiveConfigView -->
```json
{
  "target": { "level": "location", "id": "loc_uni_norte" },
  "effective": { "values": { "timing.idleTimeoutSec": 60 }, "provenance": { "timing.idleTimeoutSec": { "level": "platform", "isDefault": true } }, "locks": {}, "rejected": [], "hash": "6a7bfdd1ca0dc208d23a1b328aa3b22be75fa318776e59de10b8e28b083dad54" },
  "chain": [
    { "id": "cfg_org_lumina", "level": "organization", "entityId": "org_lumina", "values": { "branding.palette.primary": "#1E5EFF" }, "locks": [{ "key": "branding.palette.primary", "policy": "mandatory", "setBy": "organization" }], "version": 3, "updatedAt": "2026-08-01T00:00:00Z" }
  ],
  "definitions": [
    { "key": "timing.idleTimeoutSec", "type": "number", "group": "timing", "name": { "es": "Tiempo de inactividad (s)", "en": "Idle timeout (s)" }, "default": 60, "editableAt": ["platform", "organization", "franchise", "region", "location", "machine"], "min": 15, "max": 600, "sensitive": false }
  ]
}
```

`GET /admin/v1/config/effective?level=location&id=loc_uni_norte` es lo que alimenta la vista de "de dónde sale este valor" (requisito 36; misma respuesta que produce `explainKey` de `@psp/config-engine`, extendida con la cadena completa de capas y las definiciones para que la consola pueda pintar el formulario sin otra llamada).

<!-- contract: ConfigPatchRequest -->
```json
{ "level": "location", "entityId": "loc_uni_norte", "values": { "printing.defaultCopies": 2 }, "unset": ["kiosk.attractRotationSec"], "locks": [{ "key": "printing.defaultCopies", "policy": "range", "range": { "min": 1, "max": 4 } }], "reason": "La ubicación pide 2 copias por defecto" }
```

`POST /admin/v1/config` escribe (o quita, con `unset`) valores de una capa y sus bloqueos propios; el control-plane vuelve a materializar los bundles de toda máquina alcanzada por esa capa (§6 de `fleet-sync-v1.md`) y responde el `EffectiveConfigView` resultante.

### 4.11 Acciones masivas

<!-- contract: BulkPreviewRequest -->
```json
{ "action": "config_patch", "targets": [{ "level": "franchise", "id": "fr_norte" }], "payload": { "values": { "kiosk.showPricesOnIdle": false } } }
```

<!-- contract: BulkPreviewResponse -->
```json
{
  "affected": [
    { "machineId": "mch_demo_doc_01", "name": "Estación documental 01", "locationName": "Universidad Norte · Biblioteca", "currentBundle": "d8832a1b44e0743b0465f2c7daa51efa12d7c5538fbc27240b46adaeb465ab87", "wouldChange": true }
  ],
  "count": 1,
  "confirmToken": "bulk_7f2a9c1e"
}
```

<!-- contract: BulkApplyRequest -->
```json
{ "action": "config_patch", "targets": [{ "level": "franchise", "id": "fr_norte" }], "payload": { "values": { "kiosk.showPricesOnIdle": false } }, "confirmToken": "bulk_7f2a9c1e", "reason": "Piloto de precios ocultos en franquicia norte" }
```

`POST /bulk/apply` exige el `confirmToken` que devolvió la previsualización correspondiente (requisito 36: nunca se aplica un cambio masivo sin haber mostrado antes cuántas máquinas cambian); un token vencido o de una previsualización distinta responde `409 conflict`.

### 4.12 Importación y exportación

<!-- contract: ImportPreviewRequest -->
```json
{ "entityType": "machines", "rows": [{ "code": "DOC-02", "name": "Estación documental 02", "locationId": "loc_uni_norte", "hardwareProfileId": "hwp_doc_station" }] }
```

<!-- contract: ImportPreviewResponse -->
```json
{ "valid": 1, "invalid": 0, "errors": [], "preview": [{ "code": "DOC-02", "name": "Estación documental 02" }], "confirmToken": "imp_4e1b8a2c" }
```

`POST /import/apply` repite el cuerpo de la previsualización más `confirmToken`. `POST /export` acepta `ExportRequest` (`entityType` en `machines`, `locations`, `sessions`, `incidents`, `maintenance`, `consumables`, `products`, `prices`, `presets`, `metrics`, con `filters` opcional de tipo `AdminListQuery`) y responde un CSV (`Content-Type: text/csv`), no JSON.

### 4.13 Features, flota simulada y catálogo

`POST /admin/v1/features/resolve?level=location&id=loc_uni_norte` → `FeatureState[]`: la misma resolución que ve el bundle de esa entidad, útil para depurar por qué una función aparece bloqueada antes de generar un bundle completo.

<!-- contract: FleetSimulateRequest -->
```json
{ "count": 25, "franchiseId": "fr_norte", "heartbeats": true }
```

`POST /admin/v1/fleet/simulate` crea (o hace latir) máquinas sintéticas para probar la consola con volumen — el mismo generador que usa `pnpm psp simulate-fleet` (`generateFleet` de `@psp/fixtures`), expuesto como ruta para demos guiadas desde la propia consola.

<!-- contract: CatalogEntry -->
```json
{ "kind": "feature", "key": "documents.autoCapture", "name": "Auto-captura", "description": "Captura automática al cumplir criterios.", "package": "@psp/contracts", "status": "stable" }
```

`GET /admin/v1/catalog` devuelve `CatalogEntry[]` — el mismo catálogo que `pnpm catalog` imprime en terminal (AGENTS.md, regla 3), disponible también desde la consola para quien no tiene acceso a una terminal.

## 5. Recurso → permiso → alcance

`can(principal, permission, target, index)` de `@psp/domain` decide toda autorización; esta tabla es la referencia de qué `PermissionKey` gobierna cada recurso y en qué nivel de la jerarquía se concede normalmente. Cuando un recurso no tiene permiso propio en `packages/contracts/src/rbac.ts`, se gobierna con el permiso del dominio más cercano (columna "Nota").

| Recurso | Permiso de lectura | Permiso de escritura | Alcance típico | Nota |
|---|---|---|---|---|
| `organizations` | `organizations.view` | `organizations.create` / `organizations.edit` | `platform` | — |
| `franchises` | `franchises.view` | `franchises.create` / `franchises.edit` | `organization` | — |
| `territories` | `franchises.view` | `franchises.edit` | `franchise` | sin permiso propio; se administran junto con la franquicia |
| `regions` | `locations.view` | `locations.edit` | `organization` / `franchise` | sin permiso propio; agrupan ubicaciones |
| `locations` | `locations.view` | `locations.create` / `locations.edit` | `franchise` / `region` | — |
| `machines` | `machines.view` | `machines.edit` | `location` | `machines.maintenance` para acciones de mantenimiento, `machines.commands` para comandos de flota |
| `hardware-profiles` | `machines.view` | `machines.edit` | `organization` / `platform` | sin permiso propio |
| `blueprints` | `machines.view` | `config.edit` | `organization` | son defaults de configuración (requisito 44) |
| `users` | `users.manage` | `users.manage` | `organization` (o `franchise`/`location` para roles acotados) | lectura y escritura comparten permiso |
| `role-assignments` | `users.manage` | `permissions.edit` | el alcance de la propia asignación | — |
| `support-accesses` | `support.grant` | `support.grant` | el alcance concedido | sólo quien puede conceder puede ver el historial |
| `products` | `products.manage` | `products.manage` | `organization` | — |
| `product-availabilities` | `products.manage` | `products.manage` | `location` / `machine` | — |
| `price-rules` | `pricing.edit` | `pricing.edit` | `organization` / `franchise` / `location` | — |
| `promotions` | `pricing.edit` | `pricing.edit` | `organization` / `franchise` | — |
| `presets` | `presets.manage` | `presets.manage` | `platform` (oficiales) / `organization` | — |
| `templates` | `templates.manage` | `templates.manage` | `organization` | — |
| `experiences` | `templates.manage` | `templates.manage` | `organization` | sin permiso propio; contenido de campaña/entretenimiento |
| `editing-presets` | `templates.manage` | `templates.manage` | `organization` | sin permiso propio |
| `campaigns` | `campaigns.publish` | `campaigns.publish` (org) / `campaigns.edit_local` (franquicia) | `organization` / `franchise` | `franchiseEditableKeys` acota qué puede tocar `campaigns.edit_local` |
| `assets` | `assets.manage` | `assets.manage` | `organization` | — |
| `retention-policies` | `privacy.edit` | `privacy.edit` | `organization` | — |
| `maintenance-checklists` | `maintenance.log` | `maintenance.log` | `organization` | — |
| `feature-overrides` | `features.manage` | `features.manage` | cualquier nivel del override | — |
| `entitlement-plans` | `features.manage` | `features.manage` | `platform` | — |
| `entitlements` | `features.manage` | `features.manage` | `organization` | — |
| `releases` | `releases.manage` | `releases.manage` | `platform` | `releases.rollback` para revertir |
| `rollouts` | `releases.manage` | `releases.manage` | `platform` (objetivo variable) | — |
| `incidents` | `incidents.manage` | `incidents.manage` / `incidents.close` | `location` / `machine` | — |
| `maintenance-logs` | `maintenance.log` | `maintenance.log` | `machine` | — |
| `consumables` | `maintenance.log` | `maintenance.log` | `machine` | — |
| `announcements` | `announcements.publish` | `announcements.publish` | `organization` | — |
| `internal-documents` | `docs.manage` | `docs.manage` | `platform` / `organization` | — |
| `saved-views` | — | — | `user` | privadas al usuario salvo `shared: true`; sin permiso dedicado |
| `sessions` | `sessions.view` | — (sólo lectura) | `location` / `machine` | — |
| `/audit` | `audit.view` | — | igual que el `scope` de cada entrada | — |
| `/dashboard`, `/metrics/query` | `metrics.view` | — | el del `Principal` | — |
| `/machines/:id/commands` | `machines.commands` | `machines.commands` | `machine` | — |
| `/config/*` | el `*.view` del nivel objetivo | `config.edit` | el nivel objetivo | — |
| `/bulk/*` | — | el permiso de la acción envuelta | unión de `targets` | — |
| `/import/*` | `data.import` | `data.import` | `organization` | — |
| `/export` | `data.export` | — | el de `filters` | — |
| `/fleet/simulate` | — | `machines.commands` | `organization` | uso interno/demo; sin permiso dedicado en contratos |
| `/catalog` | — | — | ninguno (cualquier sesión válida) | informativo |

`photos.view_exceptional` no gobierna ningún recurso de este listado: no hay ruta que exponga fotografías (§6 de `docs/protocolos/station-api-v1.md`). Está reservado para la vía excepcional de soporte descrita en `docs/arquitectura/06-seguridad.md`.
