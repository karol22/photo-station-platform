# Plan de diseño definitivo — Kiosco "Bandada"

> Dirección base: **b · Bandada**. Injertos aprobados por los jueces: **la marquesina que además es el reloj** (de *Marquesina*) y **el color como superficie con la profundidad derivada del propio tono, más la pantalla entendida como luz** (de *Seis cuartos de luz*). Todo lo demás de esas dos direcciones se descarta.
>
> Este documento decide. Quien lo implementa no elige nada estético: elige nombres de variables.

---

## 1. Tesis

**La cabina es una bandada de seis caras: te ves dentro de una de ellas, sus dos ojos están donde está el lente, y cuando esos ojos parpadean la foto ya se tomó.**

---

## 2. Fichas de color

Los colores reales llegan por `branding.palette.*` y `branding.palette.accents`. Este plan define **papeles**, no valores. Ningún papel se ata a un índice de acento: se **deriva en tiempo de tema**.

### 2.1 Regla que corrige el defecto de la dirección ganadora

Bandada asignaba "accent-4 confirma el pago" y "accent-3 es la luz". Eso es cierto de la paleta demo y falso de la plataforma. Se sustituye por una función pura en `packages/ui/src/theme.ts`:

```
assignAccentRoles(accents: string[]): {
  luz: string;       // mayor luminancia relativa
  confirma: string;  // matiz en [90°,170°]; si no hay, el segundo de mayor luminancia
  avisa: string;     // matiz en [15°,55°]; si no hay, el tercero de mayor luminancia
  etapas: string[];  // los seis ordenados por matiz ascendente desde el primario
}
```

Ninguna pantalla escribe `accent-4`. Escribe `var(--psp-role-confirma)`.

### 2.2 Degradación cuando la marca no trae seis colores

`readBrandingAccents` hoy rellena repitiendo (`['a','b'] → a,b,a,b,a,b`), lo que mata la firma en silencio. Se corrige en el mismo archivo:

1. Se deduplica la lista declarada.
2. Si quedan **≥4** colores distintos: los faltantes se generan rotando el matiz del anterior **+28°** y ajustando luminancia hasta separarse ≥12 % del vecino.
3. Si quedan **2 o 3**: modo **dos habitaciones**. El campo alterna sólo entre esos colores, la elección de look baja de 6 a 3 y las tres variantes se distinguen por **grano y contraste**, no por color. Los seis blobs siguen existiendo; se visten con los colores disponibles y con sus mezclas hacia Aro.
4. Si queda **1**: modo documental permanente para el recorrido social (crema + un acento). Se reporta al panel técnico.

### 2.3 Tabla

| Nombre | Token CSS | Papel | Se usa cuando | NUNCA se usa |
|---|---|---|---|---|
| **Tinta** | `--psp-color-text` | Única tinta del sistema: texto, trazo de las caras, cantos duros de 6 px, sombra desplazada | Siempre que haya un carácter o una línea | Como campo o superficie del recorrido social. Prohibido `rgba(0,0,0,.35)` sobre la cara de nadie |
| **Campo** | `--psp-field` (= acento de la etapa activa) | El color a sangre que ocupa la pantalla entera | Fondo de toda pantalla del recorrido social | Como color de texto. Como relleno de un contenedor pequeño sobre otro campo |
| **Aro** | `--psp-aro` = `mixColors(accent, '#FFFFFF', 0.62)` | La luz: halo de los focos, aro de 96 px alrededor del espejo, refugio tipográfico cuando el campo no da 4.5:1 | Marquesina, aro de captura, texto sobre campos oscuros | Como campo de pantalla completa (encandila a 1.5 m) |
| **Rincón** | `--psp-rincon` = `mixColors(accent, var(--psp-color-text), 0.28)` | La profundidad: sombra desplazada 10 px sin difuminado, cuatro caídas de esquina | Separar un bloque del campo; hundir el borde de la pantalla | Como fondo de texto. Con difuminado (`blur`) jamás |
| **Crema** | `--psp-color-bg` | Recorrido documental completo; anillo exterior del foco de teclado | Trámite, foco | Como fondo del recorrido social. A 300 cd/m² es la pared del pasillo |
| **Destello** | `--psp-flash` = `#FFFFFF` | Evento de 110 ms al 90 % de opacidad en el obturador | Un solo destello por toma | Como superficie. `--psp-color-surface` no se consume en el recorrido social |
| **Papel QR** | `--psp-qr-paper` = `#FFFFFF` | Rectángulo del código, con zona de silencio de 4 módulos | Pantalla de cierre | Sobre la foto, sobre un campo, con algo animado debajo |
| **Foco de teclado** | `--psp-focus-inner` = Tinta, `--psp-focus-outer` = Crema | Anillo doble de 5 px + 5 px, offset 6 px, siguiendo el contorno de la silueta | Todo elemento enfocable | Nunca `var(--psp-color-accent)`: con la paleta demo da 1.4:1 |

**Nota de semántica, verificada en el repo:** `mixColors(a, b, w)` interpola de `a` hacia `b`, siendo `w` la proporción de `b`. Las fórmulas de arriba están escritas con esa semántica. La propuesta de *Seis cuartos* las tenía invertidas.

**Regla de tinta:** la tinta es siempre `--psp-color-text`, jamás blanco sobre un acento. Al aplicar el tema se corre `contrastRatio(text, accent)`; si baja de 4.5:1, el acento se hunde hacia la tinta **iterativamente en pasos de 6 %, con tope de 5 pasos**; si aún no llega, ese acento se marca `no-field` y sólo se usa para siluetas y halos, nunca como campo con texto encima. Esto ocurre en **aprovisionamiento y en el arranque del tema**, no en `tools/gates`: el bundle es dato de tiempo de ejecución y no existe en el build.

---

## 3. Tipografía

Hoy no hay un solo archivo de fuente en el repositorio ni una regla `@font-face`. En un Android de gama media eso resuelve a Roboto. Sin tipografía propia no hay dirección visual posible.

### 3.1 Familias

| Papel | Familia | Licencia | Archivo a empaquetar | Descarga |
|---|---|---|---|---|
| Display + Texto | **Archivo Variable** (Omnibus-Type), ejes `wght 100–900`, `wdth 62–125` | SIL OFL 1.1 | `Archivo[wdth,wght].subset.woff2` — subconjunto `latin` + `latin-ext` + `¿¡` + `$ € ·`, ejes conservados, ~110 KB | `https://github.com/Omnibus-Type/Archivo` → `fonts/variable/Archivo[wdth,wght].ttf` |
| Utilitaria (código de rescate, id de máquina, panel técnico) | **Martian Mono**, variable `wght` + `wdth` | SIL OFL 1.1 | `MartianMono.subset.woff2` — subconjunto `[0-9A-Z·-]`, ~12 KB | `https://github.com/evilmartians/mars-mono` |

Un solo archivo para display y texto: la variedad la ponen seis colores y seis siluetas, no una segunda voz tipográfica. La utilitaria existe por una razón funcional y única: el código de 6 dígitos es el único texto que un ser humano transcribe de pie, y ahí `0/O`, `1/I` y `5/S` son la diferencia entre recuperar sus fotos y no recuperarlas.

Se declaran con `@font-face` y `src: url(...) format('woff2-variations')`, más `<link rel="preload" as="font" crossorigin>`. **No se declara `font-display`**: el archivo es local, no hay red, y la propiedad no aporta nada (la dirección ganadora la citaba por inercia).

Las familias entran por bundle con claves nuevas —hay que crearlas en `packages/contracts/src/config.ts`, hoy no existen—: `branding.typography.displayAssetId`, `branding.typography.monoAssetId`, tipo `asset`. **Si el valor es una URL en vez de un asset, el aprovisionamiento lo rechaza.** La pila del sistema queda sólo como respaldo si la marca no declara familia.

### 3.2 Instancias y escala

Base del kiosco social: `--psp-font-base: 26px` sobre `.psp-kiosk`. **Toda medida en `em` o en tokens `--psp-font-*`; `rem` queda prohibido en `apps/kiosk` y en `packages/ui/src/kiosk`**, porque los 22 px base viven en una clase y no en `html` — de ahí que hoy `.kiosk-lead` mida 21.6 px y `.kiosk-small` 15.2 px.

| Token | Instancia | px | Tracking | Interlínea | Uso |
|---|---|---|---|---|---|
| `--psp-font-numeral` | `wdth 112 · wght 900`, `'tnum' 1, 'zero' 0` | **416** | −0.04em | 0.80 | Cuenta regresiva |
| `--psp-font-precio` | `wdth 112 · wght 900`, `'tnum' 1` | **300** | −0.04em | 0.82 | Precio en atracción y en elegir |
| `--psp-font-rotulo` | `wdth 125 · wght 850` | **96** | −0.02em | 0.88 | Nombre, "ya está", llamada a la acción |
| `--psp-font-titular` | `wdth 118 · wght 850` | **72** | −0.02em | 0.92 | Título de pantalla de decisión |
| `--psp-font-destacado` | `wdth 100 · wght 700` | **40** | 0 | 1.20 | Instrucción de pose, nombre del look, estado de pago |
| `--psp-font-cuerpo` | `wdth 100 · wght 550` | **26** | +0.005em | 1.28 | Todo lo que se lee |
| `--psp-font-micro` | `wdth 100 · wght 600` | **22** | +0.01em | 1.30 | Zócalo. Piso duro: nada baja de 22 px |
| `--psp-font-codigo` | Martian Mono `wdth 112 · wght 700` | **120** | +0.06em | 1.0 | Código de rescate, en dos grupos de 3 |
| `--psp-font-maquina` | Martian Mono `wght 600` | **22** | +0.04em | 1.30 | Id de máquina y contacto |

Las cifras tabulares en el numeral no son gusto: a 416 px, con cifras proporcionales el dígito salta lateralmente en cada tic y se lee como error de render.

---

## 4. Disposición

### 4.1 Lienzo y física

Panel de 43", **1080 × 1920 vertical**, IPS, >300 cd/m², vidrio templado de 3 mm, táctil IR de 10 puntos. Montaje: borde superior a **1.90 m** del piso. Un píxel mide **0.496 mm** de alto.

Alcance cómodo de una persona de pie: 1.00 m a 1.50 m del suelo, o sea **y = 806 a y = 1814**. Ese número manda sobre cualquier composición.

### 4.2 Las cinco bandas (idénticas en las ocho pantallas)

| Banda | y | Altura física | Qué contiene | Táctil |
|---|---|---|---|---|
| **MARQUESINA** | 0 – 120 | 1.90–1.84 m | 24 focos. Nunca se mueve de sitio, nunca cambia de tamaño, nunca participa de las transiciones | No |
| **CARTEL** | 120 – 1180 | 1.84–1.31 m | Una sola cosa: el espejo, la foto, el numeral o el precio. A sangre | **No. Un objetivo táctil aquí es un defecto** |
| **REPISA** | 1180 – 1480 | 1.31–1.16 m | La tira de huecos, el riel de looks, el riel de habitaciones | Sí |
| **ALCANCE** | 1480 – 1780 | 1.16–1.02 m | **Exactamente una** acción primaria, ancho completo, alto ≥160 px | Sí |
| **ZÓCALO** | 1780 – 1920 | 1.02–0.95 m | Id de máquina, contacto, línea de privacidad. 22 px, **tinta al 100 %** | No |

El zócalo va en tinta plena, no atenuada. *Seis cuartos* proponía tinta al 62 % sobre el rincón: eso da entre 1.30:1 y 1.62:1, peor que el anillo de foco que esa misma propuesta denunciaba, y aplicado al único texto que la operación obliga a leer.

**Modo apaisado.** `kiosk.orientation` acepta `landscape` y hoy el kiosco lo lee. En apaisado las bandas se reducen a tres columnas: CARTEL a la izquierda (66 % del ancho), REPISA+ALCANCE apilados a la derecha (34 %), ZÓCALO al pie de ancho completo. La marquesina pasa al borde superior con 16 focos. Ninguna pantalla se rompe; sólo se reordena.

### 4.3 Rejilla

Margen 48. Seis columnas de 144. Medianil 24. `6·144 + 5·24 + 2·48 = 1080`. Ritmo vertical de 24; nada se alinea a menos de 24.

### 4.4 Las cinco primitivas

**Campo · Bandada · Máscara · Tinta · Tira.** Si un elemento no es una de estas cinco, no existe.

### 4.5 El blob-contenedor

Un contenedor **no** es el personaje escalado. Se construye con una supraelipse de exponente `n = 4.2` del tamaño que pide el contenido, desplazando sus ocho puntos de control con **los mismos ocho radios** de `SHAPES[variant]` de `packages/ui/src/kiosk/BlobFace.tsx`:

```
desplazamiento_i = amplitud · (R_i − 1) · min(W,H) / 2
```

`blobPath()` recibe dos parámetros nuevos: `amplitude` y `spin` (rota el arranque del arreglo, para que dos contenedores de la misma variante no se vean calcados).

| Amplitud | Uso |
|---|---|
| 1.00 | El personaje (lo que hay hoy) |
| 0.45 | Botón principal, ficha de habitación |
| 0.30 | Miniatura de look, ficha de la tira |
| **0.14** | **El espejo y todo lo que contenga una cara humana** |

**Regla del espejo (corrige la debilidad más señalada):** el espejo se enmascara con **amplitud 0.14 fija**, casi rectangular. La persona vino a verse, no a verse deformada. La silueta no es la máscara: la firma son **los ojos**. La amplitud sólo sube a 0.30 cuando el analizador confirma cajas de rostro estables **y** todas caben con 12 % de margen, y baja a 0.14 en 240 ms si alguna caja se acerca al límite. Y —esto invierte lo que proponía Bandada— **si el analizador no está vivo, la amplitud se queda en 0.14**: `apps/kiosk/src/vision/analyzer.ts` cae a `MockFaceAnalyzer(() => [])` cuando MediaPipe no carga, así que "sin landmarks" tiene que ser el caso seguro, no el permisivo.

**Coste real, no prometido.** No se anima `clip-path` sobre vídeo. Las seis máscaras se hornean como seis PNG alfa de 1080×1060 al arrancar la sesión y se aplican con `mask-image`. El cambio de amplitud es un **fundido cruzado de opacidad entre dos capas** de máscara precalculadas (0.14 y 0.30), 240 ms. Cero regeneración de path por fotograma.

### 4.6 Los tres rectángulos con nombre

Bandada decía "sólo dos rectángulos" y su propio wireframe dibujaba ocho huecos de tira. La regla honesta es:

1. **La foto** (es el producto),
2. **el hueco de la tira** (es la foto en pequeño),
3. **el cuadro del QR** (un QR sobre color no escanea).

Todo lo demás es silueta o campo. La barra de fase de 8 px no es un rectángulo: es un canto.

### 4.7 Superficies, bordes, sombras

`--psp-color-surface` **no se consume en el recorrido social**. Se corrige la causa raíz: en `packages/ui/src/theme.ts`, la línea `const surface = bgIsDark ? mixColors(...) : LIGHT` deja de forzar blanco puro cuando la marca declara fondo claro. Y `--psp-shadow-sm/md/lg`, hoy clavadas a `rgba(11,27,63,…)` —un azul marino que ninguna marca puede cambiar— se sustituyen por:

```css
--psp-lift: 10px 10px 0 var(--psp-rincon);
```

Cero `box-shadow` con difuminado. Cero `border-radius` (el radio no existe cuando la forma es una curva completa). Cero degradados en movimiento continuo: se prohíbe el `conic-gradient` giratorio que proponían las otras dos direcciones. El panel es IPS, no OLED: la persistencia de imagen se va sola. El anti-quemado se reduce a desplazar la composición **1 px por minuto** y a que cada beat cambie el campo entero.

### 4.8 Marco de pantalla

`KioskShell` gana un modo a sangre (`data-bleed`): sin padding, sin encabezado. Obligatorio en atracción, captura, cuenta y cierre. El logotipo permanente y el `LangSwitch` omnipresente desaparecen. **El idioma tiene casa nueva:** dos fichas de 96 px en la REPISA de la pantalla de atracción, visibles sólo si el bundle trae más de un locale, y una ficha de 96 px en el zócalo de consentimiento. En captura, edición y cierre no aparece.

### 4.9 Recorrido documental

Nada de lo anterior aplica. Crema, un solo acento y sólo en el marco, cero siluetas sobre la foto, cero máscaras, cero movimiento de campo, cero sonido salvo el obturador. Mismas cinco bandas, misma tipografía. La separación es **de módulo**: el árbol documental no importa el pipeline de embellecimiento ni el de máscaras, y una prueba falla si un bundle documental declara `beauty.*`.

---

### 4.10 Wireframes — las ocho pantallas

Leyenda: `#` campo de acento · `.` vídeo en vivo · `=` acción táctil · `█` tinta · `░` aro (luz) · `o` ojo · `[ ]` hueco vacío

```
PANTALLA 1 · ATRACCION — beat ESPEJO (disparado por presencia)
+----------------------------------------------+
|ooooooooooooooooooooooooooooooooooooooooo o o o|  0     MARQUESINA 120px: 24 focos, chase 2/s
|##############################################|  120   CARTEL
|#############.................................|
|##########.....................................|
|#######.........................................|
|#####...  ESPEJO EN VIVO, ESPEJADO, A SANGRE ...|        mascara amplitud 0.14 (casi recta)
|####...........................................|
|###.....(o)...................(o)..............|        LOS OJOS DEL LENTE: aqui esta la camara
|###............................................|        offset por bundle kiosk.lens.offsetX/Y
|##.............................................|
|##.............................................|
|##.....  nada, jamas, encima de tu cara  ......|
|###............................................|
|####...........................................|
|#####..........................................|
|#######........................................|
|##########.....................................|
|##############################################|  1180  REPISA
|#####   {precio 300px}      {duracion}   ######|
|#####   [ES] [EN]  fichas 96px, solo si   #####|
|#####   el bundle trae dos locales        #####|
|==============================================|  1480  ALCANCE
|=======                                 =======|
|=========   {i18n.attract.cta} 96px   =========|        objetivo tactil: LA PANTALLA ENTERA
|=======                                 =======|
|==============================================|
|# {aviso: no se guarda nada} {id-maq} {contacto}|  1780 ZOCALO 22px tinta plena
+----------------------------------------------+  1920

BUCLE 46 s, 5 beats. El campo CORTA (0 ms) entre beats.
 1 ESPEJO 12s  · condicional: entra en cuanto hay un rostro >=400 ms
 2 PRECIO  6s  · numeral 300px, los seis blobs giran los ojos hacia el
 3 MURO   11s  · retratos demo del bundle cayendo en tira, con su look aplicado
 4 TUTORIAL 9s · tres blobs actuando: toca / parate / sonrie. Cero texto
 5 INVITA  8s  · campo pulsando, los seis blobs mirando al boton
Sin rostro durante 8 s: el video se pausa y el beat ESPEJO se salta.
Con rostro: se salta al beat ESPEJO, tope 25 s, luego PRECIO y sigue el bucle.
```

```
PANTALLA 2 · ELEGIR — una habitacion grande, seis en el riel
+----------------------------------------------+
|oooooooooooooooooo o o o o o o o o o o o o o o|  0     focos apagandose de a uno: reloj de 45 s
|##############################################|  120
|####     {titulo 72px: una linea, i18n}   #####|
|##############################################|
|##    ,-----------------------------------.  ##|
|##   /  RETRATO DEMO DEL BUNDLE, YA CON    \ ##|        blob-contenedor amplitud 0.45
|##  |   ESTE LOOK APLICADO, A SANGRE        |##|        el retrato NO se enmascara: se encuadra
|##  |                                       |##|
|##  |   {nombre del look}  40px             |##|
|##   \  {precio 300px}                     / ##|
|##    `-----------------------------------'  ##|
|##      sombra dura 10px en --psp-rincon      #|
|##############################################|  1180  REPISA: los seis a la vez
|#  (1)   (2)   (3)   (4)   (5)   (6)         #|        fichas de 150px, amplitud 0.30
|#  ###   ###   ###   ###   ###   ###          #|        una por acento: la marca es el conjunto
|#  el activo lleva canto de tinta de 8px      #|        y todo el riel esta dentro de y=1180..1480
|==============================================|  1480
|=====   A S I   E S T A   B I E N   96px  ====|        una ya viene elegida
|==============================================|
|# {id-maq} · {contacto}                       #|  1780
+----------------------------------------------+

Bandada ponia seis tarjetas de 460x420 que caian dentro de la ZONA CARTEL,
violando su propia ley. Corregido: una grande arriba (se mira), seis chicas
abajo (se tocan). Cero scroll. Seis, no veintiuna.
```

```
PANTALLA 3 · CONSENTIMIENTO — una frase, dos botones
+----------------------------------------------+
|oooooooooooooooooooooooo o o o o o o o o o o o|  0
|##############################################|  120
|##                                          ##|
|##    ,---.                                 ##|
|##   ( o o )   blob 5 a 420px, mirando al   ##|
|##    `---'    texto                        ##|
|##                                          ##|
|##   {la frase, 40px, tres lineas maximo}   ##|
|##   {i18n. sin viñetas, sin tarjetas}      ##|
|##                                          ##|
|##   {enlace: leer todo}  26px, subrayado   ##|        abre Sheet a pantalla completa
|##############################################|  1180
|#   [ES]  [EN]     fichas 96px                #|
|==============================================|  1480
|=====   D E   A C U E R D O   96px        ====|
|==============================================|
|=  no acepto  26px, sin campo, ancho 300px   =|        salida siempre visible, nunca escondida
|# {id-maq} · {contacto} · {politica}          #|  1780
+----------------------------------------------+

Mueren las cuatro tarjetas blancas apiladas con Toggles tipo iOS de Consent.tsx.
Un consentimiento no es una pantalla de Ajustes.
```

```
PANTALLA 4 · PAGO — el precio es la pantalla
+----------------------------------------------+
|oooooooooooooooooooooooooooooooooo o o o o o o|  0     chase lento 1/s: la maquina espera
|##############################################|  120
|##                                          ##|
|##          {precio 300px, tnum}            ##|
|##                                          ##|
|##      ,---.   ,---.   ,---.               ##|
|##     ( o o ) ( ^ ^ ) ( - - )              ##|        tres blobs haciendo cola, 260px
|##      `---'   `---'   `---'               ##|        se turnan un salto cada 900 ms
|##       avanzan 24px por turno             ##|        SUSTITUYE al Spinner generico
|##                                          ##|
|##   {estado 40px: acerca tu tarjeta}       ##|
|##############################################|  1180
|#   {metodo aceptado, iconos 96px}            #|
|==============================================|  1480
|=====   R E I N T E N T A R   (solo si falla)=|        libera el cerrojo requested.current
|==============================================|
|=  cancelar  26px — DESAPARECE en cuanto el   =|        approved/under_review => sin cancelar libre
|=  pago queda comprometido                    =|
|# {id-maq} · {contacto}                       #|  1780
+----------------------------------------------+

APROBADO: la pantalla ENTERA corta (0 ms) al color de rol "confirma".
Nada de StatusPill verde. El corte se ve desde el pasillo.
```

```
PANTALLA 5 · CAPTURA — toma 3 de 6, cuenta en 2
+----------------------------------------------+
|ooooooooooooooooooooooooooooooooooooooooooooooo|  0    chase 8/s durante la cuenta
|░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░|  120  ARO DE LUZ 96px: la pantalla ilumina
|░..............................................|
|░...........(o)..............(o)..............░|        ojos del lente: crecen x1.9 en el ultimo s
|░..............................................|
|░...............██████████████.................|
|░...............██████████████.................|        NUMERAL 416px en tinta sobre el campo
|░...............          ████.................|        un acento distinto por segundo
|░...............    ██████████.................|        SIN velo negro. El color es la señal
|░...............    ██████████.................|
|░...............          ████.................|
|░..............................................|
|░.....  el espejo NO baja de opacidad  ........|        se mantiene al 100% hasta t-0.35s:
|░.....  la persona sigue viendose      ........|        vino a verse, no a perderse de vista
|░..............................................|
|░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░|
|##############################################|  1180  REPISA: la tira ES el progreso
|#  [1]  [2]  [3]  [ ]  [ ]  [ ]               #|        6 huecos de 144x192, canto punteado
|#  llenos con su acento · vacios punteados    #|        cero "3 de 6", cero ProgressDots
|#  ,---.                                      #|
|# ( > < ) blob 4 a 320px HACIENDO la pose     #|        instruccion sin idioma
|==============================================|  1480
|=====   A H O R A   (adelanta el disparo) ====|        objetivo 1080x160
|==============================================|
|=  luz: suave / normal / brillante  3 fichas =|        sube el area del ARO, no un menu de filtros
|# {id-maq}                                    #|  1780
+----------------------------------------------+

Ritmo: primera toma 9s de preparacion + 3 de cuenta; siguientes 5 + 3.
Revision inline 1.0 s. Seis tomas = 58 s. Un solo toque arranca la rafaga.
Nunca hay reloj de sesion en esta pantalla.
```

```
PANTALLA 6 · REVISION — elegir 4 de 6, descartando
+----------------------------------------------+
|oooooooooooooooooooo o o o o o o o o o o o o o|  0     reloj de 40 s
|##############################################|  120
|##  ┌──────────────┐  ┌──────────────┐      ##|
|##  │              │  │              │      ##|
|##  │   FOTO 1     │  │   FOTO 2     │      ##|        480x640 cada una, 3x2
|##  │              │  │              │      ##|        rectangulos: son el producto
|##  └──────────────┘  └──────────────┘      ##|
|##  ┌──────────────┐  ┌──────────────┐      ##|
|##  │   FOTO 3     │  │   FOTO 4     │      ##|
|##  └──────────────┘  └──────────────┘      ##|
|##  ┌ ─ ─ ─ ─ ─ ─ ┐  ┌──────────────┐       ##|
|##  │  FOTO 5     │  │   FOTO 6     │       ##|        la 5 esta descartada: 40% opacidad
|##  └ ─ ─ ─ ─ ─ ─ ┘  └──────────────┘       ##|        se toca para recuperarla
|##############################################|  1180
|#  te llevas 4 · toca las que no quieras      #|        26px, una linea
|#  ,---.                                      #|
|# ( ^ ^ ) blob 2, 280px, celebrando           #|
|==============================================|  1480
|=====   A S I   E S T A   B I E N   96px  ====|        el sistema ya descarto las 2 peores
|==============================================|
|# {id-maq} · {contacto}                       #|  1780
+----------------------------------------------+

Descartar 2 de 6 en vez de elegir 4 de 8: misma emocion, mitad de carga.
Sin comparar, sin repetir toma, sin rejilla de gestor de archivos.
Al agotarse el reloj: avanza con la seleccion automatica del analizador.
```

```
PANTALLA 7 · EDICION — una sola decision
+----------------------------------------------+
|oooooooooo o o o o o o o o o o o o o o o o o o|  0     reloj de 45 s: focos apagandose
|##############################################|  120
|┌────────────────────────────────────────────┐|
|│                                            │|
|│      TU FOTO A SANGRE, 1080 x 1060         │|
|│      sin sombra, sin fondo blanco,         │|        muere .kiosk-edit (3fr/2fr)
|│      sin columna hermana, sin 55vh         │|        muere .kiosk-edit__tools con scroll
|│                                            │|
|│   el marco de acento va dibujado ENCIMA,   │|
|│   igual que en el espejo: cero sorpresa    │|
|│                                            │|
|│   sticker: se toca la foto y cae ahi       │|        maximo 3, tres tamaños por toques
|└────────────────────────────────────────────┘|
|##############################################|  1180  REPISA: seis looks con TU cara
|# (1)  (2)  (3)  (4)  (5)  (6)                #|        miniaturas de 240px, amplitud 0.30
|# ###  ###  ###  ###  ###  ###                #|        el look N = silueta N con acento N
|# el activo: aro de 8px + escala 1.06         #|        renderizadas sobre un still de 640x360
|==============================================|  1480
|=====   A S I   E S T A   B I E N   96px  ====|        presente desde el segundo cero
|==============================================|
|=  como estoy   |   un poquito   (2 fichas)  =|        el unico control de retoque. Sin jerga
|# {id-maq} · {contacto}                       #|  1780
+----------------------------------------------+

Cero sliders, cero scroll, cero chips de 48px, cero antes/despues.
```

```
PANTALLA 8 · CIERRE — la entrega, con el QR pintado antes del render
+----------------------------------------------+
|oooooooooooooooooooooooooooooooooooooooooooooo|  0     los 24 encendidos: la celebracion
|##############################################|  120
|####       {rotulo 96px: ya esta}         ####|
|##                                          ##|
|##  ┌───────────┐          ┌───────────┐    ##|
|##  │  ███████  │          │  ███████  │    ##|        320x320 cada uno, papel BLANCO PURO
|##  │  ██ ▄▄ █  │          │  ██ ▄▄ █  │    ##|        quiet zone 4 modulos, correccion alta
|##  │  ███████  │          │  ███████  │    ##|        1 = unete a la red · 2 = abre tus fotos
|##  └───────────┘          └───────────┘    ##|        brillo del panel al maximo aqui
|##       1                      2           ##|
|##   {que hace cada uno, 26px}              ##|
|##                                          ##|
|##   {codigo 120px mono: ABC · 123}         ##|
|##   {te quedan 4:38 para escanear}  40px   ##|
|##############################################|  1180
|#   el clip de la sesion en bucle, 320px      #|        4-6 s, se compone en el aparato
|#   ,-. ,-. ,-. ,-. ,-. ,-.                   #|
|#  (oo)(^^)(--)(><)(oo)(^^)  los seis         #|        LOS SEIS, no tres como hoy
|==============================================|  1480
|=====   L I S T O   /   O T R A   V E Z  =====|
|==============================================|
|# {id-maq} · {contacto} · {se borra al salir} #|  1780
+----------------------------------------------+

Cuando el telefono ya se unio a la red (primer GET al servidor local),
el QR 1 se apaga y el 2 crece a 560px: un solo objetivo.
Si el producto declara impresion, el bloque de los dos QR se sustituye por
la tira saliendo, con el mismo tamaño y la misma posicion. Es un slot.
Ni tabla clave/valor ni recibo: eso muere aqui.
```

---

## 5. Movimiento

Regla de presupuesto: **sólo `transform` y `opacity`**. Cero `filter`, cero `blur` sobre superficie completa, cero animación de `background-color` (se cortan campos con dos capas y opacidad). Máximo 6 elementos con `will-change` a la vez. El lazo de análisis corre a **~12 fps sobre 640×360** —ése es el número real en `apps/kiosk/src/camera/useCamera.ts`, no 15— y no se toca.

### 5.1 El momento orquestado: EL PARPADEO ES EL OBTURADOR

`t = 0` es el disparo.

| t | Qué | Curva | Duración |
|---|---|---|---|
| −8.0 … −3.0 | El blob de la pose entra desde la izquierda `translateX(-220px→0)` y hace la pose | `cubic-bezier(.2,.8,.2,1)` | 280 ms |
| −3.0 / −2.0 / −1.0 | Cada dígito: `scale(.62→1.08→1.00)` + `opacity 0→1`; sale `scale(1.00→1.26)` + `opacity→0`. Campo corta al acento del segundo | entrada `cubic-bezier(.34,1.4,.64,1)`, salida `ease-in` | 180 ms entrada, 620 ms sostén, 200 ms salida |
| −2.0 | El aro de luz crece de 0 a 96 px alrededor del espejo; brillo del panel al máximo | `ease-out` | 320 ms |
| −0.35 | **Los ojos del lente se cierran**: dos arcos de 3.2 px barren hacia abajo | `ease-in` | 140 ms |
| 0 | Destello: blanco al 90 %, luego caída al acento | lineal / `ease-out` | 110 ms + 180 ms |
| +0.11 | Los ojos se abren | `ease-out` | 90 ms |
| +0.12 … +0.57 | La foto vuela del centro a su hueco: `translate3d` + `scale(1→0.14)` + `rotate(6deg)`, aterriza con `scaleY(.92→1)` | `cubic-bezier(.2,.7,.2,1)` + 60 ms de aplastamiento | 450 ms |
| +0.60 | El hueco se llena de su acento; entra la pose siguiente `translateY(120→0)` | `cubic-bezier(.2,.8,.2,1)` | 380 ms |

El espejo **no** baja de opacidad ni se contrae antes del disparo. Bandada lo hacía y peleaba contra el motivo de compra.

Máximo **un destello por toma**, mínimo **700 ms entre destellos**, jamás más de tres por segundo. Y el mismo criterio se aplica —esto lo omitían las tres direcciones— a los **cortes de campo completo**: nunca más de un corte de campo por segundo, y nunca dos cortes consecutivos con diferencia de luminancia relativa mayor a 0.5. Si la paleta lo produce, se interpone un fotograma de Aro.

### 5.2 La marquesina (injerto de *Marquesina*, corregido)

24 focos de 28 px, separación 16 px, margen 20: `24·28 + 23·16 + 2·20 = 1080` exacto. Cada foco es un cuadro de 64 px con el halo **horneado en el fondo**, pintado una vez:

```css
.psp-foco{width:64px;height:64px;
  background:radial-gradient(circle closest-side,
    var(--psp-aro) 0 38%, color-mix(in srgb,var(--psp-aro) 45%,transparent) 62%, transparent 78%);
  opacity:.30}
.psp-foco[data-on]{opacity:1}
```

Sólo se anima `opacity`. Sin halo, 24 puntos de 28 px a cuatro metros leen como una línea punteada, no como una marquesina — ése fue el reparo del juez y aquí queda resuelto sin `filter`.

Cadencias, y son las únicas que existen:

| Estado | Comportamiento |
|---|---|
| Atracción, llamando | Chase de 2 focos/s recorriendo los 1080 px: es el movimiento legible a 15–25 m |
| Pantalla de decisión | Deja de correr; se apaga un foco cada `presupuesto/24` segundos. Es el **único** cronómetro del producto |
| Pago esperando | Chase lento de 1/s |
| Cuenta regresiva | Chase de 8/s |
| Foto que entra a la tira | Un foco se enciende de golpe |
| Cierre | Los 24 encendidos, fijos |

**La marquesina sustituye a `TimeoutBar` con números en el recorrido social.** Nunca hay un contador en rojo.

### 5.3 Vida de fondo

- **Respiración**: los blobs escalan 1.000 → 1.045 (seno de 3.4 s), rotan ±3.5°, suben y bajan 22 px, con el `animationDelay` de 0.18 s por variante que el componente ya fija. Los 6 px de hoy son invisibles a metro y medio.
- **Parpadeo**: cada 4.5–7.5 s por variante, semilla determinista, 120 ms de cierre y 60 ms de apertura. Nunca sincronizado entre las seis.
- **Mirada**: prop nuevo `gaze:{x,y}` que interpola los ojos hasta ±6 unidades de lienzo en 380 ms, `cubic-bezier(.22,1,.36,1)`. En atracción los seis miran al frente en el beat 1, al precio en el 2 y al botón en el 5.
- **Transición entre pantallas — el tragón**: la silueta de la etapa siguiente crece desde su ancla hasta radio 1376 px (cubre la diagonal), rotando 18°, 420 ms `cubic-bezier(.2,.8,.2,1)`, y la pantalla nueva se revela dentro. Al retroceder, la curva se invierte. La marquesina **nunca** participa: es el ancla que dice que sigues en la misma máquina.
- **Deriva de campo**: se retira. Era el único derroche real de cómputo de las tres propuestas. El anti-quemado lo resuelve el cambio de beat más 1 px/min de desplazamiento de la composición.

### 5.4 `prefers-reduced-motion` — y cómo se alcanza

El transeúnte no puede activar la preferencia del sistema. Se añade `kiosk.reducedMotion` al bundle (el operador la fija) **y** una ficha de 96 px en el zócalo de atracción que la activa para la sesión. El media query se sigue respetando cuando existe. Cualquiera de las tres fuentes activa el modo.

En modo reducido:

- Sin destello. En su lugar el aro de luz engorda 40 px durante 260 ms.
- Sin vuelo de miniatura: la foto funde en su hueco, 160 ms.
- Sin respiración, sin tragón: el cambio de pantalla es un fundido de opacidad de 120 ms.
- El numeral cambia sin escala; **el corte de campo se conserva**, porque es información cromática y no estímulo vestibular.
- Los focos dejan de correr pero **siguen apagándose de uno en uno**: es cambio de estado a menos de 0.5 Hz, muy por debajo del umbral.
- **El parpadeo de los ojos se queda.** 140 ms de cambio de forma en un objeto pequeño no es estímulo vestibular, y es el único aviso visual del instante del disparo para quien no oye.
- El bucle de atracción no se congela: los beats siguen cortando cada 6 s. Una pantalla inmóvil no convoca a nadie, y convocar es el producto entero.

---

## 6. Sonido

**No se empaqueta ni un archivo de audio.** `packages/ui/src/kiosk/sound.ts` ya existe: una partitura de datos puros con seis avisos (`tick`, `tick_last`, `shutter`, `complete`, `tap`, `reject`), sintetizados con osciladores, probados en Node, con el contexto creado hasta el primer toque y `volumeToGain` con techo 0.35. Las tres direcciones proponían sustituirlo por `.opus` empaquetados; eso cambia un sistema de cero activos, idéntico en cualquier aparato y verificable sin navegador, por binarios en el APK. Se conserva y se extiende.

Se añaden dos cues a `SOUND_SCORES`:

| Cue | Cuándo | Partitura |
|---|---|---|
| `land` | La miniatura aterriza en su hueco | un tono `sine` de 440 Hz, 0.12 s, gain 0.22 |
| `approved` | El pago queda aprobado, en el mismo fotograma del corte de campo | dos `triangle`, 523.25 y 783.99 Hz, 0.10 s cada uno, gain 0.5 |

El `tick` suena en −3 y −2; el `tick_last` en −1; el `shutter` en `t=0`, programado en la **misma tarea** que el `requestAnimationFrame` del destello, para que luz y sonido caigan en el mismo fotograma; el `complete` una sola vez, al terminar la tanda.

**Lo que no suena:** música de fondo, voz que cuenta, zumbador de error. Si una marca quiere voz, entra como archivos de audio por locale en su bundle, opcional y silenciable.

**Cómo se apaga:** `audio.volume` (nueva clave de bundle, 0–1, valor de fábrica 0.35) y modo silencio total como estado de operación de primera clase. **Con el volumen en cero no se pierde una sola instrucción**, porque cada aviso tiene gemelo visual obligatorio: `tick` = pulso del anillo y cambio de acento del numeral; `shutter` = parpadeo de los ojos y destello; `land` = aplastamiento del aterrizaje y foco que se enciende; `complete` = los seis blobs entrando; `approved` = la pantalla entera cambiando de color. El contagio hacia el pasillo lo consigue el espejo vivo y el corte de campo, que no necesitan permiso de audio.

En documental: sólo `shutter` y `tap`, a −6 dB.

---

## 7. El elemento firma

### Los ojos del lente

Dos elipses de tinta, flotando sobre el vídeo, exactamente donde está la cámara física. Cuando se cierran, la foto ya se tomó.

Es lo único de este producto que nadie puede copiar sin robarse la familia entera, y hace cinco trabajos a la vez: dirige la mirada al lente sin letrero y sin idioma —el problema número uno de todas las cabinas del mundo, que en Corea se resuelve con un cartel—, marca el instante exacto del disparo, avisa a quien no oye el obturador, ata la marca al momento en que la persona más está mirando, y sobrevive a cualquier cambio de paleta, de tipografía y de layout.

**Implementación, hasta el detalle:**

1. **Anclaje.** Dos claves nuevas de bundle: `kiosk.lens.offsetX` y `kiosk.lens.offsetY`, en porcentaje de la pantalla, valor de fábrica `50 %` y `6 %`. Cambian con el modelo de aparato. Si `offsetY < 3 %` (la cámara acabó en el bisel), los ojos se dibujan **debajo** del borde superior con una flecha corta de tinta apuntando hacia arriba, en vez de recortarse contra el canto.
2. **Geometría.** Se reutiliza el bloque de ojos de `BlobFace.tsx`: dos elipses en `#111` separadas por `SHAPES[variant].eyes.gap`, escaladas a 96 px de diámetro cada una en reposo. Sin pupilas con brillo, sin cejas, sin destello. La ternura viene del movimiento, no del maquillaje.
3. **Capa.** SVG absolutamente posicionado sobre el `<video>`, con `pointer-events:none`. Único elemento de interfaz permitido dentro de la banda CARTEL durante la captura.
4. **Estados.**
   - *Reposo / atracción*: parpadeo aleatorio cada 4.5–7.5 s, `scaleY(1→0.06→1)` en 120/60 ms.
   - *Preparación*: `gaze` sigue la caja de rostro más grande que devuelve el analizador, interpolando en 380 ms. Si no hay caja, mira al frente.
   - *t = −2.0 s*: `scale(1.0→1.9)` en 900 ms, `ease-out`, y el relleno pasa al acento de rol **luz** (el de mayor luminancia de la paleta, calculado, no elegido).
   - *t = −0.35 s*: **cierre**. Dos arcos de 3.2 px de grosor barren hacia abajo en 140 ms, `ease-in`. `scaleY` de la elipse de 1 a 0.05.
   - *t = +0.11 s*: apertura en 90 ms.
5. **Accesibilidad.** El parpadeo permanece bajo `prefers-reduced-motion`. Se acompaña de `aria-live="polite"` que anuncia los últimos tres segundos —hoy `Countdown.tsx` declara `role="timer"` con `aria-live="off"` y no anuncia nunca.
6. **Coste.** Dos elipses SVG animadas por `transform`. Cero impacto sobre el lazo de análisis.

---

## 8. Lo que se retira

**La pantalla de revisión foto a foto.**

`apps/kiosk/src/screens/Review.tsx` en su forma actual —aprobar o repetir cada toma, con `CompareView` de dos imágenes fijas y un botón que sólo actúa sobre `latest[0]`— desaparece del recorrido social. Se dispara de más precisamente para que nadie tenga que aprobar de una en una: seis tomas, cuatro huecos, y la única decisión es descartar dos. La ruta `review` sobrevive con contenido nuevo (Pantalla 6), y toda la mecánica de `retakesForPhoto` queda **sólo en el recorrido documental**, donde la fidelidad manda.

Con ella se van, por nombre:

- `.kiosk-card` — fondo blanco, radio 20 px, sombra al 6 %, en trece pantallas.
- La línea `const surface = bgIsDark ? … : LIGHT` de `theme.ts` que fuerza blanco puro cuando la marca declara fondo claro. Es el origen exacto del resultado rechazado.
- `--psp-shadow-sm/md/lg` en el modo kiosco (azul marino `rgba(11,27,63,…)` que ninguna marca puede cambiar).
- `.kiosk-capture` (2fr/1fr) y `.kiosk-edit` (3fr/2fr): el layout lienzo+inspector de Lightroom.
- `.kiosk-preview { max-height: 55vh }` y su sombra y su fondo blanco.
- `.kiosk-edit__tools` con `overflow-y:auto`, sus cinco `TouchSlider` y su reserva de 4 px para la barra de desplazamiento.
- `.psp-choice` con borde gris derivado del texto.
- `.psp-notice` de 480 px en esquina: un aviso de fuera de servicio ocupa la pantalla entera.
- `.kiosk-grid` de fichas de 280 px.
- `ProgressDots` en el recorrido social: la tira es el progreso.
- El velo `rgba(0,0,0,0.35)` de `.kiosk-capture__countdown`.
- El flash de 500 ms.
- El encabezado permanente de 64 px con logo y `LangSwitch` en atracción, captura, cuenta y cierre.
- El pellizco para escalar stickers: con táctil IR dos contactos generan puntos fantasma. Se sustituye por toques repetidos que ciclan tres tamaños.

---

## 9. Orden de implementación

Cada paso se verifica **mirando la pantalla**, no leyendo un diff.

1. **Tokens de luz.** Añadir `--psp-aro`, `--psp-rincon`, `--psp-lift`, `--psp-flash`, `--psp-qr-paper`; retirar el forzado de superficie blanca y las sombras azul marino del modo kiosco. *Se ve:* la misma pantalla de hoy deja de tener rectángulos blancos y sus sombras toman el tono de la marca.
2. **`assignAccentRoles` y degradación de paleta.** *Se ve:* con un bundle de dos acentos la cabina entra en modo dos habitaciones y no repite colores en silencio.
3. **Escala y foco.** Todo a `em`/tokens, `--psp-font-base: 26px`, anillo doble tinta+crema. *Se ve:* el texto destacado por fin es mayor que el cuerpo, y el anillo de teclado se distingue sobre crema.
4. **Tipografía empaquetada.** Subset de Archivo y Martian Mono, `@font-face`, `preload`, claves `branding.typography.*` en contratos. *Se ve:* la cabina deja de verse con Roboto.
5. **Las cinco bandas y el modo a sangre.** `KioskShell` con `data-bleed`; ninguna pantalla táctil por encima de y=1180. *Se ve:* el color llega al borde del vidrio y no queda ningún botón a la altura de la cara.
6. **La marquesina.** 24 focos con halo horneado, cinco cadencias, reemplazando a `TimeoutBar` en el recorrido social. *Se ve:* desde el fondo del pasillo hay algo corriendo en la parte alta del panel.
7. **`blobPath(amplitude, spin)` y los blob-contenedores.** Máscaras horneadas, fundido cruzado entre 0.14 y 0.30. *Se ve:* botones y fichas dejan de ser rectángulos redondeados.
8. **Los ojos del lente y el parpadeo-obturador.** Con la máscara del espejo en 0.14 y el analizador degradando al caso seguro. *Se ve:* la persona mira arriba sola, sin instrucción escrita.
9. **La captura como ráfaga.** Un toque, seis tomas, tira de huecos, vuelo de miniatura, aro de luz, destello de 110 ms, cuenta por `requestAnimationFrame` con reloj real y limpieza del intervalo en el cleanup. *Se ve:* nadie toca un botón entre pose y pose y la cuenta ya no salta a tirones.
10. **Atracción con gatillo de presencia.** Cinco beats, corte de campo, salto al beat espejo con ≥1 rostro durante 400 ms, apagado del vídeo tras 8 s sin nadie, retorno al idioma de fábrica tras 30 s sin toques. *Se ve:* al pararse enfrente, la pantalla cambia sola y te muestra tu cara.
11. **Elegir, consentimiento y pago.** Una habitación grande + riel de seis, una frase + dos botones, precio de 300 px con los blobs haciendo cola y corte de pantalla al aprobar. *Se ve:* desaparecen las cinco tarjetas apiladas y el spinner genérico.
12. **Revisión y edición.** Descartar 2 de 6, foto a sangre, seis looks con la cara real, dos fichas de retoque, presupuesto de 45 s con salida visible desde el segundo cero. *Se ve:* no hay ni un slider ni una barra de desplazamiento.
13. **Cierre.** Token y URL local generados **antes** de que termine el render en alta; doble QR sobre papel blanco; código de 120 px; clip de la sesión en bucle; los seis blobs. *Se ve:* nadie mira un spinner de cierre.
14. **El tragón y los sonidos nuevos.** Transición entre pantallas y `land` / `approved`. *Se ve y se oye:* la sesión avanza sin cortes secos.
15. **Casos esquina que el diseño no puede tapar** (y sin los cuales nada de lo anterior sobrevive un día en una plaza): cerrar la sesión en el agente antes de volver a atracción; textos i18n para `session_active`, `machine_unavailable`, `product_unavailable`, `retakes_exhausted`, `no_composition`; `onAutoAdvance` en `SessionFrame`; heartbeat que sincronice los dos relojes; reintento de pago que libere el cerrojo; `cancelPaymentIntent` conectado; cámara caída que no cae a la fuente sintética; reconciliación de sesión al reabrir el SSE; filtro por `sessionId` en la rama `session` del reductor; guardia global para etapas terminales.

---

## 10. Cómo se verifica

### 10.1 A cuatro metros (la única prueba que importa)

Se fotografía el panel encendido desde 4 m con el pasillo iluminado, y se mira la foto **en miniatura de 120 px de ancho**. Criterio: se distinguen (a) que hay una cara humana en la pantalla, (b) que algo se mueve arriba, (c) el numeral del precio. Si alguna de las tres se pierde, la pantalla no pasa.

### 10.2 A un segundo

Se graba el bucle de atracción y se toman cortes aleatorios de 1 s. Criterio: **cualquier** ventana de 1 s comunica que es una cabina de fotos, cuánto cuesta y dónde se toca. Un beat que sólo tiene sentido si lo ves entero no pasa.

### 10.3 Zonas

Prueba automática sobre el DOM renderizado de las ocho pantallas: **ningún elemento con `onClick`, `role="button"` o `tabindex` tiene su centro por encima de y=1180 ni por debajo de y=1780**, salvo la pantalla de atracción, donde el objetivo es el vidrio entero. Área táctil mínima 64 px; en decisiones de una sola vez (obturador, "así está bien", descartar) mínimo 96 px de alto.

### 10.4 Contraste y accesibilidad

- `contrastRatio(text, campo)` ≥ 4.5:1 para todo texto de 26 px; ≥ 3:1 para 40 px y mayores. Verificado al aplicar el tema, con corrección iterativa y con la marca `no-field` como salida.
- Anillo de foco: al menos una de sus dos mitades supera 3:1 contra el campo, en las seis habitaciones.
- Recorrido completo con teclado: el foco es visible en cada paso y el orden sigue la lectura.
- Paridad de claves es/en verificada por la compuerta existente.
- Todo aviso sonoro tiene su gemelo visual: se corre el recorrido con `audio.volume = 0` y no se pierde ninguna instrucción.
- Fotosensibilidad: se cuentan los eventos de luminancia por segundo sobre grabación de la sesión completa. Máximo tres; en la práctica, uno por toma con 700 ms de separación. Se cuentan también los cortes de campo.
- Modo reducido activado por las tres vías (media query, `kiosk.reducedMotion`, ficha del zócalo).

### 10.5 Rendimiento

- Durante la captura, con el espejo, la máscara, la marquesina y los blobs activos: **≥50 fps de composición** y el lazo de análisis sosteniendo sus ~12 fps sobre 640×360, medido en el aparato objetivo, no en una laptop.
- Memoria de texturas por debajo de 60 MB. Prohibido cualquier elemento animado mayor que la pantalla.
- Doce horas de bucle de atracción sin subida de temperatura sostenida ni retención de imagen.

### 10.6 Tiempo

Cronómetro sobre el recorrido completo, con una persona que nunca vio la cabina: atracción→pago ≤45 s, disparo ≤70 s, revisión ≤40 s, edición ≤45 s, entrega ≤30 s. **Total objetivo 3:10, tope duro 3:30.** Cualquier pantalla nueva tiene que decir de qué tramo roba sus segundos.

### 10.7 Marca

- Compuerta de marca vigente: el build falla si el nombre literal aparece en el código de la interfaz. Ningún nombre de look, plantilla, precio o texto de negocio vive fuera de i18n y del bundle.
- Se renderizan las ocho pantallas con **tres bundles distintos**: la paleta demo, una paleta de dos acentos y una paleta oscura. Criterio: las tres se ven como productos distintos y ninguna se rompe.
- Ningún componente referencia `--psp-color-accent-N` por índice fuera de `BlobFace`.

### 10.8 La firma

Prueba con personas: se pide a cinco personas que nunca vieron la cabina que hagan una sesión sin instrucciones. Criterio: **al menos cuatro miran al lente en el momento del disparo** y las cinco saben, sin que se les diga, que la foto ya se tomó.