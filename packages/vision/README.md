# @psp/vision

## Propósito
Visión en el dispositivo: detección de rostro y landmarks (puerto FaceAnalyzer con adaptadores MediaPipe y mock), métricas de calidad de frame, evaluación de cumplimiento contra presets documentales, instrucciones humanas, guía orientativa para entretenimiento y controlador de auto-captura.

Todo lo exportado desde `@psp/vision` es puro y corre en Node; el adaptador MediaPipe (sólo navegador, import dinámico) se importa desde `@psp/vision/mediapipe`. Las firmas están fijadas en `docs/arquitectura/01-apis-de-paquetes.md`.

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
