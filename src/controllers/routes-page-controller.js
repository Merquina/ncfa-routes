class RoutesPageController {
  constructor(pageElement) {
    this.pageElement = pageElement;
    this.dataService = null;
    this.routeTabsElement = null;
  }

  async initialize() {
    // Wait for data service to be available
    if (window.dataService) {
      this.dataService = window.dataService;
    } else {
      console.warn('DataService not available yet, routes will load when data service is ready');
      return;
    }

    // Get the route tabs element
    this.routeTabsElement = this.pageElement.shadowRoot?.querySelector('#routeTabs');
    if (!this.routeTabsElement) {
      console.warn('Route tabs element not found');
      return;
    }

    // Load data
    await this.loadData();

    // Set up event listeners
    this.setupEventListeners();
  }

  async loadData() {
    try {
      // Load routes and workers data
      const [routes, workers] = await Promise.all([
        this.dataService.getRoutes(),
        this.dataService.getWorkers()
      ]);

      // Transform routes data to include worker assignments
      const enrichedRoutes = routes.map(route => ({
        ...route,
        workers: this.dataService.getWorkersFromRoute(route) || []
      }));

      // Update the route tabs component
      if (this.routeTabsElement) {
        this.routeTabsElement.setRoutes(enrichedRoutes);
        this.routeTabsElement.setWorkers(workers);
      }

    } catch (error) {
      console.error('Failed to load routes data:', error);
      this.showError();
    }
  }

  setupEventListeners() {
    // Listen for route selection events
    if (this.routeTabsElement) {
      this.routeTabsElement.addEventListener('route-selected', (e) => {
        this.handleRouteSelection(e.detail);
      });
    }

    // Listen for data service updates
    if (this.dataService) {
      this.dataService.addEventListener('routes-updated', () => {
        this.loadData();
      });
      
      this.dataService.addEventListener('workers-updated', () => {
        this.loadData();
      });
    }
  }

  handleRouteSelection(routeData) {
    // Dispatch event for other components to handle
    this.pageElement.dispatchEvent(new CustomEvent('route-selected', {
      detail: routeData,
      bubbles: true
    }));
  }

  showError() {
    if (this.routeTabsElement) {
      this.routeTabsElement.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666; background: #f8f9fa; border-radius: 8px;">
          <div style="font-size: 2rem; margin-bottom: 10px;">❌</div>
          <h3>Error Loading Routes</h3>
          <p>Unable to load route data. Please try refreshing the page.</p>
        </div>
      `;
    }
  }
}

// Export for global access
window.RoutesPageController = RoutesPageController;