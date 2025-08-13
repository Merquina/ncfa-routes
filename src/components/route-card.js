class RouteCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.assignmentData = null;
    this.routeId = null;
  }

  static get observedAttributes() {
    return ['assignment-data', 'route-id'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      if (name === 'assignment-data') {
        try {
          this.assignmentData = JSON.parse(newValue || 'null');
        } catch (e) {
          this.assignmentData = null;
        }
      } else if (name === 'route-id') {
        this.routeId = newValue;
      }
      this.render();
    }
  }

  connectedCallback() {
    this.render();
  }

  setRoute(assignment, routeId = null) {
    this.assignmentData = assignment;
    this.routeId = routeId;
    this.setAttribute('assignment-data', JSON.stringify(assignment));
    if (routeId) {
      this.setAttribute('route-id', routeId);
    }
  }

  getWorkerEmoji(workerName) {
    const icons = {
      Samuel: "🐋", Emmanuel: "🦁", Irmydel: "🐸", Tess: "🌟",
      Ayoyo: "⚡", Rosey: "🌹", Boniat: "🌊", Volunteer: "👤"
    };
    return icons[workerName] || "👤";
  }

  getVanEmoji(vanName) {
    // Simple van emoji mapping
    return "🚐";
  }

  formatWorkerList(workers, volunteers, maxDisplay = 3) {
    const allWorkers = [...(workers || []), ...(volunteers || [])]
      .filter(person => person && person.trim())
      .map(person => `${this.getWorkerEmoji(person)} ${person}`);
    
    if (allWorkers.length === 0) {
      return '<span style="color: #800020; font-style: italic;">No workers assigned</span>';
    }
    
    if (allWorkers.length <= maxDisplay) {
      return allWorkers.join(", ");
    }
    
    return allWorkers.slice(0, maxDisplay).join(", ") + ` +${allWorkers.length - maxDisplay} more`;
  }

  handleCardClick() {
    this.dispatchEvent(new CustomEvent('route-selected', {
      detail: { route: this.assignmentData, routeId: this.routeId },
      bubbles: true,
      composed: true
    }));
  }

  render() {
    if (!this.assignmentData) {
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
            font-family: var(--body-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
          }
        </style>
        <div>No assignment data</div>
      `;
      return;
    }

    const route = this.assignmentData;
    
    // Determine route type and styling
    const isRecovery = route.type === "recovery";
    const isSPFMDelivery = route.type === "spfm-delivery" || route.type === "spfm";
    
    // Set border color and icon based on route type
    let borderColor = "#ff8c00"; // Default SPFM orange
    let routeIcon = "👨‍🌾";
    let routeLabel = "SPFM Route";
    let routeColor = "#ff8c00";
    
    if (isRecovery) {
      borderColor = "#007bff";
      routeIcon = "🛒";
      routeLabel = "Recovery Route";
      routeColor = "#007bff";
    } else if (isSPFMDelivery) {
      borderColor = "#28a745";
      routeIcon = "🚚";
      routeLabel = "SPFM Delivery";
      routeColor = "#28a745";
    }

    // Get workers, volunteers, and vans
    const workers = route.workers || [];
    const volunteers = route.volunteers || [];
    const vans = route.vans || [];

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: var(--body-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
        }
        .assignment-card {
          background: white;
          padding: 12px;
          margin: 0 0 8px 0;
          border-radius: 6px;
          border-left: 4px solid ${borderColor};
          cursor: pointer;
          transition: transform 0.1s;
        }
        .assignment-card:hover {
          transform: scale(1.02);
        }
        .card-title {
          font-weight: bold;
          color: #333;
          margin-bottom: 4px;
          font-size: 1rem;
        }
        .card-time {
          font-size: 0.9rem;
          color: #666;
          margin-bottom: 4px;
        }
        .card-type {
          font-size: 0.85rem;
          color: ${routeColor};
          margin-bottom: 4px;
        }
        .card-workers {
          font-size: 0.9rem;
          color: #666;
          margin-bottom: 4px;
        }
        .card-vans {
          font-size: 0.9rem;
          color: #666;
        }
        .no-assignment {
          color: #800020;
          font-style: italic;
        }
      </style>

      <div class="assignment-card">
        <div class="card-title">
          ${route.displayDate || route.date} - ${route.market || "Market"}
        </div>
        <div class="card-time">
          ${route.startTime || route.Time || "TBD"}
        </div>
        <div class="card-type">
          ${routeIcon} ${routeLabel}
        </div>
        <div class="card-workers">
          ${this.formatWorkerList(workers, volunteers, isRecovery ? 1 : 3)}
        </div>
        <div class="card-vans">
          ${vans.length > 0 
            ? vans.map(v => `${this.getVanEmoji(v)} ${v}`).join(", ")
            : '<span class="no-assignment">No vans assigned</span>'
          }
        </div>
      </div>
    `;

    // Add click handler
    this.shadowRoot.querySelector('.assignment-card').addEventListener('click', () => {
      this.handleCardClick();
    });
  }
}

// Replace incorrect/legacy route-card with this implementation
if (customElements.get('route-card')) {
  // no-op: already defined, but we want to redefine only if not present
} else {
  customElements.define('route-card', RouteCard);
}
