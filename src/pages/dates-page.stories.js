import '../components/index.js';

export default {
  title: 'Pages/By Date',
  component: 'dates-page'
};

const makeRoutes = () => ([
  norm({ id: 'r1', date: '2025-08-14', market: 'Downtown Market', workers: ['Samuel', 'Tess'], volunteers: ['Volunteer'], type: 'spfm' }),
  norm({ id: 'r2', date: '2025-08-15', market: 'Westside Market', workers: ['Emmanuel'], volunteers: [], type: 'spfm' }),
  norm({ id: 'r3', date: '2025-08-16', market: 'Recovery Route', workers: ['Samuel'], volunteers: [], type: 'recovery' }),
]);

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

export const Default = () => {
  // Mock dataService used by page controller (EventTarget-compatible)
  class MockService extends EventTarget {
    async getAllRoutes() { return makeRoutes(); }
    async getWorkers() { return ['Samuel', 'Tess', 'Emmanuel']; }
    getWorkersFromRoute(r) { return r.workers || []; }
    async loadApiData() { this.dispatchEvent(new CustomEvent('data-loaded')); }
  }
  window.dataService = new MockService();

  const el = document.createElement('dates-page');
  return el;
};
