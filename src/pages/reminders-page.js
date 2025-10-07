class RemindersPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._remindersData = null;
    this._marketSummary = [];
    this._vanCapacity = [];
  }

  connectedCallback() {
    this.render();
    this.loadReminders();

    // Listen for data updates
    if (window.dataService) {
      window.dataService.addEventListener("data-loaded", () => {
        this.loadReminders();
      });
    }
  }

  async loadReminders() {
    try {
      // Load announcements data - try OAuth first, then fallback to CSV
      if (window.dataService && window.dataService.sheetsAPI) {
        this._marketSummary = window.dataService.sheetsAPI.marketSummary || [];
        this._vanCapacity = window.dataService.sheetsAPI.vanCapacity || [];
        console.log("📢 Announcements loaded from sheetsAPI:", {
          marketSummary: this._marketSummary.length,
          vanCapacity: this._vanCapacity.length,
        });
      }

      // If no data from OAuth, try public CSV access
      if (this._marketSummary.length === 0 || this._vanCapacity.length === 0) {
        console.log("📢 Trying public CSV access for announcements...");
        await this.loadAnnouncementsFromCSV();
      }

      // TEMPORARY TEST: Use hardcoded data to test display
      const testReminders = [
        { section: "Office", item: "Tablets (2)" },
        { section: "Office", item: "Printers (2)" },
        { section: "Storage", item: "Boxes (50 LARGE, 20 small)" },
        { section: "Market", item: "2 workers - setup" },
        { section: "Return", item: "Tablets - sync + charge" },
      ];

      // Try to get reminders directly from the correct Google Sheets range
      let allReminders = [];

      try {
        // First try public CSV access (no auth needed)
        console.log("Trying public CSV access first...");
        try {
          const csvUrl = `https://docs.google.com/spreadsheets/d/1yn3yPWW5ThhPvHzYiSkwwNztVnAQLD2Rk_QEQJwlr2k/export?format=csv&range=Misc!G:H`;
          const csvResponse = await fetch(csvUrl);
          if (csvResponse.ok) {
            const csvText = await csvResponse.text();
            console.log(
              "CSV data received:",
              csvText.substring(0, 200) + "..."
            );

            // Parse CSV
            const rows = csvText
              .split("\n")
              .map((row) =>
                row.split(",").map((cell) => cell.trim().replace(/"/g, ""))
              );
            console.log("Parsed CSV rows:", rows.slice(0, 3));

            if (rows.length > 1) {
              allReminders = rows
                .slice(1)
                .map((row) => ({
                  section: row[0],
                  item: row[1],
                }))
                .filter((item) => item.section && item.item);

              console.log("CSV converted to objects:", allReminders);
            }
          }
        } catch (csvError) {
          console.log("CSV access failed:", csvError);
        }

        // If CSV didn't work, try authenticated API
        if (
          (!allReminders || allReminders.length === 0) &&
          window.gapi &&
          window.gapi.client &&
          window.gapi.client.sheets
        ) {
          console.log("Attempting direct Google Sheets API call for Misc!G:H");
          const response =
            await window.gapi.client.sheets.spreadsheets.values.get({
              spreadsheetId: "1yn3yPWW5ThhPvHzYiSkwwNztVnAQLD2Rk_QEQJwlr2k",
              range: "Misc!G:H",
            });

          if (response.result && response.result.values) {
            const rows = response.result.values;
            console.log("Raw Google Sheets data from G:H:", rows);

            // Skip header row and convert to objects
            console.log("First few rows:", rows.slice(0, 3));

            if (rows[0] && rows[0].length === 2) {
              // 2 columns: section, item (no order column)
              console.log("Detected 2-column format");
              allReminders = rows
                .slice(1)
                .map((row) => ({
                  section: row[0],
                  item: row[1],
                }))
                .filter((item) => item.section && item.item);
            } else if (rows[0] && rows[0].length === 3) {
              // 3 columns: order, section, item
              console.log("Detected 3-column format");
              allReminders = rows
                .slice(1)
                .map((row) => ({
                  order: row[0],
                  section: row[1],
                  item: row[2],
                }))
                .filter((item) => item.section && item.item);
            }

            console.log("Converted to objects:", allReminders);
          }
        }
      } catch (error) {
        console.error("Direct API call failed:", error);
      }

      // If direct call didn't work, try the normal data service
      if (!allReminders || allReminders.length === 0) {
        console.log("Direct API failed, trying dataService...");
        allReminders =
          window.dataService &&
          typeof window.dataService.getAllReminders === "function"
            ? await window.dataService.getAllReminders()
            : [];
      }

      // If still no real data, fall back to test data
      if (!allReminders || allReminders.length === 0) {
        console.log("No sheets data found, using test data");
        allReminders = testReminders;
      }

      console.log("All reminders loaded:", allReminders);
      console.log(
        "Sample reminder object keys:",
        allReminders[0] ? Object.keys(allReminders[0]) : "No data"
      );
      console.log("Raw sheets API access test:");
      console.log("window.dataService:", !!window.dataService);
      console.log(
        "window.dataService.sheetsAPI:",
        !!window.dataService?.sheetsAPI
      );
      console.log(
        "miscReminders:",
        window.dataService?.sheetsAPI?.miscReminders
      );

      // If the data structure is the old format, try to access the underlying sheet data directly
      if (
        allReminders.length === 1 &&
        !allReminders[0].section &&
        !allReminders[0].item
      ) {
        console.log("Detected old format, trying to access raw sheet data...");

        // Try different ways to access the raw data
        console.log("Trying to access raw data from multiple sources...");

        // Check if we can access sheetsAPI through dataService
        const dataService = window.dataService;
        if (dataService && dataService.sheetsAPI) {
          console.log("Found sheetsAPI via dataService.sheetsAPI");
          if (dataService.sheetsAPI.miscReminders) {
            allReminders = dataService.sheetsAPI.miscReminders;
            console.log(
              "Using dataService.sheetsAPI.miscReminders:",
              allReminders
            );
          }
        }

        // Check direct import
        if (window.sheetsAPI && window.sheetsAPI.miscReminders) {
          allReminders = window.sheetsAPI.miscReminders;
          console.log("Using window.sheetsAPI.miscReminders:", allReminders);
        }

        // If still no data, use our test data
        if (
          !allReminders ||
          allReminders.length === 0 ||
          !allReminders[0].section
        ) {
          console.log("No valid sheets data found, using test data");
          allReminders = testReminders;
        }
      }

      // Group by section
      this._remindersData = {
        office: [],
        storage: [],
        market: [],
        return: [],
      };

      allReminders.forEach((reminder) => {
        const section = (
          reminder.section ||
          reminder.Section ||
          ""
        ).toLowerCase();
        const item = reminder.item || reminder.Item || "";

        console.log("Processing reminder:", { section, item });

        if (!item || item.trim() === "") return; // Skip empty items

        if (section.includes("office")) {
          this._remindersData.office.push(item);
        } else if (section.includes("storage")) {
          this._remindersData.storage.push(item);
        } else if (section.includes("market")) {
          this._remindersData.market.push(item);
        } else if (section.includes("return")) {
          this._remindersData.return.push(item);
        }
      });

      console.log("Processed reminders data:", this._remindersData);
      this.renderReminders();
    } catch (error) {
      console.error("Error loading reminders:", error);
    }
  }

  renderReminders() {
    const container = this.shadowRoot.querySelector(".reminders-container");
    if (!container) return;

    const announcementsHtml = this.renderAnnouncements();

    container.innerHTML = `
      ${announcementsHtml}
      <div class="reminders-grid">
        <!-- Arrive at Office -->
        <div class="reminder-box">
          <div class="box-header">
            <h3>Arrive at Office</h3>
          </div>
          <div class="box-columns">
            <div class="box-column">
              <h4>Office</h4>
              <div class="checklist">
                ${
                  this._remindersData.office
                    .map(
                      (item) => `
                    <label class="checkbox-item">
                      <input type="checkbox" />
                      <span class="checkmark"></span>
                      <span class="item-text">${item}</span>
                    </label>
                  `
                    )
                    .join("") || '<div class="no-items">No office items</div>'
                }
              </div>
            </div>
            <div class="box-column">
              <h4>Storage</h4>
              <div class="checklist">
                ${
                  this._remindersData.storage
                    .map(
                      (item) => `
                    <label class="checkbox-item">
                      <input type="checkbox" />
                      <span class="checkmark"></span>
                      <span class="item-text">${item}</span>
                    </label>
                  `
                    )
                    .join("") || '<div class="no-items">No storage items</div>'
                }
              </div>
            </div>
          </div>
        </div>

        <!-- Market -->
        <div class="reminder-box">
          <div class="box-header">
            <h3>Market</h3>
          </div>
          <div class="box-single-column">
            <div class="checklist">
              ${
                this._remindersData.market
                  .map(
                    (item) => `
                  <label class="checkbox-item">
                    <input type="checkbox" />
                    <span class="checkmark"></span>
                    <span class="item-text">${item}</span>
                  </label>
                `
                  )
                  .join("") || '<div class="no-items">No market items</div>'
              }
            </div>
          </div>
        </div>

        <!-- Return to Office -->
        <div class="reminder-box">
          <div class="box-header">
            <h3>Return to Office</h3>
          </div>
          <div class="box-single-column">
            <div class="checklist">
              ${
                this._remindersData.return
                  .map(
                    (item) => `
                  <label class="checkbox-item">
                    <input type="checkbox" />
                    <span class="checkmark"></span>
                    <span class="item-text">${item}</span>
                  </label>
                `
                  )
                  .join("") || '<div class="no-items">No return items</div>'
              }
            </div>
          </div>
        </div>
      </div>

      <div class="actions">
        <button class="action-btn" id="resetBtn">Reset All</button>
      </div>
    `;

    // Wire up reset button
    const resetBtn = this.shadowRoot.querySelector("#resetBtn");
    if (resetBtn) {
      resetBtn.addEventListener("click", () => this.clearAll());
    }
  }

  async loadAnnouncementsFromCSV() {
    const SPREADSHEET_ID = "1yn3yPWW5ThhPvHzYiSkwwNztVnAQLD2Rk_QEQJwlr2k";

    try {
      // Load Market Summary from Misc!J:M
      if (this._marketSummary.length === 0) {
        const marketUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&range=Misc!J:M`;
        const marketResponse = await fetch(marketUrl);
        if (marketResponse.ok) {
          const csvText = await marketResponse.text();
          this._marketSummary = this.parseCSV(csvText);
          console.log(
            "✅ Loaded Market Summary from CSV:",
            this._marketSummary.length,
            "rows"
          );
        }
      }

      // Load Van Capacity from Misc!O:R
      if (this._vanCapacity.length === 0) {
        const vanUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&range=Misc!O:R`;
        const vanResponse = await fetch(vanUrl);
        if (vanResponse.ok) {
          const csvText = await vanResponse.text();
          this._vanCapacity = this.parseCSV(csvText);
          console.log(
            "✅ Loaded Van Capacity from CSV:",
            this._vanCapacity.length,
            "rows"
          );
        }
      }
    } catch (error) {
      console.error("Error loading announcements from CSV:", error);
    }
  }

  parseCSV(csvText) {
    const rows = csvText
      .trim()
      .split("\n")
      .map((row) => {
        // Simple CSV parser - handles quoted fields
        const cells = [];
        let current = "";
        let inQuotes = false;

        for (let i = 0; i < row.length; i++) {
          const char = row[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === "," && !inQuotes) {
            cells.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }
        cells.push(current.trim());
        return cells;
      });

    return rows.filter((row) => row.some((cell) => cell !== ""));
  }

  renderAnnouncements() {
    if (!this._marketSummary.length && !this._vanCapacity.length) {
      return "";
    }

    const renderTable = (data, title) => {
      if (!data || data.length === 0) return "";

      const headers = data[0] || [];
      const rows = data.slice(1);

      return `
        <div class="announcement-table">
          ${title ? `<h3 class="announcement-title">${title}</h3>` : ""}
          <table>
            <thead>
              <tr>
                ${headers.map((h) => `<th>${h || ""}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  (row) => `
                <tr>
                  ${headers.map((_, i) => `<td>${row[i] || ""}</td>`).join("")}
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      `;
    };

    return `
      <div class="announcements-section">
        ${renderTable(this._marketSummary, this._marketSummary[0]?.[0] || "")}
        ${renderTable(this._vanCapacity, this._vanCapacity[0]?.[0] || "")}
      </div>
    `;
  }

  clearAll() {
    const checkboxes = this.shadowRoot.querySelectorAll(
      'input[type="checkbox"]'
    );
    checkboxes.forEach((checkbox) => (checkbox.checked = false));
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          padding: 20px;
          font-family: var(--body-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
          background: #f5f5f5;
          min-height: 100%;
        }

        .reminders-container {
          max-width: 1200px;
          margin: 0 auto;
        }

        .announcements-section {
          margin-bottom: 30px;
        }

        .announcement-table {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          margin-bottom: 20px;
        }

        .announcement-title {
          background: #f8f9fa;
          padding: 15px 20px;
          margin: 0;
          color: #333;
          font-size: 1.1rem;
          font-weight: 600;
          border-bottom: 1px solid #ddd;
        }

        .announcement-table table {
          width: 100%;
          border-collapse: collapse;
        }

        .announcement-table th,
        .announcement-table td {
          padding: 12px 15px;
          text-align: left;
          border-bottom: 1px solid #eee;
        }

        .announcement-table th {
          background: #f8f9fa;
          font-weight: 600;
          color: #555;
          font-size: 0.9rem;
          text-transform: capitalize;
        }

        .announcement-table td {
          color: #333;
          font-size: 0.9rem;
        }

        .announcement-table tbody tr:hover {
          background: #f8f9fa;
        }

        .announcement-table tbody tr:last-child td {
          border-bottom: none;
        }

        .reminders-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }

        .reminder-box {
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }

        .box-header {
          background: #f8f9fa;
          padding: 15px 20px;
          border-bottom: 1px solid #ddd;
        }

        .box-header h3 {
          margin: 0;
          color: #333;
          font-size: 1.2rem;
          font-weight: 600;
        }

        .box-columns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0;
        }

        .box-single-column {
          padding: 20px;
        }

        .box-column {
          padding: 20px;
        }

        .box-column:first-child {
          border-right: 1px solid #eee;
        }

        .box-column h4 {
          margin: 0 0 15px 0;
          color: #666;
          font-size: 1rem;
          font-weight: 600;
        }

        .checklist {
          /* Container for checkboxes */
        }

        .checkbox-item {
          display: flex;
          align-items: center;
          margin-bottom: 12px;
          cursor: pointer;
          padding: 6px;
          border-radius: 4px;
          transition: background-color 0.2s;
        }

        .checkbox-item:hover {
          background: #f8f9fa;
        }

        .checkbox-item input[type="checkbox"] {
          display: none;
        }

        .checkmark {
          width: 18px;
          height: 18px;
          border: 2px solid #ddd;
          border-radius: 3px;
          margin-right: 10px;
          position: relative;
          transition: all 0.3s ease;
          flex-shrink: 0;
        }

        .checkbox-item input[type="checkbox"]:checked + .checkmark {
          background: #28a745;
          border-color: #28a745;
        }

        .checkbox-item input[type="checkbox"]:checked + .checkmark::after {
          content: '✓';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          color: white;
          font-weight: bold;
          font-size: 11px;
        }

        .checkbox-item input[type="checkbox"]:checked + .checkmark + .item-text {
          text-decoration: line-through;
          color: #6c757d;
        }

        .item-text {
          font-size: 0.9rem;
          color: #333;
          line-height: 1.3;
        }

        .no-items {
          color: #999;
          font-style: italic;
          text-align: center;
          padding: 15px;
          font-size: 0.9rem;
        }

        .actions {
          text-align: center;
          margin-top: 30px;
        }

        .action-btn {
          background: #f8f9fa;
          color: #333;
          border: 1px solid #ddd;
          padding: 10px 20px;
          border-radius: 6px;
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .action-btn:hover {
          background: #e9ecef;
          border-color: #adb5bd;
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
          :host {
            padding: 15px;
          }

          .box-columns {
            grid-template-columns: 1fr;
          }

          .box-column:first-child {
            border-right: none;
            border-bottom: 1px solid #eee;
          }
        }
      </style>

      <div class="reminders-container">
        <!-- Content will be dynamically inserted here -->
      </div>
    `;
  }
}

customElements.define("reminders-page", RemindersPage);
