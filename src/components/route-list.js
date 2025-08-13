class RouteList extends HTMLElement {
  constructor() {
    super();
    
    // Try-catch around shadow DOM creation to catch compatibility issues
    try {
      this.attachShadow({ mode: 'open' });
    } catch (e) {
      console.error('Shadow DOM not supported:', e);
      // Fallback: use the element itself
      this.shadowRoot = this;
    }
    
    // initialize internal properties
    this._routes = [];
    this._groupBy = null;
    this._title = '';
    this._emptyMessage = 'No routes found';
    this._variant = 'default';
    this._filterBy = null;
    this._filterValue = null;
    this._clickable = false;
  }

  static get observedAttributes() {
    return ['routes', 'group-by', 'title', 'empty-message', 'variant', 'filter-by', 'filter-value', 'clickable'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      if (name === 'routes') {
        // parse routes attribute as JSON
        try {
          this._routes = JSON.parse(newValue || '[]');
        } catch (e) {
          console.error('Failed to parse routes:', e, newValue);
          this._routes = [];
        }
      } else if (name === 'group-by') {
        this._groupBy = newValue;
      } else if (name === 'title') {
        this._title = newValue || '';
      } else if (name === 'empty-message') {
        this._emptyMessage = newValue || 'No routes found';
      } else if (name === 'variant') {
        this._variant = newValue || 'default';
      } else if (name === 'filter-by') {
        this._filterBy = newValue || null;
      } else if (name === 'filter-value') {
        this._filterValue = newValue || null;
      } else if (name === 'clickable') {
        this._clickable = (newValue === 'true');
      }
      this.render();
    }
  }

  // ----- property getters/setters for reactive API -----
  get routes() {
    return this._routes;
  }
  set routes(val) {
    this._routes = Array.isArray(val) ? val : [];
    this.render();
  }

  get groupBy() {
    return this._groupBy;
  }
  set groupBy(val) {
    this._groupBy = val;
    this.render();
  }

  get title() {
    return this._title;
  }
  set title(val) {
    this._title = val || '';
    this.render();
  }

  get emptyMessage() {
    return this._emptyMessage;
  }
  set emptyMessage(val) {
    this._emptyMessage = val || 'No routes found';
    this.render();
  }

  get variant() {
    return this._variant;
  }
  set variant(val) {
    this._variant = val || 'default';
    this.render();
  }

  get filterBy() {
    return this._filterBy;
  }
  set filterBy(val) {
    this._filterBy = val || null;
    if (val) this.setAttribute('filter-by', val); else this.removeAttribute('filter-by');
    this.render();
  }

  get filterValue() {
    return this._filterValue;
  }
  set filterValue(val) {
    this._filterValue = val ?? null;
    if (val !== null && val !== undefined) this.setAttribute('filter-value', String(val)); else this.removeAttribute('filter-value');
    this.render();
  }

  get clickable() {
    return this._clickable;
  }
  set clickable(val) {
    this._clickable = Boolean(val);
    this.setAttribute('clickable', this._clickable ? 'true' : 'false');
    this.render();
  }

  connectedCallback() {
    // Initialize defaults if not set
    if (!this.routes) {
      // Add some hardcoded sample data for testing
      this.routes = [
        { worker: 'Test Worker', market: 'Test Market', date: '2024-01-15' },
        { worker: 'Sample User', market: 'Sample Market', date: '2024-01-16' }
      ];
    }
    if (!this.title) this.title = 'Sample Routes';
    if (!this.emptyMessage) this.emptyMessage = 'No routes found';
    this.render();
  }

  setRoutes(routes) {
    this.routes = routes || [];
    this.render();
  }

  setGroupBy(field) {
    this.groupBy = field;
    this.render();
  }

  setTitle(title) {
    this.title = title;
    this.render();
  }

  setFilter(by, value) {
    this.filterBy = by;
    this.filterValue = value;
  }

  // Apply simple equality filters (supports array values like workers: [])
  getFilteredRoutes() {
    let base = this.routes || [];
    if (!this._filterBy || this._filterValue === null || this._filterValue === undefined) {
      return this._sortRoutes(base);
    }
    const key = this._filterBy;
    const wanted = this._filterValue;
    const filtered = base.filter(route => {
      const val = route ? route[key] : undefined;
      if (Array.isArray(val)) {
        return val.some(v => String(v).toLowerCase() === String(wanted).toLowerCase());
      }
      return String(val).toLowerCase() === String(wanted).toLowerCase();
    });
    return this._sortRoutes(filtered);
  }

  groupRoutes() {
    if (!this.groupBy || !this.routes.length) {
      return { 'All Routes': this._sortRoutes(this.routes) };
    }

    const grouped = {};
    this.routes.forEach(route => {
      const val = route[this.groupBy];
      if (Array.isArray(val)) {
        // group under each value (e.g., each worker)
        if (val.length === 0) {
          const key = 'Unknown';
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(route);
        } else {
          const filterActive = this._filterBy && this._filterValue && (this._filterBy === this._groupBy);
          val.forEach(v => {
            const key = String(v || 'Unknown');
            if (filterActive) {
              if (String(v).toLowerCase() !== String(this._filterValue).toLowerCase()) return;
            }
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(route);
          });
        }
      } else {
        const key = val || 'Unknown';
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(route);
      }
    });

    return grouped;
  }

  render() {
    try {
      const variant = this.getAttribute('variant') || this._variant || 'default';
      const filteredRoutes = this.getFilteredRoutes();
      const hasRoutes = filteredRoutes.length > 0;

      // Group after filtering
      const originalRoutes = this._routes;
      this._routes = filteredRoutes;
      const grouped = this.groupRoutes();
      this._routes = originalRoutes;

      if (!this.shadowRoot) {
        console.error('No shadowRoot available');
        return;
      }

      this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: var(--body-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
        }
        .route-list {
          background: white;
          border-radius: 8px;
          overflow: hidden;
        }
        .list-header {
          background: #f8f9fa;
          padding: 16px;
          border-bottom: 1px solid #ddd;
          text-align: center;
        }
        .list-title {
          margin: 0;
          color: #333;
          font-size: 1.2rem;
          font-weight: 600;
        }
        .group-section {
          margin-bottom: 24px;
        }
        .group-header {
          background: #e9ecef;
          padding: 12px 16px;
          font-weight: 600;
          color: #495057;
          border-bottom: 1px solid #ddd;
        }
        .routes-container {
          padding: 8px;
        }
        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: #666;
        }
        .empty-icon {
          font-size: 3rem;
          margin-bottom: 16px;
          opacity: 0.5;
        }
        .compact .routes-container {
          padding: 4px;
        }
        .minimal {
          background: transparent;
        }
        .minimal .list-header {
          background: transparent;
          border-bottom: none;
          padding: 8px 0;
        }
      </style>

      <div class="route-list ${variant}">
        <div class="list-header">
          <h3 class="list-title">${this.title || 'Routes'}</h3>
        </div>
        <div class="list-content">
          <!-- Content will be inserted via DOM manipulation -->
        </div>
      </div>
    `;

    // Insert route content using DOM manipulation
    const listContent = this.shadowRoot.querySelector('.list-content');
    if (!listContent) return;
    
    // Clear existing content
    listContent.innerHTML = '';
    
    if (hasRoutes) {
      const groupKeys = Object.keys(grouped);
      for (let i = 0; i < groupKeys.length; i++) {
        const groupKey = groupKeys[i];
        const routes = grouped[groupKey];
        
        // Create group container
        const groupDiv = document.createElement('div');
        groupDiv.className = 'group-section';
        
        // Add group header if needed
        if (this.groupBy && groupKeys.length > 1) {
          const headerDiv = document.createElement('div');
          headerDiv.className = 'group-header';
          headerDiv.textContent = groupKey;
          groupDiv.appendChild(headerDiv);
        }
        
        // Create routes container
        const routesContainer = document.createElement('div');
        routesContainer.className = 'routes-container';
        
        // Add routes via route-card composition
        for (let j = 0; j < routes.length; j++) {
          const route = routes[j];
          const card = document.createElement('route-card');
          if (typeof card.setRoute === 'function') {
            card.setRoute(route);
          } else {
            card.setAttribute('route-data', JSON.stringify(route));
          }
          card.setAttribute('variant', variant);
          card.setAttribute('clickable', this._clickable ? 'true' : 'false');
          routesContainer.appendChild(card);
        }
        
        groupDiv.appendChild(routesContainer);
        listContent.appendChild(groupDiv);
      }
    } else {
      // Empty state
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-state';
      emptyDiv.innerHTML = '<div class="empty-icon">📅</div><p>' + this.emptyMessage + '</p>';
      listContent.appendChild(emptyDiv);
    }
    // Notify listeners that the list has finished rendering
    try {
      const total = hasRoutes ? Object.values(grouped).reduce((n, arr) => n + (arr?.length||0), 0) : 0;
      console.info('[RouteList] routes-rendered groups=', hasRoutes ? Object.keys(grouped).length : 0, 'total=', total);
      this.dispatchEvent(new CustomEvent('routes-rendered', { bubbles: true, composed: true }));
    } catch {}
    
    } catch (error) {
      console.error('Error in render:', error);
      if (this.shadowRoot) {
        this.shadowRoot.innerHTML = '<div>Error rendering: ' + error.message + '</div>';
      }
    }
  }

  // Always sort by date ascending (interleave types)
  _sortRoutes(routes) {
    try {
      const copy = [...(routes || [])];
      copy.sort((a, b) => {
        const da = (a && a.sortDate instanceof Date) ? a.sortDate : new Date(a?.date || a?.Date || 0);
        const db = (b && b.sortDate instanceof Date) ? b.sortDate : new Date(b?.date || b?.Date || 0);
        if (isNaN(da) && isNaN(db)) return 0;
        if (isNaN(da)) return 1;
        if (isNaN(db)) return -1;
        return da - db;
      });
      return copy;
    } catch {
      return routes || [];
    }
  }
}

// Define the custom element if not already registered (avoids duplicate registration errors in hot-reload)
if (!customElements.get('route-list')) {
  customElements.define('route-list', RouteList);
}
