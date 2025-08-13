class WorkersPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.controller = null;
  }

  connectedCallback() {
    this.render();
    this.setupController();
  }

  async setupController() {
    // Wait for controller to be available
    if (window.WorkersPageController) {
      this.controller = new window.WorkersPageController(this);
      await this.controller.initialize();
    } else {
      // Retry after a short delay if not available yet
      setTimeout(() => this.setupController(), 100);
    }
  }

  showError() {
    const container = this.shadowRoot.querySelector('.workers-container');
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666; background: #f8f9fa; border-radius: 8px;">
          <div style="font-size: 2rem; margin-bottom: 10px;">❌</div>
          <h3>Error Loading Worker Data</h3>
          <p>Unable to load worker information. Please try refreshing the page.</p>
        </div>
      `;
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          padding: 0;
          font-family: var(--body-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
          max-width: 100%;
          overflow-x: hidden;
        }
        
        .page-header {
          text-align: center;
          margin-bottom: 20px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
        }
        
        .page-title {
          margin: 0;
          color: #333;
          font-size: 1.5rem;
          font-weight: 600;
        }
        
        .page-description {
          margin: 8px 0 0 0;
          color: #666;
          font-size: 0.9rem;
        }
        
        .workers-container {
          max-width: 800px;
          margin: 0 auto;
        }
        .filters { display: grid; gap: 14px; margin-bottom: 12px; }
        .toolbar { display:flex; justify-content: space-between; align-items: center; }
        .btn-clear { background:#f0f0f0; border:1px solid #ddd; border-radius: 16px; padding: 6px 10px; cursor:pointer; font-size:0.8rem; }
        
        @media (max-width: 600px) {
          :host {
            padding: 0 5px;
          }
          
          .page-header {
            padding: 15px;
            margin-bottom: 15px;
          }
          
          .page-title {
            font-size: 1.3rem;
          }
        }
      </style>
      
      <div class="workers-container">
        <div class="filters">
          <div class="toolbar">
            <div class="label" style="color:#333; font-weight:600;">Select Worker</div>
          </div>
          <worker-component id="workerPicker"></worker-component>

          <div class="toolbar" style="margin-top:4px;">
            <div class="label" style="color:#333; font-weight:600;">Select Volunteer</div>
          </div>
          <worker-component id="volunteerPicker"></worker-component>
        </div>
        <route-list id="routesList" title="" variant="default"></route-list>
        <div id="routeDetails" style="margin-top:16px;"></div>
      </div>
    `;
  }
}

customElements.define('workers-page', WorkersPage);
