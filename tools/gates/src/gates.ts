import { spawnSync } from 'node:child_process';
import type { Gate, GateResult } from './types';
import { exists, readText, trackedFiles, walk, workspaceDirs } from './fs';

const ok = (messages: string[] = []): GateResult => ({ ok: true, messages });
const fail = (messages: string[]): GateResult => ({ ok: false, messages });

/** 1. AGENTS.md mide menos de 12 000 caracteres. */
export const agentsSize: Gate = {
  key: 'agents-size',
  name: 'Tamaño de AGENTS.md',
  description: 'AGENTS.md mide menos de 12 000 caracteres.',
  modes: ['quick', 'full'],
  async run({ root }) {
    const size = Buffer.byteLength(readText(root, 'AGENTS.md'), 'utf8');
    return size < 12000 ? ok([`AGENTS.md: ${size} bytes`]) : fail([`AGENTS.md mide ${size} bytes (límite 12 000)`]);
  },
};

/** 2. Todo paquete y app tiene README con las tres secciones. */
export const readmes: Gate = {
  key: 'readmes',
  name: 'README por paquete',
  description: 'Todo paquete y app tiene README.md con Propósito, Cómo se usa y Cómo se prueba.',
  modes: ['quick', 'full'],
  async run({ root }) {
    const missing: string[] = [];
    for (const dir of workspaceDirs(root)) {
      if (!exists(root, `${dir}/README.md`)) {
        missing.push(`${dir}: falta README.md`);
        continue;
      }
      const text = readText(root, `${dir}/README.md`);
      for (const section of ['## Propósito', '## Cómo se usa', '## Cómo se prueba']) {
        if (!text.includes(section)) missing.push(`${dir}/README.md: falta la sección "${section}"`);
      }
      if (/pendiente de completar/i.test(text)) missing.push(`${dir}/README.md: sigue con el texto de plantilla`);
    }
    return missing.length ? fail(missing) : ok([`${workspaceDirs(root).length} paquetes con README completo`]);
  },
};

/** 3. Toda capacidad está registrada en el catálogo. */
export const catalogComplete: Gate = {
  key: 'catalog-complete',
  name: 'Catálogo completo',
  description: 'Features, capacidades, permisos, claves de configuración, apps, paquetes, comandos y compuertas están en el catálogo.',
  modes: ['quick', 'full'],
  async run({ root }) {
    let entries: Array<{ kind: string; key: string }>;
    try {
      const mod = (await import('@psp/catalog')) as { fullCatalog?: () => Promise<Array<{ kind: string; key: string }>>; CATALOG?: Array<{ kind: string; key: string }> };
      entries = mod.fullCatalog ? await mod.fullCatalog() : (mod.CATALOG ?? []);
    } catch (e) {
      return fail([`no se pudo cargar @psp/catalog: ${(e as Error).message}`]);
    }
    const contracts = await import('@psp/contracts');
    const has = (kind: string, key: string) => entries.some((e) => e.kind === kind && e.key === key);
    const problems: string[] = [];
    for (const k of contracts.FeatureKey.options) if (!has('feature', k)) problems.push(`feature sin registrar: ${k}`);
    for (const k of contracts.CapabilityKey.options) if (!has('capability', k)) problems.push(`capacidad sin registrar: ${k}`);
    for (const k of contracts.PermissionKey.options) if (!has('permission', k)) problems.push(`permiso sin registrar: ${k}`);
    for (const k of contracts.CONFIG_KEYS) if (!has('configKey', k.key)) problems.push(`clave de configuración sin registrar: ${k.key}`);
    for (const dir of workspaceDirs(root)) {
      const pkg = JSON.parse(readText(root, `${dir}/package.json`)) as { name: string };
      const kind = dir.startsWith('apps/') ? 'app' : 'package';
      if (!has(kind, pkg.name)) problems.push(`${kind} sin registrar: ${pkg.name}`);
    }
    for (const g of ALL_GATES) if (!has('gate', g.key)) problems.push(`compuerta sin registrar: ${g.key}`);
    return problems.length ? fail(problems) : ok([`${entries.length} entradas en el catálogo`]);
  },
};

/** 4. Paridad de claves es/en. */
export const i18nParity: Gate = {
  key: 'i18n-parity',
  name: 'Paridad i18n',
  description: 'Los catálogos es y en tienen exactamente las mismas claves (paquete i18n y extras de apps).',
  modes: ['quick', 'full'],
  async run({ root }) {
    const problems: string[] = [];
    const compare = (label: string, es: Record<string, unknown>, en: Record<string, unknown>) => {
      const a = new Set(Object.keys(es));
      const b = new Set(Object.keys(en));
      for (const k of a) if (!b.has(k)) problems.push(`${label}: falta en en: ${k}`);
      for (const k of b) if (!a.has(k)) problems.push(`${label}: falta en es: ${k}`);
    };
    try {
      const mod = (await import('@psp/i18n')) as { messages?: { es: Record<string, string>; en: Record<string, string> } };
      if (!mod.messages) problems.push('@psp/i18n no exporta messages');
      else compare('@psp/i18n', mod.messages.es, mod.messages.en);
    } catch (e) {
      problems.push(`no se pudo cargar @psp/i18n: ${(e as Error).message}`);
    }
    for (const app of ['apps/kiosk', 'apps/admin']) {
      const rel = `${app}/src/i18n/extra.ts`;
      if (!exists(root, rel)) continue;
      try {
        const mod = (await import(`${root}/${rel}`)) as { es?: Record<string, string>; en?: Record<string, string>; extra?: { es: Record<string, string>; en: Record<string, string> } };
        const es = mod.es ?? mod.extra?.es;
        const en = mod.en ?? mod.extra?.en;
        if (!es || !en) problems.push(`${rel}: debe exportar es y en (o extra.{es,en})`);
        else compare(rel, es, en);
      } catch (e) {
        problems.push(`${rel}: no se pudo cargar: ${(e as Error).message}`);
      }
    }
    return problems.length ? fail(problems) : ok(['catálogos es/en en paridad']);
  },
};

/** 5. Nada de marcas, precios ni ciudades literales en las UIs. */
export const noHardcodedBusinessText: Gate = {
  key: 'no-hardcoded-business-text',
  name: 'Sin texto de negocio en UIs',
  description: 'apps/kiosk/src y apps/admin/src no contienen nombres de marcas, ciudades ni precios del dataset demo.',
  modes: ['quick', 'full'],
  async run({ root }) {
    const forbidden = [/Una de Todos/i, /FotoR[aá]pida/i, /Monterrey/, /Quer[eé]taro/, /Bogot[aá]/, /Ciudad de M[eé]xico/, /\bLe[oó]n\b/, /\$\s?\d{2,}(\.\d{2})?\b/];
    const problems: string[] = [];
    for (const app of ['apps/kiosk/src', 'apps/admin/src']) {
      for (const file of walk(root, app, (p) => /\.(tsx?|css|html)$/.test(p) && !/\.test\.tsx?$/.test(p))) {
        const text = readText(root, file);
        for (const re of forbidden) {
          const m = text.match(re);
          if (m) problems.push(`${file}: contiene "${m[0]}"`);
        }
      }
    }
    return problems.length ? fail(problems) : ok(['UIs sin texto de negocio literal']);
  },
};

/** 6. Sin secretos en archivos versionados. */
export const noSecrets: Gate = {
  key: 'no-secrets',
  name: 'Sin secretos',
  description: 'Ningún archivo versionado contiene credenciales reconocibles.',
  modes: ['quick', 'full'],
  async run({ root }) {
    const patterns: Array<[string, RegExp]> = [
      ['AWS access key', /AKIA[0-9A-Z]{16}/],
      ['clave privada', /-----BEGIN (RSA|EC|OPENSSH|DSA) PRIVATE KEY-----/],
      ['token GitHub', /\bghp_[A-Za-z0-9]{36}\b/],
      ['token Slack', /\bxox[baprs]-[A-Za-z0-9-]{10,}/],
      ['clave OpenAI', /\bsk-[A-Za-z0-9]{32,}\b/],
      ['clave Stripe', /\b[sr]k_live_[A-Za-z0-9]{16,}\b/],
      ['Mercado Pago access token', /\bAPP_USR-\d{6,}-/],
    ];
    const problems: string[] = [];
    for (const file of trackedFiles(root)) {
      if (/\.(png|jpg|jpeg|gif|task|woff2?|ico|sqlite)$/i.test(file)) continue;
      if (file === 'pnpm-lock.yaml') continue;
      let text: string;
      try {
        text = readText(root, file);
      } catch {
        continue;
      }
      for (const [label, re] of patterns) if (re.test(text)) problems.push(`${file}: ${label}`);
    }
    return problems.length ? fail(problems) : ok(['sin secretos reconocibles']);
  },
};

/** 7. Trazabilidad válida. */
export const traceability: Gate = {
  key: 'traceability',
  name: 'Trazabilidad',
  description: 'docs/trazabilidad.md referencia secciones existentes de los requisitos con estados válidos.',
  modes: ['quick', 'full'],
  async run({ root }) {
    if (!exists(root, 'docs/trazabilidad.md')) return fail(['falta docs/trazabilidad.md']);
    const req = readText(root, 'docs/requisitos-producto.md');
    const headings = new Set<string>();
    for (const line of req.split('\n')) {
      const m = line.match(/^#{1,3}\s+(\d+(?:\.\d+)?)\.?\s/);
      if (m?.[1]) headings.add(m[1]);
      const e = line.match(/^##\s+Escenario\s+([A-J])\b/);
      if (e?.[1]) headings.add(`49.${e[1]}`);
    }
    const problems: string[] = [];
    let rows = 0;
    for (const line of readText(root, 'docs/trazabilidad.md').split('\n')) {
      const m = line.match(/^\|\s*([0-9]+(?:\.[0-9A-J]+)?)\s*\|(.*)$/);
      if (!m) continue;
      rows++;
      const section = m[1]!;
      if (!headings.has(section)) problems.push(`sección inexistente en requisitos: ${section}`);
      const cells = m[2]!.split('|').map((c) => c.trim());
      const status = cells[1] ?? '';
      if (!['completo', 'parcial', 'pendiente'].includes(status)) problems.push(`sección ${section}: estado inválido "${status}"`);
    }
    if (rows === 0) problems.push('la matriz no tiene filas');
    return problems.length ? fail(problems) : ok([`${rows} filas de trazabilidad válidas`]);
  },
};

/** 8. Evidencia en el progreso. */
export const progressEvidence: Gate = {
  key: 'progress-evidence',
  name: 'Evidencia en progreso',
  description: 'Cada fila hecha de ops/state/PROGRESS.md tiene evidencia.',
  modes: ['quick', 'full'],
  async run({ root }) {
    const problems: string[] = [];
    for (const line of readText(root, 'ops/state/PROGRESS.md').split('\n')) {
      const cells = line.split('|').map((c) => c.trim());
      if (cells.length < 6 || !/^\d+$/.test(cells[1] ?? '')) continue;
      const [, id, , status, evidence] = cells;
      if (!['hecho', 'en curso', 'pendiente', 'bloqueado'].includes(status ?? '')) problems.push(`paso ${id}: estado inválido "${status}"`);
      if (status === 'hecho' && !(evidence ?? '').trim()) problems.push(`paso ${id}: hecho sin evidencia`);
    }
    return problems.length ? fail(problems) : ok(['progreso con evidencia']);
  },
};

/** 9. Validación en los bordes. */
export const validationAtEdges: Gate = {
  key: 'validation-at-edges',
  name: 'Validación en bordes',
  description: 'control-plane, station-agent y kiosk validan entradas de red con safeParse.',
  modes: ['quick', 'full'],
  async run({ root }) {
    const problems: string[] = [];
    const checks: Array<[string, string]> = [
      ['apps/control-plane/src', 'control-plane'],
      ['apps/station-agent/src', 'station-agent'],
      ['apps/kiosk/src/api', 'kiosk (cliente del agente)'],
      ['apps/admin/src/api', 'admin (cliente de la API)'],
    ];
    for (const [dir, label] of checks) {
      const files = walk(root, dir, (p) => /\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p));
      if (files.length === 0) {
        problems.push(`${label}: no hay código en ${dir}`);
        continue;
      }
      const uses = files.some((f) => readText(root, f).includes('safeParse'));
      if (!uses) problems.push(`${label}: ningún archivo en ${dir} usa safeParse`);
    }
    return problems.length ? fail(problems) : ok(['validación con safeParse presente en los bordes']);
  },
};

/** Documentos que se conservan tal cual vienen de fuera y no se reescriben. */
const VERBATIM_DOCS = [
  'requisitos-producto.md',
  'estandares/repositorio-listo-para-agentes.md',
  'estandares/ingenieria-de-producto-con-agentes.md',
];

/** 10. Documentación en presente. */
export const docsPresentTense: Gate = {
  key: 'docs-present-tense',
  name: 'Docs en presente',
  description: 'La documentación no contiene bitácora de cambios ("antes era", "anteriormente", "previously", "used to").',
  modes: ['quick', 'full'],
  async run({ root }) {
    const forbidden = [/\bantes era\b/i, /\banteriormente\b/i, /\bpreviously\b/i, /\bused to\b/i];
    const problems: string[] = [];
    const files = [
      // Se excluyen los documentos que se conservan íntegros de una fuente externa: la regla del
      // presente gobierna la prosa propia, no lo que sólo se guarda tal cual.
      ...walk(root, 'docs', (p) => p.endsWith('.md') && !VERBATIM_DOCS.some((v) => p.endsWith(v))),
      ...workspaceDirs(root).map((d) => `${d}/README.md`).filter((f) => exists(root, f)),
      'AGENTS.md',
      'README.md',
    ];
    for (const file of files) {
      const text = readText(root, file);
      for (const re of forbidden) {
        const m = text.match(re);
        if (m) problems.push(`${file}: contiene "${m[0]}"`);
      }
    }
    return problems.length ? fail(problems) : ok([`${files.length} documentos en presente`]);
  },
};

function runPnpm(root: string, args: string[]): GateResult {
  const res = spawnSync('pnpm', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const tail = (res.stdout + res.stderr).split('\n').filter(Boolean).slice(-25);
  return res.status === 0 ? ok([`pnpm ${args.join(' ')} ok`]) : fail([`pnpm ${args.join(' ')} falló`, ...tail]);
}

/** 11. Typecheck de paquetes (quick) o de todo (full). */
export const typecheck: Gate = {
  key: 'typecheck',
  name: 'Typecheck',
  description: 'Los paquetes compilan (quick); todo compila (full).',
  modes: ['quick', 'full'],
  async run({ root, mode }) {
    return mode === 'quick'
      ? runPnpm(root, ['-r', '--filter', './packages/*', '--filter', './tools/*', 'typecheck'])
      : runPnpm(root, ['-r', 'typecheck']);
  },
};

/** 12. Pruebas unitarias. */
export const unitTests: Gate = {
  key: 'unit-tests',
  name: 'Pruebas unitarias',
  description: 'Pruebas de packages y tools (quick) o de todo el repo (full).',
  modes: ['quick', 'full'],
  async run({ root, mode }) {
    return mode === 'quick'
      ? runPnpm(root, ['-r', '--filter', './packages/*', '--filter', './tools/*', 'test'])
      : runPnpm(root, ['-r', 'test']);
  },
};

/** 13. Build de apps (sólo full). */
export const buildApps: Gate = {
  key: 'build-apps',
  name: 'Build de apps',
  description: 'kiosk y admin construyen con Vite.',
  modes: ['full'],
  async run({ root }) {
    return runPnpm(root, ['-r', '--filter', './apps/*', 'build']);
  },
};

export const ALL_GATES: Gate[] = [
  agentsSize,
  readmes,
  i18nParity,
  noHardcodedBusinessText,
  noSecrets,
  traceability,
  progressEvidence,
  validationAtEdges,
  docsPresentTense,
  catalogComplete,
  typecheck,
  unitTests,
  buildApps,
];
