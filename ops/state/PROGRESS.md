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
| 21 | Identidad efímera de cliente (ADR-011) | hecho | `pnpm --filter @psp/domain test` cubre rotación y un solo uso; el agente ofrece el QR y lo caduca; verificado en el kiosco hasta la pantalla final | 2026-09-09 |
| 22 | Codificador de QR real y decodificable | hecho | `encodeQr`/`decodeQr` en `@psp/imaging`; round-trip exacto de la URL del enlace, versión 4 ECC M | 2026-09-09 |
| 23 | Documento de producto: qué es Una de Todos, marca, paleta y familia de formas | hecho | `docs/producto/00-que-es.md`; `AGENTS.md` lo pone primero en la lista de lectura de ambos modos | 2026-09-09 |
| 24 | Recorrido canónico de cinco pasos y decisiones abiertas | hecho | `docs/producto/01-flujo-de-sesion.md`, `docs/producto/02-decisiones-abiertas.md` | 2026-09-09 |
| 25 | Corrección: el enlace efímero identifica al Club, no entrega fotos | hecho | ADR-011 y `03-sesiones-y-privacidad.md` reescritos; el kiosco pide propósito `loyalty` | 2026-09-09 |
| 26 | Cuenta regresiva con la familia de formas | hecho | `apps/kiosk/src/screens/Capture.tsx` usa `BlobFace` en el conteo del recorrido social | 2026-09-09 |
| 28 | La cabina no pregunta cuántas personas son | hecho | principio escrito en `docs/producto/00-que-es.md`; el paso se retiró del kiosco | 2026-09-09 |
| 27 | Pendiente: paleta y familia de formas de Una de Todos en el dataset y el kiosco | pendiente | `docs/producto/00-que-es.md` fija los seis colores y los seis personajes | |
