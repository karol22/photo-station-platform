import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { ALL_GATES } from './src/gates';
import type { GateMode } from './src/types';

const mode = (process.argv[2] ?? 'quick') as GateMode;
const only = process.argv.slice(3);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

async function main() {
  const gates = ALL_GATES.filter((g) => g.modes.includes(mode) && (only.length === 0 || only.includes(g.key)));
  let failed = 0;
  const started = Date.now();
  for (const gate of gates) {
    const t0 = Date.now();
    let result;
    try {
      result = await gate.run({ root, mode });
    } catch (e) {
      result = { ok: false, messages: [`excepción: ${(e as Error).message}`] };
    }
    const ms = Date.now() - t0;
    console.log(`${result.ok ? '✅' : '❌'} ${gate.key} · ${gate.name} (${ms} ms)`);
    for (const m of result.messages) console.log(`   ${m}`);
    if (!result.ok) failed++;
  }
  console.log(`\n${gates.length - failed}/${gates.length} compuertas en verde (${mode}, ${Date.now() - started} ms)`);
  process.exit(failed ? 1 : 0);
}

main();
