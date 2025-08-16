# Reminders Fix & Integration Plan

## Objectives
- Ensure route details and the Reminders dashboard reliably display reminders/materials.
- Make the Reminders parsing tolerant to header variations and sheet layout.
- Centralize reminder access through the data facade for consistency and testability.

## Current Findings
- `sheets-api` parses Reminders into buckets: `dropoff`, `atoffice`, `backatoffice`, `atmarket`, `materials_office`, `materials_storage`, and supports a `backAtOffice` alias for compatibility.
- `route-details` did not render reminder sections at all (placeholder method).
- `reminders-page` expected camelCase (`atMarket`, `backAtOffice`) but the parser exposed lowercase keys for those two, so they rendered empty.
- Components directly called `window.sheetsAPI`.

## Data Model (Reminders)
- Sheet expectations:
  - First row headers; no merged cells.
  - Key column: `key|keys|context|contexts|name|names` (any of these).
  - Any subset of columns (case-insensitive):
    - `dropoff|drop off|drop-off`
    - `at office|office|at_office`
    - `back at office|back office|backatoffice|backAtOffice`
    - `at market|market|atmarket|atMarket`
    - `materials_office|materials office`
    - `materials_storage|materials storage`
  - Cell values may contain multi-line/semicolon/comma-separated lists.
- Parser behavior (`_parseReminders`):
  - Builds records `{ keys: [...], dropoff:[], atoffice:[], backatoffice:[], atmarket:[], materials_office:[], materials_storage:[], backAtOffice:[] }`.
  - Fallback mode: if only `key` + `notes` columns present, treats `notes` as `dropoff`.
  - Accepts a Reminders sheet tab, named ranges (`RemindersHeaders`, `Misc!Reminders`, `Reminders`), or auto-detection in `Misc`.

## UI Integration Plan
1) Route Details (`route-details`)
   - Render the reminder buckets in sections if present (implemented).
   - Tolerate both `atMarket/atmarket` and `backAtOffice/backatoffice`.
2) Reminders Dashboard (`reminders-page`)
   - When loading a generic SPFM checklist, try common global keys in order: `{ market: 'all'|'any'|'spfm' }` and `{ type: 'spfm' }`.
   - Read both camelCase and lowercase bucket names (implemented for At Market + Back at Office).
3) Centralize access
   - Add `dataService.getRemindersForRoute(routeOrKey)` that delegates to `sheetsAPI` but hides schema quirks.
   - Update components/pages to use `dataService` (remove direct `window.sheetsAPI` usage).

## Sheets Guidance
- Recommended: dedicate a `Reminders` sheet with a clear header row.
- If using `Misc`, define a named range (e.g., `RemindersHeaders`) that includes the header row and the data block; the app prefers named ranges over scanning.
- Use a `key` or `keys` column to associate rows (e.g., `SPFM`, `Recovery`, a market name, or `all/any`). Multiple keys allowed (comma/semicolon/newline separated).
- Put materials/tasks in the appropriate columns as newline/semicolon/comma lists.

## Step-by-Step Implementation
1) Fix rendering (done):
   - Implement reminder sections in `route-details`.
   - Make `reminders-page` tolerant to `atmarket/backatoffice` vs camelCase.
2) Centralize APIs:
   - Add `getRemindersForRoute()` to `dataService` and match the bucket shape; deprecate direct `window.sheetsAPI` calls in components/pages.
3) Validation & logs:
   - On Reminders load, log: source range (sheet or named range), detected columns, number of rows, first 1–2 sample keys.
   - Warn if no key column or no recognized reminder columns found.
4) UX polish (optional):
   - In route details, only show sections with content.
   - In the Reminders dashboard, show counts and friendly “No items” messages (already present).
5) Tests/manual checks:
   - Case variations: `At Market` vs `atmarket` must both render.
   - Keying: verify `all`, specific market, and type keys match.
   - Fallback mode: with only `key + notes`, verify drop-off list renders.

## Acceptance Criteria
- Route details show reminders sections whenever the route’s keys match at least one Reminders row with content.
- Reminders dashboard displays Office/Storage/At Market/Back at Office lists for global SPFM keys when present.
- Adding/changing Reminders columns (case/spacing) does not require code changes.
- Components obtain reminders only through `dataService`.

## Future Enhancements
- Header normalization: unify bucket names and key lookup using the same normalization rules as other tables.
- Admin/editor view: basic UI to preview and test Reminders mappings live (helpful for spreadsheet maintainers).
- Batch ETag polling optimization: add a low-frequency header-only ETag for the Reminders sheet to detect schema changes efficiently.

