import './inventory-component.js';

export default {
  title: 'Components/Inventory Component',
  component: 'inventory-component',
  argTypes: {
    smallBoxes: { control: 'number', defaultValue: 50 },
    largeBoxes: { control: 'number', defaultValue: 25 },
    lastUpdated: { control: 'text' },
    updatedBy: { control: 'text' },
    boxConfig: { control: 'object' }
  },
};

const Template = (args) => {
  const element = document.createElement('inventory-component');
  
  if (args.smallBoxes !== undefined) {
    element.setAttribute('small-boxes', args.smallBoxes);
  }
  if (args.largeBoxes !== undefined) {
    element.setAttribute('large-boxes', args.largeBoxes);
  }
  if (args.lastUpdated) {
    element.setAttribute('last-updated', args.lastUpdated);
  }
  if (args.updatedBy) {
    element.setAttribute('updated-by', args.updatedBy);
  }
  if (args.boxConfig) {
    element.setBoxConfig(args.boxConfig);
  }

  return element;
};

export const Default = Template.bind({});
Default.args = {
  smallBoxes: 50,
  largeBoxes: 25,
  lastUpdated: '12/31/2024, 10:30:00 AM',
  updatedBy: 'John Doe'
};

export const EmptyInventory = Template.bind({});
EmptyInventory.args = {
  smallBoxes: 0,
  largeBoxes: 0
};

export const LowStock = Template.bind({});
LowStock.args = {
  smallBoxes: 3,
  largeBoxes: 1,
  lastUpdated: '12/31/2024, 9:15:00 AM',
  updatedBy: 'Admin'
};

export const CustomBoxTypes = Template.bind({});
CustomBoxTypes.args = {
  smallBoxes: 15,
  largeBoxes: 8,
  lastUpdated: '12/31/2024, 11:00:00 AM',
  updatedBy: 'Manager',
  boxConfig: {
    small: {
      label: 'MEDIUM',
      description: '3/4 bushel',
      farmersRatio: 3
    },
    large: {
      label: 'JUMBO',
      description: '2 bushel',
      farmersRatio: 1
    }
  }
};