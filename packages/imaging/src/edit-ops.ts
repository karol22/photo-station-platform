/**
 * Pipeline de edición: la lista cerrada de operaciones (`EDIT_OPS`), su validación contra las herramientas
 * permitidas por el producto y su aplicación en orden sobre un Raster.
 */
import { DOCUMENT_SAFE_TOOLS } from '@psp/contracts';
import type { EditOp, EditingPreset, EditingTool, Id, JsonValue } from '@psp/contracts';
import { drawText } from './font';
import { FONT_GLYPH_HEIGHT } from './font';
import { brightness, contrast, exposure, grayscale, saturation, temperature } from './ops/adjust';
import { blend } from './ops/composite';
import { duotone } from './ops/duotone';
import { backgroundLighten, sharpen, vignette } from './ops/filters';
import { crop, mirrorH, resize, rotate90, rotateSmall } from './ops/geometry';
import { blurBackground, colorBackground, cutoutPerson, replaceBackground } from './background';
import { smoothSkin } from './retouch';
import type { Mask } from './mask';
import { WHITE, cloneRaster } from './raster';
import type { Raster } from './raster';

export type EditOpKey =
  | 'crop'
  | 'rotate'
  | 'levelRotation'
  | 'mirror'
  | 'brightness'
  | 'contrast'
  | 'exposure'
  | 'saturation'
  | 'temperature'
  | 'grayscale'
  | 'sharpen'
  | 'vignette'
  | 'preset'
  | 'backgroundAdjust'
  | 'backgroundColor'
  | 'backgroundBlur'
  | 'backgroundReplace'
  | 'cutout'
  | 'duotone'
  | 'smoothSkin'
  | 'frame'
  | 'sticker'
  | 'text'
  | 'overlay';

/** Especificación de un parámetro. Es obligatorio salvo que tenga `default` o `optional`. */
export type ParamSpec = {
  kind: 'number' | 'integer' | 'string';
  min?: number;
  max?: number;
  default?: unknown;
  allowed?: readonly (number | string)[];
  /** Sin valor por defecto estático (depende del raster o del activo) pero no obligatorio. */
  optional?: boolean;
};

export type EditOpSpec = {
  tool: EditingTool;
  /** Derivado de `DOCUMENT_SAFE_TOOLS` de contracts: nunca se declara a mano. */
  documentSafe: boolean;
  params: Record<string, ParamSpec>;
};

const number = (min: number, max: number, def?: number): ParamSpec => (def === undefined ? { kind: 'number', min, max } : { kind: 'number', min, max, default: def });
const integer = (min: number, def?: number): ParamSpec => (def === undefined ? { kind: 'integer', min } : { kind: 'integer', min, default: def });
const optionalInteger = (min: number): ParamSpec => ({ kind: 'integer', min, optional: true });
const string = (def?: string): ParamSpec => (def === undefined ? { kind: 'string' } : { kind: 'string', default: def });

const overlayParams = (): Record<string, ParamSpec> => ({
  assetId: string(),
  x: integer(-1_000_000, 0),
  y: integer(-1_000_000, 0),
  w: optionalInteger(1),
  h: optionalInteger(1),
  opacity: number(0, 1, 1),
});

function spec(tool: EditingTool, params: Record<string, ParamSpec>): EditOpSpec {
  return { tool, documentSafe: DOCUMENT_SAFE_TOOLS.includes(tool), params };
}

/**
 * Lista cerrada de operaciones. Cada clave mapea a una `EditingTool` de contracts; `documentSafe` viene de
 * `DOCUMENT_SAFE_TOOLS`. Los rangos son los que `validateEditOps` exige y `applyEditOps` recorta.
 */
export const EDIT_OPS: Record<EditOpKey, EditOpSpec> = {
  crop: spec('crop', { x: integer(0), y: integer(0), w: integer(1), h: integer(1) }),
  rotate: spec('rotate', { degrees: { kind: 'integer', allowed: [90, 180, 270], default: 90 } }),
  levelRotation: spec('levelRotation', { degrees: number(-15, 15, 0) }),
  mirror: spec('mirror', {}),
  brightness: spec('brightness', { amount: number(-1, 1, 0) }),
  contrast: spec('contrast', { amount: number(-1, 1, 0) }),
  exposure: spec('exposure', { stops: number(-2, 2, 0) }),
  saturation: spec('saturation', { amount: number(-1, 1, 0) }),
  temperature: spec('temperature', { amount: number(-1, 1, 0) }),
  grayscale: spec('grayscale', {}),
  sharpen: spec('sharpen', { amount: number(0, 1, 0.5) }),
  vignette: spec('vignette', { strength: number(0, 1, 0.5) }),
  preset: spec('presets', { presetId: string() }),
  /** Aclara sólo fuera de una elipse central: aproximación local sin segmentación. */
  backgroundAdjust: spec('backgroundAdjust', { lighten: number(0, 1, 0.5) }),
  /**
   * Fondo de color plano con la máscara de recorte. Va por la herramienta `backgroundAdjust`, que sí es
   * segura para documentos, porque un retrato de pasaporte pide exactamente eso: un fondo uniforme.
   */
  backgroundColor: spec('backgroundAdjust', { color: string('#FFFFFF'), feather: { kind: 'integer', min: 0, max: 8, default: 2 }, shrink: number(-0.45, 0.45, 0.08) }),
  /** Desenfoca el fondo y deja a la persona nítida. Creativa: nunca en un documento. */
  backgroundBlur: spec('backgrounds', { radius: { kind: 'integer', min: 0, max: 64, default: 8 }, feather: { kind: 'integer', min: 0, max: 8, default: 2 } }),
  /** Sustituye el fondo por la escena de `assetId`; sin el activo la op se omite. */
  backgroundReplace: spec('backgrounds', { assetId: string(), fit: { kind: 'string', allowed: ['cover', 'contain'], default: 'cover' }, feather: { kind: 'integer', min: 0, max: 8, default: 2 } }),
  /** Deja sólo a la persona, con alfa real fuera de ella. */
  cutout: spec('masks', { feather: { kind: 'integer', min: 0, max: 8, default: 2 }, shrink: number(-0.45, 0.45, 0.08) }),
  /** Virado a dos tonos entre `shadow` y `highlight`. */
  duotone: spec('filterIntensity', { shadow: string('#22304A'), highlight: string('#F2C27B'), amount: number(0, 1, 1) }),
  /** Suavizado de piel que preserva bordes; con máscara en recursos actúa sólo sobre la persona. */
  smoothSkin: spec('filterIntensity', { amount: number(0, 1, 0.5), radius: { kind: 'integer', min: 1, max: 8, default: 2 }, threshold: number(1, 128, 18) }),
  /** Sin x/y/w/h, el marco cubre toda la imagen. */
  frame: spec('frames', overlayParams()),
  /** Sin w/h, el sticker conserva su tamaño natural. */
  sticker: spec('stickers', overlayParams()),
  overlay: spec('overlays', overlayParams()),
  /** Texto con la fuente bitmap interna; `sizePx` se convierte en escala entera (7 px por unidad). */
  text: spec('text', { text: string(), x: integer(-1_000_000, 0), y: integer(-1_000_000, 0), sizePx: integer(1, 24), color: string('#FFFFFF') }),
};

export const EDIT_OP_KEYS = Object.keys(EDIT_OPS) as EditOpKey[];

export function isEditOpKey(key: string): key is EditOpKey {
  return Object.prototype.hasOwnProperty.call(EDIT_OPS, key);
}

export type EditProblem = { index: number; op: EditOp; reason: string };
export type EditValidation = { ok: boolean; rejected: EditOp[]; problems: EditProblem[] };

function isRequired(p: ParamSpec): boolean {
  return p.default === undefined && !p.optional;
}

function checkParam(name: string, p: ParamSpec, value: JsonValue | undefined): string | undefined {
  if (value === undefined) return isRequired(p) ? `missing param "${name}"` : undefined;
  if (p.kind === 'string') {
    if (typeof value !== 'string') return `param "${name}" must be a string`;
    if (p.allowed && !p.allowed.includes(value)) return `param "${name}" must be one of ${p.allowed.join('|')}`;
    return undefined;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) return `param "${name}" must be a number`;
  if (p.kind === 'integer' && !Number.isInteger(value)) return `param "${name}" must be an integer`;
  if (p.allowed && !p.allowed.includes(value)) return `param "${name}" must be one of ${p.allowed.join('|')}`;
  if (p.min !== undefined && value < p.min) return `param "${name}" below ${p.min}`;
  if (p.max !== undefined && value > p.max) return `param "${name}" above ${p.max}`;
  return undefined;
}

/**
 * Valida una lista de ops: clave conocida, herramienta dentro de `allowedTools` y parámetros con tipo y rango.
 * Los parámetros no declarados se ignoran (compatibilidad hacia adelante). Las ops `preset` sólo se validan
 * como tal: expándelas con `expandEditOps` y vuelve a validar el resultado antes de aplicar a un documento.
 */
export function validateEditOps(ops: EditOp[], allowedTools: EditingTool[]): EditValidation {
  const problems: EditProblem[] = [];
  const rejected: EditOp[] = [];
  ops.forEach((op, index) => {
    const before = problems.length;
    if (!isEditOpKey(op.op)) {
      problems.push({ index, op, reason: `unknown op "${op.op}"` });
    } else {
      const s = EDIT_OPS[op.op];
      if (!allowedTools.includes(s.tool)) problems.push({ index, op, reason: `tool "${s.tool}" not allowed` });
      for (const [name, p] of Object.entries(s.params)) {
        const reason = checkParam(name, p, op.params[name]);
        if (reason) problems.push({ index, op, reason });
      }
    }
    if (problems.length > before) rejected.push(op);
  });
  return { ok: rejected.length === 0, rejected, problems };
}

/** Convierte un `EditingPreset` en ops del pipeline (copia superficial de parámetros). */
export function editingPresetToOps(preset: EditingPreset): EditOp[] {
  return preset.ops.map((o) => ({ op: o.op, params: { ...o.params } }));
}

/**
 * Sustituye cada op `preset` por las ops del preset (un solo nivel): un preset ausente se omite y las ops
 * `preset` anidadas dentro de un preset se descartan para evitar ciclos.
 */
export function expandEditOps(ops: EditOp[], presets?: Record<Id, EditingPreset>): EditOp[] {
  const out: EditOp[] = [];
  for (const op of ops) {
    if (op.op !== 'preset') {
      out.push(op);
      continue;
    }
    const id = op.params['presetId'];
    const preset = typeof id === 'string' ? presets?.[id] : undefined;
    if (!preset) continue;
    for (const inner of editingPresetToOps(preset)) if (inner.op !== 'preset') out.push(inner);
  }
  return out;
}

export type EditResources = {
  assets?: Record<Id, Raster>;
  presets?: Record<Id, EditingPreset>;
  /**
   * Máscara de recorte de persona del motor de visión, a cualquier resolución. Las ops de fondo y el
   * recorte la necesitan: sin ella se omiten, igual que un overlay sin su activo.
   */
  mask?: Mask;
};

function numberParam(op: EditOp, key: EditOpKey, name: string): number | undefined {
  const p = EDIT_OPS[key].params[name];
  const raw = op.params[name];
  let value = typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
  if (value === undefined) value = typeof p?.default === 'number' ? p.default : undefined;
  if (value === undefined || !p) return value;
  if (p.allowed && !p.allowed.includes(value)) return typeof p.default === 'number' ? p.default : undefined;
  if (p.min !== undefined && value < p.min) value = p.min;
  if (p.max !== undefined && value > p.max) value = p.max;
  if (p.kind === 'integer') value = Math.round(value);
  return value;
}

function stringParam(op: EditOp, key: EditOpKey, name: string): string | undefined {
  const raw = op.params[name];
  if (typeof raw === 'string') return raw;
  const def = EDIT_OPS[key].params[name]?.default;
  return typeof def === 'string' ? def : undefined;
}

/** Parámetros de calidad de borde comunes a las ops que usan la máscara. */
function edgeOptions(op: EditOp, key: EditOpKey): { feather?: number; shrink?: number } {
  const feather = numberParam(op, key, 'feather');
  const shrink = EDIT_OPS[key].params['shrink'] ? numberParam(op, key, 'shrink') : undefined;
  return { ...(feather === undefined ? {} : { feather }), ...(shrink === undefined ? {} : { shrink }) };
}

function applyOverlay(r: Raster, op: EditOp, key: 'frame' | 'sticker' | 'overlay', resources: EditResources | undefined): Raster {
  const assetId = stringParam(op, key, 'assetId');
  const asset = assetId === undefined ? undefined : resources?.assets?.[assetId];
  if (!asset) return r;
  const x = numberParam(op, key, 'x') ?? 0;
  const y = numberParam(op, key, 'y') ?? 0;
  const explicitW = numberParam(op, key, 'w');
  const explicitH = numberParam(op, key, 'h');
  const w = explicitW ?? (key === 'frame' ? r.width : asset.width);
  const h = explicitH ?? (key === 'frame' ? r.height : asset.height);
  const opacity = numberParam(op, key, 'opacity') ?? 1;
  const scaled = w === asset.width && h === asset.height ? asset : resize(asset, w, h);
  return blend(r, scaled, x, y, opacity);
}

function applyOne(r: Raster, op: EditOp, resources: EditResources | undefined): Raster {
  if (!isEditOpKey(op.op)) throw new Error(`applyEditOps: unknown op "${op.op}"`);
  const key = op.op;
  switch (key) {
    case 'crop': {
      const x = numberParam(op, key, 'x') ?? 0;
      const y = numberParam(op, key, 'y') ?? 0;
      const w = numberParam(op, key, 'w') ?? r.width;
      const h = numberParam(op, key, 'h') ?? r.height;
      return crop(r, { x, y, w, h });
    }
    case 'rotate':
      return rotate90(r, (numberParam(op, key, 'degrees') ?? 90) / 90);
    case 'levelRotation':
      return rotateSmall(r, numberParam(op, key, 'degrees') ?? 0, WHITE);
    case 'mirror':
      return mirrorH(r);
    case 'brightness':
      return brightness(r, numberParam(op, key, 'amount') ?? 0);
    case 'contrast':
      return contrast(r, numberParam(op, key, 'amount') ?? 0);
    case 'exposure':
      return exposure(r, numberParam(op, key, 'stops') ?? 0);
    case 'saturation':
      return saturation(r, numberParam(op, key, 'amount') ?? 0);
    case 'temperature':
      return temperature(r, numberParam(op, key, 'amount') ?? 0);
    case 'grayscale':
      return grayscale(r);
    case 'sharpen':
      return sharpen(r, numberParam(op, key, 'amount') ?? 0);
    case 'vignette':
      return vignette(r, numberParam(op, key, 'strength') ?? 0);
    case 'backgroundAdjust':
      return backgroundLighten(r, numberParam(op, key, 'lighten') ?? 0);
    case 'backgroundColor': {
      const mask = resources?.mask;
      if (!mask) return r;
      return colorBackground(r, mask, stringParam(op, key, 'color') ?? '#FFFFFF', { edge: edgeOptions(op, key) });
    }
    case 'backgroundBlur': {
      const mask = resources?.mask;
      if (!mask) return r;
      return blurBackground(r, mask, { radius: numberParam(op, key, 'radius') ?? 8, edge: edgeOptions(op, key) });
    }
    case 'backgroundReplace': {
      const mask = resources?.mask;
      const assetId = stringParam(op, key, 'assetId');
      const scene = assetId === undefined ? undefined : resources?.assets?.[assetId];
      if (!mask || !scene) return r;
      const fit = stringParam(op, key, 'fit') === 'contain' ? 'contain' : 'cover';
      return replaceBackground(r, mask, scene, { fit, edge: edgeOptions(op, key) });
    }
    case 'cutout': {
      const mask = resources?.mask;
      if (!mask) return r;
      return cutoutPerson(r, mask, { edge: edgeOptions(op, key) });
    }
    case 'duotone':
      return duotone(r, stringParam(op, key, 'shadow') ?? '#22304A', stringParam(op, key, 'highlight') ?? '#F2C27B', numberParam(op, key, 'amount') ?? 1);
    case 'smoothSkin':
      return smoothSkin(r, resources?.mask, numberParam(op, key, 'amount') ?? 0, {
        radius: numberParam(op, key, 'radius') ?? 2,
        threshold: numberParam(op, key, 'threshold') ?? 18,
      });
    case 'preset':
      // Ya expandido por `expandEditOps`; un preset que llega aquí no tiene recursos y se omite.
      return r;
    case 'frame':
    case 'sticker':
    case 'overlay':
      return applyOverlay(r, op, key, resources);
    case 'text': {
      const text = stringParam(op, key, 'text') ?? '';
      if (text.length === 0) return r;
      const sizePx = numberParam(op, key, 'sizePx') ?? 24;
      const scale = Math.max(1, Math.floor(sizePx / FONT_GLYPH_HEIGHT));
      return drawText(r, text, numberParam(op, key, 'x') ?? 0, numberParam(op, key, 'y') ?? 0, scale, stringParam(op, key, 'color') ?? '#FFFFFF');
    }
    default:
      return r;
  }
}

/**
 * Aplica las ops en orden y devuelve un Raster nuevo. Expande presets con `resources.presets`; las ops de
 * marco/sticker/overlay sin su activo en `resources.assets` se omiten (documentado). Los valores fuera de
 * rango se recortan al rango declarado. Una clave desconocida lanza: valida antes con `validateEditOps`.
 */
export function applyEditOps(r: Raster, ops: EditOp[], resources?: EditResources): Raster {
  let current = r;
  for (const op of expandEditOps(ops, resources?.presets)) current = applyOne(current, op, resources);
  return current === r ? cloneRaster(r) : current;
}
