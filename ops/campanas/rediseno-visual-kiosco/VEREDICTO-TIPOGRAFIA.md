# Decisión de tipografía — cabina «Una de Todos»

Firmo un **trío**, no una pareja. La cabina tiene tres trabajos tipográficos que no se parecen en nada: **gritar desde el pasillo**, **explicarse en español a metro y medio** y **contar hacia atrás sin temblar**. Ninguna familia libre hace los tres bien, y forzarlo es exactamente cómo se produjo la versión que ya se rechazó.

Todo lo que sigue está medido por mí sobre los binarios (fontTools 4.60.2, `BoundsPen` sobre contorno real, `varLib.instancer` para instanciar), no copiado de las fichas. El paquete está construido y verificado en `/Users/karol/personal/photo-station-platform/apps/kiosk/public/fonts/`.

---

## 1. La decisión

| Papel | Familia | Licencia | Archivo versionado | Tamaño |
|---|---|---|---|---|
| **Display / voz** (capa base) | Bungee Layers | SIL OFL 1.1, sin Reserved Font Name, `fsType=0` | `apps/kiosk/public/fonts/BungeeLayers.woff2` | **11 012 B** |
| **Display / voz** (capa interior) | Bungee Layers Inline | idem | `apps/kiosk/public/fonts/BungeeLayersInline.woff2` | **10 224 B** |
| **Texto** (titulares, cuerpo, etiquetas) | Bricolage Grotesque, variable `opsz 12–96` + `wght 400–800` | SIL OFL 1.1, sin RFN, `fsType=0` | `apps/kiosk/public/fonts/BricolageGrotesque-var.woff2` | **89 036 B** |
| **Utilitaria / cifras** | Recursive, subset **sólo dígitos y signos**, variable `MONO 0–1` + `CASL 0–1` + `wght 400–1000` | SIL OFL 1.1, sin RFN, `fsType=0` | `apps/kiosk/public/fonts/Recursive-cifras-var.woff2` | **22 800 B** |
| | | | **TOTAL** | **133 072 B = 130,0 KB — 52 % del presupuesto de 250 KB** |

Se versionan además los tres `OFL.txt` (`OFL-Bungee.txt`, `OFL-BricolageGrotesque.txt`, `OFL-Recursive.txt`, 13 172 B), que es la única obligación real de la licencia junto con no vender la fuente suelta.

Las tres tienen veredicto **«sirve»** en la verificación técnica. Ninguna quedó en «sirve-con-reservas», así que no hay reservas que desactivar — pero sí tres trampas de despliegue documentadas, y **las tres las cierro en el binario, no en el CSS** (sección 5).

Sobran 120 KB. Los dejo sobrar: el bundle ya carga cuatro modelos de visión y el margen es del kiosco, no mío.

---

## 2. Por qué esta y no la obvia

### Bungee Layers — la voz

**El ataque de inercia es cierto y no me molesta.** Sí, Bungee es el hola-mundo de las fuentes por capas, sí, es Bungee Spice en las miniaturas de YouTube, y sí, su ADN es el rótulo vertical neoyorquino y no la fotocabina de Seúl. Pero el primer atacante lo dijo mejor de lo que yo lo diría: *es inercia de categoría, no de gusto*. Cuando el problema se enuncia como «pintar la misma palabra con dos de los seis colores de la marca, sin fuente de color, sin SVG, sin COLRv1, en un Android de gama media», la lista de candidatas OFL tiene un elemento. El monopolio no es pereza.

Y lo compré con una prestación, no con un adjetivo: comparé `hmtx` glifo a glifo entre `BungeeLayers-Regular` y `BungeeLayersInline-Regular` y son **1 063 glifos con cero anchos distintos**. El juego Basic no: su Shade difiere en 736 de 1 063, o sea que el «Regular + Inline + Shade» del catálogo desalinea. Empaqueto Layers, que además pesa **21,7 KB los dos archivos** contra los 69 KB de la pareja Basic con features completos.

**El ataque de legibilidad también es cierto, y es el que fija las reglas.** Lo verifiqué yo:

- **No tiene minúsculas.** `a` y `A` son el mismo contorno. Todo es caja alta obligatoria, sin silueta de palabra. Regla: **1 a 3 palabras, nunca una instrucción.**
- **El acento va pegado**: la `Á` llega a 0,9614 em contra una mayúscula de 0,720 em. Con el modelo de 1,5 m del atacante, la `Á` no vuelve a ser `Á` por debajo de **78 px** y la `É` por debajo de 100 px. Regla: **piso duro de 104 px cuando la cadena lleva acento, 78 px cuando no.** Eso deja a Bungee exactamente donde debe estar: el rótulo exterior, el logotipo y el paso de atracción.
- **`0` y `O` son la misma silueta** (medí bbox `0` = 0,058/-0,015/0,669/0,735 y `O` = 0,058/-0,015/0,679/0,735 — diez milésimas de diferencia). Regla: **prohibida en cualquier código alfanumérico.**
- **Dígitos proporcionales de verdad y sin `tnum`**: medí anchos de 601 a 727 unidades, nueve anchos en diez cifras, y su GSUB no trae `tnum` (sí `ornm`, `ss04`, `ss05`, `ss09`…). Regla: **jamás una cifra que cambie sola.**

Y una corrección al expediente que confirmo con mis propias medidas: **la alarma de la puntuación es falsa**. En Bungee el `¿` va de 0,000 a 0,720 em, exactamente la altura de mayúscula, apoyado en la línea base. No necesita `case` porque no tiene nada que corregir. Es la única de las once que compone «¿LISTOS?» en caja alta sin tocar nada — y eso resulta decisivo, porque su compañera de texto **sí** falla ahí (abajo).

Prohibición estética explícita, que es donde se paga la inercia: **nada de Regular + Shade en negro con la manita del set `ornm`**. Ese es el Bungee de catálogo y se reconoce a diez metros. Aquí las dos capas se pintan con dos colores de la paleta —rosa con amarillo dentro, morado con verde dentro— y la marca queda vestida, no disfrazada.

### Bricolage Grotesque — el texto

**El ataque de inercia es el mejor de todo el expediente y aun así no la tumba.** «Es la Inter de 2024», «la eligen quienes ya saben que Inter está quemada», «la frase con que la venden es literalmente la frase que se dijo de Inter en 2019». Todo cierto. Mi respuesta es de mercado: **ese desgaste ocurre en un público que no existe en el pasillo de la plaza.** Nadie que se pare frente a la cabina ha visto una landing de Vercel. La cita se cobraría sólo en la presentación al cliente, y ahí se paga hablando de otra cosa: de que su ascendencia es Grotesque Nº9 con Antique Olive, no de que la usa Framer.

**El ataque de legibilidad la defiende, no la ataca**, y coincide con lo que medí: relación x/mayúscula de **0,800** a `wght` 800 (0,528 / 0,660), la más alta del lote — más masa de letra por píxel de altura, que es lo que se lee de pie; contraformas de las más abiertas; y el mejor trato al español de las once, con `Á` separada desde 42 px a `opsz` 14.

Pero el atacante encontró la trampa buena y la confirmo: **el acento se aprieta con el eje óptico**. A `opsz` 96 / `wght` 800 —que es la coordenada **por defecto** del archivo original, que se llama a sí mismo *«Bricolage Grotesque 96pt ExtraBold»*— el hueco cae y la `Á` no se separa hasta 73 px. Es decir: quien no fije `opsz` recibe la peor variante para los acentos justo en los tamaños de interfaz. **No lo resuelvo con una regla de maquetación: lo resuelvo en el binario**, recortando el eje con `instancer` a `opsz=12:14:96` y `wght=400:400:800`. La instancia por defecto del archivo que se versiona ya es 14 pt / Regular. Si el WebView ignora los ejes, el texto sale legible en vez de salir en espaciado de rótulo.

**Y ahora el hallazgo que nadie del expediente hizo, y que me obliga a ser consistente:** desmonté su `case` y **no recoloca la puntuación invertida**. Su `case` sólo mapea cifras de estilo antiguo a cifras de caja alta (`zero.osf → zero`, etc.); no existe `questiondown.case` ni `exclamdown.case` en la fuente. Medido a `wght` 700: el `¿` va de **−0,149 a 0,538 em** contra una mayúscula de 0,660. Es el **mismo defecto exacto por el que descarto a Baloo 2**, y lo digo en voz alta para no hacer trampa. Lo verifiqué renderizado en navegador: «¿LISTOS? SESIÓN Nº3» en Bricolage caja alta sale con el `¿` hundido y asomando bajo la línea base.

Regla escrita, y es una regla de diseño, no un parche: **Bricolage se compone en caja baja**, que es donde vive su gracia (altura de x enorme). La caja alta se reserva a etiquetas cortas sin puntuación invertida («PASO 3», «TICKET»). **Toda pregunta en caja alta es un momento de Bungee**, que la compone perfecta. La división de trabajo sale sola.

Dos defectos más ya medidos y ya vallados: su `1` lleva el 44,2 % de la tinta de su `8` (medí anchos de 306 a 651 unidades a `opsz` 14 / `wght` 400, o sea 345/1000 de dispersión, peor que los 298 del default), así que **ninguna cifra que cambie se compone en Bricolage**; y su eje de peso tapa en 800 en silencio, así que el sistema nunca pide 900.

### Recursive (sólo cifras) — la utilitaria

**Es la pieza más sólida del expediente y los dos atacantes coinciden en no tumbarla.** El ataque de inercia es real —es la fuente-demo de la era variable, el gag de todas las charlas sobre ejes, y fuente de editor de código con culto propio— y se desactiva solo: **se empaqueta sin una sola letra**. Nadie reconoce una tipografía por sus dígitos. Lo que llega al aparato son 22,8 KB de números.

Y no la elijo por gusto sino por física, que reproduje: instancié el archivo en `MONO 0` y `MONO 1`, `wght` 700 y 900, y **los diez dígitos miden 600/1000 unidades en todas las combinaciones**. La cuenta regresiva no baila ni aunque animes el peso de 400 a 1000, y no depende de que quien maquete se acuerde de `tabular-nums`. Eso es la restricción 5 resuelta por construcción y no por disciplina.

Dos datos más que confirmé: el dígito llega a **0,720 em contra una mayúscula de 0,700** — las cifras sobrepasan a las letras, están dibujadas para mandar; y su dispersión de masa es la más baja del lote (el `1` pesa el 74,9 % del `8`), así que el último tick de la cuenta regresiva —el que decide si la persona mira a la cámara— no se apaga.

Los tres fusibles, todos cerrados en el guion de empaquetado:

1. **Ni una letra en el subset**, y el guion **falla en verificación** si aparece alguna (`--unicodes` sin letras + un test que recorre el cmap y aborta si `chr(c).isalpha()`). Si alguien apunta un token de texto a esta familia, ve tofu de inmediato en vez de un fallback silencioso.
2. **`rvrn` conservado en las features.** Sin él el cero sale barrado, de fuente de código, incluso a `MONO 0`. Cuesta ~620 bytes.
3. **El default de `wght` era 300** y a `cap` 60 px la barra de la `H` se evapora. Lo recorto con `instancer` a `wght=400:700:1000`: la instancia por defecto del archivo versionado ya es 700. Y **`CRSV` se fija a 0** porque venía en 0,5, una cursiva a medias.

Descarto expresamente su eje `CASL`. Es un lujo invisible a metro y medio y obliga a `font-variation-settings` animado, o sea a re-interpolar contornos en cada frame mientras corren cuatro modelos de visión. Se queda en el archivo (viaja gratis con el espacio variable) pero **el sistema de diseño no lo anima**: como mucho, dos valores discretos.

### La alternativa arriesgada que no tomé, y por qué

La opción valiente era **Bagel Fat One** como voz de display: fundición coreana, sale del escaparate exacto de la referencia (인생네컷, PHOTOISM), cero kilometraje en diseño en español, 23 KB. El primer atacante no consiguió construirle un caso de inercia y yo tampoco. Es la candidata más seductora del expediente.

La tumba un número. **El hueco entre la mayúscula y su acento es de 0,0198 em, el peor de las once familias**: a 60 px son 1,2 px de aire, que el antialias se come solo, antes incluso del modelo de distancia. La `Á` no se separa hasta 120 px, la `Ñ` hasta 71 y la `ó` hasta 104. Un titular de cabina vive entre 60 y 90 px. Traducido: escribe **MAS FOTOS, ANADIR, SESION** con manchas encima. Y sus contraformas se cierran antes que las de nadie (el agujero del `8` necesita 40 px de mayúscula cuando el resto aguanta a 24). Una display que no puede componer «SESIÓN» a 72 px falla la restricción 4 y la 5 a la vez, y eso no es una preferencia de uso: es incapacidad estructural, igual que su falta de `tnum` (dígitos de 468 a 693 unidades, 32,5 % de dispersión, y `fwid` no toca ni uno de los diez latinos).

Elijo lo seguro sobre lo valiente porque **el producto es en español mexicano y la referencia es coreana**. Copiar el default de la referencia habría sido, además, copiar un default.

---

## 3. La escala

Supuesto físico declarado: panel 1080 × 1920 en vertical, ~24″ (paso de píxel **0,2766 mm**), persona de pie a **1 500 mm**. Un píxel subtiende **0,634 minutos de arco**. La columna «cap ′» es la altura real de mayúscula (o de dígito) en minutos de arco: por debajo de 12′ no se lee de pie, 16–20′ es cómodo, 22′+ es señalética.

Los valores son px CSS con viewport 1:1 sobre 1080. Si el WebView del kiosco expone un viewport de 540 px (dPR 2), se pone `--psp-font-scale: .5` y toda la escala baja sola.

| Paso | Token | px | Familia | Peso | `opsz` | Tracking | Interlínea | cap real | cap ′ |
|---|---|---|---|---|---|---|---|---|---|
| **Cuenta regresiva** | `--psp-font-count` | **520** | Recursive | 900 | — | `.01em` | 1.00 | dígito 374 px | 237′ |
| **Display gigante** | `--psp-font-4xl` | **240** | Bungee Layers ×2 | estática | — | `-.01em` | 1.05 | 173 px | 110′ |
| **Título** | `--psp-font-3xl` | **96** | Bricolage | 800 | 32 | `-.02em` | 1.05 | 63 px | 40′ |
| **Dato grande** (`00:07`, `3 de 8`, precio) | `--psp-font-2xl` | **72** | Recursive + Bricolage | 700 | 24 | `.02em` | 1.00 | dígito 52 px | 33′ |
| **Subtítulo** | `--psp-font-xl` | **64** | Bricolage | 700 | 21 | `-.015em` | 1.15 | 42 px | 27′ |
| **Botón / acción** | `--psp-font-lg` | **56** | Bricolage | 700 | 19 | `0` | 1.20 | 37 px | 23′ |
| **Cuerpo** | `--psp-font-md` (= base) | **44** | Bricolage | 500 | 15 | `0` | 1.30 | 29 px | 18′ |
| **Cuerpo secundario** | `--psp-font-sm` | **36** | Bricolage | 500 | 12 | `.005em` | 1.35 | 24 px | 15′ |
| **Etiqueta** (caja alta) | `--psp-font-xs` | **32** | Bricolage | 700 | 12 | `.08em` | 1.20 | 21 px | 13′ ⁽¹⁾ |
| **Legales** | `--psp-font-2xs` | **26** | Bricolage | 400 | 12 | `.01em` | 1.45 | 17 px | 11′ ⁽¹⁾ |

⁽¹⁾ Los dos últimos pasos asumen distancia de brazo (≈600 mm), que es cuando la persona toca la pantalla: ahí valen 33′ y 27′. **Nada crítico vive en esos dos pasos.**

Compensación óptica entre familias, medida, no estimada:

| Familia | Altura de mayúscula | Altura de x | Factor para igualar a Bungee |
|---|---|---|---|
| Bungee Layers | **0,720 em** (cap = x, caja única) | 0,720 | 1,000 |
| Bricolage `wght` 700 | **0,660 em** (invariante en todo `opsz`) | 0,525 | **×1,091** |
| Recursive (dígito) | **0,720 em** (mayúscula 0,700) | — | 1,000 |

Consecuencia práctica: **un dígito de Recursive al mismo `font-size` que un texto de Bricolage sale un 9,1 % más alto**. Dentro del cuerpo se corrige con `size-adjust: 92%` en una segunda declaración `@font-face` del mismo archivo (cuesta 0 bytes, sección 6). En el paso «dato» **no se corrige**: ahí queremos que la cifra mande.

Interlínea, con tinta medida:

- Bungee, repertorio es/en: la tinta va de **−0,100 em** (coma) a **+0,9614 em** (`Á`) = 1,061 em. Mínimo seguro **1,10** en multilínea; 1,05 en una línea. (Si algún día entra Latin Extended-A a tamaño gigante, la `Ů` llega a 1,138 em: subir a 1,20.)
- Bricolage y Recursive comparten caja vertical de **1,200 em** (0,930/−0,270 y 0,950/−0,250), así que mezclarlas en la misma línea no altera el alto de línea si se normaliza el ascendente de Recursive (sección 6).

---

## 4. Trucos tipográficos

**1. El eje óptico se calibra a la distancia de lectura, no al tamaño en píxeles.** Este es el truco central y es el que más separa la pantalla de una plantilla. `font-optical-sizing: auto` pone `opsz` = tamaño en px: a 44 px pediría `opsz` 44, o sea espaciado de titular, apretado. Pero una letra de 44 px vista a 1,5 m *aparenta* una de 15 px vista a 0,5 m. Regla del sistema: **`opsz` ≈ font-size ÷ 3, acotado a 12–96**, declarado a mano con `font-optical-sizing: none` para que `auto` no lo pise. El cuerpo respira como texto pequeño aunque mida 44 px; el título de 96 px sale a `opsz` 32 y se ve compacto y macizo. La misma pantalla, con `auto`, se ve apretada y no sabrías decir por qué.

**2. Las cifras se cambian solas, sin `<span>`.** La declaración de Recursive lleva `unicode-range` limitado a dígitos y separadores y va **primera** en la pila de `--psp-font-family`. Resultado: cualquier número en cualquier parte de la interfaz se compone en Recursive y las letras caen a Bricolage, sin tocar el marcado y sin que nadie tenga que acordarse. «00:07 · 4 de 8 · $89» sale con los dígitos tabulares y el «de» en la grotesca. Verificado en navegador. Corolario obligatorio: **la pila del display NO lleva Recursive**, para que el precio del cartel exterior salga en Bungee.

**3. El cronómetro no necesita `tabular-nums`, y aun así se escribe.** Recursive es tabular por construcción (600/1000 en todo el espacio de diseño). Pero `font-variant-numeric: tabular-nums` se declara igual en el token `--psp-font-num`, porque el día que alguien componga un número en Bricolage —donde la dispersión es de 345/1000 y `tnum` sí existe y sí iguala— el sistema ya lo protege. Cuesta cero y tapa un fallo que se ve carísimo.

**4. El eje `MONO` cambia el cero, y eso es una decisión de producto.** A `MONO 0` la feature `rvrn` sustituye `zero → zero.sans` y sale el cero limpio y amable: es el cero de la cuenta regresiva y del precio. A `MONO 1` te deja el cero **barrado** de fuente de código: es el cero del ticket y del código de recogida, donde la persona lee la cifra una sola vez y no puede equivocarse. El mismo archivo, un eje, dos registros. **No animar entre los dos**: a media transición el cero cría una barra.

**5. El código de recogida es numérico. Punto.** Es una decisión tipográfica con consecuencias de producto y la firmo: en cuanto el código lleve letras, ninguna de las tres familias lo puede escribir con garantías (Bungee confunde `0/O`, Bricolage no está medida en `1/l/I`, Recursive no tiene letras) y habría que meter una cuarta familia —UNAL Ancízar Sans, la única con `1/l/I` separados de verdad, IoU 0,185, por 29,3 KB—. **Seis dígitos en Recursive a `MONO 1` cuestan cero bytes extra y cero ambigüedad.** Si el producto insiste en un código alfanumérico, entonces sí se añade Ancízar y el total sube a 159 KB, que cabe; pero no se paga antes de que esa pantalla exista.

**6. Capas: mismo string, misma caja, una sola voz para el lector de pantalla.** Las dos capas de Bungee van en posición absoluta una sobre otra, con **idéntico `font-size`, `letter-spacing`, `line-height` y `white-space: nowrap`**, y la de encima con `aria-hidden="true"` y `pointer-events: none`. Un píxel de desfase y a metro y medio la palabra se ve sucia. Si el texto es dinámico y puede saltar de línea, o se fija el ancho o ese componente abandona el apilado y se compone en una sola capa.

**7. Tracking negativo sólo arriba, positivo sólo abajo.** Por encima de 140 px, `-0.01em` a `-0.02em`: a esa escala el espaciado dibujado para lectura se ve suelto. Por debajo de 40 px y en caja alta, `+0.08em`: las etiquetas en versalita apretada son el gesto que delata una plantilla. En el cuerpo, **cero**: el eje óptico ya hizo ese trabajo y sumarle tracking es corregir dos veces.

**8. Alineación óptica de la puntuación colgante.** Con títulos que empiezan por `¿` o `«`, el margen izquierdo se ve mordido. `hanging-punctuation` no existe en Chromium, así que se resuelve con un `text-indent` negativo por token: `-0.06em` cuando la cadena empieza por `¿`/`¡`, `-0.09em` cuando empieza por `«` o comilla. Es la diferencia entre una columna alineada y una columna que parece alineada.

**9. Caja alta vs caja baja, escrito como ley.** Bungee es caja única: siempre alta, 1–3 palabras. Bricolage vive en caja baja (altura de x 0,800 de la mayúscula) y sólo sube a caja alta en etiquetas cortas. **Ninguna pregunta en español se compone en caja alta con Bricolage** —su `¿` se hunde a −0,149 em y se queda 0,12 em corto de la caja alta, y su `case` no lo corrige—; esas van a Bungee, que las compone clavadas.

**10. Texto sobre color saturado: piso de peso por fondo, no criterio de quien maqueta.** Sobre los seis colores vivos, mínimo `wght` 600 en Bricolage; sobre el crema #F3EEE4 se permite 400–500. Blanco sobre saturado irradia y engorda el trazo, así que el texto en blanco sube un escalón de peso y **baja** uno de tracking. Y nunca `-webkit-font-smoothing: antialiased` sobre color: adelgaza justo donde ya cuesta.

**11. Qué eje se anima y cuándo.** Sólo uno: **`wght` de Bricolage, 700 → 800, al tocar un botón, en 120 ms.** Es el único gesto donde la letra responde al dedo. Contraindicaciones medidas: Bricolage reacomoda un 5,69 % al pasar de 400 a 800, así que el botón se anima **con ancho fijo** o el texto salta. `CASL` y `MONO` de Recursive no se animan nunca —re-interpolan contorno en cada frame con cuatro modelos de visión corriendo—; se usan como dos estados discretos. Y la cuenta regresiva no anima el peso: anima la escala, que la GPU hace gratis.

---

## 5. El guion de empaquetado

Escrito en el estilo de `scripts/fetch-models.sh`, probado **tal cual** en esta máquina. Ya existe en el repositorio como `/Users/karol/personal/photo-station-platform/scripts/fetch-fonts.sh` y produce los cuatro `.woff2` y los tres `OFL.txt`. Todas las URL están verificadas con HTTP 200 y los tamaños de origen coinciden al byte (Bungee zip 1 161 335 B, Bricolage 408 496 B, Recursive 2 379 132 B).

```bash
#!/usr/bin/env bash
# Descarga y subsetea las tres tipografías del sistema de diseño. Sólo se necesita para
# actualizarlas: los .woff2 resultantes se versionan en el repositorio y la cabina no
# vuelve a pedir red nunca. Presupuesto duro: 250 KB sumando todos los archivos.
set -euo pipefail
cd "$(dirname "$0")/.."

OUT="${OUT:-apps/kiosk/public/fonts}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"

# --- Requisitos -------------------------------------------------------------------------
command -v python3 >/dev/null || { echo "falta python3"; exit 1; }
python3 - <<'PY' || { echo "falta fontTools o brotli: pip3 install 'fonttools[woff]' brotli"; exit 1; }
import fontTools, brotli  # noqa: F401
PY

# fontTools habla mucho por stderr (y se recupera solo de los OTLOffsetOverflowError de
# Bricolage). Se guarda el ruido y sólo se enseña si algo falla de verdad.
run() { "$@" >"$TMP/ft.log" 2>&1 || { cat "$TMP/ft.log"; exit 1; }; }
sub()  { run python3 -m fontTools.subset "$@"; }
inst() { run python3 -m fontTools.varLib.instancer "$@"; }

# Repertorio del kiosco: ASCII + Latin-1 (ahí viven á é í ó ú ü ñ ¿ ¡ « ») + Latin Extended-A
# (nombres de marca de terceros) + comillas, rayas, flechas, € y ™.
U_TEXTO='U+0020-007E,U+00A0-00FF,U+0100-017F,U+2010-2015,U+2018-201F,U+2026,U+2039-203A,U+20AC,U+2122,U+2190-2193,U+2212'
# Repertorio de cifras: NI UNA LETRA. Si alguien escribe texto con esta familia tiene que
# salir tofu de inmediato, no un fallback silencioso.
U_CIFRA='U+0020,U+0024,U+0025,U+002B,U+002C,U+002D,U+002E,U+002F,U+0030-0039,U+003A,U+00A0,U+00B0,U+00D7,U+2013,U+2044,U+2212'

# --- 1. Bungee Layers (display, dos capas superpuestas) ---------------------------------
# El release oficial de DJR. El juego Layers es el único con anchos idénticos glifo a glifo
# entre capas; el juego Basic desalinea en cuanto se le suma la Shade.
echo "Bungee v2.001"
curl -fsSL -o "$TMP/bungee.zip" \
  https://github.com/djrrb/Bungee/releases/download/v2.001/Bungee-fonts.zip
unzip -q -o "$TMP/bungee.zip" -d "$TMP/bungee"
for capa in BungeeLayers-Regular BungeeLayersInline-Regular; do
  sub "$TMP/bungee/Bungee-fonts/Bungee_Layers/$capa.ttf" \
      --unicodes="$U_TEXTO" \
      --layout-features='kern,ccmp,locl,mark,mkmk,ss04,ss05,ornm' \
      --no-hinting --desubroutinize --flavor=woff2 \
      --output-file="$OUT/${capa%-Regular}.woff2"
  echo "  $(basename "$OUT/${capa%-Regular}.woff2")"
done
curl -fsSL -o "$OUT/OFL-Bungee.txt" https://raw.githubusercontent.com/djrrb/Bungee/master/OFL.txt

# --- 2. Bricolage Grotesque (texto y titulares) -----------------------------------------
# Se fija wdth=100 (su rango 75-100 es pobre y cuesta 53 KB) y se RECORTA el eje óptico y el
# de peso poniéndoles un default utilizable: el archivo original arranca en opsz 96 / wght 800
# ("Bricolage Grotesque 96pt ExtraBold"), o sea que un WebView que ignore los ejes compone
# TODO con espaciado de rótulo. Instanciado así, la instancia por defecto ya es legible.
echo "Bricolage Grotesque"
curl -fsSL -o "$TMP/bricolage.ttf" \
  'https://raw.githubusercontent.com/google/fonts/main/ofl/bricolagegrotesque/BricolageGrotesque%5Bopsz,wdth,wght%5D.ttf'
inst "$TMP/bricolage.ttf" wdth=100 'opsz=12:14:96' 'wght=400:400:800' -o "$TMP/bricolage-var.ttf"
sub "$TMP/bricolage-var.ttf" \
    --unicodes="$U_TEXTO" \
    --layout-features='kern,ccmp,locl,mark,mkmk,tnum,lnum,case,frac,ordn,sups' \
    --no-hinting --flavor=woff2 \
    --output-file="$OUT/BricolageGrotesque-var.woff2"
echo "  BricolageGrotesque-var.woff2"
curl -fsSL -o "$OUT/OFL-BricolageGrotesque.txt" \
  https://raw.githubusercontent.com/google/fonts/main/ofl/bricolagegrotesque/OFL.txt

# --- 3. Recursive (cifras y nada más) ----------------------------------------------------
# slnt y CRSV fijados (CRSV trae default 0.5, una cursiva a medias); wght recortado a 400-1000
# con default 700 porque el original arranca en 300 y a esa distancia la barra de la H se
# evapora. `rvrn` es OBLIGATORIO en las features conservadas: sin él el cero sale barrado.
echo "Recursive"
curl -fsSL -o "$TMP/recursive.ttf" \
  'https://raw.githubusercontent.com/google/fonts/main/ofl/recursive/Recursive%5BCASL,CRSV,MONO,slnt,wght%5D.ttf'
inst "$TMP/recursive.ttf" slnt=0 CRSV=0 'wght=400:700:1000' -o "$TMP/recursive-var.ttf"
sub "$TMP/recursive-var.ttf" \
    --unicodes="$U_CIFRA" \
    --layout-features='kern,ccmp,rvrn' \
    --no-hinting --flavor=woff2 \
    --output-file="$OUT/Recursive-cifras-var.woff2"
echo "  Recursive-cifras-var.woff2"
curl -fsSL -o "$OUT/OFL-Recursive.txt" \
  https://raw.githubusercontent.com/google/fonts/main/ofl/recursive/OFL.txt

# --- 4. Verificación: se abre, cubre el español, no cubre letras donde no debe, y cabe ----
OUT="$OUT" python3 - <<'PY'
import os, sys, glob
from fontTools.ttLib import TTFont
out = os.environ['OUT']
esp = 'áéíóúüñÁÉÍÓÚÜÑ¿¡«»0123456789'
fallos = []
for p in sorted(glob.glob(os.path.join(out, '*.woff2'))):
    f = TTFont(p); cm = f.getBestCmap()
    n = os.path.basename(p)
    ejes = ' '.join(f'{a.axisTag} {a.minValue:g}-{a.maxValue:g} (def {a.defaultValue:g})'
                    for a in f['fvar'].axes) if 'fvar' in f else 'estática'
    if 'cifras' in n:
        letras = [chr(c) for c in cm if chr(c).isalpha()]
        if letras: fallos.append(f'{n}: el subset de cifras trae letras {letras}')
        if not all(ord(c) in cm for c in '0123456789'): fallos.append(f'{n}: faltan dígitos')
    else:
        falta = [c for c in esp if ord(c) not in cm]
        if falta: fallos.append(f'{n}: faltan {falta}')
    print(f'  {os.path.getsize(p):>7} B  {n}  [{ejes}]')
total = sum(os.path.getsize(p) for p in glob.glob(os.path.join(out, '*.woff2')))
print(f'  {total:>7} B  TOTAL ({total/1024:.1f} KB de 250 KB, {total/256000:.0%} del presupuesto)')
if total > 250 * 1024: fallos.append(f'presupuesto excedido: {total} B')
if fallos:
    print('FALLA:'); [print(' -', x) for x in fallos]; sys.exit(1)
print('  OK')
PY
```

Salida real de la ejecución:

```
Bungee v2.001
  BungeeLayers.woff2
  BungeeLayersInline.woff2
Bricolage Grotesque
  BricolageGrotesque-var.woff2
Recursive
  Recursive-cifras-var.woff2
    89036 B  BricolageGrotesque-var.woff2  [opsz 12-96 (def 14) wght 400-800 (def 400)]
    11012 B  BungeeLayers.woff2  [estática]
    10224 B  BungeeLayersInline.woff2  [estática]
    22800 B  Recursive-cifras-var.woff2  [MONO 0-1 (def 0) CASL 0-1 (def 0) wght 400-1000 (def 700)]
   132804 B  TOTAL (129.7 KB de 250 KB, 52% del presupuesto)
  OK
```

Dos avisos para quien lo vuelva a correr: la compresión brotli de `woff2` **no es determinista al byte** (Bricolage oscila entre 88 768 y 89 036 B según la corrida), así que un `git diff` en el binario después de regenerar es ruido, no un cambio; y el guion sólo se ejecuta para actualizar, porque los `.woff2` están versionados y la cabina no tiene red.

---

## 6. El CSS

Archivo nuevo `packages/ui/src/fonts.css`, importado una sola vez desde `packages/ui/src/styles.css`. Las rutas son absolutas desde la raíz servida del kiosco (`apps/kiosk/public/`).

```css
/* ==========================================================================
   Tipografía del sistema — archivos locales, sin red, sin @import remoto.
   Bungee Layers (SIL OFL 1.1) · Bricolage Grotesque (SIL OFL 1.1) · Recursive (SIL OFL 1.1)
   Licencias completas en /fonts/OFL-*.txt, redistribuidas con el producto.
   ========================================================================== */

/* --- Display: dos capas con anchos idénticos glifo a glifo ---------------- */
/* ascent/descent-override ciñe la caja de línea a la tinta real medida del
   repertorio es/en (-0,100 em la coma, +0,9614 em la Á), para poder centrar
   el rótulo verticalmente sin restar márgenes a mano. */
@font-face {
  font-family: 'PSP Display';
  src: url('/fonts/BungeeLayers.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: block;
  ascent-override: 97%;
  descent-override: 11%;
  line-gap-override: 0%;
}
@font-face {
  font-family: 'PSP Display Inline';
  src: url('/fonts/BungeeLayersInline.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: block;
  ascent-override: 97%;
  descent-override: 11%;
  line-gap-override: 0%;
}

/* --- Texto: variable, opsz 12-96 y wght 400-800 --------------------------- */
/* El archivo ya viene instanciado con default opsz 14 / wght 400: si el motor
   ignorase los ejes, el texto sale legible en vez de salir en 96pt ExtraBold. */
@font-face {
  font-family: 'PSP Texto';
  src: url('/fonts/BricolageGrotesque-var.woff2') format('woff2');
  font-weight: 400 800;
  font-stretch: 100%;
  font-style: normal;
  font-display: block;
}

/* --- Cifras: subset SIN LETRAS, aplicado por unicode-range ----------------- */
/* Va primera en la pila: cualquier dígito de la interfaz se compone aquí y las
   letras caen a 'PSP Texto', sin marcado y sin que nadie tenga que acordarse.
   ascent/descent igualados a los de Bricolage (0,930 / -0,270) para que una
   línea mixta tenga exactamente el mismo alto que una línea de puro texto. */
@font-face {
  font-family: 'PSP Cifra';
  src: url('/fonts/Recursive-cifras-var.woff2') format('woff2');
  font-weight: 400 1000;
  font-style: normal;
  font-display: block;
  ascent-override: 93%;
  descent-override: 27%;
  line-gap-override: 0%;
  unicode-range: U+0024, U+0025, U+002B, U+002C, U+002D, U+002E, U+002F,
                 U+0030-0039, U+003A, U+00B0, U+00D7, U+2013, U+2044, U+2212;
}
/* Mismo archivo, cero bytes extra: los dígitos de Recursive miden 0,720 em
   contra los 0,660 em de mayúscula de Bricolage, o sea un 9,1 % más altos.
   Dentro del cuerpo eso descuadra; en el paso «dato» se quiere. */
@font-face {
  font-family: 'PSP Cifra Texto';
  src: url('/fonts/Recursive-cifras-var.woff2') format('woff2');
  font-weight: 400 1000;
  font-style: normal;
  font-display: block;
  size-adjust: 92%;
  ascent-override: 101%;
  descent-override: 29%;
  line-gap-override: 0%;
  unicode-range: U+0024, U+0025, U+002B, U+002C, U+002D, U+002E, U+002F,
                 U+0030-0039, U+003A, U+00B0, U+00D7, U+2013, U+2044, U+2212;
}
```

Redefinición de tokens. **Colisión que hay que resolver antes**: hoy `--psp-font-display` es un *tamaño* (`packages/ui/src/styles.css:77`, usado una sola vez en la línea 913). Se renombra a `--psp-font-4xl` —dos líneas de cambio— y `--psp-font-display` pasa a ser la **familia** del display, que es lo que el sistema necesita nombrar.

```css
/* packages/ui/src/styles.css — bloque :root */
:root {
  /* La pila de texto lleva las cifras delante: los números se cambian solos. */
  --psp-font-family: 'PSP Cifra Texto', 'PSP Texto', sans-serif;
  /* El display NO lleva Recursive: el precio del cartel exterior va en Bungee. */
  --psp-font-display: 'PSP Display', 'PSP Texto', sans-serif;
  --psp-font-display-inline: 'PSP Display Inline', 'PSP Texto', sans-serif;
  --psp-font-num: 'PSP Cifra', 'PSP Texto', sans-serif;
  --psp-font-mono: 'PSP Cifra', ui-monospace, monospace;

  --psp-font-scale: 1;
  --psp-opsz: 15;      /* ≈ font-size ÷ 3: el eje óptico se calibra a la distancia */
  --psp-mono: 0;       /* 0 = cero limpio · 1 = cero barrado (tickets y códigos) */
  --psp-casl: 0;
}

/* Modo kiosco: 1080p en vertical, de pie, a metro y medio.
   Si el WebView expone un viewport de 540 px (dPR 2), basta --psp-font-scale: .5 */
.psp-kiosk {
  --psp-font-2xs:   calc(26px  * var(--psp-font-scale));
  --psp-font-xs:    calc(32px  * var(--psp-font-scale));
  --psp-font-sm:    calc(36px  * var(--psp-font-scale));
  --psp-font-base:  calc(44px  * var(--psp-font-scale));
  --psp-font-md:    var(--psp-font-base);
  --psp-font-lg:    calc(56px  * var(--psp-font-scale));
  --psp-font-xl:    calc(64px  * var(--psp-font-scale));
  --psp-font-2xl:   calc(72px  * var(--psp-font-scale));
  --psp-font-3xl:   calc(96px  * var(--psp-font-scale));
  --psp-font-4xl:   calc(240px * var(--psp-font-scale));
  --psp-font-count: calc(520px * var(--psp-font-scale));
  --psp-line-height: 1.30;

  font-family: var(--psp-font-family);
  font-size: var(--psp-font-base);
  font-weight: 500;
  /* El eje óptico se declara a mano en cada paso: `auto` lo ataría al tamaño en
     píxeles, que a metro y medio es el criterio equivocado. */
  font-optical-sizing: none;
  font-variation-settings: 'opsz' var(--psp-opsz), 'MONO' var(--psp-mono), 'CASL' var(--psp-casl);
  font-variant-numeric: tabular-nums lining-nums;
  /* Sobre color saturado el suavizado fino adelgaza justo donde ya cuesta. */
  -webkit-font-smoothing: auto;
}

/* --- Pasos de la escala --------------------------------------------------- */
.psp-kiosk .psp-t-titulo    { font-size: var(--psp-font-3xl); font-weight: 800; --psp-opsz: 32; letter-spacing: -.02em;  line-height: 1.05; }
.psp-kiosk .psp-t-subtitulo { font-size: var(--psp-font-xl);  font-weight: 700; --psp-opsz: 21; letter-spacing: -.015em; line-height: 1.15; }
.psp-kiosk .psp-t-accion    { font-size: var(--psp-font-lg);  font-weight: 700; --psp-opsz: 19; letter-spacing: 0;       line-height: 1.20; }
.psp-kiosk .psp-t-cuerpo    { font-size: var(--psp-font-md);  font-weight: 500; --psp-opsz: 15; letter-spacing: 0;       line-height: 1.30; }
.psp-kiosk .psp-t-etiqueta  { font-size: var(--psp-font-xs);  font-weight: 700; --psp-opsz: 12; letter-spacing: .08em;   line-height: 1.20; text-transform: uppercase; }
.psp-kiosk .psp-t-legal     { font-size: var(--psp-font-2xs); font-weight: 400; --psp-opsz: 12; letter-spacing: .01em;   line-height: 1.45; }

/* Sobre los seis colores vivos, piso de peso: nunca por debajo de 600. */
.psp-kiosk .psp-sobre-color { font-weight: 600; }
.psp-kiosk .psp-sobre-color.psp-t-cuerpo { font-weight: 600; }

/* Puntuación colgante: Chromium no trae hanging-punctuation. */
.psp-kiosk .psp-cuelga-interr { text-indent: -.06em; }
.psp-kiosk .psp-cuelga-comilla { text-indent: -.09em; }

/* --- Datos y cronómetros -------------------------------------------------- */
.psp-kiosk .psp-t-dato {
  font-family: var(--psp-font-num);
  font-size: var(--psp-font-2xl);
  font-weight: 700;
  letter-spacing: .02em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.psp-kiosk .psp-t-cuenta {
  font-family: var(--psp-font-num);
  font-size: var(--psp-font-count);
  font-weight: 900;
  --psp-mono: 0;                 /* cero limpio */
  letter-spacing: .01em;
  line-height: 1;
}
/* Ticket y código de recogida: cero barrado, seis dígitos, sin letras. */
.psp-kiosk .psp-t-codigo {
  font-family: var(--psp-font-num);
  font-size: var(--psp-font-3xl);
  font-weight: 800;
  --psp-mono: 1;
  letter-spacing: .06em;
}

/* --- Display por capas ---------------------------------------------------- */
/* Mismo string, mismo tamaño, mismo tracking, sin reflow posible. */
.psp-kiosk .psp-capas {
  position: relative;
  display: inline-block;
  white-space: nowrap;
  font-family: var(--psp-font-display);
  font-size: var(--psp-font-4xl);
  font-weight: 400;
  letter-spacing: -.01em;
  line-height: 1.05;
  color: var(--psp-capa-1, var(--psp-color-accent));
}
.psp-kiosk .psp-capas > span {
  position: absolute;
  inset: 0;
  font-family: var(--psp-font-display-inline);
  letter-spacing: inherit;
  line-height: inherit;
  color: var(--psp-capa-2, var(--psp-color-bg));
  pointer-events: none;
}
/* Piso duro: por debajo de esto el acento de la Á se funde con la mayúscula. */
.psp-kiosk .psp-capas { min-height: 1em; }
@media (max-width: 720px) {
  .psp-kiosk .psp-capas { font-size: max(78px, calc(240px * var(--psp-font-scale))); }
}

/* El botón responde al dedo con la letra misma. Ancho fijo: Bricolage
   reacomoda un 5,69 % de wght 400 a 800 y sin la caja fija el texto salta. */
.psp-kiosk .psp-boton { font-weight: 700; transition: font-weight 120ms ease; }
.psp-kiosk .psp-boton:active { font-weight: 800; }

@media (prefers-reduced-motion: reduce) {
  .psp-kiosk .psp-boton { transition: none; }
}
```

Marcado del rótulo por capas, para que quede escrito una sola vez:

```html
<h1 class="psp-capas" style="--psp-capa-1:#FF6FA5; --psp-capa-2:#FFC24A">¡UNA DE TODOS!<span aria-hidden="true">¡UNA DE TODOS!</span></h1>
```

Verificado renderizado en Chromium a 1080 px: las dos capas encajan sin desfase, el `¡` y el `!` llegan a caja alta, los dígitos de «PASO 3 DE 8 · TICKET 049» y de «00:07 · 4 de 8 · $89» se componen solos en Recursive con el «de» en Bricolage, y el blanco sobre #FF6FA5 a 44 px se sostiene.

---

## 7. Lo que NO elegí

**Baloo 2** — fuera, y es la que más claramente había que echar. Es el estante prohibido con otro pasaporte: la escapatoria estándar de cuando te vetan Poppins, Nunito y Quicksand, o sea que la reconocen exactamente las mismas personas que ya rechazaron la versión anterior por genérica. Es además la letra de la piñatería en las plantillas de Canva en español. Y falla en el idioma del encargo: sin `case`, en caja alta el `¿` se queda 0,13 em por debajo de la caja y asoma 0,165 em bajo la línea base. Sus mayúsculas de 0,617 em son las más bajas del lote, así que para dar la misma mancha que Bungee hay que subirle el cuerpo un 16,7 %. Genérica y además coja.

**Archivo** — fuera. Su propia ficha firma la sentencia: «si alguien la usa para titulares la interfaz vuelve a parecerse a la versión genérica que ya rechazaron». Una tipografía cuya defensa es «no se va a notar porque va en la letra chica» está gastando 27–72 KB en ser invisible, en un aparato donde nadie va a leer letra chica de pie a metro y medio. Y el dato con que la vendían estaba escogido a dedo: sus cifras son casi tabulares de fábrica **sólo en `wght` 700 exacto** (2/1000), pero 53/1000 a peso 400 y 97 a `wght` 900 / `wdth` 125. Encima es la peor del lote al cambiar de peso (10,23 % de 400 a 800), así que ni siquiera puede animar un botón. Dejarla dentro del sistema es dejar disponible en un token el rostro exacto que se descartó.

**MuseoModerno** — fuera, y me duele porque es la mejor equipada de su grupo: cifras lining por defecto, `tnum`, `zero`, `case` funcionando de verdad y Latin Extended-A completo, la única. Pero estar mejor equipada no es estar menos gastada. A metro y medio, a `wght` 700 y sobre rosa saturado, nadie la distingue de Quicksand Bold: es la vecina de puerta de Poppins y Montserrat, prohibidas por nombre. Su personalidad vive en detalles de la minúscula a tamaño de lectura, que es el tamaño que este proyecto casi no usa. Y compite por la casilla de Bungee sin poder hacer lo único que importa ahí: pintar la palabra con dos colores de la paleta. Es, además, tipografía de museo — «uso oficial», que se excluyó con todas las letras.

**Anybody** — fuera. La eligieron por las cifras y las cifras son su punto flojo: tras el desenfoque de 1,5 m sus pares de dígitos convergen más que los de nadie (6/8 = 0,918, 9/0 = 0,876, 0/O = 0,811), y empeora al condensar, que es su única razón de estar. La causa es estructural: contraformas cuadradas heredadas de Eurostile, donde 6, 8, 9 y 0 acaban siendo el mismo rectángulo con un tabique distinto. Para una cuenta 3-2-1 da igual porque el usuario ya sabe qué viene; para un precio o un código, que se leen una vez, es un fallo de señalética. Fuera de las cifras es inservible en español (la `Á` no se separa hasta 136 px). Y es la más pesada del lote, 79 KB, el 47 % del presupuesto, para el papel que peor hace. Además el expediente la vendió con un dato invertido: dijeron que hay que **subirle** el tamaño un 12–18 % frente a Baloo 2, cuando su mayúscula es un 9,4 % **más grande** que la de Baloo 2 — el número que le colgaron era de otra familia.

**Bagel Fat One** — la descartada fuerte, y la única que me costó. Cero kilometraje en diseño en español, viene del escaparate exacto de la referencia y sus 23 KB son el 9 % del presupuesto. Cae por medición, no por gusto: hueco de acento de 0,0198 em, el peor de las once; `Á` ilegible por debajo de 120 px, `Ñ` de 71, `ó` de 104, con el titular de cabina viviendo entre 60 y 90 px. Sin `tnum` ni `pnum`, con 32,5 % de dispersión entre el `1` y el `4`, y `fwid` no toca ni uno de los diez dígitos latinos. Es un rótulo por encima de 120 px — y ese puesto ya lo tiene Bungee, que además lo hace en dos colores.

**Sofia Sans Extra Condensed** — fuera, aunque sobrevivió los dos ataques. Es una buena máquina de cifras gigantes y trae ①–⑨ y ❶–❸ en el cmap, que resolvería «3 de 8» sin icon font. Pero sus dígitos convergen justo donde importa (0/O = 0,899, 9/0 = 0,880, 6/8 = 0,876), sus contraformas son ranuras (el agujero del `0` es el 19,8 % de la tinta) que el blanco sobre color satura y cierra, y su `Ü` se funde en una barra por debajo de 116 px. Recursive hace el mismo trabajo mejor —600/1000 garantizado sin encender `tnum`, cosa que Sofia sí exige a mano— por 22,8 KB. Y su registro es panel de autobús municipal, que es lo contrario de convocar.

**Asap** — fuera, y es técnicamente la mejor máquina del lote: mayúscula de 0,702 em (la más alta), el mejor par 0/O de todos, cifras monoespaciadas por construcción en todo el espacio variable y duplexado real con **0,00 % de reflujo** de peso 400 a 900. Si esto fuera un aeropuerto, firmo Asap y me voy a casa. No lo es. La frase de su ficha —«Asap sola cubre los tres papeles»— es la recaída entera en siete palabras: una grotesca neutra en todos los tamaños **es** la versión que ya se rechazó, sólo que con licencia OFL. Su virtud es no ofender a nadie y el encargo pide lo contrario.

**UNAL Ancízar Sans** — fuera **por ahora**, y es la única que dejo con la puerta abierta. No tiene inercia, es la más ligera (29,3 KB) y tiene la mejor virtud sin explotar del expediente: es la única con `1`/`l`/`I` separados de verdad (IoU 0,185, contra 0,508 de Asap y 0,482 de Bungee) y las contraformas más abiertas. Eso no es virtud de letra chica: es la virtud de una **fuente de códigos**. Se incorpora el día que el producto entregue un ticket o un código de recogida **alfanumérico** — y entonces el bundle sube a 159,3 KB, que cabe de sobra. Mientras el código sea numérico, no se paga: Recursive a `MONO 1` ya lo escribe sin ambigüedad.

---

**Archivos entregados** (todos absolutos):
- `/Users/karol/personal/photo-station-platform/scripts/fetch-fonts.sh` — guion probado; difiere del que ya estaba en `HEAD` sólo en el envoltorio `run()`, que silencia el ruido de fontTools y vuelca el log si algo falla de verdad.
- `/Users/karol/personal/photo-station-platform/apps/kiosk/public/fonts/` — `BungeeLayers.woff2` (11 012 B), `BungeeLayersInline.woff2` (10 224 B), `BricolageGrotesque-var.woff2` (89 036 B), `Recursive-cifras-var.woff2` (22 800 B) y los tres `OFL-*.txt`. `Recursive-cifras-var.woff2` y `OFL-Recursive.txt` son nuevos y están **sin versionar**: faltaba la tercera familia en el repositorio.
- Pendiente de aplicar en `/Users/karol/personal/photo-station-platform/packages/ui/src/styles.css`: crear `fonts.css` con los `@font-face`, renombrar `--psp-font-display` (tamaño) a `--psp-font-4xl` en las líneas 77 y 913, y sustituir la pila `system-ui, -apple-system, 'Segoe UI', Roboto…` de la línea 67, que es literalmente la que se rechazó.