/* ========================================
   SPFM Routes - Google Sheets Integration
   ======================================== */

class SheetsAPI {
    constructor() {
        this.data = [];
        this.recoveryData = [];
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
            const response = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: "Routes!A:Z",
            });

            if (!response.result.values || response.result.values.length === 0) {
                throw new Error("No data found in the spreadsheet");
            }

            const headers = response.result.values[0];
            this.data = response.result.values.slice(1).map((row) => {
                const obj = {};
                headers.forEach((header, index) => {
                    obj[header] = row[index] || "";
                });
                return obj;
            });

            console.log(`✅ Loaded ${this.data.length} routes`);
            console.log("Available columns:", headers);

            // Fetch additional data sheets
            await Promise.all([
                this.fetchRecoveryData(),
                this.fetchInventoryData(),
                this.fetchContactsData()
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
            const result = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: "Recovery!A:Z",
            });

            if (result.values && result.values.length > 1) {
                const headers = result.values[0];
                this.recoveryData = result.values.slice(1).map((row) => {
                    const obj = {};
                    headers.forEach((header, index) => {
                        obj[header] = row[index] || "";
                    });
                    return obj;
                });

                console.log(`✅ Loaded ${this.recoveryData.length} recovery routes`);
            }
        } catch (error) {
            console.log("Recovery data not available (this is optional):", error);
        }
    }

    // ========================================
    // INVENTORY DATA
    // ========================================
    async fetchInventoryData() {
        try {
            const result = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: "Inventory!A:Z",
            });

            if (result.values && result.values.length > 1) {
                const headers = result.values[0];
                this.inventoryData = result.values.slice(1).map((row) => {
                    const obj = {};
                    headers.forEach((header, index) => {
                        obj[header] = row[index] || "";
                    });
                    return obj;
                });

                console.log(`✅ Loaded ${this.inventoryData.length} inventory items`);
            }
        } catch (error) {
            console.log("Inventory data not available (this is optional):", error);
        }
    }

    // ========================================
    // CONTACTS DATA
    // ========================================
    async fetchContactsData() {
        try {
            const result = await gapi.client.sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: "Contacts!A:Z",
            });

            if (result.values && result.values.length > 1) {
                const headers = result.values[0];
                this.contactsData = result.values.slice(1).map((row) => {
                    const obj = {};
                    headers.forEach((header, index) => {
                        obj[header] = row[index] || "";
                    });
                    return obj;
                });

                console.log(`✅ Loaded ${this.contactsData.length} contacts`);
            }
        } catch (error) {
            console.log("Contacts data not available (this is optional):", error);
        }
    }

    // ========================================
    // HELPER METHODS
    // ========================================
    getAddressFromContacts(name) {
        if (!name || !this.contactsData.length) return null;

        const contact = this.contactsData.find(contact =>
            contact.Name && contact.Name.toLowerCase() === name.toLowerCase()
        );

        return contact ? {
            address: contact.Address || contact.address || "",
            phone: contact.Phone || contact.phone || ""
        } : null;
    }

    getAllWorkers() {
        const workers = new Set();

        // Get workers from SPFM data
        this.data.forEach((route) => {
            [route.worker1, route.worker2, route.worker3, route.worker4].forEach((worker) => {
                if (worker && typeof worker === "string") {
                    const normalized = worker.trim();
                    if (normalized !== "" && normalized.toUpperCase() !== "CANCELLED") {
                        workers.add(normalized);
                    }
                }
            });
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

        return {
            spfm: spfmAssignments,
            recovery: recoveryAssignments
        };
    }

    getRoutesByDate(date) {
        return this.data.filter(route => route.date === date);
    }

    getAllDates() {
        const dates = new Set();
        this.data.forEach(route => {
            if (route.date) {
                dates.add(route.date);
            }
        });
        return Array.from(dates).sort();
    }

    // ========================================
    // GOOGLE API INITIALIZATION
    // ========================================
    async initializeGoogleAPI() {
        return new Promise((resolve, reject) => {
            gapi.load("client:auth2", async () => {
                try {
                    await gapi.client.init({
                        apiKey: API_KEY,
                        clientId: CLIENT_ID,
                        discoveryDocs: DISCOVERY_DOCS,
                        scope: SCOPES,
                    });

                    console.log("✅ Google API initialized");
                    resolve();
                } catch (error) {
                    console.error("❌ Error initializing Google API:", error);
                    reject(error);
                }
            });
        });
    }

    async signIn() {
        const authInstance = gapi.auth2.getAuthInstance();
        if (!authInstance.isSignedIn.get()) {
            await authInstance.signIn();
        }
    }

    isSignedIn() {
        const authInstance = gapi.auth2.getAuthInstance();
        return authInstance && authInstance.isSignedIn.get();
    }
}

// Export instance
const sheetsAPI = new SheetsAPI();
