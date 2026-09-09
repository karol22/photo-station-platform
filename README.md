# Photo Station Platform

Plataforma de software para estaciones fotográficas de autoservicio: desde una sola máquina hasta una red de marcas, franquicias, ubicaciones y máquinas con hardware distinto. Este repositorio contiene el plano de control (nube), lo que vive dentro de cada máquina (agente + kiosco), la consola de administración y los paquetes puros que comparten.

- **Requisitos de producto:** `docs/requisitos-producto.md`
- **Arquitectura:** `docs/arquitectura/00-vision-general.md` (empieza aquí) y `docs/README.md` (índice)
- **Cómo correr:** `docs/operacion/como-correr.md`
- **Agentes de IA:** `AGENTS.md` es el único punto de entrada

## Arranque rápido

```bash
pnpm install
pnpm seed
pnpm dev
```

| Servicio | URL |
|---|---|
| Kiosco (cliente + panel técnico) | http://localhost:5173 |
| Administración / portal de franquicia | http://localhost:5174 |
| Control-plane API | http://localhost:4000 |
| Station-agent API (local de la máquina) | http://localhost:4100 |

## Mapa

```
apps/control-plane   API central (/admin/v1, /fleet/v1), SQLite, seed, simulación de flota
apps/station-agent   servicio local de la máquina (/station/v1, SSE, sync, hardware mock)
apps/kiosk           UI táctil del cliente + panel técnico (React PWA)
apps/admin           consola de administración y portal de franquicia (React)
packages/*           contracts, domain, config-engine, bundler, vision, imaging, integrations, i18n, ui, sqlite, fixtures, catalog
tools/*              cli (pnpm psp) y gates (pnpm gate:quick)
docs/                requisitos, arquitectura, protocolos, operación, trazabilidad
ops/                 estado en disco para agentes (progreso, artefactos, libro mayor, evaluaciones)
```

## Principios en una línea
La máquina es autónoma; la nube manda configuración y contenido; lo externo es un puerto con mock; la configuración es inmutable y versionada; los contratos son la única fuente de verdad; la lógica pura vive en paquetes; las fotos nunca salen de la máquina.

## Calidad
```bash
pnpm gate:quick   # prueba hermética en segundos
pnpm gate:full    # todo, incluido build de apps
```
