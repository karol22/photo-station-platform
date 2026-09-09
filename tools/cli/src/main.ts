import { ALL_GATES, GATE_CATALOG } from '@psp/gates';
import type { CatalogEntry } from '@psp/contracts';
import { fullCatalog } from '@psp/catalog';
import { catalogCommand } from './commands/catalog';
import { seedCommand } from './commands/seed';
import { bundleCommand } from './commands/bundle';
import { simulateFleetCommand } from './commands/simulate-fleet';
import { demoCommand } from './commands/demo';
import { parseArgs } from './args';

export interface Command {
  key: string;
  name: string;
  description: string;
  usage: string;
  run(args: ReturnType<typeof parseArgs>): Promise<number>;
}

export const COMMANDS: Command[] = [catalogCommand, seedCommand, bundleCommand, simulateFleetCommand, demoCommand];

export const CLI_CATALOG: CatalogEntry[] = COMMANDS.map((c) => ({
  kind: 'command',
  key: `psp ${c.key}`,
  name: c.name,
  description: c.description,
  package: '@psp/cli',
  status: 'stable',
  docs: 'tools/cli/README.md',
}));

/** Catálogo completo incluyendo comandos y compuertas (la vista que imprime `pnpm catalog`). */
export async function completeCatalog(): Promise<CatalogEntry[]> {
  return fullCatalog([...CLI_CATALOG, ...GATE_CATALOG]);
}

function help(): void {
  console.log('pnpm psp <comando> [opciones]\n');
  for (const c of COMMANDS) console.log(`  ${c.usage.padEnd(44)} ${c.description}`);
  console.log(`  ${'gates [quick|full]'.padEnd(44)} Ejecuta las compuertas (${ALL_GATES.length} registradas)`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const key = args.positional[0];
  if (!key || key === '--help' || key === 'help') {
    help();
    return;
  }
  if (key === 'gates') {
    const { spawnSync } = await import('node:child_process');
    const res = spawnSync('pnpm', ['exec', 'tsx', 'tools/gates/run.ts', args.positional[1] ?? 'quick'], { stdio: 'inherit' });
    process.exit(res.status ?? 1);
  }
  const cmd = COMMANDS.find((c) => c.key === key);
  if (!cmd) {
    console.error(`comando desconocido: ${key}\n`);
    help();
    process.exit(2);
  }
  process.exit(await cmd.run(args));
}

const isMain = process.argv[1]?.endsWith('main.ts') || process.argv[1]?.endsWith('main.js');
if (isMain) main();
