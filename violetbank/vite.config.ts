/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Cibles : « artifact » (un seul fichier HTML, routage en mémoire) et « android »
// (ressources relatives embarquées dans l'APK Capacitor, routage par ancre).
const target = process.env.VB_TARGET;
const artifact = target === 'artifact';
const android = target === 'android';

export default defineConfig({
  plugins: artifact ? [react(), viteSingleFile()] : [react()],
  base: android ? './' : '/',
  define: {
    'import.meta.env.VITE_ROUTER': JSON.stringify(artifact ? 'memory' : android ? 'hash' : 'browser'),
  },
  server: { host: '127.0.0.1', port: 5180 },
  preview: { host: '127.0.0.1', port: 4780 },
  build: {
    outDir: artifact ? 'dist-artifact' : android ? 'dist-android' : 'dist',
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
