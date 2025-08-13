import './route-card.js';

export default {
  title: 'Components/Route Card',
  component: 'route-card',
  argTypes: {
    routeData: { control: 'object' },
    routeId: { control: 'text' }
  },
};

const Template = (args) => {
  const element = document.createElement('route-card');
  
  if (args.routeData) {
    element.setRoute(args.routeData, args.routeId);
  }

  // Listen for route selection events
  element.addEventListener('route-selected', (e) => {
    console.log('Route selected:', e.detail);
  });

  return element;
};

export const SPFMRoute = Template.bind({});
SPFMRoute.args = {
  routeData: {
    displayDate: 'Mon, Jan 15',
    date: '2024-01-15',
    market: 'Downtown Farmers Market',
    startTime: '8:00 AM',
    type: 'spfm',
    workers: ['Samuel', 'Emmanuel'],
    volunteers: ['Volunteer'],
    vans: ['Van #1', 'Truck #2']
  },
  routeId: 'spfm_1'
};

export const RecoveryRoute = Template.bind({});
RecoveryRoute.args = {
  routeData: {
    displayDate: 'Tue, Jan 16',
    date: '2024-01-16',
    market: 'Community Market',
    startTime: '2:00 PM',
    type: 'recovery',
    workers: ['Tess'],
    volunteers: [],
    vans: ['Recovery Van']
  },
  routeId: 'recovery_1'
};

export const SPFMDelivery = Template.bind({});
SPFMDelivery.args = {
  routeData: {
    displayDate: 'Wed, Jan 17',
    date: '2024-01-17',
    market: 'Westside Market',
    startTime: '10:00 AM',
    type: 'spfm-delivery',
    workers: ['Irmydel', 'Rosey'],
    volunteers: ['Volunteer'],
    vans: ['Delivery Truck']
  },
  routeId: 'delivery_1'
};

export const NoWorkersAssigned = Template.bind({});
NoWorkersAssigned.args = {
  routeData: {
    displayDate: 'Thu, Jan 18',
    date: '2024-01-18',
    market: 'Downtown Market',
    startTime: 'TBD',
    type: 'spfm',
    workers: [],
    volunteers: [],
    vans: []
  },
  routeId: 'empty_1'
};
