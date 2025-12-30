// ESM Sheets API service used by DataService. Avoids window globals.
import {
  SPREADSHEET_ID,
  GOOGLE_API_KEY as API_KEY,
  TABLE_RANGES,
} from "./config.js";

// Minimal text helpers (mirrors js/util.js behavior)
function normalizeText(str) {
  return (str == null ? "" : String(str))
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
function flexibleTextMatch(a, b) {
  return normalizeText(a) === normalizeText(b);
}
function flexibleTextIncludes(haystack, needle) {
  return normalizeText(haystack).includes(normalizeText(needle));
}

class SheetsAPIService extends EventTarget {
  constructor() {
    super();
    this.data = [];
    this.routesData = [];
    this.recoveryData = [];
    this.deliveryData = [];
    this.inventoryData = [];
    this.contactsData = [];
    this.miscWorkers = [];
    this.miscWorkerMap = {};
    this.miscVehicles = [];
    this.miscVehicleMap = {};
    this.miscReminders = [];
    this.marketSummary = [];
    this.vanCapacity = [];
    this.isLoading = false;
    this._workersCacheKey = null;
    this._workersCache = null;
    this.lastFetchTs = 0;
    this._etagByRange = new Map();
    this._pollTid = null;
    this._tableSources = { workers: null, vehicles: null, reminders: null };
    this._dynamicTableRanges = null; // from optional Tables sheet mapping
  }

  async ensureGapiClientReady(maxWaitMs = 5000) {
    const start = Date.now();
    while (!window.gapi || !window.gapi.client || !window.gapi.client.sheets) {
      if (Date.now() - start > maxWaitMs) break;
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  async fetchSheetData() {
    if (this.isLoading) return;
    this.isLoading = true;
    try {
      await this.ensureGapiClientReady();
      // Discover available sheets and only request those ranges
      await this._discoverAvailableSheets().catch(() => {});
      console.info("Fetching fresh data from Google Sheets (OAuth, batch)...");
      const ranges = this._computeExistingRanges();
      await this._batchFetchAll(ranges);
      this.lastFetchTs = Date.now();
      // Invalidate memoized caches derived from raw tables
      this._workersCache = null;
      this._workersCacheKey = null;
      try {
        this.dispatchEvent(
          new CustomEvent("updated", {
            detail: { lastFetchTs: this.lastFetchTs },
          })
        );
      } catch {}
      return this.data;
    } catch (e) {
      console.error("❌ Error loading spreadsheet data:", e);
      throw e;
    } finally {
      this.isLoading = false;
    }
  }

  async _discoverAvailableSheets() {
    const resp = await window.gapi.client.sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      fields: "sheets(properties(title))",
    });
    const titles = (resp.result?.sheets || [])
      .map((s) => s.properties?.title)
      .filter(Boolean);
    this._availableSheets = new Set(titles);
  }

  _computeExistingRanges() {
    const want = [
      ["SPFM", "SPFM!A:T"],
      ["Routes", "Routes!A:Z"],
      ["Recovery", "Recovery!A:P"],
      ["SPFM_Delivery", "SPFM_Delivery!A:P"],
      ["Status", "Status!A:E"],
      ["Contacts", "Contacts!A:Z"],
      ["Misc", "Misc!A:B"],
      ["Misc", "Misc!D:E"],
    ];
    const has = (name) =>
      !this._availableSheets ||
      this._availableSheets.size === 0 ||
      this._availableSheets.has(name);
    return want.filter(([name]) => has(name)).map(([, range]) => range);
  }

  async authorizedFetch(url, init = {}) {
    const token = window.gapi?.client?.getToken?.();
    if (!token || !token.access_token)
      throw new Error("No auth token available");
    const headers = new Headers(init.headers || {});
    headers.set("Authorization", `Bearer ${token.access_token}`);
    return fetch(url, { ...init, headers });
  }

  async checkRangeVersion(range) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(
      range
    )}?fields=range`;
    const prev = this._etagByRange.get(range);
    const resp = await this.authorizedFetch(url, {
      method: "GET",
      headers: prev ? { "If-None-Match": prev } : undefined,
    });
    if (resp.status === 304) return { changed: false, etag: prev };
    if (resp.status === 429) {
      const ra = resp.headers.get("Retry-After");
      const retryAfterMs = ra ? parseInt(ra, 10) * 1000 : 60000;
      const err = new Error("Rate limited (429)");
      err.code = 429;
      err.retryAfterMs = retryAfterMs;
      throw err;
    }
    const etag =
      resp.headers.get("ETag") ||
      resp.headers.get("Etag") ||
      resp.headers.get("etag");
    if (etag && etag !== prev) {
      this._etagByRange.set(range, etag);
      return { changed: true, etag };
    }
    return { changed: false, etag };
  }

  startVersionPolling(intervalMs = 60000, ranges = null) {
    if (this._pollTid) {
      clearTimeout(this._pollTid);
      this._pollTid = null;
    }
    this._pollIntervalMs = intervalMs;
    const tick = async () => {
      try {
        let anyChanged = false;
        const baseRanges =
          ranges && ranges.length ? ranges : this._computeExistingRanges();
        for (const r of baseRanges) {
          try {
            const res = await this.checkRangeVersion(r);
            if (res.changed) anyChanged = true;
          } catch (e) {
            if (e && e.code === 429) {
              // Apply backoff and break early
              const waitMs =
                e.retryAfterMs ||
                Math.min((this._pollIntervalMs || 60000) * 2, 10 * 60000);
              this._pollIntervalMs = waitMs;
              console.warn(
                "[Poll] 429 received. Backing off for",
                waitMs,
                "ms"
              );
              break;
            }
          }
        }
        if (anyChanged) {
          console.info("Detected sheet change via ETag — refreshing data");
          await this.fetchSheetData();
          // Reset backoff after a successful refresh
          this._pollIntervalMs = intervalMs;
        }
      } catch (e) {
        console.warn("Version poll failed:", e);
      }
      // schedule next with small jitter (up to 25% of interval)
      const base = this._pollIntervalMs || intervalMs;
      const jitter = Math.floor(Math.random() * (base * 0.25));
      this._pollTid = setTimeout(tick, base + jitter);
    };
    // initial delay small to avoid hammering immediately
    const initialJitter = Math.floor(Math.random() * 1500);
    this._pollTid = setTimeout(tick, 2000 + initialJitter);
    return () => {
      if (this._pollTid) clearTimeout(this._pollTid);
      this._pollTid = null;
    };
  }

  async _batchFetchAll(ranges) {
    let result;
    try {
      const resp = await window.gapi.client.sheets.spreadsheets.values.batchGet(
        {
          spreadsheetId: SPREADSHEET_ID,
          ranges,
        }
      );
      result = resp.result;
    } catch (e) {
      console.warn("Batch get failed, falling back to individual fetches:", e);
      // Fallback to individual fetches
      const tryGet = async (range) => {
        try {
          return await window.gapi.client.sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range,
          });
        } catch {
          return null;
        }
      };
      if (!this._availableSheets || this._availableSheets.has("SPFM")) {
        const spfmResp = await tryGet("SPFM!A:T");
        this._parseSPFM(spfmResp?.result?.values || []);
      }
      const tasks = [];
      if (!this._availableSheets || this._availableSheets.has("Routes"))
        tasks.push(this.fetchRoutesData());
      if (!this._availableSheets || this._availableSheets.has("Recovery"))
        tasks.push(this.fetchRecoveryData());
      if (!this._availableSheets || this._availableSheets.has("SPFM_Delivery"))
        tasks.push(this.fetchDeliveryData());
      if (!this._availableSheets || this._availableSheets.has("Status"))
        tasks.push(this.fetchInventoryData());
      if (!this._availableSheets || this._availableSheets.has("Contacts"))
        tasks.push(this.fetchContactsData());
      if (!this._availableSheets || this._availableSheets.has("Misc"))
        tasks.push(this.fetchMiscData());
      await Promise.all(tasks);
      return;
    }

    const valueRanges = result.valueRanges || [];
    const map = new Map(valueRanges.map((vr) => [vr.range.split("!")[0], vr]));

    this._parseSPFM(map.get("SPFM")?.values || []);

    // Routes consolidated parsing
    try {
      const routesValues = map.get("Routes")?.values || [];
      this.routesData = [];
      if (routesValues.length > 0) {
        const values = routesValues;
        let headers = null;
        const looksLikeHeader = (row) => {
          const lower = row.map((c) =>
            (c || "").toString().trim().toLowerCase()
          );
          return (
            lower.includes("date") ||
            lower.includes("weekday") ||
            lower.includes("routeid") ||
            lower.includes("market") ||
            lower.includes("route")
          );
        };
        const isEmptyRow = (row) =>
          !row || row.every((c) => !c || String(c).trim() === "");
        for (let i = 0; i < values.length; i++) {
          const row = values[i];
          if (isEmptyRow(row)) continue;
          if (looksLikeHeader(row)) {
            headers = row;
            continue;
          }
          if (!headers) continue;
          const obj = {};
          headers.forEach((h, idx) => (obj[h] = row[idx] || ""));
          const isHeaderEcho = Object.keys(obj).every(
            (k) => String(obj[k]).trim() === String(k).trim() || obj[k] === ""
          );

          // Filter out cancelled routes - check worker and volunteer fields specifically
          const isCancelled = (() => {
            // Check Worker field
            const worker = String(obj.Worker || obj.worker || "")
              .toLowerCase()
              .trim();
            if (worker === "cancelled") return true;

            // Check Volunteer field
            const volunteer = String(obj.Volunteer || obj.volunteer || "")
              .toLowerCase()
              .trim();
            if (volunteer === "cancelled") return true;

            // Check numbered worker/volunteer fields
            for (let i = 1; i <= 10; i++) {
              const workerN = String(obj[`worker${i}`] || "")
                .toLowerCase()
                .trim();
              if (workerN === "cancelled") return true;

              const volunteerN = String(obj[`volunteer${i}`] || "")
                .toLowerCase()
                .trim();
              if (volunteerN === "cancelled") return true;
            }

            return false;
          })();

          if (!isHeaderEcho && !isCancelled) this.routesData.push(obj);
        }
      }
    } catch (e) {
      console.warn("Routes parse failed:", e);
      this.routesData = [];
    }

    // Recovery
    try {
      const values = map.get("Recovery")?.values || [];
      this.recoveryData = [];
      if (values.length >= 2) {
        const headers = values[0];
        this.recoveryData = values.slice(1).map((row) => {
          const obj = {};
          headers.forEach((h, i) => (obj[h] = row[i] || ""));
          return obj;
        });
      } else if (this.routesData.length) {
        const headers = (map.get("Routes")?.values || [])[0] || [];
        const idxType = headers.indexOf("routeType");
        if (idxType >= 0) {
          this.recoveryData = (map.get("Routes")?.values || [])
            .slice(1)
            .filter((r) => /recovery/i.test(r[idxType] || ""))
            .map((row) => {
              const obj = {};
              headers.forEach((h, i) => (obj[h] = row[i] || ""));
              obj.type = "recovery";
              return obj;
            });
        }
      }
    } catch (e) {
      console.warn("Recovery parse failed:", e);
      this.recoveryData = [];
    }

    // Delivery
    try {
      const values = map.get("SPFM_Delivery")?.values || [];
      this.deliveryData = [];
      if (values.length >= 2) {
        const headers = values[0];
        this.deliveryData = values.slice(1).map((row) => {
          const obj = {};
          headers.forEach((h, i) => (obj[h] = row[i] || ""));
          return obj;
        });
      } else if (this.routesData.length) {
        const routesValues = map.get("Routes")?.values || [];
        const headers = routesValues[0] || [];
        const idxType = headers.indexOf("routeType");
        if (idxType >= 0) {
          this.deliveryData = routesValues
            .slice(1)
            .filter((r) => /delivery/i.test(r[idxType] || ""))
            .map((row) => {
              const obj = {};
              headers.forEach((h, i) => (obj[h] = row[i] || ""));
              obj.type = "spfm-delivery";
              return obj;
            });
        }
      }
    } catch (e) {
      console.warn("Delivery parse failed:", e);
      this.deliveryData = [];
    }

    // Inventory (Status)
    try {
      const values = map.get("Status")?.values || [];
      this.inventoryData = [];
      if (values.length >= 2) {
        const headers = values[0];
        this.inventoryData = values.slice(1).map((row) => {
          const obj = {};
          headers.forEach((h, i) => (obj[h] = row[i] || ""));
          return obj;
        });
      }
    } catch (e) {
      console.warn("Status parse failed:", e);
      this.inventoryData = [];
    }

    // Contacts
    try {
      const values = map.get("Contacts")?.values || [];
      this.contactsData = [];
      if (values.length >= 2) {
        const headers = values[0];
        this.contactsData = values.slice(1).map((row) => {
          const obj = {};
          headers.forEach((h, i) => (obj[h] = row[i] || ""));
          return obj;
        });
      }
    } catch (e) {
      console.warn("Contacts parse failed:", e);
      this.contactsData = [];
    }

    // Reminders tab (if present as a SHEET; named ranges handled in fetchMiscData)
    try {
      const values = map.get("Reminders")?.values || [];
      if (values.length) {
        this._parseReminders(values);
      }
    } catch (e) {
      /* optional */
    }

    // Misc
    try {
      await this.fetchMiscData();
    } catch {}

    // Announcements (Market Summary and Van Capacity)
    try {
      await this.fetchAnnouncementsData();
    } catch {}

    // Schema summary log for quick diagnostics (headers + sources)
    try {
      const hdr = (name) => (map.get(name)?.values || [])[0] || [];
      console.info("[Schema] Tables loaded:", {
        SPFM: { headers: hdr("SPFM"), rows: (this.data || []).length },
        Routes: {
          headers: hdr("Routes"),
          rows: (this.routesData || []).length,
        },
        Recovery: {
          headers: hdr("Recovery"),
          rows: (this.recoveryData || []).length,
        },
        SPFM_Delivery: {
          headers: hdr("SPFM_Delivery"),
          rows: (this.deliveryData || []).length,
        },
        Status: {
          headers: hdr("Status"),
          rows: (this.inventoryData || []).length,
        },
        Contacts: {
          headers: hdr("Contacts"),
          rows: (this.contactsData || []).length,
        },
        Sources: { ...this._tableSources },
      });
    } catch {}
  }

  // ===== Public API fallback for dev mode (no OAuth) =====
  async _fetchWithPublicAPI() {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values:batchGet?ranges=SPFM!A:T&ranges=Routes!A:Z&ranges=Recovery!A:P&ranges=SPFM_Delivery!A:P&ranges=Status!A:E&ranges=Contacts!A:Z&ranges=Misc!A:B&ranges=Misc!D:E&key=${API_KEY}`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Public API failed: ${resp.statusText}`);
    const data = await resp.json();

    const map = new Map(
      (data.valueRanges || []).map((vr) => [vr.range.split("!")[0], vr])
    );

    this._parseSPFM(map.get("SPFM")?.values || []);

    // Simple parsing for other sheets
    const parseSheet = (name) => {
      const values = map.get(name)?.values || [];
      if (values.length < 2) return [];
      const headers = values[0];
      return values.slice(1).map((row) => {
        const obj = {};
        headers.forEach((h, i) => (obj[h] = row[i] || ""));
        return obj;
      });
    };

    this.routesData = parseSheet("Routes");
    this.recoveryData = parseSheet("Recovery");
    this.deliveryData = parseSheet("SPFM_Delivery");
    this.inventoryData = parseSheet("Status");
    this.contactsData = parseSheet("Contacts");

    this.miscWorkers = [];
    this.miscVehicles = [];
    this.miscReminders = [];

    console.info("[Public API] Successfully loaded basic data");
  }

  // ===== Declarative table helpers (maintainable) =====
  async _getFirstNonEmptyRange(possibleRanges) {
    for (const range of possibleRanges) {
      try {
        // If the range looks like a header-only named range, expand it downward to include data
        if (/headers$/i.test(range)) {
          const expanded = await this._valuesFromHeaderNamedRange(range);
          if (expanded && expanded.values && expanded.values.length > 0)
            return expanded;
        }
        // Regular named range or A1 notation
        const resp = await window.gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range,
        });
        const values = resp.result?.values || [];
        if (Array.isArray(values) && values.length > 0)
          return { range, values };
      } catch {}
    }
    return { range: null, values: [] };
  }

  async _valuesFromHeaderNamedRange(name) {
    try {
      // Fetch metadata to resolve the named range's grid and sheet
      const meta = await window.gapi.client.sheets.spreadsheets.get({
        spreadsheetId: SPREADSHEET_ID,
        fields: "sheets(properties(sheetId,title)),namedRanges(name,range)",
      });
      const sheetsById = {};
      (meta.result?.sheets || []).forEach((s) => {
        sheetsById[s.properties.sheetId] = s.properties.title;
      });
      const nr = (meta.result?.namedRanges || []).find(
        (n) => (n.name || "").toLowerCase() === String(name).toLowerCase()
      );
      if (!nr || !nr.range || nr.range.sheetId == null) return null;
      const title = sheetsById[nr.range.sheetId];
      if (!title) return null;
      const startRow = (nr.range.startRowIndex || 0) + 1; // A1 row
      const startCol = nr.range.startColumnIndex || 0;
      const endColExclusive = nr.range.endColumnIndex || startCol + 1;
      const colToA1 = (n) => {
        let s = "";
        n++;
        while (n) {
          let m = (n - 1) % 26;
          s = String.fromCharCode(65 + m) + s;
          n = Math.floor((n - 1) / 26);
        }
        return s;
      };
      const c1 = colToA1(startCol);
      const c2 = colToA1(endColExclusive - 1);
      // Read from header row to bottom of sheet for the header's column span
      const a1 = `${title}!${c1}${startRow}:${c2}`; // column-range from header row down
      const resp = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: a1,
      });
      let values = resp.result?.values || [];
      if (!values.length) return null;
      // Trim trailing empty rows (within the selected columns)
      const lastNonEmpty = (() => {
        let last = 0;
        for (let i = 0; i < values.length; i++) {
          const row = values[i] || [];
          const has = row.some((v) => String(v || "").trim() !== "");
          if (has) last = i;
        }
        return last;
      })();
      values = values.slice(0, lastNonEmpty + 1);
      return { range: a1, values };
    } catch {
      return null;
    }
  }
  _objectsFromTable(values) {
    if (!Array.isArray(values) || values.length < 2) return [];
    const headers = (values[0] || []).map((h) => (h || "").toString().trim());
    return values.slice(1).map((row) => {
      const obj = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] || "";
      });
      return obj;
    });
  }

  _parseSPFM(values) {
    if (!values || values.length < 2) {
      this.data = [];
      return;
    }
    let headerIndex = 0;
    for (let i = 0; i < Math.min(values.length, 10); i++) {
      const row = values[i].map((c) => (c || "").toString().toLowerCase());
      if (
        row.includes("date") ||
        row.includes("routeid") ||
        row.includes("market")
      ) {
        headerIndex = i;
        break;
      }
    }
    const headers = values[headerIndex];
    this.data = values
      .slice(headerIndex + 1)
      .filter((row) => row && row.length > 0 && row[0])
      .map((row) => {
        const obj = {};
        headers.forEach((h, i) => (obj[h] = row[i] || ""));
        return obj;
      });
    console.info(`✅ Processed ${this.data.length} routes from SPFM tab`);
  }

  async fetchRecoveryData() {
    try {
      await this.ensureGapiClientReady();
      const recoveryRange = "Recovery!A:P";
      let result;
      try {
        const resp = await window.gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: recoveryRange,
        });
        result = resp.result;
      } catch (e) {
        result = null;
      }
      if (result && result.values && result.values.length >= 2) {
        const headers = result.values[0];
        this.recoveryData = result.values.slice(1).map((row) => {
          const obj = {};
          headers.forEach((h, i) => (obj[h] = row[i] || ""));
          return obj;
        });
        return;
      }
      // Derive from Routes
      const routesRange = "Routes!A:Z";
      const routesResp =
        await window.gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: routesRange,
        });
      const rValues = routesResp.result?.values || [];
      if (rValues.length < 2) {
        this.recoveryData = [];
        return;
      }
      const rHeaders = rValues[0];
      const idxType = rHeaders.indexOf("routeType");
      this.recoveryData = rValues
        .slice(1)
        .filter(
          (row) =>
            idxType >= 0 && (row[idxType] || "").toLowerCase() === "recovery"
        )
        .map((row) => {
          const obj = {};
          rHeaders.forEach((h, i) => (obj[h] = row[i] || ""));
          obj.type = "recovery";
          return obj;
        });
    } catch (e) {
      console.info("Recovery data not available:", e);
      this.recoveryData = [];
    }
  }
  async fetchDeliveryData() {
    try {
      await this.ensureGapiClientReady();
      const deliveryRange = "SPFM_Delivery!A:P";
      let result;
      try {
        const resp = await window.gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: deliveryRange,
        });
        result = resp.result;
      } catch (e) {
        result = null;
      }
      if (result && result.values && result.values.length >= 2) {
        const headers = result.values[0];
        this.deliveryData = result.values.slice(1).map((row) => {
          const obj = {};
          headers.forEach((h, i) => (obj[h] = row[i] || ""));
          return obj;
        });
        return;
      }
      // Derive from Routes
      const routesRange = "Routes!A:Z";
      const routesResp =
        await window.gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: routesRange,
        });
      const rValues = routesResp.result?.values || [];
      if (rValues.length < 2) {
        this.deliveryData = [];
        return;
      }
      const rHeaders = rValues[0];
      const idxType = rHeaders.indexOf("routeType");
      this.deliveryData = rValues
        .slice(1)
        .filter((row) => idxType >= 0 && /delivery/i.test(row[idxType] || ""))
        .map((row) => {
          const obj = {};
          rHeaders.forEach((h, i) => (obj[h] = row[i] || ""));
          obj.type = "spfm-delivery";
          return obj;
        });
    } catch (e) {
      console.info("SPFM Delivery data not available:", e);
      this.deliveryData = [];
    }
  }
  async fetchInventoryData() {
    try {
      await this.ensureGapiClientReady();
      const inventoryRange = "Status!A:E";
      const resp = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: inventoryRange,
      });
      const result = resp.result;
      if (!result.values || result.values.length < 2) {
        this.inventoryData = [];
        return;
      }
      const headers = result.values[0];
      this.inventoryData = result.values.slice(1).map((row) => {
        const obj = {};
        headers.forEach((h, i) => (obj[h] = row[i] || ""));
        return obj;
      });
    } catch (e) {
      console.info("Inventory data not available:", e);
      this.inventoryData = [];
    }
  }
  async fetchContactsData() {
    try {
      await this.ensureGapiClientReady();
      const contactsRange = "Contacts!A:Z";
      const resp = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: contactsRange,
      });
      const result = resp.result;
      const values = result.values;
      if (!values || values.length === 0) {
        this.contactsData = [];
        return;
      }
      const headers = values[0];
      this.contactsData = values.slice(1).map((row) => {
        const contact = {};
        headers.forEach((h, i) => (contact[h] = row[i] || ""));
        return contact;
      });
    } catch (e) {
      console.error("❌ Error fetching contacts data:", e);
      this.contactsData = [];
    }
  }
  async fetchRoutesData() {
    try {
      await this.ensureGapiClientReady();
      const routesRange = "Routes!A:Z";
      const resp = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: routesRange,
      });
      const result = resp.result;
      this.routesData = [];
      if (!result.values || result.values.length === 0) {
        this.routesData = [];
        return;
      }
      const values = result.values;
      let headers = null;
      const looksLikeHeader = (row) => {
        const lower = row.map((c) => (c || "").toString().trim().toLowerCase());
        return (
          lower.includes("date") ||
          lower.includes("weekday") ||
          lower.includes("routeid") ||
          lower.includes("market") ||
          lower.includes("route")
        );
      };
      const isEmptyRow = (row) =>
        !row || row.every((c) => !c || String(c).trim() === "");
      for (let i = 0; i < values.length; i++) {
        const row = values[i];
        if (isEmptyRow(row)) continue;
        if (looksLikeHeader(row)) {
          headers = row;
          continue;
        }
        if (!headers) continue;
        const obj = {};
        headers.forEach((h, idx) => {
          obj[h] = row[idx] || "";
        });
        const isHeaderEcho = Object.keys(obj).every(
          (k) => String(obj[k]).trim() === String(k).trim() || obj[k] === ""
        );
        if (isHeaderEcho) continue;

        // Filter out cancelled routes - check worker and volunteer fields specifically
        const isCancelled = (() => {
          // Check Worker field
          const worker = String(obj.Worker || obj.worker || "")
            .toLowerCase()
            .trim();
          if (worker === "cancelled") return true;

          // Check Volunteer field
          const volunteer = String(obj.Volunteer || obj.volunteer || "")
            .toLowerCase()
            .trim();
          if (volunteer === "cancelled") return true;

          // Check numbered worker/volunteer fields
          for (let i = 1; i <= 10; i++) {
            const workerN = String(obj[`worker${i}`] || "")
              .toLowerCase()
              .trim();
            if (workerN === "cancelled") return true;

            const volunteerN = String(obj[`volunteer${i}`] || "")
              .toLowerCase()
              .trim();
            if (volunteerN === "cancelled") return true;
          }

          return false;
        })();

        if (isCancelled) continue;

        this.routesData.push(obj);
      }
    } catch (e) {
      console.info("Routes sheet not available:", e);
      this.routesData = [];
    }
  }

  async fetchAnnouncementsData() {
    await this._ensureTableMappings();
    const pickRanges = (key) => {
      const dyn = this._dynamicTableRanges && this._dynamicTableRanges[key];
      if (typeof dyn === "string" && dyn.trim()) return [dyn.trim()];
      if (Array.isArray(dyn) && dyn.length) return dyn;
      return TABLE_RANGES[key] || [];
    };

    // Fetch Market Summary with formatting
    try {
      const ranges = pickRanges("announcements");
      const range = ranges[0]; // Use first range

      const { values, colors } =
        await this._getFirstNonEmptyRangeWithFormatting(ranges);
      this.marketSummary = [];
      this.marketSummaryColors = [];

      if (values.length > 0) {
        this.marketSummary = values;
        this.marketSummaryColors = colors || [];
        this._tableSources.marketSummary = range;
        console.info(
          `✅ Loaded Market Summary (${values.length} rows, ${colors.length} color rows) from ${range}`
        );
        console.log("Market Summary Colors:", colors);
      }
    } catch (e) {
      console.info("Market Summary table not available:", e);
    }

    // Fetch Van Capacity with formatting
    try {
      const ranges = pickRanges("vanCapacity");
      const range = ranges[0];

      const { values, colors } =
        await this._getFirstNonEmptyRangeWithFormatting(ranges);
      this.vanCapacity = [];
      this.vanCapacityColors = [];

      if (values.length > 0) {
        this.vanCapacity = values;
        this.vanCapacityColors = colors || [];
        this._tableSources.vanCapacity = range;
        console.info(
          `✅ Loaded Van Capacity (${values.length} rows, ${colors.length} color rows) from ${range}`
        );
        console.log("Van Capacity Colors:", colors);
      }
    } catch (e) {
      console.info("Van Capacity table not available:", e);
    }
  }

  _filterEmptyRowsAndColumns(values, colors) {
    if (!values || values.length === 0) return { values: [], colors: [] };

    // Step 1: Find first and last non-empty rows
    let firstRow = -1;
    let lastRow = -1;

    for (let i = 0; i < values.length; i++) {
      const row = values[i] || [];
      const hasContent = row.some((cell) => String(cell || "").trim() !== "");
      if (hasContent) {
        if (firstRow === -1) firstRow = i;
        lastRow = i;
      }
    }

    if (firstRow === -1) return { values: [], colors: [] };

    // Step 2: Extract only rows between first and last non-empty
    const rowSlice = values.slice(firstRow, lastRow + 1);
    const colorSlice = colors.slice(firstRow, lastRow + 1);

    // Step 3: Find first and last non-empty columns
    let firstCol = Infinity;
    let lastCol = -1;

    for (const row of rowSlice) {
      for (let c = 0; c < row.length; c++) {
        if (String(row[c] || "").trim() !== "") {
          firstCol = Math.min(firstCol, c);
          lastCol = Math.max(lastCol, c);
        }
      }
    }

    if (firstCol === Infinity || lastCol === -1)
      return { values: [], colors: [] };

    // Step 4: Trim to only content columns
    const trimmedRows = rowSlice.map((row) => row.slice(firstCol, lastCol + 1));
    const trimmedColors = colorSlice.map((row) =>
      row.slice(firstCol, lastCol + 1)
    );

    console.log(
      `Filtered table: ${trimmedRows.length} rows x ${
        trimmedRows[0]?.length || 0
      } cols (was ${values.length} x ${values[0]?.length || 0})`
    );
    console.log("Filtered values:", trimmedRows);
    console.log("First row:", trimmedRows[0]);
    console.log("Last row:", trimmedRows[trimmedRows.length - 1]);

    return { values: trimmedRows, colors: trimmedColors };
  }

  async _getFirstNonEmptyRangeWithFormatting(possibleRanges) {
    for (const range of possibleRanges) {
      try {
        const resp = await window.gapi.client.sheets.spreadsheets.get({
          spreadsheetId: SPREADSHEET_ID,
          ranges: [range],
          includeGridData: true,
        });

        const sheet = resp.result?.sheets?.[0];
        const data = sheet?.data?.[0];

        if (!data || !data.rowData || data.rowData.length === 0) continue;

        const values = [];
        const colors = [];

        data.rowData.forEach((row, rowIdx) => {
          const rowValues = [];
          const rowColors = [];

          (row.values || []).forEach((cell, cellIdx) => {
            rowValues.push(cell.formattedValue || "");

            // Extract background color
            const bgColor = cell.effectiveFormat?.backgroundColor;
            if (bgColor && (bgColor.red || bgColor.green || bgColor.blue)) {
              const r = Math.round((bgColor.red || 0) * 255);
              const g = Math.round((bgColor.green || 0) * 255);
              const b = Math.round((bgColor.blue || 0) * 255);
              const colorString = `rgb(${r}, ${g}, ${b})`;
              rowColors.push(colorString);
              if (rowIdx < 3 && cellIdx < 3) {
                console.log(
                  `Cell [${rowIdx}][${cellIdx}] color:`,
                  colorString,
                  bgColor
                );
              }
            } else {
              rowColors.push("");
            }
          });

          values.push(rowValues);
          colors.push(rowColors);
        });

        if (values.length > 0) {
          // Filter out completely empty rows
          const filteredData = this._filterEmptyRowsAndColumns(values, colors);
          return {
            range,
            values: filteredData.values,
            colors: filteredData.colors,
          };
        }
      } catch (e) {
        console.warn(`Failed to fetch range ${range} with formatting:`, e);
      }
    }
    return { range: null, values: [], colors: [] };
  }

  async fetchMiscData() {
    await this._ensureTableMappings();
    const pickRanges = (key) => {
      const dyn = this._dynamicTableRanges && this._dynamicTableRanges[key];
      if (typeof dyn === "string" && dyn.trim()) return [dyn.trim()];
      if (Array.isArray(dyn) && dyn.length) return dyn;
      return TABLE_RANGES[key] || [];
    };
    // Workers via declarative ranges
    try {
      const { range, values } = await this._getFirstNonEmptyRange(
        pickRanges("workers")
      );
      this.miscWorkers = [];
      this.miscWorkerMap = {};
      if (values.length >= 2) {
        const headers = (values[0] || []).map((h) =>
          (h || "").toString().trim()
        );
        const idxName = headers.findIndex((h) => /worker/i.test(h));
        const idxEmoji = headers.findIndex((h) => /emoji/i.test(h));
        values.slice(1).forEach((row) => {
          const name = (row[idxName] || "").toString().trim();
          if (!name) return;
          const emoji = (row[idxEmoji] || "").toString().trim();
          const rec = { worker: name, emoji };
          this.miscWorkers.push(rec);
          if (emoji) this.miscWorkerMap[name] = emoji;
        });
        this._tableSources.workers = range;
        console.info(
          `✅ Loaded ${this.miscWorkers.length} workers from ${range}`
        );
      }
    } catch (e) {
      console.info("Workers table not available:", e);
    }

    // Vehicles via declarative ranges
    try {
      const { range, values } = await this._getFirstNonEmptyRange(
        pickRanges("vehicles")
      );
      this.miscVehicles = [];
      this.miscVehicleMap = {};
      if (values.length >= 2) {
        const headers = (values[0] || []).map((h) =>
          (h || "").toString().trim()
        );
        const idxName = headers.findIndex((h) => /van|vehicle/i.test(h));
        const idxEmoji = headers.findIndex((h) => /emoji/i.test(h));
        values.slice(1).forEach((row) => {
          const name = (row[idxName] || "").toString().trim();
          if (!name) return;
          const emoji = (row[idxEmoji] || "").toString().trim();
          const rec = { van: name, emoji };
          this.miscVehicles.push(rec);
          if (emoji) this.miscVehicleMap[name] = emoji;
        });
        this._tableSources.vehicles = range;
        console.info(
          `✅ Loaded ${this.miscVehicles.length} vehicles from ${range}`
        );
      }
    } catch (e) {
      console.info("Vehicles table not available:", e);
    }

    // Reminders via declarative ranges (no brittle scanning unless configured)
    try {
      const { range, values } = await this._getFirstNonEmptyRange(
        pickRanges("reminders")
      );
      this.miscReminders = [];
      let primaryWidth = values && values[0] ? values[0].length : 0;
      if (values.length > 0) {
        this._parseReminders(values);
        this._tableSources.reminders = range;
        if (this.miscReminders.length)
          console.info(
            `✅ Loaded ${this.miscReminders.length} reminders from ${range}`
          );
      }
      // If a named range clipped the table horizontally, auto-detect a wider range and prefer it
      try {
        const detected = await this._scanMiscForReminders();
        if (detected && detected.values && detected.values.length) {
          const detectedWidth = (detected.values[0] || []).length;
          if (
            (this.miscReminders || []).length === 0 ||
            detectedWidth > primaryWidth
          ) {
            this._parseReminders(detected.values);
            this._tableSources.reminders = detected.a1 || "Misc!A:Z(auto)";
            if (this.miscReminders.length)
              console.info(
                `✅ Loaded ${this.miscReminders.length} reminders from ${this._tableSources.reminders}`
              );
          }
        }
      } catch {}
    } catch (e) {
      console.info("Reminders table not available:", e);
    }
  }

  _parseReminders(values) {
    try {
      if (!values || values.length === 0) {
        this.miscReminders = [];
        return;
      }
      const rawHeaders = values[0] || [];
      const headers = rawHeaders.map((h) =>
        (h || "").toString().trim().toLowerCase()
      );
      const idxKey = headers.findIndex((h) =>
        /^(key|keys|context|contexts|name|names)$/i.test(h)
      );
      const matchCol = (reArr) =>
        headers.findIndex((h) => reArr.some((re) => re.test(h)));
      const idxDrop = matchCol([/^(drop\s?off|dropoff|drop-off)$/i]);
      const idxAtOffice = matchCol([
        /^(at\s?office|office|atoffice|at_office)$/i,
      ]);
      const idxBackOffice = matchCol([
        /^(back\s?at\s?office|back\s?office|backatoffice)$/i,
      ]);
      const idxAtMarket = matchCol([
        /^(at\s?market|market|atmarket|atMarket)$/i,
      ]);
      // For transposed format, look for materials_office and materials_storage rows,
      // then collect all step columns (step1, step2, step3, step4, step5)
      const findRowIndex = (pattern) => {
        for (let i = 1; i < values.length; i++) {
          const row = values[i] || [];
          const firstCell = (row[0] || "").toString().trim().toLowerCase();
          if (pattern.test(firstCell)) return i;
        }
        return -1;
      };

      const materialsOfficeRowIdx = findRowIndex(
        /^(materials_office|materialsoffice|materials\s?office)$/i
      );
      const materialsStorageRowIdx = findRowIndex(
        /^(materials_storage|materialsstorage|materials\s?storage)$/i
      );

      // Find step columns (step1, step2, step3, step4, step5)
      const stepColumns = [];
      for (let i = 0; i < headers.length; i++) {
        if (/^step\d+$/i.test(headers[i])) {
          stepColumns.push(i);
        }
      }

      const idxBackAtOffice = matchCol([
        /^(back\s?at\s?office|back\s?office|backatoffice|backAtOffice)$/i,
      ]);
      // Log detected columns once per parse to aid maintainers
      try {
        console.info("[Reminders] Detected columns:", {
          key: idxKey >= 0,
          dropoff: idxDrop >= 0,
          atoffice: idxAtOffice >= 0,
          backatoffice: idxBackOffice >= 0,
          atmarket: idxAtMarket >= 0,
          materials_office: idxMaterialsOffice >= 0,
          materials_storage: idxMaterialsStorage >= 0,
          backAtOfficeCompat: idxBackAtOffice >= 0,
          headerSample: rawHeaders,
        });
      } catch {}

      const idxMarketKey = matchCol([/^(market|location)$/i]);
      const idxTypeKey = matchCol([/^(type|route\s?type|routetype)$/i]);
      const splitItems = (val) =>
        (val == null ? [] : [val])
          .flat()
          .map((v) => (v || "").toString())
          .flatMap((s) => s.split(/\n|[;,]/g))
          .map((t) => t.trim())
          .filter(Boolean);
      const out = [];
      // Extract global materials from transposed format (once for all routes)
      const extractMaterialsFromRow = (rowIdx) => {
        if (rowIdx < 0 || rowIdx >= values.length) return [];
        const materialsRow = values[rowIdx] || [];
        const materials = [];
        for (const colIdx of stepColumns) {
          const item = (materialsRow[colIdx] || "").toString().trim();
          if (item) materials.push(item);
        }
        return materials;
      };

      const globalMaterialsOffice = extractMaterialsFromRow(
        materialsOfficeRowIdx
      );
      const globalMaterialsStorage = extractMaterialsFromRow(
        materialsStorageRowIdx
      );

      const hasAnyReminderCols =
        idxDrop >= 0 ||
        idxAtOffice >= 0 ||
        idxBackOffice >= 0 ||
        idxAtMarket >= 0 ||
        materialsOfficeRowIdx >= 0 ||
        materialsStorageRowIdx >= 0 ||
        idxBackAtOffice >= 0;
      if (hasAnyReminderCols) {
        for (let i = 1; i < values.length; i++) {
          const row = values[i] || [];
          const keys = [];
          const pushKey = (v) => {
            const s = (v == null ? "" : String(v)).trim();
            if (s) keys.push(s);
          };
          if (idxKey >= 0) pushKey(row[idxKey]);
          if (idxMarketKey >= 0) pushKey(row[idxMarketKey]);
          if (idxTypeKey >= 0) pushKey(row[idxTypeKey]);
          // Fallback: first column if nothing else
          if (keys.length === 0 && row[0] != null) pushKey(row[0]);
          const d = idxDrop >= 0 ? splitItems(row[idxDrop]) : [];
          const a = idxAtOffice >= 0 ? splitItems(row[idxAtOffice]) : [];
          const b = idxBackOffice >= 0 ? splitItems(row[idxBackOffice]) : [];
          const m = idxAtMarket >= 0 ? splitItems(row[idxAtMarket]) : [];
          // Skip processing rows that are materials definition rows themselves
          if (i === materialsOfficeRowIdx || i === materialsStorageRowIdx)
            continue;

          // Use global materials for all routes
          const mo = globalMaterialsOffice;
          const ms = globalMaterialsStorage;
          const bao =
            idxBackAtOffice >= 0 ? splitItems(row[idxBackAtOffice]) : [];
          const emptyRow =
            keys.length === 0 &&
            d.length === 0 &&
            a.length === 0 &&
            b.length === 0 &&
            m.length === 0 &&
            mo.length === 0 &&
            ms.length === 0 &&
            bao.length === 0;
          if (emptyRow) continue;
          // If no keys/market/type columns exist in the sheet, treat rows as global (applies to 'all')
          if (
            keys.length === 0 &&
            (d.length ||
              a.length ||
              b.length ||
              m.length ||
              mo.length ||
              ms.length ||
              bao.length)
          ) {
            keys.push("all");
          }
          if (
            keys.length > 0 &&
            (d.length ||
              a.length ||
              b.length ||
              m.length ||
              mo.length ||
              ms.length ||
              bao.length)
          ) {
            const rec = {
              keys: Array.from(new Set(keys)),
              dropoff: d,
              atoffice: a,
              backatoffice: b,
              atmarket: m,
              materials_office: mo,
              materials_storage: ms,
              backAtOffice: bao,
            };
            if (rec.keys.length) rec.key = rec.keys[0]; // compat
            out.push(rec);
          }
        }
      } else if (idxKey >= 0) {
        const idxVal = headers.findIndex((h) =>
          /^(reminder|note|notes)$/i.test(h)
        );
        if (idxVal >= 0) {
          for (let i = 1; i < values.length; i++) {
            const row = values[i] || [];
            const k = (row[idxKey] || "").toString().trim();
            const v = (row[idxVal] || "").toString().trim();
            if (!k && !v) continue;
            if (k && v)
              out.push({
                keys: [k],
                key: k,
                dropoff: [v],
                atoffice: [],
                backatoffice: [],
              });
          }
        }
      } else {
        // Row-oriented format: a 'where/section/bucket' column with items spread across other columns.
        const idxWhere = headers.findIndex((h) =>
          /^(where|section|bucket)$/i.test(h)
        );
        if (idxWhere >= 0) {
          const merge = {
            keys: ["all"],
            dropoff: [],
            atoffice: [],
            backatoffice: [],
            atmarket: [],
            materials_office: [],
            materials_storage: [],
            backAtOffice: [],
          };
          const norm = (s) => (s == null ? "" : String(s)).trim().toLowerCase();
          const mapBucket = (w) => {
            const n = norm(w);
            if (/^drop/.test(n)) return "dropoff";
            if (/^(at\s*)?office$|^atoffice$/.test(n)) return "atoffice";
            if (/^back/.test(n)) return "backatoffice";
            if (/^(at\s*)?market$|^atmarket$/.test(n)) return "atmarket";
            if (/materials.*office/.test(n)) return "materials_office";
            if (/materials.*storage/.test(n)) return "materials_storage";
            return "";
          };
          // Only include cells from recognized step columns
          const stepIdxs = headers
            .map((h, i) => (/^step\s*\d+$/i.test(h) ? i : -1))
            .filter((i) => i >= 0);
          for (let i = 1; i < values.length; i++) {
            const row = values[i] || [];
            const where = row[idxWhere];
            if (!where) continue;
            const b = mapBucket(where);
            if (!b) continue;
            const items = stepIdxs.length
              ? stepIdxs.map((ci) => row[ci]).flatMap(splitItems)
              : row.filter((_, ci) => ci !== idxWhere).flatMap(splitItems);
            items.forEach((t) => {
              if (t && !merge[b].includes(t)) merge[b].push(t);
            });
          }
          if (
            merge.dropoff.length ||
            merge.atoffice.length ||
            merge.backatoffice.length ||
            merge.atmarket.length ||
            merge.materials_office.length ||
            merge.materials_storage.length
          ) {
            out.push(merge);
          }
        }
      }
      this.miscReminders = out;
      if (out.length)
        console.info(`✅ Loaded ${out.length} reminders from Reminders tab`);
    } catch (e) {
      console.warn("Reminders parse failed:", e);
      this.miscReminders = [];
    }
  }

  // ===== Helpers used by DataService normalization =====
  // Emoji lookups for workers and vehicles (used by components/legacy)
  getWorkerEmoji(name) {
    if (!name) return "";
    try {
      return this.miscWorkerMap?.[name] || "";
    } catch {
      return "";
    }
  }
  getVehicleEmoji(name) {
    if (!name) return "";
    try {
      return this.miscVehicleMap?.[name] || "";
    } catch {
      return "";
    }
  }

  getAllWorkersFromRoute(route) {
    const workers = [];
    let i = 1;
    while (route[`worker${i}`]) {
      const workerCell = String(route[`worker${i}`]).trim();
      if (
        workerCell &&
        !flexibleTextMatch(workerCell, "cancelled") &&
        workerCell !== `worker${i}` &&
        !this.isColumnHeaderName(workerCell)
      ) {
        workerCell
          .split(",")
          .map((n) => n.trim())
          .filter(Boolean)
          .forEach((w) => workers.push(w));
      }
      i++;
    }
    if (workers.length === 0 && (route.Worker || route.worker)) {
      const singleWorker = String(route.Worker || route.worker).trim();
      if (
        singleWorker &&
        !this.isColumnHeaderName(singleWorker) &&
        !flexibleTextMatch(singleWorker, "cancelled")
      )
        workers.push(singleWorker);
    }
    return workers;
  }
  getAllVolunteers(route) {
    const volunteers = [];
    let i = 1;
    while (route[`volunteer${i}`]) {
      const val = String(route[`volunteer${i}`]).trim();
      if (val && val !== `volunteer${i}`)
        val
          .split(",")
          .map((n) => n.trim())
          .filter(Boolean)
          .forEach((v) => volunteers.push(v));
      i++;
    }
    return volunteers;
  }
  getAllVans(route) {
    const vans = [];
    let i = 1;
    while (route[`van${i}`]) {
      const val = String(route[`van${i}`]).trim();
      if (val && val !== `van${i}`)
        val
          .split(",")
          .map((n) => n.trim())
          .filter(Boolean)
          .forEach((v) => vans.push(v));
      i++;
    }
    return vans;
  }
  getAllRouteContacts(route) {
    const contacts = [];
    let i = 1;
    while (route[`contact${i}`] || route[`Contact${i}`]) {
      const val = String(
        route[`contact${i}`] || route[`Contact${i}`] || ""
      ).trim();
      if (val) contacts.push(val);
      i++;
    }
    if (contacts.length === 0 && (route.contact || route.Contact)) {
      const single = String(route.contact || route.Contact).trim();
      if (single) contacts.push(single);
    }
    return contacts;
  }
  getAllRoutePhones(route) {
    const phones = [];
    let i = 1;
    while (route[`phone${i}`] || route[`Phone${i}`]) {
      const val = String(route[`phone${i}`] || route[`Phone${i}`] || "").trim();
      if (val) phones.push(val);
      i++;
    }
    if (phones.length === 0 && (route.phone || route.Phone)) {
      const single = String(route.phone || route.Phone).trim();
      if (single) phones.push(single);
    }
    return phones;
  }

  isColumnHeaderName(text) {
    if (!text || typeof text !== "string") return false;
    const headerPatterns = [
      "food from",
      "foodfrom",
      "food_from",
      "food source",
      "source",
      "from",
      "worker1",
      "worker2",
      "worker3",
      "worker4",
      "worker5",
      "worker",
      "volunteer",
      "volunteers",
      "volunteer1",
      "volunteer2",
      "date",
      "time",
      "location",
      "address",
      "route",
      "delivery",
      "pickup",
      "dropoff",
      "drop off",
      "drop-off",
      "market",
      "vendor",
      "client",
      "organization",
      "notes",
      "comments",
      "status",
      "cancelled",
      "canceled",
      "phone",
      "email",
      "contact",
      "quantity",
      "amount",
      "pounds",
      "lbs",
      "weight",
      "items",
      "food type",
      "type",
      "description",
      "details",
      "instructions",
      "van",
      "vehicle",
      "driver",
      "team",
      "assignment",
      "task",
    ];
    const normalizedText = text.toLowerCase().trim();
    return headerPatterns.some(
      (pattern) =>
        normalizedText === pattern || normalizedText.startsWith(pattern)
    );
  }

  getAllWorkers() {
    const keyParts = [];
    try {
      keyParts.push(this.lastFetchTs || 0);
      keyParts.push((this.miscWorkers || []).length);
      keyParts.push((this.data || []).length);
      keyParts.push((this.recoveryData || []).length);
      keyParts.push((this.deliveryData || []).length);
      keyParts.push((this.routesData || []).length);
    } catch {}
    const cacheKey = keyParts.join("|");
    if (this._workersCache && this._workersCacheKey === cacheKey)
      return [...this._workersCache];
    const workers = new Set();
    if (this.miscWorkers && this.miscWorkers.length > 0) {
      this.miscWorkers.forEach((w) => {
        const name = (w.worker || "").toString();
        if (!name) return;
        if (/volunteer/i.test(name)) return;
        workers.add(name);
      });
    }
    const addFromRoutes = (rows) => {
      rows.forEach((route) => {
        const routeWorkers = this.getAllWorkersFromRoute(route);
        routeWorkers.forEach((worker) => {
          if (worker && !/volunteer/i.test(worker)) workers.add(worker);
        });
      });
    };
    addFromRoutes(this.data);
    addFromRoutes(this.recoveryData);
    addFromRoutes(this.deliveryData);
    addFromRoutes(this.routesData || []);
    const result = Array.from(workers).sort();
    this._workersCacheKey = cacheKey;
    this._workersCache = result;
    return [...result];
  }

  getAddressFromContacts(name) {
    if (!this.contactsData || this.contactsData.length === 0) return null;
    const contact = this.contactsData.find(
      (c) =>
        c &&
        c.Location &&
        (flexibleTextMatch(c.Location, name) ||
          normalizeText(c.Location) === normalizeText(name))
    );
    if (!contact) return null;
    const allContacts = this.getAllContacts(contact);
    const allPhones = this.getAllPhones(contact);
    const contactName =
      allContacts.length > 0
        ? allContacts[0]
        : contact.Contact || contact.contact || contact.Location || "";
    const phone =
      allPhones.length > 0
        ? allPhones[0]
        : contact.Phone || contact.phone || "";
    return {
      address: contact.Address || contact.Location || "",
      phone,
      phones: allPhones,
      contactName,
      contacts: allContacts,
      notes:
        contact["Notes/ Special Instructions"] ||
        contact.Notes ||
        contact.notes ||
        "",
      type: contact.Type || contact.type || contact.TYPE || "",
      job: contact.Job || contact.job || contact.JOB || "",
    };
  }

  // Return reminder buckets for a route context
  // { dropoff: string[], atoffice: string[], backatoffice: string[], atmarket: string[], materials_office: string[], materials_storage: string[] }
  getRemindersForRoute(route) {
    try {
      const out = {
        dropoff: [],
        atoffice: [],
        backatoffice: [],
        atmarket: [],
        materials_office: [],
        materials_storage: [],
        backAtOffice: [],
      };
      const keys = [];
      const norm = (s) => (s == null ? "" : String(s)).trim().toLowerCase();
      if (route) {
        if (route.market) keys.push(norm(route.market));
        if (route.dropOff) keys.push(norm(route.dropOff));
        if (route.type) keys.push(norm(route.type));
      }
      keys.push("all");
      keys.push("any");

      (this.miscReminders || []).forEach((r) => {
        const recKeys =
          Array.isArray(r.keys) && r.keys.length
            ? r.keys.map(norm)
            : [norm(r.key)];
        if (!recKeys.some((k) => keys.includes(k))) return;
        const addAll = (arr, dest) => {
          (Array.isArray(arr) ? arr : arr ? [arr] : []).forEach((v) => {
            const t = (v || "").toString().trim();
            if (t && !dest.includes(t)) dest.push(t);
          });
        };
        // Compat: if old shape {key,text}
        if (
          r.text &&
          !r.dropoff &&
          !r.atoffice &&
          !r.backatoffice &&
          !r.atmarket
        ) {
          addAll([r.text], out.dropoff);
        } else {
          addAll(r.dropoff, out.dropoff);
          addAll(r.atoffice, out.atoffice);
          addAll(r.backatoffice, out.backatoffice);
          addAll(r.atmarket, out.atmarket);
          addAll(r.materials_office, out.materials_office);
          addAll(r.materials_storage, out.materials_storage);
          addAll(r.backAtOffice, out.backAtOffice);
        }
      });
      return out;
    } catch {
      return {
        dropoff: [],
        atoffice: [],
        backatoffice: [],
        atmarket: [],
        materials_office: [],
        materials_storage: [],
        backAtOffice: [],
      };
    }
  }

  // Debug helper for maintainability
  debugTables() {
    return {
      sources: { ...this._tableSources },
      workers: this.miscWorkers?.length || 0,
      vehicles: this.miscVehicles?.length || 0,
      reminders: this.miscReminders?.length || 0,
      reminderSample: (this.miscReminders || []).slice(0, 3),
    };
  }

  async _ensureTableMappings() {
    if (this._dynamicTableRanges) return;
    // Try to read a simple mapping sheet: Tables!A:B with headers Name | Range
    try {
      const resp = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Tables!A:B",
      });
      const values = resp.result?.values || [];
      if (!values || values.length < 2) {
        this._dynamicTableRanges = {};
        return;
      }
      const headers = (values[0] || []).map((h) =>
        String(h || "")
          .trim()
          .toLowerCase()
      );
      const idxName = headers.findIndex((h) => /^(name|table|key)$/i.test(h));
      const idxRange = headers.findIndex((h) => /^(range|a1|ref)$/i.test(h));
      const map = {};
      if (idxName >= 0 && idxRange >= 0) {
        for (let i = 1; i < values.length; i++) {
          const row = values[i] || [];
          const name = String(row[idxName] || "")
            .trim()
            .toLowerCase();
          const range = String(row[idxRange] || "").trim();
          if (!name || !range) continue;
          if (["workers", "worker", "staff"].includes(name))
            map.workers = range;
          else if (["vehicles", "vans", "van", "vehicle"].includes(name))
            map.vehicles = range;
          else if (["reminders", "notes", "checklist"].includes(name))
            map.reminders = range;
        }
      }
      this._dynamicTableRanges = map;
      if (Object.keys(map).length)
        console.info("[Tables] Using dynamic ranges from Tables sheet:", map);
    } catch (e) {
      this._dynamicTableRanges = {};
    }
  }

  async _scanMiscForReminders() {
    try {
      const resp = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "Misc!A:Z",
      });
      const rows = resp.result?.values || [];
      if (!rows || rows.length === 0) return null;

      // Score potential header rows. Prefer explicit bucket columns; next prefer a row-oriented header with 'where' + stepN.
      const scoreHeader = (hdr) => {
        const lower = (hdr || []).map((h) =>
          String(h || "")
            .trim()
            .toLowerCase()
        );
        let score = 0;
        const has = (re) => lower.some((h) => re.test(h));
        const count = (re) => lower.filter((h) => re.test(h)).length;
        // Positive signals
        if (has(/^(where|section|bucket)$/i)) score += 3;
        score += Math.min(5, count(/^step\d+$/i));
        if (has(/(^|\b)(drop\s?off|dropoff|drop-off)(\b|$)/i)) score += 2;
        if (has(/(^|\b)(at\s?office|atoffice|office)(\b|$)/i)) score += 2;
        if (has(/(^|\b)(back\s?at\s?office|back\s?office|backatoffice)(\b|$)/i))
          score += 2;
        if (has(/^(materials[_\s]?office|materials[_\s]?storage)$/i))
          score += 2;
        if (has(/^(at\s?market|atmarket|market)$/i)) score += 2;
        // Key/market/type give slight boost but are not required for global lists
        if (
          has(
            /^(key|keys|context|contexts|name|names|market|location|type|route)$/i
          )
        )
          score += 1;
        // Negative signals: workers/vehicles tables
        if (has(/worker|van|vehicle/i)) score -= 3;
        return score;
      };

      const candidates = [];
      for (let i = 0; i < rows.length; i++) {
        const s = scoreHeader(rows[i]);
        if (s > 0) {
          candidates.push({ idx: i, score: s });
        }
      }
      if (!candidates.length) return null;
      candidates.sort((a, b) => b.score - a.score || a.idx - b.idx);
      const headerIdx = candidates[0].idx;

      // Compute left/right edges and bottom edge from this header
      const lastColIndex = (hdr) => {
        let idx = hdr.length - 1;
        while (idx >= 0 && String(hdr[idx] || "").trim() === "") idx--;
        return idx;
      };
      const headerRow = rows[headerIdx] || [];
      const lowerHdr = headerRow.map((h) =>
        String(h || "")
          .trim()
          .toLowerCase()
      );
      const idxWhere = lowerHdr.findIndex((h) =>
        /^(where|section|bucket)$/i.test(h)
      );
      const stepIdxs = lowerHdr
        .map((h, i) => (/^step\s*\d+$/i.test(h) ? i : -1))
        .filter((i) => i >= 0);
      const bucketIdxs = lowerHdr
        .map((h, i) =>
          /^(drop\s?off|dropoff|drop-off)$/i.test(h) ||
          /^(at\s?office|atoffice|office)$/i.test(h) ||
          /^(back\s?at\s?office|back\s?office|backatoffice)$/i.test(h) ||
          /^(materials[_\s]?office|materials[_\s]?storage)$/i.test(h) ||
          /^(at\s?market|atmarket|market)$/i.test(h)
            ? i
            : -1
        )
        .filter((i) => i >= 0);
      const nonEmptyIdxs = lowerHdr
        .map((h, i) => (h ? i : -1))
        .filter((i) => i >= 0);
      let c1 = Math.min(
        ...[
          idxWhere >= 0 ? idxWhere : Infinity,
          ...(stepIdxs.length ? stepIdxs : [Infinity]),
          ...(bucketIdxs.length ? bucketIdxs : [Infinity]),
        ]
      );
      if (!isFinite(c1))
        c1 = nonEmptyIdxs.length ? Math.min(...nonEmptyIdxs) : 0;
      const c2 = (() => {
        const rightCandidates = [];
        if (stepIdxs.length) rightCandidates.push(Math.max(...stepIdxs));
        if (bucketIdxs.length) rightCandidates.push(Math.max(...bucketIdxs));
        if (!rightCandidates.length)
          rightCandidates.push(lastColIndex(headerRow));
        return Math.max(...rightCandidates);
      })();
      const endRow = (() => {
        let last = headerIdx;
        for (let r = headerIdx + 1; r < rows.length; r++) {
          const row = rows[r] || [];
          const empty = row
            .slice(c1, c2 + 1)
            .every((v) => String(v || "").trim() === "");
          if (empty) break;
          last = r;
        }
        return last;
      })();
      const colToA1 = (n) => {
        let s = "";
        n = n + 1; // 1-based
        while (n > 0) {
          const mod = (n - 1) % 26;
          s = String.fromCharCode(65 + mod) + s;
          n = Math.floor((n - 1) / 26);
        }
        return s;
      };
      const a1 = `Misc!${colToA1(c1)}${headerIdx + 1}:${colToA1(c2)}${
        endRow + 1
      }`;
      console.info("[Reminders] Auto-detected table at", a1);
      const sliced = rows
        .slice(headerIdx, endRow + 1)
        .map((row) => (row || []).slice(c1, c2 + 1));
      return { a1, values: sliced };
    } catch (e) {
      return null;
    }
  }

  getAllContacts(contact) {
    const contacts = [];
    let i = 1;
    while (contact[`contact${i}`] || contact[`Contact${i}`]) {
      const contactPerson = (
        contact[`contact${i}`] ||
        contact[`Contact${i}`] ||
        ""
      ).trim();
      if (contactPerson) contacts.push(contactPerson);
      i++;
    }
    // Fallback to single contact field
    if (contacts.length === 0 && (contact.Contact || contact.contact)) {
      const single = String(contact.Contact || contact.contact).trim();
      if (single) contacts.push(single);
    }
    return contacts;
  }
  getAllPhones(contact) {
    const phones = [];
    let i = 1;
    while (contact[`phone${i}`] || contact[`Phone${i}`]) {
      const phone = (contact[`phone${i}`] || contact[`Phone${i}`] || "").trim();
      if (phone) phones.push(phone);
      i++;
    }
    // Fallback to single phone field
    if (phones.length === 0 && (contact.Phone || contact.phone)) {
      const single = String(contact.Phone || contact.phone).trim();
      if (single) phones.push(single);
    }
    return phones;
  }

  getDataSignature() {
    try {
      return [
        this.lastFetchTs || 0,
        (this.data || []).length,
        (this.recoveryData || []).length,
        (this.deliveryData || []).length,
        (this.routesData || []).length,
      ].join("|");
    } catch {
      return "";
    }
  }

  // ===== Google Sheets Write Methods =====

  async appendToSheet(sheetName, values) {
    try {
      await this.ensureGapiClientReady();
      const range = `${sheetName}!A:Z`;

      const response =
        await window.gapi.client.sheets.spreadsheets.values.append({
          spreadsheetId: SPREADSHEET_ID,
          range: range,
          valueInputOption: "USER_ENTERED",
          resource: {
            values: values,
          },
        });

      console.log(`✅ Appended ${values.length} row(s) to ${sheetName}`);
      return response.result;
    } catch (error) {
      console.error(`❌ Error appending to ${sheetName}:`, error);
      throw error;
    }
  }

  async updateSheet(sheetName, range, values) {
    try {
      await this.ensureGapiClientReady();
      const fullRange = `${sheetName}!${range}`;

      const response =
        await window.gapi.client.sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: fullRange,
          valueInputOption: "USER_ENTERED",
          resource: {
            values: values,
          },
        });

      console.log(`✅ Updated ${sheetName} at ${range}`);
      return response.result;
    } catch (error) {
      console.error(`❌ Error updating ${sheetName}:`, error);
      throw error;
    }
  }

  async fetchTasksData() {
    try {
      await this.ensureGapiClientReady();
      const tasksRange = "Tasks!A:Z";

      const resp = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: tasksRange,
      });

      const values = resp.result?.values || [];
      if (values.length < 2) {
        return [];
      }

      const headers = values[0];
      const tasks = values.slice(1).map((row) => {
        const obj = {};
        headers.forEach((h, i) => (obj[h] = row[i] || ""));
        return obj;
      });

      console.log(`✅ Loaded ${tasks.length} tasks from Tasks sheet`);
      return tasks;
    } catch (error) {
      console.info("Tasks sheet not available or empty:", error);
      return [];
    }
  }

  async saveTask(task) {
    try {
      console.log("📝 Attempting to save task:", task);
      await this.ensureGapiClientReady();
      console.log("✓ GAPI client ready");

      // Check if Tasks sheet has headers, if not, create them
      const tasksRange = "Tasks!A1:Z1";
      let headers;

      try {
        console.log("📋 Checking for existing headers...");
        const resp = await window.gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: tasksRange,
        });

        headers = resp.result?.values?.[0];
        if (!headers || headers.length === 0) {
          console.log("📝 No headers found, creating new headers...");
          // Create headers
          headers = [
            "id",
            "title",
            "volunteer",
            "dueDate",
            "status",
            "createdAt",
            "createdBy",
            "completedAt",
          ];
          await this.updateSheet("Tasks", "A1:H1", [headers]);
          console.log("✓ Headers created");
        } else {
          console.log("✓ Headers found:", headers);
        }
      } catch (error) {
        console.log("⚠️ Error reading headers, creating new headers:", error);
        // Sheet might not exist, create headers
        headers = [
          "id",
          "title",
          "volunteer",
          "dueDate",
          "status",
          "createdAt",
          "createdBy",
          "completedAt",
        ];
        await this.updateSheet("Tasks", "A1:H1", [headers]);
        console.log("✓ Headers created after error");
      }

      // Prepare row data
      const row = [
        task.id || "",
        task.title || "",
        task.volunteer || "",
        task.dueDate || "",
        task.status || "needOwner",
        task.createdAt || "",
        task.createdBy || "",
        task.completedAt || "",
      ];

      console.log("📤 Appending row to sheet:", row);
      await this.appendToSheet("Tasks", [row]);
      console.log("✅ Task saved to Google Sheets successfully:", task);
    } catch (error) {
      console.error("❌ Error saving task - Full error details:", error);
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      if (error.result) {
        console.error("Error result:", error.result);
      }
      throw error;
    }
  }

  async updateTask(task) {
    try {
      await this.ensureGapiClientReady();

      // Find the task row by ID
      const tasksRange = "Tasks!A:Z";
      const resp = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: tasksRange,
      });

      const values = resp.result?.values || [];
      if (values.length < 2) {
        console.warn("No tasks found to update");
        return;
      }

      const headers = values[0];
      const idIndex = headers.indexOf("id");

      // Find row index (add 2 because: 1 for 1-based indexing, 1 for header row)
      let rowIndex = -1;
      for (let i = 1; i < values.length; i++) {
        if (values[i][idIndex] == task.id) {
          rowIndex = i + 1;
          break;
        }
      }

      if (rowIndex === -1) {
        console.warn("Task not found with id:", task.id);
        return;
      }

      // Prepare row data
      const row = [
        task.id || "",
        task.title || "",
        task.volunteer || "",
        task.dueDate || "",
        task.status || "needOwner",
        task.createdAt || "",
        task.createdBy || "",
        task.completedAt || "",
      ];

      await this.updateSheet("Tasks", `A${rowIndex}:H${rowIndex}`, [row]);
      console.log("✅ Task updated in Google Sheets:", task);
    } catch (error) {
      console.error("❌ Error updating task:", error);
      throw error;
    }
  }

  async saveTimesheetEntry(timesheetData) {
    try {
      console.log("⏰ Attempting to save timesheet:", timesheetData);
      await this.ensureGapiClientReady();
      console.log("✓ GAPI client ready");

      // Check if Timesheet sheet has headers, if not, create them
      const timesheetRange = "Timesheet!A1:Z1";
      let headers;

      try {
        console.log("📋 Checking for existing Timesheet headers...");
        const resp = await window.gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: timesheetRange,
        });

        headers = resp.result?.values?.[0];
        if (!headers || headers.length === 0) {
          console.log("📝 No Timesheet headers found, creating...");
          // Create headers
          headers = [
            "userName",
            "weekStart",
            "weekEnd",
            "date",
            "hours",
            "notes",
            "submittedAt",
          ];
          await this.updateSheet("Timesheet", "A1:G1", [headers]);
          console.log("✓ Timesheet headers created");
        } else {
          console.log("✓ Timesheet headers found:", headers);
        }
      } catch (error) {
        console.log("⚠️ Error reading Timesheet headers, creating new:", error);
        // Sheet might not exist, create headers
        headers = [
          "userName",
          "weekStart",
          "weekEnd",
          "date",
          "hours",
          "notes",
          "submittedAt",
        ];
        await this.updateSheet("Timesheet", "A1:G1", [headers]);
        console.log("✓ Timesheet headers created after error");
      }

      // Convert timesheetData entries into rows
      const rows = [];
      Object.keys(timesheetData.entries).forEach((dateKey) => {
        const entry = timesheetData.entries[dateKey];
        if (entry.hours && parseFloat(entry.hours) > 0) {
          rows.push([
            timesheetData.userName || "",
            timesheetData.weekStart || "",
            timesheetData.weekEnd || "",
            dateKey || "",
            entry.hours || "",
            entry.notes || "",
            timesheetData.submittedAt || "",
          ]);
        }
      });

      if (rows.length > 0) {
        console.log(
          `📤 Appending ${rows.length} timesheet rows to sheet:`,
          rows
        );
        await this.appendToSheet("Timesheet", rows);
        console.log(
          `✅ Saved ${rows.length} timesheet entries to Google Sheets successfully`
        );
      } else {
        console.log("⚠️ No timesheet rows to save (no hours > 0)");
      }
    } catch (error) {
      console.error("❌ Error saving timesheet - Full error details:", error);
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      if (error.result) {
        console.error("Error result:", error.result);
      }
      throw error;
    }
  }

  async savePoundsData(poundsRecord) {
    try {
      console.log("📦 Attempting to save pounds data:", poundsRecord);
      await this.ensureGapiClientReady();
      console.log("✓ GAPI client ready");

      // Check if PoundsData sheet has headers, if not, create them
      const poundsRange = "PoundsData!A1:Z1";
      let headers;

      try {
        console.log("📋 Checking for existing PoundsData headers...");
        const resp = await window.gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: poundsRange,
        });

        headers = resp.result?.values?.[0];
        if (!headers || headers.length === 0) {
          console.log(
            "📝 No PoundsData headers found, creating new headers..."
          );
          // Create headers
          headers = [
            "routeId",
            "date",
            "stopIndex",
            "location",
            "pounds",
            "timestamp",
            "user",
          ];
          await this.updateSheet("PoundsData", "A1:G1", [headers]);
          console.log("✓ PoundsData headers created");
        } else {
          console.log("✓ PoundsData headers found:", headers);
        }
      } catch (error) {
        console.log(
          "⚠️ Error reading PoundsData headers, creating new headers:",
          error
        );
        // Sheet might not exist, create headers
        headers = [
          "routeId",
          "date",
          "stopIndex",
          "location",
          "pounds",
          "timestamp",
          "user",
        ];
        await this.updateSheet("PoundsData", "A1:G1", [headers]);
        console.log("✓ PoundsData headers created after error");
      }

      // Prepare row data
      const row = [
        poundsRecord.routeId || "",
        poundsRecord.date || "",
        poundsRecord.stopIndex || 0,
        poundsRecord.location || "",
        poundsRecord.pounds || 0,
        poundsRecord.timestamp || "",
        poundsRecord.user || "",
      ];

      console.log("📤 Appending pounds data row to sheet:", row);
      await this.appendToSheet("PoundsData", [row]);
      console.log(
        "✅ Pounds data saved to Google Sheets successfully:",
        poundsRecord
      );
    } catch (error) {
      console.error("❌ Error saving pounds data - Full error details:", error);
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      if (error.result) {
        console.error("Error result:", error.result);
      }
      throw error;
    }
  }

  async getPoundsDataForRoute(routeId, date) {
    try {
      console.log("📦 Loading pounds data for route:", { routeId, date });
      await this.ensureGapiClientReady();

      // Get all pounds data from sheet
      const poundsRange = "PoundsData!A:Z";
      const resp = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: poundsRange,
      });

      const values = resp.result?.values || [];
      if (values.length < 2) {
        console.log("📦 No pounds data found");
        return [];
      }

      const headers = values[0];
      const routeIdIndex = headers.indexOf("routeId");
      const dateIndex = headers.indexOf("date");
      const stopIndexIndex = headers.indexOf("stopIndex");
      const locationIndex = headers.indexOf("location");
      const poundsIndex = headers.indexOf("pounds");

      // Filter records for this route and date
      const matchingRecords = [];
      for (let i = 1; i < values.length; i++) {
        const row = values[i];
        const recordRouteId = row[routeIdIndex] || "";
        const recordDate = row[dateIndex] || "";

        if (recordRouteId === routeId && recordDate === date) {
          matchingRecords.push({
            stopIndex: parseInt(row[stopIndexIndex]) || 0,
            location: row[locationIndex] || "",
            pounds: parseFloat(row[poundsIndex]) || 0,
          });
        }
      }

      console.log("✅ Found pounds data:", matchingRecords.length, "records");
      return matchingRecords;
    } catch (error) {
      console.error("❌ Error loading pounds data:", error);
      return [];
    }
  }
}

export const sheetsAPI = new SheetsAPIService();

// Expose sheetsAPI globally immediately
if (typeof window !== "undefined") {
  window.sheetsAPI = sheetsAPI;
  console.log("✅ window.sheetsAPI exposed globally");
}

export async function loadApiDataIfNeeded(force = false) {
  const SHEETS_TTL_MS = 120000;
  const now = Date.now();
  const stale = now - (sheetsAPI.lastFetchTs || 0) > SHEETS_TTL_MS;
  const needInitial = (sheetsAPI.data || []).length === 0;
  if (!force && !needInitial && !stale) return;
  await sheetsAPI.fetchSheetData();
}

export function getDataSignature() {
  return sheetsAPI.getDataSignature();
}

export default sheetsAPI;
