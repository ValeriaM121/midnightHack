import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Redirect contract imports to our mock
      '@midnight-ntwrk/bboard-contract': '/src/mocks/contract-mock.js',
      // Redirect ledger WASM to our mock
      '@midnight-ntwrk/midnight-js-compact/midnight_ledger_wasm.js': '/src/mocks/ledger-mock.js',
      // Also catch the relative import
      '/@fs/home/imane_el_ayadi/example-bboard/node_modules/@midnight-ntwrk/midnight-js-compact/midnight_ledger_wasm.js': '/src/mocks/ledger-mock.js',
    }
  },
  optimizeDeps: {
    exclude: ['@midnight-ntwrk/midnight-js-compact', '@midnight-ntwrk/ledger-v8', '@midnight-ntwrk/onchain-runtime-v3'],
  },
});
