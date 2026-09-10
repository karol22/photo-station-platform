# Campaña: rediseño visual del kiosco

**Modo:** desarrollador
**Abierta:** 2026-09-09 · **Estado:** abierta

## Objetivo

Que la cabina convoque desde el pasillo de una plaza y se sienta como una fotocabina asiática, no
como un panel de administración. Termina cuando el recorrido social tiene dirección visual propia
aplicada, ritmo de fotocabina y casos esquina resueltos, y la persona que lo encargó lo aprueba
mirándolo.

## Restricciones

- Las permanentes: [`../../POLITICA.md`](../../POLITICA.md) y [`../../ATENCION.md`](../../ATENCION.md).
- La máquina física no existe: nada de impresión, papel ni gabinete.
- La plataforma es multi-marca: la identidad entra por configuración, nunca escrita en el código.
- El encargo textual manda: [`ENCARGO.md`](ENCARGO.md).

## Estado del sistema

El recorrido social ya no es un trámite. Lo que cambió y está verificado en el navegador:

- **Se dispara de más y se elige una vez.** Seis tomas para cuatro huecos. Un toque arranca la
  tanda completa y la máquina lleva el ritmo, con un compás entre disparo y disparo para ver la
  foto y leer la siguiente pose. Ya no se aprueba foto por foto.
- **Elegir va antes que editar**, y la cabina llega con las mejores ya marcadas (`bestCaptures`).
- **El estilo es del conjunto**: se elige una vez y se aplica a las cuatro. Los deslizadores finos
  se quedan en el recorrido documental.
- **La cabina suena**: cuenta, obturador y celebración sintetizados, sin archivos de audio.
- **El tiempo no corre mientras la persona posa**, y una sesión con dinero o fotografías de por
  medio nunca se cancela sola: avanza con la mejor opción.

Lo que sigue igual y es el corazón de esta campaña: **lo visual**. Tarjetas blancas con sombra
sobre crema, tipografía del sistema, el espejo como rectángulo pequeño en una rejilla de dos
columnas, y los seis colores de la marca usados sólo dentro de las formas con cara.

## Hechos confirmados

- La persona que encarga el trabajo rechazó el resultado visual por genérico. Es el hecho que abre
  esta campaña, y lo reafirmó pidiendo que la interfaz convoque desde el pasillo.
- **No hay ni un archivo de fuente en el repositorio.** Cero reglas `@font-face`. Todo se ve con
  la fuente del sistema, que en el Android del aparato es Roboto. Sin tipografía propia no hay
  dirección visual posible; es la causa raíz número uno.
- `packages/ui/src/theme.ts` fuerza la superficie a blanco puro cuando el fondo de la marca es
  claro, así que la plataforma reparte rectángulos blancos sobre el crema de la marca.
- `BlobFace.tsx` es el **único** consumidor de `--psp-color-accent-1..6` en toda la interfaz.
- Crema `#F3EEE4` con tarjetas blancas, a 300 nits y a cuatro metros en un pasillo iluminado, es
  indistinguible de la pared. El contraste que sirve es de croma, no de luminosidad.
- La referencia asiática está investigada con fuentes y cifras: [`REFERENCIA-ASIA.md`](REFERENCIA-ASIA.md).
- Lo que falla hoy, con archivo y línea: [`AUDITORIA.md`](AUDITORIA.md).

## Preguntas abiertas

- Cuál de las tres direcciones visuales gana, y qué se injerta de las otras dos.
- Qué archivos de fuente se empaquetan. Verificadas por descarga real y lectura de tablas: Bungee,
  Baloo 2, Anybody, MuseoModerno, Asap, UNAL Ancízar, Bricolage Grotesque, Archivo.
- Cuántas opciones muestra la pantalla de elegir.

## Caminos considerados

| Camino | Estado | Por qué |
|---|---|---|
| Ajustar los estilos actuales | descartado | El problema es la dirección, no el detalle |
| Seguir el proceso del plugin: fichas, crítica del plan, después construir | elegido | Ataca la causa; la crítica antes de programar es el paso que faltó |
| Generar tres direcciones independientes y juzgarlas con jueces distintos | elegido | Una sola propuesta iterada converge a la media |

## Camino elegido

Investigar la referencia, auditar el código, generar tres direcciones que no se ven entre sí,
juzgarlas con dos lentes distintos cada una, y sintetizar el plan injertando lo rescatable.
Sólo entonces escribir CSS, derivando cada color y cada tamaño del plan.

## Las tres direcciones

| Nombre | Tesis en una línea | Firma |
|---|---|---|
| **Marquesina** | La pantalla es luz, no papel: mueble de feria, color a sangre, tinta gruesa | Una banda de 24 focos que además es el único reloj del producto |
| **Bandada** | Las seis formas dejan de ilustrar la marca y pasan a construirla: no hay rectángulos | El espejo enmascarado en una silueta, con los ojos donde está el lente; al cerrarse, dispara |
| **Seis cuartos de luz** | La pantalla es el interior iluminado de la cabina; los tokens describen luz, no superficie | El cuarto cambia de color y ese color cae sobre la cara y entra en la fotografía |

## Verificación

Objetiva: las doce compuertas en verde y el recorrido completo ejercido en el navegador.

De juicio: si la pantalla se lee de pie a metro y medio, si la siguiente acción es obvia en tres
segundos, si desde diez metros se distingue de una tienda, y si la persona que encarga el trabajo
la aprueba mirándola. Eso último es el único veredicto que cuenta.

## Siguiente acción atómica

Cerrar el plan visual con la dirección ganadora, empaquetar los archivos de fuente elegidos y
aplicar la dirección a la pantalla en reposo y a la de captura, que son las dos que deciden.
