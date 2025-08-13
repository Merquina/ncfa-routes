import './route-tabs.js';

export default {
  title: 'Components/Route Tabs',
  component: 'route-tabs',
  argTypes: {
    activeTab: {
      control: { type: 'select' },
      options: ['by-workers', 'next-7']
    }
  },
};

const Template = (args) => {
  const element = document.createElement('route-tabs');
  
  if (args.activeTab) {
    element.setAttribute('active-tab', args.activeTab);
  }
  
  // Set sample data
  element.setWorkers(['Samuel', 'Emmanuel', 'Tess', 'Ayoyo']);
  element.setRoutes(sampleRoutes);

  return element;
};

const sampleRoutes = [
  {
    _routeId: 'route_1',
    date: '2024-01-15',
    market: 'Downtown Farmers Market',
    startTime: '9:00 AM',
    workers: ['Samuel', 'Emmanuel'],
    stops: ['Green Valley Farm', 'Sunrise Organic Farm', 'Mountain View Produce']
  },
  {
    _routeId: 'route_2',
    date: '2024-01-16',
    market: 'Westside Market',
    startTime: '10:30 AM',
    workers: ['Tess'],
    stops: ['River Valley Farm', 'Golden Harvest Co-op']
  },
  {
    _routeId: 'route_3',
    date: '2024-01-17',
    market: 'Recovery Route',
    startTime: '2:00 PM',
    workers: ['Ayoyo', 'Samuel'],
    stops: ['Community Garden', 'Local Food Bank']
  },
  {
    _routeId: 'route_4',
    date: '2024-01-18',
    market: 'Downtown Farmers Market',
    startTime: '8:00 AM',
    workers: ['Emmanuel'],
    stops: ['Metro Fresh Market', 'Urban Harvest']
  },
  {
    _routeId: 'route_5',
    date: '2024-01-19',
    market: 'Northside Market',
    startTime: '11:00 AM',
    workers: ['Tess', 'Ayoyo'],
    stops: ['Fresh Fields Farm', 'Seasonal Produce Co.']
  }
];

export const ByWorkers = Template.bind({});
ByWorkers.args = {
  activeTab: 'by-workers'
};

export const Next7Days = Template.bind({});
Next7Days.args = {
  activeTab: 'next-7'
};

export const Interactive = Template.bind({});
Interactive.args = {
  activeTab: 'by-workers'
};