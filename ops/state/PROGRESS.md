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
| 8 | Visión local (`packages/vision`) | hecho | `pnpm --filter @psp/vision test` → 25 pruebas en verde | 2026-09-09 |
| 9 | Edición y composición (`packages/imaging`) | hecho | `pnpm --filter @psp/imaging test` → 45 pruebas en verde; typecheck verde | 2026-09-09 |
| 10 | Integraciones mock (`packages/integrations`) | hecho | `pnpm --filter @psp/integrations test` → 119 pruebas en verde | 2026-09-09 |
| 11 | i18n, ui, sqlite, fixtures, catalog | hecho | i18n 44, sqlite 20, fixtures 54 pruebas; `pnpm psp bundle --machine mch_demo_doc_01` imprime procedencia; catalog registra gates y comandos | 2026-09-09 |
| 12 | control-plane con seed y simulación de flota | hecho | `pnpm --filter @psp/control-plane test` → 12 pruebas; `pnpm seed` siembra 608 sesiones en `var/control-plane` | 2026-09-09 |
| 13 | station-agent con sync, outbox y hardware mock | hecho | `pnpm --filter @psp/station-agent test` → 11 pruebas; `curl localhost:4100/station/v1/bundle` devuelve 9 productos del dataset demo sin nube | 2026-09-09 |
| 14 | kiosk: flujos documental, entretenimiento, pago, panel técnico | hecho | `pnpm --filter @psp/kiosk test` → 19 pruebas; `build` 663 kB; recorrido documental completo verificado en navegador con cámara sintética hasta "Impresión terminada" y retorno a atracción | 2026-09-09 |
| 15 | admin: consola completa y portal de franquicia | hecho | `pnpm --filter @psp/admin test` → 34 pruebas; `build`; dashboard, inventario y pestaña de configuración con procedencia verificados en navegador | 2026-09-09 |
| 16 | CLI y compuertas | hecho | `pnpm gate:quick` ejecuta 12 compuertas; `pnpm psp catalog` imprime el catálogo | 2026-09-09 |
| 17 | Trazabilidad de requisitos | hecho | `docs/trazabilidad.md` → 124 completo · 2 parcial · 2 pendiente; compuerta `traceability` verde | 2026-09-09 |
| 18 | Corte por límite de uso 03:30–07:10; relanzamiento de 7 agentes | hecho | esta fila; `git status` muestra el trabajo previo en disco | 2026-09-09 |
| 19 | Integración nube ↔ máquina ↔ kiosco verificada | hecho | heartbeat actualiza la máquina en la nube; comando `set_maintenance` ejecutado y en línea temporal; sesión registrada en `GET /admin/v1/sessions` sin fotos; rollout piloto avanza con 100 máquinas simuladas | 2026-09-09 |
| 20 | Compuertas | hecho | `pnpm gate:quick` → 12/12 en verde (ver commit) | 2026-09-09 |
