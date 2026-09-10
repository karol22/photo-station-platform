# Qué es Una de Todos

Este documento manda sobre cualquier suposición. Si algo en el resto del repositorio lo contradice, este documento tiene razón y lo otro es un error que hay que corregir.

## En una frase

Una cabina fotográfica física de autoservicio en un centro comercial. La persona entra, paga, se toma la foto y se va con su impresión. No instala nada, no crea una cuenta y no escribe contraseñas.

## De dónde viene el proyecto

Existen fabricantes, principalmente en China, que venden la cabina completa con su propio software. Comprar la máquina y usar su software es el camino corto, y es el que este proyecto rechaza a propósito.

El valor de este producto está en el software: la experiencia en pantalla, la personalización de cada máquina, la identidad de marca, el catálogo de productos, las campañas y la operación de una flota. La máquina es hardware; lo que la diferencia es lo que corre dentro.

Por eso el repositorio construye kiosco, agente local, plano de control y consola de administración propios, y trata al hardware como un perfil de capacidades intercambiable.

## Qué es, dicho sin rodeos

- **Autoservicio completo.** Nadie atiende la cabina. La persona resuelve todo desde la pantalla táctil.
- **La cámara está en la cabina.** El cliente nunca sube una foto desde su teléfono. La captura ocurre dentro del gabinete, con la cámara y la iluminación de la máquina.
- **El cliente paga en la máquina.** El cobro es parte del recorrido y ocurre en el lugar.
- **Sin app, sin cuenta, sin contraseña.** La experiencia es anónima de principio a fin.
- **La siguiente persona está a minutos.** Toda la experiencia se diseña para durar pocos minutos y no dejar rastro en pantalla.

## Qué no es

Estas afirmaciones existen porque son suposiciones que ya se cometieron y no deben repetirse:

- **No es una app de teléfono.** El teléfono del cliente no es parte del recorrido de captura.
- **No hay fotografías en la nube.** Las imágenes viven en el disco de la máquina y se borran ahí según la política de retención. El plano de control nunca recibe una fotografía: el registro de sesión que viaja hacia arriba no tiene ningún campo de imagen, y eso está garantizado por el contrato, no por disciplina.
- **No hay identidad de consumidor.** No existe registro, perfil ni recuperación de contraseña. Si alguna vez hay membresía, se identifica con un gesto de segundos y nunca se confunde con un usuario administrativo.
- **No se pide correo ni teléfono en la pantalla de la cabina.** Teclear datos personales con una fila detrás es exactamente lo que el producto evita.
- **No se le pregunta a la gente cuántos son.** Es una foto: entra quien entra y la cámara ve a quien esté enfrente. Una respuesta equivocada no puede romper nada porque el dato no se pide. Cualquier ajuste de encuadre sale de lo que la cámara observa, nunca de lo que alguien declaró.
- **No se añaden pasos que no cambian el resultado.** Cada toque de más es tiempo de la persona y de la fila detrás.

## El único caso en que una imagen sale de la máquina

Una fotografía puede enviarse a un servicio externo para un procesamiento que la máquina no puede hacer sola, como los efectos pesados de la experiencia de inteligencia artificial. En ese caso:

- El envío es **de tránsito, no de almacenamiento**: la imagen va, se procesa y el resultado vuelve.
- Requiere consentimiento explícito de esa persona, para esa sesión.
- Nada queda guardado fuera de la máquina cuando el procesamiento termina.

Cualquier diseño que implique conservar fotografías fuera de la cabina contradice el producto.

## Identidad de marca

**Una de Todos** · *Fotos que nos juntan* · Más personas, más historias, un mismo lugar.

Tono cálido, optimista y atemporal. Personas reales, momentos reales, un lugar para todos.

### Paleta

| Papel | Color |
|---|---|
| Rosa | `#FF6FA5` |
| Naranja | `#FF7A3C` |
| Amarillo | `#FFC24A` |
| Verde | `#5FCB92` |
| Azul | `#4C86E8` |
| Morado | `#A87BE8` |
| Crema (fondo) | `#F3EEE4` |
| Negro (texto y gabinete) | `#111111` |

Los seis colores vivos se usan juntos, no de uno en uno: la marca es el conjunto. El crema es el fondo que los deja respirar y el negro sostiene el texto y el gabinete.

### La familia

La marca no es un logotipo solo: es un grupo de formas orgánicas con cara, cada una con nombre y carácter. *Diferentes formas, la misma energía.*

| Personaje | Color | Carácter |
|---|---|---|
| La Idea | Rosa | Siempre propone |
| El Boost | Amarillo | Le pone energía |
| El Tranqui | Azul | Equilibra |
| El Compa | Naranja | Nunca falla |
| La Curiosa | Verde | Todo lo explora |
| La Chispa | Morado | Hace todo más divertido |

La familia aparece en el gabinete, en la pantalla, en las tiras impresas, en los stickers y en la tarjeta de membresía. En la interfaz sirve para dar personalidad a los momentos sin texto: la pantalla en reposo, la cuenta regresiva y la celebración al ver el resultado.

## Familia de productos

Variantes comerciales de la estación, como concepto. Cada una sería una configuración distinta de la misma plataforma. Los detalles de cada variante se deciden cuando exista hardware.

| Variante | Promesa |
|---|---|
| Pro | La experiencia completa |
| AI | Fondos, estilos y magia con inteligencia artificial |
| Pareja | Dos es mejor |
| Familia | Para todos, sin límites |
| Mini | Pequeño pero poderoso |
| Club | Beneficios, ediciones especiales y más formas de pertenecer |

## Membresía

El Club es la forma de pertenecer: más fotos, más gente, más historias. La tarjeta es física y se identifica con un gesto de segundos, sin cuenta ni contraseña. Los detalles de cómo se lee esa tarjeta viven en `docs/arquitectura/decisiones/ADR-011-identidad-efimera-de-cliente.md`.

## Prioridad actual

La máquina física no existe todavía. Qué se trabaja y qué se pospone está en `docs/producto/03-en-que-trabajar-ahora.md`, y esa prioridad manda sobre este documento en caso de conflicto.

## Piezas físicas

Referencia visual de la marca, no especificación de ingeniería. Gabinete modular con superficies brillantes y redondeadas, luz cálida que invita, piso a cuadros como detalle icónico y materiales duraderos para uso real. Rótulo superior iluminado y paneles gráficos intercambiables en las cuatro caras.

Impresos y coleccionables: tiras de cuatro fotos, stickers de la familia y bolsa de tela.

## Primera parada

Colima, Primera Plaza. Edición inicial.

## Qué queda por decidir

Las decisiones abiertas, con sus restricciones, viven en `docs/producto/02-decisiones-abiertas.md`. Ninguna se da por resuelta en el código hasta que se cierre ahí.
