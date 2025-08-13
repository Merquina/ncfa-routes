class RouteCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.routeData = null;
  }

  static get observedAttributes() {
    return ['route-data', 'variant', 'clickable'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      if (name === 'route-data') {
        try {
          this.routeData = JSON.parse(newValue || 'null');
        } catch (e) {
          this.routeData = null;
        }
      }
      this.render();
    }
  }

  connectedCallback() {
    this.render();
  }

  setRoute(routeData) {
    this.routeData = routeData;
    this.setAttribute('route-data', JSON.stringify(routeData));
  }

  formatDate(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  }

  getWorkerEmoji(workerName) {
    const icons = {
      Samuel: "🐋", Emmanuel: "🦁", Irmydel: "🐸", Tess: "🌟",
      Ayoyo: "⚡", Rosey: "🌹", Boniat: "🌊", Volunteer: "👤"
    };
    return icons[workerName] || "👤";
  }

  handleClick() {
    if (this.getAttribute('clickable') === 'true') {
      this.dispatchEvent(new CustomEvent('route-selected', {
        detail: { route: this.routeData },
        bubbles: true
      }));
    }
  }

  render() {
    if (!this.routeData) {
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
            font-family: var(--body-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
          }
        </style>
        <div>No route data</div>
      `;
      return;
    }

    const variant = this.getAttribute('variant') || 'default';
    const clickable = this.getAttribute('clickable') === 'true';
    const route = this.routeData;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: var(--body-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
        }
        .route-card {
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          margin: 8px 0;
          overflow: hidden;
          transition: all 0.2s ease;
          ${clickable ? 'cursor: pointer;' : ''}
        }
        .route-card:hover {
          ${clickable ? 'border-color: #007bff; box-shadow: 0 2px 8px rgba(0,123,255,0.15);' : ''}
        }
        .card-header {
          background: #f8f9fa;
          padding: 12px 16px;
          border-bottom: 1px solid #ddd;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .worker-info {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 600;
          color: #333;
        }
        .route-date {
          font-size: 0.9rem;
          color: #666;
        }
        .card-body {
          padding: 12px 16px;
        }
        .route-details {
          display: grid;
          gap: 8px;
          font-size: 0.9rem;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .detail-label {
          color: #666;
          font-weight: 500;
        }
        .detail-value {
          color: #333;
          text-align: right;
        }
        .stops-preview {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid #eee;
          font-size: 0.85rem;
          color: #666;
        }
        .compact {
          margin: 4px 0;
        }
        .compact .card-header {
          padding: 8px 12px;
        }
        .compact .card-body {
          padding: 8px 12px;
        }
        .minimal {
          border: none;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .minimal .card-header {
          background: transparent;
          border-bottom: none;
          padding: 8px 12px;
        }
      </style>

      <div class="route-card ${variant === 'compact' ? 'compact' : ''} ${variant === 'minimal' ? 'minimal' : ''}">
        <div class="card-header">
          <div class="worker-info">
            <span>${this.getWorkerEmoji(route.worker)}</span>
            <span>${route.worker || 'Unknown Worker'}</span>
          </div>
          <div class="route-date">${this.formatDate(route.date)}</div>
        </div>
        
        <div class="card-body">
          <div class="route-details">
            ${route.market ? `
              <div class="detail-row">
                <span class="detail-label">Market:</span>
                <span class="detail-value">${route.market}</span>
              </div>
            ` : ''}
            
            ${route.route ? `
              <div class="detail-row">
                <span class="detail-label">Route:</span>
                <span class="detail-value">${route.route}</span>
              </div>
            ` : ''}
            
            ${route.vehicle ? `
              <div class="detail-row">
                <span class="detail-label">Vehicle:</span>
                <span class="detail-value">${route.vehicle}</span>
              </div>
            ` : ''}
          </div>

          ${route.stops && route.stops.length > 0 ? `
            <div class="stops-preview">
              ${route.stops.length} stop${route.stops.length !== 1 ? 's' : ''}: ${route.stops[0]}${route.stops.length > 1 ? ` + ${route.stops.length - 1} more` : ''}
            </div>
          ` : ''}
        </div>
      </div>
    `;

    // Add click handler if clickable
    if (clickable) {
      this.shadowRoot.querySelector('.route-card').addEventListener('click', () => {
        this.handleClick();
      });
    }
  }
}

// Define the custom element if not already registered (avoids duplicate registration errors in hot-reload)
if (!customElements.get('route-card')) {
  customElements.define('route-card', RouteCard);
}
