import type { Command } from '../main';

export const demoCommand: Command = {
  key: 'demo',
  name: 'Demo',
  description: 'Comprueba qué servicios están arriba y explica cómo demostrar los escenarios A–J.',
  usage: 'demo',
  async run() {
    const check = async (name: string, url: string) => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
        console.log(`  ${res.ok || res.status === 401 ? '🟢' : '🟠'} ${name.padEnd(16)} ${url} (${res.status})`);
      } catch {
        console.log(`  🔴 ${name.padEnd(16)} ${url} (sin respuesta)`);
      }
    };
    console.log('Servicios:');
    await check('control-plane', 'http://localhost:4000/admin/v1/auth/me');
    await check('station-agent', 'http://localhost:4100/station/v1/status');
    await check('kiosk', 'http://localhost:5173/');
    await check('admin', 'http://localhost:5174/');
    console.log('\nSi algo está en rojo: `pnpm seed` y luego `pnpm dev`.');
    console.log('Usuarios demo, PIN técnico y escenarios paso a paso: docs/operacion/como-correr.md');
    console.log('Escenarios de aceptación A–J: docs/requisitos-producto.md §49 y la matriz docs/trazabilidad.md');
    return 0;
  },
};
