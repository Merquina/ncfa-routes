// ESM Sheets API service used by DataService. Avoids window globals.
import { SPREADSHEET_ID, GOOGLE_API_KEY as API_KEY } from './config.js';

// Minimal text helpers (mirrors js/util.js behavior)
function normalizeText(str) {
  return (str == null ? '' : String(str))
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
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
    this.isLoading = false;
    this._workersCacheKey = null;
    this._workersCache = null;
    this.lastFetchTs = 0;
    this._etagByRange = new Map();
    this._pollTid = null;
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
      console.info('Fetching fresh data from Google Sheets (OAuth, batch)...');
      const ranges = this._computeExistingRanges();
      await this._batchFetchAll(ranges);
      this.lastFetchTs = Date.now();
      // Invalidate memoized caches derived from raw tables
      this._workersCache = null;
      this._workersCacheKey = null;
      try { this.dispatchEvent(new CustomEvent('updated', { detail: { lastFetchTs: this.lastFetchTs } })); } catch {}
      return this.data;
    } catch (e) {
      console.error('❌ Error loading spreadsheet data:', e);
      throw e;
    } finally {
      this.isLoading = false;
    }
  }

  async _discoverAvailableSheets() {
    const resp = await window.gapi.client.sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
      fields: 'sheets(properties(title))',
    });
    const titles = (resp.result?.sheets || []).map(s => s.properties?.title).filter(Boolean);
    this._availableSheets = new Set(titles);
  }

  _computeExistingRanges() {
    const want = [
      ['SPFM', 'SPFM!A:T'],
      ['Routes', 'Routes!A:Z'],
      ['Recovery', 'Recovery!A:P'],
      ['SPFM_Delivery', 'SPFM_Delivery!A:P'],
      ['Status', 'Status!A:E'],
      ['Contacts', 'Contacts!A:Z'],
      ['Misc', 'Misc!A:B'],
      ['Misc', 'Misc!D:E'],
    ];
    const has = (name) => !this._availableSheets || this._availableSheets.size === 0 || this._availableSheets.has(name);
    return want.filter(([name]) => has(name)).map(([, range]) => range);
  }

  async authorizedFetch(url, init = {}) {
    const token = window.gapi?.client?.getToken?.();
    if (!token || !token.access_token) throw new Error('No auth token available');
    const headers = new Headers(init.headers || {});
    headers.set('Authorization', `Bearer ${token.access_token}`);
    return fetch(url, { ...init, headers });
  }

  async checkRangeVersion(range) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?fields=range`;
    const prev = this._etagByRange.get(range);
    const resp = await this.authorizedFetch(url, { method: 'GET', headers: prev ? { 'If-None-Match': prev } : undefined });
    if (resp.status === 304) return { changed: false, etag: prev };
    if (resp.status === 429) {
      const ra = resp.headers.get('Retry-After');
      const retryAfterMs = ra ? (parseInt(ra, 10) * 1000) : 60000;
      const err = new Error('Rate limited (429)');
      err.code = 429; err.retryAfterMs = retryAfterMs;
      throw err;
    }
    const etag = resp.headers.get('ETag') || resp.headers.get('Etag') || resp.headers.get('etag');
    if (etag && etag !== prev) {
      this._etagByRange.set(range, etag);
      return { changed: true, etag };
    }
    return { changed: false, etag };
  }

  startVersionPolling(intervalMs = 60000, ranges = null) {
    if (this._pollTid) { clearTimeout(this._pollTid); this._pollTid = null; }
    this._pollIntervalMs = intervalMs;
    const tick = async () => {
      try {
        let anyChanged = false;
        const baseRanges = (ranges && ranges.length) ? ranges : this._computeExistingRanges();
        for (const r of baseRanges) {
          try {
            const res = await this.checkRangeVersion(r);
            if (res.changed) anyChanged = true;
          } catch (e) {
            if (e && e.code === 429) {
              // Apply backoff and break early
              const waitMs = e.retryAfterMs || Math.min((this._pollIntervalMs||60000)*2, 10*60000);
              this._pollIntervalMs = waitMs;
              console.warn('[Poll] 429 received. Backing off for', waitMs, 'ms');
              break;
            }
          }
        }
        if (anyChanged) {
          console.info('Detected sheet change via ETag — refreshing data');
          await this.fetchSheetData();
          // Reset backoff after a successful refresh
          this._pollIntervalMs = intervalMs;
        }
      } catch (e) {
        console.warn('Version poll failed:', e);
      }
      // schedule next with small jitter (up to 25% of interval)
      const base = this._pollIntervalMs || intervalMs;
      const jitter = Math.floor(Math.random() * (base * 0.25));
      this._pollTid = setTimeout(tick, base + jitter);
    };
    // initial delay small to avoid hammering immediately
    const initialJitter = Math.floor(Math.random() * 1500);
    this._pollTid = setTimeout(tick, 2000 + initialJitter);
    return () => { if (this._pollTid) clearTimeout(this._pollTid); this._pollTid = null; };
  }

  async _batchFetchAll(ranges) {
    let result;
    try {
      const resp = await window.gapi.client.sheets.spreadsheets.values.batchGet({
        spreadsheetId: SPREADSHEET_ID,
        ranges,
      });
      result = resp.result;
    } catch (e) {
      console.warn('Batch get failed, falling back to individual fetches:', e);
      // Fallback to individual fetches
      const tryGet = async (range) => {
        try { return await window.gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range }); }
        catch { return null; }
      };
      if (!this._availableSheets || this._availableSheets.has('SPFM')) {
        const spfmResp = await tryGet('SPFM!A:T');
        this._parseSPFM(spfmResp?.result?.values || []);
      }
      const tasks = [];
      if (!this._availableSheets || this._availableSheets.has('Routes')) tasks.push(this.fetchRoutesData());
      if (!this._availableSheets || this._availableSheets.has('Recovery')) tasks.push(this.fetchRecoveryData());
      if (!this._availableSheets || this._availableSheets.has('SPFM_Delivery')) tasks.push(this.fetchDeliveryData());
      if (!this._availableSheets || this._availableSheets.has('Status')) tasks.push(this.fetchInventoryData());
      if (!this._availableSheets || this._availableSheets.has('Contacts')) tasks.push(this.fetchContactsData());
      if (!this._availableSheets || this._availableSheets.has('Misc')) tasks.push(this.fetchMiscData());
      await Promise.all(tasks);
      return;
    }

    const valueRanges = result.valueRanges || [];
    const map = new Map(valueRanges.map((vr) => [vr.range.split('!')[0], vr]));

    this._parseSPFM(map.get('SPFM')?.values || []);

    // Routes consolidated parsing
    try {
      const routesValues = map.get('Routes')?.values || [];
      this.routesData = [];
      if (routesValues.length > 0) {
        const values = routesValues;
        let headers = null;
        const looksLikeHeader = (row) => {
          const lower = row.map((c) => (c || '').toString().trim().toLowerCase());
          return (
            lower.includes('date') ||
            lower.includes('weekday') ||
            lower.includes('routeid') ||
            lower.includes('market') ||
            lower.includes('route')
          );
        };
        const isEmptyRow = (row) => !row || row.every((c) => !c || String(c).trim() === '');
        for (let i = 0; i < values.length; i++) {
          const row = values[i];
          if (isEmptyRow(row)) continue;
          if (looksLikeHeader(row)) { headers = row; continue; }
          if (!headers) continue;
          const obj = {}; headers.forEach((h, idx) => obj[h] = row[idx] || '');
          const isHeaderEcho = Object.keys(obj).every((k) => String(obj[k]).trim() === String(k).trim() || obj[k] === '');
          if (!isHeaderEcho) this.routesData.push(obj);
        }
      }
    } catch (e) { console.warn('Routes parse failed:', e); this.routesData = []; }

    // Recovery
    try {
      const values = map.get('Recovery')?.values || [];
      this.recoveryData = [];
      if (values.length >= 2) {
        const headers = values[0];
        this.recoveryData = values.slice(1).map((row) => { const obj = {}; headers.forEach((h,i)=>obj[h]=row[i]||''); return obj; });
      } else if (this.routesData.length) {
        const headers = (map.get('Routes')?.values || [])[0] || [];
        const idxType = headers.indexOf('routeType');
        if (idxType >= 0) {
          this.recoveryData = (map.get('Routes')?.values || []).slice(1)
            .filter(r => /recovery/i.test((r[idxType]||'')))
            .map((row) => { const obj = {}; headers.forEach((h,i)=>obj[h]=row[i]||''); obj.type='recovery'; return obj; });
        }
      }
    } catch (e) { console.warn('Recovery parse failed:', e); this.recoveryData = []; }

    // Delivery
    try {
      const values = map.get('SPFM_Delivery')?.values || [];
      this.deliveryData = [];
      if (values.length >= 2) {
        const headers = values[0];
        this.deliveryData = values.slice(1).map((row) => { const obj = {}; headers.forEach((h,i)=>obj[h]=row[i]||''); return obj; });
      } else if (this.routesData.length) {
        const routesValues = map.get('Routes')?.values || [];
        const headers = routesValues[0] || [];
        const idxType = headers.indexOf('routeType');
        if (idxType >= 0) {
          this.deliveryData = routesValues.slice(1)
            .filter(r => /delivery/i.test((r[idxType]||'')))
            .map((row) => { const obj = {}; headers.forEach((h,i)=>obj[h]=row[i]||''); obj.type='spfm-delivery'; return obj; });
        }
      }
    } catch (e) { console.warn('Delivery parse failed:', e); this.deliveryData = []; }

    // Inventory (Status)
    try {
      const values = map.get('Status')?.values || [];
      this.inventoryData = [];
      if (values.length >= 2) {
        const headers = values[0];
        this.inventoryData = values.slice(1).map((row) => { const obj = {}; headers.forEach((h,i)=>obj[h]=row[i]||''); return obj; });
      }
    } catch (e) { console.warn('Status parse failed:', e); this.inventoryData = []; }

    // Contacts
    try {
      const values = map.get('Contacts')?.values || [];
      this.contactsData = [];
      if (values.length >= 2) {
        const headers = values[0];
        this.contactsData = values.slice(1).map((row) => { const obj = {}; headers.forEach((h,i)=>obj[h]=row[i]||''); return obj; });
      }
    } catch (e) { console.warn('Contacts parse failed:', e); this.contactsData = []; }

    // Misc
    try { await this.fetchMiscData(); } catch {}
  }

  _parseSPFM(values) {
    if (!values || values.length < 2) { this.data = []; return; }
    let headerIndex = 0;
    for (let i = 0; i < Math.min(values.length, 10); i++) {
      const row = values[i].map((c) => (c || '').toString().toLowerCase());
      if (row.includes('date') || row.includes('routeid') || row.includes('market')) { headerIndex = i; break; }
    }
    const headers = values[headerIndex];
    this.data = values
      .slice(headerIndex + 1)
      .filter((row) => row && row.length > 0 && row[0])
      .map((row) => { const obj = {}; headers.forEach((h,i)=>obj[h]=row[i]||''); return obj; });
    console.info(`✅ Processed ${this.data.length} routes from SPFM tab`);
  }

  async fetchRecoveryData() {
    try {
      await this.ensureGapiClientReady();
      const recoveryRange = 'Recovery!A:P';
      let result;
      try {
        const resp = await window.gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: recoveryRange });
        result = resp.result;
      } catch (e) { result = null; }
      if (result && result.values && result.values.length >= 2) {
        const headers = result.values[0];
        this.recoveryData = result.values.slice(1).map((row) => { const obj = {}; headers.forEach((h,i)=>obj[h]=row[i]||''); return obj; });
        return;
      }
      // Derive from Routes
      const routesRange = 'Routes!A:Z';
      const routesResp = await window.gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: routesRange });
      const rValues = routesResp.result?.values || [];
      if (rValues.length < 2) { this.recoveryData = []; return; }
      const rHeaders = rValues[0];
      const idxType = rHeaders.indexOf('routeType');
      this.recoveryData = rValues.slice(1)
        .filter((row) => idxType >= 0 && (row[idxType] || '').toLowerCase() === 'recovery')
        .map((row) => { const obj = {}; rHeaders.forEach((h,i)=>obj[h]=row[i]||''); obj.type='recovery'; return obj; });
    } catch (e) {
      console.info('Recovery data not available:', e);
      this.recoveryData = [];
    }
  }
  async fetchDeliveryData() {
    try {
      await this.ensureGapiClientReady();
      const deliveryRange = 'SPFM_Delivery!A:P';
      let result;
      try {
        const resp = await window.gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: deliveryRange });
        result = resp.result;
      } catch (e) { result = null; }
      if (result && result.values && result.values.length >= 2) {
        const headers = result.values[0];
        this.deliveryData = result.values.slice(1).map((row) => { const obj = {}; headers.forEach((h,i)=>obj[h]=row[i]||''); return obj; });
        return;
      }
      // Derive from Routes
      const routesRange = 'Routes!A:Z';
      const routesResp = await window.gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: routesRange });
      const rValues = routesResp.result?.values || [];
      if (rValues.length < 2) { this.deliveryData = []; return; }
      const rHeaders = rValues[0];
      const idxType = rHeaders.indexOf('routeType');
      this.deliveryData = rValues.slice(1)
        .filter((row) => idxType >= 0 && /delivery/i.test(row[idxType] || ''))
        .map((row) => { const obj = {}; rHeaders.forEach((h,i)=>obj[h]=row[i]||''); obj.type='spfm-delivery'; return obj; });
    } catch (e) {
      console.info('SPFM Delivery data not available:', e);
      this.deliveryData = [];
    }
  }
  async fetchInventoryData() {
    try {
      await this.ensureGapiClientReady();
      const inventoryRange = 'Status!A:E';
      const resp = await window.gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: inventoryRange });
      const result = resp.result;
      if (!result.values || result.values.length < 2) { this.inventoryData = []; return; }
      const headers = result.values[0];
      this.inventoryData = result.values.slice(1).map((row) => { const obj = {}; headers.forEach((h,i)=>obj[h]=row[i]||''); return obj; });
    } catch (e) {
      console.info('Inventory data not available:', e);
      this.inventoryData = [];
    }
  }
  async fetchContactsData() {
    try {
      await this.ensureGapiClientReady();
      const contactsRange = 'Contacts!A:Z';
      const resp = await window.gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: contactsRange });
      const result = resp.result;
      const values = result.values;
      if (!values || values.length === 0) { this.contactsData = []; return; }
      const headers = values[0];
      this.contactsData = values.slice(1).map((row) => { const contact = {}; headers.forEach((h,i)=>contact[h]=row[i]||''); return contact; });
    } catch (e) {
      console.error('❌ Error fetching contacts data:', e);
      this.contactsData = [];
    }
  }
  async fetchRoutesData() {
    try {
      await this.ensureGapiClientReady();
      const routesRange = 'Routes!A:Z';
      const resp = await window.gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: routesRange });
      const result = resp.result;
      this.routesData = [];
      if (!result.values || result.values.length === 0) { this.routesData = []; return; }
      const values = result.values;
      let headers = null;
      const looksLikeHeader = (row) => {
        const lower = row.map((c) => (c || '').toString().trim().toLowerCase());
        return (
          lower.includes('date') ||
          lower.includes('weekday') ||
          lower.includes('routeid') ||
          lower.includes('market') ||
          lower.includes('route')
        );
      };
      const isEmptyRow = (row) => !row || row.every((c) => !c || String(c).trim() === '');
      for (let i = 0; i < values.length; i++) {
        const row = values[i];
        if (isEmptyRow(row)) continue;
        if (looksLikeHeader(row)) { headers = row; continue; }
        if (!headers) continue;
        const obj = {}; headers.forEach((h, idx) => { obj[h] = row[idx] || ''; });
        const isHeaderEcho = Object.keys(obj).every((k) => String(obj[k]).trim() === String(k).trim() || obj[k] === '');
        if (isHeaderEcho) continue;
        this.routesData.push(obj);
      }
    } catch (e) {
      console.info('Routes sheet not available:', e);
      this.routesData = [];
    }
  }

  async fetchMiscData() {
    // Workers
    try {
      const respW = await window.gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Misc!A:B' });
      const valuesW = respW.result?.values || [];
      this.miscWorkers = [];
      this.miscWorkerMap = {};
      if (valuesW.length >= 2) {
        const headers = valuesW[0].map((h) => (h || '').toString().trim());
        const idxName = headers.findIndex((h) => /worker/i.test(h));
        const idxEmoji = headers.findIndex((h) => /emoji/i.test(h));
        valuesW.slice(1).forEach((row) => {
          const name = (row[idxName] || '').toString().trim();
          if (!name) return;
          const emoji = (row[idxEmoji] || '').toString().trim();
          const rec = { worker: name, emoji };
          this.miscWorkers.push(rec);
          if (emoji) this.miscWorkerMap[name] = emoji;
        });
        console.info(`✅ Loaded ${this.miscWorkers.length} workers from Misc`);
      }
    } catch (e) { console.info('Misc workers not available:', e); }

    // Vehicles
    try {
      const respV = await window.gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'Misc!D:E' });
      const valuesV = respV.result?.values || [];
      this.miscVehicles = [];
      this.miscVehicleMap = {};
      if (valuesV.length >= 2) {
        const headers = valuesV[0].map((h) => (h || '').toString().trim());
        const idxName = headers.findIndex((h) => /van|vehicle/i.test(h));
        const idxEmoji = headers.findIndex((h) => /emoji/i.test(h));
        valuesV.slice(1).forEach((row) => {
          const name = (row[idxName] || '').toString().trim();
          if (!name) return;
          const emoji = (row[idxEmoji] || '').toString().trim();
          const rec = { van: name, emoji };
          this.miscVehicles.push(rec);
          if (emoji) this.miscVehicleMap[name] = emoji;
        });
        console.info(`✅ Loaded ${this.miscVehicles.length} vehicles from Misc`);
      }
    } catch (e) { console.info('Misc vehicles not available:', e); }
  }

  // ===== Helpers used by DataService normalization =====
  getAllWorkersFromRoute(route) {
    const workers = [];
    let i = 1;
    while (route[`worker${i}`]) {
      const workerCell = String(route[`worker${i}`]).trim();
      if (
        workerCell &&
        !flexibleTextMatch(workerCell, 'cancelled') &&
        workerCell !== `worker${i}` &&
        !this.isColumnHeaderName(workerCell)
      ) {
        workerCell.split(',').map((n) => n.trim()).filter(Boolean).forEach((w) => workers.push(w));
      }
      i++;
    }
    if (workers.length === 0 && (route.Worker || route.worker)) {
      const singleWorker = String(route.Worker || route.worker).trim();
      if (singleWorker && !this.isColumnHeaderName(singleWorker) && !flexibleTextMatch(singleWorker, 'cancelled')) workers.push(singleWorker);
    }
    return workers;
  }
  getAllVolunteers(route) {
    const volunteers = [];
    let i = 1;
    while (route[`volunteer${i}`]) {
      const val = String(route[`volunteer${i}`]).trim();
      if (val && val !== `volunteer${i}`) val.split(',').map((n)=>n.trim()).filter(Boolean).forEach((v)=>volunteers.push(v));
      i++;
    }
    return volunteers;
  }
  getAllVans(route) {
    const vans = [];
    let i = 1;
    while (route[`van${i}`]) {
      const val = String(route[`van${i}`]).trim();
      if (val && val !== `van${i}`) val.split(',').map((n)=>n.trim()).filter(Boolean).forEach((v)=>vans.push(v));
      i++;
    }
    return vans;
  }
  getAllRouteContacts(route) {
    const contacts = [];
    let i = 1;
    while (route[`contact${i}`] || route[`Contact${i}`]) {
      const val = String(route[`contact${i}`] || route[`Contact${i}`] || '').trim();
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
      const val = String(route[`phone${i}`] || route[`Phone${i}`] || '').trim();
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
    if (!text || typeof text !== 'string') return false;
    const headerPatterns = [
      'food from','foodfrom','food_from','food source','source','from','worker1','worker2','worker3','worker4','worker5','worker','volunteer','volunteers','volunteer1','volunteer2','date','time','location','address','route','delivery','pickup','dropoff','drop off','drop-off','market','vendor','client','organization','notes','comments','status','cancelled','canceled','phone','email','contact','quantity','amount','pounds','lbs','weight','items','food type','type','description','details','instructions','van','vehicle','driver','team','assignment','task'
    ];
    const normalizedText = text.toLowerCase().trim();
    return headerPatterns.some((pattern) => normalizedText === pattern || normalizedText.startsWith(pattern));
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
    const cacheKey = keyParts.join('|');
    if (this._workersCache && this._workersCacheKey === cacheKey) return [...this._workersCache];
    const workers = new Set();
    if (this.miscWorkers && this.miscWorkers.length > 0) {
      this.miscWorkers.forEach((w) => { const name = (w.worker || '').toString(); if (!name) return; if (/volunteer/i.test(name)) return; workers.add(name); });
    }
    const addFromRoutes = (rows) => {
      rows.forEach((route) => {
        const routeWorkers = this.getAllWorkersFromRoute(route);
        routeWorkers.forEach((worker) => { if (worker && !/volunteer/i.test(worker)) workers.add(worker); });
      });
    };
    addFromRoutes(this.data); addFromRoutes(this.recoveryData); addFromRoutes(this.deliveryData); addFromRoutes(this.routesData || []);
    const result = Array.from(workers).sort();
    this._workersCacheKey = cacheKey; this._workersCache = result; return [...result];
  }

  getAddressFromContacts(name) {
    if (!this.contactsData || this.contactsData.length === 0) return null;
    const contact = this.contactsData.find((c) => c && c.Location && (flexibleTextMatch(c.Location, name) || normalizeText(c.Location) === normalizeText(name)));
    if (!contact) return null;
    const allContacts = this.getAllContacts(contact);
    const allPhones = this.getAllPhones(contact);
    const contactName = allContacts.length > 0 ? allContacts[0] : contact.Contact || contact.contact || contact.Location || '';
    const phone = allPhones.length > 0 ? allPhones[0] : contact.Phone || contact.phone || '';
    return { address: contact.Address || contact.Location || '', phone, phones: allPhones, contactName, contacts: allContacts, notes: contact['Notes/ Special Instructions'] || contact.Notes || contact.notes || '', type: contact.Type || contact.type || contact.TYPE || '' };
  }

  getAllContacts(contact) {
    const contacts = [];
    let i = 1;
    while (contact[`contact${i}`] || contact[`Contact${i}`]) {
      const contactPerson = (contact[`contact${i}`] || contact[`Contact${i}`] || '').trim();
      if (contactPerson) contacts.push(contactPerson);
      i++;
    }
    return contacts;
  }
  getAllPhones(contact) {
    const phones = [];
    let i = 1;
    while (contact[`phone${i}`] || contact[`Phone${i}`]) {
      const phone = (contact[`phone${i}`] || contact[`Phone${i}`] || '').trim();
      if (phone) phones.push(phone);
      i++;
    }
    return phones;
  }

  getDataSignature() {
    try {
      return [
        this.lastFetchTs || 0,
        (this.data||[]).length,
        (this.recoveryData||[]).length,
        (this.deliveryData||[]).length,
        (this.routesData||[]).length,
      ].join('|');
    } catch { return ''; }
  }
}

export const sheetsAPI = new SheetsAPIService();

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
