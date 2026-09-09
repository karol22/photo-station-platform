# ops/ · estado en disco

Todo lo que un agente necesita para retomar en frío. Ver `AGENTS.md` §5.

- `state/PROGRESS.md` — pasos con estado (`en curso`, `hecho`, `bloqueado`) y evidencia verificable.
- `state/ARTIFACTS.md` — historial de versiones de artefactos.
- `ledger/paid-calls.jsonl` — libro mayor de llamadas pagadas (una línea JSON por llamada).
- `evals/` — conjunto de evaluación propio.
- `notes/rechazos.md` — decisiones humanas de rechazo, con motivo.
- `traces/` — trazas de sesiones de agentes (ignorado por git).
