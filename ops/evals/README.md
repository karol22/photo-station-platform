# Evaluaciones propias

Casos reales que fallaron y ya no deben fallar. Cada carpeta tiene `casos.json` (entrada y salida esperada) y una prueba en el paquete correspondiente que los ejecuta.

- `documental/` — landmarks + preset → criterios esperados (ejecutado por `packages/vision`).
- `config/` — capas → efectivo esperado con procedencia (ejecutado por `packages/config-engine`).
- `precios/` — reglas + contexto → precio esperado (ejecutado por `packages/domain`).

Cuando una persona rechaza un resultado, se agrega el caso aquí y la nota en `ops/notes/rechazos.md`.
