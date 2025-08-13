import { defineConfig } from 'vite';

// Basic Vite config to serve index.html with HMR
export default defineConfig({
  server: {
    port: 5173,
    open: true,
  },
});

