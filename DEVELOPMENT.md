Local development and hot reloading
===================================

Two dev loops are available with HMR:

1) Main app (Vite)
- Install deps: `npm install`
- Start dev server: `npm run dev`
- Opens `http://localhost:5173` with hot reload for HTML/JS modules.

Notes:
- OAuth: ensure your Google OAuth client has `http://localhost:5173` in Authorized JavaScript origins.
- Token persistence and silent refresh are built-in (index.html). If you get re-prompts, re-check OAuth origins.

2) Storybook (Vite builder)
- Start Storybook: `npm run storybook`
- Opens `http://localhost:6008` with hot reload for components and stories.

Tips
- Components import under `src/components/*.js` hot reload with Vite.
- Page controllers reload as ES modules; state resets on full reload.
- For route navigation, use the bottom tabs (app) or switch stories (storybook).

Debug with Flatpak Chromium
---------------------------

To run the dev server and automatically launch the Flatpak-installed Chromium with Chrome DevTools remote debugging:

- Run: `npm run dev:chromium`

Details:
- The script waits for `http://localhost:5173` (configurable) and starts `org.chromium.Chromium` with `--remote-debugging-port=9222`.
- Override with env vars: `PORT` (default 5173), `DEV_URL` (full URL), `DEBUG_PORT` (default 9222).
- It disables Vite's auto-open via `VITE_OPEN=false` to avoid duplicate browser windows.
