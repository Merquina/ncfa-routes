import './index.js';

export default {
  title: 'App/AppLayout',
  component: 'app-layout'
};

function mockRoutesData() {
  return [
    norm({ id: 'r1', date: '2025-08-14', market: 'Downtown Market', workers: ['Samuel', 'Tess'], volunteers: ['Volunteer'], type: 'spfm' }),
    norm({ id: 'r2', date: '2025-08-15', market: 'Westside Market', workers: ['Emmanuel'], volunteers: [], type: 'spfm' }),
    norm({ id: 'r3', date: '2025-08-16', market: 'Recovery Route', workers: ['Samuel'], volunteers: [], type: 'recovery' }),
  ];
}

function norm(r) {
  const d = new Date(r.date);
  return {
    id: r.id,
    type: r.type || 'spfm',
    date: r.date,
    sortDate: d,
    displayDate: d.toDateString(),
    market: r.market,
    workers: r.workers || [],
    volunteers: r.volunteers || [],
    vans: r.vans || [],
    materials: { office: [], storage: [], atMarket: [], backAtOffice: [] },
    stops: [],
  };
}

function mockService() {
  class MockService extends EventTarget {
    async getAllRoutes() { return mockRoutesData(); }
    async getWorkers() { return ['Samuel', 'Tess', 'Emmanuel']; }
    getWorkersFromRoute(r) { return r.workers || []; }
    getBoxConfig() { return { small: {label:'small'}, large: {label:'LARGE'} }; }
    async getInventory() { return { smallBoxes: 12, largeBoxes: 7, lastUpdated: 'Today', updatedBy: 'Storybook' }; }
    async loadApiData() { this.dispatchEvent(new CustomEvent('data-loaded')); }
  }
  window.dataService = new MockService();
}

export const WithBoxesPage = () => {
  mockService();
  const layout = document.createElement('app-layout');
  const router = document.createElement('hash-router');
  layout.appendChild(router);
  // register routes
  router.registerRoute('/boxes', 'boxes-page', 'Box Inventory');
  router.registerRoute('/dates', 'dates-page', 'Next Upcoming');
  router.registerRoute('/workers', 'workers-page', 'Routes by Worker');
  router.registerRoute('/route', 'route-details-page', 'Route Details');
  // navigate to boxes
  window.location.hash = '/boxes';
  return layout;
};

export const WithDatesPage = () => {
  mockService();
  const layout = document.createElement('app-layout');
  const router = document.createElement('hash-router');
  layout.appendChild(router);
  router.registerRoute('/boxes', 'boxes-page', 'Box Inventory');
  router.registerRoute('/dates', 'dates-page', 'Next Upcoming');
  router.registerRoute('/workers', 'workers-page', 'Routes by Worker');
  router.registerRoute('/route', 'route-details-page', 'Route Details');
  window.location.hash = '/dates';
  return layout;
};

export const WithWorkersPage = () => {
  mockService();
  const layout = document.createElement('app-layout');
  const router = document.createElement('hash-router');
  layout.appendChild(router);
  router.registerRoute('/boxes', 'boxes-page', 'Box Inventory');
  router.registerRoute('/dates', 'dates-page', 'Next Upcoming');
  router.registerRoute('/workers', 'workers-page', 'Routes by Worker');
  router.registerRoute('/route', 'route-details-page', 'Route Details');
  window.location.hash = '/workers';
  return layout;
};
