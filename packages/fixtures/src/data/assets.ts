/**
 * Activos generados: SVG deterministas (logos, fondos, marcos, stickers, siluetas, ejemplos,
 * pantallas promocionales, icono). `hash`, `bytes` y `path` se derivan del contenido, así el
 * manifiesto del bundle y el almacén del control-plane coinciden sin archivos binarios en el repo.
 *
 * La familia de formas de Una de Todos vive aquí: seis personajes con silueta orgánica propia,
 * generada con radios variables alrededor de un centro y unida con curvas cúbicas suaves. La semilla
 * de cada personaje es fija, así que la misma forma sale en cada corrida. Los cuatro colores de la
 * marca que no caben en las cinco claves de `branding.palette` (naranja, verde, azul y morado) viven
 * aquí, en los personajes y en la imagen de atracción.
 */
import { Asset, type AssetCategory, type Id, type Scope } from '@psp/contracts';
import { sha256Hex, utf8 } from '../sha256';
import { DEMO_IDS } from '../ids';
import { Rng } from '../prng';
import { audit } from './common';
import type { AssetContent } from '../types';

/** Los ocho colores de Una de Todos. Los seis vivos se usan juntos; el crema respira y el negro sostiene. */
export const BRAND_COLORS = {
  pink: '#FF6FA5',
  orange: '#FF7A3C',
  yellow: '#FFC24A',
  green: '#5FCB92',
  blue: '#4C86E8',
  purple: '#A87BE8',
  cream: '#F3EEE4',
  ink: '#111111',
} as const;

const A = DEMO_IDS.asset;
const ORG = DEMO_IDS.org;

interface AssetSpec {
  id: Id;
  name: string;
  category: AssetCategory;
  organizationId?: Id;
  ownerScope: Scope;
  width: number;
  height: number;
  tags: string[];
  locales?: Array<'es' | 'en'>;
  campaignId?: Id;
  svg: (w: number, h: number) => string;
}

const esc = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function svgDoc(w: number, h: number, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
}

/** Logotipo: rectángulo redondeado con color de marca y texto. */
const logo = (text: string, bg: string, fg: string) => (w: number, h: number): string =>
  svgDoc(
    w,
    h,
    `<rect width="${w}" height="${h}" rx="${Math.round(h / 6)}" fill="${bg}"/><text x="50%" y="58%" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="${Math.round(h / 3)}" fill="${fg}">${esc(text)}</text>`,
  );

/** Fondo: degradado con dos colores. */
const gradient = (from: string, to: string, pattern: boolean) => (w: number, h: number): string => {
  const dots = pattern
    ? Array.from({ length: 24 }, (_, i) => {
        const x = ((i * 137) % w) + 20;
        const y = ((i * 71) % h) + 20;
        return `<circle cx="${x}" cy="${y}" r="${6 + (i % 4) * 3}" fill="#FFFFFF" opacity="0.35"/>`;
      }).join('')
    : '';
  return svgDoc(
    w,
    h,
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/>${dots}`,
  );
};

/** Marco: borde ancho con interior transparente y motivo en las esquinas. */
const frame = (color: string, accent: string, label: string) => (w: number, h: number): string => {
  const b = Math.round(Math.min(w, h) * 0.06);
  const corner = (x: number, y: number) => `<circle cx="${x}" cy="${y}" r="${b}" fill="${accent}"/>`;
  return svgDoc(
    w,
    h,
    `<rect x="${b / 2}" y="${b / 2}" width="${w - b}" height="${h - b}" fill="none" stroke="${color}" stroke-width="${b}"/>${corner(b, b)}${corner(w - b, b)}${corner(b, h - b)}${corner(w - b, h - b)}<text x="50%" y="${h - b / 2 + 6}" text-anchor="middle" font-family="sans-serif" font-size="${b}" fill="${accent}">${esc(label)}</text>`,
  );
};

const star = (color: string) => (w: number, h: number): string => {
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) / 2 - 4;
  const points = Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${(cx + radius * Math.cos(angle)).toFixed(1)},${(cy + radius * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');
  return svgDoc(w, h, `<polygon points="${points}" fill="${color}" stroke="#FFFFFF" stroke-width="4"/>`);
};

const heart = (color: string) => (w: number, h: number): string =>
  svgDoc(
    w,
    h,
    `<path d="M ${w / 2} ${h * 0.9} C ${w * 0.05} ${h * 0.55}, ${w * 0.1} ${h * 0.1}, ${w / 2} ${h * 0.3} C ${w * 0.9} ${h * 0.1}, ${w * 0.95} ${h * 0.55}, ${w / 2} ${h * 0.9} Z" fill="${color}" stroke="#FFFFFF" stroke-width="4"/>`,
  );

/** Silueta de persona (cabeza + hombros), centrada en `cx` con altura relativa `scale`. */
function person(cx: number, baseY: number, height: number, fill: string): string {
  const headR = height * 0.16;
  const headY = baseY - height + headR;
  return `<circle cx="${cx}" cy="${headY}" r="${headR}" fill="${fill}"/><path d="M ${cx - height * 0.32} ${baseY} Q ${cx} ${baseY - height * 0.75} ${cx + height * 0.32} ${baseY} Z" fill="${fill}"/>`;
}

/**
 * Silueta de pose: sólo formas, nunca texto. La vista de la cámara va en espejo y cualquier texto
 * dentro de la guía saldría invertido; la instrucción vive en la interfaz, donde además se traduce.
 * `label` se conserva como nombre descriptivo del activo.
 */
const pose = (people: number, _label: string) => (w: number, h: number): string => {
  const figures = Array.from({ length: people }, (_, i) => person(((i + 1) * w) / (people + 1), h * 0.95, h * 0.7, BRAND_COLORS.blue)).join('');
  return svgDoc(w, h, `<rect width="${w}" height="${h}" fill="none" stroke="${BRAND_COLORS.blue}" stroke-dasharray="8 6" stroke-width="3"/>${figures}`);
};

const examplePhoto = (bg: string, skin: string) => (w: number, h: number): string =>
  svgDoc(w, h, `<rect width="${w}" height="${h}" fill="${bg}"/>${person(w / 2, h * 0.98, h * 0.62, skin)}`);

const promo = (title: string, subtitle: string, bg: string, accent: string) => (w: number, h: number): string =>
  svgDoc(
    w,
    h,
    `<rect width="${w}" height="${h}" fill="${bg}"/><rect x="${w * 0.08}" y="${h * 0.3}" width="${w * 0.84}" height="${h * 0.4}" rx="24" fill="${accent}" opacity="0.9"/><text x="50%" y="${h * 0.47}" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="${Math.round(w * 0.07)}" fill="#FFFFFF">${esc(title)}</text><text x="50%" y="${h * 0.6}" text-anchor="middle" font-family="sans-serif" font-size="${Math.round(w * 0.04)}" fill="#FFFFFF">${esc(subtitle)}</text>`,
  );

const iconCamera = (w: number, h: number): string =>
  svgDoc(
    w,
    h,
    `<rect x="${w * 0.1}" y="${h * 0.3}" width="${w * 0.8}" height="${h * 0.5}" rx="${w * 0.06}" fill="${BRAND_COLORS.ink}"/><rect x="${w * 0.35}" y="${h * 0.2}" width="${w * 0.3}" height="${h * 0.15}" fill="${BRAND_COLORS.ink}"/><circle cx="${w / 2}" cy="${h * 0.55}" r="${w * 0.17}" fill="${BRAND_COLORS.cream}"/><circle cx="${w / 2}" cy="${h * 0.55}" r="${w * 0.1}" fill="${BRAND_COLORS.pink}"/>`,
  );

/** Redondeo fijo: mantiene el SVG (y por lo tanto el hash) estable entre corridas. */
const n1 = (value: number): string => (Math.round(value * 10) / 10).toFixed(1);

/**
 * Puntos de una silueta orgánica: `lobes` radios alrededor de un centro, cada uno estirado o
 * encogido por la semilla del personaje. Con `variance` alto la forma se aleja del círculo.
 */
function blobOutline(seed: string, cx: number, cy: number, radius: number, lobes: number, variance: number, tilt: number): Array<[number, number]> {
  const rng = new Rng(`blob/${seed}`);
  return Array.from({ length: lobes }, (_, i): [number, number] => {
    const angle = tilt + (i * 2 * Math.PI) / lobes;
    const r = radius * rng.float(1 - variance, 1 + variance);
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  });
}

/** Une los puntos con curvas cúbicas suaves y cierra la figura (Catmull-Rom convertido a Bézier). */
function smoothClosedPath(points: ReadonlyArray<[number, number]>, tension = 1 / 6): string {
  const n = points.length;
  const at = (i: number): [number, number] => points[((i % n) + n) % n] ?? [0, 0];
  const [startX, startY] = at(0);
  let d = `M ${n1(startX)} ${n1(startY)}`;
  for (let i = 0; i < n; i += 1) {
    const [p0x, p0y] = at(i - 1);
    const [p1x, p1y] = at(i);
    const [p2x, p2y] = at(i + 1);
    const [p3x, p3y] = at(i + 2);
    const c1x = p1x + (p2x - p0x) * tension;
    const c1y = p1y + (p2y - p0y) * tension;
    const c2x = p2x - (p3x - p1x) * tension;
    const c2y = p2y - (p3y - p1y) * tension;
    d += ` C ${n1(c1x)} ${n1(c1y)} ${n1(c2x)} ${n1(c2y)} ${n1(p2x)} ${n1(p2y)}`;
  }
  return `${d} Z`;
}

type Mouth = 'smile' | 'grin' | 'open' | 'oh' | 'wave' | 'tongue';

/** Un personaje de la familia: silueta, color y expresión. */
interface Character {
  key: string;
  id: Id;
  name: string;
  trait: string;
  color: string;
  lobes: number;
  variance: number;
  tilt: number;
  mouth: Mouth;
  wink: boolean;
}

/** Los seis personajes. Cada uno cambia de lobes, varianza, giro y boca: ninguno parece un círculo. */
export const CHARACTERS: readonly Character[] = [
  { key: 'idea', id: DEMO_IDS.asset.blobIdea, name: 'La Idea', trait: 'Siempre propone', color: BRAND_COLORS.pink, lobes: 7, variance: 0.32, tilt: -1.2, mouth: 'smile', wink: false },
  { key: 'boost', id: DEMO_IDS.asset.blobBoost, name: 'El Boost', trait: 'Le pone energía', color: BRAND_COLORS.yellow, lobes: 9, variance: 0.3, tilt: 0.35, mouth: 'grin', wink: false },
  { key: 'tranqui', id: DEMO_IDS.asset.blobTranqui, name: 'El Tranqui', trait: 'Equilibra', color: BRAND_COLORS.blue, lobes: 5, variance: 0.18, tilt: 1.9, mouth: 'wave', wink: false },
  { key: 'compa', id: DEMO_IDS.asset.blobCompa, name: 'El Compa', trait: 'Nunca falla', color: BRAND_COLORS.orange, lobes: 6, variance: 0.28, tilt: -0.6, mouth: 'smile', wink: true },
  { key: 'curiosa', id: DEMO_IDS.asset.blobCuriosa, name: 'La Curiosa', trait: 'Todo lo explora', color: BRAND_COLORS.green, lobes: 8, variance: 0.29, tilt: 2.6, mouth: 'oh', wink: false },
  { key: 'chispa', id: DEMO_IDS.asset.blobChispa, name: 'La Chispa', trait: 'Hace todo más divertido', color: BRAND_COLORS.purple, lobes: 10, variance: 0.34, tilt: 0.9, mouth: 'tongue', wink: false },
];

/** Ojos y boca de un personaje, dibujados en negro sobre su silueta. */
function face(cx: number, cy: number, radius: number, character: Character): string {
  const ink = BRAND_COLORS.ink;
  const eyeR = radius * 0.13;
  const eyeY = cy - radius * 0.12;
  const dx = radius * 0.31;
  const stroke = Math.max(2, radius * 0.055);
  const left = character.wink
    ? `<path d="M ${n1(cx - dx - eyeR)} ${n1(eyeY)} Q ${n1(cx - dx)} ${n1(eyeY - eyeR * 1.3)} ${n1(cx - dx + eyeR)} ${n1(eyeY)}" fill="none" stroke="${ink}" stroke-width="${n1(stroke)}" stroke-linecap="round"/>`
    : `<circle cx="${n1(cx - dx)}" cy="${n1(eyeY)}" r="${n1(eyeR)}" fill="${ink}"/>`;
  const right = `<circle cx="${n1(cx + dx)}" cy="${n1(eyeY)}" r="${n1(eyeR)}" fill="${ink}"/>`;
  const my = cy + radius * 0.3;
  const mw = radius * 0.34;
  const arc = (depth: number) => `<path d="M ${n1(cx - mw)} ${n1(my)} Q ${n1(cx)} ${n1(my + depth)} ${n1(cx + mw)} ${n1(my)}" fill="none" stroke="${ink}" stroke-width="${n1(stroke)}" stroke-linecap="round"/>`;
  const mouths: Record<Mouth, string> = {
    smile: arc(radius * 0.3),
    grin: `<path d="M ${n1(cx - mw * 1.2)} ${n1(my - radius * 0.05)} Q ${n1(cx)} ${n1(my + radius * 0.45)} ${n1(cx + mw * 1.2)} ${n1(my - radius * 0.05)} Z" fill="${ink}"/>`,
    open: `<ellipse cx="${n1(cx)}" cy="${n1(my + radius * 0.05)}" rx="${n1(mw * 0.7)}" ry="${n1(radius * 0.16)}" fill="${ink}"/>`,
    oh: `<circle cx="${n1(cx)}" cy="${n1(my + radius * 0.04)}" r="${n1(radius * 0.11)}" fill="none" stroke="${ink}" stroke-width="${n1(stroke)}"/>`,
    wave: `<path d="M ${n1(cx - mw)} ${n1(my)} Q ${n1(cx - mw * 0.4)} ${n1(my + radius * 0.16)} ${n1(cx)} ${n1(my)} Q ${n1(cx + mw * 0.4)} ${n1(my - radius * 0.16)} ${n1(cx + mw)} ${n1(my)}" fill="none" stroke="${ink}" stroke-width="${n1(stroke)}" stroke-linecap="round"/>`,
    tongue: `${arc(radius * 0.34)}<path d="M ${n1(cx - mw * 0.35)} ${n1(my + radius * 0.16)} Q ${n1(cx)} ${n1(my + radius * 0.42)} ${n1(cx + mw * 0.35)} ${n1(my + radius * 0.16)} Z" fill="${BRAND_COLORS.pink}"/>`,
  };
  return `${left}${right}${mouths[character.mouth]}`;
}

/** Silueta + cara de un personaje dentro de una caja, sin fondo. */
function characterShape(character: Character, cx: number, cy: number, radius: number): string {
  const outline = smoothClosedPath(blobOutline(character.key, cx, cy, radius, character.lobes, character.variance, character.tilt));
  return `<path d="${outline}" fill="${character.color}"/>${face(cx, cy, radius, character)}`;
}

/** Sticker de un personaje: la forma sola, centrada en el lienzo. */
const characterSticker = (character: Character) => (w: number, h: number): string =>
  svgDoc(w, h, characterShape(character, w / 2, h / 2, Math.min(w, h) * 0.4));

/** Logotipo de la marca: tres personajes sobre crema y el nombre en negro. */
const brandLogo = (w: number, h: number): string => {
  const r = h * 0.19;
  const trio = [CHARACTERS[0], CHARACTERS[2], CHARACTERS[4]]
    .map((character, i) => (character === undefined ? '' : characterShape(character, w * 0.13 + i * r * 1.7, h * 0.34, r)))
    .join('');
  return svgDoc(
    w,
    h,
    `<rect width="${w}" height="${h}" rx="${Math.round(h / 6)}" fill="${BRAND_COLORS.cream}"/>${trio}<text x="${w * 0.5}" y="${h * 0.78}" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="${Math.round(h * 0.26)}" fill="${BRAND_COLORS.ink}">Una de Todos</text>`,
  );
};

/** Pantalla de atracción: la familia completa sobre el fondo crema, con el lema de la marca. */
const familyAttract = (w: number, h: number): string => {
  const r = w * 0.15;
  const spots: Array<[number, number, number]> = [
    [0.26, 0.3, 1], [0.68, 0.24, 0.86], [0.5, 0.46, 1.12],
    [0.24, 0.6, 0.92], [0.72, 0.58, 1.04], [0.48, 0.75, 0.84],
  ];
  const family = CHARACTERS.map((character, i) => {
    const spot = spots[i] ?? [0.5, 0.5, 1];
    return characterShape(character, w * spot[0], h * spot[1], r * spot[2]);
  }).join('');
  return svgDoc(
    w,
    h,
    `<rect width="${w}" height="${h}" fill="${BRAND_COLORS.cream}"/>${family}<text x="50%" y="${h * 0.88}" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="${Math.round(w * 0.085)}" fill="${BRAND_COLORS.ink}">Una de Todos</text><text x="50%" y="${h * 0.93}" text-anchor="middle" font-family="sans-serif" font-size="${Math.round(w * 0.042)}" fill="${BRAND_COLORS.ink}">Fotos que nos juntan</text>`,
  );
};

const unaDeTodos: Scope = { level: 'organization', id: ORG.unaDeTodos };
const fotorapida: Scope = { level: 'organization', id: ORG.fotorapida };

export const ASSET_SPECS: readonly AssetSpec[] = [
  { id: A.logoUnaDeTodos, name: 'Logo Una de Todos', category: 'logo', organizationId: ORG.unaDeTodos, ownerScope: unaDeTodos, width: 600, height: 200, tags: ['brand'], svg: brandLogo },
  { id: A.logoFotorapida, name: 'Logo FotoRápida', category: 'logo', organizationId: ORG.fotorapida, ownerScope: fotorapida, width: 600, height: 200, tags: ['brand'], svg: logo('FotoRápida', '#E63946', '#FFFFFF') },
  { id: A.logoNorte, name: 'Logo franquicia Norte', category: 'logo', organizationId: ORG.unaDeTodos, ownerScope: { level: 'franchise', id: DEMO_IDS.franchise.norte }, width: 600, height: 200, tags: ['franchise'], svg: logo('Una de Todos Norte', BRAND_COLORS.ink, BRAND_COLORS.yellow) },
  { id: A.logoHostCafe, name: 'Logo anfitrión Café Aurora', category: 'logo', organizationId: ORG.unaDeTodos, ownerScope: { level: 'location', id: DEMO_IDS.location.cafe }, width: 400, height: 400, tags: ['host'], svg: logo('Café Aurora', '#6B3E26', '#FFF4E0') },
  { id: A.logoHostUniversity, name: 'Logo anfitrión Universidad del Norte', category: 'logo', organizationId: ORG.unaDeTodos, ownerScope: { level: 'location', id: DEMO_IDS.location.university }, width: 400, height: 400, tags: ['host'], svg: logo('U. del Norte', '#1B4332', '#FFFFFF') },
  { id: A.logoSponsorAurora, name: 'Logo patrocinador Chocolates Aurora', category: 'logo', organizationId: ORG.unaDeTodos, ownerScope: unaDeTodos, width: 600, height: 200, tags: ['sponsor', 'navidad'], campaignId: DEMO_IDS.campaign.christmas2026, svg: logo('Chocolates Aurora', '#5C2A1E', '#F5D7A1') },
  { id: A.bgUnaDeTodos, name: 'Fondo Una de Todos', category: 'background', organizationId: ORG.unaDeTodos, ownerScope: unaDeTodos, width: 1080, height: 1920, tags: ['brand'], svg: gradient(BRAND_COLORS.cream, BRAND_COLORS.pink, false) },
  { id: A.bgConfetti, name: 'Fondo confeti', category: 'background', organizationId: ORG.unaDeTodos, ownerScope: unaDeTodos, width: 1080, height: 1920, tags: ['party'], svg: gradient(BRAND_COLORS.yellow, BRAND_COLORS.pink, true) },
  { id: A.frameChristmas, name: 'Marco navidad', category: 'frame', organizationId: ORG.unaDeTodos, ownerScope: unaDeTodos, width: 1500, height: 2100, tags: ['navidad'], campaignId: DEMO_IDS.campaign.christmas2026, svg: frame('#B3001B', '#2E7D32', 'Felices fiestas') },
  { id: A.frameBirthday, name: 'Marco cumpleaños', category: 'frame', organizationId: ORG.unaDeTodos, ownerScope: unaDeTodos, width: 1200, height: 1800, tags: ['birthday'], svg: frame(BRAND_COLORS.yellow, BRAND_COLORS.blue, '¡Feliz cumpleaños!') },
  { id: A.stickerStar, name: 'Sticker estrella', category: 'sticker', organizationId: ORG.unaDeTodos, ownerScope: unaDeTodos, width: 256, height: 256, tags: ['fun'], svg: star(BRAND_COLORS.yellow) },
  { id: A.stickerHeart, name: 'Sticker corazón', category: 'sticker', organizationId: ORG.unaDeTodos, ownerScope: unaDeTodos, width: 256, height: 256, tags: ['fun', 'couple'], svg: heart(BRAND_COLORS.pink) },
  { id: A.poseSingle, name: 'Silueta una persona', category: 'pose_silhouette', ownerScope: { level: 'platform' }, width: 1080, height: 1920, tags: ['pose'], svg: pose(1, 'Centra tu rostro') },
  { id: A.posePair, name: 'Silueta dos personas', category: 'pose_silhouette', ownerScope: { level: 'platform' }, width: 1080, height: 1920, tags: ['pose'], svg: pose(2, 'Acérquense') },
  { id: A.examplePortrait1, name: 'Ejemplo retrato fondo blanco', category: 'example_photo', ownerScope: { level: 'platform' }, width: 700, height: 900, tags: ['document'], svg: examplePhoto('#FFFFFF', '#8D6E63') },
  { id: A.examplePortrait2, name: 'Ejemplo retrato fondo neutro', category: 'example_photo', ownerScope: { level: 'platform' }, width: 700, height: 900, tags: ['portrait'], svg: examplePhoto('#D9D9D9', '#5D4037') },
  { id: A.promoChristmas, name: 'Pantalla promocional navidad', category: 'promo_screen', organizationId: ORG.unaDeTodos, ownerScope: unaDeTodos, width: 1080, height: 1920, tags: ['navidad'], locales: ['es'], campaignId: DEMO_IDS.campaign.christmas2026, svg: promo('Retrato navideño', 'Con Chocolates Aurora', '#B3001B', '#2E7D32') },
  { id: A.promoDocuments, name: 'Pantalla promocional documentos', category: 'promo_screen', organizationId: ORG.unaDeTodos, ownerScope: unaDeTodos, width: 1080, height: 1920, tags: ['documents'], locales: ['es', 'en'], svg: promo('Foto para trámites', 'Lista en 2 minutos', BRAND_COLORS.cream, BRAND_COLORS.pink) },
  { id: A.iconCamera, name: 'Icono cámara', category: 'icon', ownerScope: { level: 'platform' }, width: 128, height: 128, tags: ['ui'], svg: iconCamera },
  { id: A.attractFamily, name: 'Pantalla de atracción · la familia', category: 'promo_screen', organizationId: ORG.unaDeTodos, ownerScope: unaDeTodos, width: 1080, height: 1920, tags: ['brand', 'familia'], locales: ['es'], svg: familyAttract },
  ...CHARACTERS.map((character): AssetSpec => ({
    id: character.id,
    name: `Sticker ${character.name}`,
    category: 'sticker',
    organizationId: ORG.unaDeTodos,
    ownerScope: unaDeTodos,
    width: 512,
    height: 512,
    tags: ['brand', 'familia', character.key],
    svg: characterSticker(character),
  })),
];

const SPEC_INDEX = new Map(ASSET_SPECS.map((spec) => [spec.id, spec]));

/** Contenido SVG de un activo; lanza si el id no existe. */
export function assetSvg(assetId: Id): string {
  const spec = SPEC_INDEX.get(assetId);
  if (spec === undefined) throw new Error(`asset desconocido: ${assetId}`);
  return spec.svg(spec.width, spec.height);
}

export function assetContent(assetId: Id): AssetContent {
  return { mime: 'image/svg+xml', bytes: utf8(assetSvg(assetId)) };
}

export function buildAssets(): Asset[] {
  return ASSET_SPECS.map((spec) => {
    const svg = spec.svg(spec.width, spec.height);
    const hash = sha256Hex(svg);
    return Asset.parse({
      id: spec.id,
      organizationId: spec.organizationId,
      name: spec.name,
      category: spec.category,
      ownerScope: spec.ownerScope,
      tags: spec.tags,
      locales: spec.locales ?? [],
      dimensions: { width: spec.width, height: spec.height },
      campaignId: spec.campaignId,
      mime: 'image/svg+xml',
      bytes: utf8(svg).length,
      hash,
      path: `assets/${hash}.svg`,
      ...audit(DEMO_IDS.user.adminUnaDeTodos),
    });
  });
}
