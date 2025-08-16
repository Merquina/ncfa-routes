class MaterialsPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.materials = {
      office: [],
      storage: [],
      atMarket: [],
      backAtOffice: []
    };
  }

  connectedCallback() {
    this.render();
    this.loadMaterials();
  }

  async loadMaterials() {
    try {
      console.log('[Materials] Loading materials data...');
      
      if (window.dataService && typeof window.dataService.loadApiData === 'function') {
        await window.dataService.loadApiData();
        console.log('[Materials] DataService loaded');
      }
      
      // Get materials from Misc sheet via sheetsAPI
      if (window.sheetsAPI && window.sheetsAPI.getRemindersForRoute) {
        console.log('[Materials] Getting reminders from sheetsAPI...');
        const reminderData = window.sheetsAPI.getRemindersForRoute({ type: 'spfm' });
        console.log('[Materials] Reminder data:', reminderData);
        
        if (reminderData) {
          this.materials = {
            office: reminderData.materials_office || [],
            storage: reminderData.materials_storage || [],
            atMarket: reminderData.atmarket || [],
            backAtOffice: reminderData.backatoffice || []
          };
          console.log('[Materials] Extracted materials:', this.materials);
        } else {
          console.warn('[Materials] No reminder data returned');
        }
      } else {
        console.warn('[Materials] sheetsAPI or getRemindersForRoute not available');
        this.showError('Sheets API not available. Please wait for data to load.');
        return;
      }
      
      this.render();
    } catch (error) {
      console.error('Error loading materials:', error);
      this.showError(`Failed to load materials data: ${error.message}`);
    }
  }

  showError(message) {
    const container = this.shadowRoot.querySelector('#container');
    if (container) {
      container.innerHTML = `<div style="padding:16px; color:#d32f2f; background:#ffebee; border-radius:4px; margin:16px;">${message}</div>`;
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          padding: 16px;
          font-family: var(--body-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
        }
        .header {
          margin-bottom: 24px;
          text-align: center;
        }
        .title {
          margin: 0 0 8px 0;
          color: #333;
          font-size: 1.5rem;
        }
        .subtitle {
          color: #666;
          margin: 0;
        }
        .sections {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }
        .section {
          background: #fff;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .section-title {
          margin: 0 0 16px 0;
          font-weight: 600;
          font-size: 1.1rem;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .checklist {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .checklist label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.95rem;
          cursor: pointer;
          padding: 8px;
          border-radius: 4px;
          transition: background-color 0.2s;
        }
        .checklist label:hover {
          background-color: #f5f5f5;
        }
        .checklist input[type="checkbox"] {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }
        .empty-state {
          color: #999;
          font-style: italic;
          text-align: center;
          padding: 20px;
        }
        .actions {
          margin-top: 24px;
          text-align: center;
        }
        .btn {
          background: #28a745;
          color: #fff;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 1rem;
          margin: 0 8px;
          transition: background-color 0.2s;
        }
        .btn:hover {
          background: #218838;
        }
        .btn.secondary {
          background: #6c757d;
        }
        .btn.secondary:hover {
          background: #5a6268;
        }
        @media (max-width: 768px) {
          .sections {
            grid-template-columns: 1fr;
          }
        }
      </style>
      <div id="container">
        <div class="header">
          <h1 class="title">📋 Materials Checklist</h1>
          <p class="subtitle">Track materials and tasks for SPFM routes</p>
        </div>
        
        <div class="sections">
          <!-- Office Materials Section -->
          <div class="section">
            <h2 class="section-title" style="color:#17a2b8;">
              📁 Office Materials
            </h2>
            <div class="checklist">
              ${this.materials.office.length ? 
                this.materials.office.map(item => `
                  <label>
                    <input type="checkbox" />
                    <span>${item}</span>
                  </label>
                `).join('') :
                '<div class="empty-state">No office materials listed</div>'
              }
            </div>
          </div>

          <!-- Storage Materials Section -->
          <div class="section">
            <h2 class="section-title" style="color:#17a2b8;">
              📦 Storage Materials
            </h2>
            <div class="checklist">
              ${this.materials.storage.length ? 
                this.materials.storage.map(item => `
                  <label>
                    <input type="checkbox" />
                    <span>${item}</span>
                  </label>
                `).join('') :
                '<div class="empty-state">No storage materials listed</div>'
              }
            </div>
          </div>

          <!-- At Market Section -->
          <div class="section">
            <h2 class="section-title" style="color:#28a745;">
              🌽 At Market
            </h2>
            <div class="checklist">
              ${this.materials.atMarket.length ? 
                this.materials.atMarket.map(item => `
                  <label>
                    <input type="checkbox" />
                    <span>${item}</span>
                  </label>
                `).join('') :
                '<div class="empty-state">No market tasks listed</div>'
              }
            </div>
          </div>

          <!-- Back at Office Section -->
          <div class="section">
            <h2 class="section-title" style="color:#dc3545;">
              ↩️ Back at Office
            </h2>
            <div class="checklist">
              ${this.materials.backAtOffice.length ? 
                this.materials.backAtOffice.map(item => `
                  <label>
                    <input type="checkbox" />
                    <span>${item}</span>
                  </label>
                `).join('') :
                '<div class="empty-state">No back-office tasks listed</div>'
              }
            </div>
          </div>
        </div>

        <div class="actions">
          <button class="btn" onclick="window.print()">🖨️ Print Checklist</button>
          <button class="btn secondary" onclick="this.getRootNode().host.clearAllChecks()">↺ Clear All</button>
        </div>
      </div>
    `;
  }

  clearAllChecks() {
    const checkboxes = this.shadowRoot.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => checkbox.checked = false);
  }
}

if (!customElements.get('materials-page')) {
  customElements.define('materials-page', MaterialsPage);
}

export default MaterialsPage;