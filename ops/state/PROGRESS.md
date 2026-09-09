# Progreso

Formato: una fila por paso. `Evidencia` es algo que otra persona puede verificar: un comando con su resultado esperado, una ruta que existe o una prueba que pasa. Sin evidencia, el paso no está hecho.

| # | Paso | Estado | Evidencia | Fecha |
|---|---|---|---|---|
| 1 | Requisitos guardados en el repo | hecho | `docs/requisitos-producto.md` existe, 2294 líneas | 2026-09-09 |
| 2 | Esqueleto del monorepo (pnpm, turbo, tsconfig, prettier) | hecho | `pnpm install` termina sin compilar nada | 2026-09-09 |
| 3 | Arquitectura y ADRs 001–010 | hecho | `docs/arquitectura/00-vision-general.md`, `docs/arquitectura/decisiones/` | 2026-09-09 |
| 4 | AGENTS.md con dos modos y estado en disco | hecho | `wc -c AGENTS.md` < 12000 | 2026-09-09 |
| 5 | Contratos compartidos (`packages/contracts`) | en curso | `pnpm --filter @psp/contracts test` | 2026-09-09 |
| 6 | Dominio puro (`packages/domain`) | pendiente | | |
| 7 | Motor de configuración (`packages/config-engine`) | pendiente | | |
| 8 | Visión local (`packages/vision`) | pendiente | | |
| 9 | Edición y composición (`packages/imaging`) | pendiente | | |
| 10 | Integraciones mock (`packages/integrations`) | pendiente | | |
| 11 | i18n, ui, sqlite, fixtures, catalog | pendiente | | |
| 12 | control-plane con seed y simulación de flota | pendiente | | |
| 13 | station-agent con sync, outbox y hardware mock | pendiente | | |
| 14 | kiosk: flujos documental, entretenimiento, pago, panel técnico | pendiente | | |
| 15 | admin: consola completa y portal de franquicia | pendiente | | |
| 16 | CLI y compuertas | pendiente | | |
| 17 | Trazabilidad de requisitos | pendiente | | |
