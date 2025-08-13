class HashRouter extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.routes = new Map();
    this.currentRoute = null;
    this.defaultRoute = '/';
    
    // Bind methods
    this.handleHashChange = this.handleHashChange.bind(this);
  }

  static get observedAttributes() {
    return ['default-route'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'default-route' && newValue) {
      this.defaultRoute = newValue;
    }
  }

  connectedCallback() {
    this.render();
    this.setupRouter();
  }

  disconnectedCallback() {
    window.removeEventListener('hashchange', this.handleHashChange);
  }

  setupRouter() {
    // Listen for hash changes
    window.addEventListener('hashchange', this.handleHashChange);
    
    // Handle initial route
    this.handleHashChange();
  }

  registerRoute(path, component, title = '') {
    this.routes.set(path, { component, title });
  }

  navigate(path) {
    // Update the hash, which will trigger hashchange event
    window.location.hash = path;
  }

  handleHashChange() {
    const hash = window.location.hash.slice(1) || this.defaultRoute;
    
    // Clean up the hash (remove query params for now)
    const path = hash.split('?')[0] || this.defaultRoute;
    
    this.loadRoute(path);
  }

  loadRoute(path) {
    const route = this.routes.get(path);
    
    if (!route) {
      // Try to find a matching route or fallback to default
      const fallbackRoute = this.routes.get(this.defaultRoute);
      if (fallbackRoute) {
        this.navigate(this.defaultRoute);
        return;
      }
      console.error(`Route not found: ${path}`);
      return;
    }

    this.currentRoute = path;
    
    // Update page title if provided
    if (route.title) {
      document.title = `${route.title} - NCFA Routes`;
    }

    // Clear existing content
    const outlet = this.shadowRoot.querySelector('#router-outlet');
    if (outlet) {
      outlet.innerHTML = '';
      
      // Create and append the component
      if (typeof route.component === 'string') {
        // Component tag name
        const element = document.createElement(route.component);
        outlet.appendChild(element);
      } else if (typeof route.component === 'function') {
        // Component constructor
        const element = new route.component();
        outlet.appendChild(element);
      } else if (route.component instanceof HTMLElement) {
        // Already an element
        outlet.appendChild(route.component);
      }
    }

    // Emit route change event
    this.dispatchEvent(new CustomEvent('route-changed', {
      detail: { path, route },
      bubbles: true
    }));
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
          height: 100%;
        }
        
        #router-outlet {
          width: 100%;
          height: 100%;
          overflow-y: auto;
        }
      </style>
      
      <div id="router-outlet">
        <!-- Routed components will be inserted here -->
      </div>
    `;
  }

  // Utility methods for external use
  getCurrentRoute() {
    return this.currentRoute;
  }

  getRoutes() {
    return Array.from(this.routes.keys());
  }
}

// Simple route registration helper
HashRouter.registerGlobalRoutes = function(routes) {
  document.addEventListener('DOMContentLoaded', () => {
    const router = document.querySelector('hash-router');
    if (router && routes) {
      Object.entries(routes).forEach(([path, config]) => {
        router.registerRoute(path, config.component, config.title);
      });
    }
  });
};

customElements.define('hash-router', HashRouter);