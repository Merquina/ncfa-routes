// Minimal route list component for testing
class SimpleRouteList extends HTMLElement {
  constructor() {
    super();
    this.innerHTML = `
      <div style="border: 1px solid #ccc; padding: 16px; border-radius: 8px; font-family: Arial, sans-serif;">
        <h3 style="margin: 0 0 16px 0; color: #333;">Sample Routes</h3>
        <div style="margin-bottom: 8px; padding: 8px; background: #f8f9fa; border-radius: 4px;">
          <strong>Route 1:</strong> Samuel - Downtown Market - Jan 15
        </div>
        <div style="margin-bottom: 8px; padding: 8px; background: #f8f9fa; border-radius: 4px;">
          <strong>Route 2:</strong> Emmanuel - Westside Market - Jan 16
        </div>
        <div style="margin-bottom: 8px; padding: 8px; background: #f8f9fa; border-radius: 4px;">
          <strong>Route 3:</strong> Tess - Recovery Route - Jan 17
        </div>
      </div>
    `;
  }
}

customElements.define('simple-route-list', SimpleRouteList);