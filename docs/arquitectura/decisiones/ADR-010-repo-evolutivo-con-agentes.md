# ADR-010 · Repo evolutivo con agentes

## Contexto
El repositorio será desarrollado en gran parte por agentes de IA que llegan en frío. Lo que no está en disco no existe para ellos.

## Decisión
- `AGENTS.md` es el único punto de entrada; `CLAUDE.md` y `GEMINI.md` apuntan a él.
- El estado vive en `ops/`: progreso con evidencia, historial de artefactos, libro mayor de llamadas pagadas, evaluaciones, notas de rechazo, trazas (ignoradas).
- Las compuertas (`tools/gates`) comprueban hechos y bloquean; el criterio vive en documentos.
- El núcleo es determinista; el razonamiento de los agentes se convierte en documentación, no en código de orquestación.
- Toda capacidad está en `packages/catalog` y `pnpm catalog` la imprime.
- Un worktree por agente; nunca `push` desde un agente; revisión humana antes de fusionar.

## Consecuencias
- Una sesión nueva retoma leyendo `ops/state/PROGRESS.md` y `AGENTS.md`.
- `pnpm gate:quick` corre en segundos y es la definición mínima de "no rompí nada".
