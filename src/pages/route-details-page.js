class RouteDetailsPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.renderSkeleton();
    this.loadAndRender();
    window.addEventListener('hashchange', () => this.loadAndRender());
  }

  getRouteIdFromHash() {
    const hash = window.location.hash || '';
    const q = hash.split('?')[1] || '';
    const params = new URLSearchParams(q);
    return params.get('rid');
  }

  async loadAndRender() {
    const rid = this.getRouteIdFromHash();
    if (!rid) {
      this.shadowRoot.querySelector('#container').innerHTML = '<div style="padding:16px;">No route selected.</div>';
      return;
    }
    const dataService = window.dataService;
    if (!dataService) return;
    try {
      if (typeof dataService.loadApiData === 'function') {
        await dataService.loadApiData();
      }
      const routes = await dataService.getAllRoutes();
      const ridDecoded = (() => { try { return decodeURIComponent(rid); } catch { return rid; } })();
      const route = routes.find(r => {
        const id = r.id || r._routeId || '';
        return (
          encodeURIComponent(id) === rid ||
          id === ridDecoded
        );
      });
      if (!route) {
        this.shadowRoot.querySelector('#container').innerHTML = '<div style="padding:16px;">Route not found.</div>';
        return;
      }
      const details = document.createElement('route-details');
      details.setRoute(route);
      const container = this.shadowRoot.querySelector('#container');
      container.innerHTML = '';
      // Back button
      const back = document.createElement('button');
      back.textContent = '← Back';
      back.style.cssText = 'margin:12px; background:#6c757d; color:white; border:none; padding:8px 12px; border-radius:4px; cursor:pointer;';
      back.addEventListener('click', () => window.history.back());
      container.appendChild(back);
      container.appendChild(details);
    } catch (e) {
      this.shadowRoot.querySelector('#container').innerHTML = `<div style="padding:16px; color:#b00;">Error: ${e.message}</div>`;
    }
  }

  renderSkeleton() {
    this.shadowRoot.innerHTML = `
      <style>
        :host{ display:block; padding:0; font-family: var(--body-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif); }
      </style>
      <div id="container"></div>
    `;
  }
}

customElements.define('route-details-page', RouteDetailsPage);
