# @psp/i18n

## Propósito
Localización de la plataforma: catálogos de mensajes `es`/`en` con paridad de claves verificada, traducción con parámetros y fallback, resolución de contenido localizable (`LocalizedText`) y formateo de dinero en unidades menores, fechas y horas por zona, números y duraciones. Español es el idioma principal y la fuente del catálogo; inglés es una traducción completa (requisito 28). Toda cadena visible al cliente pasa por aquí (AGENTS.md §4).

Cobertura del catálogo (≈540 claves): `common.*`, `units.*`, `locales.*`, `kiosk.attract|home|product|consent|payment|capture|review|edit|select|compose|print|finish|errors|timeout|ai|tech.*`, `instructions.*` (frases de corrección del requisito 5.4), `criteria.*` (nombres cortos de criterios de visión), `stages.*` (`SessionStage`), `features.*` (`FeatureKey`), `admin.nav|common|status|release|incident|dashboard|auth.*`. Las claves derivadas de listas cerradas de `@psp/contracts` (categorías, motivos de no disponibilidad, estados de pago, herramientas de edición, estados de IA, etapas, features, estados de máquina, release e incidencia, niveles de alcance, pruebas y fallas del panel técnico) usan el valor del enum tal cual y una prueba comprueba que cada valor tiene texto.

## Cómo se usa

```ts
import { createTranslator, formatMoney, t, tl } from '@psp/i18n';

t('es', 'kiosk.capture.poseNde', { n: 2, total: 3 }); // "Pose 2 de 3"
t('en', 'clave.inexistente');                          // "clave.inexistente" (cae a es y luego a la clave)
tl('en', product.displayName);                          // usa `en` si existe; si no, `es`
formatMoney({ amount: 8000, currency: 'MXN' }, 'es');   // "$80.00" (es-MX); en inglés "MX$80.00" (en-US)

const tr = createTranslator(locale); // { locale, t, tl, formatMoney, formatNumber, formatDuration, formatDate, formatTime }
tr.formatDuration(150);                                 // "2 min 30 s"
tr.formatDate('2026-09-09T20:05:00Z', 'America/Mexico_City'); // "09/09/2026"; con 'long': "9 de septiembre de 2026"
tr.formatTime('2026-09-09T20:05:00Z', 'America/Mexico_City'); // "2:05 p.m." / "2:05 PM"
```

Reglas:
- Los parámetros se escriben `{{nombre}}` en el texto y se pasan como `Record<string, string | number>`. Un parámetro ausente deja el marcador visible para detectarlo en pruebas.
- Los textos con cantidades se redactan como etiqueta ("Copias: {{count}}") porque no hay pluralización gramatical.
- `Money.amount` son unidades menores con dos decimales (`amount / 100`); el formateo usa `Intl.NumberFormat` con `es-MX` o `en-US` según el idioma y muestra el código de moneda cuando el símbolo es ambiguo (`USD 80.00`, `COP 150`).
- Una marca de tiempo inválida produce cadena vacía; una zona horaria inválida cae a UTC.
- Para agregar una clave: se agrega en `src/messages/es.ts` y en `src/messages/en.ts`. El tipo `Record<MessageKey, string>` de `en` hace que falte o sobre una clave no compile; la prueba de paridad lo verifica también en ejecución junto con la igualdad de parámetros.
- `MessageKey` es la unión de claves de `es`; `t` acepta además cualquier cadena. `MESSAGE_KEYS`, `hasMessage`, `placeholdersOf` y `translateWith` sirven a las compuertas y a las pruebas.
- `CATALOG` registra el paquete para `pnpm catalog`.

## Cómo se prueba

```bash
pnpm --filter @psp/i18n typecheck
pnpm --filter @psp/i18n test
```

`src/messages.test.ts` es la compuerta de paridad: mismas claves en `es` y `en`, mismos parámetros por clave, ningún texto vacío, cobertura de cada lista cerrada de `@psp/contracts` y de las listas de `@psp/vision`, las once preguntas del tablero (requisito 20) y frases humanas en `instructions.*`. `src/i18n.test.ts` cubre `t` (parámetros y fallback), `tl`, `formatMoney` (MXN, USD, COP), `formatDuration`, `formatDate`/`formatTime` con zona horaria, `formatNumber` y `createTranslator`. Las pruebas de formato dependen de los datos ICU que trae Node; la salida se compara con el ejemplo del contrato (`$80.00`).
