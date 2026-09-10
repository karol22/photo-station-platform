# El recorrido del cliente

Cinco pasos. Es el recorrido canónico de Una de Todos y manda sobre cualquier pantalla que exista hoy en el kiosco.

| # | Pantalla | Qué dice | Qué hace la persona |
|---|---|---|---|
| 1 | Inicio | *Toca para empezar* | Toca. Una experiencia simple y amigable. |
| 2 | Elige | *¿Qué hacemos hoy?* | Elige qué foto quiere. |
| 3 | Sesión | *Posa, ríe, repite* | Se coloca y posa. Cuenta regresiva con personalidad. |
| 4 | Vista previa | *¡Qué buena una de todos!* | Revisa, edita y elige su diseño. |
| 5 | Comparte | *Listo para llevar* | Imprime y, si aplica, recibe en su celular. |

## Paso por paso

### 1 · Inicio

La pantalla en reposo muestra la familia de formas y una sola llamada a la acción. Nada más compite por la atención. Es también el momento en que la pantalla queda limpia de la persona anterior.

### 2 · Elige

Elige qué foto quiere, con pocas opciones grandes y claras. Si la máquina ofrece una sola cosa, este paso no existe y el recorrido sigue solo.

**La cabina no pregunta cuántas personas son.** Es una foto: entra quien entra y la cámara ve a quien esté enfrente. Preguntarlo añade un toque, admite una respuesta equivocada y no cambia el resultado. El encuadre y la guía salen de lo que la cámara observa, nunca de lo que alguien declaró.

### 3 · Sesión

*Posa, ríe, repite.* Secuencia de capturas con cuenta regresiva grande y con carácter: los personajes acompañan el conteo en lugar de un número seco.

Aquí es donde la máquina hace su trabajo: cámara, iluminación y ritmo. La persona sólo posa.

### 4 · Vista previa

Se ven las capturas y se elige el diseño. Se puede editar dentro de lo que el producto permita y repetir si el producto lo permite. El tono celebra el resultado.

### 5 · Comparte

*Listo para llevar.* Imprimir es el camino principal y siempre está. Recibir en el celular es un camino adicional cuando la marca lo habilita, y está sujeto a la restricción de que no se almacenan fotografías fuera de la máquina.

Al terminar, la pantalla se limpia por completo y vuelve al paso uno.

## Modo documental

El recorrido anterior es el de las experiencias sociales, que es el corazón de la marca. Las fotografías para trámites siguen un recorrido distinto y más estricto, con guía visual en tiempo real, criterios de cumplimiento y edición limitada a lo que preserva la fidelidad de la imagen. Está descrito en `docs/requisitos-producto.md` sección 5 y no se mezcla con las funciones creativas.

Una máquina puede ofrecer ambos recorridos, uno o ninguno, según su configuración y sus capacidades.

## Distancia con lo implementado

El kiosco implementa el recorrido completo de extremo a extremo, con el ritmo de una fotocabina:
se disparan seis tomas para cuatro huecos, un solo toque arranca la tanda entera y la máquina
lleva el compás, elegir va antes que editar, y el estilo se elige una vez y se aplica a todas.

La pantalla en reposo ya es un cartel: color a sangre, cinco bandas, una banda de focos que
además es el único reloj, y un bucle de cinco compases que entra por el espejo en cuanto la
cámara ve a alguien.

Queda pendiente aplicar esa misma dirección visual al resto de las pantallas. El plan que la fija
vive en `ops/campanas/rediseno-visual-kiosco/PLAN-VISUAL.md` y lo pendiente en
`ops/state/PROGRESS.md`.
