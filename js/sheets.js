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

  // Get all numbered worker columns from a route object
  getAllWorkersFromRoute(route) {
    const workers = [];
    let i = 1;

    console.log(`🔍 DEBUG getAllWorkers - Route keys:`, Object.keys(route));
    console.log(`🔍 DEBUG getAllWorkers - Looking for worker columns...`);

    while (route[`worker${i}`]) {
      const worker = route[`worker${i}`].trim();
      console.log(`🔍 DEBUG getAllWorkers - worker${i}: "${worker}"`);
      if (worker && !flexibleTextMatch(worker, "cancelled")) {
        workers.push(worker);
        console.log(`🔍 DEBUG getAllWorkers - Added worker: "${worker}"`);
      }
      i++;
    }

    // Also check old single column names for backward compatibility
    if (workers.length === 0 && (route.Worker || route.worker)) {
      const singleWorker = (route.Worker || route.worker).trim();
      console.log(
        `🔍 DEBUG getAllWorkers - Found single worker column: "${singleWorker}"`,
      );
      if (singleWorker && !flexibleTextMatch(singleWorker, "cancelled")) {
        workers.push(singleWorker);
        console.log(
          `🔍 DEBUG getAllWorkers - Added single worker: "${singleWorker}"`,
        );
      }
    }

    console.log(`🔍 DEBUG getAllWorkers - Final workers:`, workers);
    return workers;
  }

  // Get all numbered van columns from a route object
  getAllVans(route) {
    const vans = [];
    let i = 1;
    while (route[`van${i}`]) {
      const van = route[`van${i}`].trim();
      if (van) {
        vans.push(van);
      }
      i++;
    }
    return vans;
  }

  // Get all numbered volunteer columns from a route object
  getAllVolunteers(route) {
    const volunteers = [];
    let i = 1;
    while (route[`volunteer${i}`]) {
      const volunteer = route[`volunteer${i}`].trim();
      if (volunteer) {
        volunteers.push(volunteer);
      }
      i++;
    }
    return volunteers;
  }

  // Get all numbered contact columns from a contact object
  getAllContacts(contact) {
    const contacts = [];
    let i = 1;
    while (contact[`contact${i}`] || contact[`Contact${i}`]) {
      const contactPerson = (
        contact[`contact${i}`] ||
        contact[`Contact${i}`] ||
        ""
      ).trim();
      if (contactPerson) {
        contacts.push(contactPerson);
      }
      i++;
    }
    return contacts;
  }

  // Get all numbered phone columns from a contact object
  getAllPhones(contact) {
    const phones = [];
    let i = 1;
    while (contact[`phone${i}`] || contact[`Phone${i}`]) {
      const phone = (contact[`phone${i}`] || contact[`Phone${i}`] || "").trim();
      if (phone) {
        phones.push(phone);
      }
      i++;
    }
    return phones;
  }

  // Get all numbered contact columns from a route object
  getAllRouteContacts(route) {
    const contacts = [];
    let i = 1;
    while (route[`contact${i}`] || route[`Contact${i}`]) {
      const contact = (
        route[`contact${i}`] ||
        route[`Contact${i}`] ||
        ""
      ).trim();
      if (contact) {
        contacts.push(contact);
      }
      i++;
    }
    // Fallback to old single column if no numbered columns exist
    if (contacts.length === 0 && (route.contact || route.Contact)) {
      const singleContact = (route.contact || route.Contact).trim();
      if (singleContact) {
        contacts.push(singleContact);
      }
    }
    return contacts;
  }

  // Get all numbered phone columns from a route object
  getAllRoutePhones(route) {
    const phones = [];
    let i = 1;
    while (route[`phone${i}`] || route[`Phone${i}`]) {
      const phone = (route[`phone${i}`] || route[`Phone${i}`] || "").trim();
      if (phone) {
        phones.push(phone);
      }
      i++;
    }
    // Fallback to old single column if no numbered columns exist
    if (phones.length === 0 && (route.phone || route.Phone)) {
      const singlePhone = (route.phone || route.Phone).trim();
      if (singlePhone) {
        phones.push(singlePhone);
      }
    }
    return phones;
  }

  // Check if any worker or volunteer column contains volunteer-related text
  hasVolunteers(route) {
    const allWorkers = this.getAllWorkersFromRoute(route);
    const allVolunteers = this.getAllVolunteers(route);

    return (
      allVolunteers.length > 0 ||
      allWorkers.some((worker) => flexibleTextIncludes(worker, "volunteer"))
    );
  }

  getAddressFromContacts(name) {
    console.log(`🔍 Debug: Looking up address for "${name}"`);
    console.log(
      `🔍 Debug: contactsData available:`,
      this.contactsData?.length || 0,
    );

    if (!this.contactsData || this.contactsData.length === 0) {
      console.log(`🔍 Debug: No contacts data available for "${name}"`);
      return null;
    }

    // Enhanced normalize function to handle more variations
    const normalize = (str) => {
      return normalizeText(str)
        .replace(/[''`]/g, "") // Remove apostrophes and quotes
        .replace(/[-\s]+/g, " ") // Replace dashes and multiple spaces with single space
        .replace(/\s+/g, " "); // Normalize multiple spaces to single space
    };

    console.log(`🔍 Debug: Searching for "${name}" in contacts...`);
    console.log(
      `🔍 Debug: Available contacts:`,
      this.contactsData.map((c) => ({
        Location: c.Location,
        Address: c.Address,
      })),
    );

    // Try multiple matching strategies
    let contact = null;

    // Strategy 1: Exact match (flexible text matching)
    contact = this.contactsData.find((contact) => {
      if (!contact.Location) return false;
      return flexibleTextMatch(contact.Location, name);
    });

    if (contact) {
      console.log(`🔍 Debug: Found exact match for "${name}"`);
    } else {
      // Strategy 2: Exact match after normalizing apostrophes and spaces
      const normalizedName = normalize(name);
      contact = this.contactsData.find((contact) => {
        if (!contact.Location) return false;
        const normalizedLocation = normalize(contact.Location);
        return normalizedLocation === normalizedName;
      });

      if (contact) {
        console.log(`🔍 Debug: Found normalized match for "${name}"`);
      }
    }

    if (contact) {
      console.log(`🔍 Debug: Found contact for "${name}":`, {
        Location: contact.Location,
        Address: contact.Address,
        Phone: contact.Phone,
        Type: contact.Type,
        AllKeys: Object.keys(contact),
      });
      console.log(`🔍 DEBUG Type value for "${name}": "${contact.Type}"`);
      const finalAddress = contact.Address || contact.Location || "";

      // Get all numbered contacts and phones
      const allContacts = this.getAllContacts(contact);
      const allPhones = this.getAllPhones(contact);

      // Fallback to old single column names if no numbered columns exist
      const contactName =
        allContacts.length > 0
          ? allContacts[0]
          : contact.Contact || contact.contact || contact.Location || "";

      const phone =
        allPhones.length > 0
          ? allPhones[0]
          : contact.Phone || contact.phone || "";

      return {
        address: finalAddress,
        phone: phone,
        phones: allPhones, // All phone numbers available
        contactName: contactName,
        contacts: allContacts, // All contact names available
        notes:
          contact["Notes/ Special Instructions"] ||
          contact.Notes ||
          contact.notes ||
          "",
      };
    } else {
      console.log(`🔍 Debug: No contact found for "${name}"`);
      console.log(
        `🔍 Debug: Available locations:`,
        this.contactsData
          .map((c) => c.Location)
          .filter(Boolean)
          .slice(0, 5),
      );
      return null;
    }
  }

  getAllWorkers() {
    const workers = new Set();

    // Get workers from SPFM data
    this.data.forEach((route) => {
      const routeWorkers = this.getAllWorkersFromRoute(route);
      routeWorkers.forEach((worker) => {
        workers.add(worker);
      });
    });

    // Get workers from Recovery data
    this.recoveryData.forEach((route) => {
      const routeWorkers = this.getAllWorkersFromRoute(route);
      routeWorkers.forEach((worker) => {
        workers.add(worker);
      });
    });

    return Array.from(workers).sort();
  }

  getWorkerAssignments(workerName) {
    // Get SPFM assignments
    const spfmAssignments = this.data.filter((route) => {
      const routeWorkers = this.getAllWorkersFromRoute(route);
      return routeWorkers.some((worker) =>
        flexibleTextMatch(worker, workerName),
      );
    });

    // Get recovery assignments
    const recoveryAssignments = this.recoveryData.filter((route) => {
      const routeWorkers = this.getAllWorkersFromRoute(route);
      return routeWorkers.some((worker) =>
        flexibleTextMatch(worker, workerName),
      );
    });

    // Get SPFM Delivery assignments
    const deliveryAssignments = this.deliveryData.filter((route) => {
      const routeWorkers = this.getAllWorkersFromRoute(route);
      return routeWorkers.some((worker) =>
        flexibleTextMatch(worker, workerName),
      );
    });

    console.log(`🔍 Debug getWorkerAssignments for ${workerName}:`);
    console.log("🔍 Recovery data:", this.recoveryData);
    console.log("🔍 SPFM assignments found:", spfmAssignments.length);
    console.log("🔍 Recovery assignments found:", recoveryAssignments.length);
    console.log("🔍 Recovery assignments:", recoveryAssignments);
    console.log("🔍 Delivery assignments found:", deliveryAssignments.length);
    console.log("🔍 Delivery assignments:", deliveryAssignments);

    return {
      spfm: spfmAssignments,
      recovery: recoveryAssignments,
      delivery: deliveryAssignments,
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
