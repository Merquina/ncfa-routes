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
    // Listen for data service events
    if (this.dataService) {
      this.dataService.addEventListener('loading-started', () => this.handleLoadingStarted());
      this.dataService.addEventListener('loading-finished', () => this.handleLoadingFinished());
      this.dataService.addEventListener('data-error', (e) => this.handleDataError(e.detail));
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
    console.error('Data error:', error);
    this.showError(error.message || 'An error occurred loading data');
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
    this.inventoryComponent = this.pageElement.querySelector('inventory-component');
    
    if (this.inventoryComponent) {
      // Set up configuration
      const boxConfig = this.dataService.getBoxConfig();
      this.inventoryComponent.setBoxConfig(boxConfig);

      // Listen for inventory changes
      this.inventoryComponent.addEventListener('inventory-changed', (e) => {
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
      this.showError('Failed to load inventory data');
    }
  }

  handleInventoryChanged(inventoryData) {
    console.log('Inventory updated:', inventoryData);
    // Could trigger notifications, analytics, etc.
  }
}

/**
 * Workers Page Controller - Manages worker component and assignments
 */
class WorkersPageController extends PageController {
  constructor(pageElement) {
    super(pageElement);
    this.workerComponent = null;
    this.selectedWorker = null;
  }

  async initialize() {
    // Check if using new route-tabs component or legacy worker component
    this.routeTabsComponent = this.pageElement.shadowRoot?.querySelector('#routeTabs');
    this.workerComponent = this.pageElement.shadowRoot?.querySelector('worker-component');
    
    if (this.routeTabsComponent) {
      // Wait for component to be ready or set up immediately if already connected
      if (this.routeTabsComponent.isConnected) {
        await this.setupRouteTabs();
      } else {
        this.routeTabsComponent.addEventListener('component-ready', async () => {
          await this.setupRouteTabs();
        }, { once: true });
      }
    } else if (this.workerComponent) {
      // Legacy worker component setup
      this.workerComponent.addEventListener('worker-selected', (e) => {
        this.handleWorkerSelected(e.detail.worker);
      });

      await this.loadWorkersData();
    }
  }

  async loadWorkersData() {
    if (!this.workerComponent || !this.dataService) return;

    try {
      const workers = await this.dataService.getWorkers();
      const workerIcons = this.dataService.getWorkerIcons();
      
      this.workerComponent.setWorkersData(workers, workerIcons, "👤");
    } catch (error) {
      this.showError('Failed to load workers data');
    }
  }

  async setupRouteTabs() {
    await this.loadRoutesData();
    
    this.routeTabsComponent.addEventListener('route-selected', (e) => {
      this.handleRouteSelected(e.detail);
    });
  }

  async loadRoutesData() {
    if (!this.routeTabsComponent || !this.dataService) return;

    try {
      const [routes, workers] = await Promise.all([
        this.dataService.getAllRoutes(),
        this.dataService.getWorkers()
      ]);

      // Transform routes to include worker assignments
      const enrichedRoutes = routes.map(route => ({
        ...route,
        workers: this.dataService.getWorkersFromRoute(route) || []
      }));

      this.routeTabsComponent.setRoutes(enrichedRoutes);
      this.routeTabsComponent.setWorkers(workers);
    } catch (error) {
      this.showError('Failed to load routes data');
    }
  }

  handleRouteSelected(routeData) {
    console.log('Route selected:', routeData);
    // Handle route selection - could navigate to detail view, etc.
  }

  async handleWorkerSelected(workerName) {
    this.selectedWorker = workerName;
    console.log('Worker selected:', workerName);

    // Load worker assignments
    try {
      const assignments = await this.dataService.getWorkerAssignments(workerName);
      
      // Here you would render assignments using assignment components
      // For now, we'll use the legacy assignment manager
      if (window.assignmentsManager && assignments) {
        window.assignmentsManager.renderWorkerAssignments(workerName, assignments);
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
    this.routeTabsComponent = null;
  }

  async initialize() {
    // Check if using new route-tabs component
    this.routeTabsComponent = this.pageElement.shadowRoot?.querySelector('#routeTabs');
    
    if (this.routeTabsComponent) {
      // Wait for component to be ready or set up immediately if already connected
      if (this.routeTabsComponent.isConnected) {
        await this.setupRouteTabs();
      } else {
        this.routeTabsComponent.addEventListener('component-ready', async () => {
          await this.setupRouteTabs();
        }, { once: true });
      }
    } else {
      // Fallback to legacy implementation
      await this.loadDatesData();
    }
  }

  async setupRouteTabs() {
    await this.loadRoutesDataForDates();
    
    this.routeTabsComponent.addEventListener('route-selected', (e) => {
      this.handleRouteSelected(e.detail);
    });
  }

  async loadRoutesDataForDates() {
    if (!this.routeTabsComponent || !this.dataService) return;

    try {
      const [routes, workers] = await Promise.all([
        this.dataService.getAllRoutes(),
        this.dataService.getWorkers()
      ]);

      // Transform routes to include worker assignments
      const enrichedRoutes = routes.map(route => ({
        ...route,
        workers: this.dataService.getWorkersFromRoute(route) || []
      }));

      this.routeTabsComponent.setRoutes(enrichedRoutes);
      this.routeTabsComponent.setWorkers(workers);
    } catch (error) {
      this.showError('Failed to load routes data');
    }
  }

  handleRouteSelected(routeData) {
    console.log('Route selected:', routeData);
    // Handle route selection - could navigate to detail view, etc.
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
            title: "Next 7 Upcoming Routes",
            emoji: "📅",
            color: "#007bff",
            groupByMarket: false,
            showPrintButton: false,
          });
        }
      }
    } catch (error) {
      this.showError('Failed to load dates data');
    }
  }
}

// Export controllers
window.PageController = PageController;
window.BoxesPageController = BoxesPageController;
window.WorkersPageController = WorkersPageController;
window.DatesPageController = DatesPageController;

export { PageController, BoxesPageController, WorkersPageController, DatesPageController };