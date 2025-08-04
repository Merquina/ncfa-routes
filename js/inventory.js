/* ========================================
   SPFM Routes - Inventory Management
   Fixed syntax error - ready for deployment
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
    if (!inventoryContainer) {
      console.error("❌ Inventory container not found");
      return;
    }

    // Check if sheetsAPI exists and is properly initialized
    if (!sheetsAPI) {
      inventoryContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666;">
          <h3>📦 Box Inventory</h3>
          <p>Loading system...</p>
        </div>
      `;
      return;
    }

    try {
      this.renderInventoryContent(inventoryContainer);
    } catch (error) {
      console.error("❌ Error rendering inventory:", error);
      inventoryContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666;">
          <h3>📦 Box Inventory</h3>
          <p>❌ Error loading inventory data.<br>Please try refreshing.</p>
          <button class="directions-btn" onclick="refreshData()">🔄 Refresh</button>
        </div>
      `;
    }
  }

  // ========================================
  // INVENTORY CONTENT RENDERING
  // ========================================
  renderInventoryContent(inventoryContainer) {
    console.log("🔍 Debug: renderInventoryContent called");
    console.log("🔍 Debug: sheetsAPI.isLoading =", sheetsAPI.isLoading);
    console.log("🔍 Debug: sheetsAPI.inventoryData =", sheetsAPI.inventoryData);

    // Check if data is still loading
    if (sheetsAPI.isLoading) {
      console.log("🔍 Debug: Still loading, showing loading message");
      inventoryContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666;">
          <h3>📦 Box Inventory</h3>
          <p>🔄 Loading inventory data...</p>
        </div>
      `;
      return;
    }

    // Check if inventoryData exists and has data
    if (!sheetsAPI.inventoryData || sheetsAPI.inventoryData.length === 0) {
      console.log("🔍 Debug: No inventory data, rendering calculator anyway");
      inventoryContainer.innerHTML = `
        <div style="margin-bottom: 30px; padding: 15px; background: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h4>📦 Box Inventory</h4>
          <div style="text-align: center; padding: 20px; color: #666;">
            <p>No inventory data available</p>
          </div>
        </div>

        <!-- Section 2: Box Calculator -->
        <div style="padding: 15px; background: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <h3>🧮 Box Calculator</h3>
          <div style="display: grid; gap: 15px; margin-top: 15px;">
            <div>
              <label style="display: block; margin-bottom: 5px; font-weight: bold;">How many farmers:</label>
              <input type="number" id="farmersInput" min="1" value="1" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            <div>
              <label style="display: block; margin-bottom: 5px; font-weight: bold;">How many small boxes:</label>
              <input type="number" id="smallBoxesInput" min="0" value="0" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            <div>
              <label style="display: block; margin-bottom: 5px; font-weight: bold;">How many large boxes:</label>
              <input type="number" id="largeBoxesInput" min="0" value="0" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
            </div>
            <button class="directions-btn" onclick="inventoryManager.calculateDistribution()" style="margin-top: 10px;">Calculate Distribution</button>
            <div id="calculationResult" style="padding: 15px; background: #e8f5e8; border-radius: 4px; margin-top: 10px; display: none;">
              <h4>Give to each farmer:</h4>
              <div id="distributionText"></div>
            </div>
          </div>
        </div>
      `;
      this.setupCalculatorListeners();
      return;
    }

    // Find box inventory items with safety checks
    const boxItems = sheetsAPI.inventoryData.filter((item) => {
      if (!item || typeof item !== "object") return false;
      const values = Object.values(item);
      const firstColumn = values[0];
      return (
        firstColumn &&
        typeof firstColumn === "string" &&
        (firstColumn.includes("Large") || firstColumn.includes("Small"))
      );
    });

    // Find verification date with safety checks
    const verifiedItem = sheetsAPI.inventoryData.find((item) => {
      if (!item || typeof item !== "object") return false;
      const values = Object.values(item);
      const firstColumn = values[0];
      return (
        firstColumn &&
        typeof firstColumn === "string" &&
        firstColumn.includes("Verified on")
      );
    });

    const boxesHtml = boxItems
      .map((item) => {
        try {
          const values = Object.values(item);
          const boxType = values[0] || "Unknown";
          const quantity = values[1] || "0";
          return `
            <div class="inventory-item">
              <div class="inventory-count">${quantity}</div>
              <div class="inventory-label">${boxType}</div>
            </div>
          `;
        } catch (error) {
          console.error("Error processing inventory item:", item, error);
          return "";
        }
      })
      .join("");

    const verificationHtml = verifiedItem
      ? `
        <div class="inventory-item">
          <div class="inventory-count">📅</div>
          <div class="inventory-label">Last Updated<br>${Object.values(verifiedItem)[1] || "Unknown"}</div>
        </div>
      `
      : "";

    inventoryContainer.innerHTML = `
      <!-- Section 1: Box Inventory -->
      <div style="margin-bottom: 30px; padding: 15px; background: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h4>📦 Box Inventory</h4>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-top: 10px;">
          ${this.renderQuickStats(boxItems)}
        </div>
      </div>

      <!-- Section 2: Box Calculator -->
      <div style="padding: 15px; background: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
        <h3>🧮 Box Calculator</h3>
        <div style="display: grid; gap: 15px; margin-top: 15px;">
          <div>
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">How many farmers:</label>
            <input type="number" id="farmersInput" min="1" value="1" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">How many small boxes:</label>
            <input type="number" id="smallBoxesInput" min="0" value="0" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <div>
            <label style="display: block; margin-bottom: 5px; font-weight: bold;">How many large boxes:</label>
            <input type="number" id="largeBoxesInput" min="0" value="0" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
          </div>
          <button class="directions-btn" onclick="inventoryManager.calculateDistribution()" style="margin-top: 10px;">Calculate Distribution</button>
          <div id="calculationResult" style="padding: 15px; background: #e8f5e8; border-radius: 4px; margin-top: 10px; display: none;">
            <h4>Give to each farmer:</h4>
            <div id="distributionText"></div>
          </div>
        </div>
      </div>
    `;

    console.log(
      "🔍 Debug: Full inventory rendered, setting up calculator listeners",
    );
    this.setupCalculatorListeners();
  }

  // ========================================
  // HELPER METHODS
  // ========================================
  renderQuickStats(boxItems) {
    try {
      const totalBoxes = boxItems.reduce((sum, item) => {
        const values = Object.values(item);
        const quantity = parseInt(values[1]) || 0;
        return sum + quantity;
      }, 0);

      const largeBoxes = boxItems
        .filter((item) => {
          const values = Object.values(item);
          return values[0] && values[0].includes("Large");
        })
        .reduce((sum, item) => {
          const values = Object.values(item);
          return sum + (parseInt(values[1]) || 0);
        }, 0);

      const smallBoxes = boxItems
        .filter((item) => Object.values(item)[0].includes("Small"))
        .reduce(
          (sum, item) => sum + (parseInt(Object.values(item)[1]) || 0),
          0,
        );

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
    } catch (error) {
      console.error("Error in renderQuickStats:", error);
      return "<div>Error loading stats</div>";
    }
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

  // ========================================
  // BOX CALCULATOR
  // ========================================
  calculateDistribution() {
    const farmers =
      parseInt(document.getElementById("farmersInput")?.value) || 1;
    const smallBoxes =
      parseInt(document.getElementById("smallBoxesInput")?.value) || 0;
    const largeBoxes =
      parseInt(document.getElementById("largeBoxesInput")?.value) || 0;

    const smallPerFarmer = Math.floor(smallBoxes / farmers);
    const largePerFarmer = Math.floor(largeBoxes / farmers);

    const resultDiv = document.getElementById("calculationResult");
    const distributionText = document.getElementById("distributionText");

    if (resultDiv && distributionText) {
      distributionText.innerHTML = `
        <strong>Small: ${smallPerFarmer}</strong> | <strong>Large: ${largePerFarmer}</strong>
        ${smallBoxes % farmers > 0 ? `<br><small>Remaining small boxes: ${smallBoxes % farmers}</small>` : ""}
        ${largeBoxes % farmers > 0 ? `<br><small>Remaining large boxes: ${largeBoxes % farmers}</small>` : ""}
      `;
      resultDiv.style.display = "block";
    }
  }

  addBoxes() {
    alert("Add boxes feature coming soon!");
  }

  removeBoxes() {
    alert("Remove boxes feature coming soon!");
  }

  // ========================================
  // CALCULATOR SETUP
  // ========================================
  setupCalculatorListeners() {
    setTimeout(() => {
      console.log("🔍 Debug: Setting up calculator listeners");
      const inputs = ["farmersInput", "smallBoxesInput", "largeBoxesInput"];
      inputs.forEach((id) => {
        const input = document.getElementById(id);
        console.log(`🔍 Debug: Setting up listener for ${id}:`, input);
        if (input) {
          input.addEventListener("input", () => this.calculateDistribution());
        }
      });
    }, 100);
  }
}

// Export instance with error handling
console.log("🔍 Creating inventoryManager...");
let inventoryManager;
try {
  inventoryManager = new InventoryManager();
  console.log("✅ inventoryManager created successfully");

  // Make it globally available
  window.inventoryManager = inventoryManager;
  console.log("✅ inventoryManager attached to window");
} catch (error) {
  console.error("❌ Error creating inventoryManager:", error);
  console.error("Error stack:", error.stack);
}

// Confirm this file loaded
console.log("✅ inventory.js loaded");
window.inventoryManagerLoaded = true;

// Verify it's accessible
setTimeout(() => {
  if (window.inventoryManager) {
    console.log("✅ inventoryManager confirmed accessible on window");
  } else {
    console.error("❌ inventoryManager NOT accessible on window");
  }
}, 10);
