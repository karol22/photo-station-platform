# Nayax · plan de integración (sin implementar)

Este documento describe **cómo se evaluará** la integración con lectores Nayax detrás del puerto `PaymentTerminal`. Es un plan a nivel de capacidades: no existe código que hable con Nayax, no hay credenciales y no se nombran endpoints ni campos del protocolo. El adaptador actual es `NayaxTerminalStub`, cuyo `status()` es `not_configured` y cuyos métodos de operación lanzan `NotConfiguredError` señalando este archivo.

## Qué es Nayax

Nayax fabrica lectores *cashless* para máquinas de autoservicio (expendedoras, lavanderías, fotocabinas): aceptan tarjeta con chip y sin contacto, NFC de teléfonos y, según el modelo, pagos por QR. Los modelos que se consideran son la familia **VPOS Touch** (pantalla táctil, lector integrado) y **Onyx** (lector compacto). Los lectores reportan al servicio en la nube de Nayax, que ofrece telemetría, conciliación y reportes por terminal.

En la máquina, el lector se conecta al controlador de la máquina por un puerto serial o USB y conversa con un protocolo de la industria de *vending*. Ese es el punto de contacto con el agente de estación.

## Los dos caminos que se evaluarán

### (a) Protocolo local desde el agente de estación

El lector se conecta a la máquina por USB/serial y el agente de estación lo opera de forma directa con un protocolo de estilo *vending* (la familia MDB o una interfaz de pulsos, según lo que Nayax habilite para el modelo).

- Ventaja: el cobro funciona **sin nube propia**, coherente con la matriz de degradación (`docs/arquitectura/00-vision-general.md` §4.3): la máquina cobra aunque no haya conexión con el plano de control; el registro comercial se sincroniza después.
- Ventaja: la latencia de estado es la del cable; el kiosco refleja `initiated` y `approved` en tiempo real por SSE.
- Costo: el agente necesita un adaptador de puerto serial por plataforma (Node en la máquina; Android o runtime embebido más adelante, ver `docs/arquitectura/00-vision-general.md` §10) y una capa de reintentos y detección de desconexión del lector.

### (b) API en la nube de Nayax

El plano de control consulta el servicio de Nayax para telemetría, estado de terminales y conciliación de transacciones.

- Sirve para **reportes y conciliación**: cruzar el libro de sesiones (`SessionRecord.commercial.paymentRef`) con las transacciones que Nayax liquida.
- No sustituye al camino (a) para el cobro en vivo: la máquina no depende de la nube para atender a un cliente.
- Costo: credenciales de cuenta resueltas con `resolveSecret` en el plano de control, nunca en la máquina; cada consulta pasa por el libro mayor si tiene costo.

La combinación esperada es (a) para cobrar y (b) para conciliar. La decisión se toma cuando exista una terminal de prueba y la documentación del protocolo.

## Qué eventos del puerto mapean a qué mensajes

El puerto no cambia. Lo que un adaptador real hace es traducir mensajes del lector a **eventos** de la máquina de estados pura (`nextPaymentState`), que sigue viviendo en este paquete:

| Operación / evento del puerto | Capacidad del lector que lo produce |
|---|---|
| `createIntent` → `awaiting` | Solicitar una venta por un monto: el lector queda a la espera de tarjeta/NFC. |
| `start` → `initiated` | El lector detecta un medio de pago y comienza la autorización. |
| `approve` → `approved` | Autorización aprobada; el adaptador guarda la referencia de la transacción en `PaymentIntent.ref`. |
| `decline` → `declined` | Autorización rechazada por el emisor o por el lector. |
| `cancel` → `cancelled` | El agente anula la venta pendiente (el cliente vuelve atrás o la sesión termina). |
| `expire` → `expired` | Se agota `timeoutSec` sin medio de pago; el adaptador cancela la venta en el lector y `tick(now)` aplica el evento. |
| `review` → `under_review` | Respuesta ambigua o autorización diferida; se resuelve con `approve`/`decline` posteriores. |
| `device_out` → `device_out_of_service` | El lector reporta fuera de servicio o deja de responder al enlace serial. |
| `device_ok` → `awaiting` | El lector vuelve a responder. |
| `status()` | Estado del enlace: `ready`, `busy` (venta en curso), `out_of_service`, `offline`, `not_configured`. |

`simulate` y `setDeviceState` siguen existiendo en un adaptador real: sirven al panel técnico para pruebas de hardware sin cobrar (modo prueba del lector) y para marcar el dispositivo fuera de servicio de forma manual.

## Qué se necesita de Nayax

- Una cuenta de operador con acceso al portal de Nayax y a la documentación de integración.
- Al menos una terminal (VPOS Touch u Onyx) aprovisionada a esa cuenta, con SIM o red configurada, para pruebas en laboratorio.
- La documentación del protocolo local que Nayax habilite para el modelo (interfaz serial/USB) y las condiciones de uso de su API en la nube.
- Definición del flujo de reembolso y de anulación, para decidir si se exponen en el puerto o se operan sólo desde el portal de Nayax.

## Cómo se agregará cuando llegue

1. Implementar `NayaxTerminal implements PaymentTerminal` en `src/payment/`, sustituyendo el stub; la tabla de estados no cambia.
2. Registrar el adaptador en `src/catalog.ts` con `status: 'stable'` y mantener `payment.terminalAdapter = 'nayax'` en contracts.
3. Resolver credenciales con `resolveSecret`; registrar en `PaidCallLedger` toda operación con costo.
4. Probar el flujo completo con el mock (ya cubre `awaiting → approved`) y después con la terminal en laboratorio; la UI del kiosco no cambia.
