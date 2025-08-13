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
      console.log("Fetching fresh data from Google Sheets (OAuth)...");

      const resp = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'SPFM!A:T',
      });
      const result = resp.result;
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
      // Prefer dedicated "Recovery" tab if present
      const recoveryRange = 'Recovery!A:P';
      console.log("🚗 Attempting to fetch recovery routes (OAuth)...");
      let result;
      try {
        const resp = await window.gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: recoveryRange,
        });
        result = resp.result;
      } catch (e) {
        result = null;
      }

      if (result && result.values && result.values.length >= 2) {
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
        return;
      }

      // Fallback: derive Recovery from consolidated Routes sheet by routeType
      console.log("🔄 Recovery tab missing; deriving from Routes (routeType=Recovery)");
      const routesRange = 'Routes!A:Z';
      const routesResp = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: routesRange,
      });
      const rValues = routesResp.result?.values || [];
      if (rValues.length < 2) {
        console.log("Routes sheet empty; no recovery routes available");
        this.recoveryData = [];
        return;
      }
      const rHeaders = rValues[0];
      const rows = rValues.slice(1);
      const idxType = rHeaders.indexOf('routeType');
      this.recoveryData = rows
        .filter((row) => idxType >= 0 && (row[idxType] || '').toLowerCase() === 'recovery')
        .map((row) => {
          const obj = {};
          rHeaders.forEach((h, i) => { obj[h] = row[i] || ''; });
          obj.type = 'recovery';
          return obj;
        });
      console.log(`✅ Derived ${this.recoveryData.length} recovery routes from Routes`);
    } catch (error) {
      console.log("Recovery data not available (this is optional):", error);
    }
  }

  // ========================================
  // SPFM DELIVERY DATA
  // ========================================
  async fetchDeliveryData() {
    try {
      // Try dedicated tab first
      const deliveryRange = 'SPFM_Delivery!A:P';
      console.log("🚚 Attempting to fetch SPFM delivery routes (OAuth)...");
      let result;
      try {
        const resp = await window.gapi.client.sheets.spreadsheets.values.get({
          spreadsheetId: SPREADSHEET_ID,
          range: deliveryRange,
        });
        result = resp.result;
      } catch (e) {
        result = null;
      }

      if (result && result.values && result.values.length >= 2) {
        const headers = result.values[0];
        this.deliveryData = result.values.slice(1).map((row) => {
          const obj = {};
          headers.forEach((header, index) => {
            obj[header] = row[index] || "";
          });
          return obj;
        });
        console.log(`✅ Loaded ${this.deliveryData.length} SPFM delivery routes`);
        return;
      }

      // Fallback: derive delivery from Routes sheet if routeType matches
      console.log("🔄 Delivery tab missing; deriving from Routes (routeType contains 'delivery')");
      const routesRange = 'Routes!A:Z';
      const routesResp = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: routesRange,
      });
      const rValues = routesResp.result?.values || [];
      if (rValues.length < 2) {
        this.deliveryData = [];
        return;
      }
      const rHeaders = rValues[0];
      const idxType = rHeaders.indexOf('routeType');
      this.deliveryData = rValues.slice(1)
        .filter((row) => idxType >= 0 && /delivery/i.test(row[idxType] || ''))
        .map((row) => {
          const obj = {};
          rHeaders.forEach((h, i) => { obj[h] = row[i] || ''; });
          obj.type = 'spfm-delivery';
          return obj;
        });
      console.log(`✅ Derived ${this.deliveryData.length} delivery routes from Routes`);
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
      // Inventory table now resides on the 'Status' sheet (columns A:E)
      const inventoryRange = 'Status!A:E';
      console.log("📦 Attempting to fetch inventory data (OAuth)...");
      const resp = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: inventoryRange,
      });
      const result = resp.result;

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
      const contactsRange = 'Contacts!A:Z';
      console.log("📞 Attempting to fetch contacts data (OAuth)...");
      const resp = await window.gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: contactsRange,
      });
      const result = resp.result;
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
      const workerCell = route[`worker${i}`].trim();
      console.log(`🔍 DEBUG getAllWorkers - worker${i}: "${workerCell}"`);
      // Skip header rows that have literal column names as values
      if (
        workerCell &&
        !flexibleTextMatch(workerCell, "cancelled") &&
        workerCell !== `worker${i}` &&
        !this.isColumnHeaderName(workerCell)
      ) {
        // Split comma-separated names into individual workers
        const individualWorkers = workerCell
          .split(",")
          .map((name) => name.trim())
          .filter((name) => name);
        individualWorkers.forEach((worker) => {
          workers.push(worker);
          console.log(`🔍 DEBUG getAllWorkers - Added worker: "${worker}"`);
        });
      } else if (workerCell === `worker${i}`) {
        console.log(
          `🔍 DEBUG getAllWorkers - Skipping header row with literal column name: "${workerCell}"`,
        );
      }
      i++;
    }

    // Also check old single column names for backward compatibility
    if (workers.length === 0 && (route.Worker || route.worker)) {
      const singleWorker = (route.Worker || route.worker).trim();
      console.log(
        `🔍 DEBUG getAllWorkers - Found single worker column: "${singleWorker}"`,
      );
      if (
        singleWorker &&
        !flexibleTextMatch(singleWorker, "cancelled") &&
        !this.isColumnHeaderName(singleWorker)
      ) {
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
      const vanCell = route[`van${i}`].trim();
      // Skip header rows that have literal column names as values
      if (vanCell && vanCell !== `van${i}`) {
        // Split comma-separated van names into individual vans
        const individualVans = vanCell
          .split(",")
          .map((name) => name.trim())
          .filter((name) => name);
        individualVans.forEach((van) => {
          vans.push(van);
        });
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
      const volunteerCell = route[`volunteer${i}`].trim();
      // Skip header rows that have literal column names as values
      if (volunteerCell && volunteerCell !== `volunteer${i}`) {
        // Split comma-separated names into individual volunteers
        const individualVolunteers = volunteerCell
          .split(",")
          .map((name) => name.trim())
          .filter((name) => name);
        individualVolunteers.forEach((volunteer) => {
          volunteers.push(volunteer);
        });
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
        type: contact.Type || contact.type || contact.TYPE || "",
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
      const routeVolunteers = this.getAllVolunteers(route);

      routeWorkers.forEach((worker) => {
        workers.add(worker);
      });

      // Add volunteers as they are also workers
      routeVolunteers.forEach((volunteer) => {
        workers.add(volunteer);
      });
    });

    // Get workers from Recovery data
    this.recoveryData.forEach((route) => {
      const routeWorkers = this.getAllWorkersFromRoute(route);
      const routeVolunteers = this.getAllVolunteers(route);

      routeWorkers.forEach((worker) => {
        workers.add(worker);
      });

      // Add volunteers as they are also workers
      routeVolunteers.forEach((volunteer) => {
        workers.add(volunteer);
      });
    });

    // Get workers from Delivery data
    this.deliveryData.forEach((route) => {
      const routeWorkers = this.getAllWorkersFromRoute(route);
      const routeVolunteers = this.getAllVolunteers(route);

      routeWorkers.forEach((worker) => {
        workers.add(worker);
      });

      // Add volunteers as they are also workers
      routeVolunteers.forEach((volunteer) => {
        workers.add(volunteer);
      });
    });

    return Array.from(workers).sort();
  }

  // Helper method to identify common column header names that should not be treated as workers
  isColumnHeaderName(text) {
    if (!text || typeof text !== "string") return false;

    const headerPatterns = [
      "food from",
      "foodfrom",
      "food_from",
      "food source",
      "source",
      "from",
      "worker1",
      "worker2",
      "worker3",
      "worker4",
      "worker5",
      "worker",
      "volunteer",
      "volunteers",
      "volunteer1",
      "volunteer2",
      "date",
      "time",
      "location",
      "address",
      "route",
      "delivery",
      "pickup",
      "dropoff",
      "drop off",
      "drop-off",
      "market",
      "vendor",
      "client",
      "organization",
      "notes",
      "comments",
      "status",
      "cancelled",
      "canceled",
      "phone",
      "email",
      "contact",
      "quantity",
      "amount",
      "pounds",
      "lbs",
      "weight",
      "items",
      "food type",
      "type",
      "description",
      "details",
      "instructions",
      "van",
      "vehicle",
      "driver",
      "team",
      "assignment",
      "task",
    ];

    const normalizedText = text.toLowerCase().trim();

    // Check exact matches and contains matches
    return headerPatterns.some(
      (pattern) =>
        normalizedText === pattern ||
        normalizedText.includes(pattern) ||
        // Also check if the text looks like a column header pattern (starts with common prefixes)
        normalizedText.startsWith("worker") ||
        normalizedText.startsWith("volunteer") ||
        normalizedText.startsWith("food"),
    );
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

  // ========================================
  // CHARTS SHEET MANAGEMENT
  // ========================================

  async listSheetsInSpreadsheet() {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}?key=${API_KEY}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data.sheets.map((sheet) => ({ title: sheet.properties.title }));
    } catch (error) {
      console.error("❌ Error listing sheets:", error);
      return [];
    }
  }

  async createChartsSheet() {
    try {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}:batchUpdate?key=${API_KEY}`;

      const requestBody = {
        requests: [
          {
            addSheet: {
              properties: {
                title: "Charts",
              },
            },
          },
        ],
      };

      const token = window.gapi.client.getToken();
      if (!token) {
        throw new Error("No auth token available");
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log("✅ Charts sheet created successfully");
      return true;
    } catch (error) {
      console.error("❌ Error creating Charts sheet:", error);
      throw error;
    }
  }

  async appendToChartsSheet(rowData) {
    try {
      const range = "Charts!A:D";
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED&key=${API_KEY}`;

      const requestBody = {
        values: [rowData],
      };

      console.log("📊 Attempting to append to Charts sheet");
      console.log("📊 URL:", url);
      console.log("📊 Row data:", rowData);

      const token = window.gapi.client.getToken();
      if (!token) {
        console.log("❌ No auth token - user may not be signed in");
        return false;
      }

      console.log("📊 Token exists, making request...");

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      console.log("📊 Response status:", response.status);
      console.log("📊 Response ok:", response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.log("📊 Error response text:", errorText);

        if (response.status === 400) {
          console.log(
            "📊 Charts sheet may not exist yet - please create it manually",
          );
          return false;
        }
        throw new Error(
          `HTTP error! status: ${response.status}, body: ${errorText}`,
        );
      }

      const responseData = await response.json();
      console.log("📊 Response data:", responseData);
      console.log("✅ Data appended to Charts sheet successfully");
      return true;
    } catch (error) {
      console.error("❌ Error appending to Charts sheet:", error);
      console.error("❌ Full error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      if (error.message.includes("Charts")) {
        console.log(
          "💡 Tip: Create a 'Charts' sheet in your Google Spreadsheet with headers: Date, Route ID, Location, Boxes, Lbs, Timestamp, Submitted By",
        );
      }
      return false;
    }
  }
}

// Export instance
const sheetsAPI = new SheetsAPI();

// Confirm this file loaded
console.log("✅ sheets.js loaded");
window.sheetsAPILoaded = true;
