import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export function trackedFiles(root: string): string[] {
  const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: root,
    encoding: 'utf8',
  });
  return out.split('\n').filter(Boolean);
}

export function readText(root: string, rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

export function exists(root: string, rel: string): boolean {
  return existsSync(join(root, rel));
}

export function workspaceDirs(root: string): string[] {
  const dirs: string[] = [];
  for (const group of ['apps', 'packages', 'tools']) {
    const base = join(root, group);
    if (!existsSync(base)) continue;
    for (const name of readdirSync(base)) {
      const full = join(base, name);
      if (statSync(full).isDirectory() && existsSync(join(full, 'package.json'))) {
        dirs.push(`${group}/${name}`);
      }
    }
  }
  return dirs.sort();
}

export function walk(root: string, rel: string, filter: (p: string) => boolean): string[] {
  const base = join(root, rel);
  if (!existsSync(base)) return [];
  const out: string[] = [];
  const stack = [base];
  while (stack.length) {
    const dir = stack.pop()!;
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === 'dist' || entry === '.turbo') continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) stack.push(full);
      else if (filter(full)) out.push(full.slice(root.length + 1));
    }
  }
  return out.sort();
}
