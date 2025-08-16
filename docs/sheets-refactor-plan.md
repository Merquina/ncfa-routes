# Google Sheets Refactor Plan (Header-Driven, One-Table-Per-Sheet)

## Objectives
- Reduce brittleness from hardcoded ranges/column names and ad-hoc aliasing.
- Make Sheets structure easy to evolve (add/reorder columns, add series like volunteer4) without code changes.
- Maintain fast cold loads and live updates.
- Provide clear seams so new contributors (and AI coding assistants) can “hack by example”.

## Current State (Summary)
- Data pulled from multiple tabs: SPFM, Routes, Recovery, SPFM_Delivery, Status, Contacts, Misc (workers/vehicles/reminders).
- Fetching already uses batchGet + fallback; ETag polling with 429 backoff exists.
- Parsing mixes header detection with bespoke logic and alias lookups.
- IndexedDB persists raw tables + derived caches; signature uses `lastFetchTs` + data lengths.
- Series fields (worker1..N, volunteer1..N, etc.) handled with while loops; casing/order can be brittle.

## Problems
- Hardcoded ranges like `SPFM!A:T` and per-sheet parse paths create upkeep.
- Post-hoc aliasing (`_getField([...aliases])`) spreads column-name permutations across the codebase.
- “Misc” multiplexes multiple datasets; requires brittle fallbacks.
- Components occasionally bypass the data facade and call `window.sheetsAPI` directly.

## Target Model
1) One logical table per sheet (or stable named ranges when splitting is not feasible yet).
2) Headers in the first non-empty row define schema; columns are normalized once at load.
3) Series columns discovered by regex over normalized headers (e.g., `^worker\d+$`).
4) Schema persisted with a header hash; caches keyed by header hash + row count for correctness.
5) Components/pages consume normalized objects via `dataService` only.

## Column Normalization Rules
- Normalize header to canonical key:
  - `lowercase` → strip diacritics → replace non-alphanum with `_` → collapse `_` → trim `_`.
  - Apply synonym map after normalization.
- Example synonyms (extensible):
  - `routeid|id|route_id` → `route_id`
  - `market|location` → `market`
  - `routetype|type|route_type|route type` → `route_type`
  - `starttime|time` → `start_time`
  - `dropoff|drop_off|drop off|destination` → `drop_off`
- Series detection (case/spacing agnostic):
  - `^worker\d+$`, `^volunteer\d+$`, `^van\d+$`, `^contact\d+$`, `^phone\d+$`.

## Data Model (Normalized Route)
- Canonical route keys (examples): `route_id`, `date`, `weekday`, `market`, `route_type`, `start_time`, `drop_off`.
- Arrays precomputed at ingestion: `workers[]`, `volunteers[]`, `vans[]`, `contacts[]`, `phones[]`.
- Derived display fields: `displayDate`, `sortDate`.

## IndexedDB & Signatures
- Tables persisted with rows and optional `schema` metadata (or via `meta` store):
  - `headers_raw`, `headers_norm`, `raw_to_norm`, `norm_to_raw`, `header_hash`.
- Data signature expanded to include, per-table: `{ header_hash, rowCount }` + `lastFetchTs`.
- Caches (`normalizedRoutes`, `workersList`, optional indexes) keyed by the expanded signature.

## Polling Improvements
- Keep value-range ETag polling at ~20s + jitter (dev-friendly).
- Add header-only polling (`Sheet!1:1`) every 5–10 minutes. On header change (etag), refetch, re-normalize, refresh caches.

## Spreadsheet Maintainer Guidelines
- One table per sheet (preferred). If not possible, define named ranges: `WorkersHeaders`, `VansHeaders`, `RemindersHeaders` (header row included).
- Header row must be the first non-empty row; avoid merged header cells.
- Series columns: use consistent names `worker1..N`, `volunteer1..N`, `van1..N`, `contact1..N`, `phone1..N` (case/spacing flexible).
- Reordering/adding columns is safe post-normalization. Removing required columns (`route_id`, `date|weekday`) requires coordination.
- Sheet/tab renames require updating named ranges or config.
- Prefer ISO dates (`YYYY-MM-DD`) or a consistent locale.

## Data Layer Changes (Implementation Sketch)
- `sheets-api.js` additions:
  - `normalizeHeaderName(name, synonyms)`
  - `computeHeaderHash(headersRaw)`
  - `rowsToObjectsNormalized(values, synonyms) → { rows, schema }`
  - `fetchSheetAsTable(rangeOrSheet, spec)`; `getTable(name)`; `listTables()`
  - `getSeries(obj, base)` (regex-based)
  - Replace bespoke parsers to emit normalized rows and arrays (workers/volunteers/vans/contacts/phones).
- `data-service.js`:
  - Prefer normalized keys directly; keep `_getField` only as fallback during rollout.
  - Expose helper APIs: `getWorkers()`, `getVolunteersUpcoming()`, `getRoutesByWorker()`, `getRoutesByVolunteer()`.
  - Persist tables + caches + per-table schema and expanded signature.

## Separation & Freshness
- Components use `dataService` only; no direct `window.sheetsAPI`/gapi.
- Add focus/online refresh triggers: force reload if last fetch is “old enough” (e.g., 60s).

## Backwards Compatibility & Rollout
- Feature flag: `useNormalizedTables` (default off for one release).
- During rollout: log schemas and signatures; keep `data-loaded` events.
- Flip default after validation; remove widespread use of `_getField` aliases.

## Validation & Observability
- On load, validate required keys exist; warn with table name and `header_hash`.
- Dev logs: source ranges/named ranges used, per-table `{header_hash,rowCount}`, poll backoff.
- Optional dev overlay/page to inspect schema and counts.

## Step-by-Step Migration
1. Implement header normalization + `rowsToObjectsNormalized`; compute per-table schema and header hash.
2. Move SPFM, Routes, Recovery, Delivery, Status, Contacts to the generic loader.
3. Parse series to arrays at ingestion; update `getAllWorkersFromRoute` etc. to use arrays.
4. Persist schemas and expanded signatures; update cache validation.
5. Add focus/online refresh triggers.
6. Migrate components to use `dataService` only (remove `window.sheetsAPI` usage).
7. Enable header-only polling for schema changes.
8. Flip feature flag; remove alias sprawl.

## Risks & Mitigations
- Schema detection ambiguity → keep named ranges as authoritative when present; log detections.
- Legacy code paths lingering → ast-grep checks to block `window.sheetsAPI` usage outside services.
- Cache staleness → expanded signatures + header polling.

## Acceptance Criteria
- Adding/reordering columns in Sheets does not require code changes.
- Adding `volunteer4` (or `Volunteer 4`) shows up automatically.
- Caches invalidate on header changes or row count changes.
- Components and pages only import/consume `dataService`.

## Appendix
- Example `TABLE_RANGES` named ranges: `WorkersHeaders`, `VansHeaders`, `RemindersHeaders`.
- Example normalized keys: `route_id`, `market`, `route_type`, `start_time`, `drop_off`.
- Example data signature: `lastFetchTs|SPFM{hash:...,rows:n}|Routes{hash:...,rows:n}|...`.

