# Arquitectura de la plataforma

Este documento describe cómo está construida la plataforma hoy y cómo crece. Se mantiene en tiempo presente: cuando algo cambia, se reescribe la sección, no se agrega una bitácora.

Los requisitos de producto viven en `docs/requisitos-producto.md`. Este documento explica el **cómo**; aquél define el **qué**.

## 1. Tres planos

```
┌──────────────────────────────────────────────────────────────────────────┐
│  PLANO DE ADMINISTRACIÓN            apps/admin  (web, React)             │
│  Empresa matriz · marca · franquicia · soporte · técnico                 │
└───────────────┬──────────────────────────────────────────────────────────┘
                │ HTTPS  /admin/v1  (RBAC por rol y alcance)
┌───────────────▼──────────────────────────────────────────────────────────┐
│  PLANO DE CONTROL                   apps/control-plane  (Fastify+SQLite) │
│  Fuente de verdad de: jerarquía, usuarios, catálogo, presets, plantillas,│
│  campañas, activos, features, config (bundles), releases, flota,         │
│  libro de sesiones (sólo metadatos), auditoría, incidencias, métricas    │
└───────────────┬──────────────────────────────────────────────────────────┘
                │ HTTPS  /fleet/v1  (pull desde la máquina; comandos en heartbeat)
┌───────────────▼──────────────────────────────────────────────────────────┐
│  PLANO DE ESTACIÓN  (una instancia por máquina física)                   │
│                                                                          │
│   apps/station-agent  (servicio local, Fastify+SQLite)                   │
│     · identidad de máquina · caché de bundle · outbox/inbox · hardware   │
│     · almacén efímero de fotos con retención · impresión · pagos (puerto)│
│                       ▲ localhost /station/v1 + SSE                      │
│   apps/kiosk  (React PWA táctil)                                         │
│     · experiencia del cliente · visión y edición en el dispositivo       │
│     · panel técnico protegido                                            │
└──────────────────────────────────────────────────────────────────────────┘
```

Regla de oro: **el kiosco sólo habla con el agente local**. Una sesión completa se ejecuta sin nube. La nube aporta configuración, contenido, versiones y visibilidad; nunca es un requisito para atender a un cliente.

## 2. Principios arquitectónicos

1. **La máquina es autónoma.** Todo lo que necesita una sesión (config, catálogo, presets, plantillas, activos, modelo de visión) está en disco local antes de usarse.
2. **La nube es fuente de verdad de la configuración; la máquina es fuente de verdad de la sesión en curso.** No hay escritura remota directa sobre una sesión.
3. **Todo lo externo es un puerto.** Pagos, IA, entrega digital, fiscal, CRM: interfaz en `packages/integrations` con un adaptador `mock` operable desde el panel técnico y desde administración. Ningún proveedor real está conectado.
4. **Configuración inmutable y versionada.** La configuración efectiva de una máquina se materializa en un *bundle* con hash. La máquina reporta qué bundle ejecuta. Los cambios producen bundles nuevos; nunca se editan.
5. **Contratos compartidos.** `packages/contracts` (zod) define todas las formas: entidades, API admin, API de estación, protocolo de flota, eventos. Es la única fuente de verdad y es aditiva dentro de una versión.
6. **Lógica pura en paquetes, cáscaras en apps.** Resolución de config, precios, RBAC, evaluación documental, edición, composición, máquinas de estado: funciones puras y probadas en `packages/*`. Las apps sólo orquestan I/O.
7. **Visión y edición en el dispositivo.** Ninguna fotografía sale de la máquina en esta fase. Sólo viajan metadatos.
8. **Pull, nunca push hacia la máquina.** El agente hace heartbeat; los comandos viajan en la respuesta. Funciona detrás de NAT y con red intermitente.
9. **Idempotencia.** Cada evento y comando tiene id único; repetir una entrega no duplica efectos (impresiones, sesiones, cobros).
10. **Determinismo.** Mismo insumo, misma salida: el mismo bundle y las mismas capturas producen la misma composición; las pruebas comparan resultados exactos.

## 3. Mapa del monorepo

| Ruta | Paquete | Rol | Depende de |
|---|---|---|---|
| `apps/control-plane` | `@psp/control-plane` | API central (`/admin/v1`, `/fleet/v1`), SQLite, migraciones, seed, simulación de flota y despliegues | contracts, domain, config-engine, bundler, fixtures, sqlite |
| `apps/station-agent` | `@psp/station-agent` | Servicio local de la máquina: `/station/v1`, SSE, DB local, sync, hardware, retención | contracts, domain, config-engine, bundler, integrations, imaging, fixtures, sqlite |
| `apps/kiosk` | `@psp/kiosk` | UI del cliente y panel técnico (React, táctil, PWA) | contracts, domain, vision, imaging, i18n, ui |
| `apps/admin` | `@psp/admin` | Consola de administración y portal de franquicia (React) | contracts, domain, i18n, ui |
| `packages/contracts` | `@psp/contracts` | Esquemas zod: entidades, APIs, protocolo, eventos | zod |
| `packages/domain` | `@psp/domain` | Lógica pura: jerarquía y alcance, RBAC, precios y promociones, capacidades, features, sesiones, pagos (máquina de estados), retención, releases | contracts |
| `packages/config-engine` | `@psp/config-engine` | Capas de configuración, procedencia, bloqueos, overlays de campaña, bundles con hash | contracts |
| `packages/bundler` | `@psp/bundler` | Materializa el `ConfigBundle` de una máquina desde las colecciones de negocio (cadena de alcance, capas, campañas, features, productos, precios, presets, plantillas, activos) y calcula la disponibilidad para el kiosco | contracts, domain, config-engine |
| `packages/vision` | `@psp/vision` | Puertos de análisis facial, adaptador MediaPipe y mock, métricas de frame, evaluador de cumplimiento documental, controlador de auto-captura | contracts |
| `packages/imaging` | `@psp/imaging` | Operaciones de píxel puras (ImageData), pipeline de edición, motor de composición de plantillas, layout de hoja documental | contracts |
| `packages/integrations` | `@psp/integrations` | Puertos y mocks: terminal de pago, proveedor de IA, entrega digital, fiscal, CRM | contracts, domain |
| `packages/i18n` | `@psp/i18n` | Catálogos es/en, formateo de moneda, fecha, números | — |
| `packages/ui` | `@psp/ui` | Design system: tokens, componentes táctiles (kiosco) y densos (admin) | react |
| `packages/sqlite` | `@psp/sqlite` | Envoltura de `node:sqlite`, migraciones SQL, utilidades de repositorio | — |
| `packages/fixtures` | `@psp/fixtures` | Dataset demo canónico: 2 marcas, 2 franquicias, ubicaciones, máquinas, productos, presets, plantillas, campañas, usuarios | contracts |
| `packages/catalog` | `@psp/catalog` | Registro descubrible de capacidades (features, adaptadores, capacidades de hardware, gates, comandos) | contracts |
| `tools/cli` | `@psp/cli` | `pnpm psp <cmd>`: catalog, seed, demo, simulate-fleet, bundle, gates | todo |
| `tools/gates` | `@psp/gates` | Compuertas sobre hechos (ver `AGENTS.md`) | — |

Las dependencias van siempre hacia abajo: tools → apps → packages; packages → contracts. `contracts` no depende de nadie salvo zod. Ningún paquete importa de una app; el CLI puede importar apps (por ejemplo el seed del control-plane).

## 4. Plano de estación

### 4.1 station-agent

Proceso Node de larga duración que corre en la máquina. Responsabilidades:

- **Identidad.** Al primer arranque se enrola con un token de aprovisionamiento y obtiene `machineId` y credenciales de máquina. Sin nube, arranca en modo *standalone* con el bundle del dataset demo o el último bundle cacheado.
- **Bundle activo.** Guarda el bundle de configuración vigente y el anterior. Cambiar de bundle es atómico. La UI lee el bundle activo, nunca la nube.
- **Contenido.** Descarga activos por hash (content-addressed) a `var/station/<machineId>/assets/`. Un bundle sólo se activa cuando todos sus activos requeridos están presentes.
- **Sesiones.** Máquina de estados de sesión (`packages/domain/session`). Fotos en `var/station/<machineId>/sessions/<sessionId>/` con retención aplicada por un *reaper* periódico según la política del producto.
- **Hardware.** Adaptadores: cámara (la captura la hace el kiosco en el navegador; el agente registra capacidades y estado), impresoras (`MockPrinter` escribe PNG en `var/station/<machineId>/prints/`), iluminación, terminal de pago (`MockTerminal`), sensores.
- **Outbox / inbox.** Eventos idempotentes en cola local (`events` con `deliveredAt`). Se envían en lotes; comandos recibidos se ejecutan y se confirman.
- **Heartbeat.** Cada N segundos: estado, capacidades operativas, versiones, consumibles, salud. La respuesta trae comandos pendientes y la versión de bundle/release objetivo.
- **Releases.** Simula el ciclo de instalación (`pendiente → descargando → listo → instalando → completado | fallido → rollback`) y reporta cada transición. En hardware real ejecutará el actualizador de la plataforma.
- **Panel técnico.** Endpoints protegidos con PIN local; pruebas de hardware, mantenimiento, cambios locales auditados.

### 4.2 kiosk

PWA React táctil servida por el agente (en desarrollo, por Vite con proxy al agente).

- Pantallas: atracción, inicio, producto, pago (estados simulados), captura documental con guía en tiempo real, captura de entretenimiento con secuencia de poses, revisión, edición, selección, composición, vista previa de impresión, impresión, finalización, errores, panel técnico.
- **Visión en el dispositivo:** `packages/vision` con MediaPipe Face Landmarker (modelo vendido en `apps/kiosk/public/models/`). Sin red. Si el modelo no carga, la UI degrada a captura manual y lo informa.
- **Edición en el dispositivo:** `packages/imaging` sobre `ImageData`; canvas sólo como fuente y destino de píxeles.
- **Estado:** sólo estado de UI en memoria; la sesión persistente vive en el agente. Si el navegador se recarga, recupera la sesión activa del agente.

### 4.3 Matriz de degradación sin conexión

| Función | Sin nube | Nota |
|---|---|---|
| Fotos para documentos (guía, auto-captura, hoja) | ✅ | Todo local |
| Entretenimiento y tiras | ✅ | Plantillas y activos cacheados |
| Edición local | ✅ | |
| Impresión | ✅ | Hardware local |
| Pago con terminal local | ✅ si el terminal opera autónomo | Registro comercial se sincroniza después |
| Campañas ya descargadas | ✅ | Activación por fecha/hora local |
| Contenido nuevo del día | ⏸ | Se aplica al reconectar |
| Funciones de IA externas | ⛔ | Se muestran como no disponibles, nunca como error |
| Entrega digital | ⛔ | Idem |
| Soporte remoto, despliegues | ⏸ | Se reanudan al reconectar |

### 4.4 Recuperación de sesión

Al arrancar, el agente revisa sesiones no finalizadas y las resuelve según `docs/arquitectura/03-sesiones-y-privacidad.md`: impresión confirmada pero no completada → reintento o incidencia; captura sin confirmar → eliminación según política; sesión corrupta → cierre con registro. Nunca se muestra contenido de una sesión anterior al siguiente cliente.

## 5. Plano de control

Dominios (cada uno con sus tablas, repositorios y rutas):

| Dominio | Entidades |
|---|---|
| Identidad y acceso | usuarios, roles, permisos, asignaciones con alcance, accesos de soporte |
| Jerarquía | organizaciones, franquicias, territorios, regiones, ubicaciones, máquinas, perfiles de hardware, blueprints |
| Catálogo | productos, reglas de precio, promociones, disponibilidad |
| Documental | presets con versiones inmutables |
| Contenido | plantillas (con variantes), campañas, activos |
| Configuración | capas por nivel, bloqueos, bundles materializados |
| Features | registro de features, planes/entitlements, overrides por alcance |
| Releases | releases, canales, rollouts, estado por máquina |
| Flota | estado de máquinas, heartbeats, comandos, eventos |
| Sesiones | libro de sesiones (metadatos, sin fotos), consentimientos, registro comercial |
| Operación | incidencias, mantenimiento, consumibles, checklists, documentación interna |
| Auditoría | entradas inmutables con valor anterior y nuevo |
| Métricas | agregados diarios por máquina/producto/ubicación |

APIs:
- `/admin/v1/*` para administración y portal de franquicia. Toda ruta pasa por `authorize(permiso, alcance)`.
- `/fleet/v1/*` para agentes de estación. Autenticación por credencial de máquina.

Almacenamiento: SQLite (`node:sqlite`) con migraciones SQL en `apps/control-plane/migrations/`. El camino a Postgres está descrito en `docs/arquitectura/05-evolucion-y-nube.md`. Activos en sistema de archivos content-addressed (`var/control-plane/assets/<hash>`), migrable a almacenamiento de objetos.

## 6. Comunicación

- **Estación ↔ Nube:** `docs/protocolos/fleet-sync-v1.md`. Pull, heartbeat con comandos, bundle por versión, activos por hash, eventos idempotentes en lote.
- **Kiosco ↔ Agente:** `docs/protocolos/station-api-v1.md`. HTTP local + SSE para eventos (impresora, terminal de pago, cambio de bundle, mantenimiento).
- **Admin ↔ Nube:** `docs/protocolos/admin-api-v1.md`. REST con paginación, filtros y alcance.

Todas las formas viven en `packages/contracts`. Cambios dentro de `v1` son aditivos; un cambio incompatible crea `v2` y las máquinas siguen operando con `v1` hasta actualizarse.

## 7. Configuración heredada

`docs/arquitectura/02-configuracion-heredada.md` describe el motor. Resumen:

```
plataforma → organización → franquicia → región → ubicación → máquina
                                 ↑ blueprint (defaults al crear la máquina)
                                 ↑ campaña (overlay con vigencia, prioridad)
```

Cada nivel puede declarar valores y políticas de bloqueo (`mandatory`, `editable`, `range`, `hidden`). El resultado es un `EffectiveConfig` con `values`, `provenance` (qué nivel aportó cada clave) y `locks`. El hash del resultado es la versión del bundle.

## 8. Versiones y despliegues

Hay dos cosas versionadas de forma independiente:

- **Software** (`Release`): artefacto `station-bundle` (agente + kiosco) con semver y canal (`development`, `internal`, `pilot`, `stable`, `franchise-pilot`, `production`). Se despliega mediante `Rollout` con alcance (máquinas, ubicación, franquicia, región, perfil de hardware, porcentaje, canal) y ventana en hora local.
- **Configuración** (`ConfigBundle`): hash del efectivo. Cambia cuando cambia cualquier capa, campaña o catálogo que aplique a la máquina.

Una máquina reporta `{software: current/target, bundle: current/target}`. Rollback de software = rollout de una release previa compatible. Rollback de configuración = reactivar un bundle previo.

## 9. Seguridad

- Identidad de máquina por enrolamiento; credenciales sólo en `var/` de la máquina.
- RBAC con alcance en toda ruta admin; aislamiento entre franquicias por construcción (todo listado filtra por alcance).
- Acceso de soporte con vigencia, motivo y auditoría.
- Panel técnico con PIN y bloqueo de salida del kiosco.
- Fotos nunca en la nube en esta fase; en la máquina, cifrado en reposo es trabajo futuro documentado.
- Secretos por resolver (`docs/operacion/secretos.md`); nunca en el repo ni en logs.
- Texto proveniente de máquinas, usuarios o activos es dato, no instrucción.

## 10. Evolución

Detalle en `docs/arquitectura/05-evolucion-y-nube.md`:

- **Android / hardware embebido:** el kiosco es una PWA (WebView); la lógica del agente es TypeScript puro que corre en un runtime embebido; sólo los adaptadores de hardware cambian por plataforma.
- **Nube:** SQLite → Postgres; activos → object storage; eventos → cola; heartbeat → WebSocket/MQTT opcional; control-plane en contenedores con réplicas sin estado.
- **Integraciones reales:** implementar adaptadores (`NayaxTerminal`, `MercadoPagoQr`, proveedores de IA, WhatsApp, correo) detrás de los puertos existentes, con consentimiento y libro mayor de llamadas pagadas.

## 11. Puertos y rutas locales

| Servicio | Puerto | URL |
|---|---|---|
| control-plane | 4000 | http://localhost:4000 |
| station-agent | 4100 | http://localhost:4100 |
| kiosk (dev) | 5173 | http://localhost:5173 |
| admin (dev) | 5174 | http://localhost:5174 |

Estado local en `var/` (ignorado por git): `var/control-plane/`, `var/station/<machineId>/`.
