import './assignment-card.js';

export default {
  title: 'Components/Assignment Card',
  component: 'assignment-card',
  argTypes: {
    assignmentData: { control: 'object' },
    routeId: { control: 'text' }
  },
};

const Template = (args) => {
  const element = document.createElement('assignment-card');
  
  if (args.assignmentData) {
    element.setAssignment(args.assignmentData, args.routeId);
  }

  // Listen for assignment selection events
  element.addEventListener('assignment-selected', (e) => {
    console.log('Assignment selected:', e.detail);
  });

  return element;
};

export const SPFMRoute = Template.bind({});
SPFMRoute.args = {
  assignmentData: {
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
  assignmentData: {
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
  assignmentData: {
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
  assignmentData: {
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