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
    if (window.inventoryManager && typeof window.inventoryManager.tryUploadInventoryToSheets === 'function') {
      try {
        await window.inventoryManager.tryUploadInventoryToSheets(newInventory);
      } catch (error) {
        console.error('Error syncing to sheets:', error);
      }
    }

    // Emit update event
    this.dispatchEvent(new CustomEvent('inventory-updated', {
      detail: { ...newInventory }
    }));

    return { ...newInventory };
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