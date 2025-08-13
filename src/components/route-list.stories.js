import './route-card.js'; // ensure route-card is registered
import './route-list.js';

export default {
  title: 'Components/Route List',
  component: 'route-list',
};

const sampleRoutes = [
  {
    worker: 'Samuel',
    date: '2024-01-15',
    market: 'Downtown Farmers Market',
    route: 'Route A',
    vehicle: 'Truck #1',
    stops: ['Green Valley Farm', 'Sunrise Organic Farm', 'Mountain View Produce']
  },
  {
    worker: 'Emmanuel',
    date: '2024-01-16',
    market: 'Downtown Farmers Market',
    route: 'Route B', 
    vehicle: 'Van #2',
    stops: ['River Valley Farm', 'Golden Harvest Co-op']
  },
  {
    worker: 'Tess',
    date: '2024-01-17',
    market: 'Westside Market',
    route: 'Recovery Route',
    stops: ['Community Garden', 'Local Food Bank']
  }
];

export const Default = () => {
  const el = document.createElement('route-list');
  el.setTitle('Upcoming Routes');
  el.setRoutes(sampleRoutes);
  return el;
};

export const SimpleTest = () => {
  const el = document.createElement('route-list');
  el.title = 'Test Routes';
  el.routes = [{ worker: 'Samuel', date: '2024-01-15', market: 'Test Market' }];
  return el;
};

export const MinimalTest = () => {
  const el = document.createElement('route-list');
  el.title = 'Minimal Test';
  el.routes = [{ worker: 'Test', market: 'Test Market' }];
  return el;
};

export const BasicTest = () => {
  const el = document.createElement('route-list');
  el.title = 'Basic Test';
  el.routes = [{ worker: 'Direct', market: 'Direct Market' }];
  return el;
};

export const GroupedByMarket = () => {
  const el = document.createElement('route-list');
  el.setTitle('Routes by Market');
  el.setRoutes(sampleRoutes);
  el.setGroupBy('market');
  return el;
};

export const CompactVariant = () => {
  const el = document.createElement('route-list');
  el.setTitle('Compact Route List');
  el.setAttribute('variant', 'compact');
  el.setRoutes(sampleRoutes);
  return el;
};

export const EmptyList = () => {
  const el = document.createElement('route-list');
  el.setTitle('No Routes Available');
  el.emptyMessage = 'All routes have been completed!';
  el.setRoutes([]);
  return el;
};

export const FilteredByWorker = () => {
  const el = document.createElement('route-list');
  el.setTitle('Routes for Samuel');
  el.setRoutes(sampleRoutes);
  el.setFilter('worker', 'Samuel');
  return el;
};
