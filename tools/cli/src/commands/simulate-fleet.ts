import type { Command } from '../main';

export const simulateFleetCommand: Command = {
  key: 'simulate-fleet',
  name: 'Simular flota',
  description: 'Crea N máquinas virtuales en el control-plane en ejecución (envían heartbeats y progresan rollouts).',
  usage: 'simulate-fleet --count=<n> [--org=<id>] [--url=http://localhost:4000]',
  async run(args) {
    const url = typeof args.flags['url'] === 'string' ? args.flags['url'] : 'http://localhost:4000';
    const count = Number(args.flags['count'] ?? 100);
    const email = typeof args.flags['email'] === 'string' ? args.flags['email'] : 'owner@platform.demo';
    const password = typeof args.flags['password'] === 'string' ? args.flags['password'] : 'demo';
    const login = await fetch(`${url}/admin/v1/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
    if (!login.ok) {
      console.error(`login falló (${login.status}). ¿Está corriendo el control-plane en ${url}?`);
      return 1;
    }
    const { token } = (await login.json()) as { token: string };
    const body: Record<string, unknown> = { count, heartbeats: true };
    if (typeof args.flags['org'] === 'string') body['organizationId'] = args.flags['org'];
    const res = await fetch(`${url}/admin/v1/fleet/simulate`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    const text = await res.text();
    console.log(res.ok ? `flota simulada: ${text.slice(0, 500)}` : `error ${res.status}: ${text.slice(0, 500)}`);
    return res.ok ? 0 : 1;
  },
};
