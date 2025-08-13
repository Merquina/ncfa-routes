import { defineConfig } from 'vite';

// Basic Vite config to serve index.html with HMR
export default defineConfig({
  server: {
    port: 5173,
    // Allow disabling auto-open via env to avoid double-opening when
    // launching a specific browser (e.g., Flatpak Chromium).
    open: process.env.VITE_OPEN === 'false' || process.env.DISABLE_OPEN ? false : true,
    host: '0.0.0.0',
    hmr: {
      clientPort: 5173,
      protocol: 'ws',
      host: 'localhost',
    },
  },
});
