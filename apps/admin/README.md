# @psp/admin

## Propósito
Administración por conceptos de negocio: dashboard, organizaciones, franquicias, territorios, regiones, ubicaciones, máquinas (inventario, detalle con pestañas, grupos, acciones masivas), perfiles de hardware, blueprints, productos, precios, promociones, presets con versiones, plantillas, experiencias, campañas con previsualización, activos, features y entitlements, releases y rollouts, sesiones, métricas, usuarios y permisos, soporte, auditoría, incidencias, mantenimiento, consumibles, anuncios, documentación interna, import/export. Portal de franquicia = misma app: el shell muestra sólo lo permitido y el alcance queda fijado cuando el principal ve una única franquicia/organización.

## Cómo se usa
```bash
pnpm dev --filter @psp/admin       # o `pnpm dev` desde la raíz (levanta las cuatro apps)
```
Sirve en `http://localhost:5174` y reenvía `/admin/v1` al control-plane en `http://localhost:4000` (ver `vite.config.ts`). Necesita `pnpm seed` corrido al menos una vez (dataset demo en `var/`).

Usuarios demo (contraseña `demo` para todos, definidos en `packages/fixtures`; ver `docs/operacion/como-correr.md`):

| Usuario | Rol | Qué ver en el admin |
|---|---|---|
| `owner@platform.demo` | propietario de plataforma | todo: alcance libre, todas las secciones |
| `admin@lumina.demo` | administrador de marca | una organización completa |
| `franq@norte.demo` | propietario de franquicia | **portal de franquicia**: alcance fijado a su franquicia, sin Soporte ni Catálogo |
| `tecnico@norte.demo` | técnico | máquinas, mantenimiento, comandos e incidencias; sin métricas ni usuarios |
| `analista@lumina.demo` | analista (sólo lectura) | métricas, sesiones y exportación |
| `admin@fotorapida.demo` | administrador de marca | segunda organización, para probar aislamiento multi-tenant |

El selector de alcance de la barra superior (organización → franquicia → región → ubicación) se envía como `ScopeFilter` en todos los listados; con un usuario de alcance único el nivel correspondiente queda bloqueado.

## Cómo se prueba
```bash
pnpm --filter @psp/admin typecheck
pnpm --filter @psp/admin test
pnpm --filter @psp/admin build
```
`src/crud/definitions.test.ts` valida que cada `ResourceDefinition` genérica tenga columnas y campos que existen de verdad en el esquema zod del recurso (`api/resources.ts`) y que cada `labelKey` resuelve a un texto en `es`/`en`. `src/lib/*.test.ts` cubre los utilitarios reutilizados (badges, CSV, markdown, `listQuery`, `navFilter`, `paths`) heredados del intento anterior.

## Mapa de pantallas ↔ requisitos

| Pantalla | Ruta | Requisitos |
|---|---|---|
| Login | `/login` | 3 (autenticación) |
| Dashboard | `/` | 20 |
| Máquinas (lista) | `/machines` | 13.1, 13.4, 36 (bulk preview) |
| Máquina (detalle, 13 pestañas) | `/machines/:id` | 13.2, 13.3, 15, 19.5, 22, 21, 24, 30, 31 |
| Ubicaciones | `/locations` | 2, 35 |
| Organizaciones / Franquicias / Territorios / Regiones | `/organizations` `/franchises` `/territories` `/regions` | 2 |
| Perfiles de hardware / Blueprints | `/hardware-profiles` `/blueprints` | 1.3, 14, 44 |
| Productos (+ compatibilidad de hardware) | `/products` | 4, 9 |
| Precios / Promociones | `/prices` `/promotions` | 10 |
| Presets documentales (+ versiones) | `/presets`, `/presets/:id` | 5 |
| Plantillas / Experiencias / Presets de edición | `/templates` `/experiences` `/editing-presets` | 6, 7, 8 |
| Campañas (+ previsualizar en máquina) | `/campaigns`, `/campaigns/:id` | 12, 36 |
| Activos (aviso de uso al eliminar) | `/assets` | 6, 12 |
| Features (matriz + overrides + entitlements) | `/features` | 18 |
| Releases / Rollouts (+ acciones + máquinas por estado) | `/releases`, `/releases/rollouts/:id` | 19 |
| Sesiones (lectura, nunca fotos) | `/sessions` | 22 |
| Métricas (tablas + barras SVG) | `/metrics` | 21 |
| Usuarios, asignaciones de rol, soporte | `/users`, `/support` | 3 |
| Auditoría | `/audit` | 24 |
| Incidencias | `/incidents` | 30 |
| Mantenimiento / Consumibles / Checklists | `/maintenance` `/consumables` `/maintenance-checklists` | 31 |
| Anuncios / Documentación interna | `/announcements` `/docs` | 34 |
| Import / export | `/import-export` | 35 |
| Simulador de flota | `/fleet-simulator` | 37 |
| Catálogo | `/catalog` | 38 |
| Vistas guardadas | `/saved-views` | 35 |

## Mecanismo genérico de CRUD
`src/crud/types.ts` declara `ResourceDefinition` (columnas, campos, permisos, filtros); `src/crud/ResourceList.tsx` (tabla + filtros + paginación + exportar CSV + selección) y `src/crud/ResourceForm.tsx` (alta/edición en `Drawer`, confirmación de borrado) lo interpretan. `src/crud/fields.tsx` renderiza cada `FieldType` (`text`, `number`, `select`, `switch`, `color`, `localized`, `money`, `json`, `tags`) leyendo/escribiendo con `lib/paths.ts` (rutas con punto, p. ej. `address.city` o `scope.level`). Las definiciones viven en `src/crud/definitions/{network,offer,ops,platform}.ts`; 22 recursos son enteramente genéricos y las pantallas con flujos propios (máquinas, campañas, presets, releases/rollouts, features, usuarios) reutilizan `ResourceList`/`ResourceForm` dentro de pestañas junto a su parte a medida.

## Desviaciones y simplificaciones (tiempo acotado)
- **Vista previa de plantillas con `@psp/imaging`**: no se implementó (el paquete `@psp/imaging` lo completaba otro agente en paralelo y `planTemplate`/`template/plan` no existía de forma estable al momento de construir esta app). `Templates` queda como CRUD genérico sin vista previa renderizada. Es el principal pendiente frente al enunciado.
- **Opciones de `select` de los recursos genéricos** (valores de enums cerrados de `@psp/contracts`, p. ej. tipos de ubicación o categorías de producto) se muestran humanizadas (`out_of_service` → "Out of service") en vez de traducidas es/en clave por clave: son ~150 valores de vocabulario de esquema, no texto de negocio, y traducir cada uno no cabía en el tiempo disponible. Las etiquetas de campos/columnas y los badges de estado sí usan `i18n/extra.ts` o `admin.status.*`/`admin.incident.*`/`admin.release.*` de `@psp/i18n`.
- **Comandos de máquina** (`set_maintenance`, `sync_now`, `print_test`, `restart_app`, `reload_bundle`) se envían como `{ type: <comando> }`; el payload exacto de `FleetCommand` no se verificó contra `packages/contracts/src/fleet-protocol.ts` en detalle. Falta integración cruzada con `apps/control-plane` (otro agente en paralelo) para confirmar la forma exacta.
- **Vistas guardadas** (`SavedView`) no tienen un `PermissionKey` propio en el RBAC cerrado; se gatearon con `machines.view` (amplio) como aproximación razonable.
- **Compatibilidad de hardware** en Productos es un panel aparte (producto → cuántas máquinas del alcance no cumplen `hardwareRequirements`), no una columna en vivo de la tabla.
- El detalle de máquina no incluye pestaña de "activos" dedicada (se omitió por tiempo); el resto de las 13 pestañas del requisito 13.2 sí están.
- Los formularios genéricos no hacen validación `zod` del borrador antes de enviarlo (sólo la respuesta del servidor se valida con `safeParse`, vía `api/client.ts`); errores de validación del servidor se muestran tal cual en un `Alert`.

## Claves i18n agregadas
`src/i18n/extra.ts` agrega ~230 claves `admin.*` (acciones genéricas, campos reutilizables por muchas entidades, y las pantallas de tablero, máquinas, presets, campañas, features, rollouts, sesiones, métricas, usuarios, auditoría, incidencias, import/export, simulador de flota, catálogo, vistas guardadas, activos y plantillas) con paridad es/en verificada en compilación (`en` está tipado como `Record<keyof typeof es, string>`). `t()` fusiona este catálogo local con `@psp/i18n` (prioridad al local, luego el compartido, luego la clave misma) porque esta tarea no modifica `packages/i18n`.
