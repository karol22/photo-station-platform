import type { CatalogEntry } from '@psp/contracts';
import { EDIT_OPS, EDIT_OP_KEYS } from './edit-ops';
import type { EditOpKey } from './edit-ops';

const PACKAGE = '@psp/imaging';

const OP_NAMES: Record<EditOpKey, { name: string; description: string }> = {
  crop: { name: 'Recorte', description: 'Recorta un rect en píxeles de la foto.' },
  rotate: { name: 'Rotación', description: 'Gira 90, 180 o 270 grados.' },
  levelRotation: { name: 'Nivelación', description: 'Gira hasta ±15 grados con relleno de fondo para nivelar.' },
  mirror: { name: 'Espejo', description: 'Espejo horizontal.' },
  brightness: { name: 'Brillo', description: 'Suma brillo uniforme (−1..1).' },
  contrast: { name: 'Contraste', description: 'Contraste alrededor del gris medio (−1..1).' },
  exposure: { name: 'Exposición', description: 'Exposición en pasos fotográficos (−2..2).' },
  saturation: { name: 'Saturación', description: 'Saturación como mezcla con la luma (−1..1).' },
  temperature: { name: 'Temperatura', description: 'Balance cálido/frío desplazando rojo y azul (−1..1).' },
  grayscale: { name: 'Blanco y negro', description: 'Escala de grises con luma Rec.709.' },
  sharpen: { name: 'Nitidez', description: 'Máscara de desenfoque moderada (0..1).' },
  vignette: { name: 'Viñeta', description: 'Oscurece radialmente hacia las esquinas (0..1).' },
  preset: { name: 'Preset', description: 'Aplica un preset de edición configurado (se expande a ops concretas).' },
  backgroundAdjust: { name: 'Ajuste de fondo', description: 'Aclara sólo fuera de una elipse central; aproximación local sin segmentación.' },
  frame: { name: 'Marco', description: 'Compone un activo de marco sobre toda la foto.' },
  sticker: { name: 'Sticker', description: 'Compone un activo en una posición y tamaño.' },
  text: { name: 'Texto', description: 'Dibuja texto (fuente bitmap en Node; fuentes reales en el navegador).' },
  overlay: { name: 'Overlay', description: 'Compone un activo con opacidad sobre la foto.' },
};

/** Capacidades registrables del paquete: el paquete y cada operación de edición. */
export const CATALOG: CatalogEntry[] = [
  {
    kind: 'package',
    key: 'imaging',
    name: PACKAGE,
    description: 'Operaciones de píxel puras, pipeline de edición, composición de plantillas, hoja documental y codec PNG.',
    package: PACKAGE,
    status: 'stable',
    docs: 'packages/imaging/README.md',
  },
  {
    kind: 'capability',
    key: 'qr',
    name: 'Códigos QR',
    description: 'Codificador QR propio (ISO/IEC 18004): modos numérico, alfanumérico y byte UTF-8, versiones 1 a 20, niveles L/M/Q/H y elección automática de máscara. Los renderizadores pintan la matriz real con zona de silencio de 4 módulos.',
    package: PACKAGE,
    status: 'stable',
    docs: 'packages/imaging/README.md',
  },
  ...EDIT_OP_KEYS.map((key): CatalogEntry => {
    const spec = EDIT_OPS[key];
    const meta = OP_NAMES[key];
    return {
      kind: 'editingOp',
      key,
      name: meta.name,
      description: `${meta.description} Herramienta: ${spec.tool}. ${spec.documentSafe ? 'Apta para documentos.' : 'Sólo creativa.'}`,
      package: PACKAGE,
      status: 'stable',
      docs: 'packages/imaging/README.md',
    };
  }),
];
