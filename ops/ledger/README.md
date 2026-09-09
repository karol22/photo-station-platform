# Libro mayor de llamadas pagadas

`paid-calls.jsonl`: una línea JSON por llamada a un proveedor con costo (IA, mensajería, pagos). Hoy no hay proveedores reales conectados; el formato existe para que la primera integración lo use desde el día uno.

Campos:

```json
{
  "id": "call_01J...",
  "ts": "2026-09-09T08:00:00Z",
  "provider": "ai:mock",
  "operation": "stylize",
  "inputHash": "sha256:...",
  "outputRef": "var/station/mch_x/sessions/ses_y/ai/out.png",
  "cost": { "amount": 0, "currency": "USD" },
  "idempotencyKey": "ses_y:stylize:sha256:...",
  "trace": "ops/traces/2026-09-09/..."
}
```

Reglas: cambiar el insumo regenera; repetir el mismo `idempotencyKey` no cobra ni llama; nada se borra del libro. `packages/integrations/src/ledger.ts` es el escritor.
