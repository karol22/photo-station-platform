# @psp/vision

## Propósito
Visión en el dispositivo, sin conexión: rostro y malla (`FaceAnalyzer`), recorte de persona (`PersonSegmenter`), gestos de mano (`GestureRecognizer`), detección de rostros (`FaceDetector`), métricas de calidad de frame, cumplimiento contra presets documentales, instrucciones humanas, guía orientativa para entretenimiento, auto-captura y disparo por gesto.

Cada capacidad es un **puerto** con dos implementaciones: un adaptador de MediaPipe y un mock determinista. Todo lo exportado desde `@psp/vision` es puro y corre en Node; los adaptadores (sólo navegador, import dinámico) se importan por su propia entrada:

| Puerto | Adaptador | Mock | Capacidad |
|---|---|---|---|
| `FaceAnalyzer` | `@psp/vision/mediapipe` | `MockFaceAnalyzer` | `face.landmarks` |
| `PersonSegmenter` | `@psp/vision/segmenter` | `MockPersonSegmenter` | `segmentation.person` |
| `GestureRecognizer` | `@psp/vision/gestures` | `MockGestureRecognizer` | `gesture.hands` |
| `FaceDetector` | `@psp/vision/face-detector` | `MockFaceDetector` | `face.detection` |

Ningún mock usa aleatoriedad ni reloj propio: el tiempo llega siempre en `atMs`. Las firmas están fijadas en `docs/arquitectura/01-apis-de-paquetes.md`. El servido de modelos y WASM, el presupuesto de cómputo y la paridad con Android están en `packages/vision/docs/mediapipe.md`.

## Cómo se usa

### Bucle de captura documental
```ts
import { AutoCaptureController, MockFaceAnalyzer, evaluateDocumentCompliance, mirrorInstruction } from '@psp/vision';

const analyzer = hasCamera ? createMediaPipeAnalyzer({ modelUrl, wasmBaseUrl }) : new MockFaceAnalyzer();
await analyzer.init();
const auto = new AutoCaptureController({ stabilityMs: spec.autoCapture.stabilityMs });

async function onFrame(frame: ImageDataLike, atMs: number) {
  const analysis = await analyzer.analyze(frame, atMs);          // rostros + métricas del frame
  const result = evaluateDocumentCompliance(analysis, spec);     // criterios, canAutoCapture, primaryInstruction, crop
  const step = auto.update(result, atMs);                        // idle → stabilizing → ready → fired → cooldown
  ui.show(mirrorInstruction(result.primaryInstruction), result.criteria, step.progress);
  if (step.shouldCapture && result.crop) capture(result.crop);
}
```
- `evaluateDocumentCompliance` produce un `CriterionResult` por cada entrada de `VISION_CRITERIA` (`ok` / `warn` / `block` / `na`). `canAutoCapture` es verdadero sin ningún `block`; `primaryInstruction` es la del primer `block` por `INSTRUCTION_PRIORITY` (si no hay, el primer `warn`; si no, `ok`); `score` es la proporción de `ok` entre los aplicables. Los umbrales vienen de `spec.thresholds`; lo que el contrato no parametriza está en `COMPLIANCE_LIMITS`.
- `crop` es el recorte documental en px del frame: el ajustado a los rangos del spec si cabe, o el ideal (`computeDocumentCrop`) si no. `documentAspect` respeta `physical.orientation`.
- `AutoCaptureController` es determinista (el tiempo llega en `atMs`): dispara `shouldCapture` una sola vez tras `stabilityMs` continuos de frames válidos y cualquier frame inválido reinicia la ventana; `reset()` vuelve a `idle`.
- `computeFrameMetrics(img, faceBox?)` submuestrea el frame y devuelve brillo, contraste, nitidez (varianza del laplaciano), uniformidad de fondo, reflejos y, con caja, brillo y asimetría del rostro.
- `evaluatePoseGuidance(analysis, guidance)` sólo sugiere (`hints`) para experiencias de entretenimiento; nunca bloquea.
- `MockFaceAnalyzer` devuelve el rostro del guion (por defecto uno centrado ideal) y métricas reales si hay píxeles o `IDEAL_FRAME_METRICS` si el frame está vacío. `syntheticFace(opts)` genera los 478 puntos de la malla desde `FACE_MODEL` y alimenta pruebas y la cámara sintética del kiosco. `SAMPLE_DOCUMENT_SPEC` / `sampleDocumentSpec(overrides)` son un spec realista 35×45 mm.

### Recorte de persona
```ts
import { MockPersonSegmenter, featherMask, maskBounds, maskCoverage, scaleMask } from '@psp/vision';

const segmenter = hasCamera ? createMediaPipeSegmenter({ modelUrl, wasmBaseUrl }) : new MockPersonSegmenter();
await segmenter.init();
const mask = await segmenter.segment(frame, atMs);      // 255 = persona, 0 = fondo
const soft = featherMask(scaleMask(mask, out.width, out.height), 6);
if (maskCoverage(mask) > 0.05) composite(out, soft);    // hay alguien delante
```
- **La máscara puede venir a menor resolución que el cuadro** (el modelo trabaja a 256×256) y el adaptador no la reescala: quien la usa aplica `scaleMask` al tamaño de destino y después `featherMask(radiusPx)`, que suaviza el borde para que el recorte no se vea de tijera. El radio se cuenta en píxeles de la máscara, así que se escala primero y se suaviza después.
- `maskCoverage(mask)` es la fracción de píxeles de persona (0..1) y `maskBounds(mask)` su caja normalizada, o `undefined` si no hay nadie. Sirven para decidir sin mirar la imagen.
- `MockPersonSegmenter` dibuja una silueta ovalada de cabeza y hombros; `personSilhouetteMask({ cx, headCy, headHeight, shoulderWidth, width, height })` acepta posición y tamaño, y el constructor toma también un guion `(atMs, frame) => Partial<SilhouetteOptions>` para moverla con el tiempo.

### Disparo por gesto
```ts
import { GestureTriggerController, MockGestureRecognizer } from '@psp/vision';

const hands = hasCamera ? createMediaPipeGestureRecognizer({ modelUrl, wasmBaseUrl }) : new MockGestureRecognizer();
const trigger = new GestureTriggerController({ requiredGesture: 'open_palm', holdMs: 1200, cooldownMs: 2000 });

const step = trigger.update(await hands.recognize(frame, atMs));
ui.showHoldProgress(step.progress);
if (step.shouldCapture) capture();
```
- Estados `idle → holding → fired → cooldown`. Hay que **sostener** el gesto `holdMs`: una mano que pasa por delante no es una intención. `progress` va de 0 a 1 para dibujar el aro que se llena.
- Ignora las lecturas por debajo de `minScore` (0.6 por defecto) y los gestos que no son `requiredGesture`. Si el gesto desaparece, el sostén vuelve a cero; tras disparar, el enfriamiento impide encadenar capturas. `reset()` vuelve a `idle`.
- Gestos disponibles: `open_palm`, `victory`, `thumb_up`, `closed_fist`, `pointing_up`, `none`. Esto es lo que permite disparar sin tocar la pantalla a un metro de distancia.

### Encuadre de grupo
```ts
import { MockFaceDetector, groupFraming } from '@psp/vision';

const { faces } = await detector.detect(frame, atMs);
const { box, advice } = groupFraming(faces, frame);     // 'ok' | 'step_back' | 'step_closer' | 'move_center' | 'nobody'
```
- `groupFraming` devuelve la caja que contiene a todo el grupo con margen (recortada al cuadro) y el consejo. Sale **de lo que la cámara ve**: nunca se le pregunta a nadie cuántos son, así que una respuesta equivocada no puede romper el encuadre.
- Prioridad: sin rostros → `nobody`; la caja con margen ya no cabe o llena el cuadro → `step_back`; ocupa muy poco → `step_closer`; el grupo está descentrado horizontalmente → `move_center`. El descentrado vertical no se corrige pidiendo a la gente que se agache. Los umbrales (`margin`, `minCoverage`, `maxCoverage`, `centerTolerance`) se pasan por opciones y se calibran con la cámara real.

### Ritmo del análisis
```ts
import { FramePacer, lerpBox } from '@psp/vision';

const pacer = new FramePacer<SegmentationMask>({ everyFrames: 3, everyMs: 66 });
if (pacer.shouldRun(atMs)) pacer.keep(await segmenter.segment(small, atMs), atMs);
const mask = pacer.last?.value;                          // los cuadros intermedios reutilizan el último
```
- La vista previa tiene que sentirse viva: el análisis corre a resolución reducida y no en cada cuadro. `shouldRun` se llama exactamente una vez por cuadro (cuenta cuadros); el primero siempre se analiza. `lerpBox(a, b, t)` interpola las cajas para que la guía no dé saltos entre dos análisis.
- `pose.landmarks` es la capacidad cara: no se ejecuta en vivo.

### Registro de capacidades
`capabilityReport()` devuelve, para cada capacidad del catálogo de contratos, qué puerto la expone, qué adaptador y qué modelo la implementan, si está `ready` o sólo `mock`, y **cuál es su clase equivalente en Android** (`capabilityBinding(key)` para una sola). La consola de administración y el panel técnico la muestran tal cual. Una capacidad sin equivalente en Android no entra al recorrido básico: la tabla existe para que eso se vea, no se recuerde.

### Convenciones
- Coordenadas normalizadas 0..1 respecto al frame; `crop` y `FaceMeasurements` en px del frame.
- Izquierda/derecha se refieren a la IMAGEN analizada: `move_left` = el rostro debe desplazarse hacia x menor. Si la UI muestra la cámara en espejo, aplica `mirrorInstruction` y `mirrorRect` antes de mostrar.
- `HeadPose`: `yawDeg > 0` gira hacia la derecha de la imagen; `pitchDeg > 0` barbilla arriba; `rollDeg > 0` el lado derecho de la imagen queda más abajo.
- `sharpness` depende del paso de muestreo; `minSharpness` se calibra con la cámara real.
- Con lentes `forbidden` el criterio `glasses.glare` es `na`: los landmarks no confirman lentes, la UI muestra la regla del preset.

## Cómo se prueba
```bash
pnpm --filter @psp/vision typecheck
pnpm --filter @psp/vision test
```
Las pruebas (`src/**/*.test.ts`, datos compartidos en `src/__tests__/fixtures.ts`) usan un spec 35×45 mm con los umbrales por defecto del contrato y rostros sintéticos en un frame 4:3: rostro ideal → `canAutoCapture` y `ok`; pequeño → `move_closer`; grande → `move_back`; roll 12° → `head_straight`; yaw 20° → `look_front`; pitch → `chin_down`/`chin_up`; ojos cerrados → `open_eyes`; sonrisa con `smile: forbidden` → `no_smile`; dos rostros → `only_one_person`; sin rostro → `no_face`; desplazado → `move_left`/`move_right`. Cubren además métricas de imagen oscura (`light.low`) y plana (nitidez 0), `computeDocumentCrop` (relación de aspecto y centrado), `AutoCaptureController` (un solo disparo, reinicio con frame inválido, `reset`) y `MockFaceAnalyzer.analyze`.

Las capacidades nuevas se prueban igual, sin modelo: máscaras (`scaleMask` conserva cobertura y caja, `featherMask` reparte el borde en valores deterministas, `maskCoverage` / `maskBounds`, silueta del mock inyectable), `GestureTriggerController` (dispara una sola vez tras el sostén, se reinicia si el gesto desaparece, respeta el enfriamiento, ignora la baja confianza), `groupFraming` (uno, tres y cero rostros, grupo que se sale del cuadro, rostro diminuto, grupo descentrado), `FramePacer`, `capabilityReport()` (cubre el catálogo de contratos y ninguna capacidad lista entra sin equivalente en Android) y las conversiones puras de los adaptadores (`categoryMaskToPersonMask`, `toGestureName`, `landmarksBox`, `toHands`, `toFaceBoxes`), que se ejecutan en Node porque no importan MediaPipe.
