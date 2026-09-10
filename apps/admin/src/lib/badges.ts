/**
 * Mapeo estado → tono semántico de `Badge`. Centralizado para que máquinas, incidencias,
 * rollouts, campañas, releases y sesiones se lean igual en toda la consola.
 */
export type Tone = 'neutral' | 'ok' | 'warn' | 'danger' | 'info';

const MACHINE: Record<string, Tone> = {
  configuring: 'info',
  active: 'ok',
  active_with_warnings: 'warn',
  maintenance: 'warn',
  out_of_service: 'danger',
  disconnected: 'danger',
  retired: 'neutral',
  storage: 'neutral',
  demo: 'info',
  suspended: 'danger',
};

const INCIDENT: Record<string, Tone> = {
  open: 'danger',
  investigating: 'warn',
  awaiting_visit: 'warn',
  awaiting_part: 'warn',
  resolved: 'ok',
  closed: 'neutral',
};

const SEVERITY: Record<string, Tone> = { low: 'neutral', medium: 'info', high: 'warn', critical: 'danger' };

const ROLLOUT: Record<string, Tone> = {
  draft: 'neutral',
  scheduled: 'info',
  in_progress: 'info',
  paused: 'warn',
  completed: 'ok',
  failed: 'danger',
  cancelled: 'neutral',
};

const MACHINE_RELEASE: Record<string, Tone> = {
  pending: 'neutral',
  downloading: 'info',
  ready: 'info',
  installing: 'info',
  completed: 'ok',
  failed: 'danger',
  rolled_back: 'warn',
  paused: 'warn',
  up_to_date: 'ok',
};

const CAMPAIGN: Record<string, Tone> = {
  draft: 'neutral',
  scheduled: 'info',
  active: 'ok',
  finished: 'neutral',
  cancelled: 'danger',
};

const GENERIC: Record<string, Tone> = {
  active: 'ok',
  inactive: 'neutral',
  draft: 'neutral',
  published: 'ok',
  archived: 'neutral',
  withdrawn: 'danger',
  suspended: 'danger',
  pending: 'info',
  invited: 'info',
  deprecated: 'warn',
  temporary: 'info',
  closed: 'neutral',
  planned: 'info',
  completed: 'ok',
  cancelled: 'neutral',
  failed: 'danger',
  expired: 'warn',
  abandoned: 'warn',
  enabled: 'ok',
  hidden: 'neutral',
  locked: 'warn',
  coming_soon: 'info',
  ready: 'ok',
  busy: 'info',
  no_paper: 'danger',
  jam: 'danger',
  error: 'danger',
  offline: 'danger',
  unknown: 'neutral',
  info: 'info',
  warning: 'warn',
};

export type StatusKind = 'machine' | 'incident' | 'severity' | 'rollout' | 'machineRelease' | 'campaign' | 'generic';

const TABLES: Record<StatusKind, Record<string, Tone>> = {
  machine: MACHINE,
  incident: INCIDENT,
  severity: SEVERITY,
  rollout: ROLLOUT,
  machineRelease: MACHINE_RELEASE,
  campaign: CAMPAIGN,
  generic: GENERIC,
};

/** Tono para un estado; cae al mapa genérico y por último a `neutral`. */
export function statusTone(status: string | undefined | null, kind: StatusKind = 'generic'): Tone {
  if (!status) return 'neutral';
  return TABLES[kind][status] ?? GENERIC[status] ?? 'neutral';
}

export function onlineTone(online: boolean): Tone {
  return online ? 'ok' : 'danger';
}
