import './route-card.js';

export default {
  title: 'Components/Route Card',
  component: 'route-card',
  argTypes: {
    routeData: { control: 'object' },
    variant: { 
      control: { type: 'select' },
      options: ['default', 'compact', 'minimal']
    },
    clickable: { control: 'boolean' }
  },
};

const Template = (args) => {
  const element = document.createElement('route-card');
  
  if (args.routeData) {
    element.setRoute(args.routeData);
  }
  if (args.variant) {
    element.setAttribute('variant', args.variant);
  }
  if (args.clickable !== undefined) {
    element.setAttribute('clickable', args.clickable);
  }

  // Listen for route selection events
  element.addEventListener('route-selected', (e) => {
    console.log('Route selected:', e.detail.route);
  });

  return element;
};

export const Default = Template.bind({});
Default.args = {
  routeData: {
    worker: 'Samuel',
    date: '2024-01-15',
    market: 'Downtown Farmers Market',
    route: 'Route A',
    vehicle: 'Truck #1',
    stops: [
      'Green Valley Farm',
      'Sunrise Organic Farm',
      'Mountain View Produce',
      'Heritage Vegetables'
    ]
  },
  variant: 'default',
  clickable: true
};

export const Compact = Template.bind({});
Compact.args = {
  routeData: {
    worker: 'Emmanuel',
    date: '2024-01-16',
    market: 'Westside Market',
    route: 'Route B',
    stops: ['River Valley Farm', 'Golden Harvest Co-op']
  },
  variant: 'compact',
  clickable: true
};

export const Minimal = Template.bind({});
Minimal.args = {
  routeData: {
    worker: 'Tess',
    date: '2024-01-17',
    route: 'Recovery Route'
  },
  variant: 'minimal',
  clickable: false
};