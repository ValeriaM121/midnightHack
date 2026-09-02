import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {}
  },
  optimizeDeps: {
    exclude: ['@midnight-ntwrk/midnight-js-compact', '@midnight-ntwrk/ledger-v8', '@midnight-ntwrk/onchain-runtime-v3'],
  },
});
