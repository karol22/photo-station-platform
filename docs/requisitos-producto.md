# PROMPT MAESTRO — REQUISITOS DE PRODUCTO PARA UNA PLATAFORMA DE ESTACIONES FOTOGRÁFICAS

## Contexto

Estamos construyendo una plataforma de software para una empresa de estaciones fotográficas físicas de autoservicio. El producto debe poder iniciar con una sola máquina y crecer hasta operar una red grande de máquinas propias, ubicaciones administradas por terceros y eventualmente una red de franquicias.

Las estaciones pueden cumplir varios usos con el mismo hardware:

- Fotografías para documentos, trámites, escuela, graduación o credenciales.
- Fotografías profesionales o semiprofesionales de autoservicio.
- Fotografías de entretenimiento.
- Tiras fotográficas y composiciones impresas.
- Fotografías térmicas estilo recibo cuando el hardware lo permita.
- Edición local de fotografías.
- Experiencias temáticas y campañas estacionales.
- En el futuro, experiencias basadas en proveedores externos de IA, pagos, mensajería u otros servicios.

El valor principal del producto debe estar en el software, la experiencia de usuario, la personalización de cada máquina, la administración centralizada, la operación de una flota y la capacidad de adaptar la misma plataforma a distintas marcas, franquiciatarios, ubicaciones y tipos de hardware.

## Instrucción principal para el agente

Construye el producto siguiendo los requisitos funcionales y de experiencia definidos en este documento.

**No propongas una arquitectura nueva, no discutas stacks, frameworks, bases de datos, protocolos, librerías ni decisiones de infraestructura salvo que el repositorio ya las imponga y sea estrictamente necesario continuar el trabajo.** Este documento define **qué debe poder hacer el producto**, no cómo debe implementarse.

En esta etapa **NO se deben implementar integraciones reales con APIs o servicios de terceros** como procesadores de pago, proveedores de IA generativa, WhatsApp, SMS, correo transaccional, almacenamiento externo, CRM externo o sistemas fiscales. Sin embargo, la experiencia de producto debe quedar preparada para representar esos estados y funciones cuando sea necesario, mediante estados locales, simulados, manuales o deshabilitados, sin acoplar la experiencia de usuario a un proveedor concreto.

El sistema sí debe llegar tan lejos como sea razonable usando capacidades locales: captura, validación visual, edición, composición, administración, configuración, almacenamiento local de sesión, gestión de activos, plantillas, permisos, flota, personalización, versionado de configuraciones y experiencia completa de kiosco.

---

# 1. PRINCIPIOS DEL PRODUCTO

## 1.1 Plataforma, no una sola fotocabina

El producto debe asumir desde el inicio que existirán:

- múltiples máquinas;
- múltiples ubicaciones;
- múltiples ciudades;
- múltiples operadores;
- múltiples marcas;
- múltiples franquiciatarios;
- múltiples configuraciones de hardware;
- múltiples catálogos de productos;
- múltiples listas de precios;
- múltiples campañas visuales;
- múltiples versiones de software y configuración en circulación al mismo tiempo.

Ninguna pantalla administrativa importante debe asumir que sólo existe una máquina.

## 1.2 Configurable sin perder consistencia

La plataforma debe permitir mucha personalización por organización, franquicia, ubicación y máquina, pero debe conservar una experiencia coherente y controlable desde el nivel superior.

## 1.3 El hardware no define el producto

Una máquina puede tener distintas capacidades. El producto debe representar explícitamente capacidades como:

- cámara disponible;
- pantalla táctil;
- impresora fotográfica;
- impresora térmica;
- iluminación controlable;
- impresora a color;
- impresión blanco y negro;
- lector de pago futuro;
- conectividad disponible;
- almacenamiento local;
- cámara frontal o secundaria;
- sensores adicionales.

Las funciones visibles para el cliente deben depender de las capacidades y permisos configurados para esa máquina.

## 1.4 Offline y operación local

La experiencia esencial de una sesión debe poder ejecutarse localmente siempre que las funciones requeridas por ese producto estén disponibles en la propia máquina.

La pérdida de conexión no debe destruir una sesión activa ni impedir funciones locales que no necesiten servicios externos.

## 1.5 Privacidad por diseño

Las fotografías son datos especialmente sensibles para la experiencia del usuario. El producto debe minimizar retención innecesaria, explicar el tratamiento de imágenes y permitir políticas diferenciadas según el tipo de producto.

## 1.6 Separación estricta entre fotografía documental y fotografía creativa

Las fotografías destinadas a documentos o trámites deben usar únicamente transformaciones permitidas para preservar fidelidad de la imagen.

Las funciones creativas, filtros fuertes, modificaciones faciales, estilización o futuras funciones generativas nunca deben aplicarse automáticamente a una fotografía de documento.

---

# 2. MODELO ORGANIZACIONAL Y JERARQUÍA DE NEGOCIO

El producto debe soportar una jerarquía flexible como mínimo con los siguientes niveles conceptuales:

1. Plataforma / empresa matriz.
2. Organización operadora o marca.
3. Franquiciatario o grupo operador.
4. Región o territorio.
5. Ubicación física.
6. Máquina.

No todos los clientes deben utilizar todos los niveles.

## 2.1 Empresa matriz

Debe poder:

- ver toda la red;
- crear y administrar organizaciones;
- crear franquiciatarios;
- asignar territorios;
- controlar funciones disponibles;
- definir configuraciones globales;
- imponer configuraciones obligatorias;
- definir qué elementos pueden ser personalizados por niveles inferiores;
- consultar auditoría global;
- gestionar versiones y despliegues;
- suspender una organización, ubicación o máquina;
- controlar campañas globales;
- distribuir plantillas y presets oficiales;
- administrar branding maestro;
- acceder a soporte y diagnósticos según permisos.

## 2.2 Organización / marca

Cada organización debe poder tener:

- nombre comercial;
- nombre legal opcional;
- logotipo;
- colores de marca;
- tipografía o estilos visuales configurables cuando el producto lo permita;
- textos legales;
- aviso de privacidad;
- términos de servicio;
- información de soporte;
- idiomas permitidos;
- moneda;
- zona horaria;
- país;
- formato de fecha y hora;
- catálogo de productos;
- plantillas visuales;
- presets documentales;
- políticas de retención;
- lista de funciones autorizadas;
- límites operativos;
- usuarios internos.

## 2.3 Franquiciatarios

La plataforma debe soportar franquiciatarios como entidades independientes bajo reglas definidas por la marca.

Cada franquiciatario debe poder:

- administrar únicamente su red autorizada;
- tener usuarios propios;
- gestionar sus ubicaciones;
- gestionar sus máquinas;
- visualizar sus métricas;
- recibir campañas obligatorias de la marca;
- crear campañas locales si tiene permiso;
- personalizar ciertos elementos si tiene permiso;
- administrar precios dentro de rangos permitidos si la marca lo autoriza;
- solicitar soporte;
- ver historial de cambios aplicados a sus máquinas;
- consultar estado de software/configuración;
- revisar reportes operativos;
- registrar mantenimiento;
- ver incidencias.

La empresa matriz debe poder limitar explícitamente qué puede o no modificar cada franquiciatario.

## 2.4 Territorios

Debe poder asociarse un franquiciatario u operador con uno o más territorios y registrar:

- país;
- estado/provincia;
- ciudad;
- zona comercial;
- territorio contractual textual;
- fecha de inicio;
- fecha de expiración opcional;
- notas;
- exclusividad sí/no;
- estado activo/inactivo.

No es necesario automatizar validaciones legales de exclusividad, pero debe existir representación administrativa de estos datos.

## 2.5 Ubicaciones físicas

Cada ubicación debe incluir al menos:

- nombre interno;
- nombre mostrado al público;
- tipo de establecimiento;
- dirección;
- ciudad;
- región;
- país;
- zona horaria;
- datos del responsable local;
- horario de operación;
- notas de acceso;
- instrucciones para técnicos;
- fotografías de referencia del lugar;
- identificador interno;
- organización propietaria;
- franquiciatario u operador responsable;
- máquinas instaladas;
- estado operativo;
- fecha de instalación;
- fecha de retiro opcional;
- tags o etiquetas personalizadas.

Tipos de ubicación sugeridos:

- centro comercial;
- cine;
- cafetería;
- restaurante;
- hotel;
- universidad;
- escuela;
- terminal de transporte;
- arcade;
- tienda;
- evento;
- atracción turística;
- oficina;
- ubicación temporal;
- otro.

---

# 3. ROLES, USUARIOS Y PERMISOS

El producto debe utilizar permisos granulares y alcance organizacional.

## 3.1 Tipos de usuarios internos

Como mínimo debe contemplar:

- propietario de plataforma;
- superadministrador;
- administrador de marca;
- propietario de franquicia;
- gerente regional;
- gerente de ubicación;
- operador;
- técnico de mantenimiento;
- diseñador / gestor de contenido;
- analista;
- auditor / sólo lectura;
- soporte interno;
- usuario temporal de soporte.

## 3.2 Permisos

Los permisos deben poder controlar, por separado, acciones como:

- ver organizaciones;
- crear organizaciones;
- editar organizaciones;
- ver ubicaciones;
- crear ubicaciones;
- editar ubicaciones;
- ver máquinas;
- editar máquinas;
- reiniciar o colocar una máquina en modo mantenimiento;
- cambiar precios;
- publicar campañas;
- gestionar plantillas;
- gestionar presets documentales;
- ver fotografías cuando una política excepcional lo permita;
- ver métricas;
- exportar datos;
- administrar usuarios;
- modificar permisos;
- administrar funciones habilitadas;
- gestionar despliegues;
- realizar rollback;
- ver logs de auditoría;
- administrar branding;
- cambiar políticas de privacidad;
- registrar mantenimiento;
- cerrar incidencias.

## 3.3 Alcance

Un permiso debe poder limitarse a:

- toda la plataforma;
- una organización;
- un franquiciatario;
- una región;
- una ubicación;
- una o varias máquinas.

## 3.4 Acceso de soporte

Debe existir una modalidad de soporte con:

- acceso explícitamente autorizado;
- duración limitada;
- alcance definido;
- motivo registrado;
- acciones auditadas;
- posibilidad de revocación inmediata.

---

# 4. UI PRINCIPAL DE LA MÁQUINA — EXPERIENCIA DEL CLIENTE

La interfaz de la máquina debe estar diseñada para personas sin entrenamiento y para sesiones rápidas.

Debe funcionar bien con pantalla táctil y no depender de teclado o mouse.

## 4.1 Estado de atracción / idle

Cuando no exista una sesión activa, la máquina debe poder mostrar:

- branding de la ubicación o marca;
- animación o imagen promocional;
- categorías de productos destacadas;
- precio inicial o rango de precios cuando esté configurado;
- llamada a la acción clara;
- idioma actual;
- acceso a selector de idioma;
- aviso discreto de videovigilancia si aplica;
- información mínima de privacidad;
- promoción activa;
- campaña estacional;
- indicación de disponibilidad de impresión;
- estado de servicio cuando alguna función no esté disponible.

La pantalla de atracción debe poder rotar contenido según programación local.

## 4.2 Pantalla de inicio

Debe poder presentar categorías como:

- Fotos para documentos.
- Graduación / escuela.
- Retrato profesional.
- Fotos divertidas.
- Tira fotográfica.
- Foto estilo recibo.
- Retrato temático.
- Experiencias creativas locales.
- Funciones futuras de IA, si están habilitadas.

Cada máquina debe poder ocultar cualquier categoría no disponible.

## 4.3 Descripción de producto

Antes de iniciar, cada producto debe poder mostrar:

- nombre;
- ejemplo visual;
- descripción breve;
- qué recibe el cliente;
- número de capturas;
- número de impresiones;
- formato de impresión;
- tiempo estimado;
- precio cuando corresponda;
- restricciones relevantes;
- aviso de privacidad relacionado;
- disponibilidad actual.

## 4.4 Sesión

Toda sesión debe tener un ciclo claro de:

- inicio;
- selección de producto;
- configuración del producto;
- captura;
- revisión;
- edición si aplica;
- composición;
- confirmación;
- impresión si aplica;
- entrega o finalización;
- eliminación/retención según política;
- retorno al estado de atracción.

Debe existir una acción visible para cancelar antes de finalizar, respetando las reglas de cada etapa.

## 4.5 Temporización

La interfaz debe contemplar:

- timeout por inactividad;
- advertencia antes de cancelar una sesión;
- tiempo de preparación antes de captura;
- cuenta regresiva;
- tiempo máximo de revisión;
- timeout especial cuando hay niños, grupos o accesibilidad habilitada;
- recuperación después de pausas cortas.

Los tiempos deben ser configurables por producto o máquina.

---

# 5. MODO DE FOTOGRAFÍAS PARA DOCUMENTOS

Este modo es prioritario y debe estar separado de las experiencias creativas.

## 5.1 Selección del tipo de trámite

El cliente debe poder seleccionar mediante una biblioteca organizada por:

- país;
- institución;
- tipo de trámite;
- escuela/universidad;
- tamaño solicitado;
- tipo de fotografía.

Debe existir búsqueda y categorías cuando el catálogo sea grande.

Ejemplos de categorías:

- universidad;
- título;
- certificado;
- graduación;
- cartilla;
- credencial;
- solicitud de empleo;
- visa extranjera;
- licencia o trámite local;
- fotografía infantil;
- fotografía tamaño diploma;
- perfil profesional.

No se debe prometer aceptación universal de un formato cuando no exista garantía.

## 5.2 Preset documental

Cada preset debe poder registrar:

- nombre;
- institución;
- país/región;
- vigencia;
- ancho físico;
- alto físico;
- orientación;
- color o blanco y negro;
- tipo de fondo esperado;
- relación de aspecto;
- tamaño mínimo del rostro;
- tamaño máximo del rostro;
- posición esperada de ojos;
- posición esperada de cabeza;
- distancia o proporción de coronilla a barbilla;
- margen superior;
- margen lateral;
- visibilidad de hombros;
- expresión requerida;
- reglas sobre sonrisa;
- reglas sobre lentes;
- reglas sobre cabello;
- reglas sobre accesorios;
- reglas sobre sombreros o cubiertas;
- reglas sobre uniforme/vestimenta si aplica;
- reglas sobre retoque;
- tipo de papel recomendado;
- acabado recomendado;
- cantidad de copias;
- plantilla de impresión;
- instrucciones al cliente;
- fuente o referencia administrativa opcional;
- fecha de última revisión;
- notas internas;
- estado activo/deprecado.

## 5.3 Asistente visual de posición

Durante la captura documental la UI debe poder indicar en tiempo real:

- rostro detectado o no detectado;
- más de un rostro detectado;
- rostro demasiado grande;
- rostro demasiado pequeño;
- rostro demasiado alto/bajo;
- rostro demasiado a la izquierda/derecha;
- cabeza inclinada;
- rostro girado;
- mirada fuera del frente cuando el preset lo requiera;
- ojos cerrados;
- obstrucción significativa del rostro;
- cabello o accesorio problemático cuando sea detectable;
- iluminación insuficiente;
- iluminación excesiva;
- contraste insuficiente;
- fondo no uniforme;
- sombras fuertes;
- desenfoque o movimiento;
- reflejo excesivo en lentes;
- distancia incorrecta;
- encuadre no válido.

## 5.4 Instrucciones de corrección

La UI debe traducir las validaciones a instrucciones simples como:

- Muévete un poco a la izquierda.
- Muévete un poco a la derecha.
- Acércate.
- Aléjate.
- Levanta ligeramente la barbilla.
- Baja ligeramente la barbilla.
- Mira al frente.
- Mantén la cabeza recta.
- Abre los ojos.
- Evita sonreír para este formato.
- Retira los lentes para este trámite.
- Acomoda el cabello para mostrar el rostro.
- Espera a que la cámara enfoque.

La máquina no debe mostrar terminología técnica al cliente cuando una instrucción humana sea suficiente.

## 5.5 Estado visual de cumplimiento

Debe existir una representación clara de:

- criterios correctos;
- criterios pendientes;
- criterios que impiden captura automática;
- criterios que son recomendaciones pero no bloquean.

## 5.6 Captura automática

Cuando el producto lo permita, la máquina debe poder tomar la foto automáticamente cuando:

- se detecte una persona válida;
- se cumplan los criterios obligatorios;
- la posición se mantenga estable durante un periodo configurable.

Debe existir también captura manual si el producto y la configuración lo permiten.

## 5.7 Revisión documental

Después de capturar, el cliente debe poder ver:

- fotografía final recortada;
- guía visual del encuadre;
- criterios aprobados;
- advertencias existentes;
- opción de repetir;
- opción de confirmar.

## 5.8 Edición permitida para documentos

Las herramientas disponibles deben estar limitadas a operaciones compatibles con fidelidad documental, según el preset:

- recorte;
- reencuadre;
- rotación mínima para nivelar;
- exposición;
- brillo;
- contraste;
- balance básico;
- conversión a blanco y negro si el preset lo requiere;
- ajuste de fondo solamente cuando sea permitido;
- eliminación de márgenes externos no relacionados con la identidad.

Debe ser posible deshabilitar por completo edición manual.

Funciones creativas o de alteración facial deben estar prohibidas en este modo.

## 5.9 Composición de impresión documental

Debe poder generar hojas con:

- una o múltiples copias;
- tamaños físicos correctos;
- separación entre fotografías;
- marcas de corte opcionales;
- orientación automática;
- combinación eficiente de copias;
- vista previa del resultado físico.

## 5.10 Historial de presets

Si un preset cambia, debe conservarse referencia a la versión utilizada en sesiones previas sin modificar retrospectivamente dichas sesiones.

---

# 6. MODO DE ENTRETENIMIENTO

## 6.1 Experiencias

La máquina debe poder ofrecer experiencias como:

- pareja;
- mejores amigos;
- familia;
- cumpleaños;
- graduación;
- fiesta;
- cine;
- terror;
- Navidad;
- Día de Muertos;
- San Valentín;
- retro;
- kawaii;
- minimalista;
- viaje;
- marca patrocinadora;
- campaña de ubicación.

Las experiencias deben ser configurables y no requerir cambios de código para variar textos, imágenes, marcos o secuencia.

## 6.2 Secuencia de poses

Una experiencia puede definir una secuencia de una o más capturas.

Cada captura puede mostrar:

- nombre de la pose;
- ejemplo;
- silueta de referencia;
- instrucciones cortas;
- cuenta regresiva;
- indicador de posición;
- indicador de número de foto dentro de la sesión.

## 6.3 Guía visual local

Cuando esté habilitada, la interfaz puede orientar al cliente respecto a:

- número de personas esperado;
- posición dentro del cuadro;
- distancia entre personas;
- visibilidad del rostro;
- espacio alrededor de la cabeza;
- composición general;
- inclinación excesiva;
- ubicación dentro de zonas sugeridas.

Estas reglas son orientativas en modo entretenimiento y no deben bloquear necesariamente la captura.

## 6.4 Repetición

Cada experiencia debe poder definir:

- cantidad máxima de retakes;
- si el usuario puede repetir cada foto;
- si puede repetir la sesión completa;
- si se conserva la captura anterior temporalmente para comparar.

## 6.5 Selección final

Cuando se tomen varias fotografías, el cliente debe poder:

- seleccionar favoritas;
- eliminar una captura de la composición;
- reordenar cuando el template lo permita;
- comparar capturas;
- confirmar selección.

---

# 7. EDICIÓN LOCAL DE FOTOGRAFÍA

La plataforma debe incluir una experiencia de edición local que no dependa de APIs externas.

## 7.1 Herramientas básicas

Debe poder incluir:

- recorte;
- relación de aspecto;
- rotación;
- espejo horizontal cuando el producto lo permita;
- brillo;
- contraste;
- exposición;
- saturación;
- temperatura;
- blanco y negro;
- intensidad del filtro;
- nitidez moderada;
- viñeta si el producto creativo lo permite;
- escala de grises;
- presets visuales locales.

## 7.2 Edición creativa

Para productos no documentales debe poder incluir:

- marcos;
- stickers;
- ilustraciones;
- texto;
- fecha;
- nombre de ubicación;
- logotipo de campaña;
- patrones;
- fondos gráficos;
- máscaras decorativas;
- overlays;
- sellos;
- códigos o identificadores visuales de campaña;
- firmas o mensajes cortos del usuario.

## 7.3 Controles táctiles

La edición debe ser cómoda en touchscreen y evitar controles pequeños.

Debe existir:

- deshacer;
- rehacer;
- restaurar;
- vista antes/después;
- confirmar;
- cancelar cambios.

## 7.4 Límites

Cada producto o experiencia debe poder definir qué herramientas están permitidas.

## 7.5 Presets

Debe poder existir una biblioteca de presets de edición asociable a:

- organización;
- franquicia;
- ubicación;
- máquina;
- campaña;
- producto;
- temporada.

---

# 8. PLANTILLAS DE IMPRESIÓN Y COMPOSICIÓN

## 8.1 Tipos

Debe soportar conceptualmente:

- tira vertical;
- tira horizontal;
- cuadrícula;
- una fotografía completa;
- collage;
- tarjeta;
- postal;
- recibo térmico;
- hoja de fotos documentales;
- formato personalizado.

## 8.2 Elementos configurables

Una plantilla puede incluir:

- fotografías;
- texto;
- logotipo;
- marco;
- fondo;
- fecha;
- ubicación;
- QR futuro;
- mensaje promocional;
- disclaimer;
- número de sesión;
- sponsor;
- marca del franquiciatario;
- marca de la plaza o negocio anfitrión.

## 8.3 Variantes

Una plantilla debe poder tener variantes por:

- idioma;
- orientación;
- impresora;
- tamaño de papel;
- marca;
- ubicación;
- evento;
- temporada.

## 8.4 Vista previa

El administrador debe poder previsualizar una plantilla usando fotografías de ejemplo antes de publicarla.

---

# 9. CATÁLOGO DE PRODUCTOS

Cada organización debe poder crear productos comerciales independientes de la máquina física.

## 9.1 Datos de producto

Cada producto debe poder contener:

- nombre interno;
- nombre mostrado;
- categoría;
- descripción;
- imagen de portada;
- video/animación promocional opcional;
- duración estimada;
- número de fotos;
- número de impresiones;
- formato de salida;
- template;
- preset documental si aplica;
- edición permitida;
- retakes permitidos;
- precio;
- moneda;
- impuestos informativos configurados;
- instrucciones;
- términos específicos;
- requerimientos de hardware;
- funciones requeridas;
- horarios de disponibilidad;
- fecha de inicio/fin;
- estado activo/inactivo;
- prioridad de aparición.

## 9.2 Disponibilidad

Un producto debe poder estar disponible por:

- organización completa;
- franquicia;
- región;
- ubicación;
- máquina específica.

## 9.3 Compatibilidad

La administración debe advertir cuando se intenta publicar un producto en una máquina que no tiene capacidades suficientes.

---

# 10. PRECIOS, PROMOCIONES Y ESTADOS DE PAGO

No implementar un procesador de pagos real en esta etapa.

Sin embargo, el producto debe representar correctamente los conceptos comerciales para no rehacer la UI más adelante.

## 10.1 Precio

Debe poder configurarse por:

- producto;
- organización;
- franquicia;
- ubicación;
- máquina;
- horario;
- temporada.

Debe existir herencia de precio con posibilidad de override cuando el nivel superior lo permita.

## 10.2 Promociones

Debe poder definirse:

- descuento fijo;
- descuento porcentual;
- precio promocional;
- segunda impresión;
- producto gratuito;
- bundle;
- promoción por horario;
- promoción por fecha;
- campaña local;
- código promocional manual o futuro.

## 10.3 UI de pago futura

La UI del kiosco debe tener estados preparados para:

- esperando pago;
- pago iniciado;
- pago aprobado;
- pago rechazado;
- pago cancelado;
- pago expirado;
- pago en revisión;
- pago no disponible;
- dispositivo de pago fuera de servicio;
- operación gratuita;
- modo demo;
- sesión iniciada manualmente por operador.

En esta etapa estos estados pueden activarse de forma local, administrativa o simulada.

## 10.4 Registro comercial local

Cada sesión debe poder registrar un estado comercial aun sin procesador real:

- gratis;
- demo;
- pagada simulada;
- cortesía;
- promoción;
- anulada;
- fallida.

---

# 11. EXPERIENCIAS FUTURAS DE IA — REQUISITOS DE UI, NO INTEGRACIÓN

No implementar llamadas reales a proveedores de IA en esta etapa.

La plataforma debe poder representar funciones futuras sin hacerlas parte obligatoria del flujo actual.

## 11.1 Catálogo de experiencias futuras

Debe existir soporte conceptual para experiencias como:

- estilización;
- retrato temático;
- cambio artístico;
- poster;
- caricatura;
- anime;
- estilo cinematográfico;
- generación de variaciones;
- video corto;
- imagen animada.

## 11.2 Consentimiento separado

Antes de cualquier procesamiento externo futuro, la UI deberá poder mostrar:

- qué se enviará;
- finalidad;
- proveedor o categoría de proveedor cuando corresponda;
- política de retención conocida;
- consentimiento explícito;
- alternativa para continuar sin dicha función.

## 11.3 Estados

La UI debe contemplar:

- función no disponible;
- próxima función;
- procesando;
- resultado listo;
- error;
- reintento;
- resultado rechazado/moderado;
- servicio temporalmente deshabilitado.

Por ahora estos estados sólo deben ser representables, no conectarse con un proveedor real.

---

# 12. ADMINISTRACIÓN LOCAL DE LA MÁQUINA

Debe existir una interfaz protegida para técnicos/operadores en cada máquina.

## 12.1 Acceso

Debe requerir autenticación o mecanismo autorizado y nunca ser accesible accidentalmente por el cliente.

## 12.2 Estado general

Debe mostrar como mínimo:

- identificador de máquina;
- nombre;
- ubicación;
- organización;
- estado de la cámara;
- estado de cada impresora;
- papel estimado;
- almacenamiento disponible;
- conectividad;
- versión instalada;
- configuración activa;
- fecha de última sincronización;
- hora local;
- estado de servicios locales relevantes;
- sesiones recientes;
- errores recientes.

## 12.3 Pruebas locales

El técnico debe poder ejecutar pruebas de:

- cámara;
- preview;
- captura;
- impresión;
- iluminación cuando sea controlable;
- touchscreen;
- audio cuando exista;
- almacenamiento;
- red;
- flujo de sesión demo;
- impresión de prueba;
- composición de prueba.

## 12.4 Mantenimiento

Debe poder:

- poner máquina fuera de servicio;
- mostrar mensaje personalizado al público;
- activar modo mantenimiento;
- limpiar sesiones temporales;
- revisar consumibles;
- registrar cambio de papel;
- registrar mantenimiento;
- registrar reparación;
- registrar incidencia;
- cerrar incidencia;
- consultar checklist de mantenimiento.

## 12.5 Configuración local permitida

Según permisos, debe poder modificar:

- brillo de pantalla;
- volumen;
- idioma por defecto;
- horario;
- timeout;
- cámara activa;
- impresora activa;
- orientación;
- calibración visual;
- modo demo;
- identificadores de hardware;
- disponibilidad temporal de productos.

Cambios sensibles deben quedar auditados.

---

# 13. GESTIÓN CENTRAL DE MÁQUINAS

## 13.1 Inventario de máquinas

La administración debe presentar una lista filtrable con:

- nombre;
- código;
- organización;
- franquicia;
- ubicación;
- ciudad;
- hardware profile;
- capacidades;
- versión de software;
- versión de configuración;
- estado online/offline;
- último contacto;
- estado operativo;
- incidencias;
- consumibles estimados;
- sesiones recientes;
- fecha de instalación.

## 13.2 Página de detalle

Cada máquina debe tener una página con:

- resumen;
- configuración;
- productos;
- precios;
- branding;
- plantillas;
- presets;
- historial de sesiones;
- métricas;
- errores;
- mantenimiento;
- despliegues;
- auditoría;
- archivos/activos asignados;
- notas internas;
- fotografías de instalación;
- responsable local.

## 13.3 Estado operativo

Estados sugeridos:

- configurando;
- activa;
- activa con advertencias;
- mantenimiento;
- fuera de servicio;
- desconectada;
- retirada;
- almacenamiento;
- demo;
- suspendida.

## 13.4 Grupos

Debe poder agrupar máquinas por:

- ciudad;
- región;
- franquiciatario;
- hardware;
- versión;
- campaña;
- tipo de ubicación;
- tags personalizados.

Las acciones masivas deben respetar permisos y mostrar claramente el alcance antes de confirmar.

---

# 14. PERFILES DE HARDWARE Y CAPACIDADES

Debe poder definirse un perfil de hardware sin asumir una sola configuración física.

Un perfil debe poder indicar:

- tipo de cámara;
- cantidad de cámaras;
- resolución esperada;
- orientación;
- impresoras disponibles;
- tipos de impresión;
- tamaños de papel;
- color/blanco y negro;
- touchscreen;
- resolución de pantalla;
- orientación de pantalla;
- iluminación disponible;
- almacenamiento mínimo esperado;
- periféricos;
- lector de pago futuro;
- capacidad de audio;
- sensores disponibles;
- capacidades adicionales.

Cada máquina debe indicar qué capacidades están presentes y operativas.

---

# 15. PERSONALIZACIÓN / WHITE LABEL

El producto debe poder operar diferentes marcas sin bifurcar el producto.

## 15.1 Branding

Debe poder personalizar:

- nombre público;
- logotipo;
- logo secundario;
- paleta visual;
- fondos;
- iconografía permitida;
- imágenes de attract screen;
- mensajes;
- tono textual;
- footer;
- términos;
- privacidad;
- pantalla de finalización;
- marca en impresiones;
- sponsor;
- co-branding.

## 15.2 Niveles de herencia

La personalización debe poder heredarse y sobreescribirse según permisos desde:

- marca;
- franquicia;
- región;
- ubicación;
- máquina;
- campaña.

Debe ser visible qué valor proviene de qué nivel.

## 15.3 Configuraciones bloqueadas

La empresa matriz debe poder declarar configuraciones como:

- obligatorias;
- editables;
- editables dentro de un rango;
- no visibles para franquiciatarios.

---

# 16. CAMPAÑAS Y CONTENIDO ESTACIONAL

## 16.1 Campaña

Una campaña puede contener:

- nombre;
- descripción;
- fecha de inicio;
- fecha de fin;
- ubicaciones objetivo;
- máquinas objetivo;
- productos;
- precios promocionales;
- plantillas;
- imágenes;
- videos/animaciones locales;
- textos;
- marca patrocinadora;
- experiencia específica;
- prioridad;
- estado borrador/programada/activa/finalizada.

## 16.2 Programación

Debe poder programarse anticipadamente y activarse/desactivarse de acuerdo con fecha/hora local de la ubicación.

## 16.3 Previsualización

Un administrador debe poder ver cómo se verá una campaña en una máquina específica antes de publicarla.

---

# 17. GESTIÓN DE ACTIVOS DE CONTENIDO

Debe existir una biblioteca administrable de activos como:

- logos;
- fondos;
- marcos;
- stickers;
- imágenes de ejemplo;
- pantallas promocionales;
- videos locales;
- instrucciones visuales;
- siluetas de pose;
- iconos;
- plantillas;
- recursos legales.

Cada activo debe poder tener:

- nombre;
- categoría;
- propietario;
- tags;
- fecha de creación;
- estado;
- versión;
- idiomas;
- resolución/dimensiones;
- vigencia;
- campaña asociada;
- restricciones de uso.

No debe ser posible eliminar silenciosamente un activo utilizado por configuraciones activas sin advertencia.

---

# 18. FEATURE ACCESS, ENTITLEMENTS Y FLAGS

El producto debe permitir habilitar o deshabilitar capacidades sin modificar toda la experiencia.

## 18.1 Por nivel

Una función puede activarse para:

- toda la plataforma;
- organización;
- franquicia;
- región;
- ubicación;
- máquina;
- usuario interno;
- producto.

## 18.2 Funciones potenciales

Ejemplos:

- modo documentos;
- auto-capture;
- validación avanzada;
- edición local;
- impresión fotográfica;
- impresión térmica;
- entretenimiento;
- campañas;
- multi-idioma;
- co-branding;
- analytics avanzados;
- futuras funciones de IA;
- pagos futuros;
- delivery digital futuro;
- modo franquicia;
- personalización avanzada;
- soporte remoto.

## 18.3 Entitlements comerciales

Debe ser posible representar planes o contratos que determinan qué funciones tiene una organización/franquicia, aunque no se implemente facturación automática.

## 18.4 UX

Una función no autorizada no debe aparecer como error. Debe:

- ocultarse;
- aparecer bloqueada con explicación, cuando así se configure;
- aparecer como “próximamente” si corresponde.

---

# 19. DESPLIEGUES, VERSIONES Y ROLLOUTS

La plataforma debe contemplar una red grande donde diferentes máquinas pueden estar en diferentes versiones temporalmente.

## 19.1 Estado de versión

Cada máquina debe mostrar:

- versión actual;
- versión objetivo;
- fecha de instalación;
- resultado de última actualización;
- configuración asociada;
- compatibilidad conocida;
- necesidad de reinicio cuando corresponda.

## 19.2 Canales

Debe poder definirse conceptualmente:

- desarrollo;
- prueba interna;
- piloto;
- estable;
- franquicia piloto;
- producción.

## 19.3 Rollout

Debe poder seleccionarse alcance por:

- una máquina;
- conjunto de máquinas;
- ubicación;
- franquicia;
- región;
- hardware profile;
- porcentaje controlado;
- canal.

## 19.4 Programación

Debe poder programarse un despliegue en una ventana de mantenimiento de acuerdo con la zona horaria local.

## 19.5 Seguimiento

Debe mostrar:

- pendiente;
- descargando/preparando;
- listo;
- instalando;
- completado;
- fallido;
- rollback;
- pausado.

## 19.6 Rollback

Debe existir una capacidad administrativa para regresar a una versión previamente aprobada cuando sea compatible.

## 19.7 Configuración versionada

Los cambios de configuración también deben tener historial y posibilidad de identificar qué configuración estaba activa en un momento dado.

---

# 20. DASHBOARD OPERATIVO

La página principal administrativa debe responder rápidamente:

- ¿Cuántas máquinas están activas?
- ¿Cuántas están offline?
- ¿Cuántas tienen advertencias?
- ¿Cuáles necesitan atención?
- ¿Cuántas sesiones se realizaron hoy?
- ¿Qué productos se usan más?
- ¿Qué ubicaciones tienen mayor actividad?
- ¿Qué máquinas no han tenido sesiones?
- ¿Qué impresoras/consumibles requieren atención?
- ¿Qué despliegues están pendientes?
- ¿Qué incidencias permanecen abiertas?

Debe poder filtrarse por organización, franquicia, región y periodo.

---

# 21. MÉTRICAS Y ANALYTICS

Sin depender de servicios externos, la plataforma debe poder registrar y presentar métricas propias.

## 21.1 Sesiones

- sesiones iniciadas;
- sesiones completadas;
- sesiones canceladas;
- sesiones fallidas;
- tiempo promedio de sesión;
- retakes promedio;
- fotos tomadas;
- fotos impresas;
- productos seleccionados;
- producto abandonado antes de captura;
- abandono durante edición;
- abandono antes de finalización.

## 21.2 Máquina

- uptime lógico;
- tiempo offline;
- errores;
- reinicios;
- fallas de cámara;
- fallas de impresora;
- impresiones;
- estimación de consumibles;
- sesiones por hora;
- sesiones por día;
- utilización por franja horaria.

## 21.3 Comercial

Mientras no exista integración real de pagos, debe poder analizarse con estados locales/simulados:

- valor comercial registrado;
- sesiones gratuitas;
- demos;
- promociones;
- precio por producto;
- ticket teórico/promedio registrado;
- ingresos manuales/importados si corresponde.

No debe presentar datos simulados como dinero efectivamente cobrado.

## 21.4 Productos

- popularidad;
- conversión desde pantalla de inicio;
- retakes;
- tiempo;
- fallos;
- uso de edición;
- plantilla elegida;
- preset documental usado.

## 21.5 Comparaciones

Debe poder comparar:

- máquinas;
- ubicaciones;
- ciudades;
- franquicias;
- productos;
- campañas;
- periodos.

---

# 22. SESIONES Y REGISTROS

Cada sesión debe tener un identificador único y conservar metadatos necesarios para operación y auditoría sin retener fotografías más tiempo del permitido.

Metadatos posibles:

- máquina;
- ubicación;
- organización;
- fecha/hora;
- producto;
- preset;
- versión de preset;
- plantilla;
- versión de plantilla;
- cantidad de capturas;
- cantidad de retakes;
- resultado;
- impresiones solicitadas;
- impresiones exitosas;
- duración;
- estado comercial;
- versión de software;
- versión de configuración;
- errores;
- consentimientos aplicables;
- política de retención aplicada.

El acceso a fotografías, cuando todavía existan, debe estar fuertemente limitado.

---

# 23. PRIVACIDAD Y RETENCIÓN

## 23.1 Políticas configurables

Debe poder definirse por organización/producto:

- no guardar fotografía después de sesión;
- guardar temporalmente durante X minutos/horas;
- guardar durante periodo definido;
- conservar únicamente derivados impresos/locales;
- eliminar originales al terminar;
- eliminar automáticamente sesiones incompletas;
- conservar sólo metadatos.

## 23.2 Comunicación al cliente

La UI debe explicar de forma comprensible:

- si la foto se guarda;
- por cuánto tiempo;
- para qué se usa;
- si sale o no del dispositivo;
- cómo continuar sin funciones opcionales;
- dónde consultar aviso completo.

## 23.3 Consentimiento

Debe registrarse consentimiento cuando una función lo requiera y distinguir:

- tratamiento necesario para prestar el servicio;
- almacenamiento opcional;
- uso futuro de servicios externos;
- marketing futuro;
- participación en campañas.

No agrupar consentimientos opcionales de forma engañosa.

## 23.4 Fotografías documentales

Por defecto, el producto debe favorecer procesamiento local y retención mínima.

## 23.5 Pantalla de finalización

Debe indicar claramente cuando los archivos temporales se eliminarán o ya fueron eliminados, si la política así lo establece.

---

# 24. AUDITORÍA

Deben auditarse acciones administrativas relevantes, incluyendo:

- usuario;
- fecha/hora;
- entidad afectada;
- valor anterior;
- valor nuevo;
- origen del cambio;
- alcance;
- motivo cuando sea requerido.

Cambios especialmente importantes:

- precios;
- políticas de privacidad;
- permisos;
- branding;
- presets documentales;
- publicación de campañas;
- funciones habilitadas;
- estado de una máquina;
- despliegues;
- rollbacks;
- acceso de soporte;
- eliminación manual de datos.

Los registros de auditoría deben ser consultables y filtrables por usuarios con permiso.

---

# 25. MANTENIMIENTO E INCIDENCIAS

## 25.1 Incidencias

Debe poder crearse una incidencia con:

- máquina;
- ubicación;
- severidad;
- categoría;
- descripción;
- evidencia/fotografías;
- fecha;
- responsable;
- estado;
- notas;
- resolución;
- piezas/consumibles usados;
- tiempo fuera de servicio.

Estados sugeridos:

- abierta;
- investigando;
- esperando visita;
- esperando pieza;
- resuelta;
- cerrada.

## 25.2 Mantenimiento preventivo

Debe poder definirse checklist por tipo de máquina, por ejemplo:

- limpiar pantalla;
- limpiar cámara;
- revisar iluminación;
- revisar papel;
- revisar impresora;
- retirar residuos;
- revisar gabinete;
- revisar cableado visible;
- prueba de impresión;
- prueba de captura;
- comprobar conectividad;
- comprobar espacio disponible.

Debe registrar fecha y responsable.

## 25.3 Consumibles

Debe poder registrar:

- tipo;
- compatibilidad;
- cantidad instalada;
- cantidad estimada restante;
- fecha de cambio;
- técnico;
- stock local;
- consumo histórico.

---

# 26. UI DE FRANQUICIA

Un franquiciatario debe tener un portal coherente con sus permisos y sin acceso a datos de otros franquiciatarios.

Debe poder ver:

- resumen de su red;
- ubicaciones;
- máquinas;
- sesiones;
- métricas;
- incidencias;
- consumibles;
- campañas disponibles;
- campañas obligatorias;
- precios cuando sean editables;
- usuarios;
- mantenimiento;
- versiones;
- anuncios/comunicaciones de la marca;
- documentación operativa;
- estado de funciones contratadas.

La marca debe poder publicar anuncios internos para franquiciatarios.

---

# 27. EXPERIENCIA DE CO-BRANDING

La plataforma debe soportar acuerdos con negocios anfitriones.

Una ubicación o campaña puede tener:

- logo principal;
- logo de anfitrión;
- sponsor;
- mensaje específico;
- descuento especial;
- plantilla exclusiva;
- producto exclusivo;
- fecha de vigencia;
- restricciones de uso.

El sistema debe evitar que un franquiciatario modifique elementos de marca que estén bloqueados por contrato/configuración.

---

# 28. IDIOMAS Y LOCALIZACIÓN

La interfaz de kiosco y administración debe soportar múltiples idiomas.

Como mínimo, el producto debe considerar español como idioma principal y permitir inglés.

Cada texto visible al cliente debe poder localizarse cuando sea contenido configurable.

Debe considerar:

- moneda;
- separadores numéricos;
- fechas;
- hora;
- zona horaria;
- formatos de dirección;
- unidades;
- textos legales específicos por país.

La máquina debe poder tener un idioma por defecto distinto al de otras máquinas de la misma organización.

---

# 29. ACCESIBILIDAD Y USABILIDAD

La experiencia del kiosco debe considerar:

- botones grandes;
- zonas táctiles amplias;
- alto contraste;
- texto legible a distancia;
- instrucciones cortas;
- no depender únicamente de color para estados;
- cuenta regresiva visual clara;
- opción de aumentar tiempo de sesión;
- soporte para usuarios con menor familiaridad tecnológica;
- navegación consistente;
- confirmaciones antes de acciones irreversibles;
- recuperación clara de errores.

Debe ser posible configurar una experiencia simplificada para máquinas destinadas a públicos específicos.

---

# 30. ESTADOS DE ERROR DEL KIOSCO

La máquina debe mostrar mensajes comprensibles para casos como:

- cámara no disponible;
- impresora no disponible;
- sin papel;
- atasco reportado;
- almacenamiento insuficiente;
- servicio temporalmente no disponible;
- producto no compatible con la máquina;
- sesión expirada;
- error durante captura;
- error durante edición;
- error durante composición;
- error durante impresión;
- pérdida de conexión cuando afecta una función;
- función externa futura no disponible.

Nunca mostrar stack traces, códigos internos incomprensibles o información sensible al cliente.

Debe existir un identificador de incidente visible para soporte cuando sea útil.

---

# 31. RECUPERACIÓN DE SESIÓN

La plataforma debe manejar interrupciones razonables.

Debe poder distinguir:

- sesión abandonada;
- aplicación reiniciada;
- máquina reiniciada;
- impresión fallida después de confirmar;
- captura guardada temporalmente;
- sesión corrupta;
- sesión incompleta.

Al regresar al servicio, la máquina debe resolver la sesión anterior de forma segura y respetar las políticas de privacidad.

---

# 32. IMPRESIÓN

## 32.1 Configuración

Cada máquina debe poder registrar una o varias impresoras con:

- nombre;
- tipo;
- estado;
- capacidades;
- tamaños compatibles;
- color/B&N;
- consumible;
- prioridad;
- productos asociados.

## 32.2 Flujo de impresión

La UI debe mostrar:

- preparando impresión;
- imprimiendo;
- impresión terminada;
- error;
- reintento disponible cuando proceda;
- instrucciones para recoger la foto.

## 32.3 Duplicados

Debe evitar impresiones duplicadas accidentales por doble toque o reinicio.

## 32.4 Prueba

Técnicos deben poder imprimir patrones/pruebas sin crear una venta o sesión comercial normal.

---

# 33. MODO DEMO, PRUEBAS Y OPERACIÓN INTERNA

Cada máquina debe poder entrar en modo demo autorizado para:

- probar el recorrido completo;
- capturar;
- editar;
- imprimir;
- simular aprobación de pago;
- validar un nuevo producto;
- validar campaña;
- mostrar la experiencia a un socio comercial.

Las sesiones demo deben distinguirse de sesiones comerciales en analytics.

---

# 34. EXPORTACIÓN E IMPORTACIÓN ADMINISTRATIVA

Usuarios autorizados deben poder exportar datos operativos tabulares como:

- máquinas;
- ubicaciones;
- sesiones;
- incidencias;
- mantenimiento;
- consumibles;
- productos;
- precios;
- presets documentales;
- métricas agregadas.

Debe poder existir importación administrativa controlada para catálogos masivos cuando sea necesario, con:

- validación;
- vista previa;
- errores por fila;
- confirmación antes de aplicar.

No incluir fotografías personales en exportaciones estándar.

---

# 35. BÚSQUEDA, FILTROS Y NAVEGACIÓN ADMINISTRATIVA

A medida que el negocio crezca, todas las listas grandes deben ofrecer búsqueda y filtros útiles.

Filtros comunes:

- organización;
- franquicia;
- región;
- ciudad;
- ubicación;
- máquina;
- estado;
- hardware;
- versión;
- fecha;
- producto;
- campaña;
- etiqueta.

Debe ser posible compartir o guardar vistas administrativas frecuentes si el producto lo contempla.

---

# 36. CONFIGURACIÓN HEREDABLE

La plataforma debe mostrar claramente cuándo una configuración:

- proviene de la marca;
- proviene de la franquicia;
- proviene de la ubicación;
- fue sobreescrita en una máquina;
- está bloqueada;
- volverá al valor heredado si se elimina el override.

Cambios masivos deben mostrar cuántas entidades serán afectadas antes de confirmarse.

---

# 37. CRECIMIENTO A GRAN ESCALA

La UX administrativa debe seguir siendo usable si existen:

- 1 máquina;
- 10 máquinas;
- 100 máquinas;
- 1,000+ máquinas;
- decenas de franquiciatarios;
- varias marcas;
- múltiples países.

Esto implica requisitos de producto como:

- listas paginadas o manejables;
- búsqueda;
- filtros;
- agrupación;
- acciones masivas;
- resúmenes;
- jerarquía clara;
- navegación contextual;
- permisos por alcance;
- auditoría.

No diseñar pantallas que obliguen a entrar manualmente a cada máquina para tareas comunes de flota.

---

# 38. PANEL DE SOPORTE Y DIAGNÓSTICO

Usuarios autorizados deben poder consultar:

- última conexión;
- últimas sesiones;
- errores recientes;
- última impresión;
- estado de periféricos;
- capacidad de almacenamiento;
- versión;
- configuración;
- historial de despliegues;
- mantenimiento;
- incidencias abiertas;
- cambios recientes;
- eventos relevantes.

Debe existir una línea temporal por máquina que combine eventos operativos importantes sin exponer fotografías innecesariamente.

---

# 39. DOCUMENTACIÓN OPERATIVA INTERNA

La administración debe poder asociar documentos o instrucciones internas a:

- tipo de máquina;
- ubicación;
- franquicia;
- producto;
- procedimiento de mantenimiento;
- instalación;
- solución de errores comunes.

Ejemplos:

- cómo cambiar papel;
- cómo limpiar lente;
- cómo reiniciar una impresora;
- contacto del encargado;
- acceso físico al gabinete;
- checklist de instalación.

---

# 40. REQUISITOS DE CONTENIDO PARA EL CLIENTE

Todo contenido de la UI del kiosco debe poder mantenerse conciso.

Las pantallas críticas deben priorizar una sola acción principal.

Los errores deben decir:

1. qué ocurrió en lenguaje simple;
2. qué debe hacer el cliente;
3. cómo pedir ayuda si no puede continuar.

El cliente nunca debe necesitar conocer la estructura interna de organizaciones, franquicias o versiones.

---

# 41. EXPERIENCIA DE FINALIZACIÓN

Al terminar una sesión, la máquina debe poder mostrar:

- confirmación;
- estado de impresión;
- instrucción para recoger la foto;
- resumen de lo recibido;
- aviso de eliminación/retención;
- agradecimiento;
- branding;
- promoción opcional de otra experiencia;
- llamada a la acción futura para entrega digital cuando exista;
- regreso automático a idle.

Debe limpiarse toda información visual de la sesión anterior antes de recibir al siguiente cliente.

---

# 42. REQUISITOS PARA MODOS DE NEGOCIO DIFERENTES

La misma plataforma debe poder soportar máquinas configuradas como:

- de pago;
- gratuitas patrocinadas;
- demo;
- cortesía para huéspedes/clientes;
- incluidas dentro de otro servicio;
- promocionales;
- uso interno de una institución.

La UI debe adaptarse sin mostrar pasos de pago cuando no correspondan.

---

# 43. SISTEMA DE CONFIGURACIÓN DE PRODUCTOS POR MÁQUINA

Para cada máquina debe poder definirse:

- productos visibles;
- orden;
- categorías;
- precio;
- promociones;
- idiomas;
- horarios;
- presets;
- templates;
- edición;
- retakes;
- cantidad de copias;
- impresora;
- branding;
- campaña;
- mensajes legales;
- timeouts;
- funciones disponibles.

Debe poder copiarse configuración de una máquina a otra y crear plantillas de configuración reutilizables.

---

# 44. PERFILES / BLUEPRINTS DE MÁQUINA

Debe poder crearse una configuración reusable que represente un tipo comercial de estación, por ejemplo:

- kiosco térmico de cafetería;
- estación documental universitaria;
- cabina premium de centro comercial;
- estación de cine;
- estación de hotel;
- unidad demo.

Un blueprint puede definir defaults de:

- productos;
- hardware esperado;
- branding;
- timeouts;
- impresoras;
- features;
- campañas base;
- mantenimiento;
- experiencia de usuario.

Las máquinas creadas desde un blueprint deben poder conservar overrides autorizados.

---

# 45. SEGURIDAD DE PRODUCTO

Sin especificar implementación técnica, el producto debe requerir:

- autenticación para administración;
- autorización por rol y alcance;
- aislamiento de datos entre franquiciatarios;
- protección de funciones de mantenimiento;
- protección de configuración sensible;
- sesiones administrativas que expiren;
- auditoría de acciones sensibles;
- imposibilidad de acceder a fotografías anteriores desde la UI pública;
- eliminación segura según política;
- no mostrar secretos ni credenciales en la UI;
- bloqueo de salida accidental de la aplicación de kiosco;
- restricción del acceso a herramientas administrativas desde la experiencia pública.

---

# 46. DATOS DEL CLIENTE Y CUENTAS DE CLIENTES

Para la primera etapa, una persona debe poder usar la máquina de forma anónima sin crear cuenta.

El producto puede contemplar en el futuro perfiles o membresía, pero no debe obligar a implementar una identidad de consumidor ahora.

Si se agrega posteriormente, debe diferenciarse claramente de usuarios administrativos.

---

# 47. ELEMENTOS FUTUROS QUE DEBEN QUEDAR REPRESENTABLES PERO NO IMPLEMENTADOS CON TERCEROS

La experiencia y modelo de producto deben poder extenderse más adelante a:

- procesador de tarjeta/NFC;
- QR de pago;
- IA generativa;
- entrega por WhatsApp;
- entrega por SMS;
- correo electrónico;
- almacenamiento cloud;
- facturación fiscal;
- CRM externo;
- loyalty;
- cupones externos;
- analítica externa;
- webhooks;
- reservas/eventos;
- partners.

En esta fase:

- no conectar proveedores reales;
- no depender de credenciales externas;
- no exigir internet para probar la experiencia local;
- sí permitir estados simulados/manuales cuando ayuden a completar y probar la UI.

---

# 48. PRIORIDAD FUNCIONAL DE ESTA ETAPA

Aunque el producto debe modelar crecimiento grande, la primera experiencia funcional debe poder demostrar de extremo a extremo:

1. Configurar una organización.
2. Crear al menos una ubicación.
3. Crear varias máquinas con configuraciones distintas.
4. Definir capacidades de cada máquina.
5. Definir branding diferente por máquina/ubicación.
6. Crear productos.
7. Crear presets documentales.
8. Crear templates de impresión.
9. Asignarlos a máquinas.
10. Ejecutar en una máquina un flujo de cliente completo.
11. Capturar una fotografía localmente.
12. Guiar visualmente al usuario en modo documental.
13. Hacer auto-capture cuando la pose/encuadre sea válido, cuando esté habilitado.
14. Permitir retake.
15. Editar localmente según las reglas del producto.
16. Componer una salida.
17. Previsualizar impresión.
18. Imprimir cuando exista impresora disponible, o completar el flujo en modo demo cuando no exista.
19. Registrar la sesión.
20. Aplicar política de retención/eliminación.
21. Ver la sesión y métricas desde administración sin exponer fotografía más allá de lo permitido.
22. Mostrar estado de múltiples máquinas.
23. Editar una configuración central y asignarla con alcance controlado.
24. Gestionar usuarios y permisos.
25. Gestionar features por máquina/organización.
26. Gestionar versiones/configuración y simular el estado de un deployment.

---

# 49. ESCENARIOS DE ACEPTACIÓN CLAVE

El producto debe poder demostrar satisfactoriamente al menos estos escenarios:

## Escenario A — Foto documental

Un cliente llega a una estación universitaria, selecciona “Fotos para graduación”, revisa requisitos, se posiciona, recibe guía visual, la máquina detecta que está correctamente centrado, toma automáticamente la foto, muestra el resultado, permite repetir, genera la composición correspondiente y finaliza la sesión.

## Escenario B — Foto divertida

Dos personas llegan a una máquina en una cafetería, seleccionan una experiencia divertida, siguen una secuencia de poses, eligen sus favoritas, aplican un marco local, revisan la composición y finalizan.

## Escenario C — Dos máquinas diferentes

La administración tiene dos máquinas: una documental y una térmica. Ambas usan la misma plataforma pero muestran productos, branding, capacidades, precios y templates diferentes.

## Escenario D — Franquicia

Un franquiciatario puede administrar sus cinco máquinas y sus ubicaciones, pero no puede ver las máquinas de otro franquiciatario ni modificar funciones bloqueadas por la marca.

## Escenario E — Campaña nacional

La empresa matriz crea una campaña de temporada y la asigna a determinadas regiones. Un franquiciatario recibe la campaña pero sólo puede modificar los campos permitidos.

## Escenario F — Fallo de impresora

Una máquina detecta que su impresora no está disponible. Los productos que requieren esa impresora aparecen no disponibles o se ocultan de acuerdo con la configuración. La administración muestra una alerta y un técnico puede registrar la reparación.

## Escenario G — Privacidad

Una sesión documental finaliza y la política configurada elimina la imagen después del periodo definido. Los metadatos operativos permanecen sin mantener la fotografía.

## Escenario H — Deployment gradual

La empresa tiene 100 máquinas. Una nueva versión se asigna inicialmente a un grupo piloto. Administración puede ver cuáles están en versión actual, objetivo, completadas, pendientes o fallidas, y después ampliar el rollout.

## Escenario I — Feature restringida

Una nueva función está habilitada únicamente para una franquicia piloto. Otras máquinas no deben presentarla como una opción utilizable.

## Escenario J — Cambio de preset oficial

Se actualiza un requisito documental. El nuevo preset se publica como una nueva versión. Las nuevas sesiones usan la versión actualizada y las antiguas conservan registro de la versión utilizada originalmente.

---

# 50. CRITERIOS DE CALIDAD DEL PRODUCTO

El resultado debe sentirse como un producto comercial serio, no como un prototipo de una sola máquina.

Debe transmitir:

- claridad;
- velocidad;
- confianza;
- privacidad;
- consistencia;
- facilidad para el consumidor;
- facilidad para el operador;
- capacidad de crecer;
- control para la empresa matriz;
- autonomía limitada y segura para franquiciatarios;
- adaptabilidad a hardware distinto;
- diferenciación por software.

La interfaz administrativa no debe convertirse en una lista de configuraciones técnicas. Debe organizar la operación alrededor de conceptos de negocio comprensibles: organizaciones, franquicias, ubicaciones, máquinas, productos, campañas, sesiones, mantenimiento, usuarios, funciones y despliegues.

La interfaz del kiosco debe sentirse extremadamente simple aunque la plataforma detrás sea compleja.

---

# 51. RESTRICCIONES EXPLÍCITAS DE ESTA ETAPA

No implementar todavía:

- integración real con Mercado Pago;
- integración real con Nayax;
- integración real con bancos/adquirentes;
- integración real con proveedores de IA;
- integración real con OpenAI u otros modelos externos;
- integración real con WhatsApp;
- integración real con SMS;
- integración real con correo;
- integración real con sistemas fiscales;
- integración real con CRM externos;
- autenticación de consumidores mediante terceros;
- dependencias obligatorias de servicios externos para completar una demo local.

Sí construir toda la experiencia local, administración y representación de estados necesarias para que estas integraciones puedan añadirse posteriormente sin rediseñar el producto desde cero.

---

# 52. INSTRUCCIÓN FINAL AL AGENTE

Usa estos requisitos como especificación de producto.

Antes de modificar el repositorio:

1. Revisa el producto existente y determina qué requisitos ya están cubiertos total o parcialmente.
2. Identifica huecos funcionales.
3. Preserva cualquier funcionalidad existente que sea compatible con estos requisitos.
4. Implementa primero los recorridos de usuario y administración que permitan demostrar el producto extremo a extremo localmente.
5. Mantén las funciones futuras de terceros claramente diferenciadas y deshabilitables.
6. No conviertas la aplicación en una demo específica de una sola máquina.
7. Evita textos, nombres, precios, ubicaciones o branding hardcoded que impidan operar múltiples organizaciones o franquicias.
8. Cada pantalla debe considerar permisos, estados vacíos, estados de carga, estados de error y operación con múltiples entidades.
9. Prioriza comportamiento observable y requisitos funcionales sobre explicaciones de implementación.
10. No presentes arquitectura ni stack como entregable. El entregable debe ser el producto funcionando conforme a esta especificación y una lista clara de requisitos completados, parciales y pendientes.

