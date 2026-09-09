# Progreso

Formato: una fila por paso. `Evidencia` es algo que otra persona puede verificar: un comando con su resultado esperado, una ruta que existe o una prueba que pasa. Sin evidencia, el paso no está hecho.

| # | Paso | Estado | Evidencia | Fecha |
|---|---|---|---|---|
| 1 | Requisitos guardados en el repo | hecho | `docs/requisitos-producto.md` existe, 2294 líneas | 2026-09-09 |
| 2 | Esqueleto del monorepo (pnpm, turbo, tsconfig, prettier) | hecho | `pnpm install` termina sin compilar nada | 2026-09-09 |
| 3 | Arquitectura y ADRs 001–010 | hecho | `docs/arquitectura/00-vision-general.md`, `docs/arquitectura/decisiones/` | 2026-09-09 |
| 4 | AGENTS.md con dos modos y estado en disco | hecho | `wc -c AGENTS.md` < 12000 | 2026-09-09 |
| 5 | Contratos compartidos (`packages/contracts`) | hecho | `pnpm --filter @psp/contracts test` → 9 pruebas en verde; `docs/arquitectura/01-apis-de-paquetes.md` | 2026-09-09 |
| 6 | Dominio puro (`packages/domain`) | hecho | `pnpm --filter @psp/domain test` → 77 pruebas en verde | 2026-09-09 |
| 7 | Motor de configuración (`packages/config-engine`) | hecho | `pnpm --filter @psp/config-engine test` → 69 pruebas en verde | 2026-09-09 |
| 8 | Visión local (`packages/vision`) | en curso | implementado sin pruebas; agente relanzado 07:20 para pruebas; `pnpm --filter @psp/vision typecheck` verde | 2026-09-09 |
| 9 | Edición y composición (`packages/imaging`) | en curso | faltan `template/*`, `render`, `primitives`; agente relanzado 07:20; evidencia al cerrar: `pnpm --filter @psp/imaging typecheck && test` | 2026-09-09 |
| 10 | Integraciones mock (`packages/integrations`) | hecho | `pnpm --filter @psp/integrations test` → 119 pruebas en verde | 2026-09-09 |
| 11 | i18n, ui, sqlite, fixtures, catalog | en curso | i18n 44 pruebas, sqlite 20, ui compila; fixtures relanzado 07:20 (camino crítico); catalog registra gates y comandos | 2026-09-09 |
| 12 | control-plane con seed y simulación de flota | en curso | agente relanzado 07:20 (control-plane); `@psp/bundler` listo con 12 pruebas | 2026-09-09 |
| 13 | station-agent con sync, outbox y hardware mock | en curso | agente relanzado 07:20 (station-agent) | 2026-09-09 |
| 14 | kiosk: flujos documental, entretenimiento, pago, panel técnico | en curso | agente relanzado 07:20 (kiosk); sólo existían vite.config e i18n extra | 2026-09-09 |
| 15 | admin: consola completa y portal de franquicia | en curso | agente relanzado 07:20 (admin); existían api client y lib con 28 pruebas | 2026-09-09 |
| 16 | CLI y compuertas | hecho | `pnpm gate:quick` ejecuta 12 compuertas; `pnpm psp catalog` imprime el catálogo | 2026-09-09 |
| 17 | Trazabilidad de requisitos | en curso | agente de documentación relanzado 07:20 escribe `docs/trazabilidad.md` | 2026-09-09 |
| 18 | Corte por límite de uso 03:30–07:10; relanzamiento de 7 agentes | hecho | esta fila; `git status` muestra el trabajo previo en disco | 2026-09-09 |
