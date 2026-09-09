# @psp/kiosk

## Propósito
UI táctil del cliente y panel técnico de la estación. PWA React (React 19, React Router 7, zustand 5) que **sólo habla con el agente local** en `/station/v1` (fetch) y `/station/v1/events` (EventSource). Toda respuesta pasa por `safeParse` del contrato (`src/api/station.ts`) antes de usarse. Ningún texto de marca, precio, ciudad ni negocio está en el código: todo sale del bundle (`GET /bundle`) o de i18n (`@psp/i18n` + `src/i18n/extra.ts`).

Recorridos: atracción → inicio → producto → (consentimiento) → (pago) → captura documental con guía en tiempo real y auto-captura, o captura de entretenimiento por poses → revisión → edición → (selección) → composición → confirmación → impresión → finalización. Errores comprensibles con código de incidente. Panel técnico protegido por PIN.

## Cómo se usa

```bash
pnpm --filter @psp/kiosk dev        # Vite en :5173; reenvía /station → http://localhost:4100 (agente)
pnpm --filter @psp/kiosk build      # dist/ con index.html, assets, models/ y wasm/
pnpm --filter @psp/kiosk preview    # sirve dist/ con el mismo proxy
```

- **Agente.** El kiosco arranca con `GET /status`, `GET /bundle` y `GET /sessions/active`; si hay una sesión activa, navega directo a la pantalla de su etapa (recuperación tras recarga). Sin agente, muestra "conexión perdida" y reintenta cada 4 s.
- **Cámara real vs. sintética.** `WebcamSource` usa `getUserMedia` (frontal, 1280×720, vista en espejo). Si `getUserMedia` falla, si `status.capabilities` dice que `camera.primary` no opera, o si el técnico la fuerza, se usa `SyntheticSource`: un canvas con un rostro estilizado que sigue `syntheticFace` de `@psp/vision` y alimenta un `MockFaceAnalyzer`, por lo que la guía documental funciona sin webcam. Los casos (lejos, cerca, ladeado, dos rostros, oscuro, descentrado, ojos cerrados) se fuerzan desde el panel técnico → Simulación.
- **Visión.** `src/vision/analyzer.ts` crea el analizador MediaPipe con `modelUrl: /models/face_landmarker.task` (modelo vendido en `public/models/`) y `wasmBaseUrl: /wasm`. En desarrollo, `vite.config.ts` sirve `/wasm/*` desde `node_modules/@mediapipe/tasks-vision/wasm`; en build los copia a `dist/wasm/`. Si el modelo no carga, cae a `MockFaceAnalyzer` sin rostros: la UI avisa "guía visual limitada" y sólo permite captura manual.
- **Panel técnico.** Cinco toques en la zona del logotipo (esquina superior izquierda) abren `/tech`. El PIN se valida con `POST /tech/login`; el token va en `Authorization: Bearer` sólo hacia `/tech/*`. Pestañas: estado, pruebas (`POST /tech/tests`), mantenimiento (`POST /tech/maintenance`), configuración local (`PATCH /tech/config`: brillo, volumen, idioma por defecto, tiempos) y simulación (`POST /tech/simulate`, `POST /payments/simulate`, cámara sintética). "Salir" descarta el token y vuelve a atracción.
- **Pago.** `POST /payments/intents` al entrar; el estado llega por SSE (`payment`). Con `payment.businessMode ≠ paid`, precio final 0 o modo demo no hay etapa de pago. En demo o en desarrollo (`import.meta.env.DEV`) aparece "Simular aprobación/rechazo/expiración".
- **Modo simplificado.** `kiosk.simplifiedMode` agrega la clase `kiosk--simplified` (textos más grandes, menos opciones). `kiosk.orientation` se expone como `data-orientation` en `<html>`.

### Rutas del agente que consume (station.v1)
`GET /status`, `GET /bundle`, `GET /sessions/active`, `POST /sessions`, `GET /sessions/:id`, `POST /sessions/:id/{stage,consents,captures,edits,selection,composition,print,finish,cancel,extend}`, `POST /payments/intents`, `POST /payments/intents/:id/cancel`, `POST /payments/simulate`, `POST /ai/jobs`, `POST /delivery`, `GET /events` (SSE, un `StationEvent` JSON por mensaje), `POST /tech/login`, `GET /tech/status`, `POST /tech/tests`, `POST /tech/maintenance`, `PATCH /tech/config`, `POST /tech/simulate`. Los cuerpos y respuestas son los esquemas de `packages/contracts/src/station-api.ts`.

### Mapa de pantallas ↔ etapas (`src/session/flow.ts`)

| Etapa | Ruta | Pantalla |
| --- | --- | --- |
| — | `/` | `Attract` (limpia cualquier sesión previa) |
| — | `/home`, `/product/:id` | `Home`, `ProductDetail` (crea la sesión y avanza a la primera etapa de trabajo) |
| `consent` | `/session/consent` | `Consent` |
| `awaiting_payment` | `/session/payment` | `Payment` |
| `capturing` | `/session/capture` | `Capture` (documental o experiencia según el producto) |
| `reviewing` | `/session/review` | `Review` |
| `editing` | `/session/edit` | `Edit` |
| `selecting` | `/session/select` | `Select` |
| `composing` | `/session/compose` | `Compose` |
| `confirming` | `/session/confirm` | `Confirm` |
| `printing` | `/session/print` | `Print` |
| `delivering`, `finishing`, `done` | `/session/finish` | `Finish` (`POST /finish`, vuelve a `/` en 10 s) |
| `failed` | `/error` | `Error` |
| — | `/tech` | `Tech` |

La lista de etapas por producto sale de `stagesForProduct` (`@psp/domain`) con `paymentRequired`/`consentRequired` calculados en `flow.ts`; cada avance hace `POST /sessions/:id/stage`. El temporizador de inactividad (`timers.idleTimeoutSec`, aviso a `warningBeforeCancelSec`) vive en `useSessionTimeout`; cualquier toque lo reinicia, "Necesito más tiempo" llama a `POST /extend` y al agotarse cancela y vuelve a atracción.

### Estructura
`src/api` (cliente + SSE) · `src/store` (zustand, reductores puros en `reducers.ts`) · `src/theme` (tema y activos: `assetBaseUrl/hash`) · `src/camera` (fuentes y bucle de frames ~12 fps sobre 640×360) · `src/vision` (analizador) · `src/capture` (recorte y resumen de análisis) · `src/compose/plan.ts` (adaptador a `planTemplate`/`planDocumentSheet`/`renderPlanToCanvas`, con plan mínimo de respaldo) · `src/session` (flujo, sesión, tiempo) · `src/screens` · `src/components` · `src/i18n` (traductor y catálogo extra con paridad es/en).

## Cómo se prueba
```bash
pnpm --filter @psp/kiosk typecheck
pnpm --filter @psp/kiosk test      # vitest en Node, sin jsdom
pnpm --filter @psp/kiosk build
```
Pruebas unitarias: `session/flow.test.ts` (siguiente pantalla por producto, pago y consentimiento, retakes), `theme/assets.test.ts` (resolución de activos y lectura de configuración), `store/reducers.test.ts` (reductor de eventos SSE, cámara efectiva, idiomas) e `i18n/extra.test.ts` (paridad es/en y prioridad del paquete). Con el agente en `:4100`, el recorrido completo se recorre en el navegador con la cámara sintética desde el panel técnico.
