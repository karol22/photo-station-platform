# En qué trabajar ahora, y en qué no

Este documento fija la prioridad. Existe porque el trabajo se desvió varias veces hacia detalles que todavía no importan, y esas desviaciones cuestan tiempo real.

## El hecho que manda: la máquina no existe

No hay cabina, no hay impresora, no hay cámara industrial, no hay gabinete. Hay una laptop y un repositorio.

Mientras eso siga así, **cualquier decisión que dependa del hardware está prohibida**, porque se tomaría a ciegas y habría que rehacerla.

### No se trabaja en esto

- Tamaños de papel, tiras de dos por seis, cuántas fotos caben en una hoja, marcas de corte.
- Modelos de impresora, consumibles, bandejas, cortadores.
- Medidas del gabinete, iluminación física, montaje, cableado.
- Entrega digital, mensajería, correo, membresías, cartera de clientes.
- Cualquier integración con un proveedor externo.

Todo eso llega cuando exista una máquina real y se sepa qué trae dentro. La plataforma ya modela esas piezas como capacidades intercambiables; con eso basta por ahora.

### Sí se trabaja en esto

1. **Lo que la persona ve.** Las pantallas, el ritmo, el tono, la claridad. Que se entienda sin leer y se resuelva en pocos toques.
2. **Lo que la persona le puede hacer a su foto.** Efectos, ajustes, fondos, filtros, elementos que se pegan a la cara. Esto es el producto.
3. **La visión por computadora que hace posible lo anterior**, corriendo dentro del aparato.
4. **Los recorridos.** Hay muchos posibles y hay que simularlos para ver cuáles funcionan.

## La lámina de marca es referencia, no especificación

El material de identidad muestra colores, formas, tono y ejemplos de pantalla. Sirve para eso: para saber cómo se ve y cómo suena la marca.

**No es autoridad sobre el producto.** Los pasos que dibuja, los formatos que menciona y los detalles de la cabina son ilustración de un concepto, no requisitos. Cuando la lámina y el criterio del producto no coincidan, manda el criterio del producto.

## La restricción técnica que decide todo lo demás

Todo lo que se construya tiene que poder ejecutarse **sin conexión, dentro de un dispositivo Android de gama media**, porque ahí es donde probablemente termine corriendo la cabina.

De ahí salen tres reglas:

1. **Nada que necesite un servidor** para funcionar. Si un efecto no puede correr en el aparato, no entra al recorrido básico.
2. **Sólo técnicas que existan también en Android.** No sirve algo que funciona en un navegador de escritorio y no tiene equivalente en el teléfono. La regla práctica: si la biblioteca no publica una variante para Android, no se usa.
3. **Presupuesto de cómputo modesto.** La vista previa tiene que sentirse viva. Un modelo pesado que da dos cuadros por segundo arruina la experiencia aunque el resultado final sea bonito.

### Presupuesto de referencia

| Aspecto | Objetivo |
|---|---|
| Vista previa en vivo | fluida a ojo, análisis a unos quince cuadros por segundo |
| Resolución de análisis | mucho menor que la de captura; el análisis no necesita todos los píxeles |
| Peso de cada modelo | pocos megabytes, empaquetado con la aplicación |
| Momento del trabajo pesado | al capturar y al componer, no en cada cuadro de la vista previa |
| Conexión | ninguna |

### Por qué la familia de visión elegida

Se trabaja sobre una familia de modelos que publica **el mismo modelo para navegador y para Android**. Eso permite construir y probar hoy en la laptop, con la certeza de que lo mismo corre después en el aparato sin rehacer el producto: cambia el adaptador, no la experiencia.

Cada capacidad de visión que se agregue debe declarar explícitamente si tiene equivalente en Android. Si no lo tiene, no se agrega al recorrido básico; a lo sumo queda como función opcional que se apaga en máquinas que no la soportan.

## Cómo se decide si algo entra

Antes de construir una función, se responden tres preguntas:

1. ¿Cambia lo que la persona ve o lo que puede hacer con su foto? Si no, no entra ahora.
2. ¿Corre dentro del aparato, sin conexión, con equivalente en Android? Si no, no entra al recorrido básico.
3. ¿Depende de saber cómo es la máquina física? Si sí, se pospone.

## Sobre simular recorridos

Hay muchos recorridos posibles y todavía no se sabe cuál es el bueno. La forma de averiguarlo es construirlos y verlos funcionando, no discutirlos.

Por eso el kiosco debe poder ejecutar recorridos distintos sin cambiar código: cuántas capturas, con qué guía, con qué efectos, con qué ritmo, con cuánta decisión del usuario y cuánta automática. La configuración ya permite eso; lo que falta es tener varios recorridos armados y poder cambiar entre ellos para compararlos.

La salida de un recorrido, por ahora, es una imagen en pantalla. Que además se imprima es un detalle del futuro.
