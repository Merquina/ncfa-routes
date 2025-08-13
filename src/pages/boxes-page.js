class BoxesPage extends HTMLElement {
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
    if (window.BoxesPageController) {
      this.controller = new window.BoxesPageController(this);
      await this.controller.initialize();
    } else {
      // Retry after a short delay if not available yet
      setTimeout(() => this.setupController(), 100);
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
        
        .inventory-container {
          max-width: 600px;
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
        <h2 class="page-title">📦 Box Inventory Management</h2>
        <p class="page-description">
          Track and manage your SPFM box inventory
        </p>
      </div>
      
      <div class="inventory-container">
        <inventory-component id="inventoryComponent"></inventory-component>
      </div>
    `;
  }
}

customElements.define('boxes-page', BoxesPage);