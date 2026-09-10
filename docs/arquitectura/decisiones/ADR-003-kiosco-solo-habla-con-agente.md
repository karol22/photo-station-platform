# ADR-003 · El kiosco sólo habla con el agente local

## Contexto
La pérdida de conexión no debe destruir una sesión ni impedir funciones locales (requisito 1.4). La UI podría migrar a Android.

## Decisión
El kiosco consume únicamente `/station/v1` en localhost y SSE del agente. No conoce la nube. El agente decide qué está disponible según bundle, capacidades y conectividad.

## Consecuencias
- Una sesión completa funciona sin Internet.
- En Android, el agente puede ser un proceso embebido con la misma interfaz; el kiosco no cambia.
- La nube nunca ve fotografías.
