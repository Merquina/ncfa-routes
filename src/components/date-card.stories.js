import './date-card.js';

export default {
  title: 'Components/Date Card',
  component: 'date-card',
  argTypes: {
    dateData: { control: 'object' },
    variant: { 
      control: { type: 'select' },
      options: ['default', 'compact']
    }
  },
};

const Template = (args) => {
  const element = document.createElement('date-card');
  
  if (args.dateData) {
    element.setDate(args.dateData);
  }
  if (args.variant) {
    element.setAttribute('variant', args.variant);
  }

  // Listen for date selection events
  element.addEventListener('date-selected', (e) => {
    console.log('Date selected:', e.detail);
  });

  return element;
};

export const UpcomingDate = Template.bind({});
UpcomingDate.args = {
  dateData: {
    date: '2024-12-31',
    market: 'Downtown Farmers Market',
    routes: [
      { worker: 'Samuel', route: 'Route A' },
      { worker: 'Emmanuel', route: 'Route B' },
      { worker: 'Tess', route: 'Recovery Route' }
    ]
  },
  variant: 'default'
};

export const PastDate = Template.bind({});
PastDate.args = {
  dateData: {
    date: '2024-01-15',
    market: 'Westside Market',
    routes: [
      { worker: 'Irmydel', route: 'Route A' },
      { worker: 'Volunteer', route: 'Route B' }
    ]
  },
  variant: 'default'
};

export const CompactVariant = Template.bind({});
CompactVariant.args = {
  dateData: {
    date: '2024-12-25',
    market: 'Holiday Market',
    routes: [
      { worker: 'Samuel', route: 'Special Route' }
    ]
  },
  variant: 'compact'
};

export const NoRoutes = Template.bind({});
NoRoutes.args = {
  dateData: {
    date: '2024-12-20',
    market: 'Community Market',
    routes: []
  },
  variant: 'default'
};