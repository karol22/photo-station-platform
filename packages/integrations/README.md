# @psp/integrations

## Propósito

Puertos y adaptadores para todo lo externo (ADR-006): terminal de pago, proveedor de IA, entrega digital, facturación fiscal y CRM. Cada puerto tiene un adaptador `mock` controlable desde el panel técnico, administración y CLI, y los proveedores reales son **stubs documentados** que lanzan `NotConfiguredError`. Ningún proveedor real está conectado: sin red, sin SDKs, sin credenciales.

Además expone la **máquina de estados de pago** pura (`nextPaymentState`, `initialPaymentState`), el resolvedor de secretos (`resolveSecret`, `SecretHandle`) y el escritor del libro mayor de llamadas pagadas (`PaidCallLedger`).

Reglas del paquete:

- **Determinista.** Reloj e ids se inyectan (`clock: () => Date`, `idFactory: () => string`). Ningún `Date.now()` ni `Math.random()`.
- **Sin timers salvo que se pidan.** Los mocks usan `setTimeout` sólo cuando se configura `autoDelayMs` (pagos) o `delayMs` (IA); en cualquier caso exponen `tick(now)` para avanzar sin timers reales. `dispose()` limpia lo pendiente.
- **Sólo contracts.** Depende de `@psp/contracts` (zod 4 a través de sus esquemas). No usa `@psp/domain`.
- **Texto al cliente localizado.** Cada `PaymentIntent` y `AiJob` lleva `message: LocalizedText` (es/en); el kiosco lo resuelve con `tl()` de `@psp/i18n`.

## Cómo se usa

### Pago completo: de `awaiting` a `approved`

```ts
import {
  createPaymentTerminal,
  initialPaymentState,
  paymentAllowsProgress,
  type MockPaymentTerminal,
} from '@psp/integrations';

const terminal = createPaymentTerminal('mock', {
  clock: () => new Date(),
  idFactory: () => makeId('pay_'), // de @psp/domain, o cualquier fábrica
}) as MockPaymentTerminal;

// 1. Con qué estado nace la sesión (requisito 42): depende del modo de negocio, demo, operador y terminal.
const state = initialPaymentState({
  businessMode: effective.values['payment.businessMode'], // 'paid' | 'free_sponsored' | 'demo' | 'courtesy' | 'included' | 'promotional' | 'internal'
  isDemo: session.isDemo,
  operatorStarted: session.operatorStarted,
  terminalStatus: terminal.status(),
  amount: price.final,
});
if (paymentAllowsProgress(state)) {
  // 'free' | 'demo' | 'not_required' | 'operator_started': la sesión salta la etapa de pago
}

// 2. Estado 'awaiting': crear el intent y publicar cada cambio al kiosco (SSE 'payment').
const off = terminal.onUpdate((intent) => broadcast({ type: 'payment', intent }));
const intent = await terminal.createIntent({
  sessionId: session.id,
  amount: price.final,
  timeoutSec: effective.values['payment.timeoutSec'],
});
// intent.state === 'awaiting', intent.expiresAt = now + timeoutSec, intent.message = { es, en }

// 3. Reloj de la sesión: expira lo vencido y aplica resultados automáticos configurados.
setInterval(() => terminal.tick(new Date()), 1000);

// 4. Resultado. Desde el panel técnico/CLI (SimulatePaymentRequest):
const approved = await terminal.simulate(intent.id, 'approve');
// onUpdate recibió: awaiting → initiated → approved; approved.ref = 'mock-auth-<id>'
// Otros resultados: 'decline' | 'cancel' | 'expire' | 'review' (luego 'approve'/'decline') | 'device_out' | 'recover'

// 5. Cierre.
off();
terminal.dispose();
```

Comportamientos del mock que conviene conocer:

- `createIntent` es **idempotente por sesión** mientras el intent sigue activo (`awaiting`, `initiated`, `under_review`, `device_out_of_service`): devuelve el mismo intent. Tras `declined`/`expired`/`cancelled` crea uno nuevo, o `retry(intentId)` reutiliza el existente.
- `status()` devuelve `busy` mientras hay un intent esperando, iniciado o en revisión; `setDeviceState('out_of_service' | 'offline')` mueve los intents activos a `device_out_of_service` y `setDeviceState('ready')` los devuelve a `awaiting`.
- `autoOutcome: 'approve' | 'decline'` resuelve solo: con `autoDelayMs` usa un timer; sin él, en el siguiente `tick`.
- Cancelar dos veces es idempotente; cancelar un pago `approved` lanza `InvalidTransitionError`. Toda transición fuera de la tabla lanza ese error (`code: 'invalid_transition'`).
- `onUpdate` notifica la creación y **cada** transición (aprobar desde `awaiting` produce dos avisos: `initiated` y `approved`).

### Stubs de proveedores reales

```ts
const nayax = createPaymentTerminal('nayax', deps); // NayaxTerminalStub
nayax.status(); // 'not_configured' → initialPaymentState devuelve 'unavailable'
await nayax.createIntent(input); // lanza NotConfiguredError: "... See packages/integrations/docs/nayax.md."
```

`status()`, `get()` y `onUpdate()` son seguros en los stubs para que el agente arranque con cualquier adaptador; `createIntent`, `cancel`, `simulate` y `setDeviceState` lanzan. Planes de integración: [`docs/nayax.md`](docs/nayax.md) y [`docs/mercadopago-qr.md`](docs/mercadopago-qr.md). `'none'` construye `NoPaymentTerminal` (mismo comportamiento, sin proveedor asociado).

### Job de IA

```ts
import { MockAiProvider, consentAllowsExternalAi } from '@psp/integrations';

const ai = new MockAiProvider({
  clock,
  idFactory,
  transform: async (image, experience) => stylize(image, experience), // de @psp/imaging
  onResult: async (job, output) => saveToSession(job.sessionId, job.id, output), // devuelve la ref → resultUrl
  failEvery: 5, // opcional: cada quinto job termina en 'error'
});
ai.onUpdate((job) => broadcast({ type: 'ai_job', job }));

const job = await ai.submit({ sessionId, captureId, experience: 'stylize', image, consent });
// consent.kind !== 'external_future' o given !== true → job.state === 'consent_required'
// experiencia fuera de ai.capabilities()               → 'rejected'
// si no                                                → 'processing'

await ai.tick(new Date()); // sin delayMs, procesa aquí; con delayMs, también un timer lo hace
ai.get(job.id); // { state: 'ready', resultUrl: 'mock://<jobId>' | la ref de onResult }
ai.getResult(job.id); // bytes producidos por transform
await ai.retry(job.id); // desde 'error': pasa por 'retry' y vuelve a 'processing'
```

`ExternalAiProviderStub` crea todo job en `coming_soon` (requisito 11.3) y `createAiProvider('mock' | 'external', deps)` elige por configuración. Por defecto el mock acepta todas las experiencias de imagen fija; `short_video` y `animated_image` quedan fuera para poder representar `rejected`.

### Entrega digital, fiscal y CRM

```ts
const whatsapp = createDeliveryChannel('mock', 'whatsapp', deps); // 'coming_soon' | 'none' para los stubs
const request = await whatsapp.send({ sessionId, destination: '+52 55 1234 5678', imageRef });
// destino inválido (E.164 aproximado o correo) → state 'failed' con reason; válido → 'queued'
whatsapp.tick(); // 'queued' → 'sent_simulated'
// El registro nunca guarda el destino en claro: sólo destinationMasked ('+52********78').

const fiscal = new MockFiscalProvider(deps);
await fiscal.issue({ sessionId, amount, concept }); // { state: 'simulated', ref: 'fiscal-sim-…' }
await new NotAvailableFiscalProvider().issue(input); // { state: 'not_available' }

const crm = new MockCrmProvider();
await crm.track({ type: 'session_completed', at, sessionId, idempotencyKey: `${sessionId}:completed` });
crm.events; // en memoria, deduplicado por idempotencyKey
```

### Secretos y libro mayor

```ts
import { PaidCallLedger, SECRETS_FILE, parseSecretsFile, resolveSecret } from '@psp/integrations';

// El agente lee var/secrets.json (ignorado por git) y pasa su contenido; el entorno tiene prioridad.
const file = existsSync(SECRETS_FILE) ? parseSecretsFile(readFileSync(SECRETS_FILE, 'utf8')) : {};
const secret = resolveSecret('PAYMENT_PROVIDER_CREDENTIAL', { file });
String(secret); // '[secreto:PAYMENT_PROVIDER_CREDENTIAL]' — también en JSON.stringify, plantillas y console.log
secret?.reveal(); // el valor, sólo en el punto de uso

// Libro mayor: una línea JSON por llamada pagada (ops/ledger/README.md). `write` recibe la línea sin salto final.
const ledger = new PaidCallLedger(
  (line) => appendFileSync('ops/ledger/paid-calls.jsonl', line + '\n'),
  readFileSync('ops/ledger/paid-calls.jsonl', 'utf8').split('\n'),
);
ledger.record({ id, ts, provider: 'ai:mock', operation: 'stylize', inputHash, outputRef, cost, idempotencyKey, trace });
// false (y no escribe) si idempotencyKey ya está en el libro
```

### Catálogo

`CATALOG` registra el paquete, los cinco puertos y cada adaptador (`status: 'mock'` para los mocks, `'stub'` para Nayax, Mercado Pago QR, el proveedor de IA externo y la entrega `coming_soon`). `pnpm catalog` lo imprime.

## Estados de pago y texto al cliente

`PAYMENT_STATE_MESSAGES` (requisito 10.3). El inglés cae al español si falta.

| `PaymentState` | Cuándo | Texto al cliente (es) |
|---|---|---|
| `not_required` | Modo `internal` o `included` | Esta sesión no requiere pago. |
| `awaiting` | Intent creado, esperando medio de pago | Esperando tu pago. Sigue las indicaciones del lector. |
| `initiated` | El lector detectó el medio y autoriza | Procesando tu pago… |
| `approved` | Autorizado; `ref` con la referencia | Pago aprobado. ¡Gracias! |
| `declined` | Rechazado; permite `retry` | Pago rechazado. Puedes intentar de nuevo o usar otro medio de pago. |
| `cancelled` | Anulado por el cliente o la sesión; permite `retry` | Pago cancelado. |
| `expired` | Venció `timeoutSec`; permite `retry` | Se agotó el tiempo para pagar. |
| `under_review` | Autorización diferida; se resuelve con `approve`/`decline` | Tu pago está en revisión. Espera un momento. |
| `unavailable` | Terminal `not_configured` | El pago no está disponible en este momento. |
| `device_out_of_service` | Terminal `out_of_service`/`offline`; vuelve a `awaiting` con `device_ok` | El dispositivo de pago está fuera de servicio. |
| `free` | Modo distinto de `paid` o monto cero | Esta sesión es gratuita. |
| `demo` | Sesión o máquina en demo | Modo demostración: sin cobro. |
| `operator_started` | Sesión iniciada por el operador | Sesión iniciada por el operador. |

Tabla de transiciones completa en `src/payment/state-machine.ts` (`PAYMENT_TRANSITIONS`); estados terminales: `not_required`, `free`, `demo`, `operator_started`, `approved`.

## Cómo se prueba

```bash
pnpm --filter @psp/integrations typecheck
pnpm --filter @psp/integrations test
```

Las pruebas cubren la tabla completa de transiciones (válidas e inválidas), `initialPaymentState` para cada modo de negocio del contrato, el terminal mock (aprobar, rechazar, cancelar, expirar por `tick`, revisión, dispositivo fuera de servicio y recuperación, `onUpdate`, `autoOutcome` con timers falsos, idempotencia por sesión, `retry`, `dispose`), los stubs (`NotConfiguredError` con el documento en el mensaje), el proveedor de IA mock (consentimiento, `processing → ready`, `failEvery`, `rejected`, `retry`, `delayMs`), la entrega digital (destinos inválidos, `queued → sent_simulated`), fiscal y CRM, `SecretHandle` (no revela en `String()`, plantillas, `JSON.stringify` ni `util.inspect`), el libro mayor (duplicados no se escriben) y el catálogo contra el contrato `CatalogEntry`.
