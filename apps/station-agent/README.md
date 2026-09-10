# @psp/station-agent

## Propósito

Servicio Node de larga duración que vive dentro de cada máquina. Expone `/station/v1` (HTTP + SSE) al kiosco, que es su único cliente local (ADR-003), y habla con la nube sólo por pull (ADR-004). Contiene: identidad y bundle activo con caché, sesiones con fotografías en disco y retención por _reaper_, impresoras y terminal de pago mock, IA y entrega digital como puertos, outbox e inbox idempotentes, heartbeat con comandos, simulación de releases, panel técnico y modo standalone sin nube. La nube nunca ve fotografías: sólo `SessionRecord` y eventos.

## Cómo se usa

```bash
pnpm --filter @psp/station-agent start      # tsx src/main.ts, escucha en :4100
pnpm --filter @psp/station-agent dev        # con recarga
curl localhost:4100/station/v1/status
```

Variables de entorno (todas con valor por defecto):

| Variable                 | Defecto                 | Uso                                                                   |
| ------------------------ | ----------------------- | --------------------------------------------------------------------- |
| `PSP_STATION_MACHINE_ID` | `mch_demo_doc_01`       | Identidad de la máquina; también nombra `var/station/<machineId>/`    |
| `PSP_STATION_AGENT_PORT` | `4100`                  | Puerto HTTP                                                           |
| `PSP_CONTROL_PLANE_URL`  | `http://localhost:4000` | Base del control-plane (`/fleet/v1`)                                  |
| `PSP_VAR_DIR`            | `var/` (raíz del repo)  | Raíz de estado; el agente usa `<PSP_VAR_DIR>/station/<machineId>` para base SQLite, sesiones, impresiones, activos e identidad |
| `PSP_STATION_TECH_PIN`   | `2468`                  | PIN del panel técnico cuando `techPanel.pinHash` efectivo está vacío  |
| `PSP_SOFTWARE_VERSION`   | `0.1.0`                 | Versión reportada en heartbeat y registros                            |

**Modo standalone.** En el arranque el agente pide `GET /fleet/v1/bundle` con `Authorization: Machine <id>:<secret>` (el secreto se genera y guarda en `kv` e `identity.json` la primera vez). Si la nube no responde usa el bundle cacheado; si no hay ninguno construye uno standalone: el dataset demo de `@psp/fixtures` materializado con `@psp/bundler` cuando ambos están disponibles y, si no, el bundle mínimo de `src/bundle/standalone.ts` (un producto documental, una hoja 4x6, una impresora fotográfica). Todo el ciclo de sesión funciona sin nube; el heartbeat y el outbox reintentan en silencio y `StationStatus.cloudReachable` refleja el último intento.

**Disco.** `var/station/<machineId>/station.sqlite` (tablas `kv`, `sessions`, `print_jobs`, `payment_intents`, `outbox`, `events`, `tests`, `inbox`; migraciones en `migrations/`), `sessions/<sessionId>/` (capturas, ediciones, composición, resultados de IA), `prints/<jobId>.png` (salida de `MockPrinter`), `assets/<hash>` (caché de activos). En la base sólo hay rutas y URLs locales.

**Panel técnico.** `POST /tech/login` con el PIN devuelve un token (30 min) que va en `Authorization: Tech <token>`. `PATCH /tech/config` sólo acepta claves con `editableAt` que incluya `machine`; cada cambio genera `local_audit` en el outbox y se aplica sobre los valores efectivos del bundle.

### Rutas (`/station/v1`)

| Método | Ruta                                | Cuerpo → Respuesta                                                                                                                                         |
| ------ | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/status`                           | → `StationStatus`                                                                                                                                          |
| GET    | `/bundle`                           | → `KioskBundle` (bundle + `availability` + `assetBaseUrl`)                                                                                                 |
| GET    | `/assets/:hash`                     | → bytes del activo (caché local o `assetContent` en standalone)                                                                                            |
| GET    | `/events`                           | SSE: `event: <type>` + `data: <StationEvent>`; keepalive cada 15 s                                                                                         |
| POST   | `/sessions`                         | `CreateSessionRequest` → `StationSession` (409 si hay sesión activa, mantenimiento o fuera de servicio)                                                    |
| GET    | `/sessions/active`                  | → `StationSession` \| 204                                                                                                                                  |
| GET    | `/sessions/:id`                     | → `StationSession`                                                                                                                                         |
| POST   | `/sessions/:id/stage`               | `AdvanceStageRequest` → `StationSession` (valida con `canTransition`)                                                                                      |
| POST   | `/sessions/:id/consents`            | `RecordConsentRequest` → `StationSession`                                                                                                                  |
| POST   | `/sessions/:id/captures`            | `UploadCaptureRequest` (PNG/JPEG en base64 o data URL) → `Capture` con `url` local                                                                         |
| DELETE | `/sessions/:id/captures/:captureId` | → `StationSession`                                                                                                                                         |
| POST   | `/sessions/:id/edits`               | `SaveEditsRequest` → `StationSession` (`resultBase64` se guarda como `editedUrl`)                                                                          |
| POST   | `/sessions/:id/selection`           | `SetSelectionRequest` → `StationSession`                                                                                                                   |
| POST   | `/sessions/:id/composition`         | `SaveCompositionRequest` → `StationSession` con `composition.url`                                                                                          |
| POST   | `/sessions/:id/print`               | `PrintRequest` → `PrintJob` (202; idempotente por `idempotencyKey`; 409 si la impresora está sin papel, atascada o apagada)                                |
| POST   | `/sessions/:id/print/:jobId/retry`  | → `PrintJob`                                                                                                                                               |
| POST   | `/sessions/:id/extend`              | `ExtendSessionRequest` → `StationSession`                                                                                                                  |
| POST   | `/sessions/:id/cancel`              | `CancelSessionRequest` → `StationSession`                                                                                                                  |
| POST   | `/sessions/:id/finish`              | → `FinishSessionResponse` (cierra, encola `session_record`, programa retención)                                                                            |
| GET    | `/sessions/:id/files/:name`         | → bytes de la imagen                                                                                                                                       |
| POST   | `/payments/intents`                 | `CreatePaymentIntentRequest` → `PaymentIntent` (terminal según `payment.terminalAdapter`; `free`/`demo`/`operator_started`/`not_required` nacen resueltos) |
| POST   | `/payments/intents/:id/cancel`      | → `PaymentIntent`                                                                                                                                          |
| POST   | `/payments/simulate`                | `SimulatePaymentRequest` → `PaymentIntent`                                                                                                                 |
| POST   | `/ai/jobs`                          | `AiJobRequest` → `AiJob` (`MockAiProvider` si `ai.experiences` está `enabled`; si no, `coming_soon`/`disabled`)                                            |
| GET    | `/ai/jobs/:id`                      | → `AiJob`                                                                                                                                                  |
| POST   | `/delivery`                         | `DeliveryRequest` → `DeliveryRequestRecord` (`coming_soon` salvo `delivery.digital` habilitada)                                                            |
| POST   | `/tech/login`                       | `TechLoginRequest` → `TechLoginResponse`                                                                                                                   |
| GET    | `/tech/status`                      | → `TechStatus`                                                                                                                                             |
| POST   | `/tech/tests`                       | `RunTestRequest` → `TestResult`                                                                                                                            |
| POST   | `/tech/maintenance`                 | `MaintenanceActionRequest` → `{ ok, status }` (todo genera `MachineEvent` y evento al outbox)                                                              |
| PATCH  | `/tech/config`                      | `LocalConfigPatchRequest` → `{ values }`                                                                                                                   |
| POST   | `/tech/simulate`                    | `SimulateFaultRequest` → `StationStatus`                                                                                                                   |
| POST   | `/tech/print-test`                  | → `PrintJob` de prueba                                                                                                                                     |

Los errores responden `ApiError` (`validation_error` 400, `not_found` 404, `invalid_transition`/`session_active`/`printer_unavailable` 409, `tech_unauthorized`/`invalid_pin` 401).

### Sincronización con la nube

- **Heartbeat** cada `sync.heartbeatIntervalSec` (o lo que responda la nube): `HeartbeatRequest` con estado real; la respuesta aplica `bundleVersion` (refetch), `statusOverride`, `releaseTarget` y `commands`. Cada comando se ejecuta una vez (inbox por id) y se confirma con `command_ack` en el outbox. `apply_release` simula `pending → downloading → ready → installing → completed` y emite `release_status`.
- **Outbox** con `sequence` creciente; `flush()` envía lotes de `sync.eventBatchSize` a `POST /fleet/v1/events` y marca `deliveredAt` con `accepted` y `duplicates`.
- **Recuperación** al arrancar: toda sesión no terminal pasa a `abandoned` (`recoveredFrom: app_restart` o `print_failed`), sus archivos se eliminan si la política lo pide y se registra `session_recovered`.
- **Retención**: al cerrar una sesión se calcula `deleteAt` con `retentionDeadline`; el _reaper_ (cada 30 s) borra los archivos vencidos y deja el `SessionRecord` intacto. La expiración por inactividad (`timers.idleTimeoutSec`) corre cada 5 s.

## Cómo se prueba

```bash
pnpm --filter @psp/station-agent typecheck
pnpm --filter @psp/station-agent test
```

Las pruebas (`src/agent.test.ts`) usan `fastify.inject`, base `:memory:` (o un archivo temporal para la recuperación), reloj manual, ids secuenciales y el bundle standalone mínimo: formas de `StationStatus` y `KioskBundle`, ciclo documental completo con impresión idempotente y registro sin fotografías, pagos (awaiting → approved; modo demo), impresora sin papel y `paper_changed`, expiración por inactividad y _reaper_, panel técnico (PIN, claves editables) y recuperación de sesiones al arrancar.
