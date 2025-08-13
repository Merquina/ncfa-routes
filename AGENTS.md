# Agent Guide: Architecture & Current State

Purpose
- Persist context for future sessions and guide changes safely.
- Summarize the modernized architecture, data flow, and where to extend.

System Overview
- App type: Vite + vanilla ES modules (no framework) with custom elements.
- Routing: Hash-based (src/components/hash-router.js).
- Data: Google Sheets via OAuth (src/services/sheets-api.js), aggregation + caching (src/services/data-service.js, src/services/local-store.js).
- UI: Custom elements + page controllers (src/components/*.js, src/pages/*.js, src/controllers/page-controller.js).
- Legacy: Some legacy JS remains (js/*). Modern app does not rely on window.sheetsAPI; it uses the ESM services.

Key Files
- src/services/sheets-api.js
  - OAuth via gapi.client; batchGet with fallback to per-range gets.
  - Discovers available sheet tabs, filters ranges accordingly.
  - ETag polling (range-level) with 429 backoff, logs change detection, dispatches `updated` events.
  - Memo: getAllWorkers() now keyed by `lastFetchTs` and lengths; memo cleared post-fetch.
  - Exports: `sheetsAPI`, `loadApiDataIfNeeded(force)`, `getDataSignature()`.
- src/services/data-service.js
  - Orchestrator and single point of truth for UI.
  - Ensures load via `loadApiData(force)` -> `loadApiDataIfNeeded(force)`.
  - Normalizes routes (SPFM/Recovery/Delivery/Routes sheet) and persists raw tables + caches to IndexedDB.
  - Emits lifecycle events: `loading-started`, `data-loaded`, `loading-finished`, `data-error`.
  - Exposes helpers (getWorkers(), getAllRoutes(), getWorkerIcons(), etc.).
- src/services/local-store.js
  - IndexedDB wrapper with `tables`, `caches`, `meta` stores.
  - Used to persist raw Sheets tables and precomputed caches (`normalizedRoutes`, `workersList`).
- src/components/hash-router.js
  - Registers routes, awaits data load on navigation (prevents racey empties).
  - Emits `route-changed` on path changes and `route-params-changed` when only query params change (no remount).
  - Exposes `refreshCurrentRoute(preserveScroll)` utility (not used by default; avoids racey remounts).
- src/pages/workers-page.js + src/controllers/page-controller.js
  - WorkersPageController: manages pickers and route list.
  - Listens to `data-loaded` (debounced) to repopulate: workers, volunteers (derived), route list.
  - Supports deep links via hash query: `#/workers?worker=Name` or `#/workers?volunteer=Name`.
  - Scrolls to the list once after `route-list` dispatches `routes-rendered`.
- src/components/worker-component.js
  - Displays a grid of selectable workers (also used for volunteers).
  - Worker picker contents are controller-driven on data updates (component no longer auto-subscribes to `data-loaded`).
- src/components/route-list.js
  - Renders grouped/filtered route cards.
  - Dispatches `routes-rendered` after layout (used for post-layout scroll).

Data Flow (cold start)
1) Router navigates -> awaits `dataService.loadApiData()`.
2) sheets-api fetches data, updates `lastFetchTs`, clears memos; data-service writes tables + caches to IndexedDB, normalizes routes.
3) data-service emits `data-loaded` -> page controllers update their UIs.
4) Workers page applies hash filter (if present), then scrolls to the list after `routes-rendered`.

Polling & Throttling
- ETag polling every ~20s with jitter (dev-friendly).
- On 429, reads Retry-After when present and backs off (up to 10m) with log `[Poll] 429 received. Backing off for N ms`.
- Resets to base interval after next successful refresh.
- Future option: single batchGet ETag polling (1 req/interval) if we want even fewer requests.

Caching & Memoization
- IndexedDB: persists raw tables and precomputed caches (normalized routes, workers list).
- Memo: workers memo invalidated on every successful fetch (includes `lastFetchTs` in key and cleared post-fetch).
- Signatures: data-service’s `getDataSignature()` delegates to sheets-api; currently considers `lastFetchTs` + table sizes.

Scrolling & Routing UX
- Hash router differentiates between path vs. query param changes:
  - Path change -> remount and `route-changed`.
  - Query change (same path) -> `route-params-changed` (no remount).
- Workers page only scrolls based on hash and after layout. It logs before/after scroll metrics for debugging.
- Avoid multiple scroll sources: button handlers update the hash only; the deep-link handler performs one scroll after layout.

Dev & Debugging
- Launch with Chromium DevTools: `npm run dev:chromium` (Flatpak).
- Service worker disabled on localhost to prevent HMR conflicts.
- Useful logs:
  - `[RouteList] routes-rendered …` when list is ready.
  - `[Scroll] Applying …`, `Before`, `After` messages in Workers controller.
  - Poll backoff logs and data-service normalization counts.

Known Issues / TODO
- Consider changing polling to single batch ETag mode for fewer requests (especially when many clients are open).
- Continue migrating off legacy js/* modules; `js/sheets.js` removed from index, but `js/util.js`, `js/assignments.js`, `js/inventory.js` remain.
- Scroll: if minor jumps persist on some platforms, consider scrolling to the first `.route-card` element, or scrolling container-local instead of window.
- Route Details: audit for live updates (contacts/phones); wire `data-loaded` if needed.
- Production SW: re-enable SW and cache strategy for prod while keeping dev experience clean.

Operational Tips
- Adding a new page:
  - Implement custom element and optional controller; register route in `app-layout` or via router helper.
  - Await data load on first render; subscribe to `data-loaded` for reactive updates.
  - If your UI is layout-sensitive, emit a `*-rendered` event post-layout and coordinate scroll/update after it.
- Updating Workers/Volunteers logic:
  - Use `dataService.getWorkers()` for workers; for volunteers, derive from normalized upcoming routes.
  - When Sheets change names but not counts, memos can mask updates—now mitigated by `lastFetchTs` and memo reset.

Configuration
- Environment variables via Vite:
  - `VITE_SPREADSHEET_ID` (currently defaulted in src/services/config.js if missing).
  - `VITE_GOOGLE_API_KEY` (optional; OAuth is the primary auth).

Troubleshooting
- Worker picker not updating:
  - Confirm a `data-loaded` event fired and Workers controller ran `refreshPickers()` in the console logs.
  - Verify `sheets-api` logs `lastFetchTs` changes and that `getAllWorkers()` recomputes (memo cleared, new key).
- Excessive remounting / scroll bounce:
  - Ensure only query params are changing; router will emit `route-params-changed` without remount.
  - Confirm only the deep-link handler triggers scroll, and after `routes-rendered`.
- 429s:
  - Expect temporary backoff; verify log shows increased poll interval.

Design Choices & Rationale
- ESM-first, minimal globals: `window.dataService` kept for legacy interop; new code uses imports.
- IndexedDB for tables/caches to make cold loads faster; keep derived memos invalidated post-fetch for correctness.
- Router awaits data on navigation to avoid empty initial renders and race conditions.
- Hash param change handling avoids route remounts, reducing jitter and event duplication.

Appendix: Quick Pointers
- Primary paths to inspect: `src/services/*.js`, `src/controllers/page-controller.js`, `src/components/hash-router.js`, `src/components/*`, `src/pages/*`, `index.html`.
- Dev command: `npm run dev` (or `npm run dev:chromium` to attach DevTools)

