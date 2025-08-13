// Don't import custom element - test without custom elements

export default {
  title: 'Components/No Custom Elements Test',
};

export const PlainDiv = () => {
  const div = document.createElement('div');
  div.innerHTML = `
    <div style="border: 1px solid #ccc; padding: 16px; border-radius: 8px; font-family: Arial, sans-serif;">
      <h3 style="margin: 0 0 16px 0; color: #333;">Plain HTML Routes</h3>
      <div style="margin-bottom: 8px; padding: 8px; background: #f8f9fa; border-radius: 4px;">
        <strong>Route 1:</strong> Samuel - Downtown Market - Jan 15
      </div>
      <div style="margin-bottom: 8px; padding: 8px; background: #f8f9fa; border-radius: 4px;">
        <strong>Route 2:</strong> Emmanuel - Westside Market - Jan 16
      </div>
    </div>
  `;
  return div;
};

export const TestBasicDOM = () => {
  try {
    const div = document.createElement('div');
    div.textContent = 'Basic DOM creation works!';
    div.style.cssText = 'padding: 20px; background: #e8f5e8; border: 1px solid #4caf50; border-radius: 4px;';
    return div;
  } catch (error) {
    const errorDiv = document.createElement('div');
    errorDiv.textContent = 'Error: ' + error.message;
    errorDiv.style.cssText = 'padding: 20px; background: #ffebee; border: 1px solid #f44336; border-radius: 4px;';
    return errorDiv;
  }
};