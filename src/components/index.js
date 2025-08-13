// Import services
import '../services/data-service.js';

// Import controllers
import '../controllers/page-controller.js';

// Import components
import './inventory-component.js';
import './worker-component.js';
import './assignment-card.js';
import './date-card.js';
import './route-card.js';
import './route-list.js';
import './route-tabs.js';
import './hash-router.js';
import './app-layout.js';

// Import pages
import '../pages/boxes-page.js';
import '../pages/workers-page.js';
import '../pages/dates-page.js';

// Export for convenience if needed
export {
  InventoryComponent: customElements.get('inventory-component'),
  WorkerComponent: customElements.get('worker-component'),
  AssignmentCard: customElements.get('assignment-card'),
  DateCard: customElements.get('date-card'),
  RouteCard: customElements.get('route-card'),
  RouteList: customElements.get('route-list'),
  RouteTabs: customElements.get('route-tabs'),
  HashRouter: customElements.get('hash-router'),
  AppLayout: customElements.get('app-layout'),
  BoxesPage: customElements.get('boxes-page'),
  WorkersPage: customElements.get('workers-page'),
  DatesPage: customElements.get('dates-page')
};