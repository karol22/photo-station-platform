# ADR-005 · Visión y edición en el dispositivo

## Contexto
La guía documental en tiempo real (requisito 5.3) exige baja latencia; la privacidad exige que las fotos no salgan de la máquina.

## Decisión
`packages/vision` usa MediaPipe Face Landmarker en WASM con el modelo vendido en el repo. `packages/imaging` opera sobre `ImageData` con funciones puras; el navegador sólo aporta canvas para leer y escribir píxeles. Ambos paquetes exponen puertos con adaptadores mock deterministas para pruebas y para máquinas sin cámara.

## Consecuencias
- Ninguna dependencia de red para capturar, validar, editar o componer.
- Las pruebas de cumplimiento documental corren en Node con landmarks sintéticos.
- El modelo (~3.7 MB) se versiona en `apps/kiosk/public/models/`; `scripts/fetch-models.sh` lo actualiza.
