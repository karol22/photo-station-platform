# Evidencia: anclas de accesorios sobre rostros reales

`anchorFor` de `@psp/vision` calcula dónde va cada accesorio a partir de la malla facial. Las pruebas
del paquete lo comprueban con rostros sintéticos, que son geometría perfecta. Esta carpeta comprueba
lo otro: qué hace la misma función con caras de verdad, con pelo, gorra, barba, cabeza ladeada,
girada y con dos personas en el cuadro.

## Cómo se hace

1. **34 fotografías** de Wikimedia Commons con licencia que permite redistribuir (CC BY, CC BY-SA y
   dominio público), variando tono de piel, edad, barba, gorra, giro y número de personas. Se
   descargan a una carpeta temporal fuera del repositorio; aquí sólo viven las composiciones.
2. Cada foto pasa por el **mismo camino que el aparato**: MediaPipe Face Landmarker (`numFaces: 4`,
   el modelo vendido en `apps/kiosk/public/models`) y la conversión `convertResult` del adaptador
   real, sin red y sin nube.
3. Sobre esa malla se llama a `anchorFor(kind, face, opciones)` con `frameAspect` para las cinco
   piezas, y se dibuja cada una dentro de su caja, girada con `angleDeg`.
4. Para no medirse contra sí misma, la comprobación usa una **segunda fuente**: la silueta de persona
   del segmentador (`selfie_segmenter.tflite`). De ahí salen la coronilla real (con pelo y gorra) y
   el ancho de la cabeza, que la malla no da.

Las composiciones están en `composiciones/`, la tabla completa en `tabla.json` y el resumen abajo.
El banco de pruebas es un guion desechable, no código de producto: vive en la carpeta temporal de la
sesión y no se versiona.

## Qué sale

**Cobertura.** 17 rostros con malla en 14 de las 34 fotos. Las 20 fotos sin detección son de cuerpo
entero o de multitud: el detector de corto alcance no ve un rostro de 40 px en un cuadro de 1000.
En una cabina el rostro ocupa media pantalla, así que esto es un límite del banco de imágenes, no de
las anclas, pero conviene tenerlo escrito.

**Sombrero, lentes y bigote caen donde deben.** Se colocan en 17, 17 y 16 rostros. El bigote es la
más consistente de todas: su borde inferior queda a **-0.010 altos de rostro** del labio superior
(rango -0.024 a 0.019), es decir, rozándolo por encima, que es exactamente donde va un bigote, en los
16 rostros medidos.

**Lentes: 0.754 del ancho de cabeza segmentado** en la línea de ojos (rango 0.506 a 0.847, n=9). Los
dos valores bajos son las dos personas con más pelo: la silueta a la altura de los ojos incluye la
melena, y unos lentes no la cubren. Visto en las composiciones, los lentes caen centrados en los ojos
y nivelados con la línea de ojos en todos los casos, incluido un rostro con **41 grados de
inclinación**.

**El sombrero se apoya, no flota, pero se apoya bajo.** El ala queda **0.358 altos de rostro por
debajo de la coronilla real** de la silueta (rango 0.295 a 0.586, n=5). El ancla se calcula sobre la
coronilla extrapolada del cráneo, que es lo único que la malla conoce; el pelo, un gorro o un peinado
de época viven por encima de eso. Consecuencia práctica: con pelo abundante el sombrero **se encima
al pelo** en vez de posarse sobre él. Se ve bien en las composiciones y es lo que hace un sombrero de
verdad, pero si algún día se quiere el ala sobre el pelo, el dato para hacerlo ya existe: la máscara
de persona, cuando está, da la coronilla real.

**Los aretes son la pieza débil, y por una razón estructural: la malla no tiene puntos de oreja.**
Los 478 puntos se acaban en el contorno del rostro, así que el lóbulo se infiere del contorno lateral
(234/454) bajado 0.14 altos de rostro. En rostros de frente el punto de sujeción cae a **0.08 anchos
de rostro o menos del borde de la silueta** (mediana -0.017 izquierda, -0.002 derecha), que es
correcto. En cuanto hay melena que tapa la oreja o la cara gira, se va al pómulo o a la mandíbula:
los peores valores son -0.61 y -0.32 (retrato con capota) y -0.24 (giro de 27 grados).

Por eso la ventana de giro de los aretes **se cierra con esta evidencia**: `yawFullDeg` baja de 12 a 8
y `yawLimitDeg` de 32 a 20, así que a partir de 20 grados de giro la pieza del lado que se esconde no
se coloca. De 17 rostros, el arete izquierdo se coloca en 15 y el derecho en 12: los cinco que faltan
son los giros grandes. Un arete en el pómulo es peor que ningún arete.

**Hallazgo colateral.** En 16 de 17 rostros hay que **invertir la máscara** del segmentador para que
el píxel del entrecejo cuente como persona. `categoryMaskToPersonMask(..., personCategoryIndex = 1)`
de `packages/vision/src/adapters/segmenter.ts` parece tener la polaridad al revés para el
`selfie_segmenter.tflite` que se vende con el kiosco. No se toca aquí porque es de otra capacidad,
pero queda anotado: si es cierto, el reemplazo de fondo recorta el fondo en vez de la persona.

## De extremo a extremo: `resultado/`

Las composiciones de `composiciones/` dibujan la caja del ancla para poder medirla. Las de
`resultado/` son el producto: la misma ancla convertida en ops con `anchorToStickerOp`, activos con
alfa real, un nombre puesto con `captionOp` y todo compuesto por **`applyEditOps`**, el mismo
pipeline que corre en el aparato, con el rasterizador de texto de canvas inyectado.

Lo que se ve ahí:

- Un toque pone la pieza en **cada rostro**: la foto de dos niños sale con dos sombreros, dos pares
  de lentes y dos bigotes, cada uno con el tamaño y la inclinación de su cara (11 ops).
- El nombre se lee: **`SOFÍA` y `JOSÉ` con tilde**, contorno oscuro sobre una foto revuelta, al 8.5 %
  del alto. Con la fuente bitmap interna eso sería un mosaico de cinco columnas por letra; con el
  rasterizador inyectado es una tipografía de verdad.
- Y se ve el defecto: **los aretes cuelgan a la altura de la mandíbula, no de la oreja.** El punto de
  sujeción sale del contorno lateral porque la malla no tiene oreja, y para un pendiente largo el
  dibujo cae todavía más abajo. Un arete de botón se vería bien; uno colgante se ve bajo.

## Tabla

Unidades: `sombrero` y `bigote` en altos de rostro (coronilla-barbilla proyectada); `lentes` es una
proporción; `aretes` en anchos de rostro, positivo = el punto de sujeción cae fuera de la silueta.
Un guion largo es que la silueta no da una medida fiable ahí (dos personas pegadas, pelo fundido con
el fondo) o que el ancla no se coloca por confianza.

| Foto | Rostro | roll° | yaw° | pitch° | sombrero: ala bajo la coronilla real | lentes: ancho / ancho de cabeza | bigote: hueco al labio | arete izq. fuera de la silueta | arete der. |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Louisa_McLaughlin.jpg | 1 | -1.5 | 2.2 | -1.4 | 0.586 | 0.506 | 0.001 | -0.613 | -0.320 |
| _ghab_hay_khali__m._harandi001028.jpg | 1 | 14.4 | 28.1 | 0.7 | — | — | 0.019 | — | — |
| 10.18.09MikeMcKoneByLuigiNovi.jpg | 1 | -4.7 | -5.6 | -10.0 | — | 0.845 | -0.014 | 0.010 | 0.010 |
| 2012-04_Pilszcz_29.jpg | 1 | 1.3 | -7.2 | -8.5 | — | — | -0.013 | — | — |
| 2012-04_Pilszcz_29.jpg | 2 | 0.3 | 4.7 | 5.7 | — | — | -0.011 | — | — |
| Congressman_William_Thomas_clay_portrait_in- | 1 | 20.4 | -38.1 | -16.1 | 0.386 | — | -0.008 | — | — |
| Congressman_William_Thomas_clay_portrait_in- | 2 | -2.6 | 32.8 | -1.6 | 0.295 | 0.754 | -0.006 | — | — |
| Bangarang_faces.jpg | 1 | 4.9 | -21.0 | -6.2 | — | — | 0.003 | — | — |
| A_Child_s_Cry_for_Peace.jpg | 1 | -25.5 | 27.0 | -13.1 | — | — | -0.011 | — | — |
| A_Child_s_Cry_for_Peace.jpg | 2 | -9.4 | 42.5 | 4.7 | — | — | — | — | — |
| 2011___.jpg | 1 | 41.1 | -5.5 | 2.2 | 0.340 | 0.671 | -0.013 | 0.137 | — |
| Blasts_from_the_past__Imagicity_524_.jpg | 1 | -19.4 | -13.0 | -8.8 | — | 0.789 | -0.008 | -0.026 | 0.044 |
| Blasts_from_the_past__1___Imagicity_524_.jpg | 1 | -1.0 | -3.3 | -2.7 | — | 0.704 | -0.015 | -0.232 | -0.232 |
| Blasts_from_the_past__2___Imagicity_524_.jpg | 1 | -7.8 | -1.3 | -3.8 | — | 0.785 | -0.021 | -0.007 | -0.014 |
| Boy__Imagicity_462_.jpg | 1 | 0.6 | 3.5 | -11.8 | — | 0.847 | -0.004 | 0.078 | 0.064 |
| retrato-giro-lateral.jpg | 1 | 3.3 | 27.1 | -21.5 | 0.358 | 0.543 | -0.009 | -0.239 | — |
| 2019_12_15_Annibale_Covini_Gerolamo_dida_001 | 1 | -36.9 | -7.9 | 15.8 | — | — | -0.024 | — | — |

## Fotografías y licencias

Todas permiten redistribuir con atribución. Las composiciones son obras derivadas: las que parten de
una fuente **CC BY-SA se distribuyen bajo la misma licencia**. Una foto se versiona con nombre neutro
(`retrato-giro-lateral.jpg`) porque el nombre original de Commons no es apto para el repositorio; su
origen es el de la fila correspondiente.

| Archivo | Licencia | Autoría | Origen |
|---|---|---|---|
| `10.18.09MikeMcKoneByLuigiNovi.jpg` | CC BY 4.0 | Luigi Novi | https://commons.wikimedia.org/wiki/File:10.18.09MikeMcKoneByLuigiNovi.jpg |
| `2011___.jpg` | CC BY-SA 4.0 | Han-Jun Cho | https://commons.wikimedia.org/wiki/File:2011%EC%A1%B0%ED%95%9C%EC%A4%80.jpg |
| `2012-04_Pilszcz_29.jpg` | CC BY 3.0 | Ralf Lotys (Sicherlich) | https://commons.wikimedia.org/wiki/File:2012-04_Pilszcz_29.jpg |
| `2019_12_15_Annibale_Covini_Gerolamo_dida_001_re_950.` | CC BY-SA 4.0 | Annibale covini gerolamo | https://commons.wikimedia.org/wiki/File:2019_12_15_Annibale_Covini_Gerolamo_dida_001_re_950.jpg |
| `A_Child_s_Cry_for_Peace.jpg` | CC BY 2.0 | D. Sharon Pruitt from Hill Air Force Base, Utah, USA | https://commons.wikimedia.org/wiki/File:A_Child%27s_Cry_for_Peace.jpg |
| `Bangarang_faces.jpg` | Public domain | No machine-readable author provided. Bangarangpeter assumed  | https://commons.wikimedia.org/wiki/File:Bangarang_faces.jpg |
| `Blasts_from_the_past__1___Imagicity_524_.jpg` | CC BY-SA 3.0 | Graham Crumb | https://commons.wikimedia.org/wiki/File:Blasts_from_the_past_(1)_(Imagicity_524).jpg |
| `Blasts_from_the_past__2___Imagicity_524_.jpg` | CC BY-SA 3.0 | Graham Crumb | https://commons.wikimedia.org/wiki/File:Blasts_from_the_past_(2)_(Imagicity_524).jpg |
| `Blasts_from_the_past__Imagicity_524_.jpg` | CC BY-SA 3.0 | Graham Crumb | https://commons.wikimedia.org/wiki/File:Blasts_from_the_past_(Imagicity_524).jpg |
| `Boy__Imagicity_462_.jpg` | CC BY-SA 3.0 | Graham Crumb | https://commons.wikimedia.org/wiki/File:Boy_(Imagicity_462).jpg |
| `Congressman_William_Thomas_clay_portrait_in-progress` | CC BY-SA 4.0 | PBSlater28 | https://commons.wikimedia.org/wiki/File:Congressman_William_Thomas_clay_portrait_in-progress.jpg |
| `Louisa_McLaughlin.jpg` | CC BY-SA 3.0 | Neurolinguist | https://commons.wikimedia.org/wiki/File:Louisa_McLaughlin.jpg |
| `_ghab_hay_khali__m._harandi001028.jpg` | CC BY-SA 3.0 | مرتضی احمدی هرندی | https://commons.wikimedia.org/wiki/File:(ghab%27hay_khali)_m._harandi001028.JPG |
| `retrato-giro-lateral.jpg` | CC BY-SA 3.0 | Chinaukgirl | https://commons.wikimedia.org/wiki/File:A_sissy_cross_dresser_in_feminine_office_wear.png |
