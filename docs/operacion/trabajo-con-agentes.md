# Trabajo con agentes de IA

Reglas operativas complementarias a `AGENTS.md`.

## Aislamiento
- Un worktree por agente: `scripts/agent-worktree.sh <nombre>` crea `../psp-wt-<nombre>` en la rama `agent/<nombre>`.
- Contenido generado y salidas viven en `var/` y `out/` dentro del checkout, ignorados.
- Prohibido `git push` desde un agente. El hook `scripts/hooks/pre-push` lo rechaza si `PSP_AGENT=1`.

## Revisión
- Todo código generado por agentes se revisa antes de fusionar. Plantilla en `.github/PULL_REQUEST_TEMPLATE.md`.
- La revisión verifica: compuertas verdes, contratos aditivos, sin proveedor real, sin texto hardcodeado, docs en presente, catálogo actualizado, trazabilidad actualizada.

## Ciclo de datos
- Cada sesión de agente deja traza en `ops/traces/AAAA-MM-DD/` (ignorado).
- Cada rechazo humano se registra en `ops/notes/rechazos.md` y produce un caso en `ops/evals/`.
- Los casos de evaluación se ejecutan como pruebas normales.
