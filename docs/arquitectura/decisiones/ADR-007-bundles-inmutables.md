# ADR-007 · Bundles de configuración inmutables con procedencia

## Contexto
La configuración hereda por seis niveles más blueprint y campañas; debe verse de dónde viene cada valor, qué está bloqueado, y qué configuración tenía una máquina en un momento dado (requisitos 15, 19.7, 36).

## Decisión
`packages/config-engine` resuelve capas a un `EffectiveConfig` con `values`, `provenance` y `locks`. El control-plane materializa por máquina un `ConfigBundle` (config efectiva + catálogo + presets + plantillas + campañas + features + manifiesto de activos) identificado por hash de contenido. Los bundles se guardan y nunca se modifican.

## Consecuencias
- Toda sesión registra el bundle con el que se ejecutó.
- Rollback de configuración = reactivar un bundle anterior.
- Los cambios masivos muestran cuántas máquinas cambiarían de bundle antes de confirmar.
