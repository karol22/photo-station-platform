# Modelos de visión (locales)

Los cuatro corren **dentro del aparato**, sin conexión, y los cuatro tienen equivalente en el SDK de
Android: ése es el criterio para que estén aquí (`docs/producto/03-en-que-trabajar-ahora.md`).

| Archivo | Para qué | Tamaño |
|---|---|---|
| `face_landmarker.task` | Malla facial y expresiones: guía documental, elementos pegados a la cara, disparo por sonrisa | 3.6 MB |
| `selfie_segmenter.tflite` | Recorte de persona: cambiar, desenfocar o teñir el fondo | 0.24 MB |
| `gesture_recognizer.task` | Gestos de mano: disparar sin tocar la pantalla | 8.0 MB |
| `blaze_face_short_range.tflite` | Detección de rostros: contar personas y encuadrar al grupo, barato | 0.22 MB |

Licencia Apache-2.0. Ninguna imagen sale del dispositivo.

Actualizar: `scripts/fetch-models.sh`. La correspondencia con las clases de Android está en
`packages/vision/docs/mediapipe.md`.
