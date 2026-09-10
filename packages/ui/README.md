# @psp/ui

## Propósito
Design system compartido por el kiosco táctil y la consola de administración: tokens CSS (`--psp-*`), tema derivado del branding del bundle, componentes grandes y de alto contraste para kiosco y componentes densos para administración. Los componentes son agnósticos de idioma y de negocio: todo texto visible llega por props.

## Cómo se usa
```tsx
import '@psp/ui/styles.css';
import { ThemeProvider, applyBrandingTheme, KioskShell, BigButton, ChoiceCard, DataTable } from '@psp/ui';

// Kiosco: clase raíz psp-kiosk; el tema se calcula desde branding.palette.* del bundle.
<div className="psp-kiosk">
  <ThemeProvider values={bundle.effective.values}>
    <KioskShell header={...} footer={...}>
      <ChoiceCard title={tl(locale, product.displayName)} price={formatMoney(price.final, locale)} state="available" onSelect={...} />
      <BigButton variant="primary" size="xl" onClick={...}>{t(locale, 'common.continuar')}</BigButton>
    </KioskShell>
  </ThemeProvider>
</div>

// Admin: clase raíz psp-admin.
<DataTable columns={columns} rows={rows} rowKey="id" loading={loading} empty={{ title: t('common.sinResultados') }} page={page} pageSize={50} total={total} onPageChange={setPage} />
```

Componentes:

| Grupo | Componentes |
|---|---|
| Tema | `ThemeProvider`, `useTheme`, `applyBrandingTheme`, tokens en `src/styles.css` |
| Kiosco | `KioskShell`, `BigButton`, `ChoiceCard` (`choiceStateFromAvailability`), `Countdown`, `ProgressDots`, `TimeoutBar`, `CriteriaList`, `InstructionBanner`, `PriceTag`, `StatusPill`, `Sheet`, `Notice`, `ErrorPanel`, `NumericKeypad`, `TouchSlider`, `Toggle`, `ThumbGrid`, `CompareView`, `LangSwitch`, `Spinner`, `IconButton` |
| Admin | `AppShell`, `PageHeader`, `DataTable`, `FilterBar`, `StatCard`, `Badge`, `Tabs`, `Field`, `Input`, `Select`, `Textarea`, `Switch`, `NumberInput`, `ColorInput`, `ProvenanceTag`, `LockTag`, `ConfirmDialog`, `Drawer`, `EmptyState`, `Skeleton`, `Alert`, `Timeline`, `KeyValue`, `Breadcrumbs`, `Toolbar` |
| Compartidos | `Card`, `Icon` (`ICON_NAMES`), `VisuallyHidden`, `cx` |

## Tipografía: cuatro papeles

El modo kiosco no usa la pila del sistema. Un **papel** es la unidad tipográfica del producto, igual
que un papel de color lo es de la paleta: cada texto pertenece a uno y sólo a uno. Los archivos
viven en `apps/kiosk/public/fonts` (los llena `scripts/fetch-fonts.sh`, con su licencia OFL al
lado) y `src/styles.css` §1.1 los declara con `@font-face`; §2.1 los deja listos en clases.

| Papel | Token de familia | Clases | Qué compone |
|---|---|---|---|
| Display | `--psp-paper-display` (+ `--psp-paper-display-inline`) | `.psp-type-rotulo`, `.psp-type-rotulo--capas` | Rótulo y llamada a la acción |
| Numeral | `--psp-paper-numeral` | `.psp-type-numeral`, `.psp-type-precio` | Cuenta regresiva y precio |
| Texto | `--psp-paper-text` | `.psp-type-titular`, `.psp-type-destacado`, `.psp-type-cuerpo`, `.psp-type-micro` | Todo lo que se lee |
| Utilitario | `--psp-paper-util` | `.psp-type-codigo`, `.psp-type-maquina` | Código de rescate e identificador de máquina |

Reglas que la escala impone:

- **Base 26 px, declarada en `.psp-kiosk`.** Como la base no vive en `html`, `rem` está prohibido en
  el kiosco: `rem` mira `html`, que sigue en 16 px, y un «destacado» de `1.35rem` mide 21,6 px, o sea
  menos que el cuerpo. Se escribe en `em` o en los tokens `--psp-font-*`.
- **Piso duro de 22 px.** `--psp-font-micro` es el mínimo del kiosco, y `--psp-font-xs` y
  `--psp-font-sm` se hunden en él.
- **Cifras tabulares obligatorias en el numeral.** `--psp-feat-numeral` trae `'tnum' 1`; sin él el
  dígito de la cuenta salta hasta 34 px de sitio entre un tic y el siguiente (medido a 416 px).
- **La palabra en dos colores** se compone con dos capas de Bungee superpuestas:
  `<span class="psp-type-rotulo psp-type-rotulo--capas">TEXTO<span class="psp-type-rotulo__inline" aria-hidden="true">TEXTO</span></span>`.
- **El movimiento es de dos titulares y nada más.** `.psp-type-entra` anima el bloque;
  `.psp-type-entra--piezas` reparte la entrada entre sus hijos con un retraso por índice, sin
  biblioteca y sin red. Con `prefers-reduced-motion` no se anima nada.

Se mira y se aprueba en `ops/campanas/rediseno-visual-kiosco/ESPECIMEN.html`.

## La marca como material, no como adorno

Cuatro piezas hacen que el kiosco se vea como una cabina y no como un panel de administración.

**`BlobFace`** es la familia: seis siluetas de lóbulos redondos que se funden en una nube mullida,
de color plano y sin contorno, cada una distinta. Tiene gesto —respira, se asoma, celebra, habla— y
mirada dirigible: seis formas mirando hacia el precio dicen «mira el precio» en cualquier idioma,
que es lo que necesita alguien que no va a leer. Cada variante entra desfasada, porque seis formas
al unísono parecen un banner y desfasadas parecen una bandada.

**`BlobPile`** las apila y las solapa. El montón ES el significado: formas distintas, de tamaños
distintos, y todas caben. Una fila ordenada de seis siluetas iguales diría catálogo.

**`BlobFrame`** da esa forma a un contenedor sin escalar al personaje, que es el error que vuelve
ilegible lo que va encima. La amplitud es la única decisión: 0.45 para un botón, 0.30 para una
miniatura y 0.14 —casi recto— para todo lo que contenga la cara de una persona.

**`Marquee`** es la banda de focos del borde superior. Hace tres trabajos a la vez: es lo que se ve
moverse desde el fondo de un pasillo, es luz sobre la cara de quien posa, y es el único reloj del
recorrido social —el tiempo se ve como focos que se apagan, nunca como un contador en rojo—.

Los papeles de color no son posiciones. `assignAccentRoles` deduce del color cuál es la luz, cuál
confirma y cuál avisa, porque escribir «el cuarto acento confirma el pago» es cierto de una paleta y
falso de una plataforma multi-marca.

## El sonido

`SoundBoard` sintetiza los avisos con osciladores: **no se empaqueta ni un archivo de audio**. Cuenta,
obturador, aterrizaje, cobro aprobado, celebración, toque y rechazo. El volumen sale de la máquina y
en cero la cabina trabaja en silencio sin perder una sola instrucción, porque cada aviso tiene gemelo
visual obligatorio. El contexto de audio nace en el primer toque, que es cuando un navegador deja
sonar, y un aparato sin Web Audio queda mudo en vez de roto.


Criterios de accesibilidad aplicados: controles táctiles de al menos 64 px en modo kiosco, contraste calculado por luminancia para cada color de marca, estados que combinan icono y texto (nunca sólo color), una acción principal por pantalla, confirmaciones para acciones irreversibles.

## Cómo se prueba
```bash
pnpm --filter @psp/ui typecheck
pnpm --filter @psp/ui test
```
Las pruebas renderizan cada componente con `react-dom/server` y verifican el cálculo de contraste del tema.
