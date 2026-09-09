# Decisiones abiertas

Preguntas que el producto todavía no responde. Cada una lleva su restricción, porque la restricción ya está decidida aunque la solución no. Ninguna se implementa hasta que se cierre aquí.

---

## 1 · Cómo llega una foto al celular sin almacenarla fuera de la máquina

**Restricción, que no se negocia:** no se conservan fotografías fuera de la cabina.

**La tensión, dicha con honestidad:** el paso 5 del recorrido ofrece *recibir en tu celular*. Un teléfono que no está en la red de la cabina no puede recibir una imagen sin que ésta atraviese algo intermedio. No existe una forma de entregar a distancia en la que la imagen no pase por ningún lado.

La restricción distingue **transitar** de **almacenar**. Un mecanismo aceptable hace que la imagen atraviese un punto intermedio durante minutos y se elimine de forma verificable; uno inaceptable la deja guardada esperando a que alguien la reclame algún día.

**Caminos posibles:**

| Camino | Cómo se comporta | Qué cuesta |
|---|---|---|
| El teléfono se conecta a la cabina | La imagen nunca sale de la máquina | Depende de que ambos estén en la misma red, cosa que un centro comercial rara vez permite |
| Relevo de tránsito con vida corta | La imagen espera minutos en un punto intermedio y se borra sola | Requiere ese punto intermedio y una prueba creíble del borrado |
| Mensajería del cliente | La imagen viaja por el canal de un tercero | Ese tercero la conserva según sus propias reglas, fuera de nuestro control, y aparecen datos personales |

**Qué falta para cerrarla:** decidir si *recibir en el celular* entra en la primera versión o espera, y si entra, cuál de los caminos se acepta con su costo.

---

## 2 · Qué son Pro, AI, Pareja, Familia, Mini y Club

**La duda:** si son máquinas distintas o productos dentro de la misma cabina.

Cambia bastante. Si son máquinas, cada una es un perfil de hardware con su configuración y la plataforma ya las modela como planos reutilizables. Si son productos, conviven en el catálogo de una misma máquina y se muestran u ocultan por capacidades. Club parece una categoría aparte: es pertenencia, no una variante de gabinete.

**Qué falta para cerrarla:** confirmar la lectura correcta para dar de alta la familia de productos con los datos reales.

---

## 3 · A dónde lleva el código impreso en la tira

**La duda:** la tira impresa lleva un código. Puede ser la membresía del Club, una campaña, una encuesta, o la forma de recuperar la foto.

Cada opción tiene consecuencias distintas: la membresía es identificación, la recuperación de foto cae dentro de la decisión número uno y arrastra su restricción.

**Qué falta para cerrarla:** definir el destino.

---

## 4 · Cómo se procesa la experiencia de inteligencia artificial

**Restricción:** la imagen puede salir en tránsito para procesarse, con consentimiento explícito, y no queda almacenada fuera.

**Qué falta para cerrarla:** elegir proveedor y confirmar que su tratamiento de la imagen es compatible con la restricción anterior, cosa que no todos los proveedores permiten.

---

## 5 · Fondos especiales

**La duda:** *Fondos Especiales* aparece en la pantalla de inicio de la marca. Reemplazar el fondo de verdad exige separar a la persona del fondo.

Se puede hacer dentro de la máquina, sin red, con segmentación local, que es la misma familia de herramientas que ya ejecuta el análisis facial. La alternativa es tratarlo como efecto pesado y caer en la decisión número cuatro.

**Qué falta para cerrarla:** confirmar que el reemplazo de fondo se resuelve localmente, que es lo que el producto favorece.
