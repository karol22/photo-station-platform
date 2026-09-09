/**
 * Catálogo comercial: productos, disponibilidad por alcance, reglas de precio y promociones.
 * La tira social (`prd_tira_amigos`) es el producto insignia de Una de Todos y encabeza el orden;
 * los documentales siguen presentes porque una máquina puede ofrecer los dos recorridos.
 * Ningún producto de la marca conserva imágenes: todos apuntan a `ret_delete_on_finish`.
 */
import { DOCUMENT_SAFE_TOOLS, PriceRule, Product, ProductAvailability, Promotion, type EditingPolicy, type Money } from '@psp/contracts';
import { DEMO_IDS } from '../ids';
import { L, UPDATED_AT, audit, cop, mxn } from './common';
import { PRESET_DEFAULT_COPIES } from './presets';

const ID = DEMO_IDS;
const P = ID.product;
const T = ID.template;

const docEditing: EditingPolicy = { enabled: true, allowedTools: DOCUMENT_SAFE_TOOLS, allowedPresetIds: [ID.editingPreset.docNeutral] };
const creativeEditing: EditingPolicy = {
  enabled: true,
  allowedTools: ['crop', 'brightness', 'contrast', 'saturation', 'temperature', 'grayscale', 'vignette', 'presets', 'frames', 'stickers', 'text', 'date', 'locationName'],
  allowedPresetIds: [ID.editingPreset.vivid, ID.editingPreset.retro, ID.editingPreset.bwSoft],
};
const portraitEditing: EditingPolicy = {
  enabled: true,
  allowedTools: ['crop', 'levelRotation', 'brightness', 'contrast', 'exposure', 'temperature', 'grayscale', 'sharpen', 'presets'],
  allowedPresetIds: [ID.editingPreset.vivid, ID.editingPreset.bwSoft],
};
const noEditing: EditingPolicy = { enabled: false, allowedTools: [], allowedPresetIds: [] };

/** Producto documental: una hoja con `defaultCopies` del preset; sólo herramientas seguras. */
function documentProduct(over: { id: string; organizationId?: string; internalName: string; name: [string, string]; description: [string, string]; presetId: string; templateId: string; paper: '4x6in' | '5x7in'; price: Money; category?: 'documents' | 'graduation'; priority: number; tags: string[] }): Product {
  const copies = PRESET_DEFAULT_COPIES[over.presetId] ?? 1;
  return Product.parse({
    id: over.id,
    organizationId: over.organizationId ?? ID.org.unaDeTodos,
    internalName: over.internalName,
    displayName: L(over.name[0], over.name[1]),
    category: over.category ?? 'documents',
    kind: 'document',
    description: L(over.description[0], over.description[1]),
    whatYouGet: L(`Una hoja ${over.paper === '4x6in' ? '4x6' : '5x7'} con tus fotos listas para recortar.`, `One ${over.paper === '4x6in' ? '4x6' : '5x7'} sheet with your photos ready to cut.`),
    coverAssetId: ID.asset.examplePortrait1,
    estimatedDurationSec: 150,
    captureCount: 1,
    printCount: copies,
    output: { templateId: over.templateId, paperSize: over.paper, copies, printerType: 'photo' },
    presetId: over.presetId,
    editing: docEditing,
    retakes: { max: 3, perPhoto: true, wholeSession: false, keepPreviousForCompare: true },
    autoCapture: true,
    manualCapture: true,
    basePrice: over.price,
    taxInfo: { ratePct: over.price.currency === 'MXN' ? 16 : 19, included: true, label: over.price.currency === 'MXN' ? 'IVA incluido' : 'IVA incluido' },
    instructions: L('Mira de frente, sin sonreír y con el rostro despejado.', 'Look straight ahead, no smile, face uncovered.'),
    privacyNote: L('Tu foto se borra de la máquina al terminar la sesión; no se guarda ninguna copia.', 'Your photo is deleted from the machine when the session ends; no copy is kept.'),
    hardwareRequirements: ['camera.primary', 'printer.photo'],
    requiredFeatures: ['documents.mode', 'printing.photo'],
    retentionPolicyId: ID.retention.deleteOnFinish,
    status: 'active',
    priority: over.priority,
    tags: over.tags,
    ...audit(ID.user.adminUnaDeTodos),
  });
}

export function buildProducts(): Product[] {
  return [
    documentProduct({ id: P.docUniversity, internalName: 'doc-universitaria', name: ['Foto universitaria', 'University ID photo'], description: ['Fotografía infantil/adulto para credencial y trámites universitarios en México.', 'Photo for university credentials and paperwork in Mexico.'], presetId: ID.preset.mxUniversity, templateId: T.sheet4x6, paper: '4x6in', price: mxn(8000), priority: 60, tags: ['documentos', 'universidad'] }),
    documentProduct({ id: P.docGraduation, internalName: 'doc-graduacion', name: ['Foto de graduación', 'Graduation photo'], description: ['Retrato formal tamaño diploma para ceremonias de graduación.', 'Formal diploma-size portrait for graduation ceremonies.'], presetId: ID.preset.mxGraduation, templateId: T.sheet5x7, paper: '5x7in', price: mxn(9000), category: 'graduation', priority: 70, tags: ['documentos', 'graduacion'] }),
    documentProduct({ id: P.docChild, internalName: 'doc-infantil', name: ['Foto infantil', 'Child ID photo'], description: ['Fotografía tamaño infantil con fondo neutro para trámites escolares.', 'Child-size photo with neutral background for school paperwork.'], presetId: ID.preset.mxChild, templateId: T.sheet4x6, paper: '4x6in', price: mxn(7000), priority: 80, tags: ['documentos', 'infantil'] }),
    documentProduct({ id: P.docVisaUsa, internalName: 'doc-visa-usa', name: ['Foto visa EE. UU. (2x2 in)', 'US visa photo (2x2 in)'], description: ['Fotografía 2x2 pulgadas con fondo blanco, sin lentes y sin sonreír.', '2x2 inch photo on white background, no glasses, no smile.'], presetId: ID.preset.usVisa, templateId: T.sheet4x6Visa, paper: '4x6in', price: mxn(12000), priority: 90, tags: ['documentos', 'visa'] }),
    Product.parse({
      id: P.portraitPro, organizationId: ID.org.unaDeTodos, internalName: 'retrato-pro', displayName: L('Retrato profesional', 'Professional portrait'), category: 'professional_portrait', kind: 'portrait',
      description: L('Retrato con iluminación frontal para perfil laboral o redes.', 'Front-lit portrait for work profiles or social media.'), whatYouGet: L('Una impresión 4x6 con logo discreto.', 'One 4x6 print with a discreet logo.'),
      coverAssetId: ID.asset.examplePortrait2, estimatedDurationSec: 180, captureCount: 1, printCount: 1,
      output: { templateId: T.single4x6, paperSize: '4x6in', copies: 1, printerType: 'photo' },
      editing: portraitEditing, retakes: { max: 3 }, autoCapture: false, manualCapture: true, basePrice: mxn(15000), taxInfo: { ratePct: 16, included: true, label: 'IVA incluido' },
      hardwareRequirements: ['camera.primary', 'printer.photo', 'lighting.controllable'], requiredFeatures: ['printing.photo', 'editing.local'], retentionPolicyId: ID.retention.deleteOnFinish, status: 'active', priority: 20, tags: ['retrato'], ...audit(ID.user.adminUnaDeTodos),
    }),
    Product.parse({
      id: P.friendsStrip, organizationId: ID.org.unaDeTodos, internalName: 'tira-amigos', displayName: L('Tira de amigos', 'Friends strip'), category: 'fun', kind: 'entertainment',
      description: L('Cuatro poses guiadas en una tira clásica 2x6.', 'Four guided poses on a classic 2x6 strip.'), whatYouGet: L('Dos tiras 2x6 con fecha y logo.', 'Two 2x6 strips with date and logo.'),
      coverAssetId: ID.asset.attractFamily, estimatedDurationSec: 240, captureCount: 4, printCount: 2,
      output: { templateId: T.strip2x6, paperSize: '2x6in-strip', copies: 2, printerType: 'photo' },
      experienceId: ID.experience.bestFriends, editing: creativeEditing, retakes: { max: 2 }, autoCapture: false, manualCapture: true, basePrice: mxn(10000), taxInfo: { ratePct: 16, included: true, label: 'IVA incluido' },
      hardwareRequirements: ['camera.primary', 'printer.photo'], requiredFeatures: ['entertainment.mode', 'editing.creative', 'printing.photo'], retentionPolicyId: ID.retention.deleteOnFinish, status: 'active', priority: 10, tags: ['diversion', 'tira', 'insignia'], ...audit(ID.user.adminUnaDeTodos),
    }),
    Product.parse({
      id: P.receiptPhoto, organizationId: ID.org.unaDeTodos, internalName: 'foto-recibo', displayName: L('Foto recibo', 'Receipt photo'), category: 'receipt_photo', kind: 'entertainment',
      description: L('Foto en blanco y negro impresa en papel térmico, estilo ticket.', 'Black-and-white photo printed on thermal paper, ticket style.'), whatYouGet: L('Un ticket 58 mm con tu foto y código de sesión.', 'One 58 mm ticket with your photo and session code.'),
      coverAssetId: ID.asset.iconCamera, estimatedDurationSec: 90, captureCount: 1, printCount: 1,
      output: { templateId: T.thermal58, paperSize: '58mm-thermal', copies: 1, printerType: 'thermal' },
      editing: noEditing, retakes: { max: 1 }, autoCapture: false, manualCapture: true, basePrice: mxn(3000), taxInfo: { ratePct: 16, included: true, label: 'IVA incluido' },
      hardwareRequirements: ['camera.primary', 'printer.thermal'], requiredFeatures: ['printing.thermal', 'entertainment.mode'], retentionPolicyId: ID.retention.deleteOnFinish, status: 'active', priority: 50, tags: ['termica', 'cafeteria'], ...audit(ID.user.adminUnaDeTodos),
    }),
    Product.parse({
      id: P.christmasPortrait, organizationId: ID.org.unaDeTodos, internalName: 'retrato-navidad', displayName: L('Retrato navideño', 'Christmas portrait'), category: 'themed_portrait', kind: 'entertainment',
      description: L('Tres poses con marco navideño; postal 5x7 patrocinada.', 'Three poses with a Christmas frame; sponsored 5x7 postcard.'), whatYouGet: L('Una postal 5x7 con marco y logo del patrocinador.', 'One 5x7 postcard with frame and sponsor logo.'),
      coverAssetId: ID.asset.promoChristmas, estimatedDurationSec: 200, captureCount: 3, printCount: 1,
      output: { templateId: T.postcard5x7, paperSize: '5x7in', copies: 1, printerType: 'photo' },
      experienceId: ID.experience.christmas, editing: creativeEditing, retakes: { max: 2 }, autoCapture: false, manualCapture: true, basePrice: mxn(12000), taxInfo: { ratePct: 16, included: true, label: 'IVA incluido' },
      hardwareRequirements: ['camera.primary', 'printer.photo'], requiredFeatures: ['entertainment.mode', 'campaigns', 'printing.photo'], startsAt: '2026-12-01T06:00:00Z', endsAt: '2027-01-06T06:00:00Z', retentionPolicyId: ID.retention.deleteOnFinish, status: 'active', priority: 30, tags: ['navidad', 'campaña'], ...audit(ID.user.adminUnaDeTodos),
    }),
    Product.parse({
      id: P.aiAnime, organizationId: ID.org.unaDeTodos, internalName: 'ia-anime', displayName: L('Retrato estilo anime (IA)', 'Anime-style portrait (AI)'), category: 'ai_future', kind: 'ai',
      description: L('Estilización con proveedor externo de IA; requiere consentimiento.', 'Stylization with an external AI provider; requires consent.'), whatYouGet: L('Una impresión 4x6 estilizada.', 'One stylized 4x6 print.'),
      coverAssetId: ID.asset.examplePortrait2, estimatedDurationSec: 300, captureCount: 1, printCount: 1,
      output: { templateId: T.single4x6, paperSize: '4x6in', copies: 1, printerType: 'photo' },
      aiExperienceKey: 'anime', editing: noEditing, retakes: { max: 2 }, autoCapture: false, manualCapture: true, basePrice: mxn(9000), taxInfo: { ratePct: 16, included: true, label: 'IVA incluido' },
      hardwareRequirements: ['camera.primary', 'printer.photo', 'connectivity.online'], requiredFeatures: ['ai.experiences', 'printing.photo'], retentionPolicyId: ID.retention.deleteOnFinish, status: 'active', priority: 40, tags: ['ia'], ...audit(ID.user.adminUnaDeTodos),
    }),
    documentProduct({ id: P.frDocCredential, organizationId: ID.org.fotorapida, internalName: 'fr-doc-credencial', name: ['Foto credencial', 'Credential photo'], description: ['Fotografía tamaño credencial para trámites en Colombia.', 'Credential-size photo for paperwork in Colombia.'], presetId: ID.preset.mxCredential, templateId: T.sheet4x6Credential, paper: '4x6in', price: cop(1500000), priority: 10, tags: ['documentos'] }),
    Product.parse({
      id: P.frStrip, organizationId: ID.org.fotorapida, internalName: 'fr-tira', displayName: L('Tira divertida'), category: 'photo_strip', kind: 'entertainment',
      description: L('Tres poses en pareja en tira 2x6.'), whatYouGet: L('Dos tiras 2x6.'),
      coverAssetId: ID.asset.bgConfetti, estimatedDurationSec: 220, captureCount: 3, printCount: 2,
      output: { templateId: T.strip2x6, paperSize: '2x6in-strip', copies: 2, printerType: 'photo' },
      experienceId: ID.experience.couple, editing: creativeEditing, retakes: { max: 2 }, autoCapture: false, manualCapture: true, basePrice: cop(2000000), taxInfo: { ratePct: 19, included: true, label: 'IVA incluido' },
      hardwareRequirements: ['camera.primary', 'printer.photo'], requiredFeatures: ['entertainment.mode', 'printing.photo'], retentionPolicyId: ID.retention.deleteOnFinish, status: 'active', priority: 20, tags: ['diversion'], ...audit(ID.user.adminFotorapida),
    }),
  ];
}

export function buildProductAvailabilities(): ProductAvailability[] {
  return [
    ProductAvailability.parse({ id: ID.availability.aiOrgOff, productId: P.aiAnime, scope: { level: 'organization', id: ID.org.unaDeTodos }, enabled: false, updatedAt: UPDATED_AT, updatedBy: ID.user.adminUnaDeTodos }),
    ProductAvailability.parse({ id: ID.availability.aiNorteOn, productId: P.aiAnime, scope: { level: 'franchise', id: ID.franchise.norte }, enabled: true, priorityOverride: 35, updatedAt: UPDATED_AT, updatedBy: ID.user.franqNorte }),
  ];
}

export function buildPriceRules(products: Product[]): PriceRule[] {
  const orgRules = products.map((product) =>
    PriceRule.parse({
      id: `${ID.priceRule.orgPrefix}${product.id.slice(4)}`,
      productId: product.id,
      scope: { level: 'organization', id: product.organizationId },
      price: product.basePrice,
      priority: 0,
      ...(product.id === P.docUniversity ? { lock: { policy: 'mandatory' } } : {}),
      ...(product.id === P.friendsStrip ? { lock: { policy: 'range', min: mxn(5000), max: mxn(12000) } } : {}),
      updatedAt: UPDATED_AT,
      updatedBy: ID.user.adminUnaDeTodos,
    }),
  );
  return [
    ...orgRules,
    PriceRule.parse({ id: ID.priceRule.friendsStripNorte, productId: P.friendsStrip, scope: { level: 'franchise', id: ID.franchise.norte }, price: mxn(7000), priority: 0, updatedAt: UPDATED_AT, updatedBy: ID.user.franqNorte }),
    PriceRule.parse({ id: ID.priceRule.portraitProPremium, productId: P.portraitPro, scope: { level: 'machine', id: ID.machine.premium }, price: mxn(18000), priority: 0, updatedAt: UPDATED_AT, updatedBy: ID.user.adminUnaDeTodos }),
  ];
}

export function buildPromotions(): Promotion[] {
  return [
    Promotion.parse({
      id: ID.promotion.strip2x1Tuesday, organizationId: ID.org.unaDeTodos, franchiseId: ID.franchise.norte, name: L('2x1 en tira los martes', '2-for-1 strips on Tuesdays'), type: 'second_print', value: 100,
      productIds: [P.friendsStrip], scope: { level: 'franchise', id: ID.franchise.norte }, schedule: [{ days: [2], from: '16:00', to: '19:00' }], priority: 10, status: 'active', ...audit(ID.user.franqNorte),
    }),
    Promotion.parse({
      id: ID.promotion.cafe10pct, organizationId: ID.org.unaDeTodos, franchiseId: ID.franchise.norte, name: L('10 % en Café Aurora', '10% off at Café Aurora'), type: 'percent_discount', value: 10,
      productIds: [], scope: { level: 'location', id: ID.location.cafe }, priority: 5, status: 'active', ...audit(ID.user.franqNorte),
    }),
    Promotion.parse({
      id: ID.promotion.code10, organizationId: ID.org.unaDeTodos, name: L('Código PROMO10', 'PROMO10 code'), type: 'code', value: 10, code: 'PROMO10',
      productIds: [], scope: { level: 'organization', id: ID.org.unaDeTodos }, window: { start: '2026-09-01T06:00:00Z', end: '2026-12-31T06:00:00Z' }, priority: 1, status: 'active', ...audit(ID.user.adminUnaDeTodos),
    }),
  ];
}
