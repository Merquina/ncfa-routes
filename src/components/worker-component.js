class WorkerComponent extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.workers = [];
    this.selectedWorker = null;
    this.workerIcons = {};
    this.defaultIcon = "👤";
    this.isLoading = false;
  }

  static get observedAttributes() {
    return ['workers', 'selected-worker', 'worker-icons', 'default-icon'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      if (name === 'workers') {
        try {
          this.workers = JSON.parse(newValue || '[]');
        } catch (e) {
          this.workers = [];
        }
      } else if (name === 'selected-worker') {
        this.selectedWorker = newValue;
      } else if (name === 'worker-icons') {
        try {
          this.workerIcons = JSON.parse(newValue || '{}');
        } catch (e) {
          this.workerIcons = {};
        }
      } else if (name === 'default-icon') {
        this.defaultIcon = newValue || "👤";
      }
      this.render();
    }
  }

  connectedCallback() {
    this.render();
    this.loadWorkersData();
  }

  // ========================================
  // PUBLIC API METHODS
  // ========================================

  async loadWorkersData() {
    if (this.isLoading) return;
    
    this.isLoading = true;
    this.showLoading();

    try {
      // Use data service to get workers
      if (window.dataService) {
        const workers = await window.dataService.getWorkers();
        const workerIcons = window.dataService.getWorkerIcons();
        
        this.setWorkers(workers);
        this.setWorkerIcons(workerIcons);
        this.setDefaultIcon("👤");
      }
    } catch (error) {
      console.error('Error loading workers:', error);
      this.showError('Failed to load workers data');
    } finally {
      this.isLoading = false;
    }
  }

  setWorkersData(workers, icons = {}, defaultIcon = "👤") {
    this.setWorkers(workers);
    this.setWorkerIcons(icons);
    this.setDefaultIcon(defaultIcon);
  }

  getSelectedWorker() {
    return this.selectedWorker;
  }

  showLoading() {
    this.render();
  }

  showError(message) {
    console.error(message);
    this.render();
  }

  setWorkers(workerList) {
    this.workers = workerList || [];
    this.setAttribute('workers', JSON.stringify(this.workers));
  }

  setWorkerIcons(iconMap) {
    this.workerIcons = iconMap || {};
    this.setAttribute('worker-icons', JSON.stringify(this.workerIcons));
  }

  setDefaultIcon(icon) {
    this.defaultIcon = icon || "👤";
    this.setAttribute('default-icon', this.defaultIcon);
  }

  selectWorker(workerName) {
    this.selectedWorker = workerName;
    this.setAttribute('selected-worker', workerName);
    this.render(); // Re-render to show selection
    
    this.dispatchEvent(new CustomEvent('worker-selected', {
      detail: { worker: workerName },
      bubbles: true
    }));
  }

  getWorkerEmoji(workerName) {
    if (!workerName || workerName.trim() === "") return this.defaultIcon;
    
    const normalizedName = workerName.trim();
    return this.workerIcons[normalizedName] || this.defaultIcon;
  }

  render() {
    if (this.workers.length === 0) {
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
            font-family: var(--body-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
          }
          .empty-state {
            text-align: center;
            padding: 20px;
            color: #666;
            grid-column: 1/-1;
          }
        </style>
        <div class="empty-state">
          <p>No workers found. Make sure your spreadsheet has worker data.</p>
        </div>
      `;
      return;
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: var(--body-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
        }
        .workers-container {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 10px;
          align-items: center;
        }
        .worker-card {
          display: inline-block;
          text-align: center;
          padding: 12px 16px;
          background: #fff;
          border: 2px solid #ddd;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 0.9rem;
          user-select: none;
          min-width: 80px;
        }
        .worker-card:hover {
          background: #f8f9fa;
          border-color: #007bff;
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }
        .worker-card.selected {
          background: #007bff;
          color: white;
          border-color: #0056b3;
          box-shadow: 0 4px 12px rgba(0,123,255,0.3);
        }
        .worker-card.selected:hover {
          background: #0056b3;
        }
        .worker-emoji {
          font-size: 1.5rem;
          display: block;
          margin-bottom: 4px;
        }
        .worker-name {
          font-weight: 500;
          line-height: 1.2;
        }
      </style>

      <div class="workers-container">
        ${this.workers.map(worker => `
          <div class="worker-card ${this.selectedWorker === worker ? 'selected' : ''}" 
               data-worker="${worker}">
            <span class="worker-emoji">${this.getWorkerEmoji(worker)}</span>
            <span class="worker-name">${worker}</span>
          </div>
        `).join('')}
      </div>
    `;

    // Add click event listeners
    this.shadowRoot.querySelectorAll('.worker-card').forEach(card => {
      card.addEventListener('click', (e) => {
        const workerName = e.currentTarget.getAttribute('data-worker');
        this.selectWorker(workerName);
      });
    });
  }
}

customElements.define('worker-component', WorkerComponent);