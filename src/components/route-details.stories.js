import './route-details.js';

export default {
  title: 'Components/Route Details',
  component: 'route-details',
  argTypes: {
    route: { control: 'object' }
  }
};

const Template = (args) => {
  const el = document.createElement('route-details');
  if (args.route) el.setRoute(args.route);
  return el;
};

export const SPFM = Template.bind({});
SPFM.args = {
  route: {
    type: 'spfm',
    market: 'Downtown Farmers Market',
    date: '2024-08-15',
    startTime: '7:00 AM',
    workers: ['Samuel', 'Tess'],
    volunteers: ['Volunteer'],
    vans: ['Van 1'],
    stops: [
      { location: 'Green Valley Farm', address: '123 Farm Rd, City' },
      { location: 'Sunrise Co-op', address: '456 Market St, City' }
    ]
  }
};

export const Recovery = Template.bind({});
Recovery.args = {
  route: {
    type: 'recovery',
    route: 'Tuesday Recovery',
    date: '2024-08-13',
    startTime: '10:00 AM',
    workers: ['Emmanuel'],
    volunteers: [],
    vans: ['Van 2'],
    stops: [
      { location: 'Trader Joe\'s', address: '789 Store Ave, City' }
    ]
  }
};

