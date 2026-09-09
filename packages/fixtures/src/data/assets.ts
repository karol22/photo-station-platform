/**
 * Activos generados: SVG deterministas (logos, fondos, marcos, stickers, siluetas, ejemplos,
 * pantallas promocionales, icono). `hash`, `bytes` y `path` se derivan del contenido, así el
 * manifiesto del bundle y el almacén del control-plane coinciden sin archivos binarios en el repo.
 */
import { Asset, type AssetCategory, type Id, type Scope } from '@psp/contracts';
import { sha256Hex, utf8 } from '../sha256';
import { DEMO_IDS } from '../ids';
import { audit } from './common';
import type { AssetContent } from '../types';

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

const pose = (people: number, label: string) => (w: number, h: number): string => {
  const figures = Array.from({ length: people }, (_, i) => person(((i + 1) * w) / (people + 1), h * 0.95, h * 0.7, '#1E5EFF')).join('');
  return svgDoc(w, h, `<rect width="${w}" height="${h}" fill="none" stroke="#1E5EFF" stroke-dasharray="8 6" stroke-width="3"/>${figures}<text x="50%" y="${h * 0.12}" text-anchor="middle" font-family="sans-serif" font-size="${Math.round(h * 0.06)}" fill="#0B1B3F">${esc(label)}</text>`);
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
    `<rect x="${w * 0.1}" y="${h * 0.3}" width="${w * 0.8}" height="${h * 0.5}" rx="${w * 0.06}" fill="#0B1B3F"/><rect x="${w * 0.35}" y="${h * 0.2}" width="${w * 0.3}" height="${h * 0.15}" fill="#0B1B3F"/><circle cx="${w / 2}" cy="${h * 0.55}" r="${w * 0.17}" fill="#FFFFFF"/><circle cx="${w / 2}" cy="${h * 0.55}" r="${w * 0.1}" fill="#1E5EFF"/>`,
  );

const lumina: Scope = { level: 'organization', id: ORG.lumina };
const fotorapida: Scope = { level: 'organization', id: ORG.fotorapida };

export const ASSET_SPECS: readonly AssetSpec[] = [
  { id: A.logoLumina, name: 'Logo Lumina Foto', category: 'logo', organizationId: ORG.lumina, ownerScope: lumina, width: 600, height: 200, tags: ['brand'], svg: logo('Lumina Foto', '#1E5EFF', '#FFFFFF') },
  { id: A.logoFotorapida, name: 'Logo FotoRápida', category: 'logo', organizationId: ORG.fotorapida, ownerScope: fotorapida, width: 600, height: 200, tags: ['brand'], svg: logo('FotoRápida', '#E63946', '#FFFFFF') },
  { id: A.logoNorte, name: 'Logo franquicia Norte', category: 'logo', organizationId: ORG.lumina, ownerScope: { level: 'franchise', id: DEMO_IDS.franchise.norte }, width: 600, height: 200, tags: ['franchise'], svg: logo('Lumina Norte', '#0B1B3F', '#FFB020') },
  { id: A.logoHostCafe, name: 'Logo anfitrión Café Aurora', category: 'logo', organizationId: ORG.lumina, ownerScope: { level: 'location', id: DEMO_IDS.location.cafe }, width: 400, height: 400, tags: ['host'], svg: logo('Café Aurora', '#6B3E26', '#FFF4E0') },
  { id: A.logoHostUniversity, name: 'Logo anfitrión Universidad del Norte', category: 'logo', organizationId: ORG.lumina, ownerScope: { level: 'location', id: DEMO_IDS.location.university }, width: 400, height: 400, tags: ['host'], svg: logo('U. del Norte', '#1B4332', '#FFFFFF') },
  { id: A.logoSponsorAurora, name: 'Logo patrocinador Chocolates Aurora', category: 'logo', organizationId: ORG.lumina, ownerScope: lumina, width: 600, height: 200, tags: ['sponsor', 'navidad'], campaignId: DEMO_IDS.campaign.christmas2026, svg: logo('Chocolates Aurora', '#5C2A1E', '#F5D7A1') },
  { id: A.bgLumina, name: 'Fondo Lumina', category: 'background', organizationId: ORG.lumina, ownerScope: lumina, width: 1080, height: 1920, tags: ['brand'], svg: gradient('#1E5EFF', '#0B1B3F', false) },
  { id: A.bgConfetti, name: 'Fondo confeti', category: 'background', organizationId: ORG.lumina, ownerScope: lumina, width: 1080, height: 1920, tags: ['party'], svg: gradient('#FFB020', '#E63946', true) },
  { id: A.frameChristmas, name: 'Marco navidad', category: 'frame', organizationId: ORG.lumina, ownerScope: lumina, width: 1500, height: 2100, tags: ['navidad'], campaignId: DEMO_IDS.campaign.christmas2026, svg: frame('#B3001B', '#2E7D32', 'Felices fiestas') },
  { id: A.frameBirthday, name: 'Marco cumpleaños', category: 'frame', organizationId: ORG.lumina, ownerScope: lumina, width: 1200, height: 1800, tags: ['birthday'], svg: frame('#FFB020', '#1E5EFF', '¡Feliz cumpleaños!') },
  { id: A.stickerStar, name: 'Sticker estrella', category: 'sticker', organizationId: ORG.lumina, ownerScope: lumina, width: 256, height: 256, tags: ['fun'], svg: star('#FFB020') },
  { id: A.stickerHeart, name: 'Sticker corazón', category: 'sticker', organizationId: ORG.lumina, ownerScope: lumina, width: 256, height: 256, tags: ['fun', 'couple'], svg: heart('#E63946') },
  { id: A.poseSingle, name: 'Silueta una persona', category: 'pose_silhouette', ownerScope: { level: 'platform' }, width: 1080, height: 1920, tags: ['pose'], svg: pose(1, 'Centra tu rostro') },
  { id: A.posePair, name: 'Silueta dos personas', category: 'pose_silhouette', ownerScope: { level: 'platform' }, width: 1080, height: 1920, tags: ['pose'], svg: pose(2, 'Acérquense') },
  { id: A.examplePortrait1, name: 'Ejemplo retrato fondo blanco', category: 'example_photo', ownerScope: { level: 'platform' }, width: 700, height: 900, tags: ['document'], svg: examplePhoto('#FFFFFF', '#8D6E63') },
  { id: A.examplePortrait2, name: 'Ejemplo retrato fondo neutro', category: 'example_photo', ownerScope: { level: 'platform' }, width: 700, height: 900, tags: ['portrait'], svg: examplePhoto('#D9D9D9', '#5D4037') },
  { id: A.promoChristmas, name: 'Pantalla promocional navidad', category: 'promo_screen', organizationId: ORG.lumina, ownerScope: lumina, width: 1080, height: 1920, tags: ['navidad'], locales: ['es'], campaignId: DEMO_IDS.campaign.christmas2026, svg: promo('Retrato navideño', 'Con Chocolates Aurora', '#B3001B', '#2E7D32') },
  { id: A.promoDocuments, name: 'Pantalla promocional documentos', category: 'promo_screen', organizationId: ORG.lumina, ownerScope: lumina, width: 1080, height: 1920, tags: ['documents'], locales: ['es', 'en'], svg: promo('Foto para trámites', 'Lista en 2 minutos', '#0B1B3F', '#1E5EFF') },
  { id: A.iconCamera, name: 'Icono cámara', category: 'icon', ownerScope: { level: 'platform' }, width: 128, height: 128, tags: ['ui'], svg: iconCamera },
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
      ...audit(DEMO_IDS.user.adminLumina),
    });
  });
}
