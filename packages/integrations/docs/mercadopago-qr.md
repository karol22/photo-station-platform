# Mercado Pago QR · plan de integración (sin implementar)

Este documento describe **cómo se evaluará** el cobro con código QR de Mercado Pago detrás del puerto `PaymentTerminal`. Es un plan a nivel de capacidades: no hay código que llame a Mercado Pago, no hay credenciales y no se nombran endpoints ni campos de su API. El adaptador actual es `MercadoPagoQrStub`, cuyo `status()` es `not_configured` y cuyos métodos de operación lanzan `NotConfiguredError` señalando este archivo.

## Modelo: un QR dinámico por sesión

Mercado Pago permite dos modalidades de QR: el **QR estático** (una imagen fija del comercio en la que el cliente escribe el monto) y el **QR dinámico** (una orden con monto y concepto que se genera por cobro y caduca). Para una fotocabina sólo tiene sentido el dinámico:

- Cada `createIntent` genera una orden por el monto de la sesión con una referencia externa igual al id del intent; el kiosco muestra el QR (la carga útil del QR viaja en `PaymentIntent.ref` o en un campo aditivo del contrato) y el mensaje del estado `awaiting`.
- El cliente escanea con la app de Mercado Pago y confirma; el cobro se acredita en la cuenta del comercio.
- La orden caduca con `timeoutSec`: `expire` deja el intent en `expired` y el adaptador cancela la orden para que un pago tardío no quede huérfano.
- El mismo intent nunca crea dos órdenes (idempotencia por `intent.id`), y `cancel` cancela la orden en Mercado Pago antes de mover el estado.

Requiere conexión a internet desde la máquina. Sin conexión, `status()` es `offline`, `initialPaymentState` devuelve `device_out_of_service` y el kiosco muestra el estado correspondiente sin ofrecer el QR (matriz de degradación en `docs/arquitectura/00-vision-general.md` §4.3).

## Estados de Mercado Pago → `PaymentState`

Las órdenes y pagos de Mercado Pago exponen un estado propio. El adaptador los traduce a eventos de la máquina de estados pura (`nextPaymentState`):

| Situación reportada por Mercado Pago | Evento | `PaymentState` |
|---|---|---|
| Orden creada y publicada en el QR | — | `awaiting` |
| Pago en proceso (el cliente confirmó, la acreditación está en curso) | `start` | `initiated` |
| Pago acreditado | `approve` | `approved` (referencia del pago en `ref`) |
| Pago rechazado (fondos, límites, emisor) | `decline` | `declined` |
| Orden cancelada por el comercio | `cancel` | `cancelled` |
| Orden caducada sin pago | `expire` | `expired` |
| Pago retenido o pendiente de revisión antifraude | `review` | `under_review` |
| Sin conexión o API no disponible | `device_out` / `device_ok` | `device_out_of_service` ↔ `awaiting` |
| Sin credenciales configuradas | — | `unavailable` (`status()` = `not_configured`) |

Reembolsos y contracargos quedan fuera del puerto en esta fase: se operan desde el panel de Mercado Pago y se reflejan en conciliación.

## Webhooks vs. polling

Mercado Pago notifica cambios de pago por **webhooks** a una URL pública. La máquina no puede recibirlos: está detrás de NAT y no expone puertos (`docs/arquitectura/00-vision-general.md` §2, principio 8). Por eso el diseño es:

- **Agente de estación: polling.** Mientras el intent está en `awaiting`/`initiated`, el agente consulta el estado de la orden a intervalos cortos con retroceso exponencial y hasta `expiresAt`. `tick(now)` es el lugar natural: en cada tick el adaptador decide si toca consultar y aplica el evento resultante. Ninguna consulta se hace fuera de una sesión con pago pendiente.
- **Plano de control: webhooks.** El plano de control recibe las notificaciones de Mercado Pago, verifica su firma y las usa para **conciliar** contra el libro de sesiones (`SessionRecord.commercial.paymentRef`). Si un webhook llega antes de que la máquina haya consultado, el plano de control puede adjuntar el resultado en la respuesta del siguiente heartbeat como comando; la máquina lo aplica como evento `approve`/`decline`, con la misma idempotencia que cualquier comando de flota.

Ambas fuentes producen el mismo evento sobre el mismo intent; repetir un evento ya aplicado no tiene efecto (la tabla lo rechaza y el adaptador lo descarta).

## Qué se necesita de Mercado Pago

- Una cuenta de vendedor (por organización o por franquicia, según quién cobre) con la modalidad de QR habilitada y una sucursal y caja registradas por máquina.
- Credenciales de integración, resueltas con `resolveSecret` (`payment.mercadopago.*` como nombres de secreto en `var/secrets.json` o el entorno) y nunca escritas en el bundle de configuración.
- Un entorno de pruebas (cuentas de prueba de Mercado Pago) para validar el flujo sin dinero real.
- La política de liquidación y comisiones por país, porque el registro comercial de la sesión guarda precio de lista y precio final, no la comisión.

## Cómo se agregará cuando llegue

1. Implementar `MercadoPagoQrTerminal implements PaymentTerminal` en `src/payment/` con polling dentro de `tick`; el stub desaparece.
2. Si el contrato necesita la carga útil del QR como campo propio, agregarlo a `PaymentIntent` de forma aditiva en `packages/contracts`.
3. Registrar el adaptador en `src/catalog.ts` con `status: 'stable'`; `payment.terminalAdapter = 'mercadopago_qr'` ya existe en contracts.
4. Registrar cada consulta con costo en `PaidCallLedger` (las consultas de estado no tienen costo, pero el libro mayor exige registrar cualquier llamada pagada).
5. Probar primero con el mock (`MockPaymentTerminal` ya cubre `awaiting → approved` y `expire` por `tick`), luego con cuentas de prueba; la UI del kiosco no cambia.
