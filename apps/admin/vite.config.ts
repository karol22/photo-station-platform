import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// La consola habla con el control-plane a través de `/admin/v1`; en desarrollo Vite lo reenvía
// al puerto 4000 para evitar CORS y para que el token viaje igual que en producción.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      '/admin': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
});
