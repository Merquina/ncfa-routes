class DatesPage extends HTMLElement {
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
    if (window.DatesPageController) {
      this.controller = new window.DatesPageController(this);
      await this.controller.initialize();
    } else {
      // Retry after a short delay if not available yet
      setTimeout(() => this.setupController(), 100);
    }
  }

  showError() {
    const container = this.shadowRoot.querySelector('.dates-container');
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666; background: #f8f9fa; border-radius: 8px;">
          <div style="font-size: 2rem; margin-bottom: 10px;">❌</div>
          <h3>Error Loading Date Data</h3>
          <p>Unable to load route dates. Please try refreshing the page.</p>
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
        
        .dates-container {
          max-width: 800px;
          margin: 0 auto;
        }
        
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
      
      <div class="page-header">
        <h2 class="page-title">📅 Routes by Date</h2>
        <p class="page-description">
          View upcoming route assignments organized by date
        </p>
      </div>
      
      <div class="dates-container">
        <route-list id="routesList" title="Next Upcoming Routes" variant="default"></route-list>
        <div id="routeDetails" style="margin-top:16px;"></div>
      </div>
    `;
  }
}

customElements.define('dates-page', DatesPage);
