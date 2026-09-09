# El recorrido del cliente

Cinco pasos. Es el recorrido canónico de Una de Todos y manda sobre cualquier pantalla que exista hoy en el kiosco.

| # | Pantalla | Qué dice | Qué hace la persona |
|---|---|---|---|
| 1 | Inicio | *Toca para empezar* | Toca. Una experiencia simple y amigable. |
| 2 | Elige | *¿Cuántos son hoy?* | Elige el modo de foto según cuántos son. |
| 3 | Sesión | *Posa, ríe, repite* | Se coloca y posa. Cuenta regresiva con personalidad. |
| 4 | Vista previa | *¡Qué buena una de todos!* | Revisa, edita y elige su diseño. |
| 5 | Comparte | *Listo para llevar* | Imprime y, si aplica, recibe en su celular. |

## Paso por paso

### 1 · Inicio

La pantalla en reposo muestra la familia de formas y una sola llamada a la acción. Nada más compite por la atención. Es también el momento en que la pantalla queda limpia de la persona anterior.

### 2 · Elige

La pregunta no es "qué producto quieres", es **cuántos son**. La cantidad de personas determina el encuadre, el modo y el diseño sugerido. Las opciones se representan con la familia de formas, y existe un camino para grupos grandes.

Esta es la diferencia más importante con un catálogo de productos: la persona no está comprando una unidad de negocio, está diciendo quién viene con ella.

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

El kiosco implementa hoy un recorrido completo de extremo a extremo, pero organiza la entrada como catálogo de productos por categoría en lugar de la pregunta *¿cuántos son hoy?*, y la cuenta regresiva es numérica sin los personajes.

Alinear esas dos pantallas con este documento es trabajo pendiente, registrado en `ops/state/PROGRESS.md`.
