# @psp/bundler

## Propósito
Materializa el `ConfigBundle` de una máquina a partir de las colecciones de negocio (jerarquía, capas de configuración, catálogo, presets, plantillas, experiencias, campañas, features, activos). Lo usa el control-plane para responder `/fleet/v1/bundle` y el agente de estación en modo standalone con el dataset demo. Misma entrada → mismo bundle → misma `version`.

## Cómo se usa
Pendiente de completar por el paquete.

## Cómo se prueba
```bash
pnpm --filter @psp/bundler test
```
