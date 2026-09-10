#!/usr/bin/env bash
# Descarga, instancia y subsetea los cuatro papeles tipográficos del kiosco. Sólo se necesita
# para actualizarlos: los .woff2 resultantes se versionan en el repositorio junto a su licencia,
# y la cabina —que no tiene red— no vuelve a pedir un archivo nunca.
# Presupuesto duro: 250 KB sumando TODOS los archivos. El paso 5 lo hace fallar si se pasa.
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

sub() { python3 -m fontTools.subset "$@"; }
inst() { python3 -m fontTools.varLib.instancer "$@" >/dev/null; }

# Repertorio de texto: ASCII + Latin-1 (ahí viven á é í ó ú ü ñ ¿ ¡ « ») + Latin Extended-A
# (nombres de marca de terceros) + comillas, rayas, flechas, € y ™.
U_TEXTO='U+0020-007E,U+00A0-00FF,U+0100-017F,U+2010-2015,U+2018-201F,U+2026,U+2039-203A,U+20AC,U+2122,U+2190-2193,U+2212'
# Repertorio de cifras: dígitos, signos de moneda y VERSALES. Las versales entran porque
# `formatMoney` cae a "1234.00 MXN" cuando Intl no conoce la divisa (packages/i18n/src/index.ts),
# y un precio con la divisa en tofu es peor que un precio feo. Ni minúsculas ni acentos:
# si alguien compone prosa con este papel tiene que verlo romperse de inmediato.
U_CIFRA='U+0020-0040,U+0041-005A,U+00A0,U+00A2-00A5,U+00B0,U+00D7,U+2013-2014,U+2044,U+20A0-20BF,U+2212'
# Repertorio utilitario: el código de rescate usa SHORT_CODE_ALPHABET = ABCDEFGHJKLMNPQRSTUVWXYZ23456789
# (packages/domain/src/ids.ts), o sea LETRAS Y CIFRAS mezcladas, y el zócalo imprime además el
# código de máquina y una línea de contacto. Por eso este papel lleva ASCII completo y los
# acentos del español; recortarlo a dígitos deja el código de rescate en tofu.
U_UTIL='U+0020-007E,U+00A0-00FF,U+2013-2014,U+2018-2019,U+201C-201D,U+2026,U+20AC'

# --- 1. Papel DISPLAY · Bungee Layers (rótulo y llamada a la acción) ---------------------
# El release oficial de David Jonathan Ross. El juego Layers es el único con anchos idénticos
# glifo a glifo entre capas: por eso una misma palabra se puede pintar dos veces, sólida y
# con la línea interior encima, y salir en dos colores de la paleta sin fuentes de color ni SVG.
echo "Bungee Layers v2.001 · papel display"
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

# --- 2. Papel NUMERAL · Anybody (cuenta regresiva y precio) ------------------------------
# Trae `tnum`, `zero`, `case` y eje de ancho, que es el mínimo para componer una cuenta. Archivo
# también los trae y se descarta por lo contrario: es la grotesca más neutra del lote y el numeral
# es justo donde se decide si la cabina parece una cabina o el panel que ya se rechazó. Las cifras
# tabulares no son gusto: a 416 px, con cifras proporcionales el dígito salta de sitio en cada
# tic y se lee como error de render. Se recorta wght a 400-900 con default 900 (el original
# arranca en 100: un WebView que ignore los ejes compondría el precio en fina) y wdth a 75-150.
echo "Anybody · papel numeral"
curl -fsSL -o "$TMP/anybody.ttf" \
  'https://raw.githubusercontent.com/google/fonts/main/ofl/anybody/Anybody%5Bwdth,wght%5D.ttf'
inst "$TMP/anybody.ttf" 'wdth=75:112:150' 'wght=400:900:900' -o "$TMP/anybody-var.ttf"
sub "$TMP/anybody-var.ttf" \
    --unicodes="$U_CIFRA" \
    --layout-features='kern,ccmp,locl,mark,mkmk,tnum,zero,case,frac,numr,dnom' \
    --no-hinting --flavor=woff2 \
    --output-file="$OUT/Anybody-cifras-var.woff2"
echo "  Anybody-cifras-var.woff2"
curl -fsSL -o "$OUT/OFL-Anybody.txt" \
  https://raw.githubusercontent.com/google/fonts/main/ofl/anybody/OFL.txt

# --- 3. Papel TEXTO · Bricolage Grotesque (instrucciones, botones, titulares) ------------
# Se fija wdth=100 (su rango 75-100 es pobre y cuesta 53 KB) y se RECORTA el eje óptico y el
# de peso poniéndoles un default utilizable: el archivo original arranca en opsz 96 / wght 800
# ("Bricolage Grotesque 96pt ExtraBold"), o sea que un WebView que ignore los ejes compone
# TODO con espaciado de rótulo. Instanciado así, la instancia por defecto ya es legible.
# El eje óptico es la razón de elegirla: la misma cara a 200 px y a 22 px desde un solo archivo.
echo "Bricolage Grotesque · papel texto"
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

# --- 4. Papel UTILITARIO · Recursive Mono (código de rescate e id de máquina) ------------
# MONO=1 se FIJA en el archivo, no se pide desde CSS: con el eje libre, un WebView que ignore
# `font-variation-settings` compondría el código en la Sans proporcional y las seis casillas
# dejarían de alinearse. Fijado, la caja es tabular por construcción. CASL=0 (lineal, no
# simpática), CRSV=0 (su default 0.5 es una cursiva a medias) y slnt=0. `rvrn` es OBLIGATORIO
# entre las features conservadas: es la que intercambia los glifos propios del modo mono.
echo "Recursive Mono · papel utilitario"
curl -fsSL -o "$TMP/recursive.ttf" \
  'https://raw.githubusercontent.com/google/fonts/main/ofl/recursive/Recursive%5BCASL,CRSV,MONO,slnt,wght%5D.ttf'
inst "$TMP/recursive.ttf" MONO=1 CASL=0 CRSV=0 slnt=0 'wght=500:700:800' -o "$TMP/recursive-var.ttf"
sub "$TMP/recursive-var.ttf" \
    --unicodes="$U_UTIL" \
    --layout-features='kern,ccmp,locl,mark,mkmk,case,tnum,zero,rvrn' \
    --no-hinting --flavor=woff2 \
    --output-file="$OUT/RecursiveMono-var.woff2"
echo "  RecursiveMono-var.woff2"
curl -fsSL -o "$OUT/OFL-Recursive.txt" \
  https://raw.githubusercontent.com/google/fonts/main/ofl/recursive/OFL.txt

# --- 5. Verificación en el mismo runtime que consume las fuentes -------------------------
# Node, no Python: quien falla si un glifo no está es el navegador del aparato, así que la
# comprobación lee el woff2 tal cual lo va a leer él. Sin dependencias: descomprime brotli,
# recorre el directorio de tablas del woff2 y lee `cmap`, `fvar` y las features de GSUB/GPOS.
OUT="$OUT" node - <<'JS'
const { brotliDecompressSync } = require('node:zlib');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

// Tablas conocidas del woff2, en el orden que fija la especificación (índice 0..62).
const KNOWN = ['cmap','head','hhea','hmtx','maxp','name','OS/2','post','cvt ','fpgm','glyf','loca','prep','CFF ','VORG','EBDT','EBLC','gasp','hdmx','kern','LTSH','PCLT','VDMX','vhea','vmtx','BASE','GDEF','GPOS','GSUB','EBSC','JSTF','MATH','CBDT','CBLC','COLR','CPAL','SVG ','sbix','acnt','avar','bdat','bloc','bsln','cvar','fdsc','feat','fmtx','fvar','gvar','hsty','just','lcar','mort','morx','opbd','prop','trak','Zapf','Silf','Glat','Gloc','Feat','Sill'];
const b128 = (b, o) => { let v = 0; for (let i = 0; i < 5; i++) { const x = b[o.p++]; v = ((v << 7) | (x & 0x7f)) >>> 0; if (!(x & 0x80)) return v; } throw new Error('UIntBase128'); };

function tablas(file) {
  const b = readFileSync(file);
  if (b.toString('latin1', 0, 4) !== 'wOF2') throw new Error('no es woff2');
  const n = b.readUInt16BE(12), o = { p: 48 }, dir = [];
  for (let i = 0; i < n; i++) {
    const flags = b[o.p++], idx = flags & 0x3f, ver = flags >> 6;
    const tag = idx === 63 ? b.toString('latin1', o.p, (o.p += 4)) : KNOWN[idx];
    const orig = b128(b, o);
    // glyf y loca van transformadas salvo con versión 3; el resto sólo si la versión no es 0.
    const transformada = (tag === 'glyf' || tag === 'loca') ? ver !== 3 : ver !== 0;
    dir.push({ tag, len: transformada ? b128(b, o) : orig });
  }
  const data = brotliDecompressSync(b.subarray(o.p));
  const t = {}; let off = 0;
  for (const d of dir) { t[d.tag] = data.subarray(off, off + d.len); off += d.len; }
  return { t, bytes: b.length };
}

function cmap(t) {
  const c = t['cmap']; const n = c.readUInt16BE(2);
  let best = null, score = -1;
  for (let i = 0; i < n; i++) {
    const off = c.readUInt32BE(8 + i * 8), fmt = c.readUInt16BE(off);
    const s = fmt === 12 ? 3 : fmt === 4 ? 2 : 0;
    if (s > score) { score = s; best = { off, fmt }; }
  }
  const m = new Map();
  if (best.fmt === 4) {
    const o = best.off, x2 = c.readUInt16BE(o + 6);
    const endO = o + 14, startO = endO + x2 + 2, deltaO = startO + x2, rangeO = deltaO + x2;
    for (let s = 0; s < x2 / 2; s++) {
      const end = c.readUInt16BE(endO + s * 2), start = c.readUInt16BE(startO + s * 2);
      const delta = c.readInt16BE(deltaO + s * 2), ro = c.readUInt16BE(rangeO + s * 2);
      if (start === 0xffff) continue;
      for (let u = start; u <= end; u++) {
        let g;
        if (ro === 0) g = (u + delta) & 0xffff;
        else { const gi = rangeO + s * 2 + ro + (u - start) * 2; if (gi + 1 >= c.length) continue; g = c.readUInt16BE(gi); if (g) g = (g + delta) & 0xffff; }
        if (g) m.set(u, g);
      }
    }
  } else {
    const o = best.off, groups = c.readUInt32BE(o + 12);
    for (let i = 0; i < groups; i++) { const g = o + 16 + i * 12, s = c.readUInt32BE(g), e = c.readUInt32BE(g + 4), gid = c.readUInt32BE(g + 8); for (let u = s; u <= e; u++) m.set(u, gid + (u - s)); }
  }
  return m;
}

const ejes = (t) => !t['fvar'] ? [] : (() => {
  const f = t['fvar'], off = f.readUInt16BE(4), n = f.readUInt16BE(8), sz = f.readUInt16BE(10), out = [];
  for (let i = 0; i < n; i++) { const o = off + i * sz; out.push(`${f.toString('latin1', o, o + 4)} ${f.readInt32BE(o + 4) / 65536}-${f.readInt32BE(o + 12) / 65536}/${f.readInt32BE(o + 8) / 65536}`); }
  return out;
})();

const features = (t) => { const s = new Set(); for (const k of ['GSUB', 'GPOS']) { const x = t[k]; if (!x) continue; const fl = x.readUInt16BE(6); if (!fl) continue; const n = x.readUInt16BE(fl); for (let i = 0; i < n; i++) s.add(x.toString('latin1', fl + 2 + i * 6, fl + 6 + i * 6)); } return [...s].sort(); };

const dir = process.env.OUT;
const ESPANOL = 'áéíóúüñÁÉÍÓÚÜÑ¿¡«»';
const DIGITOS = '0123456789';
// El código de rescate se dibuja con este alfabeto (packages/domain/src/ids.ts).
const CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const fallos = [];
let total = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith('.woff2')).sort()) {
  const { t, bytes } = tablas(join(dir, f));
  const cm = cmap(t);
  total += bytes;
  const falta = (s) => [...s].filter((c) => !cm.has(c.codePointAt(0))).join('');
  const esNumeral = f.startsWith('Anybody');
  const esUtil = f.startsWith('RecursiveMono');
  const debe = esNumeral ? DIGITOS : esUtil ? CODIGO + DIGITOS : ESPANOL + DIGITOS;
  const f1 = falta(debe);
  if (f1) fallos.push(`${f}: faltan «${f1}»`);
  // El papel numeral no lleva minúsculas a propósito: si aparecen, el subset se ensanchó solo.
  if (esNumeral && [...'abcdefghijklmnñopqrstuvwxyz'].some((c) => cm.has(c.codePointAt(0)))) fallos.push(`${f}: el papel numeral trae minúsculas`);
  console.log(`  ${String(bytes).padStart(7)} B  ${f.padEnd(30)} glifos=${String(cm.size).padStart(4)}  [${ejes(t).join(' ') || 'estática'}]`);
  console.log(`            features: ${features(t).join(' ')}`);
}
console.log(`  ${String(total).padStart(7)} B  TOTAL — ${(total / 1024).toFixed(1)} KB de 250 KB (${Math.round((total / 256000) * 100)} % del presupuesto)`);
if (total > 250 * 1024) fallos.push(`presupuesto excedido: ${total} B`);
if (fallos.length) { console.log('FALLA:'); for (const x of fallos) console.log('  -', x); process.exit(1); }
console.log('  OK');
JS
