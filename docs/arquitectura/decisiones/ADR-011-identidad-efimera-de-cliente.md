# ADR-011 · Identidad efímera de cliente: sin cuentas, sin contraseñas, sin teclear

## Contexto

La estación vive en un centro comercial. El cliente llega, resuelve algo en dos o tres minutos y se va; la siguiente persona ya está esperando. En ese escenario cualquier autenticación clásica es inviable: escribir un correo y una contraseña en una pantalla táctil compartida es lento, se equivoca, deja rastro en la pantalla y genera una cuenta que nadie quiere administrar.

Aun así hay momentos en que el cliente necesita quedar enlazado a algo. El caso principal es la **membresía del Club**: la persona presenta su tarjeta para que su visita cuente. Le siguen los cupones del centro comercial y las campañas. El requisito 46 lo acota: el uso es anónimo y no debe implementarse una identidad de consumidor ahora, pero si más adelante existe debe distinguirse claramente de los usuarios administrativos.

## Decisión

El cliente es **anónimo por defecto** y el recorrido normal jamás pide identificarse. Las fotografías no participan de este mecanismo: el enlace identifica a una persona, no transporta imágenes. Cuando hace falta un enlace, se usa un **enlace efímero** (`CustomerHandoff`): un vínculo temporal entre la sesión en curso y el teléfono o la credencial del cliente, que nace y muere con la sesión.

Cinco métodos, ninguno con contraseña:

| Método | Cómo se ve en la cabina | Qué teclea el cliente |
|---|---|---|
| `display_qr` | La pantalla muestra un código QR con una URL corta de un solo uso | Nada: lo escanea con la cámara de su teléfono |
| `scan_qr` | El cliente acerca su cupón, boleto o tarjeta de socio a la cámara de la cabina | Nada |
| `nfc_tap` | Acerca tarjeta o teléfono al lector | Nada |
| `short_code` | La pantalla muestra un código de seis caracteres para escribir en su propio teléfono | Nada en la cabina |
| `none` | No aparece nada | Nada |

Reglas que hacen que esto sea seguro en un lugar público:

1. **Efímero.** El enlace expira en `customer.handoffTtlSec` (por defecto 180 s) o al terminar la sesión, lo que ocurra primero.
2. **Rotativo.** Mientras está en pantalla, el token se regenera cada `customer.handoffRotateSec` (por defecto 30 s). Una foto de la pantalla tomada por alguien más queda inservible en segundos.
3. **Un solo uso.** Al consumirse pasa a `linked` y el token deja de servir.
4. **Sin datos personales.** El enlace transporta un identificador opaco. Nunca nombre, correo ni teléfono. Si un proveedor externo llegara a necesitarlos, eso es consentimiento aparte (requisito 23.3) y no vive en la cabina.
5. **Se borra con las fotos.** El enlace sigue la misma política de retención que la sesión y desaparece con ella.
6. **No es una cuenta.** No hay registro, no hay perfil, no hay contraseña que recuperar. Es un pase de sala, no una credencial.
7. **Sólo cuando aporta.** La función `customer.handoff` está apagada salvo que la máquina ofrezca algo que la necesite; el recorrido anónimo no cambia.

El panel técnico conserva su PIN local, que es otra cosa: identifica a un operador, no a un cliente, y está detrás de un gesto oculto.

## Consecuencias

- El recorrido feliz sigue siendo anónimo y sin pasos añadidos.
- La membresía del Club se identifica sin cuenta, sin contraseña y sin teclear.
- El mecanismo no presupone nada sobre la entrega digital, que es una decisión abierta con su propia restricción en `docs/producto/02-decisiones-abiertas.md`.
- Los cupones y membresías del anfitrión se leen con la cámara que la cabina ya tiene.
- Una identidad persistente de consumidor, si algún día existe, se construye del lado del teléfono y nunca dentro de la cabina.
- La pantalla se limpia entre clientes por diseño, no por disciplina del operador.
