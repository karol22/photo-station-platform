# Papeles tipográficos (locales)

Los cuatro papeles del kiosco viajan **dentro de la aplicación**: la cabina no tiene red, así que
no hay CDN, no hay `@import` y la pila del sistema queda sólo como respaldo de emergencia. Un papel
es a la tipografía lo que un papel de color es a la paleta: la unidad que todo el producto habla.

| Papel | Archivo | Familia y ejes | Bytes |
|---|---|---|---|
| Display | `BungeeLayers.woff2` | Bungee Layers, sin ejes | 11 012 |
| Display, capa interior | `BungeeLayersInline.woff2` | Bungee Layers Inline, sin ejes | 10 224 |
| Numeral | `Anybody-cifras-var.woff2` | Anybody · `wdth` 75–150, `wght` 400–900 | 36 004 |
| Texto | `BricolageGrotesque-var.woff2` | Bricolage Grotesque · `opsz` 12–96, `wght` 400–800 | 89 132 |
| Utilitario | `RecursiveMono-var.woff2` | Recursive · `wght` 500–800, `MONO` fijado en 1 | 37 876 |

**184 248 B en total, 179,9 KB**, de un presupuesto duro de 250 KB. Todos subseteados a latín y
latín extendido; el numeral, sólo a cifras, versales y signos de moneda.

Las cuatro familias son **SIL OFL 1.1**, que permite empaquetar y redistribuir en un producto
comercial. La licencia de cada una viaja a su lado, en `OFL-*.txt`, y no se borra.

Por qué éstas y no las obvias:

- **Bungee** se dibujó para letreros y trae juego de capas con anchos idénticos glifo a glifo: la
  misma palabra pintada dos veces sale en dos colores de la paleta, sin fuente de color ni SVG.
- **Anybody** trae `tnum`, `zero`, `case` y eje de ancho, que es el mínimo para componer una
  cuenta regresiva. Archivo también los trae, y se descarta por lo contrario: es la grotesca más
  neutra del lote, y el numeral ocupa media pantalla. Sus cifras por
  omisión son proporcionales: a 416 px van de 283,7 px el 7 a 318,0 px el 9, así que la cuenta se
  desplaza 34 px en cada tic. `'tnum' 1` no es gusto, es lo que separa un reloj de una avería.
- **Bricolage Grotesque** trae eje óptico, así que un solo archivo compone con espaciado de rótulo
  a 96 px y con espaciado de lectura a 22 px, sin que ninguna pantalla lo pida.
- **Recursive** con el eje `MONO` **fijado en el archivo** es monoespaciada por construcción —600
  unidades de avance para todos los glifos—, y separa `0/O`, `1/I` y `5/S`, que es lo que decide si
  alguien recupera sus fotografías del código de rescate. Martian Mono también resuelve el papel y
  pesa 12 KB menos (25 896 B contra 37 876 B); se elige Recursive porque separa el `1` de la `I` con
  más estructura —astil con base y bandera contra dos travesaños— y porque su eje `MONO` deja abierta
  una compañera proporcional de la misma mano sin sumar otra voz. Con el presupuesto al 72 %, los
  12 KB no deciden.

Actualizar: `scripts/fetch-fonts.sh`. El guion descarga desde el origen, instancia, subsetea y
después comprueba en Node que cada archivo cubre el español, que el papel numeral no arrastró
minúsculas y que la suma cabe en el presupuesto. Se puede mirar el resultado en
`ops/campanas/rediseno-visual-kiosco/ESPECIMEN.html`.
