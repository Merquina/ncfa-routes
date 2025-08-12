/* ========================================
   SPFM Routes - Inventory Management
   With Google Sheets Integration + localStorage Fallback
   ======================================== */

class InventoryManager {
  constructor() {
    this.inventoryData = [];
    this.isLoadingFromSheets = false;
    this.loadLocalInventory();
  }

  // ========================================
  // INVENTORY RENDERING
  // ========================================
  async renderInventory() {
    const inventoryContainer = document.getElementById("inventoryContainer");
    if (!inventoryContainer) {
      console.error("❌ Inventory container not found");
      return;
    }

    try {
      // Try to load from Google Sheets first, fall back to localStorage
      await this.loadInventoryFromSheets();

      this.renderInventoryContent(inventoryContainer);

      // Scroll to the top of inventory container
      setTimeout(() => {
        if (inventoryContainer) {
          inventoryContainer.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      }, 100);
    } catch (error) {
      console.error("❌ Error rendering inventory:", error);
      inventoryContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666;">
          <h3>📦 Box Inventory</h3>
          <p>❌ Error loading inventory data.</p>
        </div>
      `;
    }
  }

  // ========================================
  // INVENTORY CONTENT RENDERING
  // ========================================
  renderInventoryContent(inventoryContainer) {
    console.log(
      "🔍 Debug: renderInventoryContent called - Google Sheets + localStorage",
    );

    // Refresh timestamp format for existing data
    this.refreshTimestampFormat();

    const inventory = this.getLocalInventory();

    const cacheBreaker = Date.now();
    inventoryContainer.innerHTML = `
      <!-- Section 1: Box Inventory (${cacheBreaker}) -->
      <div style="margin-bottom: 10px; margin-top: 2px; padding: 10px; background: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); width: 100%; max-width: 100vw; box-sizing: border-box;">
        <h4>📦 Box Inventory</h4>
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 5px;">
          <div style="text-align: center; padding: 8px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 8px;">
            <div style="font-size: 1.2rem; font-weight: bold; color: #333; line-height: 1; margin-bottom: 2px;">${inventory.smallBoxes}</div>
            <div style="font-size: 0.75rem; color: #666; line-height: 1; margin-bottom: 1px;">small</div>
            <div style="font-size: 0.6rem; color: #999; line-height: 1;">5/9 bushel</div>
          </div>
          <div style="text-align: center; padding: 8px; background: #f8f9fa; border: 1px solid #ddd; border-radius: 8px;">
            <div style="font-size: 1.2rem; font-weight: bold; color: #333; line-height: 1; margin-bottom: 2px;">${inventory.largeBoxes}</div>
            <div style="font-size: 0.75rem; color: #666; line-height: 1; margin-bottom: 1px;">LARGE</div>
            <div style="font-size: 0.6rem; color: #999; line-height: 1;">1 1/9 bushel</div>
          </div>
        </div>
        ${
          inventory.lastUpdated
            ? `
          <div style="text-align: center; margin-top: 5px; color: #666; font-size: 0.7rem; line-height: 1;">
            Last updated by ${inventory.updatedBy} at ${inventory.lastUpdated}
          </div>
        `
            : `
          <div style="text-align: center; margin-top: 5px; color: #666; font-size: 0.7rem; line-height: 1;">
            No updates yet
          </div>
        `
        }
      </div>

      <!-- Section 2: Box Calculator (${cacheBreaker}) -->
      <div style="margin-bottom: 10px; margin-top: 2px; padding: 10px; background: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); width: 100%; max-width: 100vw; box-sizing: border-box;">
        <h4>🧮 Box Calculator</h4>
        <div style="display: grid; gap: 8px; margin-top: 5px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <label style="line-height: 1; flex: 1; font-size: 0.9rem;">How many farmers:</label>
            <input type="number" id="farmersInput" min="1" value="1" inputmode="numeric" onfocus="this.select()" style="width: 60px; height: 40px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; text-align: center; font-size: 1.0rem;">
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <label style="line-height: 1; flex: 1; font-size: 0.9rem;">How many small boxes:</label>
            <input type="number" id="smallBoxesInput" min="0" value="0" inputmode="numeric" onfocus="this.select()" style="width: 60px; height: 40px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; text-align: center; font-size: 1.0rem;">
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <label style="line-height: 1; flex: 1; font-size: 0.9rem;">How many LARGE boxes:</label>
            <input type="number" id="largeBoxesInput" min="0" value="0" inputmode="numeric" onfocus="this.select()" style="width: 60px; height: 40px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; text-align: center; font-size: 1.0rem;">
          </div>
          <div id="calculationResult" style="padding: 2px; background: #e8f5e8; border-radius: 4px; margin-top: 2px; display: none;">
            <h4 style="margin: 2px 0; font-size: 0.9rem;">Give to each farmer:</h4>
            <div id="distributionText" style="margin: 2px 0;"></div>
          </div>
        </div>
      </div>

      <!-- Section 3: Update Inventory (${cacheBreaker}) -->
      <div style="margin-top: 2px; padding: 10px; background: #fff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); width: 100%; max-width: 100vw; box-sizing: border-box;">
        <h4>📝 Update Inventory</h4>
        <div style="display: grid; gap: 8px; margin-top: 5px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <label style="line-height: 1; flex: 1; font-size: 0.85rem; font-weight: normal;">small boxes:</label>
            <input type="number" id="updateSmallBoxes" min="0" value="${inventory.smallBoxes}" inputmode="numeric" onfocus="this.select()" style="width: 60px; height: 40px; padding: 6px; border: 1px solid #ddd; border-radius: 4px; text-align: center; font-size: 1.0rem;">
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <label style="line-height: 1; flex: 1; font-size: 0.85rem; font-weight: normal;">LARGE boxes:</label>
            <input type="number" id="updateLargeBoxes" min="0" value="${inventory.largeBoxes}" inputmode="numeric" onfocus="this.select()" style="width: 60px; height: 40px; padding: 6px; border: 1px solid #ddd; border-radius: 4px; text-align: center; font-size: 1.0rem;">
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <label style="line-height: 1; flex: 1; font-size: 0.85rem; font-weight: normal;">Your name:</label>
            <input type="text" id="updateName" placeholder="Enter your name" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.9rem;">
          </div>
          <button class="directions-btn" onclick="inventoryManager.updateInventory()" style="margin-top: 5px; background: #007bff; font-size: 0.9rem;">📊 Update & Share Inventory</button>
        </div>
      </div>
    `;

    console.log(
      "🔍 Debug: Google Sheets inventory rendered, setting up listeners",
    );
    this.setupCalculatorListeners();
  }

  // ========================================
  // GOOGLE SHEETS INTEGRATION
  // ========================================
  async loadInventoryFromSheets() {
    if (this.isLoadingFromSheets) return;
    this.isLoadingFromSheets = true;

    try {
      console.log("📦 Attempting to load inventory from Google Apps Script...");

      // Google Apps Script endpoint for secure API calls
      const APPS_SCRIPT_URL =
        "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec";

      const response = await fetch(`${APPS_SCRIPT_URL}?action=getInventory`, {
        method: "GET",
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          const sheetsInventory = {
            smallBoxes: parseInt(result.data.smallBoxes) || 0,
            largeBoxes: parseInt(result.data.largeBoxes) || 0,
            lastUpdated: result.data.lastUpdated || "Unknown",
            updatedBy: result.data.updatedBy || "Unknown",
          };

          // Update localStorage with sheets data
          this.saveLocalInventory(sheetsInventory);
          console.log(
            "✅ Loaded inventory from Google Apps Script:",
            sheetsInventory,
          );
          return sheetsInventory;
        }
      }

      console.log("📱 No inventory data from Apps Script, using localStorage");
    } catch (error) {
      console.log(
        "📱 Failed to load from Google Apps Script, using localStorage:",
        error,
      );
    } finally {
      this.isLoadingFromSheets = false;
    }

    return this.getLocalInventory();
  }

  async saveInventoryToSheets(inventory) {
    // Google Apps Script endpoint for secure API calls
    const APPS_SCRIPT_URL =
      "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec";
    const timestamp = new Date().toISOString();

    const payload = {
      action: "updateInventory",
      smallBoxes: inventory.smallBoxes,
      largeBoxes: inventory.largeBoxes,
      lastUpdated: inventory.lastUpdated,
      updatedBy: inventory.updatedBy,
      timestamp: timestamp,
    };

    try {
      const response = await fetch(APPS_SCRIPT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log("✅ Inventory updated via Apps Script:", result);
      return result;
    } catch (error) {
      console.error("❌ Error updating inventory via Apps Script:", error);
      throw error;
    }
  }

  // ========================================
  // LOCAL STORAGE METHODS
  // ========================================
  loadLocalInventory() {
    const stored = localStorage.getItem("spfm_inventory");
    if (stored) {
      try {
        const inventory = JSON.parse(stored);
        console.log("✅ Loaded inventory from localStorage:", inventory);
        return inventory;
      } catch (error) {
        console.error("Error parsing stored inventory:", error);
      }
    }

    // Default inventory
    const defaultInventory = {
      smallBoxes: 0,
      largeBoxes: 0,
      lastUpdated: null,
      updatedBy: null,
    };

    this.saveLocalInventory(defaultInventory);
    return defaultInventory;
  }

  getLocalInventory() {
    return this.loadLocalInventory();
  }

  saveLocalInventory(inventory) {
    localStorage.setItem("spfm_inventory", JSON.stringify(inventory));
    console.log("✅ Saved inventory to localStorage:", inventory);
  }

  async updateInventory() {
    const smallBoxes =
      parseInt(document.getElementById("updateSmallBoxes")?.value) || 0;
    const largeBoxes =
      parseInt(document.getElementById("updateLargeBoxes")?.value) || 0;
    const name = document.getElementById("updateName")?.value?.trim();

    if (!name) {
      alert("Please enter your name");
      return;
    }

    const now = new Date();
    const timeString = now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const inventory = {
      smallBoxes: smallBoxes,
      largeBoxes: largeBoxes,
      lastUpdated: timeString,
      updatedBy: name,
    };

    // Always save locally first (backup)
    this.saveLocalInventory(inventory);

    // Try to save to Google Sheets
    try {
      await this.saveInventoryToSheets(inventory);
      console.log("✅ Inventory saved to Google Sheets");
      alert("✅ Inventory updated and shared with team!");
    } catch (error) {
      console.log("📱 Google Sheets save failed, saved locally only:", error);
      alert("✅ Inventory updated locally (Google Sheets sync failed)");
    }

    // Clear the name field
    const nameField = document.getElementById("updateName");
    if (nameField) nameField.value = "";

    // Refresh the display
    await this.renderInventory();

    console.log("✅ Inventory updated by", name);
  }

  // ========================================
  // INVENTORY UPDATES
  // ========================================
  updateInventoryCount(itemType, newCount) {
    const inventory = this.getLocalInventory();
    if (itemType === "small") {
      inventory.smallBoxes = newCount;
    } else if (itemType === "large") {
      inventory.largeBoxes = newCount;
    }
    this.saveLocalInventory(inventory);
    this.renderInventory();
  }

  async addInventoryItem(itemType, count) {
    const inventory = this.getLocalInventory();
    if (itemType === "small") {
      inventory.smallBoxes += count;
    } else if (itemType === "large") {
      inventory.largeBoxes += count;
    }
    this.saveLocalInventory(inventory);

    try {
      await this.saveInventoryToSheets(inventory);
    } catch (error) {
      console.log("Failed to sync addition to Google Sheets:", error);
    }

    await this.renderInventory();
  }

  async removeInventoryItem(itemType, count) {
    const inventory = this.getLocalInventory();
    if (itemType === "small") {
      inventory.smallBoxes = Math.max(0, inventory.smallBoxes - count);
    } else if (itemType === "large") {
      inventory.largeBoxes = Math.max(0, inventory.largeBoxes - count);
    }
    this.saveLocalInventory(inventory);

    try {
      await this.saveInventoryToSheets(inventory);
    } catch (error) {
      console.log("Failed to sync removal to Google Sheets:", error);
    }

    await this.renderInventory();
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
        <strong>small: ${smallPerFarmer}</strong> | <strong>LARGE: ${largePerFarmer}</strong>
        ${smallBoxes % farmers > 0 ? `<br><small>Remaining small boxes: ${smallBoxes % farmers}</small>` : ""}
        ${largeBoxes % farmers > 0 ? `<br><small>Remaining LARGE boxes: ${largeBoxes % farmers}</small>` : ""}
      `;
      resultDiv.style.display = "block";
    }
  }

  addBoxes() {
    const smallToAdd = parseInt(prompt("How many small boxes to add?") || "0");
    const largeToAdd = parseInt(prompt("How many large boxes to add?") || "0");
    const name = prompt("Your name:");

    if (!name) return;

    const inventory = this.getLocalInventory();
    inventory.smallBoxes += smallToAdd;
    inventory.largeBoxes += largeToAdd;

    const now = new Date();
    inventory.lastUpdated = now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    inventory.updatedBy = name;

    this.saveLocalInventory(inventory);
    this.renderInventory();
  }

  removeBoxes() {
    const smallToRemove = parseInt(
      prompt("How many small boxes to remove?") || "0",
    );
    const largeToRemove = parseInt(
      prompt("How many large boxes to remove?") || "0",
    );
    const name = prompt("Your name:");

    if (!name) return;

    const inventory = this.getLocalInventory();
    inventory.smallBoxes = Math.max(0, inventory.smallBoxes - smallToRemove);
    inventory.largeBoxes = Math.max(0, inventory.largeBoxes - largeToRemove);

    const now = new Date();
    inventory.lastUpdated = now.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    inventory.updatedBy = name;

    this.saveLocalInventory(inventory);
    this.renderInventory();
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

  // ========================================
  // REFRESH TIMESTAMP FORMAT
  // ========================================
  refreshTimestampFormat() {
    const inventory = this.getLocalInventory();
    if (inventory.lastUpdated && inventory.updatedBy) {
      // Regenerate timestamp with new format
      const now = new Date();
      inventory.lastUpdated = now.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      this.saveLocalInventory(inventory);
      console.log("✅ Refreshed timestamp format");
    }
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
