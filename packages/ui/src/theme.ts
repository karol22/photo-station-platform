/**
 * Tema: lee la paleta de branding del bundle (`branding.palette.*`) y la convierte en variables
 * CSS `--psp-*`. Todo es puro salvo `applyBrandingTheme`, que escribe en un `root` (por defecto
 * `document.documentElement`).
 */

export const BRANDING_PALETTE_KEYS = {
  primary: 'branding.palette.primary',
  secondary: 'branding.palette.secondary',
  accent: 'branding.palette.accent',
  background: 'branding.palette.background',
  text: 'branding.palette.text',
} as const;

export type BrandingPaletteKey = keyof typeof BRANDING_PALETTE_KEYS;
export type BrandingPalette = Partial<Record<BrandingPaletteKey, string>>;

/** Paleta por defecto: coincide con los defaults del registro de claves de configuración. */
export const DEFAULT_PALETTE: Required<BrandingPalette> = {
  primary: '#1E5EFF',
  secondary: '#0B1B3F',
  accent: '#FFB020',
  background: '#F6F7FB',
  text: '#0B1B3F',
};

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** Acepta `#rgb`, `#rrggbb` y `#rrggbbaa` (ignora alfa). Devuelve `null` si no es un color. */
export function parseHexColor(input: unknown): Rgb | null {
  if (typeof input !== 'string') return null;
  const hex = input.trim().replace(/^#/, '');
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$|^[0-9a-f]{8}$/i.test(hex)) return null;
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex.slice(0, 6);
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function toHex({ r, g, b }: Rgb): string {
  const part = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** Luminancia relativa según WCAG 2.x (0 = negro, 1 = blanco). */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Relación de contraste WCAG entre dos colores (1..21). */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export interface ContrastOptions {
  /** Candidato claro (texto sobre fondos oscuros). */
  light?: string;
  /** Candidato oscuro (texto sobre fondos claros). */
  dark?: string;
}

const LIGHT = '#FFFFFF';
const DARK = '#111827';

/**
 * Elige el color de texto (claro u oscuro) con mayor contraste sobre `color`.
 * Devuelve el candidato oscuro cuando `color` no es parseable.
 */
export function contrastColor(color: string, options: ContrastOptions = {}): string {
  const light = options.light ?? LIGHT;
  const dark = options.dark ?? DARK;
  const rgb = parseHexColor(color);
  const lightRgb = parseHexColor(light);
  const darkRgb = parseHexColor(dark);
  if (!rgb || !lightRgb || !darkRgb) return dark;
  return contrastRatio(rgb, lightRgb) >= contrastRatio(rgb, darkRgb) ? light : dark;
}

/**
 * Matiz en grados (0–360). Se necesita para repartir papeles entre los acentos de una marca sin
 * saber cuáles son: «el que confirma» es verde-azulado venga de donde venga, y «el que avisa» es
 * ámbar. Un gris devuelve 0, que es inofensivo porque un gris nunca gana ninguno de esos papeles.
 */
export function hueOf(color: string): number {
  const rgb = parseHexColor(color);
  if (!rgb) return 0;
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;
  const hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return (hue * 60 + 360) % 360;
}

/** Mezcla lineal en RGB: `weight` es la proporción de `b` (0 = sólo `a`, 1 = sólo `b`). */
export function mixColors(a: string, b: string, weight: number): string {
  const ca = parseHexColor(a);
  const cb = parseHexColor(b);
  if (!ca || !cb) return a;
  const w = Math.min(1, Math.max(0, weight));
  return toHex({
    r: ca.r + (cb.r - ca.r) * w,
    g: ca.g + (cb.g - ca.g) * w,
    b: ca.b + (cb.b - ca.b) * w,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Extrae la paleta de un mapa de valores efectivos. Acepta claves planas
 * (`'branding.palette.primary'`) y anidadas (`{ branding: { palette: { primary } } }`).
 * Ignora valores que no sean colores hexadecimales.
 */
export function readBrandingPalette(values: Record<string, unknown>): BrandingPalette {
  const nested = isRecord(values.branding) && isRecord(values.branding.palette) ? values.branding.palette : undefined;
  const palette: BrandingPalette = {};
  for (const key of Object.keys(BRANDING_PALETTE_KEYS) as BrandingPaletteKey[]) {
    const flat = values[BRANDING_PALETTE_KEYS[key]];
    const candidate = flat ?? nested?.[key];
    if (parseHexColor(candidate)) palette[key] = (candidate as string).trim();
  }
  return palette;
}

/** Colores de acento de reserva cuando la marca no declara los suyos. */
export const DEFAULT_ACCENTS = ['#FF6FA5', '#FF7A3C', '#FFC24A', '#5FCB92', '#4C86E8', '#A87BE8'] as const;

/**
 * Lee `branding.palette.accents`: los colores vivos con los que la marca viste sus elementos
 * ilustrados. Se completan hasta seis repitiendo la lista, así una marca puede declarar dos o tres.
 */
export function readBrandingAccents(values: Record<string, unknown>): string[] {
  const nested = isRecord(values.branding) && isRecord(values.branding.palette) ? values.branding.palette : undefined;
  const raw = values['branding.palette.accents'] ?? nested?.['accents'];
  const list = Array.isArray(raw) ? raw.filter((c): c is string => typeof c === 'string' && parseHexColor(c) !== null) : [];
  const source = list.length > 0 ? list : [...DEFAULT_ACCENTS];
  return Array.from({ length: 6 }, (_unused, i) => source[i % source.length]!.trim());
}

export interface AccentRoles {
  /** El más luminoso: la luz, el halo, el refugio del texto sobre campos oscuros. */
  luz: string;
  /** Verde-azulado si lo hay: lo que salió bien. */
  confirma: string;
  /** Ámbar si lo hay: lo que pide atención sin ser un error. */
  avisa: string;
  /** Los acentos ordenados por matiz: el orden en que la sesión cambia de habitación. */
  etapas: string[];
}

/**
 * Reparte papeles entre los acentos de la marca.
 *
 * Escribir «el cuarto acento confirma el pago» es cierto de una paleta concreta y falso de la
 * plataforma: la siguiente marca trae otros seis colores en otro orden y la pantalla queda
 * diciendo que el pago salió bien en morado. Aquí el papel se deduce del color —el más luminoso
 * es la luz, el verde-azulado confirma, el ámbar avisa— y si la paleta no trae ese matiz, se cae
 * a la luminancia, que siempre existe.
 *
 * Es pura y determinista: la misma paleta reparte siempre los mismos papeles.
 */
export function assignAccentRoles(accents: readonly string[]): AccentRoles {
  const list = accents.filter((c) => parseHexColor(c) !== null);
  if (list.length === 0) return { luz: DEFAULT_PALETTE.accent, confirma: DEFAULT_PALETTE.accent, avisa: DEFAULT_PALETTE.accent, etapas: [DEFAULT_PALETTE.accent] };
  const byLuminance = [...list].sort((a, b) => relativeLuminance(parseHexColor(b)!) - relativeLuminance(parseHexColor(a)!));
  const inRange = (color: string, from: number, to: number) => {
    const hue = hueOf(color);
    return hue >= from && hue <= to;
  };
  const luz = byLuminance[0]!;
  const confirma = byLuminance.find((c) => inRange(c, 90, 170)) ?? byLuminance[1] ?? luz;
  const avisa = byLuminance.find((c) => inRange(c, 15, 55)) ?? byLuminance[2] ?? luz;
  const etapas = [...list].sort((a, b) => hueOf(a) - hueOf(b));
  return { luz, confirma, avisa, etapas };
}

/** Destino mínimo de `applyBrandingTheme`: cualquier objeto con `style.setProperty`. */
export interface ThemeRoot {
  style: { setProperty(name: string, value: string): void };
  classList?: { add(...names: string[]): void; remove(...names: string[]): void };
}

/** Completa la paleta con los defaults. */
export function resolvePalette(palette: BrandingPalette): Required<BrandingPalette> {
  return { ...DEFAULT_PALETTE, ...palette };
}

/**
 * Calcula todas las variables CSS derivadas de una paleta: colores base, contraste por
 * luminancia, superficies, texto atenuado y bordes coherentes con el fondo.
 */
export function buildThemeVariables(palette: BrandingPalette): Record<string, string> {
  const p = resolvePalette(palette);
  const bgIsDark = relativeLuminance(parseHexColor(p.background) ?? { r: 255, g: 255, b: 255 }) < 0.4;
  // La superficie se deriva del fondo que declaró la marca, no se fuerza a blanco puro. Forzarla
  // era el origen del aspecto rechazado: la plataforma repartía rectángulos blancos sobre el
  // crema que la marca había elegido, que es exactamente el aspecto de un panel de administración.
  const surface = bgIsDark ? mixColors(p.background, LIGHT, 0.1) : mixColors(p.background, LIGHT, 0.55);
  const muted = mixColors(p.text, p.background, 0.42);
  const border = mixColors(p.text, p.background, 0.82);
  const borderStrong = mixColors(p.text, p.background, 0.6);
  return {
    '--psp-color-primary': p.primary,
    '--psp-color-primary-contrast': contrastColor(p.primary),
    '--psp-color-primary-soft': mixColors(p.primary, p.background, 0.86),
    '--psp-color-secondary': p.secondary,
    '--psp-color-secondary-contrast': contrastColor(p.secondary),
    '--psp-color-secondary-soft': mixColors(p.secondary, p.background, 0.86),
    '--psp-color-accent': p.accent,
    '--psp-color-accent-contrast': contrastColor(p.accent),
    '--psp-color-accent-soft': mixColors(p.accent, p.background, 0.8),
    '--psp-color-bg': p.background,
    '--psp-color-bg-contrast': contrastColor(p.background),
    '--psp-color-surface': surface,
    '--psp-color-surface-contrast': contrastColor(surface),
    '--psp-color-text': p.text,
    '--psp-color-text-contrast': contrastColor(p.text),
    '--psp-color-muted': muted,
    '--psp-color-muted-contrast': contrastColor(muted),
    '--psp-color-border': border,
    '--psp-color-border-strong': borderStrong,
  };
}

function defaultRoot(): ThemeRoot | null {
  const doc = (globalThis as { document?: { documentElement?: ThemeRoot } }).document;
  return doc?.documentElement ?? null;
}

/**
 * Lee `branding.palette.*` de `values`, calcula las variables y las fija en `root`
 * (por defecto `document.documentElement`). Devuelve las variables aplicadas; sin `root`
 * disponible sólo las calcula.
 */
export function applyBrandingTheme(
  values: Record<string, unknown>,
  root?: ThemeRoot | null,
): Record<string, string> {
  const variables = buildThemeVariables(readBrandingPalette(values));
  const accents = readBrandingAccents(values);
  accents.forEach((color, i) => {
    variables[`--psp-color-accent-${i + 1}`] = color;
  });

  // Papeles por color, no por posición: ninguna pantalla escribe `accent-4`.
  const roles = assignAccentRoles(accents);
  variables['--psp-role-luz'] = roles.luz;
  variables['--psp-role-confirma'] = roles.confirma;
  variables['--psp-role-avisa'] = roles.avisa;

  // Los tres tokens de luz. El campo lo fija cada pantalla; aro y rincón se derivan de él, así que
  // una pantalla que cambie `--psp-field` arrastra su luz y su profundidad sin declararlas.
  const palette = resolvePalette(readBrandingPalette(values));
  variables['--psp-field'] = accents[0] ?? palette.primary;
  variables['--psp-aro'] = mixColors(variables['--psp-field']!, LIGHT, 0.62);
  variables['--psp-rincon'] = mixColors(variables['--psp-field']!, palette.text, 0.28);
  // Relieve sin difuminar: la gráfica de un puesto de feria se separa con un desplazamiento duro,
  // no con una sombra suave, que es el gesto que delata a un panel de administración.
  variables['--psp-lift'] = `10px 10px 0 ${variables['--psp-rincon']}`;
  variables['--psp-flash'] = LIGHT;
  variables['--psp-qr-paper'] = LIGHT;
  const target = root === undefined ? defaultRoot() : root;
  if (target) {
    for (const [name, value] of Object.entries(variables)) target.style.setProperty(name, value);
  }
  return variables;
}
