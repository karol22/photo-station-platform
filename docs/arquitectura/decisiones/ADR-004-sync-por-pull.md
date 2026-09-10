# ADR-004 · Sincronización por pull con comandos en heartbeat

## Contexto
Las máquinas están detrás de NAT en redes de terceros con conectividad intermitente. Debe funcionar con 1 y con 1,000 máquinas.

## Decisión
El agente inicia toda comunicación: heartbeat periódico, descarga de bundle por versión, descarga de activos por hash, envío de eventos en lote. Los comandos administrativos viajan en la respuesta del heartbeat y se confirman explícitamente. Todo es idempotente por id.

## Consecuencias
- Sin puertos abiertos en la máquina, sin broker obligatorio.
- Latencia de comando = intervalo de heartbeat (configurable; por defecto 30 s). Un canal WebSocket opcional puede reducirla más adelante sin cambiar el modelo.
- La nube puede escalar horizontalmente sin estado.
