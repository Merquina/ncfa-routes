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
        .inventory-container {
          max-width: 600px;
          margin: 0 auto;
        }
        
        @media (max-width: 600px) {
          :host {
            padding: 0 5px;
          }
        }
      </style>

      <div class="inventory-container">
        <inventory-component id="inventoryComponent"></inventory-component>
      </div>
    `;
  }
}

customElements.define('boxes-page', BoxesPage);
