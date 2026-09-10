# Cómo trabajan las fotocabinas de Corea, Japón y China

Investigación con fuentes, hecha para esta campaña. Es material de referencia: dice qué hacen ellas y qué haría nuestra cabina con eso. Lo que manda sobre esto es [ENCARGO.md](ENCARGO.md) y las restricciones permanentes.

## Cierre y gestión de la fila

### Entrega offline real: dos QR encadenados (unirse a la red + descargar)

El único método probado para entregar archivos desde un aparato SIN internet es que el propio aparato levante una red Wi-Fi local sin salida a internet y sirva los archivos por HTTP local. LumaBooth/dslrBooth lo documenta como flujo de dos códigos: QR #1 hace que el teléfono se una a la red local (formato estándar del Wi-Fi Alliance `WIFI:T:WPA;S:<ssid>;P:<pass>;;`, soportado nativamente por la cámara de Android 10+ desde sept 2019 y iOS 11+ desde sept 2017, sin app), QR #2 abre la URL local con el archivo. Advertencia explícita de la fuente: el Wi-Fi del local NO sirve porque aísla dispositivos entre sí; tiene que ser una red que levante el propio equipo.

**Qué hace nuestra cabina con esto.** La pantalla de cierre (apps/kiosk/src/screens/Finish.tsx) muestra los dos QR uno al lado del otro, numerados 1 y 2, gigantes (mínimo 260px de lado a 1.5 m), sobre fondo blanco puro con quiet zone, NUNCA encima de la foto. El SSID y la contraseña salen del bundle de configuración, no del código. El texto va por i18n. El segundo QR apunta a `http://192.168.x.x/s/<token>` servido por el propio Android. Si el teléfono ya se unió (detectable por el primer GET al servidor local), el QR #1 se apaga solo y el #2 crece a pantalla completa: un solo objetivo. Fallback visible siempre: número de 6 dígitos grande para teclear a mano en un segundo aparato o para que el operador lo recupere.

*Fuente:* https://support.lumasoft.co/en/articles/12831756-offline-qr-code-sharing y https://scanapp.org/blog/2026/06/01/how-to-connect-to-wifi-by-scanning-a-qr-code.html

### El resultado se calcula MIENTRAS la persona ya está escaneando, nunca antes

En las cabinas coreanas la máquina imprime las dos tiras al mismo tiempo que la persona escanea el QR: el usuario nunca ve una barra de progreso vacía. La espera existe pero está tapada por una tarea que la persona quiere hacer. El artículo de Photoism resume el ritual completo de recogida digital en 'unos dos minutos' hechos ahí mismo, en la misma sesión.

**Qué hace nuestra cabina con esto.** Invertir el orden actual de Print.tsx/Finish.tsx: en cuanto la persona confirma la selección, se genera PRIMERO el token y la URL local (instantáneo, no depende del render) y se pinta la pantalla de QR. El compositor de la foto final en alta resolución corre en un worker por detrás. El QR ya es válido: el servidor local responde 'listo en un momento' y hace auto-refresh cuando el archivo aterriza. Nunca mostrar Spinner.tsx a pantalla completa como pantalla de cierre. Si el render tarda más de lo esperado, la persona ya se llevó el enlace y puede irse.

*Fuente:* https://daebak.co/blogs/magazine/korean-photo-booth-life4cuts y https://scanapp.org/blog/2026/05/24/scanning-photoism-qr-codes-retrieve-photos-and-videos.html

### El video de la sesión vale más que la foto y no cuesta papel

Photoism entrega, junto a las fotos, un clip MP4 grabado dentro de la cabina durante la sesión. No requiere app ni contraseña: la URL misma es la autenticación. Es el gancho que hace que la gente escanee el QR aunque ya tenga la tira física en la mano. Las cabinas chinas de mall también entregan 'versión digital y videoclip' por QR.

**Qué hace nuestra cabina con esto.** Como no hay papel, el video ES el producto diferencial. Grabar los ~15 s del recorrido (las cuentas regresivas, las poses fallidas, las caras entre disparo y disparo) a 640x360 —la misma resolución que ya usa el análisis a 15 fps, sin coste extra de captura— y entregarlo como MP4 corto en el mismo enlace local. En Finish.tsx el video se reproduce en bucle DETRÁS de los QR: es la prueba visible de que hay algo más que fotos esperando del otro lado. No aplica al recorrido documental.

*Fuente:* https://scanapp.org/blog/2026/05/24/scanning-photoism-qr-codes-retrieve-photos-and-videos.html y https://www.jiemian.com/article/14382779.html

### El tiempo de edición se acorta solo cuando hay gente esperando

En purikura el límite de garabateo depende de la ocupación: si hay alguien esperando el tiempo es más corto, si no hay nadie es más largo. FURYU llevó esto más lejos en 'WataUsa' (jun 2024) con una función de salto que recorta hasta 4 minutos del tramo de edición, y el tramo clásico de garabateo ronda los 200 segundos con un aviso alrededor de los 50 s.

**Qué hace nuestra cabina con esto.** El presupuesto de tiempo del tramo creativo se convierte en variable de configuración con dos valores (holgado / apretado), no en una constante del código. La cabina no tiene sensor de fila, pero sí sabe si hubo interacción en la pantalla de atracción en los últimos 60 s: si alguien tocó o se acercó mientras la sesión estaba en curso, entra el presupuesto apretado. TimeoutBar.tsx ya existe: se le pasa el presupuesto vigente. Nunca anunciar 'hay gente esperando' (es agresivo con quien está dentro); simplemente la barra dura menos.

*Fuente:* https://thestandardjapan.com/culture/purikura-guide y https://www.furyu.jp/news/2024/05/watausa/

### Decidir ANTES de entrar libera la máquina, decidir DENTRO la bloquea

Las purikura modernas ponen el menú de configuración (número de tomas 1-12, segundos de cuenta regresiva 5/10/15, si quieres garabatear o no) en una pantalla ANTES de entrar al aparato. Y arquitectónicamente separan el cubículo de disparo del puesto de edición: la persona sale del lado de disparo y pasa a un segundo puesto, dejando el cubículo libre para el siguiente grupo. Suelen editar 2 personas a la vez en puestos distintos.

**Qué hace nuestra cabina con esto.** No tenemos gabinete ni segundo puesto, así que la separación tiene que ser TEMPORAL, no física: todo lo que sea decisión (recorrido, número de tomas, estilo) va antes de que la cámara se encienda, en Home/ProductDetail, y el tramo con cámara viva se protege como el recurso escaso. Regla dura: una vez encendida la vista previa, ninguna pantalla nueva puede pedir una decisión de catálogo. Si el negocio quiere throughput, la palanca es recortar el tramo posterior al disparo, no el disparo.

*Fuente:* https://www.furyu.jp/news/2024/05/watausa/ y https://thestandardjapan.com/culture/purikura-guide

### '¿Sigues ahí?' con 30 segundos, y el dinero nunca se evapora

El patrón establecido de kiosco: temporizador de inactividad que reinicia al flujo de atracción, precedido de un diálogo tipo 'Your order will be cancelled in 30 seconds'. Y la regla crítica del abandono con dinero de por medio: si ya se metió dinero NO se puede reiniciar sin más, hay que dar crédito parcial y aviso extra. Además hay que BLOQUEAR la navegación hacia atrás una vez empezado el pago, para que el siguiente cliente no pueda aprovechar el crédito ni ver la transacción del anterior. Sparkbooth usa timeouts de prompt de ~1 minuto justo para el caso de 'el invitado se fue después de la foto'.

**Qué hace nuestra cabina con esto.** Dos temporizadores distintos, no uno. (a) Antes del cobro: 45 s de inactividad → aviso de 15 s con la forma orgánica de la marca despidiéndose → vuelta a Attract.tsx. (b) Después del cobro: NUNCA se cancela solo. Si hay inactividad, la sesión queda 'guardada' y la pantalla muestra el QR de recogida junto con el código de 6 dígitos; se conserva en el aparato el tiempo que diga la configuración y se libera la pantalla para el siguiente. Prohibido un botón 'atrás' que reabra una sesión ya pagada de otra persona. Al volver a Attract, borrado explícito e inmediato de todo lo de la sesión anterior en pantalla.

*Fuente:* https://www.kioskmarketplace.com/blogs/kiosk-idle-timeout-what-happens-when-they-walk-away/ y https://kb.sparkbooth.com/article/347-enabling-prompt-timeouts

### El modo de fallo dominante no es técnico, es 'la máquina falló y nadie responde'

El estudio del Instituto Coreano del Consumidor (KCA) sobre estudios fotográficos de autoservicio contabilizó 31 quejas formales entre ene-2019 y jul-2023 con este reparto: incumplimiento por avería de la máquina 17 casos (54.8%), cobro duplicado 5 casos (16.1%), saldo no devuelto o pago no cancelable 3 casos (9.7%). Y por encima de todo: 20 casos (64.5%, motivo concurrente) eran que el operador no contestaba o directamente no había ningún dato de contacto en la cabina.

**Qué hace nuestra cabina con esto.** Tratar 'a quién llamo' como requisito de producto, no como letra chica. La pantalla de cierre y la de error (Error.tsx / ErrorPanel.tsx) llevan siempre, en tamaño legible a 1.5 m, el identificador corto de la máquina y el canal de contacto —ambos desde el bundle de configuración, jamás escritos en el código de la UI. Y contra el cobro duplicado: la sesión tiene un identificador idempotente, un segundo toque en el botón de pago no puede generar un segundo cargo, y el resultado del cobro se muestra con estado explícito (StatusPill.tsx), nunca ambiguo.

*Fuente:* https://www.dbpia.co.kr/journal/voisDetail?voisId=VOIS00740116 (informe KCA, vía https://www.hankyung.com/article/202311238906g)

### Una máquina averiada debe rechazar el dinero ANTES de aceptarlo

En la industria de vending, cuando la disponibilidad cae por debajo del 98% los clientes dejan de meter billetes y reportan el equipo como roto: la confianza se pierde antes que el dinero. La recomendación de UI de kiosco es lenguaje llano, no códigos, y consejo accionable: un mensaje que solo diga 'Error' no basta, hay que decir qué puede hacer la persona. Los fabricantes coreanos ya venden monitoreo remoto que avisa al teléfono del dueño cuánto papel queda y cuánto se ha recaudado, sin que nadie esté ahí.

**Qué hace nuestra cabina con esto.** Chequeo de salud ANTES de mostrar precio: cámara disponible, espacio en disco suficiente para N sesiones, servidor local levantado, cobro respondiendo. Si algo falta, la pantalla de atracción NO ofrece empezar: se convierte en una pantalla honesta y con la personalidad de la marca ('ahorita no puedo, ya vengo'), con la familia de formas orgánicas en modo dormido y el contacto del operador visible. Nunca dejar cobrar para fallar después. El equivalente a 'sin papel' aquí es 'sin espacio en disco': se vigila igual y se alerta al mismo umbral, con el margen definido en configuración.

*Fuente:* https://vmfsusa.com/blogs/business/common-vending-machine-issues-and-fixes , https://kiosk.com/kiosk-ui/ y https://photos-folio.com/

### El ritmo de disparo es 10 segundos por toma, 8-10 tomas, eliges 4, con voz

Consistente en todas las guías: la cabina dispara cada 10 segundos, se capturan 8-10 encuadres y la persona elige sus 4 favoritos. Hay cuenta regresiva por voz antes de cada disparo. FURYU permite configurar 5, 10 o 15 segundos, pero solo cuando se disparan 5 encuadres o menos. Tiempo total de entrada a salida: 5-8 minutos en Corea.

**Qué hace nuestra cabina con esto.** Fijar 10 s como el ritmo por defecto en configuración y NO exponerlo como opción a la persona. Countdown.tsx tiene que ser legible a 1.5 m de pie: el número ocupa una fracción grande de la pantalla y cambia de color de acento en cada segundo, recorriendo los seis colores vivos --psp-color-accent-1..6. Los 10 s son suficientes para cambiar de pose pero se sienten eternos si la pantalla está muerta: ahí es donde entra el carácter de la marca (la forma orgánica reacciona, no la cuenta sola). Capturar más de lo que se entrega (p. ej. 8 → elegir 4) es lo que hace que la gente sienta que ganó algo.

*Fuente:* https://creatrip.com/en/blog/13797 , https://daebak.co/blogs/magazine/korean-photo-booth-life4cuts y https://www.furyu.jp/news/2024/05/watausa/

### La caducidad del enlace es el punto de mayor frustración documentado, y las cifras se contradicen

Life4Cuts: 3 días incluyendo el día de la toma, después de eso las fotos del servidor se descartan automáticamente y ya no se pueden recuperar. Guías de viaje sobre la misma marca dicen que el QR impreso 'deja de ser válido a las 24 horas'. Photoism: 'la mayoría de las descargas caducan en siete días', con el rango real observado entre 24 y 72 horas. Pictlink (Japón): exactamente 1 semana desde la toma. Nadie sabe cuánto tiene realmente, y hay contenido en redes dedicado a '¿qué hago si se me pasó el plazo?'.

**Qué hace nuestra cabina con esto.** Aquí la ventaja estructural es enorme y hay que gritarla: las fotos NUNCA salen de la máquina, así que no hay servidor que las borre en 3 días. La pantalla de cierre dice, en una sola línea por i18n, exactamente cuánto tiempo vive el enlace y en dónde vive: es una ventana corta (minutos, no días, porque es la red local del aparato) y hay que decirlo sin eufemismo, con un temporizador visible. Decir 'te quedan 4 minutos para escanear' es honesto y crea urgencia útil; decir 'descarga después' sería mentira. Y el borrado al terminar es una promesa de privacidad que se puede mostrar.

*Fuente:* https://lifefourcuts.com/QR_Code (vía búsqueda), https://creatrip.com/en/blog/13797 , https://scanapp.org/blog/2026/05/24/scanning-photoism-qr-codes-retrieve-photos-and-videos.html y https://sp.pictlink.com/sp/help/answer?helpApp=pictlink_web&helpItemId=25

### El QR pequeño, sobre superficie brillante y mal contrastado es la causa nº1 de que la entrega falle

Los fallos de escaneo de Photoism vienen de tres cosas concretas: el papel brillante genera reflejo, el código impreso es diminuto, y la calibración de la impresora lo deja desalineado o borroso. Es un fallo de la última pulgada: todo el producto funcionó y la entrega se cae al final.

**Qué hace nuestra cabina con esto.** Nuestro QR es en pantalla, así que heredamos los mismos enemigos en versión digital: brillo del monitor bajo luz de mall, reflejos, y sobre todo el impulso de diseño de poner el QR encima de la foto o sobre un fondo de color de marca. Regla dura: el QR va sobre un rectángulo blanco puro con margen (quiet zone) de al menos 4 módulos, corrección de error alta, tamaño mínimo 260 px de lado, nunca sobre imagen ni sobre --psp-color-accent-*, nunca con animación debajo. La marca vive alrededor del QR, no dentro. Y subir el brillo de la pantalla al máximo en la pantalla de entrega.

*Fuente:* https://scanapp.org/blog/2026/05/24/scanning-photoism-qr-codes-retrieve-photos-and-videos.html

### La atracción se hace con el trabajo de otros, no con un logo

En las cabinas coreanas la gente que espera revisa las tiras que otras personas dejaron pegadas en la pared, buscando inspiración de poses; los locales ponen espejos, planchas de pelo, cepillos y accesorios para que la espera sea productiva. Es lo que convierte la fila en parte de la experiencia en vez de tiempo muerto. Las colas son reales: más de 20 minutos en Hongdae viernes y sábado, hasta 30 minutos en malls chinos, y 1-3 horas en los estudios de moda de Shanghái.

**Qué hace nuestra cabina con esto.** No podemos exponer caras de terceros (las fotos no salen de la máquina y sería una violación de privacidad). El equivalente honesto: Attract.tsx en bucle mostrando (a) la familia de seis formas orgánicas con cara posando —cada una con su carácter, en los seis colores vivos juntos— demostrando las poses, y (b) muestras generadas de los efectos aplicados a modelos ficticios que vienen empaquetados en el bundle. La pantalla de atracción tiene que verse a 5 metros de distancia y leerse como un juguete, no como un formulario: movimiento constante pero lento, colores rotando, cero texto corporativo. Es la única publicidad que la cabina tiene.

*Fuente:* https://creatrip.com/en/blog/13797 y https://www.jiemian.com/article/14382779.html

### El throughput real del negocio fija el presupuesto de segundos de la interfaz

Cifras de operación en China: 40-50 sesiones al día en fin de semana en ubicación normal, más de 100 sesiones en fin de semana en ubicación prima, con colas de hasta 30 minutos. Precio 29.9-49.9 RMB. Facturación 20.000-30.000 RMB al mes con margen bruto de hasta 50%. En Corea el rango es 4.000-6.000 KRW por dos tiras. La sesión completa: 5-8 min en Corea, ~10 min de promedio en Japón (hasta 15-20 con retomas y decoración), 3-5 min hasta que sale la foto en las máquinas compactas chinas.

**Qué hace nuestra cabina con esto.** 100 sesiones en una jornada de 12 h son 7.2 minutos por sesión incluyendo la transición entre personas. Ese es el presupuesto total. Repartirlo explícitamente en configuración y probarlo: atracción→pago ≤60 s, disparo 8 tomas × 10 s = 80 s, selección ≤45 s, efectos ≤60 s, entrega ≤60 s, transición ≤10 s. Suma ~5.5 min y deja margen. Cualquier pantalla nueva que se proponga tiene que decir de qué tramo roba sus segundos. La transición entre personas (borrar todo y volver a atracción) tiene que ser instantánea, por debajo de 1 s: es tiempo puro perdido.

*Fuente:* https://www.jiemian.com/article/14382779.html , https://daebak.co/blogs/magazine/korean-photo-booth-life4cuts y https://insta-reibun.com/purikurananpun/

### AirDrop es la única entrega verdaderamente offline del mercado occidental, y no nos sirve

La industria de cabinas de eventos documenta que AirDrop es instantáneo, funciona con la cabina completamente offline, sin internet y sin pedir datos de contacto. Pero solo funciona con aparatos Apple y exige proximidad física. El QR clásico de esas cabinas, en cambio, lleva a un sitio web donde el invitado teclea su correo o teléfono para recibir la foto: eso requiere internet Y recolecta datos personales.

**Qué hace nuestra cabina con esto.** Confirma que nuestro camino es el correcto y descarta los dos atajos: (a) AirDrop no aplica en un mall mexicano sobre Android; (b) el QR-con-formulario-de-correo está doblemente prohibido (necesita internet y pide datos personales, cuando el producto se vende como 'sin cuenta, sin contraseña'). El servidor local en el propio Android con doble QR es la única opción que cumple las tres restricciones a la vez: offline, sin cuenta, multiplataforma.

*Fuente:* https://support.photoboothsupplyco.com/hc/en-us/articles/35621889502093-AirDrop-and-QR-Code y https://www.simplebooth.com/blog/event-photo-sharing-with-qr-code-photo-booth/

### La velocidad del documental es de 20 segundos y no admite adornos

En las máquinas chinas de foto de identificación de autoservicio, tras confirmar la foto salen 12 fotos de una pulgada en unos 20 segundos, y la persona puede repetir la toma cuantas veces quiera antes de confirmar. La interfaz guía por voz y ajusta la altura del asiento. Es un flujo funcional, medido y sin decoración.

**Qué hace nuestra cabina con esto.** Refuerza la restricción de que documental y creativo no se mezclan, y da la vara de medir: en el recorrido documental el ciclo repetir→confirmar tiene que ser tan barato que la persona repita sin miedo, y CompareView.tsx / CriteriaList.tsx tienen que decir por qué una toma no pasa (fondo, encuadre, ojos) en lugar de solo rechazarla. La dirección visual llamativa —colores vivos rotando, formas con cara, movimiento— se queda fuera de este recorrido: aquí la marca aparece solo en el marco de la pantalla, nunca sobre la foto ni alterando su fidelidad.

*Fuente:* https://zhuanlan.zhihu.com/p/87654403 y http://www.gzhtinfo.com/article_read_704.html

### El dueño se entera del fallo por el teléfono, no por un cliente enojado

Los fabricantes coreanos venden el servicio en la nube como argumento principal: 'no tienes que estar ahí para ver si la cabina funciona, cuánto papel queda, cuánto dinero ha entrado', con notificaciones push al teléfono. La industria de vending confirma que el monitoreo remoto reduce visitas de camión y corta el tiempo caído avisando al operador antes de que el cliente lo note.

**Qué hace nuestra cabina con esto.** La cabina está offline por diseño, así que el reporte de salud no puede ser en tiempo real, pero sí acumulativo: el agente de estación (apps/station-agent) mantiene un archivo de salud local —sesiones completadas, sesiones abandonadas tras el cobro, fallos de cámara, espacio en disco, enlaces nunca recogidos— que se sincroniza cuando la máquina toque una red durante mantenimiento. Y la pantalla técnica (Tech.tsx) debe poder mostrar ese resumen al operador con un gesto oculto, sin sacar la cabina de servicio ni exponerlo al público.

*Fuente:* https://photos-folio.com/ y https://optconnect.com/applications/vending/

### La persona que se va sin recoger es un caso normal, no un error

Sparkbooth incluye un timeout de prompt configurable (ejemplo documentado: 1 minuto) precisamente para 'el caso en que los invitados se van después de tomarse la foto', y su propósito declarado es dejar la cabina lista para el siguiente. Es decir: la industria asume que abandonar a medias es comportamiento esperado y lo diseña, no lo trata como excepción.

**Qué hace nuestra cabina con esto.** Nombrar el estado 'sesión huérfana' en el modelo de la máquina de estados (apps/kiosk/src/session) con reglas propias: la foto sigue viva en el aparato durante la ventana configurada, la pantalla se libera de inmediato, y si la persona vuelve puede recuperarla desde la atracción con el código de 6 dígitos sin volver a pagar. Al vencer la ventana se borra de verdad y queda solo el contador en el archivo de salud. Esto convierte el peor momento del producto (pagué y me quedé sin nada) en algo recuperable sin operador presente.

*Fuente:* https://kb.sparkbooth.com/article/347-enabling-prompt-timeouts

### Cifras

- Ritmo de disparo: 1 foto cada ~10 segundos; 8-10 encuadres capturados; la persona elige 4 (Corea)
- Cuenta regresiva configurable en purikura: 5, 10 o 15 segundos, y solo si se disparan 5 encuadres o menos; tomas seleccionables de 1 a 12 (FURYU 'WataUsa', jun 2024)
- Tramo de garabateo clásico en purikura: ~200 segundos (3 min 20 s), con una pausa/aviso alrededor de los 50 segundos
- Función de salto de FURYU 'WataUsa': recorta hasta 4 minutos del tramo de edición; sesión completa posible en 5 minutos
- Sesión completa de entrada a salida: 5-8 minutos (Corea); ~10 minutos de promedio y hasta 15-20 con retomas y decoración (Japón); 3-5 minutos hasta que sale la foto (máquinas compactas chinas); 15 minutos por cliente (estudio de autoservicio de Shanghái)
- Caducidad del enlace digital: 3 días incluyendo el día de la toma (Life4Cuts, después las fotos se descartan del servidor); 24 horas (QR impreso de Life4Cuts según guías); 24-72 horas típico y 'la mayoría en 7 días' (Photoism); exactamente 1 semana (Pictlink, Japón)
- Pictlink (Japón): 1 imagen gratis por sesión para socio gratuito; suscripción 330 yenes/mes versión web y 450 yenes/mes versión app
- Precios de referencia: 4.000 KRW por 2 tiras, 8.000 por 4, 12.000 por 6 (Corea); 6.000 KRW por 1 copia en algunas cabinas; 29,9-49,9 RMB por sesión (mall chino); 199-299 RMB (estudio de autoservicio de Shanghái); 69 RMB por CD personalizado
- Throughput chino: 40-50 sesiones/día en fin de semana en ubicación normal; más de 100 sesiones/día en ubicación prima; 60+ en festivo
- Economía china: 20.000-30.000 RMB de facturación mensual en ubicación no prima; más de 10.000 RMB de utilidad neta mensual en ubicación prima; margen bruto de hasta 50%; superficie 1-2 m²
- Colas observadas: más de 20 minutos viernes/sábado en Hongdae (Seúl); hasta 30 minutos en pico (mall chino); 1-3 horas en fin de semana (estudio de autoservicio de Shanghái)
- Quejas formales ante el KCA (Corea) sobre estudios fotográficos de autoservicio, ene-2019 a jul-2023: 31 casos totales — avería de la máquina 17 (54,8%), cobro duplicado 5 (16,1%), saldo no devuelto / pago no cancelable 3 (9,7%); 64,5% (20 casos, motivo concurrente) por no poder contactar al operador o no existir dato de contacto
- Mercado coreano: más de 50 marcas de estudio de autoservicio y más de 1.000 locales en el país
- Umbral de confianza en vending: por debajo de 98% de disponibilidad los clientes dejan de meter dinero y reportan la máquina como rota
- Timeout de kiosco: diálogo de aviso de 30 segundos antes de cancelar ('se cancelará en 30 segundos'); timeout de prompt de ~1 minuto para el invitado que se fue (Sparkbooth)
- Soporte nativo de QR de Wi-Fi (formato WIFI:T:WPA;S:...;P:...;;) sin app: iOS 11+ desde septiembre 2017, Android 10+ desde septiembre 2019
- Foto de identificación en máquina china de autoservicio: 12 fotos de 1 pulgada impresas en ~20 segundos tras confirmar
- Photoism entrega por QR: copias digitales en alta calidad + un clip MP4 de la sesión, sin app y sin contraseña (la URL es la autenticación); recogida completa en ~2 minutos hechos en la misma sesión

### Lo que sería un error copiar

- Poner la copia digital detrás de una app, una cuenta o una suscripción. Pictlink cobra 330-450 yenes al mes y regala solo 1 imagen por sesión: es el punto más odiado del modelo japonés y contradice frontalmente la promesa 'sin app, sin cuenta, sin contraseña'. Nuestra persona llega caminando y se va en 6 minutos; no va a instalar nada.
- Un QR que apunte a un servidor en la nube con caducidad de 24 horas a 7 días. No tenemos conexión, así que ni siquiera es posible; y aunque lo fuera, el propio ecosistema asiático demuestra que nadie sabe cuánto plazo tiene (3 días, 24 h, 72 h, 7 días según la marca) y eso genera un género entero de contenido de gente que perdió sus fotos.
- Depender de AirDrop como canal de entrega. Es la única entrega offline instantánea del mercado, pero es exclusiva de aparatos Apple. En un mall mexicano con una base mayoritaria de Android sería dejar a la mitad de la gente sin su foto.
- El QR con formulario: escanear y luego teclear correo o teléfono para 'recibir' las fotos. Requiere internet y recolecta datos personales de alguien que solo quería una foto. Doblemente incompatible con nuestras restricciones.
- Los 200 segundos de garabateo y las sesiones de 15-20 minutos. Funcionan en un local dedicado de Shibuya o de Hongdae, donde la fila es parte del ritual y la gente va con tiempo. En un pasillo de plaza comercial, con alguien esperando detrás y sin gabinete que aísle, esa duración mata la máquina.
- El menú de configuración previo de FURYU (elegir entre 1 y 12 tomas, entre 5, 10 y 15 segundos de cuenta regresiva, si quieres garabatear o no, si quieres editar el diseño). Es un panel de control para clientes expertos que ya conocen la máquina. Nuestra persona nunca la ha visto y está de pie: cada opción es un toque de más y una duda de más. Las constantes se fijan en configuración, no se le preguntan a nadie.
- El muro con las tiras que dejaron otras personas. Es un mecanismo de atracción brillante en Corea, pero exhibe caras reales de terceros. Nuestra promesa es que las fotos nunca salen de la máquina; convertir la pantalla en una galería de clientes anteriores la rompería. La inspiración de poses tiene que venir de la familia de formas de la marca y de modelos ficticios empaquetados.
- Aceptar el pago y descubrir el fallo después. Es el 54,8% de las quejas formales en Corea. El chequeo de salud va antes del precio: si la máquina no puede cumplir, la pantalla de atracción no debe ofrecer empezar.
- La cabina sin identidad ni forma de contacto. El 64,5% de las quejas coreanas incluyen 'no pude localizar al operador' o 'no había ningún dato de contacto'. Una cabina sin identificador de máquina visible y sin canal de contacto en la pantalla de cierre y en la de error es un producto incompleto, por bonito que se vea.
- El mensaje de error genérico o con código técnico. 'Error' o 'E18' no le dice nada a alguien de pie que ya pagó. La guía de UI de kioscos es explícita: lenguaje llano y una acción concreta que la persona pueda ejecutar.
- La cortina negra y el cubículo cerrado sin señal de estado hacia afuera. Es exactamente lo contrario de lo que se pidió: la cabina tiene que llamar la atención desde lejos. Sin gabinete todavía, toda la atracción vive en la pantalla, así que una pantalla estática o un logo fijo desperdicia el único activo de convocatoria que tenemos.
- Aplicar la dirección visual creativa —colores vivos rotando, formas con cara, movimiento— al recorrido documental. La foto de trámite se rechaza por fidelidad, no por estilo; ahí el trabajo de la marca es solo el marco de la pantalla y una explicación clara de por qué una toma no pasa.
- El QR pequeño, sobre la foto o sobre un fondo de color de marca. Los fallos de escaneo documentados en Photoism vienen justo de ahí (código diminuto, superficie con reflejo, contraste pobre). Es perder el producto entero en la última pulgada por una decisión estética.

## Atracción y exterior

### La pantalla en reposo es un canal publicitario, no un salvapantallas

Los fabricantes coreanos de photo-kiosks venden el equipo con una consola de gestión cuyas funciones incluyen literalmente 'gestión de video publicitario' (광고영상관리) y 'monitoreo de pantalla del kiosco'. El estado de reposo reproduce video en bucle y el usuario entra tocando un botón 'Empezar' (시작하기) sobre monitor vertical. En el mundo del photo booth occidental el mismo objeto se llama 'attract screen / attract loop' y es un .mp4 con sufijo _loop.

**Qué hace nuestra cabina con esto.** Nuestro estado ATRACCIÓN es una pantalla de primera clase con su propia ruta y su propio presupuesto de diseño, no un fallback del idle. Pero NO puede ser un mp4: sin conexión y en Android de gama media un video de 1080x1920 pesa decenas de MB por marca y no se puede re-colorear por bundle. Debe ser un bucle PROCEDURAL: SVG/CSS animado con los tokens --psp-color-accent-1..6, que cada marca viste sin re-exportar assets. Un solo componente AttractScreen, cero archivos de video en el APK.

*Fuente:* https://www.yubi.co.kr/www/kiosk_photo/photo2/produce y https://photoboothgraphics.com/animated-screens-setup/

### Tienes menos de un segundo, no diez

La industria de señalización asume 1.5–4.6 s de atención plena a 'glance media'. Un experimento con cámara en una tienda real midió que sólo el 35% de las personas miraron la pantalla, con un dwell promedio de 0.7–0.9 s. El contenido dinámico atrae 1.5 veces más que el estático. Para pasillos de tránsito rápido la recomendación es bucle de 30–90 s (colas y elevadores 60–180 s).

**Qué hace nuestra cabina con esto.** El bucle de atracción se diseña como una secuencia de 'beats' de 6–10 s donde CUALQUIER ventana de 1 segundo ya comunica las tres cosas: esto es una cabina de fotos, cuesta X, se toca aquí. Nada de una animación narrativa que sólo tiene sentido si la ves entera. Bucle macro objetivo 45–60 s con 5–6 beats, no 10 minutos de arcade. Y movimiento SIEMPRE presente: aunque el beat sea tipográfico, algo se mueve en pantalla (un blob que respira, un campo de color que deriva). Con prefers-reduced-motion el movimiento se reemplaza por cortes suaves entre beats cada 6 s, no por una imagen fija.

*Fuente:* https://screencloud.com/digital-signage/importance-of-dwell-time y https://signagetube.com/blog/digital-signage-content-strategy-ideas-practical-guidelines/

### El imán más fuerte y más barato es verte a ti mismo

Los mirror photo booths se venden justo por eso: 'el espejo grande atrae la atención sin ser ruidoso, la gente camina hacia allá naturalmente'. Las tiendas coreanas ponen espejos en la sala de espera y en el pasillo entre máquinas; los arcades japoneses también. Los AR mirrors de retail se comercializan explícitamente como 'detener al que pasa y guiarlo a la tienda'.

**Qué hace nuestra cabina con esto.** Este es nuestro diferenciador estructural y no cuesta hardware: LA CÁMARA YA ESTÁ ADENTRO. El beat más largo del bucle de atracción es el espejo vivo: preview espejado a pantalla completa, sin recorte de cara, sin grabar nada. Encima, los seis acentos reaccionan (un halo de color que sigue la silueta, o el marco que cambia de acento cuando detecta una persona). Cabe en el presupuesto: el análisis ya corre a 15 fps sobre 640x360 y sólo necesitamos presencia/silueta, no identidad. Requisito duro de privacidad: leyenda permanente y honesta de que no se guarda nada, y el espejo se apaga solo si nadie se acerca en N segundos.

*Fuente:* https://staygoldenphotobooth.com/guide-to-mirror-photo-booth/ y https://ffface.me/armirror/

### Caras que miran, y luego miran hacia donde tú tienes que mirar

Investigación de eye-tracking: las caras capturan atención, y además la señal social de la mirada redirige la atención del observador. Banners con caras de mirada desviada aumentaron la atención al banner completo, al texto y al producto frente a otras condiciones. En purikura, la pantalla muestra modelos demostrando la pose que debes imitar.

**Qué hace nuestra cabina con esto.** Los seis BlobFace no son decoración: son el mecanismo de dirección de mirada. En el bucle, los blobs primero miran al frente (a la persona que pasa) y en el beat siguiente giran los ojos hacia el precio y hacia el botón de inicio. BlobFace.tsx ya tiene ojos parametrizados (eyes: {x,y,gap}) y seis expresiones: falta un prop de dirección de mirada para animarla. Y en el paso de pose, en vez de texto instructivo, el blob HACE la pose (silueta + brazos) — instrucción sin idioma, que es exactamente lo que necesita alguien que no lee el letrero.

*Fuente:* https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3941030/ y https://livejapan.com/en/article-a0000752/

### El precio es el titular, no la letra chica

El modelo asiático es de precio único memorizable y publicado: Corea ₩4,000 por dos tiras (₩8,000 por cuatro, ₩12,000 por seis), Japón ¥400 de fábrica en el fiz de SEGA, China 39 yuanes marco clásico y 69 yuanes marco con licencia, con rango de 29.9–49.9. El precio es lo que convierte 'qué es eso' en 'va, cuesta lo mismo que un café'.

**Qué hace nuestra cabina con esto.** El precio va en el bucle de atracción a escala tipográfica de titular (numeral dominante ocupando ~1/3 del alto útil de una pantalla vertical), no en una tarjeta ni en un pie. Viene de bundle/i18n, nunca escrito en el código de UI, y el formato de moneda por locale. Regla de diseño: el numeral es lo segundo que se lee después del espejo, y no compite con nada más en su beat.

*Fuente:* https://www.koreaherald.com/article/10503226 y https://www.sega.jp/topics/detail/201008_2/

### El resultado terminado se exhibe antes de comprar

En los locales chinos las paredes del pasillo tienen espejos y tableros con fotos impresas de clientes; el escaparate se marca con 'letreros luminosos brillantes' (闪亮的灯牌). Las máquinas coreanas exhiben fotos de muestra por fuera y una pantalla con los marcos disponibles. En arcade, la regla de attract mode es mostrar el momento más espectacular del juego, no el menú.

**Qué hace nuestra cabina con esto.** Un beat del bucle es la 'pared de resultados': composiciones terminadas cayendo/apilándose en pantalla, cada una con distinto acento y distinto encuadre. Restricción: sin papel y sin fotos de clientes reales — se usa un set de retratos demo empaquetados con la app (los del dataset demo), rotando de forma determinista, y jamás una foto de una persona que usó la cabina. Es la prueba de producto que hoy no existe: la persona ve el ANTES/DESPUÉS sin pagar.

*Fuente:* https://m.thepaper.cn/newsDetail_forward_30200123 y https://arcadeheroes.com/2014/05/29/great-arcade-attract-modes-dont-drive-you-crazy/

### El color es una habitación, y las marcas se distinguen por el tono, no por el logo

DON'T LXXK UP tiene cuartos rojo, azul y gris oscuro más un cuarto rosa estacional; Haru Film se identifica por su fondo y tono azul cielo; Life Four Cuts usa fondos 'rojo, morado, amarillo, brillantes y saturados'; Sihyunhada tiene cinco sucursales con paletas distintas para incentivar visita tipo coleccionista. Photoism en China ofrece fondos negro y gris.

**Qué hace nuestra cabina con esto.** Los seis acentos no son seis colores de acento sobre crema: son SEIS MODOS, cada uno con su fondo a sangre completa. El fondo crema (--psp-color-*) queda para el recorrido documental, no para el social. Cada beat del bucle cambia el campo de color completo, lo que hace que la pantalla funcione como fuente de luz cambiante y se vea de lejos como cambio de color, no como cambio de contenido. Y la elección de 'look' en el recorrido se presenta como elegir habitación de color, con BlobFace 1..6 emparejado a accent-1..6.

*Fuente:* https://creatrip.com/en/news/13797 y https://www.kukinews.com/article/view/kuk202303280086

### La sesión completa dura de 3 a 5 minutos, y el ritmo está publicado en la pantalla

Corea: 8–10 tomas cronometradas a ~10 s cada una, se eligen 4, cuenta regresiva visible 3-2-1, sesión total 3–5 minutos (otras fuentes: ~5 s entre tomas, 4 tomas, 3–4 minutos foto+edición). Japón: 3–5 s por toma, 6–10 tomas, edición ~90 s con tope duro de 180 s, ciclo total 8–10 minutos. China: ~20 minutos por grupo incluyendo selección y vestuario, con impresión en ~30 s.

**Qué hace nuestra cabina con esto.** Nuestro objetivo es el ritmo coreano, no el chino: ≤3 minutos de punta a punta, porque sin papel eliminamos la espera de impresión. Cada paso con límite de tiempo visible usando TimeoutBar, y el reloj de edición con tope duro (60–90 s) que auto-avanza en vez de bloquear. La cuenta regresiva es el momento de mayor energía de todo el producto: pantalla completa, numeral gigantesco, cambio de acento por toma, y el flash de la pantalla como luz de apoyo. Countdown.tsx debe crecer a ese tamaño, no ser un badge.

*Fuente:* https://koreapeek.com/korean-photo-booth-guide/ y https://japan.dezign.jp/popculture/purikura-photo-booth-culture-japan/

### La máquina habla y cuenta en voz alta — pero eso es un arcade, no un mall mexicano

En purikura suena J-pop a volumen alto por bocinas pequeñas y una voz sintética alegre grita '¡Mira a la cámara! 3... 2... 1!'. Es el mecanismo de conducción del flujo y de contagio: la gente de afuera oye la sesión ajena.

**Qué hace nuestra cabina con esto.** Tomamos la función (contagio y conducción) y cambiamos el medio: la instrucción va 100% visual y redundante — numeral, barra, color y blob — porque en una plaza mexicana el audio continuo suele estar restringido por el contrato de local y excluye a personas sordas. Sonido: sólo dos eventos cortos (obturador y '¡listo!'), con volumen configurable por bundle y un modo silencioso que no pierde información. El contagio lo consigue el espejo vivo, que es visual y no necesita permiso de audio.

*Fuente:* https://www.jrpass.com/blog/say-cheese-the-ultimate-guide-to-purikura-japanese-photo-booths

### Los marcos con personaje son el motor de demanda, y la rareza los vuelve colección

En China el marco clásico cuesta 39 yuanes y el marco con IP con licencia 69 yuanes: 77% más caro, y es el que jala. JUST.FOTO lanza colaboraciones con videojuegos y franquicias clásicas; Photoism hace marcos con ídolos K-pop y con personajes virales de YouTube. Photomatic x Slam Dunk usó rareza deliberada: un marco por sucursal y una sola copia impresa, para estimular la colección. Life Four Cuts al renovarse ofreció 21 marcos y 6 filtros.

**Qué hace nuestra cabina con esto.** Sin licencias (riesgo legal y no escala offline), la palanca equivalente es la familia BlobFace: seis personajes con nombre y carácter que la marca sí posee, con marcos/looks propios y un set rotatorio 'de hoy' definido por bundle. La rareza se puede fabricar sin conexión: el set visible depende de la fecha y del id de sucursal, de forma determinista, así que la vitrina cambia sola y nunca es la misma en dos plazas. Y el número de opciones es 6, no 21: nuestra persona está de pie con fila atrás.

*Fuente:* https://m.thepaper.cn/newsDetail_forward_30200123 y https://gogumafarm.kr/z세대를-사로잡는-포토부스-200-활용법/

### El panel es de 300 nits en un pasillo iluminado: el crema desaparece

Los kioscos verticales de 43" que se usan para esto son paneles IPS 1920x1080, brillo típico >300 cd/m², contraste 5000:1, táctil infrarrojo de 10 puntos con vidrio templado de 3 mm. Los malls están iluminados muy por encima de eso.

**Qué hace nuestra cabina con esto.** Razón técnica concreta por la que el resultado actual fue rechazado: crema #F3EEE4 con tarjetas blancas a 300 nits es, desde 4 metros, indistinguible de la pared del pasillo. La regla es contraste de CROMA, no de luminancia: campos de color saturado a sangre, negro #111 sólo como tinta de texto, y prohibido usar el blanco como superficie dominante en el recorrido social. Y ojo con el vidrio de 3 mm más el táctil IR: el objetivo de 64 px de área táctil es el piso, no la meta — en la pantalla de atracción el objetivo táctil es la pantalla entera.

*Fuente:* https://adkiosk88.en.made-in-china.com/product/HwbxTVEvXUkC/China-Floor-Standing-43-Inch-LCD-Touch-Screen-Interactive-Self-Service-Terminal-Kiosk-Photo-Booth.html

### El negocio existe en 2–3 m² y vive del flujo peatonal, no del destino

En China una máquina ocupa 2–3 m², cobra ~30 yuanes, saca fotos en 3–5 minutos, hace 40–50 sesiones diarias normales y 60–100+ en festivo, con margen bruto de ~50% y retorno en 5–8 meses. Se colocan en zonas de alto flujo, típicamente a la entrada del cine. JUST.FOTO supera 2,000 máquinas en 1,600+ ubicaciones; Photoism ya tiene 100+ tiendas en China. En Corea, Life Four Cuts opera ~410 tiendas con 120 millones de visitas acumuladas desde 2017.

**Qué hace nuestra cabina con esto.** Consecuencia de diseño, no de negocio: a 40–100 sesiones diarias, la pantalla de atracción es lo que la plaza ve el 90% del tiempo de operación. Merece más inversión de diseño que cualquier otra pantalla del producto, y debe soportar horas de bucle sin quemar el panel (los campos de color deben derivar de posición, no quedarse estáticos) y sin calentar el dispositivo: animar sólo transform y opacity, jamás filtros ni blur sobre superficie completa.

*Fuente:* https://www.jiemian.com/article/14382779.html y https://www.koreaherald.com/article/10503226

### La regla de secuencia del attract mode arcade: esencia, repetir la señal más fuerte, dejar que la curiosidad haga el resto

El attract mode nace para competir en un ambiente ya ruidoso y brillante; el diseñador escoge lo que corta el ruido. La secuencia es mostrar la esencia, repetir las señales más fuertes y dejar que la curiosidad jale. Muchos incluyen un tutorial no interactivo, ligero, para bajar la fricción y la ansiedad del jugador nuevo.

**Qué hace nuestra cabina con esto.** Guion concreto de nuestro bucle en 5 beats: (1) espejo vivo con halo de acento, ~12 s — la esencia; (2) precio gigante con un blob mirándolo, ~6 s; (3) pared de resultados cayendo, ~10 s; (4) tutorial mudo de 3 pasos con blobs actuando: toca, párate, sonríe, ~10 s — mata la ansiedad del que nunca la ha visto; (5) invitación con el objetivo táctil a pantalla completa y un pulso de color, ~8 s. Vuelve a (1). Cada beat entra por un cambio de campo de color, que es la 'señal fuerte' repetida.

*Fuente:* https://www.oldschoolgamermagazine.com/arcade-attract-mode-and-the-rise-of-modern-gaming-promos/ y https://arcadeheroes.com/2014/05/29/great-arcade-attract-modes-dont-drive-you-crazy/

### El video corto vale tanto como la foto: el 'moment' de 3 segundos

SEGA fiz entrega hasta 12 datos por partida: 6 fotos y 6 'moment' de video de 3 segundos, por ¥400, con cabina de rayado separada de 32". Las cabinas coreanas entregan además de las tiras un video corto de 'detrás de cámaras' vía QR.

**Qué hace nuestra cabina con esto.** Con el mismo obturador podemos capturar 6–8 cuadros alrededor de cada toma y componer un bucle de ~1 s (boomerang) sin costo extra de sesión ni de hardware. Sirve para dos cosas dentro de nuestras restricciones: es lo que se ve moviéndose en la 'pared de resultados' del bucle de atracción, y es lo que hace que la pantalla de revisión se sienta viva en lugar de una galería estática. Todo se compone en el aparato y no sale de él.

*Fuente:* https://www.sega.jp/topics/detail/201008_2/

### El accesorio libre es parte de la escena, y sin gabinete hay que reemplazarlo en pantalla

En los locales chinos hay un área a la entrada con dos filas de diademas variadas para tomar libremente; en Corea las cabinas ofrecen props gratis, lentes y sombreros, y DON'T LXXK UP regala lentes de sol de moda y calcomanías. El acto de escoger prop es la mitad de la diversión y ocurre ANTES de pagar.

**Qué hace nuestra cabina con esto.** Sin gabinete ni canasta, el equivalente honesto es una bandeja de efectos en pantalla que se vea física: objetos con volumen y sombra propia, arrastrables, no una lista de chips. Y ubicarla antes o durante la toma, no sólo después, para que la persona que se está acercando ya vea que hay algo que agarrar. Restricción de cómputo: los efectos se componen sobre el preview a 15 fps en 640x360 y se aplican en alta sólo al capturar; nada de shaders por cuadro en el hilo principal.

*Fuente:* https://m.thepaper.cn/newsDetail_forward_30200123 y https://creatrip.com/en/news/13797

### En Asia el objeto impreso ES la publicidad; sin objeto, la pantalla tiene que hacer ese trabajo entero

Todo el modelo coreano/japonés/chino se cierra con un artefacto que circula: dos tiras impresas para que cada amigo se lleve una, tableros con fotos de clientes en el pasillo, y un QR que manda el archivo al teléfono para redes. En China el 90% de los clientes de un local llegaba por Meituan y Douyin, o sea por fotos ajenas.

**Qué hace nuestra cabina con esto.** Nuestra restricción de que la foto nunca sale de la máquina elimina ese circuito por completo. Consecuencia de diseño ineludible: el 100% de la atracción tiene que venir de la pantalla y de los espectadores que ven la sesión ajena en vivo. Por eso el espejo vivo, el color a sangre y la cuenta regresiva gigante no son adorno: son el sustituto funcional de la tira impresa. Vale la pena decírselo explícitamente a la persona dueña, porque es una diferencia estructural con el referente que pidió replicar.

*Fuente:* https://www.woshipm.com/it/5112516.html y https://www.most9.life/posts/life4cuts-photo-booth-culture

### El texto de la pantalla de atracción es casi inexistente y multilingüe por diseño

Los estudios coreanos operan 24 horas sin personal con instrucciones en inglés, japonés y chino; el kiosco arranca con un botón único '시작하기' (empezar) sobre monitor vertical; el proceso completo se explica con cuenta regresiva y modelos en pantalla, no con párrafos.

**Qué hace nuestra cabina con esto.** El bucle de atracción se diseña para funcionar sin leer: sin conexión no hay Google Fonts, así que empaquetamos UN archivo de fuente variable con peso muy alto para el numeral del precio y la cuenta regresiva, y todo lo demás sale con ese mismo archivo. Cero cadenas de negocio en el código de UI (la compuerta de marca lo falla): nombre, precio y llamada a la acción entran por bundle e i18n. LangSwitch existe pero no debe aparecer en atracción: el bucle es mudo, y el idioma se elige al tocar.

*Fuente:* https://www.koreaherald.com/article/10503226 y https://www.yubi.co.kr/www/kiosk_photo/photo2/produce

### Cifras

- Atención a señalización: 1.5–4.6 s de atención plena declarada por la industria; medición real en tienda 0.7–0.9 s de dwell promedio y sólo 35% de personas miran la pantalla
- Contenido dinámico atrae 1.5x más que el estático; señalización digital logra 2.6x más dwell que un display estático
- Duración de bucle recomendada: 30–90 s en pasillo comercial de tránsito rápido; 60–180 s en colas y elevadores; 2–5 min sólo con público sentado
- Attract mode arcade: la mayoría dura pocos minutos; el ideal citado por operadores es ≥10 min antes de repetir (Star Wars Trilogy Arcade ~6 min)
- Corea, precio: ₩4,000 por 2 tiras, ₩8,000 por 4, ₩12,000 por 6 (~USD 2.91 la sesión base); marcos premium +₩1,000–3,000
- Corea por marca: 인생네컷 ₩4,000 · 하루필름 ₩4,000 · 포토이즘 ₩4,000 · 포토그레이 ₩4,000–5,000 · 셀픽스 ₩3,000–4,000
- Corea, sesión: 8–10 tomas cronometradas a ~10 s cada una, se eligen 4; otras fuentes reportan 4 tomas con ~5 s entre toma y toma; cuenta regresiva 3-2-1; total 3–5 minutos; 2 copias impresas
- Corea, escala: Life Four Cuts ~410 tiendas, 120 millones de visitas acumuladas desde 2017, ~2 millones de visitantes al mes; Photoism 450+ ubicaciones; operación 24 h sin personal, instrucciones en inglés, japonés y chino
- Corea, catálogo tras renovación de Life Four Cuts: 21 marcos y 6 filtros con retoque automático
- Japón, purikura: ¥400–500 por sesión de grupo (fiz de SEGA sale de fábrica en ¥400); 6–10 tomas a 3–5 s por toma; edición ~90 s con tope reportado de 180 s; ciclo completo 8–10 minutos
- Japón, SEGA fiz: hasta 12 datos por partida (6 fotos + 6 videos 'moment' de 3 segundos); cabina de rayado de 32 pulgadas
- China, precio: 39 yuanes marco clásico, 69 yuanes marco con licencia, 39.9 yuanes ediciones de colaboración; rango de mercado 29.9–49.9 yuanes; ~30 yuanes es el ticket típico
- China, operación: máquina de 2–3 m²; 3–5 minutos para entregar; impresión en ~30 s; 40–50 sesiones diarias normales y 60–100+ en festivo; ~20 minutos por grupo cuando hay vestuario y selección larga
- China, negocio: margen bruto ~50%, retorno de inversión en 5–8 meses, ingreso mensual de 20,000–30,000 yuanes en punto no premium; JUST.FOTO 2,000+ máquinas en 1,600+ ubicaciones; Photoism 100+ tiendas; un local típico con 4 máquinas en dos filas
- China, 自拍馆 con vestuario: locales de 60–100 m², ~10 escenarios temáticos, ~100 atuendos, inversión 200,000 yuanes independiente o 30,000–40,000 en equipo por franquicia; 90% de clientes llegan por Meituan
- Hardware típico del kiosco vertical: 43", 1920x1080, IPS, brillo >300 cd/m², contraste 5000:1, táctil infrarrojo de 10 puntos, vidrio templado de 3 mm
- Purikura, procesamiento: aumento de ojos hasta 200% en modos de belleza preconfigurados
- Nuestro objetivo derivado: sesión ≤3 minutos punta a punta (sin espera de impresión), bucle de atracción de 45–60 s en 5 beats de 6–12 s, análisis a 15 fps sobre 640x360, área táctil mínima 64 px

### Lo que sería un error copiar

- Video en bucle de gente riendo (footage stock o grabado): pesa decenas de MB en el APK, no se puede recolorear por marca sin re-exportar, envejece mal y con modelos pagados es una promesa falsa. Nuestro bucle tiene que ser procedural y vestirse solo con --psp-color-accent-1..6.
- La voz sintética gritona y el J-pop a volumen alto del purikura: en una plaza mexicana el contrato de local suele restringir audio continuo, molesta a los vecinos, y si la instrucción viaja sólo por voz excluye a personas sordas. Tomar el contagio, dejar el ruido: sólo obturador y confirmación, con equivalente visual completo.
- La densidad visual de purikura (pantalla saturada de rosa, decenas de stickers y plumas simultáneas): funciona para un público experto sentado 90 s en una cabina de rayado de 32". La nuestra atiende a alguien de pie, que nunca la ha visto, con fila detrás. Seis opciones, no veintiuna.
- La 'belleza' agresiva por defecto (piel + ojos hasta 200%): alterar la cara de alguien sin que lo pida es ofensivo, y está prohibido de raíz en el recorrido documental. Debe ser una elección explícita, nunca el default, y bloqueada por completo en trámite.
- Copiar la identidad de una marca concreta (el amarillo de Life Four Cuts, el azul cielo de Haru Film, el negro/gris de Photoism): la plataforma es multi-marca y la compuerta de build falla si aparece la marca literal. La dirección visual se define en tokens y formas, no en una paleta prestada.
- La sesión de 20 minutos del modelo chino de 自拍馆 con vestuario y 100 atuendos: mata el throughput, requiere personal y espacio, y contradice el escenario de alguien que pasa caminando por un pasillo.
- Marcos con propiedad intelectual licenciada (Disney, Hello Kitty, K-pop): es el motor de demanda allá y a la vez el mayor riesgo legal, y no escala en una flota offline. La familia de seis BlobFace es el activo propio equivalente.
- El attract mode de 10 minutos del arcade: nadie está diez minutos frente a la cabina, y un bucle larguísimo desperdicia memoria y batería de cómputo. Bucle corto con variación determinista, no bucle largo.
- Vender la pantalla de espera como cartelera publicitaria de terceros, que es lo que hacen las consolas de gestión coreanas: rompe la promesa de que aquí no se explota a la persona y ensucia la marca del local.
- Prometer en pantalla cosas que hoy no existen: tira física, papel, gabinete, QR al teléfono, cuenta o app. La máquina todavía no existe y la foto no sale de la máquina; el bucle de atracción no puede mostrar una tira de papel cayendo por una ranura.
- Mostrar fotos de clientes reales en la pared de resultados, como hacen los tableros de los locales chinos: sólo retratos demo empaquetados con la app. Nada capturado en la cabina reaparece en la pantalla de atracción.
- Repetir el crema con tarjetas blancas y sombra: a 300 cd/m² en un pasillo de mall ese fondo es indistinguible de la pared, y la marca queda reducida a un color de acento. Para el recorrido social el color va a sangre; el crema se queda en el recorrido documental.

## Elección y ritmo

### El recorrido asiático cabe en 3–4 decisiones antes de la cámara, y sólo 1 después

Orden canónico coreano documentado paso a paso: entrar → pagar (₩4,000) → elegir marco → posar con cuenta regresiva → elegir filtro → recoger. Otra guía lo describe igual: elegir idioma → elegir marco → disparar → elegir las 4 fotos → QR. En Japón el orden es: meter dinero → elegir división/plantilla y número de personas → disparar → garabatear → imprimir. Ninguna cadena mete más de cuatro pantallas de decisión.

**Qué hace nuestra cabina con esto.** Nuestro flujo actual tiene 13 rutas (apps/kiosk/src/session/flow.ts: attract, home, product, consent, payment, capture, review, edit, select, compose, confirm, print, finish). Para el recorrido social hay que colapsarlo a cinco pantallas con decisión real: Atracción → Producto+precio (1 toque) → Plantilla (con precio ya incluido) → Pago → Captura → Elegir 4 → Entrega. `consent` se funde en el mismo toque de pago (una línea + botón), `review` desaparece, `edit` se funde con `select` (mismo lienzo, filtros abajo), `compose`/`confirm` se funden en la pantalla de entrega, y `print` no aplica sin papel.

*Fuente:* https://www.awesomble.com/en/Aosdin/kr-photo-booth-guide/ ; https://www.biaskorea.com/en/guide/c/kculture-trend/life4cuts-korea-guide ; https://kids.nifty.com/cs/kuchikomi/kids_soudan/list/aid_180611127285/1.htm

### Se paga ANTES de ver una sola foto, siempre; nunca hay decisión de compra al final

En Life4Cuts/Photoism el pago ocurre inmediatamente al entrar y antes de elegir marco o disparar (₩4,000 la tira de 4 cortes, ₩5,000 la multi). En purikura el dinero entra antes incluso de elegir la plantilla. El resultado nunca se muestra como algo que todavía haya que comprar: el dinero ya está pagado cuando aparece la primera foto.

**Qué hace nuestra cabina con esto.** Confirmar que `awaiting_payment` queda antes de `capturing` (ya lo está) y prohibir cualquier up-sell posterior a la captura. La consecuencia de diseño importante: después del pago la sesión NUNCA debe caer a Attract por timeout — debe auto-avanzar con la mejor opción, porque la persona ya pagó y hay gente detrás mirando.

*Fuente:* https://www.awesomble.com/en/Aosdin/kr-photo-booth-guide/ ; https://www.biaskorea.com/en/guide/c/kculture-trend/life4cuts-korea-guide

### El marco/plantilla se elige ANTES de disparar y se ve compuesto en la vista en vivo

La máquina japonesa de nueva generación Hyper Shot reduce el juego a 3 pasos y el segundo es literalmente 'toma en vista en vivo con el diseño ya reflejado en pantalla': eliges el diseño (42 opciones), y disparas viéndote ya dentro del marco. Las cadenas coreanas también piden el marco antes del disparo, no después.

**Qué hace nuestra cabina con esto.** Mover la elección de plantilla a antes de `capture` y componer el marco EN VIVO sobre el video con una capa CSS/SVG encima del <video> (borde, máscara, color de fondo, logotipo del bundle): coste cero de CPU, no toca el hilo de análisis a 15 fps sobre 640x360. La pantalla `compose` posterior deja de ser una decisión y pasa a ser sólo la revelación del resultado.

*Fuente:* https://kobe-million.co.jp/topics/2070/ ; https://www.biaskorea.com/en/guide/c/kculture-trend/life4cuts-korea-guide

### Sobre-captura y sub-selección: se disparan 8, se eligen 4. La red de seguridad es disparar de más, no repetir

Life4Cuts: 'se toman 8 tomas y al final eliges las 4 que más te gustan para imprimir en la misma hoja'. Otras guías dan el rango 6–10 tomas para 4 huecos, 'así puedes permitirte dos poses tiradas'. La proporción 2:1 es el estándar de facto.

**Qué hace nuestra cabina con esto.** Para el producto social: `captureCount` = 8 y selección de 4. Eso elimina de raíz la pantalla `review` (aprobar/repetir foto por foto) que hoy existe en apps/kiosk/src/screens/Review.tsx: con 8 tomas nadie necesita aprobar cada una. Menos pantallas, menos tiempo, más resultado.

*Fuente:* https://www.jiemian.com/article/10604873.html ; https://www.most9.life/posts/life4cuts-photo-booth-culture

### No hay repetición de tomas en el flujo estándar; repetir es un producto de pago aparte

Testimonio de primera mano en Photoism: 8 segundos por toma, 8 tomas para 4 huecos, botón de autodisparo disponible, y 'puedes escoger cuáles 4 quieres sin poder repetir'. En la misma tienda, una máquina con tira Disney costaba ₩1,000 extra y ésa sí permitía repetir las 4 tomas completas.

**Qué hace nuestra cabina con esto.** Quitar el botón 'repetir' por foto del recorrido social (hoy en Capture.tsx con `retakesForPhoto`) y dejarlo sólo en el recorrido documental, donde la fidelidad manda. Si alguna vez se quiere ofrecer repetir, que sea un producto del catálogo con precio propio, no un botón gratis que alarga la fila.

*Fuente:* https://www.lemon8-app.com/@yuntunmiann/7179654687795331585?region=sg

### El ritmo de disparo real es 8–10 segundos entre tomas, no 3

Photoism da 8 segundos por toma. El Korea Herald describe que la gente 'posa en unos 10 segundos tras una señal sonora' y que la tanda completa dura alrededor de un minuto. Otra guía habla de ~10 segundos para cambiar de pose entre cuadros. Purikura va más rápido (3–5 s por toma) porque está en un arcade y el garabato es donde está la gracia. La máquina わたウサ de FuRyu deja elegir la cuenta regresiva entre 5, 10 o 15 segundos.

**Qué hace nuestra cabina con esto.** Nuestro `timing.captureCountdownSec` tiene default 3 (packages/contracts/src/config.ts, min 1 max 10): ése es un valor documental, no social. Para el recorrido social el valor debe ser 7–8 s por toma con la primera toma más larga (10 s) para dar el arranque, y el máximo del rango debe subir a 15 para poder configurar 'modo grupo'. 8 tomas × 8 s ≈ 64 s de disparo, que es exactamente el minuto que dura la tanda coreana.

*Fuente:* https://www.lemon8-app.com/@yuntunmiann/7179654687795331585?region=sg ; https://www.koreaherald.com/article/10503226 ; https://www.puri.furyu.jp/allnews/press/202405_watausa/

### La cuenta regresiva es sonora + visible, y hay botón para disparar antes

Las cabinas coreanas dan una señal audible antes de cada toma y la persona posa en los ~10 s siguientes; Photoism ofrece además botón de autodisparo por toma, para disparar cuando el grupo ya está listo en vez de esperar al reloj.

**Qué hace nuestra cabina con esto.** Countdown.tsx ya existe: usarlo grande (>160 px) y sincronizarlo con audio corto (bip-bip-BIP, empaquetado en el APK, sin CDN). Añadir un botón único de 'ahora' de área táctil ≥64px que adelanta el disparo. Respetar prefers-reduced-motion: la cuenta se ve como números y anillo, no como algo que salta.

*Fuente:* https://www.koreaherald.com/article/10503226 ; https://www.lemon8-app.com/@yuntunmiann/7179654687795331585?region=sg

### La máquina propone la pose; no deja a la persona en blanco frente a la cámara

Las máquinas japonesas muestran 'poses de muestra' en pantalla durante el disparo; el modelo #アオハル trae más de 60 poses seleccionables, y わたウサ permite cambiar el set de poses de muestra como parte de la configuración previa.

**Qué hace nuestra cabina con esto.** Es el hueco perfecto para la familia BlobFace (packages/ui/src/kiosk/BlobFace.tsx): seis formas con cara, seis tomas con personalidad. Cada toma de la tanda la 'presenta' un blob distinto haciendo la pose, con su color de acento (--psp-color-accent-1..6) tomando la pantalla completa durante el segundo previo. Es marca, es instrucción y es ritmo, sin una sola palabra escrita en código.

*Fuente:* https://mery.jp/1059387 ; https://www.puri.furyu.jp/allnews/press/202405_watausa/

### El presupuesto total de la sesión es de 3 a 6 minutos, puerta a puerta

Seoulz cifra la sesión Life4Cuts en ~6 minutos de puerta a recibo; una guía coreana da 3–5 minutos; otra 5 minutos; la industria japonesa de purikura, que incluye la fase de garabato, promedia 10 minutos y sus modelos nuevos presumen bajar a 5 saltándose el garabato.

**Qué hace nuestra cabina con esto.** Fijar un presupuesto de tiempo explícito y probarlo como test: atracción→pago ≤45 s, disparo ≤70 s, selección ≤45 s, entrega ≤30 s. Total objetivo 3:30. Cualquier pantalla nueva tiene que caber en ese presupuesto o desplazar a otra.

*Fuente:* https://www.seoulz.com/korea-photo-booth-2026/ ; https://koreapeek.com/korean-photo-booth-guide/ ; https://insta-reibun.com/purikurananpun/ (vía búsqueda)

### El cronómetro se muestra en las pantallas de decisión, NO durante el disparo, y al vencer avanza en vez de cancelar

En purikura la fase de garabato tiene límite visible de ~2–3 minutos y el propio límite se relaja cuando no hay nadie haciendo fila; la máquina avanza sola al terminar. Durante el disparo no hay reloj de sesión: sólo la cuenta regresiva de la toma. En Corea se reportan ventanas de 30–60 s para elegir filtro/fondo/efectos.

**Qué hace nuestra cabina con esto.** Usar TimeoutBar.tsx sólo en `select`/`edit` (barra que se consume, sin números rojos, sin urgencia agresiva) y jamás en `capture`. Al vencer: auto-seleccionar las 4 tomas mejor puntuadas por el análisis de visión y avanzar a la entrega. Nunca cancelar una sesión pagada.

*Fuente:* https://japan.dezign.jp/popculture/purikura-photo-booth-culture-japan/ (vía búsqueda) ; https://www.jrpass.com/blog/say-cheese-the-ultimate-guide-to-purikura-japanese-photo-booths (vía búsqueda)

### La industria está quitando pasos, no añadiéndolos: el 'saltar' es una función que se anuncia

FuRyu lanzó わたウサ (junio 2024) presumiendo la primera función de salto de la compañía: permite saltarse el garabato y la edición de la calcomanía y recortar hasta 4 minutos. La máquina abre con una pantalla previa donde se configuran cinco cosas de golpe (número de tomas 1–12, cuenta regresiva 5/10/15 s, poses de muestra, garabato sí/no, edición de diseño sí/no) y luego ya no interrumpe.

**Qué hace nuestra cabina con esto.** Cada pantalla creativa lleva un botón grande 'así está bien' que acepta el default y avanza. La configuración por defecto tiene que producir un resultado bueno sin tocar nada: quien no decide nada debe salir igual de contento que quien decide todo. Y como en わたウサ, si algún día se ofrece configuración fina, va TODA junta en una pantalla antes de disparar, no repartida.

*Fuente:* https://www.puri.furyu.jp/allnews/press/202405_watausa/ ; https://www.furyu.jp/news/2024/05/watausa/

### La entrega tiene dos mitades y una de ellas es un video del proceso, no una foto

El QR impreso al borde de la tira desbloquea los archivos digitales Y un video corto / time-lapse de la propia sesión de disparo ('behind-the-scenes'), y ése es el material que la gente sube a redes. Es una función estándar desde 2024. Hay incluso cabinas cuyo producto entero es movimiento: 50 Page graba 7 segundos de video y en cinco minutos entrega un flipbook.

**Qué hace nuestra cabina con esto.** Sin papel, la entrega digital ES el producto, así que hay que subir su nivel: además de la composición de 4 fotos, ensamblar un clip de 4–6 s con los cuadros que ya pasan por el análisis (rebote tipo boomerang, sin códec pesado: secuencia de JPEG a WebP/GIF en el aparato). La pantalla final muestra el clip reproduciéndose grande, no un mensaje de 'listo'. Ojo con la restricción dura: sin conexión, el QR no puede apuntar a una nube — la entrega tiene que resolverse local (el propio aparato sirviendo el archivo) y eso hay que diseñarlo aparte.

*Fuente:* https://shop.maaltalk.com/blog/post/best-photo-booth-brands-seoul-korea ; https://blog.trazy.com/unique-photo-booths-in-seoul/ ; https://www.seoulz.com/korea-photo-booth-2026/

### El retoque va aplicado por defecto; la decisión estética es elegir entre 3 'looks' con nombre, no mover parámetros

'Filtro de belleza aplicado por defecto' es la línea base en todas las cadenas coreanas, y la diferencia entre marcas es el TONO del filtro (Haru Film cálido tipo película, Life4Cuts suave y soñador, Photoism con AR y fondos). Hyper Shot resuelve la belleza con tres opciones nombradas: 'sin filtro', 'brillo de purikura' y 'brillo natural', más 9 colores de LED de fondo. En Corea se reporta una ventana de 30–60 s para elegir el set de filtro con vistas previas ya renderizadas.

**Qué hace nuestra cabina con esto.** Una sola fila de 3 a 6 looks nombrados, cada uno con su color de acento (--psp-color-accent-1..6), aplicados sobre la miniatura real de la persona, ya renderizados y con el primero preseleccionado. Cero sliders. Implementación barata: matrices de color CSS/canvas sobre la imagen final, no sobre la vista en vivo. Y ninguno de estos looks toca el recorrido documental.

*Fuente:* https://daebak.co/blogs/magazine/korean-photo-booth-life4cuts ; https://kobe-million.co.jp/topics/2070/ ; https://unniespicking.com/hongdae-photo-booth-experience-seoul/

### Los marcos son el motor comercial y de novedad, y son contenido rotativo, no software

Las cadenas ofrecen 'cientos de marcos temáticos' que rotan constantemente: básicos, de temporada, personajes, colaboraciones con ídolos. El marco premium sube el precio ₩1,000–3,000 sobre los ₩4,000–6,000 base. Las colaboraciones con artistas (BTS, Stray Kids) son lo que genera visitas repetidas y FOMO. En China, las chicas fan van específicamente por los marcos de ídolos coreanos licenciados.

**Qué hace nuestra cabina con esto.** Encaja exacto con la restricción multi-marca: las plantillas son datos del bundle con vigencia (fecha de alta/baja), nunca código de UI. La galería se pagina de seis en seis (una por color de acento), con la foto de muestra grande, y el precio del marco premium sale de configuración. En vez de licencias de ídolos, que no tenemos, la novedad rotativa la dan las seis formas BlobFace con temporadas propias.

*Fuente:* https://koreapeek.com/korean-photo-booth-guide/ ; https://www.most9.life/posts/life4cuts-photo-booth-culture ; https://www.seoulz.com/korea-photo-booth-2026/ ; https://www.jiemian.com/article/10604873.html

### La diferenciación de 2025–2026 es el ENCUADRE, y varias tiendas ofrecen elegir ángulo como parte del flujo

El gancho de las cabinas nuevas de Seúl es el ángulo: cámara cenital (Don't Look Up ₩5,000–6,000, Picdot ₩4,000–5,000), conceptos con set (metro de Nueva York, elevador, baño de avión) a ₩6,000–8,000, cuerpo completo en cubo de madera (PIXX ₩8,000), y hasta pecera entre la cámara y la persona. Hyper Shot vuelve esto una decisión de pantalla: 'ángulo alto + primer plano', 'sólo ángulo alto' o 'sólo primer plano'.

**Qué hace nuestra cabina con esto.** Nuestra cámara es fija dentro del aparato, así que el ángulo físico no está disponible — pero el ENCUADRE sí: ofrecer 2 opciones (plano cercano / plano abierto de grupo) como un solo toque antes de disparar, resuelto con recorte y escala sobre el mismo sensor, coste computacional nulo. Es la manera honesta de dar esa variedad sin gabinete.

*Fuente:* https://blog.trazy.com/unique-photo-booths-in-seoul/ ; https://kobe-million.co.jp/topics/2070/

### Hay una queja documentada y repetida: el disparo se siente demasiado rápido

Reportaje de 界面新闻 sobre las cabinas en China recoge textualmente que a los clientes 'el tiempo de disparo se les hace muy corto, no alcanzan a reaccionar'. Es la contracara del ritmo veloz: la eficiencia mal calibrada se percibe como maltrato.

**Qué hace nuestra cabina con esto.** Diseñar el arranque con un compás de preparación explícito antes de la primera toma (mensaje corto + 10 s), y que la tanda tenga un latido perceptible: blob que anuncia → cuenta regresiva → destello → miniatura que cae a la tira lateral. La tira lateral que se va llenando (8 huecos) es el indicador de progreso; sustituye a ProgressDots genéricos.

*Fuente:* https://www.jiemian.com/article/10604873.html

### Preguntas que las cabinas NO hacen porque las resuelven solas o antes de la pantalla

Corea no pregunta cuántas personas son (la cabina admite 1–4 y ya); el idioma se resuelve en un toque en la pantalla de bienvenida (coreano/inglés/japonés/chino); la elección de 'concepto' se hizo afuera, al elegir en qué cabina meterse, viendo el exterior y las tiras de muestra pegadas en la pared. Japón sí pregunta número de personas porque su plantilla depende de ello (hasta 15 personas en #アオハル).

**Qué hace nuestra cabina con esto.** No preguntar cuántas personas son: el análisis de visión ya cuenta caras a 15 fps y puede elegir el encuadre solo. El idioma sólo se ofrece si el bundle trae más de un locale, como primer toque, con nombres nativos y área ≥64px. Y el 'concepto' se comunica en la pantalla de atracción, que es nuestro equivalente del exterior de la tienda.

*Fuente:* https://www.awesomble.com/en/Aosdin/kr-photo-booth-guide/ ; https://www.koreaherald.com/article/10503226 ; https://mery.jp/1059387

### La atracción se juega antes de la primera pantalla: cabina sin personal, 24 h, color y muestras reales a la vista

El modelo entero es desatendido y abierto 24 horas, en zonas de mucho paso (Hongdae, Seongsu). Lo que convoca es el exterior de color y las muestras de resultados. Volumen: Life4Cuts pasó de 35 tiendas (2019) a más de 400 (2022) y más de 1,000 en 27 países a fines de 2024, con 2.3 millones de visitas al mes y 120 millones de visitas acumuladas desde 2017. En fin de semana en Guangzhou una tienda superaba los 10,000 yuanes de venta diaria (≈160 sesiones a 60 yuanes).

**Qué hace nuestra cabina con esto.** La pantalla `attract` es cartel, no menú: legible a 3–5 metros, dominada por las seis formas con cara moviéndose en los seis colores vivos, con un carrusel de resultados reales de la propia cabina (los que la política de retención permita) y precio + duración visibles. Un solo objetivo táctil enorme. Nada de texto de bienvenida ni listado de productos: eso es la segunda pantalla.

*Fuente:* https://www.koreaherald.com/article/10503226 ; https://www.seoulz.com/korea-photo-booth-2026/ ; https://www.jiemian.com/article/10604873.html

### Cifras

- 8 tomas disparadas, 4 elegidas: proporción estándar en Life4Cuts (fuente 界面新闻 y guías coreanas). Rango reportado en otras guías: 6–10 tomas para 4 huecos.
- 8 segundos por toma en Photoism (testimonio de primera mano, Lemon8).
- ~10 segundos para posar tras la señal sonora, y ~1 minuto la tanda completa de disparo (Korea Herald).
- ~10 segundos para cambiar de pose entre cuadros (Daebak).
- Purikura: 3–5 segundos por toma, 6–10 tomas por partida.
- FuRyu わたウサ (jun-2024): cuenta regresiva elegible entre 5, 10 o 15 segundos; número de tomas elegible de 1 a 12; función de salto que ahorra hasta 4 minutos de garabato.
- Hyper Shot: flujo de 3 pasos, 42 diseños de calcomanía, 3 niveles de belleza con nombre, 9 colores de LED de fondo.
- #アオハル: más de 60 poses de muestra seleccionables; hasta 15 personas en cuadro.
- Purikura: límite de la fase de garabato ~2–3 minutos, ampliable si no hay fila; ciclo completo 8–10 minutos; promedio citado ~10 minutos, mínimo ~5 minutos saltándose el garabato.
- Sesión coreana completa: ~6 minutos puerta a recibo (Seoulz); 3–5 minutos (KoreaPeek); ~5 minutos (Enko); ~10 minutos incluyendo props (Seoul Glow).
- Ventana reportada de 30–60 segundos para elegir set de filtro / fondo / efectos en cabinas coreanas.
- Precio Corea: ₩4,000 la tira de 4 cortes con 2 copias; ₩5,000 multi-marco; ₩8,000 por 4 copias; ₩12,000 por 6 copias; marcos premium +₩1,000–3,000; rango general ₩3,000–6,000 y hasta ₩8,000 en cabinas de concepto.
- Precio Japón: ¥400–600 por partida (algunas fuentes hasta ¥1,000), diseñada para 2–4 personas.
- Precio China: 30–60 RMB por sesión en centros comerciales; una tienda Life4Cuts superó 10,000 RMB de venta en un día de fin de semana (≈160 sesiones a 60 RMB); retorno de inversión reportado en 3–6 meses.
- Formatos de impresión por marca: 4×6 pulgadas (Life4Cuts, Haru Film), 5×7 (Photoism), 5×8 (Photo Signature); tira tipo 2×6 pulgadas, ~5 cm de ancho.
- Escala Life4Cuts: 35 tiendas (2019) → más de 400 (dic-2022) → 410 en Corea → más de 1,000 en 27 países (fines de 2024); 120 millones de visitas acumuladas desde 2017; 2.3 millones de visitantes al mes; 27.6 millones al año.
- Mercado coreano de cabinas: 400 millones USD (2024), proyección 1,200 millones USD para 2033 (CAGR 13.5%).
- Economía por local en Corea: ~₩5 millones de utilidad neta mensual, margen operativo ~40%, superficie 15–25 m²; venta por sesión ₩3,000–6,000.
- QR de descarga: caducidad reportada entre 24 horas y 7 días según la cadena; entrega estándar desde 2024 incluye archivos digitales + video/time-lapse corto de la sesión.
- 50 Page: graba 7 segundos de video y entrega un flipbook en 5 minutos, ₩8,000.
- Nuestro código hoy: `timing.captureCountdownSec` default 3 s, rango 1–10 (packages/contracts/src/config.ts línea 146); 13 rutas en apps/kiosk/src/session/flow.ts; análisis de visión a ~15 fps sobre 640x360.

### Lo que sería un error copiar

- La arquitectura de dos cabinas (una para disparar, otra para editar). Existe sólo para el rendimiento de un arcade japonés: mientras un grupo edita, otro dispara. Nosotros tenemos una pantalla dentro de un aparato; copiar la separación nos daría un cambio de contexto sin ninguna ganancia.
- La fase de garabato con estilete (2–3 minutos). Es el paso que la propia industria japonesa está recortando y anunciando como función de ahorro (hasta 4 minutos). Requiere precisión fina, sentado y con tiempo; nuestra persona está de pie, a metro y medio de la pantalla, con alguien esperando. Se lleva por sí solo todo nuestro presupuesto de 3:30.
- La escalera de precios por número de copias impresas (₩4,000 / ₩8,000 / ₩12,000 por 2, 4 y 6 tiras). No hay papel. Copiar esa lógica de up-sell nos obligaría a inventar un equivalente falso y añadiría una pantalla de decisión comercial justo donde el recorrido debe acelerar.
- La canasta de props físicos (diademas, lentes, sombreros, letreros) y los sets temáticos de gabinete (elevador, metro, pecera con peces). Es hardware y mantenimiento diario, y el aparato todavía no existe. Lo que sí se traduce a pantalla es el encuadre y el marco.
- El QR que apunta a la nube de la marca y caduca en 24 h – 7 días. Nuestro aparato está sin conexión: un QR a internet sería una promesa rota en el momento exacto de mayor emoción. La entrega tiene que resolverse local y eso hay que diseñarlo como problema propio, no heredarlo.
- La cuenta de usuario, la app de la marca, los sellos de fidelidad (10 sellos = sesión gratis en Photoism) y la membresía necesaria para descargar el video (Pictlink en Japón). Sin app, sin cuenta, sin contraseña: es una restricción de producto explícita.
- La belleza automática que adelgaza cara y agranda ojos sin manera de apagarla. Además de ser una decisión estética importada, es incompatible con el recorrido documental, donde alterar la fidelidad invalida la foto de trámite.
- Los marcos de colaboración con ídolos. Es el motor comercial de las cadenas coreanas, pero descansa en licencias que no tenemos; imitarlo con parecidos no autorizados es un riesgo legal. La novedad rotativa la tiene que dar nuestra propia familia de seis formas.
- La combinación 'cero repeticiones' + cuenta regresiva muy corta. Hay queja documentada de clientes en China de que no alcanzan a reaccionar. Si adoptamos el no-repetir (que sí conviene), hay que pagarlo con tomas de sobra y con un compás de preparación antes de la primera.
- Los modos de grupo grande (hasta 15 personas en cuadro). Nuestra cabina y nuestra cámara fija no lo soportan, y prometerlo en pantalla genera una expectativa que el aparato no cumple.
- Los nombres, colores y precios de las marcas de referencia escritos en la interfaz. La compuerta automática de marca falla el build si aparece el nombre literal; toda esa capa entra por bundle e i18n, incluidos los precios y los nombres de los looks y de las plantillas.
- La pantalla de 'imprimiendo…' con barra de progreso (nuestra ruta `print`). Sin papel no hay nada que esperar: ese hueco de tiempo debe ocuparlo la revelación del resultado y del clip, no una espera decorativa.

## Edición y embellecimiento

### El embellecimiento va aplicado por defecto y NUNCA se anuncia como función

En las cabinas coreanas el retoque automático es expectativa base, no una opción: la máquina 'edita las imágenes haciendo que la piel se vea mejor y más brillante' sin preguntar. En las máquinas de FURYU (purikura) el proceso corre entero sin intervención del usuario: detecta rostro, extrae más de 50 regiones (ojos, labios, ojeras, bolsa lagrimal, contorno) y corrige cada una. En fotos de grupo muestrea la piel de CADA persona por separado y ajusta saturación, matiz y luminancia por individuo, en vez de una curva global. Segmentación de ojos con red neuronal (TensorFlow/Keras) entrenada con 5,000+ imágenes, corriendo en CPU deliberadamente para no pelearse con el hilo de render. La captura es de 4000x6000 px o más.

**Qué hace nuestra cabina con esto.** En el recorrido social, la vista previa en vivo YA ES el resultado final: la persona nunca ve una versión 'cruda' que luego cambia. Un solo preset fijo que llega del bundle (nombre e intensidad por configuración, jamás en el código de la UI). Cero menú de 'belleza' en la primera pantalla, cero palabra 'filtro de belleza' en la interfaz. Copiar dos cosas del pipeline de FURYU: (1) muestreo de piel POR ROSTRO detectado, no una curva global — crítico en México donde el rango de tonos es amplísimo; (2) el análisis pesado (detección/landmarks) corre fuera del hilo de render, a 15 fps sobre 640x360, mientras el embellecimiento vive como shader/filtro CSS-GPU sobre el video a resolución completa. Nuestro presupuesto de cómputo es mucho menor: nos limitamos a piel + luz, sin la malla de 50 regiones.

*Fuente:* https://www.4gamer.net/games/999/G999905/20220826098/ y https://www.koreaherald.com/article/10503226

### Los valores por defecto reales de un SDK de belleza chino de producción

Documentación pública de FaceUnity (相芯), el SDK que mueve buena parte del 美颜 en apps y máquinas chinas. Tabla de defaults recomendados: blur_level (suavizado) 4.2 sobre 6.0 (=70%), blur_type 2 (suavizado 'nítido', que preserva textura, no el 朦胧/difuso); color_level (blanqueo) 0.3 sobre 2.0 (=15%); red_level (rubor) 0.3/2.0; sharpen 0.2; filter_level 0.4 con filtro llamado 'ziran2' (自然 = natural). Forma facial: eye_enlarging 0.4, cheek_v 0.5, intensity_chin 0.3, intensity_forehead 0.3, intensity_nose 0.5, intensity_mouth 0.4, PERO cheek_thinning (adelgazar mejilla) 0.0, cheek_narrow 0.0, cheek_small 0.0. Y lo más revelador: eye_bright (brillo de ojos) 0.0 y tooth_whiten (blanquear dientes) 0.0 — el estándar de la industria los deja APAGADOS por defecto, son extras premium que se encienden a mano.

**Qué hace nuestra cabina con esto.** Nuestro preset 'base' del bundle arranca con: suavizado ~70% del máximo pero de tipo que conserva textura de piel (nunca plástico), realce de luminosidad y uniformidad de tono ~15% (NO blanqueo — ver 'lo que no debemos copiar'), nitidez leve 0.2, y CERO geometría facial: sin agrandar ojos, sin afinar cara, sin adelgazar nariz. Ojos brillantes y dientes en 0.0, igual que el estándar. Esto nos da un solo parámetro real que exponer si algún día hiciera falta, y hace que el efecto sea barato de calcular. Los seis valores se declaran en el bundle como `beauty.preset.*` para que otra marca los mueva sin tocar código.

*Fuente:* https://github.com/Faceunity/FULiveDemo/blob/master/docs/%E7%BE%8E%E9%A2%9C%E9%81%93%E5%85%B7%E5%8A%9F%E8%83%BD%E6%96%87%E6%A1%A3.md

### La única decisión fotográfica real que toma la persona es COLOR o BLANCO Y NEGRO

En las cabinas coreanas la elección que de verdad existe y de verdad cambia la foto es esa: se selecciona color o blanco y negro y la máquina imprime. El blanco y negro no es nostalgia decorativa: al quitar el color desaparece la variación de tono de piel, la piel 'se ve mejor' y los rasgos se ven más definidos — es un retoque de belleza disfrazado de decisión estética, y funciona igual en cualquier tono de piel. Es el filtro que más se comparte porque convierte 'una foto' en 'un recuerdo'. La marca 하루필름 se construyó reputación entera sobre 'un filtro natural que te hace ver increíble'.

**Qué hace nuestra cabina con esto.** Una pantalla con exactamente DOS tarjetas gigantes, cada una mostrando la cara real de la persona ya procesada (no un ícono, no un swatch): color y blanco y negro. Es el paso más rápido y el más satisfactorio del recorrido. En blanco y negro el marco sigue trayendo los seis acentos —la marca no se apaga aunque la foto sea gris—, que es justo lo que hace que la tira se reconozca en un feed. Nota de accesibilidad: la selección no puede depender del color; ring de foco de 3px + check, y las tarjetas a 64px+ de alto real de toque (nuestro `ChoiceCard` ya existe).

*Fuente:* http://www.civicnews.com/news/articleView.html?idxno=9218 y https://creatrip.com/en/blog/13797

### Tira horizontal de miniaturas renderizadas con la CARA de la persona, no con una imagen de muestra

El patrón de interacción dominante en las cámaras de belleza chinas y en las cabinas: los filtros se presentan como miniaturas horizontales deslizables, cada una ya renderizada sobre el cuadro capturado de quien está enfrente, con la seleccionada marcada. Las apps de teléfono (轻颜/Ulike) van mucho más lejos: ocho categorías (脸型, 美肤, 大眼, 美鼻, 美唇, 美型...) con deslizadores de tres tramos — pero eso es para alguien sentado con el teléfono a 30 cm, no de pie a metro y medio con alguien detrás.

**Qué hace nuestra cabina con esto.** Adoptar la tira horizontal, rechazar el panel de ocho categorías. Exactamente SEIS miniaturas, una por cada `--psp-color-accent-1..6`, cada una renderizada desde un frame capturado a 640x360 (barato: seis operaciones sobre un still, no sobre video en vivo). Cada miniatura de 96x96 mínimo con separación de 16px para dar 64px de área de toque limpia. La seleccionada: aro grueso del acento + escala 1.06 (respetando `prefers-reduced-motion`, que apaga la escala y deja solo el aro). Los nombres de los seis filtros llegan por i18n, jamás escritos en el componente. Ya tenemos `ThumbGrid` y `TouchSlider`; lo que falta es la variante horizontal con preview real.

*Fuente:* https://www.pconline.com.cn/ask/262736.html y conocimiento

### El tiempo de edición está TOPADO por reloj, y la industria está reduciéndolo activamente

La pantalla de 落書き (garabato/edición) de purikura tiene límite duro: 180 segundos típicos, 3 a 5 minutos según máquina, y se acorta automáticamente cuando hay gente esperando. La novedad de FURYU en 2024-2025 (máquina 'わたウサ') es lo contrario de agregar funciones: una función de SALTAR que recorta hasta 4 minutos del tiempo de garabato, más un 'menú personalizado' donde eliges qué pasos del recorrido quieres que existan. Su otra máquina (Bloomit) se vende con 'función de retoque de maquillaje súper rápida': configuras el retoque en UNA foto y se aplica a todas de un toque. La máquina FLASH tiene 87 tipos de retoque de maquillaje y eso ya se lee como exceso.

**Qué hace nuestra cabina con esto.** Nuestro tope: 60 segundos de edición con `TimeoutBar` visible pero silencioso (barra que se consume, sin números rojos, sin sonido), y el botón 'Listo' presente y grande DESDE EL SEGUNDO CERO — nunca hay que buscar la salida. Al agotarse no se pierde nada: avanza con lo que haya. Copiar literalmente el patrón 'aplica a todas': cualquier ajuste que la persona haga se propaga a las cuatro tomas de un toque, jamás foto por foto. Y copiar el 'menú personalizado' al revés: el bundle decide qué pasos existen para cada marca, no la persona.

*Fuente:* https://www.nihongomaster.com/blog/lets-purikura-all-you-want-to-know-about-japanese-photo-booths y https://xn--u9jugk5freucucg.com/archives/2250

### Elegir N de M es el momento emocional del recorrido, y es donde se gastan los toques

El flujo coreano real: 8 fotos en 80 segundos (una cada ~10 s, o disparo por control remoto), luego se eligen 4 de 8-10 en la pantalla táctil. Otras fuentes dan 4 tomas en 15 segundos de cuenta regresiva para máquinas rápidas, y ~5 s entre disparos. Sesión completa 3-5 minutos; de entrar a recibir el resultado, ~6 minutos. Contando toques desde que ves las fotos: 4 toques (elegir las cuatro) + 1 (color/BN) + 1 (color de marco) + 1 (confirmar) = 7 toques hasta el resultado. La gracia de tomar más de las que salen es que puedes 'gastar' dos poses en tonterías sin miedo.

**Qué hace nuestra cabina con esto.** Nuestro objetivo: DE VER LA FOTO A TENER EL RESULTADO, 6 TOQUES O MENOS. Disparamos 6, se quedan 4: elegir dos a descartar es más rápido y menos angustiante que elegir cuatro de ocho, y el descarte se hace tocando la foto (se apaga, se puede recuperar) en lugar de un modo de selección. Después: 1 toque color/BN, 1 toque marco, 1 toque 'Listo'. Cero pantallas de confirmación. Los seis fotogramas se muestran los seis a la vez en una rejilla 3x2 — nada de scroll para decidir, porque scroll de pie con fila detrás es donde la gente se atora.

*Fuente:* https://www.funliday.com/posts/2022-south-korea-lifefourcuts/ y https://www.seoulz.com/korea-photo-booth-2026/

### El garabato a mano es el alma de purikura, y su gramática de herramientas es minúscula

El sistema de plumas de purikura, después de 30 años, se estabilizó en cuatro herramientas: ペン (pluma fina, para texto pequeño), マーカー (marcador grueso, para titulares), グローペン (neón brillante) y ハイライター (resaltador semitransparente, se usa DEBAJO del texto o sobre el fondo). Cada una con tamaño y opacidad ajustables. Lo que la gente dibuja: corazones, estrellas, moños, nubes, alitas de ángel, y decorar el fondo además de la foto. El garabato es lo que hace que dos personas con la misma plantilla saquen dos fotos distintas.

**Qué hace nuestra cabina con esto.** Traer el garabato, recortado a una gramática de kiosco: UNA pluma con tres grosores (fino / grueso / neón, tres botones, no un deslizador) y los SEIS colores de acento como paleta — la paleta de dibujo ES la marca. Sin opacidad, sin capas, sin borrador de precisión: un botón de deshacer grande y un 'limpiar todo'. Debe funcionar con dedo gordo sobre vidrio: grosor mínimo 6px, suavizado del trazo. Y aquí está la oportunidad propia: los seis BlobFace de `packages/ui/src/kiosk/BlobFace.tsx` son nuestro set de stickers — se arrastran, se sueltan, se escalan con pellizco. Nadie más los tiene y son literalmente la marca; una foto con un blob encima es reconocible a distancia en un feed.

*Fuente:* https://shingakunet.com/journal/trend/20170327191135/ y https://filmora.wondershare.jp/video-editing/method-of-purikura.html

### El marco/plantilla rotatorio es el motor #1 de repetición — más que la calidad de la foto

El mayor impulsor de visitas repetidas en Corea es el marco de ídolo: las marcas rotan marcos de edición limitada que meten la imagen de una celebridad en uno de los cuatro paneles, generando FOMO y visitas repetidas para coleccionar distintos. Photoism ha hecho IU, BTS (marco de 10º aniversario, junio 2025), Stray Kids, ENHYPEN, NMIXX, Byeon Woo-seok, la selección coreana de fútbol y la liga KBO; Netflix hizo campaña de El Juego del Calamar en 27 países. En China el marco de celebridad cuesta 60 yuanes contra 35-38 del estándar — casi el doble, y se paga. Los grupos de amigos y parejas coleccionan tiras como un diario de la relación: mismos amigos, distintos barrios, años de tiras.

**Qué hace nuestra cabina con esto.** Los marcos son datos del bundle, punto: `frames[]` con id, geometría, colores por token y textos por i18n, versionados y sincronizables sin tocar código. Diseñar el sistema desde ya para (a) un set 'de esta semana' que rota y se ve distinto al de la semana pasada, y (b) marcos de temporada/evento del centro comercial (día de muertos, navidad, aniversario de la plaza) que son la versión honesta y sin problema legal del marco de ídolo. La compuerta de marcas ya nos obliga a esto, así que es gratis. Lo que sí debemos construir es la sensación de 'esto no va a estar la próxima vez': una etiqueta de vigencia visible en la pantalla de marcos, con el texto por i18n.

*Fuente:* https://www.seoulz.com/korea-photo-booth-2026/ y https://www.digitaling.com/articles/1016931.html

### La entrega digital es lo que de verdad se comparte; el papel es el souvenir

Toda cabina coreana imprime un QR en la tira. Al escanearlo bajas los archivos digitales Y un video corto del proceso de la sesión (el time-lapse / clip de cómo se movieron antes de cada disparo) — ese video es lo que acaba en historias de Instagram. Vigencia oficial de Life4Cuts: 3 días contando el día de la toma; las fotos no se guardan en la máquina sino que se envían al servidor y se borran automáticamente al vencer. El hashtag #인생네컷 lleva 1.1+ millones de publicaciones. Formato pensado explícitamente para ser fácil de compartir.

**Qué hace nuestra cabina con esto.** Es nuestro punto de fricción más grande con la restricción de 'sin conexión' y hay que resolverlo por diseño, no por analogía: nada de servidor externo. La forma que sí cumple es entrega LOCAL — el aparato levanta su propio punto de acceso / servidor en la LAN y el QR apunta a una URL local con vigencia corta (minutos, no días) y borrado automático, que encaja con lo que ya existe en `apps/station-agent/src/retention`. Segundo: generar SIEMPRE, sin que nadie lo pida, un clip corto de la sesión (los segundos entre disparos, cuando la gente se acomoda y se ríe) — es contenido gratis a partir de fotogramas que ya estamos capturando para el análisis a 15 fps, y es lo que se comparte. Tercero: la foto que sale debe llevar el marco de la marca en el borde, porque es lo que hace que la tira sea reconocible como 'de esa cabina' cuando alguien la ve en un feed.

*Fuente:* https://lifefourcuts.com/QR_Code y https://www.cnn.com/style/article/south-korea-photo-booth-studios-trend-intl-hnk

### El giro del mercado va de la deformación extrema hacia lo natural — y llegamos justo a tiempo para NO cometer el error viejo

Línea de tiempo de purikura: 1999 'High Key Shot' introduce el blanqueo/aclarado montado en la moda gyaru blanca; 2007 'Bijin Premium' estrena los ojos grandes expandiendo por primera vez horizontal Y verticalmente; 2011 'Lady by Tokyo' da marcha atrás hacia lo natural y elegante. En 2026 las máquinas se venden con '盛ere natural sin procesamiento excesivo' (CENTI:U) como argumento de venta. En China la generación Z considera el美颜 fuerte '假' (falso), 'pretencioso', 'sin carácter'; a las celebridades les comentan en masa 'apaga el filtro', 'ni tu mamá te reconoce', 'cara de serpiente'; 轻颜 tuvo que agregar modo 原图 (original) y nivel de belleza cero. En Corea las cabinas que ganan reputación son las de retoque natural (하루필름, 시현하다: 'casi sin filtro').

**Qué hace nuestra cabina con esto.** Nuestro default se planta en 2026, no en 2007: piel y luz sí, geometría facial no. Y damos la salida honesta que a los demás les costó una década agregar: un solo control, no un menú — dos estados grandes y sin jerga, 'como estoy' / 'un poquito', donde 'un poquito' es el preset del bundle y 'como estoy' es cero procesamiento. Sin la palabra 'belleza', sin porcentajes, sin nombres de partes del cuerpo. Un `Toggle` (ya existe) del tamaño de una tarjeta, colocado en la pantalla de resultado y no antes, para que quien no lo quiera ni lo note.

*Fuente:* https://smartmag.jp/archives/61128/ y https://cn.chinadaily.com.cn/a/201912/30/WS5e09a201a31099ab995f45c4.html

### El color del fondo y del marco es una decisión de identidad, no de decoración

Life4Cuts vende explícitamente 'colores de fondo personalizables' y selección de color de marco después del procesado. Marcas enteras se construyen sobre color de habitación: DON'T LXXK UP vende cuartos rojo, azul, gris oscuro y uno rosa de temporada; BYTP Station tiene cuartos temáticos (vagón de metro, tiro de elevador con contrapicado). 시현하다 프레임 ofrece seis opciones de marco de 2 a 9 fotos y elección de encuadre (Wide / Original / Close Up). En China la demografía es 85%+ mujeres de 15-35 años y el 64.9% del consumo joven se declara 'para complacerse a sí mismo'.

**Qué hace nuestra cabina con esto.** No podemos construir cuartos de colores —no hay gabinete— pero sí podemos hacer que el color del MARCO sea la decisión de identidad, y ahí es donde los seis acentos se ganan el sueldo: seis marcos, uno por acento, presentados los seis juntos porque la marca es el conjunto. Eso también resuelve la petición de 'que llame mucho la atención': la pantalla de reposo puede ciclar los seis marcos con los seis BlobFace, y desde diez metros lo que se ve es un bloque de seis colores vivos moviéndose, no una tarjeta blanca. Añadir además la elección de ENCUADRE (abierto / normal / cerca) como tres botones, que es un cambio enorme en la foto y cuesta un toque y cero cómputo.

*Fuente:* https://creatrip.com/en/blog/13797 y https://www.digitaling.com/articles/1016931.html

### La foto de trámite y la foto social se resuelven con el MISMO hardware pero jamás con el mismo pipeline

En Asia estos son dos negocios distintos que conviven: 시현하다 y las cadenas chinas tipo 海马体 hacen retrato de identidad con retoque controlado y precio alto, mientras que 인생네컷 hace el recorrido social barato y repetible. Nadie mezcla los dos flujos en la misma pantalla: cambia el encuadre, la iluminación, el precio y sobre todo qué se le permite hacer a la imagen.

**Qué hace nuestra cabina con esto.** Es exactamente nuestra restricción #4 y conviene grabarla en la arquitectura, no en la disciplina: el pipeline documental no debe siquiera poder cargar el módulo de embellecimiento. Separación a nivel de módulo (el recorrido documental importa un pipeline que solo hace encuadre, recorte y balance de blancos; ni siquiera existe el símbolo del preset de belleza en ese árbol), más una prueba que falle si el bundle documental declara `beauty.*`. Visualmente también deben verse distintos: el recorrido documental es sobrio y de un solo acento; el social es los seis vivos.

*Fuente:* conocimiento y https://www.digitaling.com/articles/1016931.html

### El antes/después vendido como magia, no como ajuste

Ninguna cabina asiática enseña un panel de 'antes y después' con deslizadores; el 'después' es simplemente lo que aparece. Pero la comparación existe socialmente: el hilo recurrente en foros coreanos es literalmente '¿cuál de estas cabinas es mi cara de verdad?' comparando 포토이즘 vs 포토그레이 vs 하루필름 — la gente compara entre MÁQUINAS, no dentro de una.

**Qué hace nuestra cabina con esto.** Tenemos `CompareView` y la tentación de usarlo en el recorrido social. No hacerlo: enseñar el 'antes' rompe el hechizo y agrega un toque. Reservar `CompareView` para el recorrido documental, donde el valor es demostrar que NO se alteró nada — ahí sí es una prueba de honestidad y no un juguete.

*Fuente:* https://www.instiz.net/name/52697973

### Cifras

- Flujo coreano completo: 3-5 minutos de sesión; ~6 minutos de entrar a recibir el resultado
- Disparo: 8 fotos en 80 segundos (una cada ~10 s); variantes rápidas hacen 4 poses en 15 segundos; ~5 s entre disparos
- Selección: se eligen 4 de 8-10 fotogramas; algunas máquinas ofrecen de 2 a 9 marcos por plantilla
- Toques desde ver la foto hasta el resultado en Corea: ~7 (4 elegir + color/BN + color de marco + confirmar). Nuestro objetivo: 6 o menos
- Pantalla de edición purikura (落書き): límite duro de 180 segundos; 3-5 minutos según máquina; se acorta sola si hay fila
- FURYU 'わたウサ' (2024-25): la función de saltar recorta hasta 4 minutos del tiempo de garabato
- FURYU 'FLASH': 87 tipos de retoque de maquillaje (ejemplo de exceso, no de meta)
- FaceUnity defaults de producción: blur_level 4.2/6.0 · blur_type 2 (nítido) · color_level 0.3/2.0 · red_level 0.3/2.0 · sharpen 0.2/1.0 · filter_level 0.4 con filtro 'ziran2' (natural)
- FaceUnity forma facial defaults: eye_enlarging 0.4 · cheek_v 0.5 · chin 0.3 · forehead 0.3 · nose 0.5 · mouth 0.4 · cheek_thinning 0.0 · cheek_narrow 0.0 · cheek_small 0.0
- FaceUnity: eye_bright 0.0 y tooth_whiten 0.0 — el estándar de la industria los deja APAGADOS por defecto
- FURYU: más de 50 regiones faciales corregidas por separado; red neuronal de segmentación de ojos entrenada con 5,000+ imágenes, ejecutada en CPU para no interferir con el render; captura de 4000x6000 px
- Precio Corea: ₩4,000 (~US$2.91) por 2 copias · ₩8,000 por 4 · ₩12,000 por 6; rango de sesión ₩3,000-10,000
- Precio China: 19-39 yuanes en máquina de calle; 35-38 yuanes marco estándar en tienda; 60 yuanes marco con celebridad (casi el doble, y se paga)
- QR digital Life4Cuts: vigencia de 3 días contando el día de la toma; incluye fotos + video del proceso; borrado automático al vencer
- Escala: 120 millones de visitas acumuladas desde 2017; ~410 tiendas de Life Four Cuts en Corea; 2.3 millones de visitantes mensuales; 27.6 millones de visitas anuales
- Redes: 1.1+ millones de publicaciones con #인생네컷 en Instagram
- Mercado coreano de fotocabinas: US$400 millones (2024) → proyección US$1.2 mil millones (2033), CAGR 13.5%
- Ingresos Life Four Cuts: ₩12.3 mil millones (2020) → ₩49.4 mil millones (2023); 1,000+ tiendas en 27 países
- Demografía China: 85%+ mujeres de 15-35 años; 64.9% del consumo joven declarado como 'para complacerse a sí mismo' (2022)
- China instalado: 拍立方 con 5,000+ máquinas nacionales; Just.Foto en 50+ ciudades; inversión inicial 30,000-70,000 yuanes por punto
- Hitos de purikura: 1995 lanzamiento · 1999 blanqueo/aclarado (High Key Shot) · 2007 ojos grandes en horizontal y vertical (Bijin Premium) · 2011 vuelta a lo natural (Lady by Tokyo) · 2026 se vende 'natural sin procesamiento excesivo'
- Herramientas de garabato estabilizadas tras 30 años: 4 (pluma fina, marcador, pluma neón, resaltador), con tamaño y opacidad. Nuestra versión: 1 pluma, 3 grosores, 6 colores
- Superficie de tienda coreana: 15-25 m² por local, 24 horas, sin personal; margen operativo ~40%

### Lo que sería un error copiar

- El blanqueo de piel (美白 / color_level) como valor por defecto. En Asia es una preferencia estética heredada de una moda de 1999; en México el blanqueamiento es una carga social real y además, técnicamente, una curva global de aclarado se rompe en piel oscura: sube el ruido, apaga los medios tonos y produce grises. Lo que sí queremos es lo que FURYU hace bien —muestrear la piel de CADA rostro y uniformar tono y luminancia por persona— y llamarlo luz, no blanqueo. Ninguna cadena de texto de la UI puede decir 'blanquear'.
- El menú de ocho categorías con deslizadores (脸型 / 美肤 / 大眼 / 美鼻 / 美唇 / 美型...) de 轻颜 o Ulike, y los 87 retoques de la máquina FLASH. Están diseñados para alguien sentado, solo, con el teléfono a 30 cm y todo el tiempo del mundo. Nuestra persona está de pie, a metro y medio, nunca vio la cabina, y tiene a alguien esperando. Cada deslizador que agreguemos es una decisión que no sabe tomar y tiempo de dos personas.
- La deformación geométrica agresiva (デカ目, afinar cara, adelgazar nariz) en cualquier intensidad notoria. Es la estética de 2007 que Japón ya abandonó en 2011 y que la generación Z china rechaza abiertamente como '假'. Además es el efecto más caro de calcular (requiere malla y warp por fotograma) y el que primero se rompe en un Android de gama media a 15 fps. Sale caro y sale mal visto.
- Los 3-5 minutos libres de garabato. En un salón de juegos japonés la cabina de edición está SEPARADA de la de disparo, así que el siguiente grupo ya está fotografiándose mientras tú decoras. Nosotros tenemos un solo aparato: cada minuto de edición es un minuto en que nadie más puede pagar. Nuestro tope es 60 segundos, con salida disponible desde el primer segundo.
- Depender de un servidor para la entrega digital. Las cabinas coreanas suben al servidor y el QR apunta a internet. Nosotros no tenemos conexión y las fotos no salen del aparato: la entrega tiene que ser local (punto de acceso propio, URL de LAN, vigencia de minutos, borrado automático). Copiar el QR sin copiar la arquitectura sería incumplir la restricción sin darnos cuenta.
- Los accesorios físicos gratis (diademas, lentes, orejas) y los cuartos de colores. No hay gabinete todavía, y prometer en pantalla algo que la máquina no tiene es peor que no ofrecerlo. Nuestro equivalente vive en software: los seis BlobFace como stickers arrastrables y los seis marcos de acento.
- Los marcos con IP de terceros (ídolos, series, ligas deportivas). Es el motor de repetición número uno en Corea y es exactamente lo que no podemos replicar: requiere licencias, conexión para rotar, y choca de frente con la plataforma multi-marca. La versión que sí nos sirve es el marco de temporada y de evento local, servido desde el bundle.
- El nombre de cualquier filtro, marco, precio o preset escrito en el código de la interfaz. La compuerta de marcas ya falla el build con la marca literal, pero el riesgo real es más sutil: un array `FILTERS = ['Rosa', 'Verano', ...]` en un componente ya nos casó con una marca. Todo eso son claves de i18n resueltas contra datos del bundle.
- La pantalla de 'elige 4 de 10'. Diez miniaturas en una pantalla, de pie y con prisa, es donde la gente se atora: hay que comparar diez cosas y descartar seis, y descartar duele. Disparar 6 y descartar 2 da el mismo resultado emocional con la mitad de la carga.
- El antes/después con deslizador en el recorrido social. Enseñar el 'antes' rompe el hechizo que las cabinas asiáticas cuidan con obsesión: la foto embellecida no se presenta como un efecto aplicado, se presenta como cómo saliste. El antes/después es honestidad valiosa en el recorrido documental y es un sabotaje en el social.
- Cronómetros con números que corren y avisos de urgencia. Purikura tiene límite de tiempo pero la presión ya la pone la fila real; un contador en rojo con sonido convierte una experiencia divertida en un examen. Barra que se consume en silencio, y al agotarse avanza sin perder nada.

## Pantalla de captura

### El espejo es la pantalla completa, pero el lente NO está en el espejo: la guía número uno de todas las cabinas coreanas es 'mira la cámara, no la pantalla'

En las cabinas coreanas el monitor va debajo del lente. Las guías repiten literalmente 'Look at the camera and pose within 10 seconds after you hear the sound beep', y los usuarios se quejan de que 'the monitor screen isn't in view if you're looking at the camera'. Los blogs coreanos afinan más: no mirar el centro del lente (sale la mirada hacia arriba) ni el borde inferior (parece ojo cerrado), sino el punto medio-bajo del lente. El espejo sirve para ENCUADRARSE antes, no durante el disparo.

**Qué hace nuestra cabina con esto.** Espejo a pantalla completa (ya lo tenemos en Capture.tsx con CameraView en modo espejo), pero con un 'ojo guía' fijo: una BlobFace pequeña anclada exactamente donde está el lente físico, viva y parpadeando durante la fase de preparación. En el último segundo de la cuenta el espejo baja a 35% de opacidad y se contrae 6%, mientras la BlobFace del lente crece y se enciende con --psp-color-accent-N: la mirada se va sola al lente. Nada de texto 'mira a la cámara': la atención se dirige con movimiento y color, no con instrucciones. La posición del lente entra por bundle (offsetX/offsetY en porcentaje de pantalla) porque cambia por modelo de aparato.

*Fuente:* https://creatrip.com/en/blog/13797 · https://www.raumtree.co.kr/인생네컷-하루필름-포토이즘에서-사진-잘-찍는법/ · https://www.koreaherald.com/article/10503226

### La cuenta regresiva coreana no es de 3 segundos: es un ciclo de ~10 segundos por toma, con un 'bip' como señal y tiempo real para cambiar de pose

Las guías coinciden: 'a voice counts down before each shot, with about ten seconds to switch poses between frames', 'usually about 8-10 timed photos, usually about 10 seconds per photo', 'you have 8 seconds each to take a shot with a self-timer button option'. El Korea Herald describe 'the minute-long shoot' con 10 segundos por pose. En China los quioscos de centro comercial usan '15秒倒计时拍照' con sesión total de ~3 minutos.

**Qué hace nuestra cabina con esto.** Partir la cuenta en DOS tiempos con dos jerarquías visuales distintas, no un solo número: (1) PREPARACIÓN 6-7 s — la pantalla muestra la pose (BlobFace haciéndola) + 2 o 3 palabras de instrucción desde i18n + una barra fina de tiempo (TimeoutBar) en el borde superior, sin número gigante; (2) DISPARO 3 s — el número gigante entra con el componente Countdown (size ~420 px, no 220), un dígito por segundo, cada dígito en un color distinto de los seis --psp-color-accent-1..6, con escala 1.0→1.35 y salida. captureCountdownSec debe subir de 3 a un par (prepareSec, countdownSec) configurable por producto; el default del recorrido social debe ser 6+3, no 3.

*Fuente:* https://www.koreaherald.com/article/10503226 · https://daebak.co/blogs/magazine/korean-photo-booth-life4cuts · https://field.10jqka.com.cn/20260410/c675907318.shtml

### Se sobre-captura a propósito: 8 tomas para 4 huecos, y elegir es parte del juego

'You typically get 6–8 takes for 4 slots, so you can afford two throwaway poses'; 'choose your favorite four shots from eight to ten frames'. El exceso es lo que quita el miedo: nadie tiene que salir bien a la primera. En China el paquete es de 4-6 fotos por 29.9-39.9 CNY.

**Qué hace nuestra cabina con esto.** El producto define captureCount (huecos) y capturePool (tomas). Regla de bundle: pool = huecos + 2 como mínimo. En la pantalla de captura, el riel de miniaturas muestra los huecos VACÍOS desde el primer segundo (silueta de BlobFace en gris) y se van llenando: la persona ve cuánto falta sin leer nada. Que sobren tomas se comunica visualmente — huecos con borde punteado = 'de aquí eliges' — y no con la frase 'faltan 3 de 8'.

*Fuente:* https://www.most9.life/posts/life4cuts-photo-booth-culture · https://www.jiemian.com/article/14382779.html

### 'Repetir toma' es una función de primera clase, anunciada en pantalla y con límite

Fuente china sobre cabinas coreanas: 'los coreanos usan especialmente la función de repetir (Retake) para quedarse sólo con las fotos que les gustan… normalmente se puede repetir 2 o 3 veces, pero cambia por cabina. En la pantalla habrá un aviso, hay que confirmarlo. Hay límite de tiempo, así que decide rápido.' Los quioscos chinos de foto de trámite ofrecen '拍摄可进行三次' (tres intentos) y elegir la mejor.

**Qué hace nuestra cabina con esto.** Ya existe retakesLeft() y retakes.perPhoto en el producto. Falta hacerlo VISIBLE sin texto: después de cada disparo, la miniatura recién tomada aparece 1.2 s a media pantalla con dos zonas táctiles enormes (≥96 px de alto, muy por encima del mínimo de 64): un pulgar arriba en accent-4 y una flecha de repetir en accent-2, más un anillo de 1.2 s que si se agota acepta la foto. Las repeticiones restantes se muestran como 2 o 3 puntos que se apagan (ProgressDots en tono 'warn'), nunca como '2 repeticiones restantes'. Sin decisión = seguir adelante: el silencio siempre avanza la fila.

*Fuente:* https://k-insider.com/zh-cn/articles/1780795225 · https://zhuanlan.zhihu.com/p/33591449

### Dos modos de captura: 'yo te guío' y 'libre con tiempo'. La japonesa lo hace explícito y con números

FURYU CENTI:U (febrero 2026): モード おまかせ = 6 fotos automáticas guiadas + ~70 s libres; フリーモード = 200 segundos completamente libres, máximo 18 fotos. En わたウサ el menú personalizado deja elegir número de fotos (1 a 12), si hay pose de muestra, si hay garabato y si hay edición de sticker; saltarse el garabato ahorra hasta 4 minutos. Meidy (17-jul-2025): 9 tomas con 2 de 4 encuadres.

**Qué hace nuestra cabina con esto.** En el recorrido social, un solo toque al inicio de la captura elige entre 'Yo te digo qué hacer' (secuencia de poses, default) y 'A mi aire' (obturador en pantalla, N tomas con reloj visible). Para una cabina de plaza con fila detrás, el modo libre se acota a 60-75 s y 8 tomas, no 200 s / 18. Los dos modos comparten el mismo espejo y el mismo riel; sólo cambia quién dispara. El modo elegido y sus topes viven en el bundle (no en el código), así cada marca lo calibra.

*Fuente:* https://www.furyu.jp/news/2026/02/centiu/ · https://xn--u9jugk5freucucg.com/archives/2250 · https://www.furyu.jp/news/202507/meidy/

### El control remoto es el objeto que da confianza — y lo que hace es controlar la LUZ, no sólo el obturador

Todas las marcas coreanas de autoservicio entregan un control remoto dentro de la cabina; en 하루필름 'al presionar suavemente el botón del control la pantalla se ilumina y puedes tomar la foto con un filtro más brillante'. En los estudios de autofoto chinos el remoto controla la cámara Y las luces de estudio, con reproducción inmediata en la pantalla grande. Las máquinas japonesas modernas ofrecen セルフシャッター además de la cuenta automática.

**Qué hace nuestra cabina con esto.** No hay gabinete ni remoto físico, así que el equivalente es un OBTURADOR EN PANTALLA en la franja inferior (alto ≥ 120 px, ancho completo, alcanzable con el pulgar de pie a metro y medio) que dispara y además un control de LUZ de dos o tres pasos, no un menú de filtros: 'suave / normal / brillante'. El paso de luz sube el brillo del propio panel y ajusta exposición del preview — la pantalla ES la luz de relleno. El control de luz sólo existe en el recorrido social; en documental está bloqueado por la restricción de fidelidad.

*Fuente:* https://www.st-news.co.kr/news/articleView.html?idxno=4545 · https://zhuanlan.zhihu.com/p/426614494

### El flash simulado con la propia pantalla es una técnica estándar de la industria, no un adorno

En el software de cabina 'Photo Booth's Flash feature is your screen turning white', usada como luz de relleno frontal en montajes de tableta; hay apps que la venden como 'Screen Flash' para bajo nivel de luz. Las máquinas japonesas modernas dejan elegir entre iluminación ノーマル y フラッシュ (CENTI:U), y desde 1999 ('ハイキーショット') el truco es iluminación fuerte de clave alta que borra imperfecciones.

**Qué hace nuestra cabina con esto.** Nuestro flash actual dura 500 ms y eso es una eternidad. Cambiarlo a: 90-140 ms de blanco al 90% + 180 ms de caída de color en el acento de esa toma (cada toma un color distinto de los seis), sincronizado con el sonido de obturador. Implementarlo como capa fija con opacidad animada por GPU (transform/opacity únicamente) para no tocar el hilo principal ni el lazo de análisis de 15 fps. Con prefers-reduced-motion: sin destello — un halo de color que crece 200 ms desde el borde. Además, nunca más de un destello por toma y mínimo 700 ms entre destellos: el criterio de tres destellos por segundo es un límite de accesibilidad, no una preferencia estética.

*Fuente:* https://www.simplebooth.com/blog/photo-booth-lighting-guide/ · https://www.furyu.jp/news/2026/02/centiu/ · https://dime.jp/genre/2025248/

### En la purikura el procesamiento va en VIVO antes del obturador: lo que ves en el espejo es exactamente lo que sale

'撮影ボタンを押す前からリアルタイムで加工が入り、目を大きく、肌を滑らかに、輪郭をシャープにする「理想化されたあなた」を撮ります' — el retoque entra antes de apretar el botón. La cadena japonesa lleva 30 años en esto: 1999 blanqueo multinivel, 2007 agrandado automático de ojos, 2022 retoque por partes con deslizadores, 2025 tres modos (sin filtro / natural / completo).

**Qué hace nuestra cabina con esto.** Regla dura de nuestra pantalla: el espejo muestra el MISMO tratamiento que tendrá la foto final. Cero sorpresas entre el preview y el resultado. Como el presupuesto es un Android de gama media con análisis a 15 fps sobre 640x360, el tratamiento del preview debe ser CSS/GPU (filter: saturate/contrast/sepia, mix-blend-mode, gradientes de la paleta) aplicado a la capa de video, y la misma receta se aplica en el canvas al capturar. Nada de procesamiento por píxel en JS en el lazo de preview. Y de los tres modos japoneses copiamos la ESTRUCTURA (sin filtro / natural / fuerte) pero no el contenido: nuestro 'fuerte' es color y grano, no cara modificada.

*Fuente:* https://thestandardjapan.com/ja/culture/purikura-guide · https://dime.jp/genre/2025248/

### La purikura vende la LUZ como producto, y la elección de luz es un botón, no un ajuste escondido

'プリクラは全体的に光がかかって明るくなり、シミ、肌荒れ、そばかすなどが加工されて見えなくなり、肌が綺麗に見えます' — la clave-alta borra manchas. Los modelos actuales ofrecen dos iluminaciones (normal / flash) y retroiluminación LED. La cabina entera es una caja de luz; por eso los blogs de maquillaje advierten que hay que maquillarse más fuerte porque la luz 'se come' el maquillaje normal.

**Qué hace nuestra cabina con esto.** Sin gabinete, la pantalla es la única fuente de luz que controlamos. Diseñar el marco del espejo como un aro de luz de software: un borde de 80-120 px alrededor del video, en blanco cálido para 'natural' y en degradado de los seis acentos para 'fiesta', con brillo del panel subiendo al máximo durante los últimos 2 s de la cuenta y durante la captura, y volviendo al nivel de ahorro después. Es literalmente iluminación gratis y a la vez es el elemento más llamativo de la pantalla vista desde la entrada de la cabina.

*Fuente:* https://www.belle.ac.jp/archives/column/16509 · https://www.furyu.jp/news/2026/02/centiu/

### El sonido es tres cosas distintas: música que sube el ánimo, una voz que cuenta, y el clic del obturador

En Corea 'a voice counts down before each shot' y las instrucciones existen en inglés, japonés y chino en cabinas abiertas 24 h. En Japón 'カウントダウンが鳴るのでカメラを見る' y las máquinas recientes dejan ELEGIR el BGM del rodaje; el video con audio de la sesión se entrega como extra. La diferencia con Corea: la japonesa habla y anima todo el rato; la coreana casi sólo hace bip.

**Qué hace nuestra cabina con esto.** Tres archivos de audio empaquetados con la app (offline, nada de CDN): tick de cuenta (3 tonos ascendentes, uno por segundo), obturador (~120 ms) y campanita de tanda completa. La voz que cuenta es opcional y entra por bundle como archivos de audio por idioma (es/en), NUNCA sintetizada en línea ni con el nombre de marca dentro del código. Música de fondo: una pista instrumental corta por marca en el bundle, con volumen configurable y silencio total como opción de operación (plaza comercial = puede haber reglas de ruido). Todo lo sonoro tiene equivalente visual porque hay gente sorda: cada tick es también un pulso del anillo de Countdown y un cambio de color.

*Fuente:* https://www.koreaherald.com/article/10503226 · https://www.ragnet.co.jp/purikura-songs · https://detail.chiebukuro.yahoo.co.jp/qa/question_detail/q12291490267

### La guía de pose se muestra en pantalla y se puede APAGAR

FURYU: la máquina AROUND20 '見本ポーズが表示され' (muestra poses de ejemplo) durante el rodaje, y わたウサ mete 'ポーズ見本' en el menú personalizado como sí/no junto al número de fotos. En Corea la guía de pose no está en la pantalla sino en la pared y en las canastas de accesorios, y las poses circulan como contenido social (secuencias de 4 poses concretas para pareja, etc.).

**Qué hace nuestra cabina con esto.** El contrato PoseStep ya existe. Renderizar cada pose como una BlobFace de la familia HACIENDO la pose (silueta grande, 40% de la altura, al lado del espejo, no encima), con el nombre de la pose y una instrucción de 3 palabras máximo desde i18n. Un toque en la BlobFace la apaga para el resto de la sesión (queda un botón chico para traerla de vuelta). Cada pose usa un color de acento distinto, así la secuencia de 6 recorre los seis colores: la marca se percibe como conjunto, que es exactamente lo que pide la identidad.

*Fuente:* https://mery.jp/1059387 · https://xn--u9jugk5freucucg.com/archives/2250

### Varias tomas, varios ENCUADRES: la variedad viene del encuadre, no de que la persona se mueva

CENTI:U trae 3 cámaras con elección de ángulo (arriba / frente / abajo) para capturar cuerpo completo; Meidy da 9 tomas con 2 de 4 encuadres (超アップ primerísimo plano / アップ primer plano / 引き plano abierto / 全身 cuerpo entero). En Corea existen cabinas de 'ángulo alto' como categoría propia.

**Qué hace nuestra cabina con esto.** Una sola cámara, pero el encuadre se simula por recorte digital sobre el sensor: cada PoseStep declara framing 'closeup' | 'medio' | 'abierto'. El espejo hace zoom suave (transform: scale, 400 ms) al encuadre de la toma que viene, de modo que la persona SE VE cambiar de plano y entiende sin leer que esta toma es distinta. Es gratis en cómputo (transform GPU) y da la sensación de 'varias cámaras' que es medio truco de la cabina japonesa. Nada de esto aplica al recorrido documental, donde el encuadre lo manda el preset.

*Fuente:* https://www.furyu.jp/news/2026/02/centiu/ · https://www.furyu.jp/news/202507/meidy/

### Entre una captura y la siguiente hay un tiempo de revisión configurable, y la pantalla nunca queda vacía

El software estándar de cabina (dslrBooth/LumaBooth) expone exactamente tres perillas: 'countdown time before photo 1', 'countdown time before other photos' y 'the time to review the photo after it is taken'; hay que dejar el tiempo entre fotos por encima de 3 s para que la vista en vivo se muestre bien, y el botón de repetir se coloca junto a las miniaturas. La primera cuenta se configura más larga que las siguientes: entrar cuesta más que continuar.

**Qué hace nuestra cabina con esto.** Modelar los tiempos igual: prepareFirstSec (más largo, 8 s: la persona acaba de entrar) > prepareNextSec (5-6 s) + countdownSec (3) + reviewSec (1.2). En el review, la foto recién tomada vuela desde el centro hasta su hueco en el riel de miniaturas (transform 450 ms) — ese vuelo ES el indicador de progreso. Y la pantalla entre tomas jamás se queda en negro ni en 'procesando': muestra el espejo en vivo detrás del vuelo, para que quien se está peinando o acomodando el fleco se siga viendo.

*Fuente:* https://support.lumasoft.co/en/articles/12831550-capture-settings-version-8 · https://support.lumasoft.co/en/articles/12831695-live-view-is-not-working-or-is-dark

### 'Faltan 3 de 8' no se dice con palabras: se ve como una tira que se llena

El formato entero de la categoría es la tira vertical de cuatro (사컷 / 四宫格) y la cabina existe para llenarla. En China el resultado es '4 fotos verticales con marco de marca'. La gente ya sabe cuántas van porque ve la tira.

**Qué hace nuestra cabina con esto.** El indicador de progreso es la propia tira del producto, dibujada a escala en el borde de la pantalla con los huecos vacíos desde el inicio: cada hueco lleno = una toma hecha, con su color de acento. Cero textos de conteo, cero '3/8' — así también se salva la restricción multi-marca (nada que traducir, nada de números escritos en el código). Para lectores de pantalla y para foco de teclado, cada hueco es un elemento con aria-label desde i18n ('foto 3 de 8, pendiente'), que es la accesibilidad real sin anunciarla.

*Fuente:* https://www.jiemian.com/article/14382779.html · https://www.koreaherald.com/article/10503226

### El presupuesto de tiempo real de una sesión, con fila detrás, es de minutos — no de una tarde

Corea: 'the minute-long shoot' para el rodaje, 3-5 minutos totales, 5-10 minutos con selección e impresión; la captura y edición se llevan 3-4 minutos. China: quiosco de centro comercial, '15秒倒计时拍照, 三分钟左右即可取片'; 40-50 sesiones por día en fin de semana y 60-100+ en temporada alta. Eso son ~3 minutos por sesión sostenidos durante horas.

**Qué hace nuestra cabina con esto.** Presupuesto duro de nuestra pantalla de captura: ≤ 75 s desde que arranca la primera preparación hasta la última toma para 6 fotos (8+3 la primera, 6+3 las demás, 1.2 de revisión). Una TimeoutBar delgadísima arriba muestra el avance de la fase completa; si la persona no toca nada, todo avanza solo y la sesión nunca se atora. Toda pantalla intermedia que no sea espejo, cuenta o revisión está prohibida en esta fase: si un ajuste no cabe antes de la primera toma, no existe.

*Fuente:* https://koreapeek.com/korean-photo-booth-guide/ · https://unniespicking.com/hongdae-photo-booth-experience-seoul/ · https://field.10jqka.com.cn/20260410/c675907318.shtml

### La cámara graba TODO, no sólo los instantes de disparo, y el 'detrás de cámaras' es la mitad del atractivo

Prácticamente todas las marcas coreanas entregan, además de la tira, un video de la sesión ('a short video clip', 'sometimes even a video of you behind the scenes taking pictures in the booth'), y CENTI:U entrega 音声付き動画 que captura el ambiente previo al disparo. Lo divertido no es la pose lograda: es el desorden entre poses.

**Qué hace nuestra cabina con esto.** Nosotros no exportamos nada (las fotos nunca salen de la máquina), así que el equivalente honesto es de PANTALLA: guardar en memoria unos cuadros del intervalo entre tomas y, al terminar la tanda, reproducir 3-4 segundos de tira animada en la pantalla de revisión antes de mostrar el resultado. Es el momento de risa que hace que la persona quiera repetir, y no cuesta nada de red. Ojo: se conserva sólo en la sesión y se borra con ella, igual que las capturas; nada de esto aplica al recorrido documental.

*Fuente:* https://www.koreaherald.com/article/10503226 · https://southkoreahallyu.com/korean-photo-booths/ · https://www.furyu.jp/news/2026/02/centiu/

### El idioma se resuelve en la máquina y en el momento, sin cuenta y sin app

Las cabinas coreanas operan 24 h y aceptan instrucciones en inglés, japonés y chino; Meidy soporta inglés, chino simplificado y tradicional, coreano, tailandés y vietnamita. Nadie inicia sesión para eso.

**Qué hace nuestra cabina con esto.** Confirma nuestro camino: i18n empaquetado, sin conexión, con LangSwitch visible pero fuera del camino del pulgar durante la captura, y el idioma elegido persistiendo toda la sesión y reseteándose al volver a reposo. Para una plaza mexicana: es/en obligatorios y paridad de claves verificada por compuerta, que ya existe.

*Fuente:* https://www.koreaherald.com/article/10503226 · https://www.furyu.jp/news/202507/meidy/

### Cifras

- Corea, ritmo de captura: ~10 s por toma para cambiar de pose; el rodaje completo dura ~1 minuto (Korea Herald)
- Corea, tomas: 8-10 encuadres capturados para elegir 4; variante frecuente 6-8 tomas para 4 huecos; con botón de autodisparo, ~8 s por toma
- Corea, repeticiones: 2-3 retomas típicas por sesión, con aviso en pantalla y límite de tiempo (varía por cabina)
- Corea, sesión completa: 3-5 minutos; 5-10 minutos incluyendo selección; captura + edición 3-4 minutos
- Corea, precios 인생네컷: 4,000 KRW por 2 copias, 8,000 KRW por 4, 12,000 KRW por 6 (Korea Herald); rango general 4,000-6,000 KRW por sesión con 2 fotos
- Corea, precios por marca en Hongdae (para 2 personas): 포토스탠드 8,000-10,000 KRW · 인생네컷 10,000-12,000 · 하루필름 11,000-13,000 · Photoism 13,000-15,000 · Photo Signature 14,000-16,000
- Corea, escala: 인생네컷 con ~410 tiendas en el país y 120 millones de visitas acumuladas desde su lanzamiento en 2017; cabinas abiertas 24 h con instrucciones en inglés, japonés y chino
- Corea, entrega digital: código QR válido 24 horas (después caduca)
- Japón, FURYU CENTI:U (feb 2026): modo libre de 200 segundos con máximo 18 fotos; modo guiado de 6 fotos automáticas + ~70 s libres; 3 cámaras con ángulo arriba/frente/abajo; 2 iluminaciones (normal / flash); cabina de 980 mm × 1,560 mm (mitad del tamaño de modelos previos); 9 diseños de impresión
- Japón, FURYU Meidy (17 julio 2025): 9 tomas con 2 encuadres elegidos de 4 (primerísimo plano, primer plano, plano abierto, cuerpo entero); 21 modelos de garabato en 4 temas; 22+2 fondos; fotos tipo carnet en 3 tamaños (4×3 cm, 3×2.4 cm, 4.5×3.5 cm); 6 idiomas
- Japón, FURYU わたウサ: número de fotos configurable de 1 a 12; poses de muestra, garabato y edición de sticker activables o desactivables; saltarse el garabato ahorra hasta 4 minutos
- Japón, otras máquinas: NICO MAKE hasta 19 tomas (4 + 15); PURICO 8 cortes + 2 extra; sesión típica de purikura ~6 fotos
- Japón, precio: 400-600 JPY por sesión (habitual meter ~500 JPY en monedas de 100)
- Japón, cronología del retoque en vivo: 1999 clave alta con blanqueo multinivel; 2007 agrandado automático de ojos; 2015 monitor de vista en vivo; 2022 retoque por partes con deslizadores; 2025 tres modos (sin filtro / natural / completo); 30 años de la categoría en 2025
- China, quiosco de centro comercial: 1-2 m² de superficie; 15 segundos de cuenta regresiva; ~3 minutos de principio a fin; 4-6 fotos por sesión
- China, precio: 29.9-49.9 CNY por sesión, siendo lo más común 35-39.9 CNY
- China, operación: 40-50 sesiones/día en fin de semana, 60-100+ en temporada alta; inversión inicial ~80,000 CNY; margen bruto hasta 50%; software ~1,000 CNY/mes; comisión de marca licenciada 30%; recuperación de la inversión en 5-12 meses
- Software estándar de cabina (dslrBooth/LumaBooth): tres tiempos configurables — cuenta antes de la foto 1, cuenta antes de las demás, y tiempo de revisión tras cada foto; la vista en vivo requiere más de 3 segundos entre fotos para mostrarse correctamente
- Nuestro presupuesto propuesto, derivado de lo anterior: preparación 8 s (primera) / 5-6 s (siguientes) + cuenta 3 s + revisión 1.2 s = ≤ 75 s para 6 tomas; flash de pantalla de 90-140 ms con mínimo 700 ms entre destellos y máximo uno por toma; área táctil ≥ 96 px en decisiones de repetir (mínimo duro del proyecto: 64 px)

### Lo que sería un error copiar

- Los 200 segundos de rodaje libre y las 18 fotos de la máquina japonesa. En un arcade japonés la cabina es el destino; en una plaza mexicana hay alguien esperando detrás y el aparato es uno solo. Un tope de 60-75 s y 6-8 tomas mantiene la fila viva y el ingreso por hora alto.
- El retoque facial agresivo de la purikura: ojos agrandados automáticamente, blanqueo de piel multinivel, adelgazamiento de cara. Además de que choca de frente con la restricción de fidelidad documental, un deslizador de 'piel más blanca' en México no es un filtro divertido: es un mensaje racial que no queremos firmar. La alegría debe venir del color, el grano, el encuadre y las formas de la marca, no de cambiarle la cara a la persona.
- La entrega por QR, correo o app. La categoría entera se sostiene en 'escanea para bajar tus fotos' y nosotros tenemos la restricción contraria: las fotos nunca salen de la máquina y no hay cuenta ni contraseña. No hay que dejar el hueco de ese patrón visible en la pantalla; hay que reemplazarlo con algo que se disfrute ahí mismo.
- El control remoto físico, la canasta de accesorios y la cortina. Son piezas de gabinete, y el gabinete todavía no existe. Diseñar la pantalla asumiendo un remoto en la mano nos deja con una interfaz que no se puede tocar; el obturador tiene que vivir en el vidrio, al alcance del pulgar, desde el primer día.
- La tira de papel y toda la fase de garabato/stickers copiada tal cual, con sus límites de 4 minutos. No hay impresión, y la edición larga es justo la parte que la propia industria japonesa está recortando con funciones de 'saltar'.
- La voz que anima todo el rato al estilo japonés. En un pasillo de plaza, una máquina que habla sin parar es ruido para los locales vecinos y un problema de operación; además, una voz grabada con personalidad de marca metida en el código rompe la plataforma multi-marca. La voz, si existe, es un archivo del bundle, opcional y silenciable.
- Los diez segundos de espera vacía entre tomas de las cabinas coreanas. Ahí la gente se queda parada sin saber qué hacer y sale rígida en la siguiente foto. Nosotros llenamos ese hueco con la pose que viene, el vuelo de la miniatura y el cambio de encuadre.
- La pantalla de selección con cronómetro contra reloj ('decide rápido, hay límite'). Genera ansiedad y es donde se atoran los grupos. Preferimos sobre-capturar y proponer una selección automática ya hecha, que la persona puede cambiar si quiere, en vez de obligarla a elegir 4 de 10 con el reloj encima.
- El destello blanco a pantalla completa repetido o largo. Más de tres destellos por segundo es un riesgo real de convulsión fotosensible y una falla de accesibilidad; nuestro flash es uno por toma, corto, con separación mínima, y desaparece con prefers-reduced-motion.
- La cuenta regresiva que sólo suena. Si el 'bip' es la única señal de disparo, la persona sorda se pierde el momento exacto. Todo cue sonoro va acompañado de un cambio de color y de escala en pantalla.
- Los marcos con propiedad intelectual licenciada (Disney, Sanrio, grupos de K-pop) que sostienen el negocio chino. Es un modelo legal y comercial que no tenemos, y meter esos nombres en la interfaz violaría además la compuerta de marcas.
- El multi-cámara físico con ángulo alto y bajo. Tres cámaras es hardware que no existe todavía; el mismo efecto se consigue con recorte digital sobre un solo sensor y no cuesta nada.
- El espejo con la interfaz encima. La tentación es llenar el espejo de controles porque hay espacio; pero el espejo es donde la persona se está mirando, y cada elemento encima le tapa la cara justo cuando decide su pose. Los controles van en marco, no sobre el rostro.

