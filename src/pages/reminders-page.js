class RemindersPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._materialsData = null;
  }

  connectedCallback() {
    this.render();
    this.loadMaterials();

    // Listen for data updates
    if (window.dataService) {
      window.dataService.addEventListener("data-loaded", () => {
        this.loadMaterials();
      });
    }
  }

  async loadMaterials() {
    try {
      // Try multiple keys to find materials in Reminders table
      let reminders = null;

      // Try different keys that might match your Reminders table
      const keysToTry = [
        { market: "all", type: "spfm" },
        { market: "SPFM", type: "spfm" },
        { market: "spfm", type: "spfm" },
        { market: "All", type: "spfm" },
        { market: "ANY", type: "spfm" },
      ];

      for (const key of keysToTry) {
        if (!(window.dataService && typeof window.dataService.getRemindersForRoute === 'function')) break;
        const result = await window.dataService.getRemindersForRoute(key);
        const hasOffice = Array.isArray(result?.materials_office) && result.materials_office.length;
        const hasStorage = Array.isArray(result?.materials_storage) && result.materials_storage.length;
        const hasAtMarket = Array.isArray(result?.atMarket)
          ? result.atMarket.length
          : (Array.isArray(result?.atmarket) && result.atmarket.length);
        const hasBackAtOffice = Array.isArray(result?.backAtOffice)
          ? result.backAtOffice.length
          : (Array.isArray(result?.backatoffice) && result.backatoffice.length);
        if (result && (hasOffice || hasStorage || hasAtMarket || hasBackAtOffice)) {
          reminders = result;
          console.log(`Found materials with key:`, key, result);
          break;
        }
      }

      // If no specific match, try getting all reminders and find any with materials
      if (!reminders) {
        const allReminders = (window.dataService && typeof window.dataService.getAllReminders === 'function')
          ? await window.dataService.getAllReminders()
          : [];
        console.log("All available reminders:", allReminders);

        // Find any reminder row that has materials
        for (const reminder of allReminders) {
          if (
            reminder.materials_office?.length ||
            reminder.materials_storage?.length ||
            reminder.atMarket?.length ||
            reminder.backAtOffice?.length
          ) {
            reminders = reminder;
            console.log("Using reminder row:", reminder);
            break;
          }
        }
      }

      this._materialsData = {
        office: reminders?.materials_office || [],
        storage: reminders?.materials_storage || [],
        atMarket: Array.isArray(reminders?.atMarket)
          ? reminders.atMarket
          : (reminders?.atmarket || []),
        backAtOffice: Array.isArray(reminders?.backAtOffice)
          ? reminders.backAtOffice
          : (reminders?.backatoffice || []),
      };

      console.log("Final materials data:", this._materialsData);
      this.renderMaterials();
    } catch (error) {
      console.error("Error loading materials:", error);
      try {
        const dbg = window.dataService?.getDebugInfo?.();
        console.log("Debug info:", dbg);
        const all = await (window.dataService?.getAllReminders?.() || []);
        console.log("All reminders sample:", Array.isArray(all) ? all.slice(0,3) : all);
      } catch {}
    }
  }

  renderMaterials() {
    const container = this.shadowRoot.querySelector(".materials-container");
    if (!container) return;

    container.innerHTML = `
      <div class="welcome-section">
        <h2>📋 SPFM Reminders Checklist</h2>
        <p>Everything you need for a successful route</p>
      </div>

      <div class="materials-grid">
        <!-- Office Materials -->
        <div class="material-card">
          <div class="card-header office">
            <h3>🏢 At Office - Materials</h3>
            <span class="count">${
              this._materialsData.office.length
            } items</span>
          </div>
          <div class="checklist">
            ${
              this._materialsData.office
                .map(
                  (item) => `
              <label class="checkbox-item">
                <input type="checkbox" />
                <span class="checkmark"></span>
                <span class="item-text">${item}</span>
              </label>
            `
                )
                .join("") ||
              '<div class="no-items">No office materials listed</div>'
            }
          </div>
        </div>

        <!-- Storage Materials -->
        <div class="material-card">
          <div class="card-header storage">
            <h3>📦 At Office - Storage</h3>
            <span class="count">${
              this._materialsData.storage.length
            } items</span>
          </div>
          <div class="checklist">
            ${
              this._materialsData.storage
                .map(
                  (item) => `
              <label class="checkbox-item">
                <input type="checkbox" />
                <span class="checkmark"></span>
                <span class="item-text">${item}</span>
              </label>
            `
                )
                .join("") ||
              '<div class="no-items">No storage materials listed</div>'
            }
          </div>
        </div>

        <!-- At Market -->
        <div class="material-card">
          <div class="card-header market">
            <h3>🌽 At Market - Setup</h3>
            <span class="count">${
              this._materialsData.atMarket.length
            } tasks</span>
          </div>
          <div class="checklist">
            ${
              this._materialsData.atMarket
                .map(
                  (item) => `
              <label class="checkbox-item">
                <input type="checkbox" />
                <span class="checkmark"></span>
                <span class="item-text">${item}</span>
              </label>
            `
                )
                .join("") ||
              '<div class="no-items">No market tasks listed</div>'
            }
          </div>
        </div>

        <!-- Back At Office -->
        <div class="material-card">
          <div class="card-header return">
            <h3>🔄 Back At Office - Return</h3>
            <span class="count">${
              this._materialsData.backAtOffice.length
            } tasks</span>
          </div>
          <div class="checklist">
            ${
              this._materialsData.backAtOffice
                .map(
                  (item) => `
              <label class="checkbox-item">
                <input type="checkbox" />
                <span class="checkmark"></span>
                <span class="item-text">${item}</span>
              </label>
            `
                )
                .join("") ||
              '<div class="no-items">No return tasks listed</div>'
            }
          </div>
        </div>
      </div>

      <div class="quick-actions">
        <button class="action-btn primary" onclick="window.print()">
          🖨️ Print Checklist
        </button>
        <button class="action-btn secondary" onclick="this.clearAll()">
          ↺ Reset All
        </button>
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
          background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
          min-height: 100%;
        }

        .materials-container {
          max-width: 1200px;
          margin: 0 auto;
        }

        .welcome-section {
          text-align: center;
          margin-bottom: 30px;
          background: white;
          padding: 30px;
          border-radius: 20px;
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
          border: 3px solid #28a745;
        }

        .welcome-section h2 {
          margin: 0 0 10px 0;
          color: #28a745;
          font-size: 2.2rem;
          font-weight: 600;
        }

        .welcome-section p {
          margin: 0;
          color: #666;
          font-size: 1.1rem;
        }

        .materials-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 25px;
          margin-bottom: 30px;
        }

        .material-card {
          background: white;
          border-radius: 15px;
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
          overflow: hidden;
          border: 2px solid #e9ecef;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .material-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 12px 35px rgba(0, 0, 0, 0.15);
        }

        .card-header {
          padding: 20px;
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .card-header.office {
          background: linear-gradient(135deg, #17a2b8, #138496);
        }

        .card-header.storage {
          background: linear-gradient(135deg, #6f42c1, #5a32a3);
        }

        .card-header.market {
          background: linear-gradient(135deg, #28a745, #20754a);
        }

        .card-header.return {
          background: linear-gradient(135deg, #dc3545, #b02a37);
        }

        .card-header h3 {
          margin: 0;
          font-size: 1.3rem;
          font-weight: 600;
        }

        .count {
          background: rgba(255, 255, 255, 0.2);
          padding: 5px 12px;
          border-radius: 20px;
          font-size: 0.9rem;
          font-weight: 500;
        }

        .checklist {
          padding: 25px;
        }

        .checkbox-item {
          display: flex;
          align-items: center;
          margin-bottom: 15px;
          cursor: pointer;
          transition: all 0.2s ease;
          padding: 8px;
          border-radius: 8px;
        }

        .checkbox-item:hover {
          background: #f8f9fa;
        }

        .checkbox-item input[type="checkbox"] {
          display: none;
        }

        .checkmark {
          width: 20px;
          height: 20px;
          border: 2px solid #ddd;
          border-radius: 4px;
          margin-right: 12px;
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
          font-size: 12px;
        }

        .checkbox-item input[type="checkbox"]:checked + .checkmark + .item-text {
          text-decoration: line-through;
          color: #6c757d;
        }

        .item-text {
          font-size: 1rem;
          color: #333;
          line-height: 1.4;
        }

        .no-items {
          color: #999;
          font-style: italic;
          text-align: center;
          padding: 20px;
        }

        .quick-actions {
          display: flex;
          justify-content: center;
          gap: 15px;
          margin-top: 30px;
        }

        .action-btn {
          padding: 15px 30px;
          border: none;
          border-radius: 10px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        }

        .action-btn.primary {
          background: linear-gradient(135deg, #28a745, #20754a);
          color: white;
        }

        .action-btn.primary:hover {
          background: linear-gradient(135deg, #20754a, #1e6040);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
        }

        .action-btn.secondary {
          background: linear-gradient(135deg, #6c757d, #545b62);
          color: white;
        }

        .action-btn.secondary:hover {
          background: linear-gradient(135deg, #545b62, #495057);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
          :host {
            padding: 15px;
          }

          .materials-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }

          .welcome-section {
            padding: 20px;
          }

          .welcome-section h2 {
            font-size: 1.8rem;
          }

          .card-header h3 {
            font-size: 1.1rem;
          }

          .quick-actions {
            flex-direction: column;
            align-items: center;
          }

          .action-btn {
            width: 200px;
          }
        }

        /* Print styles */
        @media print {
          :host {
            background: white;
            padding: 0;
          }

          .welcome-section {
            border: 2px solid #28a745;
            margin-bottom: 20px;
            box-shadow: none;
          }

          .material-card {
            break-inside: avoid;
            box-shadow: none;
            border: 2px solid #ddd;
            margin-bottom: 20px;
          }

          .card-header {
            -webkit-print-color-adjust: exact;
            color-adjust: exact;
          }

          .quick-actions {
            display: none;
          }
        }
      </style>

      <div class="materials-container">
        <!-- Content will be dynamically inserted here -->
      </div>
    `;
  }
}

customElements.define("reminders-page", RemindersPage);
