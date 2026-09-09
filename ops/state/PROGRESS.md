# Progreso

Formato: una fila por paso. `Evidencia` es algo que otra persona puede verificar: un comando con su resultado esperado, una ruta que existe o una prueba que pasa. Sin evidencia, el paso no está hecho.

| # | Paso | Estado | Evidencia | Fecha |
|---|---|---|---|---|
| 1 | Requisitos guardados en el repo | hecho | `docs/requisitos-producto.md` existe, 2294 líneas | 2026-09-09 |
| 2 | Esqueleto del monorepo (pnpm, turbo, tsconfig, prettier) | hecho | `pnpm install` termina sin compilar nada | 2026-09-09 |
| 3 | Arquitectura y ADRs 001–010 | hecho | `docs/arquitectura/00-vision-general.md`, `docs/arquitectura/decisiones/` | 2026-09-09 |
| 4 | AGENTS.md con dos modos y estado en disco | hecho | `wc -c AGENTS.md` < 12000 | 2026-09-09 |
| 5 | Contratos compartidos (`packages/contracts`) | hecho | `pnpm --filter @psp/contracts test` → 9 pruebas en verde; `docs/arquitectura/01-apis-de-paquetes.md` | 2026-09-09 |
| 6 | Dominio puro (`packages/domain`) | en curso | agente en paralelo; evidencia al cerrar: `pnpm --filter @psp/domain test` | 2026-09-09 |
| 7 | Motor de configuración (`packages/config-engine`) | en curso | agente en paralelo; `pnpm --filter @psp/config-engine test` | 2026-09-09 |
| 8 | Visión local (`packages/vision`) | en curso | agente en paralelo; `pnpm --filter @psp/vision test` | 2026-09-09 |
| 9 | Edición y composición (`packages/imaging`) | en curso | agente en paralelo; `pnpm --filter @psp/imaging test` | 2026-09-09 |
| 10 | Integraciones mock (`packages/integrations`) | en curso | agente en paralelo; `pnpm --filter @psp/integrations test` | 2026-09-09 |
| 11 | i18n, ui, sqlite, fixtures, catalog | en curso | agentes en paralelo: i18n+sqlite, ui, fixtures; catalog lo escribe el coordinador | 2026-09-09 |
| 12 | control-plane con seed y simulación de flota | en curso | agente en paralelo (incluye `@psp/bundler`); `pnpm --filter @psp/control-plane test` | 2026-09-09 |
| 13 | station-agent con sync, outbox y hardware mock | en curso | agente en paralelo; `pnpm --filter @psp/station-agent test` | 2026-09-09 |
| 14 | kiosk: flujos documental, entretenimiento, pago, panel técnico | en curso | agente en paralelo; `pnpm --filter @psp/kiosk build` | 2026-09-09 |
| 15 | admin: consola completa y portal de franquicia | en curso | agente en paralelo; `pnpm --filter @psp/admin build` | 2026-09-09 |
| 16 | CLI y compuertas | en curso | `tools/gates` escrito por el coordinador; CLI en curso | 2026-09-09 |
| 17 | Trazabilidad de requisitos | en curso | agente de documentación escribe `docs/trazabilidad.md` inicial; el coordinador la actualiza al integrar | 2026-09-09 |
