# Photo Station Platform

Plataforma multi-tenant para estaciones fotográficas físicas de autoservicio: fotos para documentos con guía visual y auto-captura, experiencias de entretenimiento, edición local, impresión, administración centralizada de una flota que crece de una máquina a miles, franquicias, campañas, versiones y despliegues.

Todo lo que necesita una sesión corre dentro de la máquina; la nube aporta configuración, contenido, versiones y visibilidad. Ningún proveedor externo (pagos, IA, mensajería, fiscal, CRM) está conectado: cada uno es un puerto con un adaptador simulado que la UI ya sabe representar.

## Arranque rápido

```bash
pnpm install     # hermético: Node ≥ 22.13, sin compilación nativa
pnpm seed        # dataset demo en var/control-plane
pnpm dev         # control-plane :4000 · station-agent :4100 · kiosk :5173 · admin :5174
```

- Kiosco: http://localhost:5173 (webcam real o cámara sintética; panel técnico con PIN `2468` tocando cinco veces la esquina superior izquierda).
- Administración: http://localhost:5174 (usuarios demo en `docs/operacion/como-correr.md`, contraseña `demo`).
- Prueba hermética: `pnpm gate:quick`. Catálogo de capacidades: `pnpm catalog`.

## Mapa

| Ruta | Qué es |
|---|---|
| `apps/control-plane` | API central: administración (`/admin/v1`) y flota (`/fleet/v1`), SQLite, seed, simulación de flota y despliegues |
| `apps/station-agent` | Servicio local de cada máquina: API de estación, SSE, bundle cacheado, sesiones y fotos efímeras, impresión y pagos simulados, sync con la nube |
| `apps/kiosk` | UI táctil del cliente y panel técnico (React PWA); visión y edición en el dispositivo |
| `apps/admin` | Consola de administración y portal de franquicia |
| `packages/contracts` | Esquemas zod: única fuente de verdad de entidades, APIs y protocolos |
| `packages/domain` · `config-engine` · `bundler` | Lógica pura: alcance y RBAC, precios, features, sesiones; herencia de configuración con procedencia; materialización de bundles |
| `packages/vision` · `imaging` | Análisis facial local, cumplimiento documental, auto-captura; edición, composición y layout de impresión |
| `packages/integrations` | Puertos y mocks de pagos, IA, entrega digital, fiscal y CRM |
| `packages/i18n` · `ui` · `sqlite` · `fixtures` · `catalog` | Localización es/en, design system, SQLite embebido, dataset demo, catálogo descubrible |
| `tools/cli` · `tools/gates` | `pnpm psp <comando>` y compuertas de hechos |
| `docs/` | Requisitos, arquitectura, ADRs, protocolos, operación y trazabilidad |
| `ops/` | Estado en disco para agentes: progreso, artefactos, libro mayor, evaluaciones |

## Cómo evoluciona
El repositorio está diseñado para desarrollarse con agentes de IA: `AGENTS.md` es el único punto de entrada, el estado vive en `ops/`, las compuertas (`pnpm gate:quick`) comprueban hechos, y la documentación se mantiene en presente.

Esas prácticas siguen un estándar explícito, [Repositorio listo para agentes](docs/estandares/repositorio-listo-para-agentes.md), y la medición de este repositorio contra sus veinticuatro guías está en [la auditoría](docs/estandares/auditoria.md). Ver también `docs/README.md` y `docs/arquitectura/00-vision-general.md`.
