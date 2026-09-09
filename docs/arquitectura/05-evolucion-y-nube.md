# Evolución hacia la nube y hardware real

Cómo crece cada pieza de la plataforma sin rediseñarla: de SQLite embebido a un backend con estado compartido, de una MacBook con webcam a Android o un embebido industrial, y de puertos con adaptador `mock` a proveedores reales. Nada de esto está implementado hoy (ADR-006, requisito 51); este documento fija el camino para que, cuando llegue, no cambie el modelo.

## 1. Migración a nube

| Componente | Hoy | Destino | Qué cambia |
|---|---|---|---|
| Base de datos del control-plane | SQLite (`node:sqlite`), archivo único, migraciones SQL en `apps/control-plane/migrations/` (ADR-002) | Postgres | Un adaptador de conexión y una revisión de tipos SQL; `packages/sqlite` deja de envolver `node:sqlite` y envuelve un cliente de Postgres con la misma forma de `migrate`/`transaction`/`paginate`. La lógica de dominio no cambia: no conoce SQL |
| Almacenamiento de activos | Sistema de archivos content-addressed (`var/control-plane/assets/<hash>`) | Object storage (S3-compatible) | `GET /admin/v1/assets/:id/content` y `GET /fleet/v1/assets/:hash` pasan a redirigir o hacer proxy a un bucket; el contrato (`Asset.hash`, `AssetManifestEntry`) no cambia porque ya es content-addressed |
| Sincronización de máquina | Heartbeat por pull cada `sync.heartbeatIntervalSec` (ADR-004) | Heartbeat por pull **más** un canal WebSocket/MQTT opcional para latencia baja | El pull sigue siendo la vía garantizada (funciona detrás de NAT, con red intermitente); el canal opcional sólo acelera la entrega de comandos cuando está disponible. Ninguna ruta dueña de la verdad cambia: `HeartbeatResponse.commands` sigue siendo la fuente idempotente |
| Eventos del outbox | `POST /fleet/v1/events` en lote, procesado síncronamente por el control-plane | Cola de mensajes (p. ej. SQS/Pub-Sub) detrás de la misma ruta | El agente no ve la diferencia: sigue mandando `EventBatchRequest` y recibiendo `EventBatchResponse`; la cola sólo cambia cómo el control-plane procesa lo que ya aceptó |
| Control-plane | Un proceso Fastify con estado en SQLite local | Contenedores sin estado, réplicas horizontales | Posible en cuanto la base de datos deja de ser un archivo local (fila anterior); ninguna ruta de `admin.v1`/`fleet.v1` es *sticky* por diseño |
| Métricas | Calculadas on-demand sobre el libro de sesiones (`reports.ts`) | Agregados materializados (tablas de resumen por día/máquina/producto) | `MetricsResponse`/`DashboardSummary` no cambian de forma; sólo cambia si se calculan al vuelo o se leen precalculados |
| Activos servidos a la máquina | Descarga directa desde el control-plane | CDN delante del object storage | `AssetManifestEntry.url` pasa a apuntar al CDN; el agente sigue verificando el sha256 antes de aceptar el archivo (`fleet-sync-v1.md` §2.4), así que un CDN comprometido no puede colar contenido falso sin que el hash lo delate |

**Lo que no cambia en ningún paso:** `packages/contracts` (las formas son la interfaz entre todo lo demás), el principio de pull, la idempotencia por `id`, que la máquina siga operando de forma autónoma con su último bundle si la nube no responde, y que ninguna fotografía viaje fuera de la máquina. La migración es siempre aditiva dentro de `v1`; nada de esto exige romper compatibilidad con una máquina que no se ha actualizado.

## 2. Android y hardware embebido

- **Kiosco**: ya es una PWA React (ADR-009); en Android se empaqueta dentro de un `WebView` con el mismo HTML/JS. `getUserMedia` y `canvas` siguen disponibles dentro del `WebView`, así que `packages/vision` y `packages/imaging` no cambian una línea.
- **Agente**: la lógica de `apps/station-agent` es TypeScript puro sobre `packages/domain`/`config-engine`/`integrations`; en un runtime embebido (Android mediante Node embebido o un runtime JS equivalente, o un dispositivo industrial con Node nativo) sólo cambian los **adaptadores de hardware** — cámara, impresora, terminal de pago, sensores — detrás de los mismos puertos que hoy implementa `packages/integrations` y `apps/station-agent/src/hardware`. El protocolo `station.v1` entre kiosco y agente no cambia: sigue siendo HTTP local + SSE, sólo que ahora "local" puede ser el propio proceso Android en vez de `localhost:4100`.
- **Adaptadores por plataforma**: cada capacidad de hardware (`CapabilityKey`) mantiene su forma (`MachineCapabilityState`); lo que cambia por plataforma es qué clase implementa `PaymentTerminal`, qué driver escribe en la impresora, o cómo se lee la cámara. Ninguno de esos cambios toca `packages/contracts` ni la UI del kiosco, que sólo conocen el resultado (`PrinterRuntime`, `FrameAnalysis`).
- **Releases**: el ciclo ya modelado (`Release`, `Rollout`, `MachineReleaseState`, `nextReleaseStatus`) no distingue plataforma; un `artifactHash` de Android es, para el protocolo, un artefacto más que se descarga por hash y se instala en una ventana local. El actualizador real (instalar un `.apk`, reiniciar un servicio embebido) es lo único que cambia por plataforma.

## 3. Integraciones reales, en orden

El orden importa: cada una desbloquea la siguiente y todas dejan la UI intacta porque ya representan sus estados hoy (ADR-006).

1. **Terminal de pago** (`PaymentTerminal`) — sin esto no hay ingreso real que registrar, así que es la base de todo lo demás. Plan de evaluación en `packages/integrations/docs/nayax.md` (lector físico vía serial/USB, protocolo estilo *vending*) y `packages/integrations/docs/mercadopago-qr.md` (QR dinámico, con polling desde el agente porque la máquina no puede recibir webhooks). La tabla de estados (`PAYMENT_TRANSITIONS`) no cambia; sólo se sustituye el stub (`NayaxTerminalStub`/`MercadoPagoQrStub`) por la implementación real del mismo puerto.
2. **Entrega digital** (`DeliveryChannel`: WhatsApp, SMS, correo) — depende de tener ya un cliente identificado por un canal de contacto que normalmente se captura en el mismo momento en que se paga o se confirma la sesión.
3. **IA** (`AiProvider`) — depende de tener tráfico y un modelo de costos ya validado (el pago real le da sentido económico a una función que hoy es `coming_soon`).
4. **Fiscal** (`FiscalProvider`) — depende del pago real: no hay nada que facturar sin una transacción real que facturar.
5. **CRM** (`CrmProvider`) — el último eslabón: depende de tener ya sesiones, pagos y entregas reales que valga la pena analizar en un sistema externo.

**Exigencias que cruzan las cinco:**

- **Consentimiento.** Ninguna integración externa se activa sin el `ConsentKind` correspondiente (`external_future` para IA/entrega, ver `docs/arquitectura/03-sesiones-y-privacidad.md` §4) ya registrado explícitamente por el cliente, nunca agrupado con el consentimiento de servicio.
- **Libro mayor.** Toda llamada con costo pasa por `PaidCallLedger` (`packages/integrations/src/ledger.ts`) antes de considerarse completa; `record()` es idempotente por `idempotencyKey`, así que un reintento de red no duplica el cargo en el libro aunque duplique la llamada. Hoy `ops/ledger/paid-calls.jsonl` existe vacío con el formato ya definido.
- **Secretos.** Toda credencial de proveedor se resuelve con `resolveSecret(name, sources)` (`packages/integrations/src/secrets.ts`), nunca en texto plano en `packages/contracts` ni en un bundle: un `SecretHandle` no serializa su valor (`toString()`/`toJSON()` devuelven `"[secreto:name]"`), así que ni un log ni una captura de bundle pueden filtrarlo por accidente. El origen del secreto (variable de entorno, `var/secrets.json`) es responsabilidad de cada entorno, nunca del repositorio (`docs/operacion/secretos.md`).
- **Flags.** Cada integración real se activa detrás de una `FeatureKey` ya existente (`ai.experiences`, `delivery.digital`, `payments.terminal`, `payments.qr`) que hoy vale `coming_soon` o `enabled` con adaptador `mock`; activarla es un cambio de dato (`FeatureOverride`/`EntitlementPlan`), no un cambio de código en la UI.
- **Rollout gradual.** Una integración real se enciende igual que cualquier release: por `RolloutTarget` acotado (una franquicia piloto, un porcentaje determinista) antes de `production`, con la misma capacidad de pausar o revertir que cualquier otro despliegue (`docs/protocolos/fleet-sync-v1.md` §7).

## 4. Escala a 1 000+ máquinas

Nada en el modelo asume una sola máquina (requisito 1.1, 37) ni dimensiona explícitamente para un número pequeño:

- **Listados**: `AdminListQuery` pagina desde el día uno (`page`/`pageSize`/`total`); `paginate()` de `packages/sqlite` es la misma función para 1 o para 100 000 filas.
- **Alcance**: `narrowListToPrincipal` filtra en la consulta, no después de traer todo a memoria — el costo de una vista con alcance acotado no crece con el tamaño de la flota completa.
- **Acciones masivas**: `POST /bulk/preview` + `POST /bulk/apply` (`docs/protocolos/admin-api-v1.md` §4.11) son la única vía para tocar muchas máquinas a la vez; no hay pantalla que obligue a entrar una por una.
- **Rollouts por porcentaje**: `resolveRolloutTargets` con `RolloutTarget` `percentage` usa `stableHash(seed + machineId)` para decidir determinísticamente qué fracción de la flota entra primero, sin coordinación entre máquinas.
- **Simulación de carga**: `generateFleet(base, count, seed)` (`packages/fixtures`) y `POST /admin/v1/fleet/simulate` generan flotas sintéticas de hasta 2 000 máquinas (`FleetSimulateRequest.count`) para probar la consola y el control-plane bajo volumen antes de que exista una flota real de ese tamaño.
- **Métricas agregadas**: cuando el volumen lo justifique, la fila "Métricas" de §1 (agregados materializados) es el paso que evita recalcular sobre todo el histórico en cada consulta del dashboard.

El límite práctico de hoy es la fila "Base de datos del control-plane" de §1: SQLite en un solo archivo soporta cómodamente el desarrollo y una flota piloto, pero la migración a Postgres es la que habilita escritura concurrente real a 1 000+ máquinas latiendo en paralelo.
