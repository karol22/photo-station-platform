# @psp/imaging

## Propósito
Edición y composición deterministas: operaciones sobre buffers RGBA, pipeline de EditOps, presets, composición de plantillas a raster, layout de hojas documentales en mm con marcas de corte, codificación PNG y de códigos QR sin dependencias.

Todo el paquete es puro y corre en Node sin canvas. Lo único que toca el DOM vive en `@psp/imaging/browser`. Mismo insumo, misma salida: no hay `Math.random()` ni relojes. Las firmas públicas están fijadas en `docs/arquitectura/01-apis-de-paquetes.md`; lo demás son exports aditivos.

## Cómo se usa

### Raster y operaciones
`Raster = { width, height, data: Uint8ClampedArray }` es RGBA de 8 bits, compatible con `ImageData`. Toda operación devuelve un Raster nuevo (`crop`, `resize` bilineal con reducción previa 2×2, `rotate90`, `rotateSmall` ±15°, `mirrorH`, `brightness`, `contrast`, `exposure`, `saturation`, `temperature`, `grayscale`, `sharpen`, `vignette`, `blurBox`, `backgroundLighten`, `blend`, `fillRect`). Las variantes `*Into` escriben en el lugar. `parseColor` acepta `#RGB[A]`, `#RRGGBB[AA]`, `rgb()/rgba()` y nombres básicos.

### Pipeline de edición
```ts
import { EDIT_OPS, applyEditOps, editingPresetToOps, expandEditOps, validateEditOps } from '@psp/imaging';

const check = validateEditOps(ops, preset.editing.allowedTools);   // { ok, rejected, problems }
if (check.ok) out = applyEditOps(raster, ops, { assets, presets });
```
`EDIT_OPS` es la lista cerrada de operaciones; `documentSafe` se deriva de `DOCUMENT_SAFE_TOOLS` de contracts, nunca a mano. `validateEditOps` rechaza claves desconocidas, herramientas fuera de `allowedTools` y parámetros fuera de tipo o rango. `applyEditOps` recorta valores al rango, expande `preset` un solo nivel, omite marcos/stickers/overlays sin activo y lanza ante una clave desconocida (valida antes). El texto en Node usa la fuente bitmap 5×7 interna.

### Composición de plantillas
```ts
import { planTemplate, planDocumentSheet, renderPlan, selectVariant } from '@psp/imaging';

const plan = planTemplate(template, { selector: { locale, paperSize }, locale, tokens: { date, sessionCode }, photoCount: photos.length });
const raster = renderPlan(plan, { photos, assets, logos });          // Raster listo para encodePNG o para la impresora mock
const sheet = planDocumentSheet(template, { widthMm: 35, heightMm: 45 }, copies);   // { plan, fitted, sheets, rows, cols, rotated }
```
- `selectVariant` elige la primera variante cuyas claves definidas coinciden todas con el selector; devuelve elementos y lienzo (los de la variante o los base). `variantByKey` sirve para previsualizar una variante concreta.
- `planTemplate` produce un `RenderPlan` en píxeles absolutos: ordena por `zIndex` y aparición, convierte mm → px con `normalizeRect` (cajas vecinas siguen adyacentes) y `sizePt` → px con el dpi del plan. `background` → `fill`/`asset`; `photo` con `slotIndex < photoCount`; `text`/`disclaimer` por locale con caída a `es`; `token` con `ctx.tokens[token] ?? ''`; `image`/`frame` → `asset`; `logo`; `qr` con el token o `'placeholder'`; `cutMarks` alrededor de cada rect de foto. Cada primitiva lleva `elementId` y, si la caja lo define, `rotationDeg`.
- `planDocumentSheet` prueba la orientación natural y la girada 90°, se queda con la que más copias admite (filas × columnas con `gutterMm`, margen de 3 mm), centra la grilla, emite una primitiva `photo` con `slotIndex: 0` por copia (hasta `min(copies, fitted)`, con `rotationDeg: 90` si giró) y marcas de corte según `opts.cutMarks ?? template.documentSheet?.cutMarks ?? true`.
- `renderPlan` dibuja sobre blanco: `fill`; `photo` cover/contain con borde y esquinas redondeadas; `asset`/`logo` (si faltan, marcador gris con borde: nunca lanza); `text` con la fuente bitmap a la mayor escala entera que cabe en el rect, alineado y recortado; `cutMarks` en negro (grosor `cutMarkThickness(dpi)`, recortadas para no invadir otra foto); `qr` como código QR real y escaneable dentro de un marco. La rotación se honra en múltiplos de 90°.

### Navegador (`@psp/imaging/browser`)
```ts
import { canvasToRaster, loadRaster, rasterToCanvas, rasterToDataUrl, renderPlanToCanvas } from '@psp/imaging/browser';

const canvas = renderPlanToCanvas(plan, { photos: [videoOrImage], assets: { ast_1: img }, logos: { brand: img }, fontFallback: 'sans-serif' });
```
`renderPlanToCanvas` usa la misma geometría que `renderPlan` pero con fuentes reales y `CanvasImageSource` (imagen, vídeo, `ImageBitmap`, canvas). Antes de renderizar, el kiosco carga las fuentes que nombran las plantillas (`document.fonts.load('bold 32px "Familia"')`) y los activos/logos por URL (`loadRaster` o `Image`); lo que falte se dibuja como marcador gris. `canvasToRaster` captura un frame de vídeo como Raster para el pipeline puro; `rasterToDataUrl` sirve para previsualizar o descargar.

### Códigos QR
```ts
import { encodeQr, decodeQr, qrModules } from '@psp/imaging';

const qr = encodeQr('https://lumina.demo/e/AbCd1234EfGh');   // { modules, size, version, ecc, mask }
const matrix = qrModules('https://lumina.demo/e/AbCd1234EfGh');   // boolean[][] listo para pintar
```
`encodeQr` es un codificador ISO/IEC 18004 completo escrito a mano, sin dependencias: no toca DOM ni APIs de Node y el mismo texto siempre produce la misma matriz. `modules[y][x] === true` es un módulo oscuro.

- **Modos.** Elige automáticamente el más compacto que sirve para el texto entero: numérico (`0-9`), alfanumérico (`0-9 A-Z` y `` $%*+-./: ``, más el espacio) o byte con UTF-8. Un solo segmento por símbolo; no hay segmentación mixta óptima, así que un texto casi todo numérico con una letra al final se codifica entero en modo alfanumérico o byte.
- **Versiones 1 a 20** (`QR_MIN_VERSION`, `QR_MAX_VERSION`), de 21×21 a 97×97 módulos. `encodeQr` toma la más pequeña que admite el texto con el nivel pedido; `minVersion`/`maxVersion` acotan el rango. Si el texto no cabe en `maxVersion` lanza `RangeError`. Las versiones 21 a 40 no están implementadas.
- **Niveles de corrección** `L`, `M` (por omisión), `Q` y `H`, con la tabla de bloques del estándar: GF(256) con polinomio 0x11D, generador Reed-Solomon por bloque, intercalado de datos y ECC, y bits sobrantes en claro.
- **Máscara.** Aplica las ocho, evalúa las cuatro reglas de penalización y se queda con la de menor puntaje (ante empate, la de índice menor). `forceMask` fija una máscara concreta y existe **sólo para pruebas y diagnóstico**.
- **Formato y versión.** Información de formato BCH(15,5) con máscara 0x5412 en sus dos ubicaciones; desde la versión 7, información de versión BCH(18,6) en sus dos bloques.

Capacidad máxima por versión y nivel, en caracteres `numérico/alfanumérico/byte` (los bytes son UTF-8, así que una `é` gasta dos y un emoji cuatro):

| Versión | Lado | L | M | Q | H |
|---|---|---|---|---|---|
| 1 | 21 | 41/25/17 | 34/20/14 | 27/16/11 | 17/10/7 |
| 2 | 25 | 77/47/32 | 63/38/26 | 48/29/20 | 34/20/14 |
| 3 | 29 | 127/77/53 | 101/61/42 | 77/47/32 | 58/35/24 |
| 5 | 37 | 255/154/106 | 202/122/84 | 144/87/60 | 106/64/44 |
| 10 | 57 | 652/395/271 | 513/311/213 | 364/221/151 | 288/174/119 |
| 15 | 77 | 1250/758/520 | 991/600/412 | 703/426/292 | 530/321/220 |
| 20 | 97 | 2061/1249/858 | 1600/970/666 | 1159/702/482 | 919/557/382 |

`capacityFor(version, ecc, mode)` devuelve cualquier celda de esa tabla y `fitVersion(text, ecc, min, max)` la versión y el modo que elegiría el codificador.

**Al pintarlo.** `qrLayout` reserva una **zona de silencio de 4 módulos** dentro del rect y devuelve un `modulePx` entero con el origen redondeado, de modo que cada módulo cae en píxel entero y no aparecen bordes grises por interpolación. Para que un teléfono lo lea a la distancia de una cabina conviene:

- **3 px por módulo como mínimo** en pantalla (4 o más si hay brillo alto o reflejos); en impresión, 4 módulos por milímetro o menos densidad.
- Un símbolo de versión 3 (29 módulos) más la zona de silencio ocupa 37 módulos: a 4 px por módulo son 148 px de lado. Conviene dimensionar el rect a partir del módulo, no al revés.
- **Contraste alto y polaridad normal**: módulos oscuros sobre fondo claro, sin degradados ni foto debajo. La zona de silencio va del color claro del fondo, no transparente.
- Payloads cortos. Una URL de 30 caracteres cabe en versión 3 con nivel M; alargarla sube la versión, encoge el módulo y hace el símbolo más difícil de leer que subir el nivel de corrección.

`decodeQr(matrix)` es un decodificador **mínimo, sólo para pruebas y diagnóstico**: asume la matriz íntegra y perfectamente alineada, lee el formato, deshace la máscara, des-intercala los bloques y descarta la corrección sin verificarla ni usarla. No localiza un símbolo dentro de una imagen ni tolera daños; no sustituye a un lector real.

`qrModules(payload, opts?)` es lo que usan los dos renderizadores: devuelve la matriz real y, si el texto no cabe en la versión máxima, cae a `qrPlaceholderModules` (patrón determinista de 21×21 que se ve como un QR pero no se puede leer) para que el renderizado nunca lance por un payload largo. `qrPlaceholderModules` se conserva sólo como ese respaldo.

### PNG
`encodePNG(raster)` produce un PNG RGBA de 8 bits con deflate stored (válido, sin compresión); `decodePNG(bytes)` lee PNG de 8 bits sin entrelazado en gris, gris+alpha, RGB y RGBA. Ambos aceptan `{ deflate }` / `{ inflate }` inyectables para usar `node:zlib` en apps Node; el inflate propio en TS cubre bloques stored, Huffman fijo y dinámico.

### Catálogo
`CATALOG` registra el paquete, la capacidad `qr` y cada operación de edición para `packages/catalog`.

## Cómo se prueba
```bash
pnpm --filter @psp/imaging typecheck
pnpm --filter @psp/imaging test
```
Las pruebas (`src/**/*.test.ts`) cubren operaciones con valores conocidos (`brightness` satura, `grayscale` usa luma 709, `mirrorH`, `crop`, `rotate90`, `resize` 4×4 → 2×2), validación y aplicación de EditOps contra `DOCUMENT_SAFE_TOOLS`, round-trip PNG y decodificación de un PNG comprimido con `node:zlib`, `planTemplate` de una tira 2×6 in (600×1800 px, 4 fotos, token de fecha, variantes por locale y papel), `planDocumentSheet` para 35×45 mm y 51×51 mm en 4×6 in (margen, sin solapes, centrado) y `renderPlan` píxel a píxel (foto, rotación, esquinas, borde, marcadores, texto, QR, marcas de corte). Las plantillas de prueba viven en `src/__tests__/fixtures.ts`.

`src/qr/qr.test.ts` cubre el codificador contra los vectores publicados del estándar (los codewords de datos y de corrección del ejemplo `01234567` en versión 1 nivel M, la fila del nivel M de la tabla de información de formato, las posiciones de alineación de la tabla E.1), las distancias mínimas de los dos códigos BCH, la cuenta de módulos de datos de las veinte versiones frente a la fórmula de la norma, la ida y vuelta con `decodeQr` en los tres modos y los cuatro niveles (acentos y emoji incluidos), el crecimiento de versión con la longitud hasta agotar la 20, la estructura de la matriz y el determinismo.
