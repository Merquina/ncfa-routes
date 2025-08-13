**Scope**
- Consolidate data access, reduce duplicate processing, and migrate away from legacy tab-based UI toward component pages with a central DataService and IndexedDB cache.

**Key Changes Implemented**
- Logging normalization: Replaced noisy `console.log` with `debug/info/warn/error` across JS files for filterable logs.
- IndexedDB store: Added `src/services/local-store.js` to persist raw tables and precomputed caches.
- DataService caching: `src/services/data-service.js`
  - Memoizes normalized routes and workers list; adds signature-based cache using `__lastSheetsFetchTs` and source lengths.
  - Persists normalized routes and workers in IndexedDB for fast subsequent loads.
  - Populates tables and caches in IndexedDB on `loadApiData()`.
- Worker list memoization: `js/sheets.js#getAllWorkers()` now returns cached results keyed by data sizes.
- Modern routing focus:
  - `index.html`: loads component bundle (`src/components/index.js`) and registers routes for `/boxes`, `/dates`, `/workers`, `/route`.
  - `src/components/hash-router.js`: defers setup by a tick and retries route loads briefly to avoid "Route not found" races; triggers `dataService.loadApiData()` non‑blocking on route loads.
  - `src/components/app-layout.js`: registers default routes on mount if none are present; keeps bottom tabs.
  - Removed legacy `js/app.js` from `index.html` to avoid duplicate routing and repeated API loads.
- Utilities: Added `js/util.js` to expose `normalizeText`, `flexibleTextMatch`, and `flexibleTextIncludes` globally for legacy helpers without reintroducing legacy routing.

**Files Most Affected**
- `index.html` (routing boot, removed legacy app.js, added util.js, OAuth showMainApp now triggers modern load)
- `src/services/data-service.js` (IDB integration, caching, robust API load)
- `src/services/local-store.js` (new)
- `src/components/hash-router.js` (retry + data load on route)
- `src/components/app-layout.js` (register default routes)
- `src/components/index.js` (safe auto-route registration fallback)
- `js/sheets.js`, `js/dates.js`, `js/assignments.js`, `js/inventory.js`, `js/app.js` (log levels, memoization; legacy app.js no longer loaded)

**Current Symptoms**
- Routes sometimes not populating on `/dates` and `/workers` despite successful OAuth.
- Logs show reduced noise, but normalized routes occasionally reported as 0 before data load completes.

**Likely Causes (In-Progress Migration)**
- Boot order/race: Component pages/controllers may request data before `dataService` has kicked off or finished `loadApiData()`.
- Route registration timing: Router initializes before routes registered; added retries mitigate but timing can still race with OAuth show.

**Stabilization Steps Implemented**
- Router now retries route loads for ~2s and triggers `dataService.loadApiData()` on every route change.
- `showMainApp()` triggers `dataService.loadApiData()` (with retries) once the app becomes visible after OAuth.

**Recommended Next Steps (Post-Restart)**
- Verify boot sequence with a clean refresh:
  - Sign in → land on Boxes → tap By Date → confirm Sheets fetch once and routes render.
- Remove remaining legacy diagnostics in `index.html` (old "❌ workersManager not loaded" lines).
- Add two small caches in `DataService` (optional but high value):
  - Upcoming routes cache keyed by signature.
  - Worker assignments cache keyed by signature + worker name.
- Defer heavy contact/address lookups to on-demand and cache by location in `DataService`.
- Once stable, remove legacy `js/workers.js` and `js/dates.js` completely from the bundle.

**Rollback (If Needed Quickly)**
- Temporarily re-add `js/app.js` in `index.html` to restore legacy load behavior while keeping logging and caching improvements. This will reintroduce duplicate routing and extra loads, so only use as a temporary fallback.

**Testing/Verification Hints**
- After sign-in, confirm:
  - Sheets logs: one fetch cycle (“Fetching fresh data…”, fallbacks OK for missing tabs).
  - `data-service.js`: “Normalized routes: N” with N > 0.
  - `/dates` shows upcoming routes; `/workers` shows worker picker; selecting a worker filters list.

**Open Items**
- Occasional route not found on deep links prior to registration; mitigated by router retry, but worth simplifying route registration (single bootstrap module) to remove timing variance.
- Favicon 404 (harmless; add `/favicon.ico` or silence).

**Notes**
- The IndexedDB store currently holds: SPFM, Routes, Recovery, SPFM_Delivery, Status, Contacts, Misc_Workers, Misc_Vehicles, plus caches (normalizedRoutes, workersList) and `dataSignature`.
- TTL-based refresh in legacy path replaced by explicit `dataService.loadApiData()` triggers from router + OAuth show to make load points explicit.

**Planned Bootstrap Module (To Implement Next)**
- Create a small bootstrap script (single module) that:
  - Registers all routes once (boxes/dates/workers/route) against `<hash-router>`.
  - Triggers `dataService.loadApiData()` at the right lifecycle points: after OAuth success (showMainApp) and on first route activation.
  - Provides unified status logging (start/finish, route counts) without legacy checks.
  - Removes timing variance currently split between index.html, app-layout, and index.js.
- After implementing, remove backup auto-registrations to avoid duplication.

**Live Debugging Note**
- We are in the middle of debugging route population timing.
- An MCP server is being added to enable direct interaction with Chrome DevTools from the assistant.
  - Will use it to inspect network requests, console traces, and performance timings in-browser to finalize the fix.
