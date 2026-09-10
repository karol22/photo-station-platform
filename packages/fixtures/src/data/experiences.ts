/** Experiencias de entretenimiento (secuencias de poses) y presets visuales de edición. */
import { EditingPreset, Experience, type PoseStep } from '@psp/contracts';
import { DEMO_IDS } from '../ids';
import { L, audit } from './common';

const ID = DEMO_IDS;
const A = ID.asset;

function pose(key: string, name: [string, string], instruction: [string, string], people: number): PoseStep {
  return {
    key, name: L(name[0], name[1]), instruction: L(instruction[0], instruction[1]),
    exampleAssetId: people === 1 ? A.examplePortrait2 : undefined,
    silhouetteAssetId: people === 1 ? A.poseSingle : A.posePair,
    countdownSec: 3,
    guidance: { expectedPeople: people, zone: { x: 0.1, y: 0.1, w: 0.8, h: 0.8 }, maxTiltDeg: 15, minFaceRatio: 0.12, headroomRatio: 0.08 },
  };
}

export function buildExperiences(): Experience[] {
  return [
    Experience.parse({
      id: ID.experience.bestFriends, organizationId: ID.org.unaDeTodos, key: 'best_friends', name: L('Mejores amigos', 'Best friends'), theme: 'best_friends',
      description: L('Cuatro poses para una tira clásica.', 'Four poses for a classic strip.'),
      // Seis poses para cuatro huecos: se dispara de más a propósito. Elegir cuáles se quedan es
      // el momento que la gente disfruta, y tener dos de sobra es la red que evita repetir tomas.
      poses: [pose('smile', ['Sonrisa', 'Smile'], ['Sonrían a la cámara.', 'Smile at the camera.'], 2), pose('silly', ['Cara chistosa', 'Silly face'], ['Hagan su cara más ridícula.', 'Make your silliest face.'], 2), pose('hug', ['Abrazo', 'Hug'], ['Un abrazo bien apretado.', 'A big tight hug.'], 2), pose('peace', ['Paz', 'Peace'], ['Señal de paz y guiño.', 'Peace sign and a wink.'], 2), pose('jump', ['Salto', 'Jump'], ['Salten al mismo tiempo.', 'Jump at the same time.'], 2), pose('close', ['Bien juntos', 'Close in'], ['Acérquense mucho a la cámara.', 'Get right up to the camera.'], 2)],
      selection: { min: 4, max: 4, allowReorder: true, allowCompare: true },
      stickerAssetIds: [A.stickerStar, A.stickerHeart, A.blobIdea, A.blobBoost, A.blobCompa, A.blobChispa], editingPresetIds: [ID.editingPreset.vivid, ID.editingPreset.retro, ID.editingPreset.bwSoft], templateId: ID.template.strip2x6, status: 'active', ...audit(ID.user.adminUnaDeTodos),
    }),
    Experience.parse({
      id: ID.experience.couple, key: 'couple', name: L('Pareja', 'Couple'), theme: 'couple',
      description: L('Tres poses en pareja.', 'Three couple poses.'),
      poses: [pose('look', ['Mírense', 'Look at each other'], ['Mírense a los ojos.', 'Look into each other\'s eyes.'], 2), pose('kiss', ['Beso', 'Kiss'], ['Un beso en la mejilla.', 'A kiss on the cheek.'], 2), pose('laugh', ['Risa', 'Laugh'], ['Rían con ganas.', 'Laugh out loud.'], 2)],
      selection: { min: 3, max: 3, allowReorder: true, allowCompare: true },
      stickerAssetIds: [A.stickerHeart, A.blobIdea, A.blobTranqui], editingPresetIds: [ID.editingPreset.vivid, ID.editingPreset.bwSoft], templateId: ID.template.strip2x6, status: 'active', ...audit(ID.user.owner),
    }),
    Experience.parse({
      id: ID.experience.birthday, organizationId: ID.org.unaDeTodos, key: 'birthday', name: L('Cumpleaños', 'Birthday'), theme: 'birthday',
      description: L('Tres poses con marco de cumpleaños en cuadrícula.', 'Three poses with a birthday frame on a grid.'),
      poses: [pose('cake', ['Pastel', 'Cake'], ['Sopla las velas imaginarias.', 'Blow out the imaginary candles.'], 1), pose('party', ['Fiesta', 'Party'], ['Brazos arriba.', 'Arms up.'], 1), pose('group', ['Grupo', 'Group'], ['Todos juntos.', 'Everyone together.'], 2)],
      selection: { min: 3, max: 3, allowReorder: true, allowCompare: true },
      frameAssetIds: [A.frameBirthday], stickerAssetIds: [A.stickerStar, A.blobBoost, A.blobCuriosa], overlayAssetIds: [A.bgConfetti], editingPresetIds: [ID.editingPreset.vivid], templateId: ID.template.grid4x6, status: 'active', ...audit(ID.user.adminUnaDeTodos),
    }),
    Experience.parse({
      id: ID.experience.christmas, organizationId: ID.org.unaDeTodos, key: 'christmas', name: L('Navidad', 'Christmas'), theme: 'christmas',
      description: L('Tres poses con marco navideño de la campaña.', 'Three poses with the campaign Christmas frame.'),
      poses: [pose('gift', ['Regalo', 'Gift'], ['Como si abrieras un regalo.', 'As if opening a gift.'], 1), pose('cheers', ['Brindis', 'Cheers'], ['Brindis con la mirada.', 'Toast with your eyes.'], 2), pose('hohoho', ['Jo jo jo', 'Ho ho ho'], ['Risa de Santa.', 'Santa laugh.'], 1)],
      selection: { min: 1, max: 1, allowReorder: false, allowCompare: true },
      frameAssetIds: [A.frameChristmas], editingPresetIds: [ID.editingPreset.vivid], templateId: ID.template.postcard5x7, campaignId: ID.campaign.christmas2026,
      season: { start: '2026-12-01T06:00:00Z', end: '2027-01-06T06:00:00Z' }, status: 'active', ...audit(ID.user.adminUnaDeTodos),
    }),
  ];
}

/** Ops con claves de `EDIT_OPS` de @psp/imaging y parámetros numéricos dentro de sus rangos. */
export function buildEditingPresets(): EditingPreset[] {
  return [
    EditingPreset.parse({ id: ID.editingPreset.vivid, organizationId: ID.org.unaDeTodos, key: 'vivid', name: L('Vívido', 'Vivid'), ops: [{ op: 'saturation', params: { amount: 0.3 } }, { op: 'contrast', params: { amount: 0.15 } }], documentSafe: false, tags: ['color'], ...audit(ID.user.adminUnaDeTodos) }),
    EditingPreset.parse({ id: ID.editingPreset.retro, organizationId: ID.org.unaDeTodos, key: 'retro', name: L('Retro', 'Retro'), ops: [{ op: 'temperature', params: { amount: 0.3 } }, { op: 'saturation', params: { amount: -0.2 } }, { op: 'vignette', params: { strength: 0.4 } }], documentSafe: false, tags: ['film'], ...audit(ID.user.adminUnaDeTodos) }),
    EditingPreset.parse({ id: ID.editingPreset.bwSoft, organizationId: ID.org.unaDeTodos, key: 'bw_soft', name: L('Blanco y negro suave', 'Soft black & white'), ops: [{ op: 'grayscale', params: {} }, { op: 'contrast', params: { amount: -0.1 } }, { op: 'brightness', params: { amount: 0.05 } }], documentSafe: false, tags: ['bw'], ...audit(ID.user.adminUnaDeTodos) }),
    EditingPreset.parse({ id: ID.editingPreset.docNeutral, key: 'doc_neutral', name: L('Documento neutro', 'Neutral document'), ops: [{ op: 'brightness', params: { amount: 0.05 } }, { op: 'contrast', params: { amount: 0.05 } }], documentSafe: true, tags: ['document'], ...audit(ID.user.owner) }),
  ];
}
