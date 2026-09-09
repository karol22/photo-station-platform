# ADR-006 · Integraciones externas como puertos con adaptadores mock

## Contexto
Pagos (Nayax, Mercado Pago, adquirentes), IA generativa, WhatsApp, SMS, correo, fiscal y CRM llegarán después. La UI debe representar sus estados desde ahora sin acoplarse a un proveedor.

## Decisión
`packages/integrations` define un puerto por categoría (`PaymentTerminal`, `AiProvider`, `DeliveryChannel`, `FiscalProvider`, `CrmProvider`). Cada puerto tiene un adaptador `mock` controlable (panel técnico, admin, CLI) y adaptadores reales como stubs documentados que lanzan `NotConfigured`. La máquina de estados de pago vive en `packages/domain`, no en el adaptador.

## Consecuencias
- El flujo de pago completo se prueba hoy con el terminal mock.
- Agregar Nayax es implementar una clase y registrarla en el catálogo; la UI no cambia.
- Cada llamada pagada futura pasa por el libro mayor (`ops/ledger/`).
