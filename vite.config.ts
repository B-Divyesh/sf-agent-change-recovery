import { defineConfig } from 'vite';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const injectOfflineAssets = {
  name: 'inject-offline-assets',
  closeBundle() {
    const assets = readdirSync('dist/site/assets')
      .filter(name => /\.(?:js|css)$/.test(name))
      .map(name => `/assets/${name}`);
    const path = 'dist/site/sw.js';
    const source = readFileSync(path, 'utf8');
    writeFileSync(path, source.replace('const BUILD_ASSETS = [];', `const BUILD_ASSETS = ${JSON.stringify(assets)};`));
  }
};

export default defineConfig({
  plugins: [injectOfflineAssets],
  build: {
    outDir: 'dist/site',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: true
  },
  server: { port: 4173, strictPort: true }
});
