# Campaña: rediseño visual del kiosco

**Modo:** desarrollador
**Abierta:** 2026-09-09 · **Estado:** abierta

## Objetivo

Que la cabina se vea como Una de Todos y no como un panel de administración. Termina cuando las pantallas del recorrido tienen una dirección visual propia, aplicada, y la persona que la encargó la aprueba mirándola.

## Restricciones

- Las permanentes: [`../../POLITICA.md`](../../POLITICA.md) y [`../../ATENCION.md`](../../ATENCION.md).
- La máquina física no existe: nada de impresión, papel ni gabinete.
- La plataforma es multi-marca: la identidad entra por configuración, nunca escrita en el código de la interfaz.
- La marca la fija [`docs/producto/00-que-es.md`](../../../docs/producto/00-que-es.md) y manda sobre cualquier preferencia estética.

## Estado del sistema

El kiosco ejecuta el recorrido completo de extremo a extremo: reposo, catálogo, producto, consentimiento, pago simulado, captura con guía en vivo, revisión, edición, composición, impresión simulada y cierre, más el panel técnico. Hay 693 pruebas y trece compuertas en verde.

Lo visual está construido con tarjetas blancas de esquina redondeada y sombra sobre fondo claro, tipografía del sistema en pesos por defecto, y una rejilla de dos columnas en captura. La marca entra sólo como color de acento y una fila decorativa de formas.

## Hechos confirmados

- La persona que encarga el trabajo rechazó explícitamente el resultado visual actual por genérico. Es el hecho que abre esta campaña.
- La causa no es falta de herramienta: se escribió CSS sin diseñar antes, y escribir estilos a ciegas produce la media.
- Existe el plugin oficial `frontend-design`, cuyo propósito declarado es evitar la estética genérica de IA. Queda activado en `.claude/settings.json` y toma efecto en la próxima sesión.
- Ese plugin nombra tres aspectos por defecto en los que cae la IA. Uno es fondo crema con display serif y acento terracota. La paleta crema de esta marca viene de su lámina de identidad, y el propio plugin dice que cuando el encargo fija la dirección visual, ésa gana. No hay conflicto.

## Diagnóstico de lo que está mal

1. Es una aplicación web, no una cabina. Se mira de pie a metro y medio: pide escala de cartel, color a sangre y casi nada de contenedores.
2. La marca se usa como acento en vez de como medio. Las formas orgánicas deberían ser estructura (contenedores, máscaras, transiciones), no adorno al margen.
3. No hay sistema tipográfico. Fuente del sistema en pesos por defecto, cuando la identidad pide una display pesada y redondeada con interletrado apretado.
4. No hay movimiento. Una foto es un instante y la pantalla debería sentirse viva.
5. La cámara es un rectángulo pequeño en una rejilla. En una cabina la persona se está viendo a sí misma: va casi a pantalla completa.
6. Todo son tarjetas. La marca no tiene tarjetas, tiene bloques de color y siluetas.

## Preguntas abiertas

- Cuántas opciones muestra la pantalla de elegir. La primera lámina sugiere cuatro azulejos grandes; hoy hay un catálogo por categoría, más denso.
- Qué tipografía. La identidad pide una display pesada y redondeada; falta elegir uno o dos archivos que se puedan empaquetar con la aplicación, porque la cabina trabaja sin conexión.
- Cuál es el elemento firma: la única cosa por la que la pantalla se recuerda.

## Caminos considerados

| Camino | Estado | Por qué |
|---|---|---|
| Ajustar los estilos actuales | descartado | El problema es la dirección, no el detalle. Retocar la media produce media retocada |
| Dibujar primero en el lienzo de diseño y después implementar | candidato | Permite revisar y mover antes de escribir código |
| Seguir el proceso del plugin: fichas de color, tipografía, disposición y firma; criticar el plan; después construir | elegido | Es el proceso que ataca la causa, y la crítica del plan antes de programar es justo el paso que faltó |

## Camino elegido

Primero el plan visual: paleta de cuatro a seis colores con nombre, tipografías para al menos dos papeles, concepto de disposición con bocetos, y el elemento firma. Criticar ese plan contra el encargo y contra los tres aspectos por defecto. Sólo entonces escribir código, derivando cada color y cada tamaño del plan.

## Verificación

Objetiva: las trece compuertas siguen en verde y el recorrido completo se ejerce en el navegador.

De juicio, que no se disfraza de métrica: si la pantalla se lee de pie a metro y medio, si la siguiente acción es obvia en tres segundos, y si la persona que encarga el trabajo la aprueba mirándola. Esto último es el único veredicto que cuenta.

## Siguiente acción atómica

Escribir el plan visual de la pantalla en reposo y la de captura, con sus fichas y su elemento firma, y mostrarlo antes de tocar código.
