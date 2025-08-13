class HashRouter extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.routes = new Map();
    this.currentRoute = null;
    this.defaultRoute = "/materials";
    this._didInitialDataLoad = false;

    // Bind methods
    this.handleHashChange = this.handleHashChange.bind(this);
  }

  static get observedAttributes() {
    return ["default-route"];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "default-route" && newValue) {
      this.defaultRoute = newValue;
    }
  }

  connectedCallback() {
    this.render();
    // Defer router setup slightly to allow routes to register
    setTimeout(() => this.setupRouter(), 0);
  }

  disconnectedCallback() {
    window.removeEventListener("hashchange", this.handleHashChange);
  }

  setupRouter() {
    // Listen for hash changes
    window.addEventListener("hashchange", this.handleHashChange);

    // Handle initial route
    this.handleHashChange();
  }

  registerRoute(path, component, title = "") {
    this.routes.set(path, { component, title });
    // If the newly registered route matches the current hash, load it now
    const current =
      (window.location.hash.slice(1) || this.defaultRoute).split("?")[0] ||
      this.defaultRoute;
    if (current === path) {
      this.loadRoute(path);
    }
  }

  navigate(path) {
    // Update the hash, which will trigger hashchange event
    window.location.hash = path;
  }

  handleHashChange() {
    const hash = window.location.hash.slice(1) || this.defaultRoute;

    // Clean up the hash (remove query params for now)
    const path = hash.split("?")[0] || this.defaultRoute;
    // If only query params changed, do not remount the route; notify params change instead
    if (this.currentRoute === path) {
      const paramsStr = hash.split("?")[1] || "";
      const params = Object.fromEntries(new URLSearchParams(paramsStr));
      this.dispatchEvent(
        new CustomEvent("route-params-changed", {
          detail: { path, params },
          bubbles: true,
        })
      );
      return;
    }
    this.loadRoute(path);
  }

  async loadRoute(path) {
    const route = this.routes.get(path);

    if (!route) {
      // Retry briefly for missing route to allow late registration
      if (!this._retry) this._retry = {};
      const key = `p:${path}`;
      const attempts = this._retry[key] || 0;
      if (attempts < 40) {
        // ~2s total at 50ms
        this._retry[key] = attempts + 1;
        return setTimeout(() => this.loadRoute(path), 50);
      }
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
    // Ensure data load on every route activation (await to prevent view races)
    try {
      if (
        window.dataService &&
        typeof window.dataService.loadApiData === "function"
      ) {
        await window.dataService.loadApiData();
        this._didInitialDataLoad = true;
      }
    } catch {}

    // Update page title if provided
    if (route.title) {
      document.title = `${route.title} - NCFA Routes`;
    }

    // Clear existing content
    const outlet = this.shadowRoot.querySelector("#router-outlet");
    if (outlet) {
      outlet.innerHTML = "";

      // Create and append the component
      if (typeof route.component === "string") {
        // Component tag name
        const tag = route.component;
        try {
          await customElements.whenDefined(tag);
        } catch {}
        const element = document.createElement(tag);
        outlet.appendChild(element);
      } else if (typeof route.component === "function") {
        // Component constructor
        const element = new route.component();
        outlet.appendChild(element);
      } else if (route.component instanceof HTMLElement) {
        // Already an element
        outlet.appendChild(route.component);
      }
      // Let pages control scroll based on hash params
    }

    // Emit route change event with current query params
    const paramsStr = window.location.hash.slice(1).split("?")[1] || "";
    const params = Object.fromEntries(new URLSearchParams(paramsStr));
    this.dispatchEvent(
      new CustomEvent("route-changed", {
        detail: { path, route, params },
        bubbles: true,
      })
    );
  }

  async refreshCurrentRoute(preserveScroll = true) {
    const outlet =
      this.shadowRoot && this.shadowRoot.querySelector("#router-outlet");
    const prevScroll = preserveScroll && outlet ? outlet.scrollTop : 0;
    if (this.currentRoute) {
      await this.loadRoute(this.currentRoute);
      if (preserveScroll && outlet) {
        try {
          outlet.scrollTop = prevScroll;
        } catch {}
      }
    }
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
HashRouter.registerGlobalRoutes = function (routes) {
  document.addEventListener("DOMContentLoaded", () => {
    const router = document.querySelector("hash-router");
    if (router && routes) {
      Object.entries(routes).forEach(([path, config]) => {
        router.registerRoute(path, config.component, config.title);
      });
    }
  });
};

customElements.define("hash-router", HashRouter);
