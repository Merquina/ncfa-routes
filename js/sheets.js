/* ========================================
   SPFM Routes - Google Sheets Integration
   ======================================== */

class SheetsAPI {
  constructor() {
    this.data = [];
    this.recoveryData = [];
    this.deliveryData = [];
    this.inventoryData = [];
    this.contactsData = [];
    this.isLoading = false;
  }

  // ========================================
  // MAIN DATA FETCHING
  // ========================================
  async fetchSheetData() {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      // Add timestamp to prevent browser caching old data
      const timestamp = new Date().getTime();
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/SPFM!A:T?key=${API_KEY}&_=${timestamp}`;
      console.log("Fetching fresh data from Google Sheets...");

      // Make the API call with retry for 429 errors
      const response = await this.fetchWithRetry(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log("✅ Raw data received from Google");

      if (!result.values || result.values.length < 2) {
        throw new Error("No data found in the spreadsheet");
      }

      // Convert spreadsheet rows into JavaScript objects for easier use
      const headers = result.values[0]; // First row contains column names
      this.data = result.values
        .slice(1) // Skip the header row
        .filter((row) => row && row.length > 0 && row[0]) // Remove empty rows
        .map((row) => {
          // Create an object for each row using headers as keys
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] || ""; // Use empty string if cell is blank
          });
          return obj;
        });

      console.log(`✅ Processed ${this.data.length} routes from spreadsheet`);
      console.log("Sample route data:", this.data[0]);
      console.log("Available columns:", headers);

      // Also fetch recovery routes, box inventory, and contacts data
      await Promise.all([
        this.fetchRecoveryData(),
        this.fetchDeliveryData(),
        this.fetchInventoryData(),
        this.fetchContactsData(),
      ]);

      return this.data;
    } catch (error) {
      console.error("❌ Error loading spreadsheet data:", error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  // ========================================
  // RECOVERY ROUTES DATA
  // ========================================
  async fetchRecoveryData() {
    try {
      // Try to fetch recovery routes from the "Recovery" sheet tab
      const recoveryRange = "Recovery!A:P";
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${recoveryRange}?key=${API_KEY}`;
      console.log("🚗 Attempting to fetch recovery routes...");

      const response = await this.fetchWithRetry(url);
      if (!response.ok) {
        console.log("Recovery tab not found - skipping recovery routes");
        return;
      }

      const result = await response.json();

      if (!result.values || result.values.length < 2) {
        console.log("Recovery tab is empty - skipping recovery routes");
        return;
      }

      // Convert recovery rows to JavaScript objects
      const headers = result.values[0];
      this.recoveryData = result.values.slice(1).map((row) => {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] || "";
        });
        return obj;
      });

      console.log(`✅ Loaded ${this.recoveryData.length} recovery routes`);
      console.log("🔍 Debug: Sample recovery route:", this.recoveryData[0]);
    } catch (error) {
      console.log("Recovery data not available (this is optional):", error);
    }
  }

  // ========================================
  // SPFM DELIVERY DATA
  // ========================================
  async fetchDeliveryData() {
    try {
      // Try to fetch SPFM delivery routes from the "SPFM Delivery" sheet tab
      const deliveryRange = "SPFM Delivery!A:P";
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${deliveryRange}?key=${API_KEY}`;
      console.log("🚚 Attempting to fetch SPFM delivery routes...");

      const response = await this.fetchWithRetry(url);
      if (!response.ok) {
        console.log("SPFM Delivery tab not found - skipping delivery routes");
        return;
      }

      const result = await response.json();

      if (!result.values || result.values.length < 2) {
        console.log("SPFM Delivery tab is empty - skipping delivery routes");
        return;
      }

      // Convert delivery rows to JavaScript objects
      const headers = result.values[0];
      this.deliveryData = result.values.slice(1).map((row) => {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] || "";
        });
        return obj;
      });

      console.log(`✅ Loaded ${this.deliveryData.length} SPFM delivery routes`);
      console.log("🔍 Debug: Sample delivery route:", this.deliveryData[0]);
      console.log("🔍 Debug: All delivery data:", this.deliveryData);

      // Debug each delivery route's Food from column
      this.deliveryData.forEach((delivery, index) => {
        console.log(
          `🔍 DELIVERY ${index}: Food from = "${delivery["Food from"]}"`,
        );
        console.log(`🔍 DELIVERY ${index}: All keys =`, Object.keys(delivery));
      });
    } catch (error) {
      console.log(
        "SPFM Delivery data not available (this is optional):",
        error,
      );
    }
  }

  // ========================================
  // INVENTORY DATA
  // ========================================
  async fetchInventoryData() {
    try {
      // Try to fetch box inventory from the "Inventory" sheet tab
      const inventoryRange = "Inventory!A:Z";
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${inventoryRange}?key=${API_KEY}`;
      console.log("📦 Attempting to fetch inventory data...");

      const response = await this.fetchWithRetry(url);
      if (!response.ok) {
        console.log("Inventory tab not found - skipping inventory display");
        return;
      }

      const result = await response.json();

      if (!result.values || result.values.length < 2) {
        console.log("Inventory tab is empty - skipping inventory display");
        return;
      }

      // Convert inventory rows to JavaScript objects
      const headers = result.values[0];
      this.inventoryData = result.values.slice(1).map((row) => {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] || "";
        });
        return obj;
      });

      console.log(`✅ Loaded ${this.inventoryData.length} inventory items`);
    } catch (error) {
      console.log("Inventory data not available (this is optional):", error);
    }
  }

  // ========================================
  // CONTACTS DATA
  // ========================================
  async fetchContactsData() {
    try {
      const contactsRange = "Contacts!A:Z";
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${contactsRange}?key=${API_KEY}`;
      console.log("📞 Attempting to fetch contacts data...");

      const response = await this.fetchWithRetry(url);
      if (!response.ok) {
        console.log("Contacts tab not found - using original addresses");
        return;
      }

      const result = await response.json();
      const values = result.values;

      if (!values || values.length === 0) {
        console.log("No contacts data found.");
        return;
      }

      const headers = values[0];
      this.contactsData = values.slice(1).map((row) => {
        const contact = {};
        headers.forEach((header, index) => {
          contact[header] = row[index] || "";
        });
        return contact;
      });

      console.log(
        "✅ Contacts data loaded:",
        this.contactsData.length,
        "contacts",
      );
    } catch (error) {
      console.error("❌ Error fetching contacts data:", error);
    }
  }

  // ========================================
  // FETCH WITH RETRY FOR RATE LIMITS
  // ========================================
  async fetchWithRetry(url, maxRetries = 3, delay = 2000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url);

        if (response.status === 429) {
          console.log(
            `Rate limited (429), waiting ${delay}ms before retry ${i + 1}/${maxRetries}`,
          );
          if (i < maxRetries - 1) {
            await new Promise((resolve) => setTimeout(resolve, delay));
            delay *= 2; // Exponential backoff
            continue;
          }
        }

        return response;
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        console.log(`Request failed, retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // ========================================
  // HELPER METHODS
  // ========================================
  getAddressFromContacts(name) {
    if (!this.contactsData || this.contactsData.length === 0) {
      return null;
    }

    const contact = this.contactsData.find(
      (contact) =>
        contact.Location &&
        contact.Location.toLowerCase().trim() === name.toLowerCase().trim(),
    );

    return contact
      ? {
          address: contact.Address || "",
          phone: contact.Phone || "",
          contactName: contact.Contact || contact.Location || "",
          notes: contact["Notes/ Special Instructions"] || "",
        }
      : null;
  }

  getAllWorkers() {
    const workers = new Set();

    // Get workers from SPFM data
    this.data.forEach((route) => {
      [route.worker1, route.worker2, route.worker3, route.worker4].forEach(
        (worker) => {
          if (worker && typeof worker === "string") {
            const normalized = worker.trim();
            if (normalized !== "" && normalized.toUpperCase() !== "CANCELLED") {
              workers.add(normalized);
            }
          }
        },
      );
    });

    // Get workers from Recovery data
    this.recoveryData.forEach((route) => {
      const worker = route.Worker;
      if (worker && typeof worker === "string") {
        const normalized = worker.trim();
        if (normalized !== "" && normalized.toLowerCase() !== "worker") {
          workers.add(normalized);
        }
      }
    });

    return Array.from(workers).sort();
  }

  getWorkerAssignments(workerName) {
    const normalizedWorker = workerName.trim().toLowerCase();

    // Get SPFM assignments
    const spfmAssignments = this.data.filter((route) => {
      const worker1 = (route.worker1 || "").trim().toLowerCase();
      const worker2 = (route.worker2 || "").trim().toLowerCase();
      const worker3 = (route.worker3 || "").trim().toLowerCase();
      const worker4 = (route.worker4 || "").trim().toLowerCase();

      return (
        worker1 === normalizedWorker ||
        worker2 === normalizedWorker ||
        worker3 === normalizedWorker ||
        worker4 === normalizedWorker
      );
    });

    // Get recovery assignments
    const recoveryAssignments = this.recoveryData.filter((route) => {
      const routeWorker = (route.Worker || "").trim().toLowerCase();
      return routeWorker === normalizedWorker;
    });

    console.log(`🔍 Debug getWorkerAssignments for ${workerName}:`);
    console.log("🔍 Recovery data:", this.recoveryData);
    console.log("🔍 SPFM assignments found:", spfmAssignments.length);
    console.log("🔍 Recovery assignments found:", recoveryAssignments.length);
    console.log("🔍 Recovery assignments:", recoveryAssignments);

    return {
      spfm: spfmAssignments,
      recovery: recoveryAssignments,
    };
  }

  getRoutesByDate(date) {
    return this.data.filter((route) => route.date === date);
  }

  getAllDates() {
    const dates = new Set();
    this.data.forEach((route) => {
      if (route.date) {
        dates.add(route.date);
      }
    });
    return Array.from(dates).sort();
  }
}

// Export instance
const sheetsAPI = new SheetsAPI();

// Confirm this file loaded
console.log("✅ sheets.js loaded");
window.sheetsAPILoaded = true;
