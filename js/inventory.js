/* ========================================
   SPFM Routes - Inventory Management
   ======================================== */

class InventoryManager {
  constructor() {
    this.inventoryData = [];
  }

  // ========================================
  // INVENTORY RENDERING
  // ========================================
  renderInventory() {
    const inventoryContainer = document.getElementById("inventoryContainer");
    if (!inventoryContainer) return;

    if (sheetsAPI.inventoryData.length === 0) {
      inventoryContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666;">
          <h3>📦 Box Inventory</h3>
          <p>No inventory data available.<br>Make sure your spreadsheet has an "Inventory" tab.</p>
        </div>
      `;
      return;
    }

    // Find box inventory items
    const boxItems = sheetsAPI.inventoryData.filter((item) => {
      const firstColumn = Object.values(item)[0];
      return (
        firstColumn &&
        (firstColumn.includes("Large") || firstColumn.includes("Small"))
      );
    });

    // Find verification date
    const verifiedItem = sheetsAPI.inventoryData.find((item) => {
      const firstColumn = Object.values(item)[0];
      return firstColumn && firstColumn.includes("Verified on");
    });

    const boxesHtml = boxItems
      .map((item) => {
        const values = Object.values(item);
        const boxType = values[0] || "Unknown";
        const quantity = values[1] || "0";
        return `
          <div class="inventory-item">
            <div class="inventory-count">${quantity}</div>
            <div class="inventory-label">${boxType}</div>
          </div>
        `;
      })
      .join("");

    const verificationHtml = verifiedItem
      ? `
        <div class="inventory-item">
          <div class="inventory-count">📅</div>
          <div class="inventory-label">Last Updated<br>${Object.values(verifiedItem)[1]}</div>
        </div>
      `
      : "";

    inventoryContainer.innerHTML = `
      <div class="inventory-grid">
        ${boxesHtml}
        ${verificationHtml}
      </div>
      <div style="text-align: center; margin-top: 20px;">
        <button class="directions-btn" onclick="refreshData()">🔄 Refresh Inventory</button>
      </div>
      <div style="text-align: center; margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
        <h4>📊 Quick Stats</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-top: 10px;">
          ${this.renderQuickStats(boxItems)}
        </div>
      </div>
    `;
  }

  // ========================================
  // HELPER METHODS
  // ========================================
  renderQuickStats(boxItems) {
    const totalBoxes = boxItems.reduce((sum, item) => {
      const quantity = parseInt(Object.values(item)[1]) || 0;
      return sum + quantity;
    }, 0);

    const largeBoxes = boxItems
      .filter(item => Object.values(item)[0].includes("Large"))
      .reduce((sum, item) => sum + (parseInt(Object.values(item)[1]) || 0), 0);

    const smallBoxes = boxItems
      .filter(item => Object.values(item)[0].includes("Small"))
      .reduce((sum, item) => sum + (parseInt(Object.values(item)[1]) || 0), 0);

    return `
      <div style="text-align: center;">
        <div style="font-size: 1.5rem; font-weight: bold; color: #007bff;">${totalBoxes}</div>
        <div style="font-size: 0.8rem; color: #666;">Total Boxes</div>
      </div>
      <div style="text-align: center;">
        <div style="font-size: 1.5rem; font-weight: bold; color: #28a745;">${largeBoxes}</div>
        <div style="font-size: 0.8rem; color: #666;">Large Boxes</div>
      </div>
      <div style="text-align: center;">
        <div style="font-size: 1.5rem; font-weight: bold; color: #ffc107;">${smallBoxes}</div>
        <div style="font-size: 0.8rem; color: #666;">Small Boxes</div>
      </div>
    `;
  }

  // ========================================
  // INVENTORY UPDATES (FUTURE FEATURE)
  // ========================================
  updateInventoryCount(itemType, newCount) {
    // Placeholder for future inventory update functionality
    console.log(`Update ${itemType} to ${newCount}`);
  }

  addInventoryItem(itemType, count) {
    // Placeholder for future add inventory functionality
    console.log(`Add ${count} ${itemType}`);
  }

  removeInventoryItem(itemType, count) {
    // Placeholder for future remove inventory functionality
    console.log(`Remove ${count} ${itemType}`);
  }
}

// Export instance
const inventoryManager = new InventoryManager();

// Confirm this file loaded
console.log("✅ inventory.js loaded");
window.inventoryManagerLoaded = true;
