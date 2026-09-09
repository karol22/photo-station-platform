# MediaPipe en @psp/vision

Los adaptadores de MediaPipe son la única parte del paquete que toca el navegador. El núcleo
(`@psp/vision`) es puro y corre en Node; cada adaptador vive en `src/adapters/`, carga la librería
con `import()` dinámico dentro de `init()` y se importa por su propia entrada del paquete. Así las
pruebas, el catálogo y la lógica de encuadre no arrastran WASM.

## Los cuatro modelos

Todos se ejecutan **dentro del aparato y sin conexión**: se empaquetan con la aplicación y se sirven
desde el propio origen. Ninguna imagen sale del dispositivo.

| Archivo (en `/models/`) | Tarea | Adaptador | Peso real | Capacidad |
|---|---|---|---|---|
| `face_landmarker.task` | Face Landmarker | `@psp/vision/mediapipe` | 3.6 MB | `face.landmarks` |
| `selfie_segmenter.tflite` | Image Segmenter | `@psp/vision/segmenter` | 0.24 MB | `segmentation.person` |
| `gesture_recognizer.task` | Gesture Recognizer | `@psp/vision/gestures` | 8.0 MB | `gesture.hands` |
| `blaze_face_short_range.tflite` | Face Detector | `@psp/vision/face-detector` | 0.22 MB | `face.detection` |

Los cuatro salen del índice público de modelos de MediaPipe
(`https://storage.googleapis.com/mediapipe-models/<tarea>/<modelo>/float16/1/<archivo>`) y están en
`apps/kiosk/public/models/`. El criterio para que un modelo entre es tener **el mismo modelo
publicado para Android**; sin eso no entra al recorrido básico
(`docs/producto/03-en-que-trabajar-ahora.md`).

### Cómo se sirven

- **Modelos**: `apps/kiosk/public/models/` → el servidor de desarrollo y el `dist` los publican en
  `/models/…`. `scripts/fetch-models.sh` descarga hoy sólo `face_landmarker.task`; los otros tres
  se agregan a ese guion cuando toque actualizarlos.
- **WASM**: el complemento `psp:mediapipe-wasm` de `apps/kiosk/vite.config.ts` sirve
  `vision_wasm_*_internal.{js,wasm}` bajo `/wasm/` en desarrollo y los copia a `dist/wasm/` al
  construir, resolviéndolos del paquete instalado. No hay copias en el repositorio ni descargas en
  tiempo de ejecución.
- En cualquier otro anfitrión basta con servir ambas carpetas y pasar `modelUrl` y `wasmBaseUrl`.

```ts
const wasmBaseUrl = '/wasm';
const analyzer = createMediaPipeAnalyzer({ modelUrl: '/models/face_landmarker.task', wasmBaseUrl });
const segmenter = createMediaPipeSegmenter({ modelUrl: '/models/selfie_segmenter.tflite', wasmBaseUrl });
const gestures = createMediaPipeGestureRecognizer({ modelUrl: '/models/gesture_recognizer.task', wasmBaseUrl });
const faces = createMediaPipeFaceDetector({ modelUrl: '/models/blaze_face_short_range.tflite', wasmBaseUrl });
```

## Delegado y modo de ejecución

Los cuatro adaptadores se crean en `runningMode: 'VIDEO'` con delegado **GPU y reintento en CPU**
(`createWithDelegate`): sin WebGL utilizable, o con el contexto ya tomado por la vista previa, la
capacidad sigue viva aunque más lenta. `adapter.delegate` dice con cuál quedó, para mostrarlo en el
panel técnico. Las APIs `*ForVideo` exigen marcas de tiempo estrictamente crecientes; de eso se
encarga `VideoTimestamps`, así que el kiosco puede pasar el `atMs` que tenga.

## Presupuesto de cómputo

La vista previa tiene que sentirse viva; ésa es la restricción, no un detalle.

- El análisis corre a **resolución reducida**, nunca a la de captura.
- No hace falta analizar cada cuadro: `FramePacer` decide qué cuadros se analizan (cada N cuadros y
  como mínimo cada N ms), guarda el último resultado y `lerpBox` interpola las cajas para que la
  guía no dé saltos. En vivo: rostro y gestos cada pocos cuadros, segmentación algo más espaciada.
- `pose.landmarks` es la capacidad cara: **no se ejecuta en vivo** y hoy no tiene adaptador ni
  modelo empaquetado.
- La máscara de segmentación llega a la resolución del modelo, más chica que el cuadro. El adaptador
  no la reescala a propósito: escalarla cuesta y muchas veces el consumidor la estira en la GPU.
  Quien la use aplica `scaleMask` y `featherMask` en píxeles de destino.
- Las máscaras viven en GPU hasta que se cierran: el adaptador llama a `result.close()` en cada
  cuadro. Sin eso la vista previa se queda sin memoria en minutos.

## Paridad con Android

La familia de modelos publica **el mismo modelo para navegador y para Android**. Cuando la cabina
corra en un Android de gama media cambia el adaptador y nada más: los puertos, los mocks, el
encuadre de grupo, el disparo por gesto y las utilidades de máscara son código puro que viaja tal
cual. `capabilityReport()` devuelve esta tabla en tiempo de ejecución.

| Capacidad | Adaptador web | Clase equivalente en Android | Qué cambia |
|---|---|---|---|
| `face.landmarks` | `createMediaPipeAnalyzer` | `com.google.mediapipe.tasks.vision.facelandmarker.FaceLandmarker` | Sólo la creación de la tarea y el paso del cuadro (`MPImage` en vez de `ImageData`). |
| `face.detection` | `createMediaPipeFaceDetector` | `com.google.mediapipe.tasks.vision.facedetector.FaceDetector` | Igual; la caja sigue llegando en píxeles y se normaliza en el adaptador. |
| `segmentation.person` | `createMediaPipeSegmenter` | `com.google.mediapipe.tasks.vision.imagesegmenter.ImageSegmenter` | Igual; la máscara se lee del `ByteBuffer` en vez de `getAsUint8Array()`. |
| `gesture.hands` | `createMediaPipeGestureRecognizer` | `com.google.mediapipe.tasks.vision.gesturerecognizer.GestureRecognizer` | Igual; los gestos enlatados tienen los mismos nombres, así que `toGestureName` no cambia. |
| `pose.landmarks` | — | `com.google.mediapipe.tasks.vision.poselandmarker.PoseLandmarker` | Existe el equivalente, pero todavía no hay puerto ni adaptador de ningún lado. |

Del lado del producto no cambia nada: ni las pantallas, ni los recorridos, ni los efectos, ni los
umbrales. Lo único específico de la plataforma es qué clase construye la tarea y cómo se le entrega
el cuadro.

### Lo que sí hay que revisar al portar

- **Delegado**: en Android el delegado GPU depende del dispositivo; el mismo reintento en CPU aplica.
- **Orientación y espejo**: la cámara frontal de un teléfono entrega el cuadro rotado y en espejo.
  Las coordenadas del paquete son las de la **imagen analizada**; para mostrarlas hay que aplicar
  `mirrorInstruction` / `mirrorRect` como ya se hace en el navegador.
- **Umbrales**: `sharpness` y las confianzas mínimas se calibran con la cámara real de la cabina.
