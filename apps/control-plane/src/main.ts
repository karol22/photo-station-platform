import { fileURLToPath } from 'node:url';
/**
 * Arranque del servidor. Variables: `PSP_VAR_DIR` (raíz de estado, por defecto `var/` del repo; el control-plane usa `<PSP_VAR_DIR>/control-plane`),
 * `PORT` (4000), `HOST` (127.0.0.1), `PSP_SIMULATOR=1` para arrancar el simulador de flota.
 */
import { join } from 'node:path';
import { openControlPlaneDb } from './store';
import { createApp } from './app';

const varDir = join(process.env['PSP_VAR_DIR'] ?? fileURLToPath(new URL('../../../var', import.meta.url)), 'control-plane');
const port = Number(process.env['PORT'] ?? 4000);
const host = process.env['HOST'] ?? '127.0.0.1';

async function main(): Promise<void> {
  const db = openControlPlaneDb(join(varDir, 'control-plane.sqlite'));
  let fixtures: { generateFleet?: (base: unknown, count: number, seed: string) => never } | undefined;
  try {
    const moduleName = '@psp/fixtures';
    const loaded = (await import(moduleName)) as { generateFleet?: (base: unknown, count: number, seed: string) => never };
    fixtures = { generateFleet: loaded.generateFleet } as typeof fixtures;
  } catch {
    fixtures = undefined;
  }
  const { app, simulator } = await createApp({ db, assetsDir: join(varDir, 'assets'), logger: true, ...(fixtures ? { fixtures } : {}) });
  if (process.env['PSP_SIMULATOR'] === '1') simulator.start();
  await app.listen({ port, host });
  const shutdown = async (): Promise<void> => {
    await app.close();
    db.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

void main();
