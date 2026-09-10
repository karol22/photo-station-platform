import { defineConfig } from 'vitest/config';

// Configuración raíz: cada paquete y app define sus pruebas con `*.test.ts`.
// `pnpm test` ejecuta todo; `pnpm gate:quick` ejecuta sólo los proyectos rápidos (packages y tools).
export default defineConfig({
  test: {
    projects: ['packages/*', 'tools/*', 'apps/*'],
  },
});
