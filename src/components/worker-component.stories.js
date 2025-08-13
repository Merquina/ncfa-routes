import './worker-component.js';

export default {
  title: 'Components/Worker Component',
  component: 'worker-component',
  argTypes: {
    workers: { control: 'object' },
    selectedWorker: { control: 'text' },
    workerIcons: { control: 'object' },
    defaultIcon: { control: 'text' }
  },
};

const Template = (args) => {
  const element = document.createElement('worker-component');
  
  if (args.workers) {
    element.setWorkers(args.workers);
  }
  if (args.selectedWorker) {
    element.setAttribute('selected-worker', args.selectedWorker);
  }
  if (args.workerIcons) {
    element.setWorkerIcons(args.workerIcons);
  }
  if (args.defaultIcon) {
    element.setDefaultIcon(args.defaultIcon);
  }

  // Listen for worker selection events
  element.addEventListener('worker-selected', (e) => {
    console.log('Worker selected:', e.detail.worker);
  });

  return element;
};

export const Default = Template.bind({});
Default.args = {
  workers: ['Samuel', 'Emmanuel', 'Irmydel', 'Tess', 'Ayoyo', 'Rosey', 'Boniat', 'Volunteer'],
  workerIcons: {
    Samuel: "🐋",
    Emmanuel: "🦁", 
    Irmydel: "🐸",
    Tess: "🌟",
    Ayoyo: "⚡",
    Rosey: "🌹",
    Boniat: "🌊",
    Volunteer: "👤",
  },
  defaultIcon: "👤"
};

export const WithSelection = Template.bind({});
WithSelection.args = {
  workers: ['Samuel', 'Emmanuel', 'Irmydel', 'Tess', 'Ayoyo', 'Rosey', 'Boniat', 'Volunteer'],
  selectedWorker: 'Samuel',
  workerIcons: {
    Samuel: "🐋",
    Emmanuel: "🦁", 
    Irmydel: "🐸",
    Tess: "🌟",
    Ayoyo: "⚡",
    Rosey: "🌹",
    Boniat: "🌊",
    Volunteer: "👤",
  }
};

export const CustomIcons = Template.bind({});
CustomIcons.args = {
  workers: ['Alice', 'Bob', 'Charlie'],
  workerIcons: {
    Alice: "🦄",
    Bob: "🚀",
    Charlie: "🎨"
  },
  defaultIcon: "🤖"
};

export const FewWorkers = Template.bind({});
FewWorkers.args = {
  workers: ['Samuel', 'Emmanuel', 'Volunteer'],
  workerIcons: {
    Samuel: "🐋",
    Emmanuel: "🦁"
  },
  defaultIcon: "👥"
};

export const EmptyWorkers = Template.bind({});
EmptyWorkers.args = {
  workers: []
};