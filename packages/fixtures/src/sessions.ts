/**
 * Historial de sesiones determinista para métricas. Por máquina activa y día: sesiones según una
 * curva horaria dentro del horario de la ubicación, productos compatibles con las impresoras de la
 * máquina, ~85 % completadas, retakes 0–3, estado comercial según `payment.businessMode` efectivo.
 */
import { SessionRecord, type Location, type Machine, type Product, type SessionStage } from '@psp/contracts';
import { Rng } from './prng';
import { sha256Hex } from './sha256';
import { DEMO_NOW_MS, HOUR, MINUTE, hhmmToMinutes, iso, localMidnightUtcMs, localParts } from './time';
import type { SessionHistoryBase } from './types';

const SESSION_STATUSES = new Set<Machine['status']>(['active', 'active_with_warnings', 'demo']);

/** Peso relativo de cada hora local (0..23): valle nocturno, pico de tarde. */
const HOUR_WEIGHTS = [0, 0, 0, 0, 0, 0, 0.2, 0.6, 1, 1.4, 1.8, 2.2, 2.6, 2.4, 2.2, 2.4, 2.8, 3, 2.8, 2.4, 1.8, 1.2, 0.6, 0.2];

function businessModeFor(base: SessionHistoryBase, machine: Machine): string {
  const layer = base.configLayers.find((l) => l.level === 'machine' && l.entityId === machine.id);
  const value = layer?.values['payment.businessMode'];
  if (typeof value === 'string') return value;
  const blueprint = base.blueprints.find((b) => b.id === machine.blueprintId);
  const bpValue = blueprint?.configValues['payment.businessMode'];
  return typeof bpValue === 'string' ? bpValue : 'paid';
}

function compatibleProducts(base: SessionHistoryBase, machine: Machine): Product[] {
  const paper = new Set(machine.printers.flatMap((p) => p.paperSizes));
  return base.products.filter((p) => p.organizationId === machine.organizationId && p.status === 'active' && p.kind !== 'ai' && paper.has(p.output.paperSize));
}

function openingWindow(location: Location | undefined, weekday: number): { from: number; to: number } | undefined {
  if (location === undefined) return { from: 9 * 60, to: 19 * 60 };
  const schedule = location.openingHours.find((s) => s.days.includes(weekday));
  return schedule === undefined ? undefined : { from: hhmmToMinutes(schedule.from), to: hhmmToMinutes(schedule.to) };
}

export function generateSessionHistory(base: SessionHistoryBase, days: number, seed: string): SessionRecord[] {
  const records: SessionRecord[] = [];
  const locations = new Map(base.locations.map((l) => [l.id, l]));
  const organizations = new Map(base.organizations.map((o) => [o.id, o]));
  const retention = new Map(base.retentionPolicies.map((r) => [r.id, r]));
  const presets = new Map(base.presets.map((p) => [p.id, p]));
  /** Versión de preset vigente en un instante: la mayor cuyo `createdAt` no es posterior (escenario J). */
  const presetVersionAt = (presetId: string, atMs: number): number | undefined =>
    base.presetVersions.filter((v) => v.presetId === presetId && Date.parse(v.createdAt) <= atMs).reduce<number | undefined>((max, v) => (max === undefined || v.version > max ? v.version : max), undefined);
  const templates = new Map(base.templates.map((t) => [t.id, t]));

  for (const machine of base.machines) {
    if (!SESSION_STATUSES.has(machine.status)) continue;
    const products = compatibleProducts(base, machine);
    if (products.length === 0) continue;
    const location = machine.locationId === undefined ? undefined : locations.get(machine.locationId);
    const organization = organizations.get(machine.organizationId);
    const timezone = machine.timezone ?? location?.timezone ?? organization?.timezone ?? 'America/Mexico_City';
    const businessMode = businessModeFor(base, machine);
    const isDemo = machine.status === 'demo' || businessMode === 'demo';
    const locales = organization?.locales ?? ['es'];
    const bundleVersion = `bnd_${sha256Hex(`${machine.id}/${machine.softwareVersion ?? ''}`).slice(0, 12)}`;
    const machineRng = new Rng(`${seed}/${machine.id}`);
    const weightedProducts = products.map((p): readonly [Product, number] => [p, p.kind === 'document' ? 3 : p.kind === 'portrait' ? 1.5 : 2]);

    for (let dayOffset = days; dayOffset >= 1; dayOffset -= 1) {
      const dayStart = localMidnightUtcMs(DEMO_NOW_MS, timezone, -dayOffset);
      const weekday = localParts(dayStart + 12 * HOUR, timezone).weekday;
      const window = openingWindow(location, weekday);
      if (window === undefined) continue;
      const rng = machineRng.fork(`day${dayOffset}`);
      const count = rng.int(isDemo ? 2 : 4, isDemo ? 5 : 9);
      const hours = Array.from({ length: 24 }, (_, h): readonly [number, number] => {
        const minutes = h * 60;
        return [h, minutes >= window.from && minutes < window.to ? HOUR_WEIGHTS[h] ?? 0 : 0];
      });
      if (hours.every(([, w]) => w === 0)) continue;
      const starts = Array.from({ length: count }, () => rng.weighted(hours) * 60 + rng.int(0, 59)).sort((a, b) => a - b);

      starts.forEach((startMinute, index) => {
        const startedAtMs = dayStart + startMinute * MINUTE;
        if (startedAtMs >= DEMO_NOW_MS) return;
        const product = rng.weighted(weightedProducts);
        const outcome = rng.weighted([['completed', 85], ['cancelled', 7], ['abandoned', 5], ['failed', 3]] as const);
        const retakes = rng.weighted([[0, 50], [1, 30], [2, 15], [3, 5]] as const);
        const durationSec = Math.round(product.estimatedDurationSec * rng.float(0.7, 1.4)) + retakes * 20;
        const policy = retention.get(product.retentionPolicyId ?? '') ?? base.retentionPolicies[0];
        const preset = product.presetId === undefined ? undefined : presets.get(product.presetId);
        const template = templates.get(product.output.templateId);
        const locale = locales.length > 1 && rng.chance(0.15) ? 'en' : 'es';
        const completed = outcome === 'completed';
        const campaign = base.campaigns.find((c) => c.status === 'active' && c.priceOverrides.some((o) => o.productId === product.id) && Date.parse(c.startsAt) <= startedAtMs && startedAtMs < Date.parse(c.endsAt) && c.targets.scopes.some((s) => (s.level === 'location' && s.id === machine.locationId) || (s.level === 'machine' && s.id === machine.id)));
        const listAmount = product.basePrice.amount;
        const finalAmount = campaign?.priceOverrides.find((o) => o.productId === product.id)?.price.amount ?? listAmount;
        const endedAtMs = startedAtMs + durationSec * 1000;
        const stage: SessionStage = completed ? 'done' : outcome;
        const abandonedAt = outcome === 'abandoned' ? rng.pick(['product_selected', 'consent', 'awaiting_payment', 'reviewing'] as const) : undefined;

        const commercial = isDemo
          ? { state: 'demo' as const, paymentState: 'demo' as const }
          : businessMode === 'courtesy'
            ? { state: 'courtesy' as const, paymentState: 'not_required' as const, listPrice: product.basePrice, finalPrice: { amount: 0, currency: product.basePrice.currency } }
            : businessMode !== 'paid'
              ? { state: 'free' as const, paymentState: 'free' as const, listPrice: product.basePrice, finalPrice: { amount: 0, currency: product.basePrice.currency } }
              : completed
                ? { state: 'paid_simulated' as const, paymentState: 'approved' as const, listPrice: product.basePrice, finalPrice: { amount: finalAmount, currency: product.basePrice.currency }, paymentRef: `mock_${rng.code(8)}`, adapter: 'mock' }
                : { state: outcome === 'failed' ? ('failed' as const) : ('voided' as const), paymentState: outcome === 'abandoned' ? ('expired' as const) : ('cancelled' as const), listPrice: product.basePrice };

        records.push(
          SessionRecord.parse({
            id: `ses_${machine.id.slice(4)}_${localParts(startedAtMs, timezone).isoDate.replace(/-/g, '')}_${String(index + 1).padStart(2, '0')}`,
            code: rng.code(6),
            machineId: machine.id,
            locationId: machine.locationId,
            organizationId: machine.organizationId,
            franchiseId: machine.franchiseId,
            startedAt: iso(startedAtMs),
            endedAt: iso(endedAtMs),
            stage,
            result: outcome,
            productId: product.id,
            productName: product.displayName.es,
            productKind: product.kind,
            presetId: preset?.id,
            presetVersion: preset === undefined ? undefined : (presetVersionAt(preset.id, startedAtMs) ?? preset.currentVersion),
            templateId: template?.id,
            templateVersion: template?.version,
            experienceId: product.experienceId,
            captures: completed ? product.captureCount + retakes : rng.int(0, product.captureCount),
            retakes: completed ? retakes : 0,
            printsRequested: completed ? product.printCount : 0,
            printsCompleted: completed ? product.printCount : 0,
            durationSec,
            commercial,
            softwareVersion: machine.softwareVersion ?? '0.1.0',
            bundleVersion,
            errors: outcome === 'failed' ? [{ code: 'print_failed', message: 'La impresora no respondió', at: iso(endedAtMs), stage: 'printing' }] : [],
            consents: [{ kind: 'service', given: true, at: iso(startedAtMs + 20_000), textVersion: 'v1' }],
            retention: {
              policyId: policy?.id ?? 'ret_delete_on_finish',
              mode: policy?.mode ?? 'none',
              deleteAt: policy?.durationMinutes === undefined ? iso(endedAtMs) : iso(endedAtMs + policy.durationMinutes * MINUTE),
              deletedAt: iso(endedAtMs + (policy?.durationMinutes ?? 0) * MINUTE + 5_000),
            },
            isDemo,
            operatorStarted: false,
            locale,
            editingUsed: completed && product.editing.enabled && rng.chance(0.4),
            editingTools: completed && product.editing.enabled && product.editing.allowedTools.length > 0 && rng.chance(0.4) ? [rng.pick(product.editing.allowedTools)] : [],
            abandonedAtStage: abandonedAt,
            campaignId: campaign?.id,
          }),
        );
      });
    }
  }
  return records.sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id));
}

