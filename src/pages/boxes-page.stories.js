import '../components/index.js';

export default {
  title: 'Pages/Boxes',
  component: 'boxes-page'
};

export const Default = () => {
  class MockService extends EventTarget {
    getBoxConfig() {
      return {
        small: { label: 'small', description: '5/9 bushel', farmersRatio: 2 },
        large: { label: 'LARGE', description: '1 1/9 bushel', farmersRatio: 1 }
      };
    }
    async getInventory() {
      return { smallBoxes: 12, largeBoxes: 7, lastUpdated: 'Today 10:00', updatedBy: 'Storybook' };
    }
    async updateInventory(s, l, by) {
      const detail = { smallBoxes: s, largeBoxes: l, lastUpdated: new Date().toLocaleString(), updatedBy: by };
      this.dispatchEvent(new CustomEvent('inventory-updated', { detail }));
      return detail;
    }
  }
  window.dataService = new MockService();

  const el = document.createElement('boxes-page');
  return el;
};

