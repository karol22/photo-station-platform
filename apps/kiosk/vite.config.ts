import { createReadStream, existsSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

/**
 * Sirve los binarios WASM de MediaPipe bajo `/wasm/` en desarrollo y los copia a `dist/wasm/` en
 * build. La carpeta se resuelve desde el paquete instalado, sin copiar nada al repo.
 */
function mediapipeWasm(): Plugin {
  const require = createRequire(import.meta.url);
  // El paquete no exporta `package.json`; se parte del módulo principal (en la raíz del paquete).
  const wasmDir = join(dirname(require.resolve('@mediapipe/tasks-vision')), 'wasm');
  let outDir = resolve('dist');
  return {
    name: 'psp:mediapipe-wasm',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use('/wasm', (req, res, next) => {
        const name = (req.url ?? '').split('?')[0]?.replace(/^\/+/, '') ?? '';
        if (!/^[\w.-]+$/.test(name)) {
          next();
          return;
        }
        const file = join(wasmDir, name);
        if (!existsSync(file)) {
          next();
          return;
        }
        res.setHeader('Content-Type', name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
        res.setHeader('Cache-Control', 'no-cache');
        createReadStream(file).pipe(res);
      });
    },
    closeBundle() {
      if (!existsSync(wasmDir)) return;
      const target = join(outDir, 'wasm');
      mkdirSync(target, { recursive: true });
      for (const file of readdirSync(wasmDir)) copyFileSync(join(wasmDir, file), join(target, file));
    },
  };
}

// El kiosco sólo habla con el agente local: en desarrollo, Vite reenvía `/station` al agente.
export default defineConfig({
  plugins: [react(), mediapipeWasm()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/station': { target: 'http://localhost:4100', changeOrigin: false },
    },
  },
  preview: {
    port: 5173,
    proxy: {
      '/station': { target: 'http://localhost:4100', changeOrigin: false },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
});
