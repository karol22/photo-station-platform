# @psp/imaging

## Propósito
Edición y composición deterministas: operaciones sobre buffers RGBA, pipeline de EditOps, presets, composición de plantillas a raster, layout de hojas documentales en mm con marcas de corte, codificación PNG sin dependencias.

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
- `renderPlan` dibuja sobre blanco: `fill`; `photo` cover/contain con borde y esquinas redondeadas; `asset`/`logo` (si faltan, marcador gris con borde: nunca lanza); `text` con la fuente bitmap a la mayor escala entera que cabe en el rect, alineado y recortado; `cutMarks` en negro (grosor `cutMarkThickness(dpi)`, recortadas para no invadir otra foto); `qr` como patrón determinista derivado de `fnv1a(payload)` dentro de un marco. La rotación se honra en múltiplos de 90°.

### Navegador (`@psp/imaging/browser`)
```ts
import { canvasToRaster, loadRaster, rasterToCanvas, rasterToDataUrl, renderPlanToCanvas } from '@psp/imaging/browser';

const canvas = renderPlanToCanvas(plan, { photos: [videoOrImage], assets: { ast_1: img }, logos: { brand: img }, fontFallback: 'sans-serif' });
```
`renderPlanToCanvas` usa la misma geometría que `renderPlan` pero con fuentes reales y `CanvasImageSource` (imagen, vídeo, `ImageBitmap`, canvas). Antes de renderizar, el kiosco carga las fuentes que nombran las plantillas (`document.fonts.load('bold 32px "Familia"')`) y los activos/logos por URL (`loadRaster` o `Image`); lo que falte se dibuja como marcador gris. `canvasToRaster` captura un frame de vídeo como Raster para el pipeline puro; `rasterToDataUrl` sirve para previsualizar o descargar.

### PNG
`encodePNG(raster)` produce un PNG RGBA de 8 bits con deflate stored (válido, sin compresión); `decodePNG(bytes)` lee PNG de 8 bits sin entrelazado en gris, gris+alpha, RGB y RGBA. Ambos aceptan `{ deflate }` / `{ inflate }` inyectables para usar `node:zlib` en apps Node; el inflate propio en TS cubre bloques stored, Huffman fijo y dinámico.

### Catálogo
`CATALOG` registra el paquete y cada operación de edición para `packages/catalog`.

## Cómo se prueba
```bash
pnpm --filter @psp/imaging typecheck
pnpm --filter @psp/imaging test
```
Las pruebas (`src/**/*.test.ts`) cubren operaciones con valores conocidos (`brightness` satura, `grayscale` usa luma 709, `mirrorH`, `crop`, `rotate90`, `resize` 4×4 → 2×2), validación y aplicación de EditOps contra `DOCUMENT_SAFE_TOOLS`, round-trip PNG y decodificación de un PNG comprimido con `node:zlib`, `planTemplate` de una tira 2×6 in (600×1800 px, 4 fotos, token de fecha, variantes por locale y papel), `planDocumentSheet` para 35×45 mm y 51×51 mm en 4×6 in (margen, sin solapes, centrado) y `renderPlan` píxel a píxel (foto, rotación, esquinas, borde, marcadores, texto, QR, marcas de corte). Las plantillas de prueba viven en `src/__tests__/fixtures.ts`.
