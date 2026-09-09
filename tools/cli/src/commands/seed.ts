import type { Command } from '../main';

export const seedCommand: Command = {
  key: 'seed',
  name: 'Seed',
  description: 'Siembra el dataset demo en var/control-plane (usa --force para recrear la base).',
  usage: 'seed [--force] [--fleet=<n>]',
  async run(args) {
    const { spawnSync } = await import('node:child_process');
    const extra: string[] = [];
    if (args.flags['force']) extra.push('--force');
    if (typeof args.flags['fleet'] === 'string') extra.push(`--fleet=${args.flags['fleet']}`);
    const res = spawnSync('pnpm', ['--filter', '@psp/control-plane', 'seed', ...extra], { stdio: 'inherit' });
    return res.status ?? 1;
  },
};
