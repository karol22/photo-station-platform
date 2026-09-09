# Hardware y periféricos

Cómo la plataforma representa capacidades físicas sin asumir una configuración de máquina única (requisito 1.3, 14). Contratos en `packages/contracts/src/capabilities.ts` y `hierarchy.ts` (`HardwareProfile`); lógica pura en `packages/domain/src/capabilities.ts`; adaptadores en `apps/station-agent/src/hardware` y `packages/integrations`.

## 1. Perfiles y capacidades

Un `HardwareProfile` describe un tipo de estación física: cámara (tipo, cantidad, resolución, orientación), impresoras (`PrinterDefinition[]`), tamaños de papel soportados, pantalla (táctil, resolución, orientación), iluminación (booleano), almacenamiento mínimo esperado, periféricos libres (`string[]`), lector de pago (booleano), audio (booleano), sensores (`string[]`) y `expectedCapabilities: CapabilityKey[]` — la lista contra la que se compara lo que la máquina realmente reporta. El dataset demo trae tres (`hwp_doc_station`, `hwp_thermal_kiosk`, `hwp_premium_booth`).

`CapabilityKey` es una lista cerrada de 14 valores: `camera.primary`, `camera.secondary`, `display.touch`, `printer.photo`, `printer.thermal`, `printer.color`, `printer.bw`, `lighting.controllable`, `payment.terminal`, `connectivity.online`, `storage.local`, `audio.output`, `sensor.presence`, `sensor.temperature`. Cada una se reporta como `MachineCapabilityState { key, present, operational, detail?, updatedAt? }`: **presente** (el hardware existe) y **operativa** (funciona ahora mismo) son preguntas independientes — una impresora sin papel está presente pero no operativa.

```ts
capabilityMap(machine: Machine): Partial<Record<CapabilityKey, MachineCapabilityState>>
checkCapabilities(required: CapabilityKey[], machine: Machine): { missing: CapabilityKey[]; notOperational: CapabilityKey[] }
```

`checkCapabilities` es lo que separa "este producto nunca podría correr aquí" (`missing`, hardware ausente) de "podría, pero no ahora" (`notOperational`, p. ej. impresora atascada) — la primera oculta el producto, la segunda lo bloquea con explicación (`UnavailabilityReason`, `docs/protocolos/station-api-v1.md` no lo repite pero usa el mismo tipo vía `ProductAvailabilityState`).

## 2. Detección y reporte

La máquina reporta sus capacidades en dos momentos: al enrolarse (`EnrollRequest.report.capabilities`, con `hardwareProfileHint` para que la nube proponga el perfil) y en cada `HeartbeatRequest.capabilities` (`docs/protocolos/fleet-sync-v1.md` §2.1–2.2). El control-plane compara lo reportado contra `HardwareProfile.expectedCapabilities`; cuando cambia `present` u `operational` de alguna capacidad, el agente emite además el evento dedicado `capability_change` con la lista completa (§5 de `fleet-sync-v1.md`), para que la nube no tenga que esperar al siguiente heartbeat completo para reaccionar a una impresora que se atascó.

```json
{ "key": "printer.photo", "present": true, "operational": true, "detail": "prn_photo_1", "updatedAt": "2026-09-09T13:00:00Z" }
```

## 3. Impresoras

`PrinterDefinition` (declarativa, en `HardwareProfile`/`Machine`): `id`, `name`, `type` (`photo` | `thermal`), `paperSizes` (`PaperSize`: `4x6in`, `5x7in`, `6x8in`, `2x6in-strip`, `58mm-thermal`, `80mm-thermal`, `A4`, `A5`, `custom`), `color`, `consumableType?`, `priority` (orden de preferencia cuando hay más de una). `PrinterRuntime` la extiende con lo que sólo se sabe en vivo: `status` (`ready | busy | no_paper | jam | error | offline | unknown`), `paperEstimate?`, `lastJobAt?`, `message?`.

Cola de impresión idempotente: `PrintRequest.idempotencyKey` es obligatorio (`docs/protocolos/station-api-v1.md` §2.6); el agente indexa `PrintJob` por esa clave y, si ya existe un trabajo con ella, devuelve el existente en vez de encolar uno nuevo — así un doble toque en "imprimir" o un reintento tras perder la respuesta de red nunca produce dos copias físicas (requisito 32.3). `PrintJobStatus` recorre `preparing → printing → completed`, con `failed`/`retrying`/`cancelled` como salidas; `POST /sessions/:id/print/:jobId/retry` sube `attempt` sobre el mismo `idempotencyKey`. Las pruebas de impresión del panel técnico (`isTest: true`) usan la misma cola y el mismo mecanismo anti-duplicado, pero nunca cuentan como venta (`sessionId` ausente) ni entran en `SessionRecord`.

## 4. Cámara

En esta fase la captura la hace el navegador del kiosco con `getUserMedia` sobre un `<video>`/`canvas`; el agente sólo registra la capacidad (`camera.primary`) y su estado, nunca controla el sensor directamente (`00-vision-general.md` §4.1). Para desarrollo y para máquinas sin cámara física, `packages/vision` expone una **fuente sintética** (`MockFaceAnalyzer` + `syntheticFace`, y una cámara sintética en el kiosco que genera frames con un rostro compuesto) para que todo el pipeline de guía visual y auto-captura se pueda probar y demostrar sin hardware real — la misma razón por la que las pruebas de `@psp/vision` corren en Node con landmarks sintéticos en vez de necesitar una webcam en CI. Una **segunda cámara** (`camera.secondary`) está en el registro de capacidades para casos como una vista frontal adicional o una toma de ambiente; ningún preset documental ni experiencia del dataset demo la exige hoy, así que su consumo (cuál captura usa cuál cámara) queda abierto hasta que un producto la necesite.

## 5. Iluminación

`HardwareProfile.lighting: boolean` declara si la estación tiene iluminación controlable por software (`lighting.controllable` en `CapabilityKey`). Es una capacidad binaria hoy — presente u operativa, sin niveles ni color modelados en el contrato — usada sobre todo por la prueba local del panel técnico (`TechTestKind.lighting`, requisito 12.3) y como requisito de hardware opcional de un producto (`Product.hardwareRequirements`).

## 6. Terminal de pago

`payment.terminal` es la capacidad; `PaymentTerminal` (`packages/integrations`) es el puerto con el que el agente lo opera, independientemente del adaptador. Hoy sólo hay un adaptador operable, `MockPaymentTerminal`, más dos stubs que documentan cómo se integrará el hardware real sin que la UI cambie:

- `packages/integrations/docs/nayax.md` — lectores *cashless* VPOS Touch/Onyx; protocolo local estilo *vending* desde el agente (para cobrar sin depender de la nube) más la API en la nube de Nayax sólo para conciliación.
- `packages/integrations/docs/mercadopago-qr.md` — QR dinámico por sesión; el agente hace polling del estado (la máquina no puede recibir webhooks detrás de NAT), y el control-plane sí recibe webhooks para conciliar contra `SessionRecord.commercial.paymentRef`.

El estado del enlace físico se reporta como `PaymentTerminalStatus` (`ready | busy | out_of_service | not_configured | offline`), independiente del `PaymentState` de un intento concreto (`docs/protocolos/station-api-v1.md` §9): el lector puede estar `ready` entre una venta y otra, y `out_of_service` cuando deja de responder al enlace serial o a la red.

## 7. Sensores

`sensor.presence` y `sensor.temperature` son las dos capacidades de sensor registradas hoy en `CapabilityKey`; `HardwareProfile.sensors: string[]` deja además un campo libre para identificar el modelo o variante instalada sin necesitar un cambio de contrato. Ningún producto del dataset demo los requiere todavía (`hardwareRequirements` vacío para ellos); están representados para que un blueprint futuro (p. ej. una estación que se activa sólo cuando detecta a alguien cerca) no necesite un cambio de esquema.

## 8. Matriz producto → capacidad

`Product.hardwareRequirements: CapabilityKey[]` es explícito por producto; `computeAvailability` (`packages/domain`) lo cruza con `checkCapabilities` para decidir si el producto se oculta (`missing`) o se bloquea con explicación (`notOperational`). Ejemplos representativos del dataset demo:

| Tipo de producto | Capacidades típicamente requeridas |
|---|---|
| Documento (credencial, visa, pasaporte) | `camera.primary`, `printer.photo`, `storage.local` |
| Entretenimiento (tira de fotos, experiencia temática) | `camera.primary`, `printer.photo` o `printer.thermal` (según el template de salida), `audio.output` si la experiencia usa sonido |
| Foto estilo recibo | `camera.primary`, `printer.thermal` |
| Retrato profesional / premium | `camera.primary`, `printer.photo`, `lighting.controllable` |
| Cualquier producto pagado | `payment.terminal` (salvo que `payment.businessMode` sea `free_sponsored`, `internal` o `included`, ver `docs/arquitectura/02-configuracion-heredada.md` §10) |
| Cualquier producto con entrega o IA futura | `connectivity.online` (el producto se muestra `coming_soon`/bloqueado sin conexión, nunca como error) |

`printing.photo` y `printing.thermal` como `FeatureKey` (`docs/arquitectura/00-vision-general.md`/`packages/contracts/src/features.ts`) declaran además `requiresCapabilities: ["printer.photo"]`/`["printer.thermal"]`, así que una máquina sin esa impresora no sólo pierde el producto puntual: pierde la feature completa de forma consistente en cualquier lugar que la consulte.
