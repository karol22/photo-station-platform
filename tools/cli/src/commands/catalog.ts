import type { Command } from '../main';

export const catalogCommand: Command = {
  key: 'catalog',
  name: 'Catálogo',
  description: 'Imprime todas las capacidades registradas (apps, paquetes, features, adaptadores, claves, comandos, compuertas).',
  usage: 'catalog [--kind=<kind>] [--json]',
  async run(args) {
    const { completeCatalog } = await import('../main');
    let entries = await completeCatalog();
    const kind = args.flags['kind'];
    if (typeof kind === 'string') entries = entries.filter((e) => e.kind === kind);
    if (args.flags['json']) {
      console.log(JSON.stringify(entries, null, 2));
      return 0;
    }
    const byKind = new Map<string, typeof entries>();
    for (const e of entries) byKind.set(e.kind, [...(byKind.get(e.kind) ?? []), e]);
    for (const [k, list] of byKind) {
      console.log(`\n## ${k} (${list.length})`);
      for (const e of list) console.log(`  ${e.key.padEnd(40)} ${e.status.padEnd(8)} ${e.name}${e.description && e.description !== e.name ? ' — ' + e.description : ''}`);
    }
    console.log(`\n${entries.length} entradas`);
    return 0;
  },
};
