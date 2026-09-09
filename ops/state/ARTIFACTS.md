# Artefactos versionados

| Artefacto | Versión | Ubicación | Huella | Nota |
|---|---|---|---|---|
| Requisitos de producto | 1 | `docs/requisitos-producto.md` | 2294 líneas | Documento origen del producto |
| Modelo Face Landmarker (MediaPipe, float16) | 1 | `apps/kiosk/public/models/face_landmarker.task` | 3 758 596 bytes | Apache-2.0; `scripts/fetch-models.sh` lo descarga |
| Contratos | v1 | `packages/contracts` | | Aditivo dentro de v1 |
| Migraciones control-plane | 0001 | `apps/control-plane/migrations` | | |
| Migraciones station-agent | 0001 | `apps/station-agent/migrations` | | |
| Dataset demo | 1 | `packages/fixtures` | `DEMO_NOW = 2026-09-09T12:00:00Z` | Determinista, ids fijos |
| Materializador de bundles | 1 | `packages/bundler` | 12 pruebas | Usado por control-plane y station-agent |
| Compuertas | 13 | `tools/gates/src/gates.ts` | `pnpm gate:quick` → 12 en modo quick | Registradas en `packages/catalog` |
