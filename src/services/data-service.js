/**
 * Data Service - Abstracts all external data sources (Google Sheets, localStorage, etc.)
 * Provides clean APIs for components without exposing implementation details
 */
class DataService extends EventTarget {
  constructor() {
    super();
    this.inventory = {
      smallBoxes: 0,
      largeBoxes: 0,
      lastUpdated: null,
      updatedBy: null
    };
    this.workers = [];
    this.routes = [];
    this.isLoading = false;
  }

  // ========================================
  // INVENTORY METHODS
  // ========================================
  
  async getInventory() {
    // Try to load from localStorage first (fast)
    try {
      const stored = localStorage.getItem('spfm_inventory');
      if (stored) {
        this.inventory = { ...this.inventory, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Error loading inventory from localStorage:', error);
    }

    // Try to sync with Google Sheets (slower)
    if (window.inventoryManager && typeof window.inventoryManager.loadInventoryFromSheets === 'function') {
      try {
        await window.inventoryManager.loadInventoryFromSheets();
        const freshInventory = window.inventoryManager.getLocalInventory();
        if (freshInventory) {
          this.inventory = { ...this.inventory, ...freshInventory };
        }
      } catch (error) {
        console.error('Error syncing inventory with sheets:', error);
      }
    }

    return { ...this.inventory };
  }

  async updateInventory(smallBoxes, largeBoxes, updatedBy) {
    const newInventory = {
      smallBoxes: parseInt(smallBoxes) || 0,
      largeBoxes: parseInt(largeBoxes) || 0,
      lastUpdated: new Date().toLocaleString(),
      updatedBy: updatedBy || 'Anonymous'
    };

    // Update local state
    this.inventory = newInventory;

    // Save to localStorage
    try {
      localStorage.setItem('spfm_inventory', JSON.stringify(newInventory));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }

    // Sync to Google Sheets
    let synced = false;
    if (window.inventoryManager && typeof window.inventoryManager.tryUploadInventoryToSheets === 'function') {
      try {
        await window.inventoryManager.tryUploadInventoryToSheets(newInventory);
        synced = true;
      } catch (error) {
        console.error('Error syncing to sheets:', error);
      }
    }

    // Emit update event
    this.dispatchEvent(new CustomEvent('inventory-updated', {
      detail: { ...newInventory, synced }
    }));

    // Return sync status to callers so UI can confirm
    return { ...newInventory, synced };
  }

  // ========================================
  // WORKERS METHODS
  // ========================================

  async getWorkers() {
    // Load API data if needed
    if (window.sheetsAPI && typeof window.loadApiDataIfNeeded === 'function') {
      try {
        await window.loadApiDataIfNeeded();
        this.workers = window.sheetsAPI.getAllWorkers() || [];
      } catch (error) {
        console.error('Error loading workers:', error);
        this.workers = [];
      }
    }

    return [...this.workers];
  }

  async getWorkerAssignments(workerName) {
    if (!workerName) return [];

    // Ensure API data is loaded
    if (window.sheetsAPI && typeof window.loadApiDataIfNeeded === 'function') {
      try {
        await window.loadApiDataIfNeeded();
        return window.sheetsAPI.getWorkerAssignments(workerName) || [];
      } catch (error) {
        console.error('Error loading worker assignments:', error);
        return [];
      }
    }

    return [];
  }

  // ========================================
  // ROUTES METHODS
  // ========================================

  /**
   * Return a normalized list of all routes from SPFM, Recovery, and Delivery sources.
   * Does not touch DOM; pulls from sheetsAPI via the existing loadApiDataIfNeeded gate.
   */
  async getRoutes() {
    // Ensure API data is loaded
    if (window.loadApiDataIfNeeded) {
      await window.loadApiDataIfNeeded();
    }

    const routes = [];

    // SPFM routes
    if (window.sheetsAPI && Array.isArray(window.sheetsAPI.data)) {
      console.log('[DataService] SPFM data count:', window.sheetsAPI.data.length);
      window.sheetsAPI.data.forEach((r) => routes.push(this._normalizeRoute(r, 'spfm')));
    }

    // Recovery routes (skip if consolidated Routes is available to avoid duplicates)
    if (window.sheetsAPI && (!Array.isArray(window.sheetsAPI.routesData) || window.sheetsAPI.routesData.length === 0) && Array.isArray(window.sheetsAPI.recoveryData)) {
      console.log('[DataService] Recovery data count:', window.sheetsAPI.recoveryData.length);
      window.sheetsAPI.recoveryData.forEach((r) => routes.push(this._normalizeRoute(r, 'recovery')));
    }

    // SPFM Delivery routes (if present)
    if (window.sheetsAPI && (!Array.isArray(window.sheetsAPI.routesData) || window.sheetsAPI.routesData.length === 0) && Array.isArray(window.sheetsAPI.deliveryData)) {
      console.log('[DataService] Delivery data count:', window.sheetsAPI.deliveryData.length);
      window.sheetsAPI.deliveryData.forEach((r) => routes.push(this._normalizeRoute(r, 'spfm-delivery')));
    }

    // Consolidated Routes sheet (if present)
    if (window.sheetsAPI && Array.isArray(window.sheetsAPI.routesData) && window.sheetsAPI.routesData.length > 0) {
      console.log('[DataService] Routes sheet count:', window.sheetsAPI.routesData.length);
      window.sheetsAPI.routesData.forEach((r) => {
        // Map routeType to our normalized types
        const rt = (r.routeType || r.RouteType || r.type || '').toString();
        let fType = 'spfm';
        if (/recovery/i.test(rt)) fType = 'recovery';
        else if (/delivery/i.test(rt)) fType = 'spfm-delivery';
        routes.push(this._normalizeRoute(r, fType));
      });
    }

    console.log('[DataService] Normalized routes:', routes.length);
    this.routes = routes;
    return [...routes];
  }

  // Alias used by some controllers
  async getAllRoutes() {
    return this.getRoutes();
  }

  /**
   * Derive workers assigned to a route using the canonical sheets API helper.
   */
  getWorkersFromRoute(route) {
    if (!route || !window.sheetsAPI || typeof window.sheetsAPI.getAllWorkersFromRoute !== 'function') {
      return [];
    }
    try {
      return window.sheetsAPI.getAllWorkersFromRoute(route) || [];
    } catch (e) {
      console.error('getWorkersFromRoute failed:', e);
      return [];
    }
  }

  /**
   * Volunteers from a route (if any)
   */
  getVolunteersFromRoute(route) {
    if (!route || !window.sheetsAPI || typeof window.sheetsAPI.getAllVolunteers !== 'function') {
      return [];
    }
    try {
      return window.sheetsAPI.getAllVolunteers(route) || [];
    } catch (e) {
      console.error('getVolunteersFromRoute failed:', e);
      return [];
    }
  }

  /**
   * Vans from a route (if any)
   */
  getVansFromRoute(route) {
    if (!route || !window.sheetsAPI || typeof window.sheetsAPI.getAllVans !== 'function') {
      return [];
    }
    try {
      return window.sheetsAPI.getAllVans(route) || [];
    } catch (e) {
      console.error('getVansFromRoute failed:', e);
      return [];
    }
  }

  // ========================================
  // NORMALIZATION HELPERS
  // ========================================

  _normalizeRoute(raw, fallbackType = 'spfm') {
    const rawType = raw.type || raw.routeType || fallbackType || 'spfm';
    let type = rawType;
    try {
      const t = (rawType || '').toString();
      if (/recovery/i.test(t)) type = 'recovery';
      else if (/delivery/i.test(t)) type = 'spfm-delivery';
      else type = 'spfm';
    } catch {}
    const dateVal = raw.date || raw.Date || raw.DATE || raw.sortDate || raw.parsed || '';
    const dateObj = (dateVal instanceof Date) ? dateVal : new Date(dateVal);
    const dateStr = (dateObj && !isNaN(dateObj)) ? dateObj.toISOString().slice(0,10) : (typeof dateVal === 'string' ? dateVal : '');
    const startTime = raw.startTime || raw.Time || raw.time || '';
    const market = raw.market || raw.Market || raw.location || raw.Location || (type === 'recovery' ? 'Recovery' : '');
    const dropOff = raw.dropOff || raw.dropoff || raw['drop off'] || '';
    const workers = this.getWorkersFromRoute(raw) || [];
    const volunteers = this.getVolunteersFromRoute(raw) || [];
    const vans = this.getVansFromRoute(raw) || [];
    const officeMaterials = (raw.materials_office || '').split(',').map(s=>s.trim()).filter(Boolean);
    const storageMaterials = (raw.materials_storage || '').split(',').map(s=>s.trim()).filter(Boolean);
    const atMarket = (raw.atMarket || '').split(',').map(s=>s.trim()).filter(Boolean);
    const backAtOffice = (raw.backAtOffice || '').split(',').map(s=>s.trim()).filter(Boolean);

    // Build stops list similar to legacy logic
    const stops = this._extractStops(raw, type, market, dropOff);

    // Build display date
    const displayDate = this._formatDisplayDate(dateVal);

    // id
    const id = raw._routeId || [type, dateStr, startTime, market, dropOff].join('|');

    // Contacts for convenience
    const contactFor = (name) => {
      if (!name) return null;
      try { return window.sheetsAPI?.getAddressFromContacts?.(name) || null; } catch { return null; }
    };

    return {
      ...raw,
      id,
      type,
      date: dateStr,
      displayDate,
      sortDate: (dateObj && !isNaN(dateObj)) ? dateObj : null,
      startTime,
      market,
      dropOff,
      workers,
      volunteers,
      vans,
      materials: {
        office: officeMaterials,
        storage: storageMaterials,
        atMarket,
        backAtOffice,
      },
      stops: stops.map((s) => ({
        location: s,
        contact: contactFor(s),
      })),
      contacts: window.sheetsAPI?.getAllRouteContacts?.(raw) || [],
      phones: window.sheetsAPI?.getAllRoutePhones?.(raw) || [],
    };
  }

  _extractStops(route, type, market, dropOff) {
    const stops = [];
    if (type === 'recovery' || type === 'spfm-delivery') {
      let i = 1;
      for (;;) {
        const s = route[`stop${i}`] || route[`Stop ${i}`] || route[`stop ${i}`];
        if (!s || !String(s).trim()) break;
        stops.push(String(s).trim());
        i++;
      }
      if (stops.length === 0) {
        if (market) stops.push(String(market).trim());
        if (dropOff) stops.push(String(dropOff).trim());
      }
    } else {
      if (market) stops.push(String(market).trim());
      if (dropOff) stops.push(String(dropOff).trim());
    }
    return stops;
  }

  _formatDisplayDate(dateVal) {
    try {
      const d = (dateVal instanceof Date) ? dateVal : new Date(dateVal);
      if (isNaN(d)) return String(dateVal || '');
      return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return String(dateVal || '');
    }
  }

  async getUpcomingRoutes(limit = 7) {
    // Load API data if needed
    if (window.sheetsAPI && typeof window.loadApiDataIfNeeded === 'function') {
      try {
        await window.loadApiDataIfNeeded();
        if (window.assignmentsManager && typeof window.assignmentsManager.getUpcomingRoutes === 'function') {
          this.routes = window.assignmentsManager.getUpcomingRoutes(limit) || [];
        }
      } catch (error) {
        console.error('Error loading routes:', error);
        this.routes = [];
      }
    }

    return [...this.routes];
  }

  async getAllDates() {
    if (window.sheetsAPI && typeof window.loadApiDataIfNeeded === 'function') {
      try {
        await window.loadApiDataIfNeeded();
        return window.sheetsAPI.getAllDates() || [];
      } catch (error) {
        console.error('Error loading dates:', error);
        return [];
      }
    }
    return [];
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  async loadApiData() {
    if (this.isLoading) return;
    
    this.isLoading = true;
    this.dispatchEvent(new CustomEvent('loading-started'));

    try {
      if (window.loadApiDataIfNeeded && typeof window.loadApiDataIfNeeded === 'function') {
        await window.loadApiDataIfNeeded();
        this.dispatchEvent(new CustomEvent('data-loaded'));
      }
    } catch (error) {
      console.error('Error loading API data:', error);
      this.dispatchEvent(new CustomEvent('data-error', { detail: error }));
    } finally {
      this.isLoading = false;
      this.dispatchEvent(new CustomEvent('loading-finished'));
    }
  }

  isApiDataLoaded() {
    return window.sheetsAPI && window.sheetsAPI.data && window.sheetsAPI.data.length > 0;
  }

  // ========================================
  // CONFIGURATION
  // ========================================

  getWorkerIcons() {
    try {
      // Build from Misc workers if available
      if (window.sheetsAPI && Array.isArray(window.sheetsAPI.miscWorkers) && window.sheetsAPI.miscWorkers.length > 0) {
        const map = {};
        window.sheetsAPI.miscWorkers.forEach((w) => {
          if (!w || !w.worker) return;
          if (w.emoji) map[w.worker] = w.emoji;
        });
        // Provide default for Volunteer if not specified
        if (!map.Volunteer) map.Volunteer = '👤';
        return map;
      }
    } catch {}
    // Fallback hardcoded defaults
    return {
      Samuel: "🐋",
      Emmanuel: "🦁",
      Irmydel: "🐸", 
      Tess: "🌟",
      Ayoyo: "⚡",
      Rosey: "🌹",
      Boniat: "🌊",
      Volunteer: "👤"
    };
  }

  getBoxConfig() {
    return {
      small: {
        label: 'small',
        description: '5/9 bushel',
        farmersRatio: 2
      },
      large: {
        label: 'LARGE',
        description: '1 1/9 bushel', 
        farmersRatio: 1
      }
    };
  }
}

// Create singleton instance
window.dataService = window.dataService || new DataService();

export { DataService };
export default window.dataService;
