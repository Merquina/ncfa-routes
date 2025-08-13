/* ========================================
   SPFM Routes - Google Sheets Integration
   ======================================== */

// Configuration constants (moved here as app.js is no longer loaded)
const SPREADSHEET_ID = "1yn3yPWW5ThhPvHzYiSkwwNztVnAQLD2Rk_QEQJwlr2k";
const API_KEY = ""; // Not required when using OAuth via gapi; left blank to avoid errors

class SheetsAPI {
  constructor() {
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
    // memoization caches
    this._workersCacheKey = null;
    this._workersCache = null;
  }

  // ========================================
  // MAIN DATA FETCHING
  // ========================================
  async fetchSheetData() {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      // Ensure Google API client is ready
      await this.ensureGapiClientReady();
      console.info("Fetching fresh data from Google Sheets (OAuth, batch)...");
      await this._batchFetchAll();
      return this.data;
    } catch (error) {
      console.error("❌ Error loading spreadsheet data:", error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  async _batchFetchAll() {
    const ranges = [
      'SPFM!A:T',
      'Routes!A:Z',
      'Recovery!A:P',
      'SPFM_Delivery!A:P',
      'Status!A:E',
      'Contacts!A:Z',
      'Misc!A:B',
      'Misc!D:E',
    ];
    let result;
    try {
      const resp = await window.gapi.client.sheets.spreadsheets.values.batchGet({
        spreadsheetId: SPREADSHEET_ID,
        ranges,
      });
      result = resp.result;
    } catch (e) {
      console.warn('Batch get failed, falling back to individual fetches:', e);
      // Fallback to individual methods
      const spfmResp = await window.gapi.client.sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: 'SPFM!A:T' });
      this._parseSPFM(spfmResp.result?.values || []);
      await Promise.all([
        this.fetchRoutesData(),
        this.fetchRecoveryData(),
        this.fetchDeliveryData(),
        this.fetchInventoryData(),
        this.fetchContactsData(),
        this.fetchMiscData(),
      ]);
      return;
    }

    const valueRanges = result.valueRanges || [];
    const map = new Map(valueRanges.map((vr) => [vr.range.split('!')[0], vr]));

    // SPFM
    this._parseSPFM(map.get('SPFM')?.values || []);

    // Routes
    try {
      const routesValues = map.get('Routes')?.values || [];
      this.routesData = [];
      if (routesValues.length > 0) {
        // Use existing multi-table parser
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
        // Derive from Routes
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

    // Contacts (lazy candidates)
    try {
      const values = map.get('Contacts')?.values || [];
      this.contactsData = [];
      if (values.length >= 2) {
        const headers = values[0];
        this.contactsData = values.slice(1).map((row) => { const obj = {}; headers.forEach((h,i)=>obj[h]=row[i]||''); return obj; });
      }
    } catch (e) { console.warn('Contacts parse failed:', e); this.contactsData = []; }

    // Misc Workers
    try {
      const values = map.get('Misc')?.values || [];
      // Note: batchGet returns full sheet ranges per range; since we requested both A:B and D:E,
      // depending on API behavior, we may only get one. If only one, fallback to individual calls.
    } catch {}
    // For Misc, re-use existing method to be safe
    try { await this.fetchMiscData(); } catch {}
  }

  _parseSPFM(values) {
    if (!values || values.length < 2) { this.data = []; return; }
    // Find header row dynamically (handles intro rows)
    let headerIndex = 0;
    for (let i = 0; i < Math.min(values.length, 10); i++) {
      const row = values[i].map((c) => (c || '').toString().toLowerCase());
      if (row.includes('date') || row.includes('routeid') || row.includes('market')) {
        headerIndex = i; break;
      }
    }
    const headers = values[headerIndex];
    this.data = values
      .slice(headerIndex + 1)
      .filter((row) => row && row.length > 0 && row[0])
      .map((row) => { const obj = {}; headers.forEach((h,i)=>obj[h]=row[i]||''); return obj; });
    console.info(`✅ Processed ${this.data.length} routes from SPFM tab`);
  }

  // Wait for gapi client.sheets to be available (on hard refresh timing issues)
  async ensureGapiClientReady(maxWaitMs = 5000) {
    const start = Date.now();
    while (!window.gapi || !window.gapi.client || !window.gapi.client.sheets) {
      if (Date.now() - start > maxWaitMs) break;
      await new Promise(r => setTimeout(r, 100));
    }
  }

  // ========================================
  // RECOVERY ROUTES DATA
  // ========================================
  async fetchRecoveryData() {
    try {
      await this.ensureGapiClientReady();
      // Prefer dedicated "Recovery" tab if present
      const recoveryRange = 'Recovery!A:P';
      console.info("🚗 Attempting to fetch recovery routes (OAuth)...");
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
          headers.forEach((header, index) => {
            obj[header] = row[index] || "";
          });
          return obj;
        });
        console.info(`✅ Loaded ${this.recoveryData.length} recovery routes`);
        console.debug("🔍 Debug: Sample recovery route:", this.recoveryData[0]);
        return;
      }

      // Fallback: derive Recovery from consolidated Routes sheet by routeType
      console.info("🔄 Recovery tab missing; deriving from Routes (routeType=Recovery)");
      const routesRange = 'Routes!A:Z';
      const routesResp = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: routesRange,
      });
      const rValues = routesResp.result?.values || [];
      if (rValues.length < 2) {
        console.info("Routes sheet empty; no recovery routes available");
        this.recoveryData = [];
        return;
      }
      const rHeaders = rValues[0];
      const rows = rValues.slice(1);
      const idxType = rHeaders.indexOf('routeType');
      this.recoveryData = rows
        .filter((row) => idxType >= 0 && (row[idxType] || '').toLowerCase() === 'recovery')
        .map((row) => {
          const obj = {};
          rHeaders.forEach((h, i) => { obj[h] = row[i] || ''; });
          obj.type = 'recovery';
          return obj;
        });
      console.info(`✅ Derived ${this.recoveryData.length} recovery routes from Routes`);
    } catch (error) {
      console.info("Recovery data not available (this is optional):", error);
    }
  }

  // ========================================
  // SPFM DELIVERY DATA
  // ========================================
  async fetchDeliveryData() {
    try {
      await this.ensureGapiClientReady();
      // Try dedicated tab first
      const deliveryRange = 'SPFM_Delivery!A:P';
      console.info("🚚 Attempting to fetch SPFM delivery routes (OAuth)...");
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
          headers.forEach((header, index) => {
            obj[header] = row[index] || "";
          });
          return obj;
        });
        console.info(`✅ Loaded ${this.deliveryData.length} SPFM delivery routes`);
        return;
      }

      // Fallback: derive delivery from Routes sheet if routeType matches
      console.info("🔄 Delivery tab missing; deriving from Routes (routeType contains 'delivery')");
      const routesRange = 'Routes!A:Z';
      const routesResp = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: routesRange,
      });
      const rValues = routesResp.result?.values || [];
      if (rValues.length < 2) {
        this.deliveryData = [];
        return;
      }
      const rHeaders = rValues[0];
      const idxType = rHeaders.indexOf('routeType');
      this.deliveryData = rValues.slice(1)
        .filter((row) => idxType >= 0 && /delivery/i.test(row[idxType] || ''))
        .map((row) => {
          const obj = {};
          rHeaders.forEach((h, i) => { obj[h] = row[i] || ''; });
          obj.type = 'spfm-delivery';
          return obj;
        });
      console.info(`✅ Derived ${this.deliveryData.length} delivery routes from Routes`);
    } catch (error) {
      console.info(
        "SPFM Delivery data not available (this is optional):",
        error,
      );
    }
  }

  // ========================================
  // INVENTORY DATA
  // ========================================
  async fetchInventoryData() {
    try {
      await this.ensureGapiClientReady();
      // Try to fetch box inventory from the "Inventory" sheet tab
      // Inventory table now resides on the 'Status' sheet (columns A:E)
      const inventoryRange = 'Status!A:E';
      console.info("📦 Attempting to fetch inventory data (OAuth)...");
      const resp = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: inventoryRange,
      });
      const result = resp.result;

      if (!result.values || result.values.length < 2) {
        console.info("Inventory tab is empty - skipping inventory display");
        return;
      }

      // Convert inventory rows to JavaScript objects
      const headers = result.values[0];
      this.inventoryData = result.values.slice(1).map((row) => {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] || "";
        });
        return obj;
      });

      console.info(`✅ Loaded ${this.inventoryData.length} inventory items`);
    } catch (error) {
      console.info("Inventory data not available (this is optional):", error);
    }
  }

  // ========================================
  // CONTACTS DATA
  // ========================================
  async fetchContactsData() {
    try {
      await this.ensureGapiClientReady();
      const contactsRange = 'Contacts!A:Z';
      console.info("📞 Attempting to fetch contacts data (OAuth)...");
      const resp = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: contactsRange,
      });
      const result = resp.result;
      const values = result.values;

      if (!values || values.length === 0) {
        console.info("No contacts data found.");
        return;
      }

      const headers = values[0];
      this.contactsData = values.slice(1).map((row) => {
        const contact = {};
        headers.forEach((header, index) => {
          contact[header] = row[index] || "";
        });
        return contact;
      });

      console.info(
        "✅ Contacts data loaded:",
        this.contactsData.length,
        "contacts",
      );
    } catch (error) {
      console.error("❌ Error fetching contacts data:", error);
    }
  }

  // ========================================
  // CONSOLIDATED ROUTES (Routes sheet)
  // ========================================
  async fetchRoutesData() {
    try {
      const routesRange = 'Routes!A:Z';
      console.info("🧭 Fetching consolidated Routes sheet (OAuth)...");
      const resp = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: routesRange,
      });
      const result = resp.result;
      this.routesData = [];
      if (!result.values || result.values.length === 0) {
      console.info("Routes sheet empty - skipping consolidated routes");
        return;
      }
      // The Routes sheet may contain multiple tables (e.g., dated routes and periodic routes)
      // Detect header rows dynamically and map following rows accordingly until the next header.
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
        if (looksLikeHeader(row)) {
          headers = row;
          continue;
        }
        if (!headers) continue; // Skip preface text before first header
        const obj = {};
        headers.forEach((h, idx) => { obj[h] = row[idx] || ''; });
        // Skip rows that are header echoes (cells equal to header names)
        const isHeaderEcho = Object.keys(obj).every((k) => String(obj[k]).trim() === String(k).trim() || obj[k] === '');
        if (isHeaderEcho) continue;
        this.routesData.push(obj);
      }
      console.info(`✅ Loaded ${this.routesData.length} rows from Routes sheet across tables`);
    } catch (error) {
      console.info("Routes sheet not available (optional):", error);
      this.routesData = [];
    }
  }

  // ========================================
  // MISC DATA (Workers, Vehicles, Materials)
  // ========================================
  async fetchMiscData() {
    try {
      await this.ensureGapiClientReady();
      const rangeWorkers = 'Misc!A:B'; // worker, Emoji
      const rangeVehicles = 'Misc!D:E'; // Van, Emoji

      // Workers
      const respW = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: rangeWorkers,
      });
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

      // Vehicles
      const respV = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: rangeVehicles,
      });
      const valuesV = respV.result?.values || [];
      this.miscVehicles = [];
      this.miscVehicleMap = {};
      if (valuesV.length >= 2) {
        const headers = valuesV[0].map((h) => (h || '').toString().trim());
        const idxVan = headers.findIndex((h) => /van/i.test(h));
        const idxEmoji = headers.findIndex((h) => /emoji/i.test(h));
        valuesV.slice(1).forEach((row) => {
          const van = (row[idxVan] || '').toString().trim();
          if (!van) return;
          const emoji = (row[idxEmoji] || '').toString().trim();
          const rec = { van, emoji };
          this.miscVehicles.push(rec);
          if (emoji) this.miscVehicleMap[van] = emoji;
        });
        console.info(`✅ Loaded ${this.miscVehicles.length} vehicles from Misc`);
      }
    } catch (error) {
      console.info('Misc data not available (optional):', error);
    }
  }

  // ========================================
  // FETCH WITH RETRY FOR RATE LIMITS
  // ========================================
  async fetchWithRetry(url, maxRetries = 3, delay = 2000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url);

        if (response.status === 429) {
          console.warn(
            `Rate limited (429), waiting ${delay}ms before retry ${i + 1}/${maxRetries}`,
          );
          if (i < maxRetries - 1) {
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
            continue;
          }
        }

        return response;
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        console.warn(`Request failed, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // ========================================
  // HELPER METHODS
  // ========================================

  // Get all numbered worker columns from a route object
  getAllWorkersFromRoute(route) {
    const workers = [];
    let i = 1;

    console.debug(`🔍 DEBUG getAllWorkers - Route keys:`, Object.keys(route));
    console.debug(`🔍 DEBUG getAllWorkers - Looking for worker columns...`);

    while (route[`worker${i}`]) {
      const workerCell = route[`worker${i}`].trim();
      console.debug(`🔍 DEBUG getAllWorkers - worker${i}: "${workerCell}"`);
      // Skip header rows that have literal column names as values
      if (
        workerCell &&
        !flexibleTextMatch(workerCell, "cancelled") &&
        workerCell !== `worker${i}` &&
        !this.isColumnHeaderName(workerCell)
      ) {
        // Split comma-separated names into individual workers
        const individualWorkers = workerCell
          .split(",")
          .map((name) => name.trim())
          .filter((name) => name);
        individualWorkers.forEach((worker) => {
          workers.push(worker);
          console.debug(`🔍 DEBUG getAllWorkers - Added worker: "${worker}"`);
        });
      } else if (workerCell === `worker${i}`) {
        console.debug(
          `🔍 DEBUG getAllWorkers - Skipping header row with literal column name: "${workerCell}"`,
        );
      }
      i++;
    }

    // Also check old single column names for backward compatibility
    if (workers.length === 0 && (route.Worker || route.worker)) {
      const singleWorker = (route.Worker || route.worker).trim();
      console.debug(
        `🔍 DEBUG getAllWorkers - Found single worker column: "${singleWorker}"`,
      );
      if (
        singleWorker &&
        !flexibleTextMatch(singleWorker, "cancelled") &&
        !this.isColumnHeaderName(singleWorker)
      ) {
        workers.push(singleWorker);
        console.debug(
          `🔍 DEBUG getAllWorkers - Added single worker: "${singleWorker}"`,
        );
      }
    }

    console.debug(`🔍 DEBUG getAllWorkers - Final workers:`, workers);
    return workers;
  }

  // Get all numbered van columns from a route object
  getAllVans(route) {
    const vans = [];
    let i = 1;
    while (route[`van${i}`]) {
      const vanCell = route[`van${i}`].trim();
      // Skip header rows that have literal column names as values
      if (vanCell && vanCell !== `van${i}`) {
        // Split comma-separated van names into individual vans
        const individualVans = vanCell
          .split(",")
          .map((name) => name.trim())
          .filter((name) => name);
        individualVans.forEach((van) => {
          vans.push(van);
        });
      }
      i++;
    }
    return vans;
  }

  // Get all numbered volunteer columns from a route object
  getAllVolunteers(route) {
    const volunteers = [];
    let i = 1;
    while (route[`volunteer${i}`]) {
      const volunteerCell = route[`volunteer${i}`].trim();
      // Skip header rows that have literal column names as values
      if (volunteerCell && volunteerCell !== `volunteer${i}`) {
        // Split comma-separated names into individual volunteers
        const individualVolunteers = volunteerCell
          .split(",")
          .map((name) => name.trim())
          .filter((name) => name);
        individualVolunteers.forEach((volunteer) => {
          volunteers.push(volunteer);
        });
      }
      i++;
    }
    return volunteers;
  }

  // Get all numbered contact columns from a contact object
  getAllContacts(contact) {
    const contacts = [];
    let i = 1;
    while (contact[`contact${i}`] || contact[`Contact${i}`]) {
      const contactPerson = (
        contact[`contact${i}`] ||
        contact[`Contact${i}`] ||
        ""
      ).trim();
      if (contactPerson) {
        contacts.push(contactPerson);
      }
      i++;
    }
    return contacts;
  }

  // Get all numbered phone columns from a contact object
  getAllPhones(contact) {
    const phones = [];
    let i = 1;
    while (contact[`phone${i}`] || contact[`Phone${i}`]) {
      const phone = (contact[`phone${i}`] || contact[`Phone${i}`] || "").trim();
      if (phone) {
        phones.push(phone);
      }
      i++;
    }
    return phones;
  }

  // Get all numbered contact columns from a route object
  getAllRouteContacts(route) {
    const contacts = [];
    let i = 1;
    while (route[`contact${i}`] || route[`Contact${i}`]) {
      const contact = (
        route[`contact${i}`] ||
        route[`Contact${i}`] ||
        ""
      ).trim();
      if (contact) {
        contacts.push(contact);
      }
      i++;
    }
    // Fallback to old single column if no numbered columns exist
    if (contacts.length === 0 && (route.contact || route.Contact)) {
      const singleContact = (route.contact || route.Contact).trim();
      if (singleContact) {
        contacts.push(singleContact);
      }
    }
    return contacts;
  }

  // Get all numbered phone columns from a route object
  getAllRoutePhones(route) {
    const phones = [];
    let i = 1;
    while (route[`phone${i}`] || route[`Phone${i}`]) {
      const phone = (route[`phone${i}`] || route[`Phone${i}`] || "").trim();
      if (phone) {
        phones.push(phone);
      }
      i++;
    }
    // Fallback to old single column if no numbered columns exist
    if (phones.length === 0 && (route.phone || route.Phone)) {
      const singlePhone = (route.phone || route.Phone).trim();
      if (singlePhone) {
        phones.push(singlePhone);
      }
    }
    return phones;
  }

  // Check if any worker or volunteer column contains volunteer-related text
  hasVolunteers(route) {
    const allWorkers = this.getAllWorkersFromRoute(route);
    const allVolunteers = this.getAllVolunteers(route);

    return (
      allVolunteers.length > 0 ||
      allWorkers.some((worker) => flexibleTextIncludes(worker, "volunteer"))
    );
  }

  getAddressFromContacts(name) {
    console.debug(`🔍 Debug: Looking up address for "${name}"`);
    console.debug(
      `🔍 Debug: contactsData available:`,
      this.contactsData?.length || 0,
    );

    if (!this.contactsData || this.contactsData.length === 0) {
      console.debug(`🔍 Debug: No contacts data available for "${name}"`);
      return null;
    }

    // Enhanced normalize function to handle more variations
    const normalize = (str) => {
      return normalizeText(str)
        .replace(/[''`]/g, "") // Remove apostrophes and quotes
        .replace(/[-\s]+/g, " ") // Replace dashes and multiple spaces with single space
        .replace(/\s+/g, " "); // Normalize multiple spaces to single space
    };

    console.debug(`🔍 Debug: Searching for "${name}" in contacts...`);
    console.debug(
      `🔍 Debug: Available contacts:`,
      this.contactsData.map((c) => ({
        Location: c.Location,
        Address: c.Address,
      })),
    );

    // Try multiple matching strategies
    let contact = null;

    // Strategy 1: Exact match (flexible text matching)
    contact = this.contactsData.find((contact) => {
      if (!contact.Location) return false;
      return flexibleTextMatch(contact.Location, name);
    });

    if (contact) {
      console.debug(`🔍 Debug: Found exact match for "${name}"`);
    } else {
      // Strategy 2: Exact match after normalizing apostrophes and spaces
      const normalizedName = normalize(name);
      contact = this.contactsData.find((contact) => {
        if (!contact.Location) return false;
        const normalizedLocation = normalize(contact.Location);
        return normalizedLocation === normalizedName;
      });

      if (contact) {
        console.debug(`🔍 Debug: Found normalized match for "${name}"`);
      }
    }

    if (contact) {
      console.debug(`🔍 Debug: Found contact for "${name}":`, {
        Location: contact.Location,
        Address: contact.Address,
        Phone: contact.Phone,
        Type: contact.Type,
        AllKeys: Object.keys(contact),
      });
      console.debug(`🔍 DEBUG Type value for "${name}": "${contact.Type}"`);
      const finalAddress = contact.Address || contact.Location || "";

      // Get all numbered contacts and phones
      const allContacts = this.getAllContacts(contact);
      const allPhones = this.getAllPhones(contact);

      // Fallback to old single column names if no numbered columns exist
      const contactName =
        allContacts.length > 0
          ? allContacts[0]
          : contact.Contact || contact.contact || contact.Location || "";

      const phone =
        allPhones.length > 0
          ? allPhones[0]
          : contact.Phone || contact.phone || "";

      return {
        address: finalAddress,
        phone: phone,
        phones: allPhones, // All phone numbers available
        contactName: contactName,
        contacts: allContacts, // All contact names available
        notes:
          contact["Notes/ Special Instructions"] ||
          contact.Notes ||
          contact.notes ||
          "",
        type: contact.Type || contact.type || contact.TYPE || "",
      };
    } else {
      console.debug(`🔍 Debug: No contact found for "${name}"`);
      console.debug(
        `🔍 Debug: Available locations:`,
        this.contactsData
          .map((c) => c.Location)
          .filter(Boolean)
          .slice(0, 5),
      );
      return null;
    }
  }

  getAllWorkers() {
    // Build cache key from current data snapshot
    const keyParts = [];
    try {
      keyParts.push((this.miscWorkers || []).length);
      keyParts.push((this.data || []).length);
      keyParts.push((this.recoveryData || []).length);
      keyParts.push((this.deliveryData || []).length);
      keyParts.push((this.routesData || []).length);
    } catch {}
    const cacheKey = keyParts.join('|');
    if (this._workersCache && this._workersCacheKey === cacheKey) {
      return [...this._workersCache];
    }

    const workers = new Set();

    // Prefer Misc Workers list if present
    if (this.miscWorkers && this.miscWorkers.length > 0) {
      this.miscWorkers.forEach((w) => {
        const name = (w.worker || '').toString();
        if (!name) return;
        if (/volunteer/i.test(name)) return; // exclude volunteers from worker list
        workers.add(name);
      });
    }

    // Add workers found in route rows (do NOT include volunteers here)
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

  getWorkerEmoji(name) {
    if (!name) return '';
    return this.miscWorkerMap?.[name] || '';
  }

  getVehicleEmoji(name) {
    if (!name) return '';
    return this.miscVehicleMap?.[name] || '';
  }

  // Helper method to identify common column header names that should not be treated as workers
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

    // Check exact matches and contains matches
    return headerPatterns.some(
      (pattern) =>
        normalizedText === pattern ||
        normalizedText.includes(pattern) ||
        // Also check if the text looks like a column header pattern (starts with common prefixes)
        normalizedText.startsWith("worker") ||
        normalizedText.startsWith("volunteer") ||
        normalizedText.startsWith("food"),
    );
  }

  getWorkerAssignments(workerName) {
    // Get SPFM assignments
    const spfmAssignments = this.data.filter((route) => {
      const routeWorkers = this.getAllWorkersFromRoute(route);
      return routeWorkers.some((worker) =>
        flexibleTextMatch(worker, workerName),
      );
    });

    // Get recovery assignments
    const recoveryAssignments = this.recoveryData.filter((route) => {
      const routeWorkers = this.getAllWorkersFromRoute(route);
      return routeWorkers.some((worker) =>
        flexibleTextMatch(worker, workerName),
      );
    });

    // Get SPFM Delivery assignments
    const deliveryAssignments = this.deliveryData.filter((route) => {
      const routeWorkers = this.getAllWorkersFromRoute(route);
      return routeWorkers.some((worker) =>
        flexibleTextMatch(worker, workerName),
      );
    });

    console.debug(`🔍 Debug getWorkerAssignments for ${workerName}:`);
    console.debug("🔍 Recovery data:", this.recoveryData);
    console.debug("🔍 SPFM assignments found:", spfmAssignments.length);
    console.debug("🔍 Recovery assignments found:", recoveryAssignments.length);
    console.debug("🔍 Recovery assignments:", recoveryAssignments);
    console.debug("🔍 Delivery assignments found:", deliveryAssignments.length);
    console.debug("🔍 Delivery assignments:", deliveryAssignments);

    return {
      spfm: spfmAssignments,
      recovery: recoveryAssignments,
      delivery: deliveryAssignments,
    };
  }

  getRoutesByDate(date) {
    return this.data.filter((route) => route.date === date);
  }

  getAllDates() {
    const dates = new Set();
    this.data.forEach((route) => {
      if (route.date) {
        dates.add(route.date);
      }
    });
    return Array.from(dates).sort();
  }

  // ========================================
  // CHARTS SHEET MANAGEMENT
  // ========================================

  async listSheetsInSpreadsheet() {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?key=${API_KEY}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.sheets.map((sheet) => ({ title: sheet.properties.title }));
    } catch (error) {
      console.error("❌ Error listing sheets:", error);
      return [];
    }
  }

  async createChartsSheet() {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate?key=${API_KEY}`;

      const requestBody = {
        requests: [
          {
            addSheet: {
              properties: {
                title: "Charts",
              },
            },
          },
        ],
      };

      const token = window.gapi.client.getToken();
      if (!token) {
        throw new Error("No auth token available");
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.info("✅ Charts sheet created successfully");
      return true;
    } catch (error) {
      console.error("❌ Error creating Charts sheet:", error);
      throw error;
    }
  }

  async appendToChartsSheet(rowData) {
    try {
      const range = "Charts!A:D";
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED&key=${API_KEY}`;

      const requestBody = {
        values: [rowData],
      };

      console.info("📊 Attempting to append to Charts sheet");
      console.debug("📊 URL:", url);
      console.debug("📊 Row data:", rowData);

      const token = window.gapi.client.getToken();
      if (!token) {
        console.warn("❌ No auth token - user may not be signed in");
        return false;
      }

      console.debug("📊 Token exists, making request...");

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      console.debug("📊 Response status:", response.status);
      console.debug("📊 Response ok:", response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.warn("📊 Error response text:", errorText);

        if (response.status === 400) {
          console.info(
            "📊 Charts sheet may not exist yet - please create it manually",
          );
          return false;
        }
        throw new Error(
          `HTTP error! status: ${response.status}, body: ${errorText}`,
        );
      }

      const responseData = await response.json();
      console.debug("📊 Response data:", responseData);
      console.info("✅ Data appended to Charts sheet successfully");
      return true;
    } catch (error) {
      console.error("❌ Error appending to Charts sheet:", error);
      console.error("❌ Full error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      if (error.message.includes("Charts")) {
        console.info(
          "💡 Tip: Create a 'Charts' sheet in your Google Spreadsheet with headers: Date, Route ID, Location, Boxes, Lbs, Timestamp, Submitted By",
        );
      }
      return false;
    }
  }
}

// Export instance
const sheetsAPI = new SheetsAPI();

// Confirm this file loaded
console.debug("✅ sheets.js loaded");
window.sheetsAPILoaded = true;

// Modern bootstrap: expose instance and lightweight loader for DataService
// Legacy app.js previously attached these; in the modernized app we still rely
// on window-level access for cross-module coordination.
if (!window.sheetsAPI) {
  window.sheetsAPI = sheetsAPI;
}

// Provide a minimal TTL-gated loader so DataService can ensure data presence
if (typeof window.loadApiDataIfNeeded !== 'function') {
  const SHEETS_TTL_MS = 120000; // 2 minutes
  window.__lastSheetsFetchTs = window.__lastSheetsFetchTs || 0;
  window.loadApiDataIfNeeded = async function loadApiDataIfNeeded() {
    try {
      const now = Date.now();
      const stale = now - (window.__lastSheetsFetchTs || 0) > SHEETS_TTL_MS;
      const needInitial = !Array.isArray(window.sheetsAPI?.data) || window.sheetsAPI.data.length === 0;
      if (!needInitial && !stale) return;
      await window.sheetsAPI.fetchSheetData();
      window.__lastSheetsFetchTs = Date.now();
    } catch (e) {
      console.error('Failed to load API data:', e);
      throw e;
    }
  };
}
