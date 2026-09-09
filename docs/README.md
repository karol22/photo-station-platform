# Documentación

Índice de `docs/`. Para el punto de entrada de un agente, empieza siempre por `AGENTS.md` en la raíz.

## Requisitos y trazabilidad

| Documento | Qué contiene |
|---|---|
| [`requisitos-producto.md`](./requisitos-producto.md) | El "qué": especificación de producto completa, secciones 1 a 52, en tiempo presente y sin implementación |
| [`trazabilidad.md`](./trazabilidad.md) | Matriz de las 128 secciones y subsecciones de requisitos contra el código real (`completo`/`parcial`/`pendiente`), con los 10 escenarios de aceptación y sus ids del dataset demo |

## Arquitectura

| Documento | Qué contiene |
|---|---|
| [`arquitectura/00-vision-general.md`](./arquitectura/00-vision-general.md) | El "cómo": los tres planos (administración, control, estación), principios arquitectónicos, mapa del monorepo, matriz de degradación sin conexión |
| [`arquitectura/01-apis-de-paquetes.md`](./arquitectura/01-apis-de-paquetes.md) | Superficie pública fijada de cada paquete de `packages/`: firmas de funciones y tipos que apps y otros paquetes consumen |
| [`arquitectura/02-configuracion-heredada.md`](./arquitectura/02-configuracion-heredada.md) | El motor de configuración: orden de capas, procedencia, bloqueos, hash, bundles, previsualización masiva y el registro completo de `CONFIG_KEYS` |
| [`arquitectura/03-sesiones-y-privacidad.md`](./arquitectura/03-sesiones-y-privacidad.md) | Ciclo de vida de una sesión, qué se persiste y dónde, retención y el reaper, consentimientos, los 7 casos de recuperación de sesión |
| [`arquitectura/04-hardware-y-perifericos.md`](./arquitectura/04-hardware-y-perifericos.md) | Perfiles y capacidades de hardware, impresoras y cola idempotente, cámara, iluminación, terminal de pago, sensores, matriz producto → capacidad |
| [`arquitectura/05-evolucion-y-nube.md`](./arquitectura/05-evolucion-y-nube.md) | El camino a Postgres/object storage/contenedores, Android y hardware embebido, orden de integraciones reales, escala a 1 000+ máquinas |
| [`arquitectura/06-seguridad.md`](./arquitectura/06-seguridad.md) | Identidad de máquina, credenciales, RBAC y aislamiento, acceso de soporte, panel técnico, fotografías, secretos, texto externo como dato, auditoría |
| [`arquitectura/decisiones/`](./arquitectura/decisiones/README.md) | Los 10 ADR que fijan las decisiones estructurales (monorepo, SQLite, kiosco↔agente, sync por pull, visión/edición en dispositivo, integraciones como puertos, bundles inmutables, contratos zod, React PWA, repo evolutivo con agentes) |

## Protocolos

| Documento | Qué contiene |
|---|---|
| [`protocolos/fleet-sync-v1.md`](./protocolos/fleet-sync-v1.md) | `fleet.v1`: estación ↔ nube. Enrolamiento, heartbeat, bundles, activos por hash, eventos en lote, comandos, releases, compatibilidad |
| [`protocolos/station-api-v1.md`](./protocolos/station-api-v1.md) | `station.v1`: kiosco ↔ agente. Ciclo de sesión completo, capturas en base64, pagos, IA, entrega, panel técnico, eventos SSE |
| [`protocolos/admin-api-v1.md`](./protocolos/admin-api-v1.md) | `admin.v1`: consola ↔ nube. CRUD por recurso, configuración, acciones masivas, importación/exportación, métricas, auditoría, tabla recurso → permiso → alcance |

## Operación

| Documento | Qué contiene |
|---|---|
| [`operacion/como-correr.md`](./operacion/como-correr.md) | Cómo levantar el monorepo en desarrollo: comandos, puertos, credenciales demo |
| [`operacion/secretos.md`](./operacion/secretos.md) | Cómo se resuelven y dónde viven los secretos fuera del repositorio |
| [`operacion/trabajo-con-agentes.md`](./operacion/trabajo-con-agentes.md) | Convenciones para agentes que trabajan en este repositorio |
