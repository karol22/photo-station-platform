# Campaña: rediseño visual del kiosco

**Modo:** desarrollador
**Abierta:** 2026-09-09 · **Estado:** abierta, esperando el único veredicto que cuenta

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

El recorrido social ya no es un trámite ni se ve como un panel de administración.

**El ritmo es el de una fotocabina.** Seis tomas para cuatro huecos. Un toque arranca la tanda
entera y la máquina lleva el compás, con un respiro entre disparos para ver la foto y leer la
siguiente pose. Elegir va antes que editar y la cabina llega con las mejores ya marcadas. El
estilo se elige una vez y se aplica a las cuatro.

**La dirección visual está aplicada.** Cinco bandas fijas en las ocho pantallas: se mira arriba, se
toca abajo, y nada táctil a la altura de la cara. Color a sangre, cero tarjetas blancas, relieve
duro en vez de sombra difusa, y la marquesina de focos que además es el único reloj del recorrido.
La atracción es un cartel con cinco compases y el espejo entra en cuanto la cámara ve a alguien.

**La marca se dibuja como está dibujada**: nubes de lóbulos en color plano, apiladas y solapadas,
con gesto y mirada dirigible. Y con tipografía propia empaquetada: cuatro familias, 180 KB.

**La cabina suena** —cuenta, obturador, aterrizaje, cobro aprobado y celebración, sin un solo
archivo de audio— y cada aviso tiene gemelo visual, así que en silencio no se pierde nada.

**Se le puede hacer algo a la foto.** Estilos sobre la cara real, pegatinas que se arrastran, y
accesorios que se colocan solos donde va la cara.

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

- **El veredicto que cuenta**: si la persona que lo encargó lo aprueba mirándolo. Es el único que
  no se puede automatizar y el que cierra la campaña.
- **Nada se ha visto en el aparato de verdad**: no hay Android, ni panel de 43 pulgadas a 300
  nits, ni metro y medio de distancia. Todo está verificado en un navegador de escritorio con la
  pantalla emulada a 1080×1920. La prueba de los cuatro metros del plan sigue sin hacerse.
- **Los aretes cuelgan a la altura de la mandíbula** y no de la oreja, porque la malla facial se
  acaba en el contorno del rostro. El sombrero se apoya bajo con pelo abundante.
- **El logotipo todavía no se compone como la lámina**: dos líneas apretadas con el arco encima.

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

Enseñárselo a quien lo encargó y que lo mire. El recorrido completo ya se ejerció de punta a punta
en el navegador a 1080×1920 y las trece compuertas están en verde; lo que falta no es trabajo, es
un juicio que ninguna prueba puede dar.

## Lo que el plan pedía y no se hizo, con su motivo

**Los dos QR encadenados de la pantalla de cierre.** El plan proponía dos códigos: uno para unirse
a la red de la cabina y otro para descargar las fotografías. No se implementa, por dos razones
independientes y cada una suficiente:

1. El segundo QR entrega fotografías, y de esta máquina no sale ninguna. El enlace efímero es
   identidad del Club, no transporte de imágenes, y así lo fija
   [`ADR-011`](../../../docs/arquitectura/decisiones/ADR-011-identidad-efimera-de-cliente.md).
2. Las claves de red que haría falta leer —nombre de red y contraseña— no existen en
   `packages/contracts`. Inventarlas rompería la compuerta del catálogo y la política.

Queda un solo código, el del Club. Si algún día se decide que la entrega digital entra, se decide
antes en [`docs/producto/02-decisiones-abiertas.md`](../../../docs/producto/02-decisiones-abiertas.md),
que ya tiene abierta esa pregunta con sus tres caminos y sus costos.

**El clip de la sesión en bucle**, también del cierre: no existe grabación de sesión en el aparato.

**Un botón de «otra vez»** al terminar: cruza el cierre de sesión con el arranque de la siguiente
y toca estado que no pertenece a esa pantalla. Queda pendiente.
