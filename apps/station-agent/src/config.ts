import { fileURLToPath } from 'node:url';
/**
 * Configuración del proceso desde variables de entorno. Todo tiene valor por defecto para que
 * `pnpm start` arranque en modo standalone sin ninguna variable.
 */
export interface AgentConfig {
  machineId: string;
  port: number;
  controlPlaneUrl: string;
  varDir: string;
  techPin: string;
  softwareVersion: string;
}

export const DEFAULT_MACHINE_ID = 'mch_demo_doc_01';
export const DEFAULT_TECH_PIN = '2468';

export function loadConfig(env: Record<string, string | undefined> = process.env): AgentConfig {
  const port = Number(env['PSP_STATION_AGENT_PORT'] ?? '4100');
  return {
    machineId: env['PSP_STATION_MACHINE_ID'] || DEFAULT_MACHINE_ID,
    port: Number.isFinite(port) && port > 0 ? port : 4100,
    controlPlaneUrl: (env['PSP_CONTROL_PLANE_URL'] || 'http://localhost:4000').replace(/\/+$/, ''),
    varDir: env['PSP_VAR_DIR'] || fileURLToPath(new URL('../../../var', import.meta.url)),
    techPin: env['PSP_STATION_TECH_PIN'] || DEFAULT_TECH_PIN,
    softwareVersion: env['PSP_SOFTWARE_VERSION'] || '0.1.0',
  };
}
