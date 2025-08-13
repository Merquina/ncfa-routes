// Lightweight IndexedDB wrapper for SPFM data
// Stores raw tables, precomputed caches, and metadata.

const DB_NAME = 'spfm_routes_db';
const DB_VERSION = 1;

class LocalStore {
  constructor() {
    this.db = null;
    this.initializing = null;
  }

  async init() {
    if (this.db) return this.db;
    if (this.initializing) return this.initializing;
    this.initializing = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        // name keyPath for both tables and caches
        if (!db.objectStoreNames.contains('tables')) {
          db.createObjectStore('tables', { keyPath: 'name' });
        }
        if (!db.objectStoreNames.contains('caches')) {
          db.createObjectStore('caches', { keyPath: 'name' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      };
      req.onsuccess = () => {
        this.db = req.result;
        resolve(this.db);
      };
      req.onerror = () => reject(req.error);
    });
    return this.initializing;
  }

  async _tx(store, mode = 'readonly') {
    const db = await this.init();
    return db.transaction(store, mode).objectStore(store);
  }

  async putTable(name, rows, extra = {}) {
    try {
      const os = await this._tx('tables', 'readwrite');
      const now = Date.now();
      return await new Promise((resolve, reject) => {
        const req = os.put({ name, rows, updatedAt: now, ...extra });
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch { return false; }
  }

  async getTable(name) {
    try {
      const os = await this._tx('tables');
      return await new Promise((resolve, reject) => {
        const req = os.get(name);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch { return null; }
  }

  async putCache(name, data) {
    try {
      const os = await this._tx('caches', 'readwrite');
      const now = Date.now();
      return await new Promise((resolve, reject) => {
        const req = os.put({ name, data, updatedAt: now });
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch { return false; }
  }

  async getCache(name) {
    try {
      const os = await this._tx('caches');
      return await new Promise((resolve, reject) => {
        const req = os.get(name);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } catch { return null; }
  }

  async setMeta(key, value) {
    try {
      const os = await this._tx('meta', 'readwrite');
      return await new Promise((resolve, reject) => {
        const req = os.put({ key, value });
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch { return false; }
  }

  async getMeta(key) {
    try {
      const os = await this._tx('meta');
      return await new Promise((resolve, reject) => {
        const req = os.get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = () => reject(req.error);
      });
    } catch { return null; }
  }

  async clearAll() {
    try {
      const db = await this.init();
      await Promise.all(['tables','caches','meta'].map((store) => new Promise((resolve, reject) => {
        const req = db.transaction(store, 'readwrite').objectStore(store).clear();
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      })));
      return true;
    } catch { return false; }
  }
}

const localStore = new LocalStore();
export default localStore;

