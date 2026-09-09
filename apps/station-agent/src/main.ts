/**
 * Arranque del agente con reloj e ids reales. `pnpm --filter @psp/station-agent start`.
 */
import { createAgent } from './agent';
import { buildServer } from './server';

async function main(): Promise<void> {
  const agent = await createAgent();
  const app = buildServer(agent, { logger: true });
  agent.start();
  const shutdown = async (): Promise<void> => {
    await app.close();
    await agent.stop();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
  await app.listen({ port: agent.config.port, host: '0.0.0.0' });
  app.log.info(
    `station-agent ${agent.config.softwareVersion} · machine ${agent.config.machineId} · bundle ${agent.bundles.source} ${agent.bundles.bundle.version.slice(0, 12)} · cloud ${agent.cloud ? agent.config.controlPlaneUrl : 'disabled'}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
