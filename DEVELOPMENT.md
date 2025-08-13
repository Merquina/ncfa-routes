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

