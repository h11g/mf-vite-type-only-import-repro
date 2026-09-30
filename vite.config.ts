import { federation } from '@module-federation/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    federation({
      name: 'remote',
      filename: 'remoteEntry.js',
      exposes: { './Widget': './src/Widget.ts' },
    }),
  ],
});
