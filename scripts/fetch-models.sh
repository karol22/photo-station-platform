#!/usr/bin/env bash
# Descarga los modelos de visión que el kiosco ejecuta localmente. Sólo se necesita para actualizarlos.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p apps/kiosk/public/models
curl -fsSL -o apps/kiosk/public/models/face_landmarker.task \
  https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
ls -la apps/kiosk/public/models/
