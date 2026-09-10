import { fileURLToPath } from 'node:url';
/**
 * `pnpm --filter @psp/control-plane seed`: siembra `var/control-plane/control-plane.sqlite`
 * (o `PSP_VAR_DIR`) con `demoDataset()` de @psp/fixtures y reporta conteos.
 */
import { join } from 'node:path';
import { openControlPlaneDb } from '../src/store';
import { seedDatabase, type SeedDataset } from './index';

const varDir = join(process.env['PSP_VAR_DIR'] ?? fileURLToPath(new URL('../../../var', import.meta.url)), 'control-plane');

async function main(): Promise<void> {
  const moduleName = '@psp/fixtures';
  const fixtures = (await import(moduleName)) as {
    demoDataset: () => SeedDataset;
    DEMO_USERS: Array<{ id: string; email: string; passwordHash: string }>;
    DEMO_NOW?: string;
    assetContent?: (assetId: string) => { mime: string; bytes: Uint8Array };
  };
  const dataset = fixtures.demoDataset();
  const db = openControlPlaneDb(join(varDir, 'control-plane.sqlite'));
  const counts = seedDatabase(db, dataset, {
    now: new Date(fixtures.DEMO_NOW ?? Date.now()),
    users: fixtures.DEMO_USERS,
    assetsDir: join(varDir, 'assets'),
    ...(fixtures.assetContent ? { assetContent: fixtures.assetContent } : {}),
  });
  db.close();
  for (const [key, value] of Object.entries(counts)) console.log(`${key.padEnd(24)} ${value}`);
  console.log(`seeded ${join(varDir, 'control-plane.sqlite')}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
