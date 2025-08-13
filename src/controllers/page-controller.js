/**
 * Base Page Controller - Handles data flow between data service and components
 * Follows clean architecture principles with separation of concerns
 */
class PageController {
  constructor(pageElement) {
    this.pageElement = pageElement;
    this.dataService = window.dataService;
    this.isLoading = false;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Listen for data service events (guard for storybook mocks)
    if (this.dataService && typeof this.dataService.addEventListener === 'function') {
      this.dataService.addEventListener("loading-started", () => this.handleLoadingStarted());
      this.dataService.addEventListener("loading-finished", () => this.handleLoadingFinished());
      this.dataService.addEventListener("data-error", (e) => this.handleDataError(e.detail));
    }
  }

  handleLoadingStarted() {
    this.isLoading = true;
    this.showLoading();
  }

  handleLoadingFinished() {
    this.isLoading = false;
    this.hideLoading();
  }

  handleDataError(error) {
    console.error("Data error:", error);
    this.showError(error.message || "An error occurred loading data");
  }

  showLoading() {
    // Override in subclasses
  }

  hideLoading() {
    // Override in subclasses
  }

  showError(message) {
    // Override in subclasses
    console.error(message);
  }

  // Render a route-details component into a #routeDetails container if present
  renderRouteDetailsInPage(route) {
    const root = this.pageElement.shadowRoot || this.pageElement;
    const container = root && root.querySelector('#routeDetails');
    if (!container) return;
    container.innerHTML = '';
    const details = document.createElement('route-details');
    if (typeof details.setRoute === 'function') {
      details.setRoute(route);
    } else {
      details.setAttribute('route', JSON.stringify(route));
    }
    container.appendChild(details);
    // Scroll into view for better UX
    setTimeout(() => {
      details.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }
}

/**
 * Boxes Page Controller - Manages inventory component and data
 */
class BoxesPageController extends PageController {
  constructor(pageElement) {
    super(pageElement);
    this.inventoryComponent = null;
  }

  async initialize() {
    this.inventoryComponent = this.pageElement.querySelector(
      "inventory-component"
    );

    if (this.inventoryComponent) {
      // Set up configuration
      const boxConfig = this.dataService.getBoxConfig();
      this.inventoryComponent.setBoxConfig(boxConfig);

      // Listen for inventory changes
      this.inventoryComponent.addEventListener("inventory-changed", (e) => {
        this.handleInventoryChanged(e.detail);
      });

      // Load initial data
      await this.loadInventoryData();
    }
  }

  async loadInventoryData() {
    if (!this.inventoryComponent || !this.dataService) return;

    try {
      const inventory = await this.dataService.getInventory();
      this.inventoryComponent.setInventoryData(inventory);
    } catch (error) {
      this.showError("Failed to load inventory data");
    }
  }

  handleInventoryChanged(inventoryData) {
    console.log("Inventory updated:", inventoryData);
    // Could trigger notifications, analytics, etc.
  }
}

/**
 * Workers Page Controller - Manages worker component and assignments
 */
class WorkersPageController extends PageController {
  constructor(pageElement) {
    super(pageElement);
    this.routesListComponent = null;
    this.selectedWorker = null;
  }

  async initialize() {
    this.routesListComponent = this.pageElement.shadowRoot?.querySelector("#routesList");
    this.workerPicker = this.pageElement.shadowRoot?.querySelector('#workerPicker');
    this.volunteerPicker = this.pageElement.shadowRoot?.querySelector('#volunteerPicker');
    this.clearFilterBtn = this.pageElement.shadowRoot?.querySelector('#clearFilter');
    if (this.routesListComponent) {
      // Re-render when data loads
      if (this.dataService) {
        this.dataService.addEventListener('data-loaded', () => this.loadRoutesDataForWorkers());
      }
      // Ensure API is loaded before first render
      if (this.dataService && typeof this.dataService.loadApiData === 'function') {
        await this.dataService.loadApiData();
      }
      await this.loadRoutesDataForWorkers();
      // Forward route selection from shadow to here (route-card emits composed events)
      this.routesListComponent.addEventListener('route-selected', (e) => {
        this.handleRouteSelected(e.detail);
      });
      // Listener added above
      if (this.workerPicker) {
        // Initialize worker picker from data service
        try {
          const workers = await this.dataService.getWorkers();
          const icons = this.dataService.getWorkerIcons();
          this.workerPicker.setWorkersData(workers, icons, '👤');
          this.workerPicker.addEventListener('worker-selected', (e) => {
            const name = e.detail.worker;
            // Clear volunteer selection
            if (this.volunteerPicker) { this.volunteerPicker.selectedWorker = null; this.volunteerPicker.render(); }
            this.routesListComponent.setFilter('workers', name);
            this.routesListComponent.setGroupBy(null);
            this.routesListComponent.setTitle(`Routes for ${name}`);
            const host = this.pageElement.shadowRoot;
            const listEl = host && host.querySelector('#routesList');
            if (listEl) listEl.style.display = '';
          });
        } catch (e) {
          console.warn('Failed to init worker picker', e);
        }
      }
      if (this.volunteerPicker) {
        try {
          // Build volunteers list from upcoming routes
          const routes = await this.dataService.getAllRoutes();
          const vSet = new Set();
          const today = new Date(); today.setHours(0,0,0,0);
          routes
            .filter(r => (r.sortDate instanceof Date) && r.sortDate >= today)
            .forEach(r => (r.volunteers || []).forEach(v => vSet.add(v)));
          const volunteers = Array.from(vSet).sort();
          const icons = this.dataService.getWorkerIcons();
          this.volunteerPicker.setWorkersData(volunteers, icons, '👤');
          this.volunteerPicker.addEventListener('worker-selected', (e) => {
            const name = e.detail.worker;
            // Clear worker selection
            if (this.workerPicker) { this.workerPicker.selectedWorker = null; this.workerPicker.render(); }
            this.routesListComponent.setFilter('volunteers', name);
            this.routesListComponent.setGroupBy(null);
            this.routesListComponent.setTitle(`Volunteer routes for ${name}`);
            const host = this.pageElement.shadowRoot;
            const listEl = host && host.querySelector('#routesList');
            if (listEl) listEl.style.display = '';
          });
        } catch (e) {
          console.warn('Failed to init volunteer picker', e);
        }
      }
      // Clear button removed; routes remain hidden until a selection
    }
  }

  async loadWorkersData() {
    if (!this.workerComponent || !this.dataService) return;

    try {
      const workers = await this.dataService.getWorkers();
      const workerIcons = this.dataService.getWorkerIcons();

      this.workerComponent.setWorkersData(workers, workerIcons, "👤");
    } catch (error) {
      this.showError("Failed to load workers data");
    }
  }

  async loadRoutesDataForWorkers() {
    if (!this.routesListComponent || !this.dataService) return;

    try {
      const routes = await this.dataService.getAllRoutes();
      // Prepare list but keep hidden until a selection is made
      this.routesListComponent.setRoutes(routes);
      this.routesListComponent.setGroupBy(null);
      this.routesListComponent.setTitle('');
      this.routesListComponent.clickable = true;
      const host = this.pageElement.shadowRoot;
      const listEl = host && host.querySelector('#routesList');
      if (listEl) listEl.style.display = 'none';

      // Worker picker is used instead of chips
    } catch (error) {
      this.showError("Failed to load routes data");
    }
  }

  handleRouteSelected(routeData) {
    console.log("Route selected:", routeData);
    const route = routeData && (routeData.route || routeData);
    if (route && route.id) {
      const rid = encodeURIComponent(route.id);
      window.location.hash = `/route?rid=${rid}`;
    }
  }

  // chip-based filters removed in favor of worker-component with emojis

  async handleWorkerSelected(workerName) {
    this.selectedWorker = workerName;
    console.log("Worker selected:", workerName);

    // Load worker assignments
    try {
      const assignments = await this.dataService.getWorkerAssignments(
        workerName
      );

      // Here you would render assignments using assignment components
      // For now, we'll use the legacy assignment manager
      if (window.assignmentsManager && assignments) {
        window.assignmentsManager.renderWorkerAssignments(
          workerName,
          assignments
        );
      }
    } catch (error) {
      this.showError(`Failed to load assignments for ${workerName}`);
    }
  }
}

/**
 * Dates Page Controller - Manages date display and route navigation
 */
class DatesPageController extends PageController {
  constructor(pageElement) {
    super(pageElement);
    this.routesListComponent = null;
  }

  async initialize() {
    this.routesListComponent = this.pageElement.shadowRoot?.querySelector("#routesList");
    if (this.routesListComponent) {
      if (this.dataService) {
        this.dataService.addEventListener('data-loaded', () => this.loadRoutesDataForDates());
      }
      if (this.dataService && typeof this.dataService.loadApiData === 'function') {
        await this.dataService.loadApiData();
      }
      await this.loadRoutesDataForDates();
      this.routesListComponent.addEventListener('route-selected', (e) => {
        this.handleRouteSelected(e.detail);
      });
    } else {
      await this.loadDatesData();
    }
  }

  async loadRoutesDataForDates() {
    if (!this.routesListComponent || !this.dataService) return;

    try {
      const routes = await this.dataService.getAllRoutes();

      // Filter to upcoming and group by date using normalized sortDate
      const today = new Date(); today.setHours(0,0,0,0);
      const upcoming = routes
        .filter(r => (r.sortDate instanceof Date) && r.sortDate >= today)
        .sort((a,b) => (a.sortDate - b.sortDate))
        .slice(0, 7);

      this.routesListComponent.setRoutes(upcoming);
      this.routesListComponent.setGroupBy(null);
      this.routesListComponent.setTitle('Next Upcoming Routes');
      this.routesListComponent.clickable = true;
    } catch (error) {
      this.showError("Failed to load routes data");
    }
  }

  handleRouteSelected(routeData) {
    console.log("Route selected:", routeData);
    const route = routeData && (routeData.route || routeData);
    if (route && route.id) {
      const rid = encodeURIComponent(route.id);
      window.location.hash = `/route?rid=${rid}`;
    }
  }

  async loadDatesData() {
    if (!this.dataService) return;

    try {
      const upcomingRoutes = await this.dataService.getUpcomingRoutes(7);

      // For now, use the legacy dates manager
      if (window.datesManager && upcomingRoutes) {
        // Set up unified rendering
        if (window.assignmentsManager) {
          window.assignmentsManager.renderUnifiedAssignments({
            routes: upcomingRoutes,
            title: "Next Upcoming Routes",
            emoji: "📅",
            color: "#007bff",
            groupByMarket: false,
            showPrintButton: false,
          });
        }
      }
    } catch (error) {
      this.showError("Failed to load dates data");
    }
  }
}

// Export controllers
window.PageController = PageController;
window.BoxesPageController = BoxesPageController;
window.WorkersPageController = WorkersPageController;
window.DatesPageController = DatesPageController;

export {
  PageController,
  BoxesPageController,
  WorkersPageController,
  DatesPageController,
};
