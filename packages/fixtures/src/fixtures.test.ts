import {
  Announcement, Asset, Blueprint, Campaign, ConfigLayer, Consumable, DocumentPreset, DocumentPresetVersion, EditingPreset, Entitlement, EntitlementPlan,
  Experience, FeatureOverride, Franchise, HardwareProfile, Incident, InternalDocument, Location, Machine, MaintenanceChecklist, MaintenanceLog, Organization,
  PriceRule, PrintTemplate, Product, ProductAvailability, Promotion, Region, Release, RetentionPolicy, RoleAssignment, Rollout, SessionRecord, SupportAccess,
  Territory, User, CONFIG_KEY_INDEX, DOCUMENT_SAFE_TOOLS, type Scope,
} from '@psp/contracts';
import { describe, expect, it } from 'vitest';
import { CATALOG, DEMO_IDS, DEMO_NOW, DEMO_USERS, assetContent, demoDataset, generateFleet, generateSessionHistory } from './index';
import { sha256Hex } from './sha256';
import type { DemoDataset } from './types';

const data = demoDataset();
const ID = DEMO_IDS;

const schemas: Record<keyof DemoDataset, { array: () => { parse: (v: unknown) => unknown } }> = {
  organizations: Organization, franchises: Franchise, territories: Territory, regions: Region, locations: Location, machines: Machine, hardwareProfiles: HardwareProfile,
  blueprints: Blueprint, users: User, roleAssignments: RoleAssignment, supportAccesses: SupportAccess, products: Product, productAvailabilities: ProductAvailability,
  priceRules: PriceRule, promotions: Promotion, presets: DocumentPreset, presetVersions: DocumentPresetVersion, templates: PrintTemplate, experiences: Experience,
  editingPresets: EditingPreset, campaigns: Campaign, assets: Asset, retentionPolicies: RetentionPolicy, maintenanceChecklists: MaintenanceChecklist, configLayers: ConfigLayer,
  featureOverrides: FeatureOverride, entitlementPlans: EntitlementPlan, entitlements: Entitlement, releases: Release, rollouts: Rollout, internalDocuments: InternalDocument,
  announcements: Announcement, incidents: Incident, maintenanceLogs: MaintenanceLog, consumables: Consumable, sessionRecords: SessionRecord,
};

const ids = (items: Array<{ id: string }>) => new Set(items.map((i) => i.id));
const orgIds = ids(data.organizations);
const franchiseIds = ids(data.franchises);
const regionIds = ids(data.regions);
const locationIds = ids(data.locations);
const machineIds = ids(data.machines);
const profileIds = ids(data.hardwareProfiles);
const blueprintIds = ids(data.blueprints);
const productIds = ids(data.products);
const presetIds = ids(data.presets);
const templateIds = ids(data.templates);
const experienceIds = ids(data.experiences);
const editingPresetIds = ids(data.editingPresets);
const assetIds = ids(data.assets);
const campaignIds = ids(data.campaigns);
const userIds = ids(data.users);
const retentionIds = ids(data.retentionPolicies);
const checklistIds = ids(data.maintenanceChecklists);
const planIds = ids(data.entitlementPlans);
const releaseIds = ids(data.releases);
const templateById = new Map(data.templates.map((t) => [t.id, t]));

function expectScope(scope: Scope): void {
  const sets: Record<string, Set<string> | undefined> = { platform: undefined, organization: orgIds, franchise: franchiseIds, region: regionIds, location: locationIds, machine: machineIds };
  const set = sets[scope.level];
  if (set === undefined) return;
  expect(scope.id, `scope ${scope.level}`).toBeDefined();
  expect(set.has(scope.id ?? ''), `scope ${scope.level}:${scope.id}`).toBe(true);
}
const expectIn = (set: Set<string>, id: string | undefined, label: string): void => {
  if (id !== undefined) expect(set.has(id), `${label}: ${id}`).toBe(true);
};

describe('validez contra los contratos', () => {
  for (const key of Object.keys(schemas) as Array<keyof DemoDataset>) {
    it(`${key} valida con su esquema y tiene ids únicos`, () => {
      expect(() => schemas[key].array().parse(data[key])).not.toThrow();
      const items = data[key] as Array<{ id?: string; presetId?: string; version?: number }>;
      const keys = items.map((i) => i.id ?? `${i.presetId}@${i.version}`);
      expect(new Set(keys).size).toBe(keys.length);
      expect(items.length).toBeGreaterThan(0);
    });
  }
});

describe('integridad referencial', () => {
  it('jerarquía', () => {
    for (const f of data.franchises) expectIn(orgIds, f.organizationId, 'franchise.org');
    for (const t of data.territories) expectIn(franchiseIds, t.franchiseId, 'territory.franchise');
    for (const r of data.regions) { expectIn(orgIds, r.organizationId, 'region.org'); expectIn(franchiseIds, r.franchiseId, 'region.franchise'); }
    for (const l of data.locations) { expectIn(orgIds, l.organizationId, 'loc.org'); expectIn(franchiseIds, l.franchiseId, 'loc.franchise'); expectIn(regionIds, l.regionId, 'loc.region'); }
    for (const m of data.machines) {
      expectIn(orgIds, m.organizationId, 'mch.org'); expectIn(franchiseIds, m.franchiseId, 'mch.franchise'); expectIn(regionIds, m.regionId, 'mch.region');
      expectIn(locationIds, m.locationId, 'mch.location'); expectIn(profileIds, m.hardwareProfileId, 'mch.profile'); expectIn(blueprintIds, m.blueprintId, 'mch.blueprint');
      const location = data.locations.find((l) => l.id === m.locationId);
      if (location !== undefined) { expect(location.organizationId).toBe(m.organizationId); expect(location.franchiseId).toBe(m.franchiseId); expect(location.regionId).toBe(m.regionId); }
      const profile = data.hardwareProfiles.find((p) => p.id === m.hardwareProfileId);
      expect(new Set(m.capabilities.map((c) => c.key))).toEqual(new Set(profile?.expectedCapabilities));
      expect(m.online ? Date.parse(m.lastSeenAt ?? '') > Date.parse(DEMO_NOW) - 3_600_000 : Date.parse(m.lastSeenAt ?? '') < Date.parse(DEMO_NOW) - 3_600_000).toBe(true);
    }
    for (const b of data.blueprints) { expectIn(profileIds, b.hardwareProfileId, 'bp.profile'); expectIn(checklistIds, b.maintenanceChecklistId, 'bp.checklist'); for (const p of b.productIds) expectIn(productIds, p, 'bp.product'); for (const k of Object.keys(b.configValues)) expect(CONFIG_KEY_INDEX[k], `configKey ${k}`).toBeDefined(); }
  });
  it('personas', () => {
    for (const ra of data.roleAssignments) { expectIn(userIds, ra.userId, 'ra.user'); expectIn(userIds, ra.grantedBy, 'ra.grantedBy'); expectScope(ra.scope); }
    for (const sa of data.supportAccesses) { expectIn(userIds, sa.userId, 'sa.user'); expectIn(userIds, sa.grantedBy, 'sa.grantedBy'); expectScope(sa.scope); }
  });
  it('catálogo', () => {
    for (const p of data.products) {
      expectIn(orgIds, p.organizationId, 'prd.org'); expectIn(presetIds, p.presetId, 'prd.preset'); expectIn(experienceIds, p.experienceId, 'prd.experience');
      expectIn(assetIds, p.coverAssetId, 'prd.cover'); expectIn(retentionIds, p.retentionPolicyId, 'prd.retention');
      const template = templateById.get(p.output.templateId);
      expect(template, `prd.template ${p.output.templateId}`).toBeDefined();
      expect(template?.paperSize).toBe(p.output.paperSize);
      if (p.kind === 'document') { expect(template?.kind).toBe('document_sheet'); expect(p.presetId).toBeDefined(); for (const tool of p.editing.allowedTools) expect(DOCUMENT_SAFE_TOOLS).toContain(tool); }
      for (const id of p.editing.allowedPresetIds) expectIn(editingPresetIds, id, 'prd.editingPreset');
      if (p.presetId !== undefined) { const preset = data.presets.find((x) => x.id === p.presetId); const version = data.presetVersions.find((v) => v.presetId === p.presetId && v.version === preset?.currentVersion); expect(p.output.copies).toBe(version?.spec.defaultCopies); }
    }
    for (const a of data.productAvailabilities) { expectIn(productIds, a.productId, 'pav.product'); expectScope(a.scope); }
    for (const r of data.priceRules) { expectIn(productIds, r.productId, 'prr.product'); expectScope(r.scope); expect(r.price.currency).toBe(data.products.find((p) => p.id === r.productId)?.basePrice.currency); }
    for (const pr of data.promotions) { expectIn(orgIds, pr.organizationId, 'prm.org'); expectIn(franchiseIds, pr.franchiseId, 'prm.franchise'); expectScope(pr.scope); for (const p of pr.productIds) expectIn(productIds, p, 'prm.product'); }
  });
  it('presets, plantillas, experiencias', () => {
    for (const p of data.presets) {
      const versions = data.presetVersions.filter((v) => v.presetId === p.id).map((v) => v.version);
      expect(versions).toContain(p.currentVersion);
      expect(new Set(versions).size).toBe(versions.length);
    }
    for (const v of data.presetVersions) {
      const sheet = templateById.get(v.spec.sheetTemplateId);
      expect(sheet?.kind, `sheet ${v.spec.sheetTemplateId}`).toBe('document_sheet');
      expect(sheet?.documentSheet?.photoWidthMm).toBe(v.spec.physical.widthMm);
      expect(sheet?.documentSheet?.photoHeightMm).toBe(v.spec.physical.heightMm);
      for (const tool of v.spec.editing.allowedTools) expect(DOCUMENT_SAFE_TOOLS).toContain(tool);
      for (const id of v.spec.editing.allowedPresetIds) expect(data.editingPresets.find((e) => e.id === id)?.documentSafe).toBe(true);
    }
    for (const t of data.templates) {
      expectIn(orgIds, t.organizationId, 'tpl.org');
      const check = (elements: typeof t.elements, canvas: { widthMm: number; heightMm: number }) => {
        const slots = new Set<number>();
        for (const e of elements) {
          expect(e.box.x, `${t.id}/${e.id}`).toBeGreaterThanOrEqual(0); expect(e.box.y).toBeGreaterThanOrEqual(0);
          expect(e.box.x + e.box.w, `${t.id}/${e.id} w`).toBeLessThanOrEqual(canvas.widthMm + 1e-6); expect(e.box.y + e.box.h, `${t.id}/${e.id} h`).toBeLessThanOrEqual(canvas.heightMm + 1e-6);
          if (e.type === 'photo') slots.add(e.slotIndex);
          if (e.type === 'image' || e.type === 'frame') expectIn(assetIds, e.assetId, 'tpl.asset');
          if (e.type === 'background') expectIn(assetIds, e.assetId, 'tpl.bg');
        }
        if (t.kind !== 'document_sheet') expect(slots.size, `${t.id} slots`).toBe(t.photoSlots);
      };
      check(t.elements, t.canvas);
      for (const v of t.variants) check(v.elements ?? t.elements, v.canvas ?? t.canvas);
    }
    for (const e of data.experiences) {
      expectIn(templateIds, e.templateId, 'exp.template'); expectIn(campaignIds, e.campaignId, 'exp.campaign');
      for (const id of [...e.frameAssetIds, ...e.stickerAssetIds, ...e.overlayAssetIds]) expectIn(assetIds, id, 'exp.asset');
      for (const id of e.editingPresetIds) expectIn(editingPresetIds, id, 'exp.editingPreset');
      for (const pose of e.poses) { expectIn(assetIds, pose.exampleAssetId, 'pose.example'); expectIn(assetIds, pose.silhouetteAssetId, 'pose.silhouette'); }
      expect(e.selection.max).toBeLessThanOrEqual(e.poses.length);
    }
  });
  it('campañas, activos, configuración, features, releases, operación', () => {
    for (const c of data.campaigns) {
      expectIn(orgIds, c.organizationId, 'cmp.org'); expectIn(franchiseIds, c.franchiseId, 'cmp.franchise'); expectIn(experienceIds, c.experienceId, 'cmp.experience');
      for (const s of c.targets.scopes) expectScope(s);
      for (const p of [...c.productIds, ...c.priceOverrides.map((o) => o.productId)]) expectIn(productIds, p, 'cmp.product');
      for (const t of c.templateIds) expectIn(templateIds, t, 'cmp.template');
      for (const a of c.assetIds) expectIn(assetIds, a, 'cmp.asset');
      expectIn(assetIds, c.sponsor?.logoAssetId, 'cmp.sponsorLogo');
      for (const k of Object.keys(c.configOverlay.values)) expect(CONFIG_KEY_INDEX[k], `configKey ${k}`).toBeDefined();
      expect(Date.parse(c.startsAt)).toBeLessThan(Date.parse(c.endsAt));
    }
    for (const a of data.assets) { expectIn(orgIds, a.organizationId, 'ast.org'); expectScope(a.ownerScope); expectIn(campaignIds, a.campaignId, 'ast.campaign'); expect(a.path).toBe(`assets/${a.hash}.svg`); }
    for (const l of data.configLayers) {
      for (const k of Object.keys(l.values)) { expect(CONFIG_KEY_INDEX[k], `configKey ${k}`).toBeDefined(); const v = l.values[k]; if (typeof v === 'string' && v.startsWith('ast_')) expectIn(assetIds, v, 'cfg.asset'); if (typeof v === 'string' && v.startsWith('ret_')) expectIn(retentionIds, v, 'cfg.retention'); }
      for (const lock of l.locks) expect(CONFIG_KEY_INDEX[lock.key]).toBeDefined();
      if (l.level !== 'platform') expectScope({ level: l.level as Scope['level'], id: l.entityId });
    }
    for (const e of data.entitlements) { expectIn(planIds, e.planId, 'ent.plan'); expectScope(e.scope); }
    for (const o of data.featureOverrides) expectScope(o.scope);
    for (const r of data.rollouts) { expectIn(releaseIds, r.releaseId, 'rol.release'); for (const t of r.targets) { if (t.kind === 'machines') for (const m of t.machineIds) expectIn(machineIds, m, 'rol.machine'); if (t.kind === 'organization') expectIn(orgIds, t.organizationId, 'rol.org'); } }
    for (const i of data.incidents) { expectIn(machineIds, i.machineId, 'inc.machine'); expectIn(locationIds, i.locationId, 'inc.location'); expectIn(orgIds, i.organizationId, 'inc.org'); expectIn(userIds, i.assigneeId, 'inc.assignee'); }
    for (const m of data.maintenanceLogs) { expectIn(machineIds, m.machineId, 'mnt.machine'); expectIn(checklistIds, m.checklistId, 'mnt.checklist'); }
    for (const c of data.consumables) expectIn(machineIds, c.machineId, 'con.machine');
    for (const c of data.maintenanceChecklists) expectIn(profileIds, c.hardwareProfileId, 'chk.profile');
    for (const d of data.internalDocuments) if (d.attachedTo.type === 'hardwareProfile') expectIn(profileIds, d.attachedTo.id, 'doc.profile');
    for (const a of data.announcements) for (const f of a.audienceFranchiseIds) expectIn(franchiseIds, f, 'ann.franchise');
    for (const s of data.sessionRecords) {
      expectIn(machineIds, s.machineId, 'ses.machine'); expectIn(productIds, s.productId, 'ses.product'); expectIn(retentionIds, s.retention.policyId, 'ses.retention');
      expectIn(presetIds, s.presetId, 'ses.preset'); expectIn(templateIds, s.templateId, 'ses.template'); expectIn(campaignIds, s.campaignId, 'ses.campaign');
    }
  });
});

describe('determinismo', () => {
  it('demoDataset produce el mismo JSON en dos llamadas', () => {
    expect(JSON.stringify(demoDataset())).toBe(JSON.stringify(data));
  });
  it('generateFleet con la misma semilla es idéntico y valida', () => {
    const a = generateFleet(data, 40, 'seed-a');
    const b = generateFleet(data, 40, 'seed-a');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(generateFleet(data, 40, 'seed-b'))).not.toBe(JSON.stringify(a));
    expect(a.machines).toHaveLength(40);
    expect(() => Machine.array().parse(a.machines)).not.toThrow();
    expect(() => Location.array().parse(a.locations)).not.toThrow();
    expect(() => ConfigLayer.array().parse(a.configLayers)).not.toThrow();
    const locIds = ids(a.locations);
    for (const m of a.machines) { expect(locIds.has(m.locationId ?? '')).toBe(true); expect(profileIds.has(m.hardwareProfileId)).toBe(true); expect(m.id.startsWith('mch_sim_')).toBe(true); }
    expect(a.machines.filter((m) => m.tags.includes('piloto')).length).toBeGreaterThan(0);
    expect(a.machines.filter((m) => m.status === 'active').length).toBeGreaterThan(20);
  });
  it('assetContent coincide con hash y bytes del activo', () => {
    for (const asset of data.assets) {
      const content = assetContent(asset.id);
      expect(content.mime).toBe(asset.mime);
      expect(content.bytes.length).toBe(asset.bytes);
      expect(sha256Hex(content.bytes)).toBe(asset.hash);
    }
    expect(() => assetContent('ast_nope')).toThrow();
  });
});

describe('escenarios', () => {
  it('producto IA: deshabilitado en la organización y habilitado sólo en fr_norte, con override de feature', () => {
    const av = data.productAvailabilities.filter((a) => a.productId === ID.product.aiAnime);
    expect(av.find((a) => a.scope.level === 'organization')?.enabled).toBe(false);
    expect(av.find((a) => a.scope.level === 'franchise' && a.scope.id === ID.franchise.norte)?.enabled).toBe(true);
    const ov = data.featureOverrides.filter((o) => o.key === 'ai.experiences');
    expect(ov.find((o) => o.scope.level === 'organization')?.mode).toBe('hidden');
    expect(ov.find((o) => o.scope.id === ID.franchise.norte)?.mode).toBe('enabled');
    expect(data.products.find((p) => p.id === ID.product.aiAnime)?.requiredFeatures).toContain('ai.experiences');
  });
  it('preset universitario con dos versiones y currentVersion 2; las sesiones registran la versión vigente en su fecha', () => {
    expect(data.presets.find((p) => p.id === ID.preset.mxUniversity)?.currentVersion).toBe(2);
    const versions = data.presetVersions.filter((v) => v.presetId === ID.preset.mxUniversity);
    expect(versions.map((v) => v.version)).toEqual([1, 2]);
    const v2At = Date.parse(versions[1]?.createdAt ?? '');
    const sessions = data.sessionRecords.filter((s) => s.presetId === ID.preset.mxUniversity);
    expect(sessions.some((s) => s.presetVersion === 1)).toBe(true);
    expect(sessions.some((s) => s.presetVersion === 2)).toBe(true);
    for (const s of sessions) expect(s.presetVersion).toBe(Date.parse(s.startedAt) < v2At ? 1 : 2);
  });
  it('campaña navideña obligatoria con claves editables por franquicia y patrocinador', () => {
    const c = data.campaigns.find((x) => x.id === ID.campaign.christmas2026);
    expect(c?.mandatory).toBe(true);
    expect(c?.franchiseEditableKeys).toEqual(['branding.footerText']);
    expect(c?.sponsor?.name).toBe('Chocolates Aurora');
    expect(Object.keys(c?.configOverlay.values ?? {})).toContain('branding.attractImageAssetIds');
  });
  it('tres máquinas demo con perfiles distintos', () => {
    const profiles = [ID.machine.doc, ID.machine.thermal, ID.machine.premium].map((id) => data.machines.find((m) => m.id === id)?.hardwareProfileId);
    expect(new Set(profiles).size).toBe(3);
    expect(data.machines.find((m) => m.id === ID.machine.doc)?.printers.map((p) => p.id)).toEqual([ID.printer.photo]);
    expect(data.machines.find((m) => m.id === ID.machine.thermal)?.printers.map((p) => p.id)).toEqual([ID.printer.thermal]);
    expect(data.machines.find((m) => m.id === ID.machine.premium)?.status).toBe('active_with_warnings');
    expect(data.machines.filter((m) => m.softwareVersion === '0.2.0')).toHaveLength(2);
  });
  it('usuarios prometidos en como-correr.md con contraseña demo', () => {
    const emails = DEMO_USERS.map((u) => u.email);
    for (const e of ['owner@platform.demo', 'admin@lumina.demo', 'franq@norte.demo', 'tecnico@norte.demo', 'analista@lumina.demo', 'admin@fotorapida.demo', 'soporte@platform.demo']) expect(emails).toContain(e);
    for (const u of DEMO_USERS) { expect(u.password).toBe('demo'); expect(u.passwordHash).toBe(sha256Hex('demo')); expect(userIds.has(u.id)).toBe(true); expect(data.roleAssignments.some((ra) => ra.userId === u.id && ra.roleKey === u.roleKey)).toBe(true); }
    const support = data.supportAccesses.find((s) => s.userId === ID.user.soporte);
    expect(support?.scope).toEqual({ level: 'machine', id: ID.machine.cinema });
    expect(Date.parse(support?.expiresAt ?? '')).toBeGreaterThan(Date.parse(DEMO_NOW));
  });
  it('precios: bloqueo mandatory, override de franquicia dentro del rango y override de máquina', () => {
    const rules = data.priceRules;
    expect(rules.find((r) => r.productId === ID.product.docUniversity && r.scope.level === 'organization')?.lock?.policy).toBe('mandatory');
    const orgStrip = rules.find((r) => r.productId === ID.product.friendsStrip && r.scope.level === 'organization');
    const norteStrip = rules.find((r) => r.id === ID.priceRule.friendsStripNorte);
    expect(orgStrip?.lock?.policy).toBe('range');
    expect(norteStrip?.price.amount).toBeGreaterThanOrEqual(orgStrip?.lock?.min?.amount ?? 0);
    expect(norteStrip?.price.amount).toBeLessThanOrEqual(orgStrip?.lock?.max?.amount ?? 0);
    expect(rules.find((r) => r.id === ID.priceRule.portraitProPremium)?.scope).toEqual({ level: 'machine', id: ID.machine.premium });
  });
  it('capa de franquicia intenta un color bloqueado por la organización', () => {
    const org = data.configLayers.find((l) => l.id === ID.configLayer.orgLumina);
    const norte = data.configLayers.find((l) => l.id === ID.configLayer.frNorte);
    expect(org?.locks.some((l) => l.key === 'branding.palette.primary' && l.policy === 'mandatory')).toBe(true);
    expect(norte?.values['branding.palette.primary']).toBeDefined();
  });
});

describe('historial de sesiones', () => {
  it('cubre 14 días con ≥ 25 sesiones por día y distribución realista', () => {
    const perDay = new Map<string, number>();
    for (const s of data.sessionRecords) perDay.set(s.startedAt.slice(0, 10), (perDay.get(s.startedAt.slice(0, 10)) ?? 0) + 1);
    expect(perDay.size).toBeGreaterThanOrEqual(14);
    for (const [day, n] of perDay) if (day !== DEMO_NOW.slice(0, 10)) expect(n, day).toBeGreaterThanOrEqual(25);
    const completed = data.sessionRecords.filter((s) => s.result === 'completed').length / data.sessionRecords.length;
    expect(completed).toBeGreaterThan(0.78);
    expect(completed).toBeLessThan(0.92);
    expect(data.sessionRecords.every((s) => s.retakes >= 0 && s.retakes <= 3)).toBe(true);
    expect(data.sessionRecords.some((s) => s.commercial.state === 'paid_simulated')).toBe(true);
    expect(data.sessionRecords.filter((s) => s.machineId === ID.machine.demo).every((s) => s.commercial.state === 'demo' && s.isDemo)).toBe(true);
    expect(data.sessionRecords.filter((s) => s.machineId === ID.machine.hotel).every((s) => s.commercial.state === 'courtesy')).toBe(true);
    expect(data.sessionRecords.some((s) => s.campaignId === ID.campaign.backToSchool)).toBe(true);
    expect(data.sessionRecords.every((s) => Date.parse(s.startedAt) < Date.parse(DEMO_NOW))).toBe(true);
    const inactive = new Set(data.machines.filter((m) => !['active', 'active_with_warnings', 'demo'].includes(m.status)).map((m) => m.id));
    expect(data.sessionRecords.some((s) => inactive.has(s.machineId))).toBe(false);
  });
  it('es determinista y respeta la semilla', () => {
    const a = generateSessionHistory(data, 3, 'x');
    expect(JSON.stringify(generateSessionHistory(data, 3, 'x'))).toBe(JSON.stringify(a));
    expect(JSON.stringify(generateSessionHistory(data, 3, 'y'))).not.toBe(JSON.stringify(a));
    expect(() => SessionRecord.array().parse(a)).not.toThrow();
  });
});

it('CATALOG registra el paquete', () => {
  expect(CATALOG.some((c) => c.kind === 'package' && c.key === '@psp/fixtures')).toBe(true);
});
