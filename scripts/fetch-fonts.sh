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
