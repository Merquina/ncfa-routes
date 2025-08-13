class RouteTabs extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.routes = [];
    this.workers = [];
    this.activeTab = 'by-workers';
  }

  static get observedAttributes() {
    return ['active-tab'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'active-tab' && oldValue !== newValue) {
      this.activeTab = newValue || 'by-workers';
      this.updateTabContent();
    }
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
    
    // Dispatch ready event
    this.dispatchEvent(new CustomEvent('component-ready', {
      bubbles: true
    }));
  }

  setRoutes(routes) {
    this.routes = routes || [];
    this.updateTabContent();
  }

  setWorkers(workers) {
    this.workers = workers || [];
    this.updateTabContent();
  }

  setupEventListeners() {
    this.shadowRoot.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-button')) {
        const tabId = e.target.dataset.tab;
        this.switchTab(tabId);
      }
    });
  }

  switchTab(tabId) {
    this.activeTab = tabId;
    this.setAttribute('active-tab', tabId);
    
    // Update tab buttons
    this.shadowRoot.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    
    this.updateTabContent();
  }

  getNext7Routes() {
    const today = new Date();
    const next7Days = new Date(today);
    next7Days.setDate(today.getDate() + 7);
    
    return this.routes
      .filter(route => {
        const routeDate = new Date(route.date);
        return routeDate >= today && routeDate <= next7Days;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 7);
  }

  getRoutesByWorker() {
    const routesByWorker = {};
    
    // Initialize with all workers
    this.workers.forEach(worker => {
      routesByWorker[worker] = [];
    });
    
    // Group routes by worker
    this.routes.forEach(route => {
      const workers = route.workers || [];
      workers.forEach(worker => {
        if (!routesByWorker[worker]) {
          routesByWorker[worker] = [];
        }
        routesByWorker[worker].push(route);
      });
    });
    
    return routesByWorker;
  }

  formatRouteDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }

  renderRouteItem(route) {
    const routeDate = this.formatRouteDate(route.date);
    const market = route.market || 'Unknown Market';
    const time = route.startTime || route.Time || 'TBD';
    
    return `
      <li class="route-item" data-route-id="${route._routeId || ''}">
        <div class="route-header">
          <span class="route-date">${routeDate}</span>
          <span class="route-time">${time}</span>
        </div>
        <div class="route-details">
          <strong>${market}</strong>
          ${route.stops && route.stops.length > 0 ? 
            `<span class="route-stops">${route.stops.length} stops</span>` : 
            ''
          }
        </div>
      </li>
    `;
  }

  updateTabContent() {
    const tabContent = this.shadowRoot.querySelector('.tab-content');
    if (!tabContent) return;

    if (this.activeTab === 'by-workers') {
      const routesByWorker = this.getRoutesByWorker();
      
      tabContent.innerHTML = `
        <div class="workers-routes">
          ${Object.keys(routesByWorker).map(worker => `
            <div class="worker-section">
              <h3 class="worker-name">${worker}</h3>
              <ul class="route-list">
                ${routesByWorker[worker].length > 0 ? 
                  routesByWorker[worker].map(route => this.renderRouteItem(route)).join('') :
                  '<li class="empty-state">No upcoming routes</li>'
                }
              </ul>
            </div>
          `).join('')}
        </div>
      `;
    } else if (this.activeTab === 'next-7') {
      const next7Routes = this.getNext7Routes();
      
      tabContent.innerHTML = `
        <div class="upcoming-routes">
          <ul class="route-list">
            ${next7Routes.length > 0 ? 
              next7Routes.map(route => this.renderRouteItem(route)).join('') :
              '<li class="empty-state">No upcoming routes in the next 7 days</li>'
            }
          </ul>
        </div>
      `;
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: var(--body-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .tab-header {
          display: flex;
          background: #f8f9fa;
          border-bottom: 1px solid #ddd;
        }

        .tab-button {
          flex: 1;
          padding: 12px 20px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 0.9rem;
          font-weight: 500;
          color: #666;
          transition: all 0.2s ease;
          border-bottom: 3px solid transparent;
        }

        .tab-button:hover {
          background: #e9ecef;
          color: #333;
        }

        .tab-button.active {
          color: #007bff;
          border-bottom-color: #007bff;
          background: white;
        }

        .tab-content {
          padding: 20px;
          max-height: 500px;
          overflow-y: auto;
        }

        .worker-section {
          margin-bottom: 30px;
        }

        .worker-name {
          margin: 0 0 10px 0;
          color: #333;
          font-size: 1.1rem;
          font-weight: 600;
          padding-bottom: 5px;
          border-bottom: 2px solid #e9ecef;
        }

        .route-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .route-item {
          padding: 12px;
          border: 1px solid #e9ecef;
          border-radius: 6px;
          margin-bottom: 8px;
          background: #fafafa;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .route-item:hover {
          background: #f0f8ff;
          border-color: #007bff;
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0,123,255,0.1);
        }

        .route-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }

        .route-date {
          font-weight: 600;
          color: #007bff;
          font-size: 0.9rem;
        }

        .route-time {
          font-size: 0.8rem;
          color: #666;
          background: #e9ecef;
          padding: 2px 6px;
          border-radius: 3px;
        }

        .route-details {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.9rem;
        }

        .route-stops {
          font-size: 0.8rem;
          color: #666;
          background: #e9ecef;
          padding: 2px 6px;
          border-radius: 3px;
        }

        .empty-state {
          padding: 20px;
          text-align: center;
          color: #666;
          font-style: italic;
          background: #f8f9fa;
          border: 1px dashed #ddd;
          border-radius: 6px;
        }

        .upcoming-routes .route-list {
          max-width: 500px;
          margin: 0 auto;
        }

        @media (max-width: 600px) {
          .tab-button {
            padding: 10px 16px;
            font-size: 0.8rem;
          }
          
          .tab-content {
            padding: 15px;
          }
          
          .route-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }
          
          .route-details {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }
        }
      </style>

      <div class="tab-header">
        <button class="tab-button ${this.activeTab === 'by-workers' ? 'active' : ''}" data-tab="by-workers">
          👥 By Workers
        </button>
        <button class="tab-button ${this.activeTab === 'next-7' ? 'active' : ''}" data-tab="next-7">
          📅 Next 7 Days
        </button>
      </div>

      <div class="tab-content">
        <!-- Content will be loaded here -->
      </div>
    `;

    this.updateTabContent();
  }
}

customElements.define('route-tabs', RouteTabs);