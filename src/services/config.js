// Centralized configuration for Sheets access (pure ESM, bundler-agnostic)
// To override without rebuilding, you may define window.__APP_CONFIG before index.html loads modules:
// <script>window.__APP_CONFIG = { SPREADSHEET_ID: '...' };</script>

const winCfg = (typeof window !== "undefined" && window.__APP_CONFIG) || {};

// Keep these as plain constants so GH Pages/static ESM works without envs.
export const SPREADSHEET_ID =
  winCfg.SPREADSHEET_ID || "1yn3yPWW5ThhPvHzYiSkwwNztVnAQLD2Rk_QEQJwlr2k";
export const GOOGLE_API_KEY =
  winCfg.GOOGLE_API_KEY || "AIzaSyDXhmer7peHkeV2R9xJWr2FVLohKgCLEe8"; // Public API key for read-only access in dev mode

// Declarative table ranges for maintainability. Update here or via window.__APP_CONFIG.TABLE_RANGES.
export const TABLE_RANGES = (typeof window !== "undefined" &&
  winCfg.TABLE_RANGES) || {
  workers: [
    "WorkersHeaders",
    "Misc!Workers", // named range preferred
    "Workers", // global named range fallback
    "Misc!A:B", // explicit columns fallback (headers in first row)
  ],
  vehicles: ["VansHeaders", "Misc!Vehicles", "Vehicles", "Misc!D:E"],
  reminders: [
    "RemindersHeaders",
    "Misc!Reminders",
    "Reminders",
    "Misc!G:I", // Fallback to correct range G:I
  ],
};
