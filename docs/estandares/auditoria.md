# Auditoría contra el estándar de repositorio listo para agentes

Este repositorio se mide contra las veinticuatro guías de [`repositorio-listo-para-agentes.md`](repositorio-listo-para-agentes.md). La tabla dice qué cumple, con la evidencia que lo demuestra, y qué falta, con el trabajo concreto que lo cerraría.

`cumple` significa que existe el mecanismo y hay algo que lo comprueba. `parcial` significa que el mecanismo existe pero incompleto o sin comprobación. `pendiente` significa que no existe.

## Resumen

| Estado | Guías |
|---|---|
| `cumple` | 12 |
| `parcial` | 9 |
| `pendiente` | 3 |

## Tabla

| # | Guía | Estado | Evidencia o hueco |
|---|---|---|---|
| 1 | Un archivo de entrada que enruta | cumple | `AGENTS.md` con dos modos y su lista de lectura; `CLAUDE.md` y `GEMINI.md` son punteros de una línea; la compuerta `agents-size` lo mantiene bajo el límite |
| 2 | Dos contextos, deliberadamente pequeños | parcial | Los dos modos tienen listas distintas, pero comparten el documento de producto y el de arquitectura. Falta declarar qué **no** debe abrir cada modo |
| 3 | El propósito está escrito y manda sobre la comodidad | cumple | `docs/producto/00-que-es.md` se declara autoridad sobre el resto y `docs/producto/03-en-que-trabajar-ahora.md` fija la prioridad |
| 4 | Libro de requisitos: lo pedido y aún no entregado | cumple | `docs/trazabilidad.md` con las 128 secciones del requisito y `docs/producto/02-decisiones-abiertas.md` con lo no decidido |
| 5 | Núcleo determinista, juicio en documentos | cumple | Lógica pura y probada en `packages/*`; el criterio vive en `docs/` y en los ADR |
| 6 | La interfaz del agente es un CLI y toda capacidad es descubrible | cumple | `pnpm psp catalog` imprime el catálogo; la compuerta `catalog-complete` falla si algo no está registrado |
| 7 | La persona y el agente nunca comparten herramienta | parcial | El agente usa el CLI y los archivos; la persona usa el kiosco y la consola. Falta declarar explícitamente en `AGENTS.md` que el agente no opera la interfaz como si fuera un cliente |
| 8 | El estado vive en disco, nunca en la sesión | cumple | `ops/state/PROGRESS.md`, `ops/state/ARTIFACTS.md`, `ops/notes/`, `ops/evals/`; la compuerta `progress-evidence` exige evidencia por fila |
| 9 | Se conserva cada versión del artefacto creado | parcial | Los presets documentales y los bundles de configuración sí son inmutables y versionados. Las salidas de sesión no se conservan **a propósito**: la política de retención las borra, que es un requisito del producto, no un hueco |
| 10 | Las compuertas miden hechos; la prosa carga el juicio | cumple | Trece compuertas en `tools/gates/`; el criterio vive en `AGENTS.md` §4 y en los documentos de producto |
| 11 | Una compuerta saltada queda registrada y su resultado no se publica | pendiente | No existe mecanismo de excepción. Hoy una compuerta roja simplemente detiene el trabajo, sin forma de dejar constancia de un salto deliberado |
| 12 | Verdad de referencia donde el dominio la tiene | parcial | `ops/evals/` existe y los paquetes tienen sus propios casos. El codificador de QR sí se validó contra dos referencias externas. Falta un conjunto de referencia para el cumplimiento documental construido con fotografías reales |
| 13 | Procedencia e idempotencia de todo lo pagado | parcial | El libro mayor y su formato existen en `ops/ledger/` y `packages/integrations`, con rechazo de duplicados probado. Sigue vacío porque no hay proveedor conectado |
| 14 | El modelo crea, el código agenda | parcial | Se respeta donde aplica: la visión corre en el aparato y el resultado es el que produce el modelo. Cuando entre la experiencia de IA habrá que sostener la regla y no falsificar el efecto en código |
| 15 | Aislamiento, permisos y secretos | cumple | Un worktree por agente, gancho que rechaza el envío, resolvedor de secretos que nunca imprime valores y compuerta `no-secrets` |
| 16 | Deliberación donde un solo agente no basta, con alguien que decide | pendiente | El trabajo en paralelo se coordina desde la sesión principal, no desde un mecanismo del repositorio |
| 17 | El trabajo largo es una secuencia de paquetes recuperables | parcial | El progreso en disco permite retomar en frío, cosa que ya se demostró tras un corte real. Falta que cada paquete declare por sí mismo cómo se reanuda |
| 18 | Señalar, nunca bloquear, lo que la máquina no puede juzgar | parcial | La visión distingue lo que bloquea de lo que sólo advierte, y el kiosco avisa cuando la guía visual va limitada. Falta que un detector que no pudo correr se reporte como no disponible en lugar de en verde |
| 19 | La documentación dice el presente | cumple | La compuerta `docs-present-tense` lo verifica en todos los documentos |
| 20 | Pruebas herméticas y revisión del código escrito por agentes | cumple | `pnpm gate:quick` corre sin red ni hardware; plantilla de revisión y regla de no publicar desde un agente |
| 21 | La reacción al producto entra al motor, no al producto publicado | parcial | `ops/notes/rechazos.md` recoge lo rechazado. Falta que cada rechazo produzca su caso de evaluación de forma sistemática |
| 22 | Un ciclo de datos hecho del juicio de la persona | parcial | Las correcciones de esta bitácora se convirtieron en principios escritos, que es la forma correcta. Falta cerrar el ciclo con casos ejecutables |
| 23 | Habilidades y memoria como archivos que el agente lee | cumple | Todo el criterio vive en `docs/` y `AGENTS.md`, no en la memoria de una sesión |
| 24 | Original por proyecto, sin fórmula | cumple | Los documentos de producto y las decisiones responden a esta cabina y a esta marca, no a una plantilla |

## Lo primero que cerraría

1. **Guía 11** — una compuerta saltada debe dejar rastro. Hoy no hay forma de decir "salté esto y por qué", lo que empuja a saltarla en silencio.
2. **Guía 18** — un detector que no pudo ejecutarse debe reportarse como no disponible, nunca como aprobado. Con la visión creciendo, esto se vuelve importante rápido.
3. **Guía 2** — declarar qué no debe leer cada modo, no sólo qué sí.
