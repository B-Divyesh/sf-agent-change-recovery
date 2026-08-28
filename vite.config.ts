import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist/site',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: true
  },
  server: { port: 4173, strictPort: true }
});
