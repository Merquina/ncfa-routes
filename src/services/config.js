// Centralized configuration for Sheets access (pure ESM, bundler-agnostic)
// To override without rebuilding, you may define window.__APP_CONFIG before index.html loads modules:
// <script>window.__APP_CONFIG = { SPREADSHEET_ID: '...' };</script>

const winCfg = (typeof window !== 'undefined' && window.__APP_CONFIG) || {};

// Keep these as plain constants so GH Pages/static ESM works without envs.
export const SPREADSHEET_ID = winCfg.SPREADSHEET_ID || "1yn3yPWW5ThhPvHzYiSkwwNztVnAQLD2Rk_QEQJwlr2k";
export const GOOGLE_API_KEY = winCfg.GOOGLE_API_KEY || ""; // OAuth used; API key optional
