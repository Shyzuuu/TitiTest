/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Mode « artifact » : un seul fichier HTML autonome (JS et CSS intégrés), routage en mémoire.
const artifact = process.env.VB_TARGET === 'artifact';

export default defineConfig({
  plugins: artifact ? [react(), viteSingleFile()] : [react()],
  define: { 'import.meta.env.VITE_ROUTER': JSON.stringify(artifact ? 'memory' : 'browser') },
  server: { host: '127.0.0.1', port: 5180 },
  preview: { host: '127.0.0.1', port: 4780 },
  build: {
    outDir: artifact ? 'dist-artifact' : 'dist',
    sourcemap: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: artifact
        ? {}
        : {
            // Recharts est lourd : chunk séparé pour accélérer le premier rendu.
            manualChunks: { charts: ['recharts'], vendor: ['react', 'react-dom', 'react-router-dom', 'zustand', 'zod'] },
          },
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.{ts,tsx}'],
  },
});
