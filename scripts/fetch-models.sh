#!/usr/bin/env bash
# Descarga los modelos de visión que el kiosco ejecuta localmente. Sólo se necesita para actualizarlos.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p apps/kiosk/public/models
# Los cuatro modelos que la cabina ejecuta dentro del aparato. Todos tienen equivalente en el SDK
# de Android, que es el criterio para estar aquí (docs/producto/03-en-que-trabajar-ahora.md).
base=https://storage.googleapis.com/mediapipe-models
fetch() { curl -fsSL -o "apps/kiosk/public/models/$2" "$base/$1"; echo "  $2"; }
fetch face_landmarker/face_landmarker/float16/1/face_landmarker.task face_landmarker.task
fetch image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite selfie_segmenter.tflite
fetch gesture_recognizer/gesture_recognizer/float16/latest/gesture_recognizer.task gesture_recognizer.task
fetch face_detector/blaze_face_short_range/float16/latest/blaze_face_short_range.tflite blaze_face_short_range.tflite
ls -la apps/kiosk/public/models/
