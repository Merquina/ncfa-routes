class InventoryComponent extends HTMLElement {
  constructor() {
    super();
    this.inventoryData = {
      smallBoxes: 0,
      largeBoxes: 0,
      lastUpdated: null,
      updatedBy: null
    };
    
    // Default box configuration - can be overridden
    this.boxConfig = {
      small: {
        label: 'small',
        description: '5/9 bushel',
        farmersRatio: 2
      },
      large: {
        label: 'LARGE',
        description: '1 1/9 bushel',
        farmersRatio: 1
      }
    };
    
    this.isLoading = false;
    this.attachShadow({ mode: 'open' });
  }

  static get observedAttributes() {
    return ['small-boxes', 'large-boxes', 'last-updated', 'updated-by', 'box-config'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      if (name === 'box-config') {
        try {
          this.boxConfig = { ...this.boxConfig, ...JSON.parse(newValue || '{}') };
        } catch (e) {
          console.error('Invalid box config:', e);
        }
      }
      this.render();
    }
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
    this.loadInventoryData();
  }

  // ========================================
  // PUBLIC API METHODS
  // ========================================

  async loadInventoryData() {
    if (this.isLoading) return;
    
    this.isLoading = true;
    this.showLoading();

    try {
      // Use data service to get inventory
      if (window.dataService) {
        const inventory = await window.dataService.getInventory();
        this.setInventoryData(inventory);
      }
    } catch (error) {
      console.error('Error loading inventory:', error);
      this.showError('Failed to load inventory data');
    } finally {
      this.isLoading = false;
    }
  }

  setInventoryData(data) {
    this.inventoryData = { ...this.inventoryData, ...data };
    this.updateAttributes();
    this.render();
  }

  getInventoryData() {
    return { ...this.inventoryData };
  }

  updateAttributes() {
    this.setAttribute('small-boxes', this.inventoryData.smallBoxes);
    this.setAttribute('large-boxes', this.inventoryData.largeBoxes);
    if (this.inventoryData.lastUpdated) {
      this.setAttribute('last-updated', this.inventoryData.lastUpdated);
    }
    if (this.inventoryData.updatedBy) {
      this.setAttribute('updated-by', this.inventoryData.updatedBy);
    }
  }

  saveToLocalStorage() {
    try {
      localStorage.setItem('spfm_inventory', JSON.stringify(this.inventoryData));
    } catch (error) {
      console.error('Error saving inventory to localStorage:', error);
    }
  }

  async updateInventory(smallBoxes, largeBoxes, updatedBy = 'User') {
    if (this.isLoading) return;

    this.isLoading = true;
    this.showLoading();

    try {
      // Use data service to update inventory
      if (window.dataService) {
        const updatedInventory = await window.dataService.updateInventory(smallBoxes, largeBoxes, updatedBy);
        this.setInventoryData(updatedInventory);
        
        // Emit component-level event
        this.dispatchEvent(new CustomEvent('inventory-changed', {
          detail: { ...updatedInventory },
          bubbles: true
        }));
      }
    } catch (error) {
      console.error('Error updating inventory:', error);
      this.showError('Failed to update inventory');
    } finally {
      this.isLoading = false;
    }
  }

  setBoxConfig(config) {
    this.boxConfig = { ...this.boxConfig, ...config };
    this.setAttribute('box-config', JSON.stringify(this.boxConfig));
  }

  showLoading() {
    // You could show a loading spinner here
    this.render();
  }

  showError(message) {
    // You could show an error state here
    console.error(message);
    this.render();
  }

  calculateBoxes(farmers) {
    const farmersCount = parseInt(farmers) || 1;
    const smallNeeded = farmersCount * this.boxConfig.small.farmersRatio;
    const largeNeeded = farmersCount * this.boxConfig.large.farmersRatio;
    
    return {
      small: {
        needed: smallNeeded,
        available: this.inventoryData.smallBoxes,
        sufficient: this.inventoryData.smallBoxes >= smallNeeded
      },
      large: {
        needed: largeNeeded,
        available: this.inventoryData.largeBoxes,
        sufficient: this.inventoryData.largeBoxes >= largeNeeded
      }
    };
  }

  setupEventListeners() {
    const shadow = this.shadowRoot;
    
    // Update button handler
    const updateBtn = shadow.querySelector('#updateBtn');
    if (updateBtn) {
      updateBtn.addEventListener('click', () => {
        const smallInput = shadow.querySelector('#updateSmallBoxes');
        const largeInput = shadow.querySelector('#updateLargeBoxes');
        const nameInput = shadow.querySelector('#updateName');
        
        if (smallInput && largeInput && nameInput) {
          // Prefer signed-in Google name from localStorage, then input, then Anonymous
          let userName = nameInput.value.trim();
          try {
            const stored = localStorage.getItem('gapi_user_name');
            if (!userName && stored) userName = stored;
          } catch {}
          if (!userName) userName = 'Anonymous';
          this.updateInventory(smallInput.value, largeInput.value, userName);
        }
      });
    }

    // Calculator input handlers
    const farmersInput = shadow.querySelector('#farmersInput');
    const smallBoxesCalcInput = shadow.querySelector('#smallBoxesCalcInput');
    const largeBoxesCalcInput = shadow.querySelector('#largeBoxesCalcInput');
    
    [farmersInput, smallBoxesCalcInput, largeBoxesCalcInput].forEach(input => {
      if (input) {
        input.addEventListener('input', () => {
          this.updateDistributionCalculator();
        });
      }
    });
  }

  // Ensure section titles are visible at top when interacting
  attachSectionScrollHandlers() {
    const sections = this.shadowRoot.querySelectorAll('.section');
    sections.forEach(sec => {
      const scrollToTop = () => {
        try { sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch {}
      };
      sec.addEventListener('focusin', scrollToTop);
      sec.addEventListener('click', (e) => {
        // Only scroll if clicking inside inputs/interactive areas
        const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
        if (['input','button','select','textarea','label'].includes(tag)) scrollToTop();
      });
    });
  }

  updateDistributionCalculator() {
    const shadow = this.shadowRoot;
    const farmersInput = shadow.querySelector('#farmersInput');
    const smallBoxesInput = shadow.querySelector('#smallBoxesCalcInput');
    const largeBoxesInput = shadow.querySelector('#largeBoxesCalcInput');
    const resultDiv = shadow.querySelector('#calculationResult');
    const distributionText = shadow.querySelector('#distributionText');
    
    if (!farmersInput || !smallBoxesInput || !largeBoxesInput || !resultDiv) return;
    
    const farmers = parseInt(farmersInput.value) || 1;
    const smallBoxes = parseInt(smallBoxesInput.value) || 0;
    const largeBoxes = parseInt(largeBoxesInput.value) || 0;
    
    if (smallBoxes === 0 && largeBoxes === 0) {
      resultDiv.style.display = 'none';
      return;
    }
    
    // Calculate distribution
    const smallPerFarmer = Math.floor(smallBoxes / farmers);
    const largePerFarmer = Math.floor(largeBoxes / farmers);
    const smallRemainder = smallBoxes % farmers;
    const largeRemainder = largeBoxes % farmers;
    
    let distributionHTML = '';
    
    if (smallPerFarmer > 0 || largePerFarmer > 0) {
      distributionHTML = `<div style="font-size: 0.9rem; margin: 4px 0;">`;
      
      if (smallPerFarmer > 0 && largePerFarmer > 0) {
        distributionHTML += `${smallPerFarmer} small + ${largePerFarmer} LARGE box${largePerFarmer !== 1 ? 'es' : ''}`;
      } else if (smallPerFarmer > 0) {
        distributionHTML += `${smallPerFarmer} small box${smallPerFarmer !== 1 ? 'es' : ''}`;
      } else if (largePerFarmer > 0) {
        distributionHTML += `${largePerFarmer} LARGE box${largePerFarmer !== 1 ? 'es' : ''}`;
      }
      
      distributionHTML += `</div>`;
      
      // Show remainder if any
      if (smallRemainder > 0 || largeRemainder > 0) {
        distributionHTML += `<div style="font-size: 0.8rem; color: #666; margin: 2px 0;">Remaining: `;
        const remainderParts = [];
        if (smallRemainder > 0) remainderParts.push(`${smallRemainder} small`);
        if (largeRemainder > 0) remainderParts.push(`${largeRemainder} LARGE`);
        distributionHTML += remainderParts.join(' + ') + `</div>`;
      }
    } else {
      distributionHTML = `<div style="font-size: 0.9rem; color: #888;">Not enough boxes for equal distribution</div>`;
    }
    
    if (distributionText) {
      distributionText.innerHTML = distributionHTML;
    }
    
    resultDiv.style.display = 'block';
  }

  // Keep the old calculator for compatibility but rename it
  updateCalculator() {
    this.updateDistributionCalculator();
  }

  render() {
    const smallBoxes = this.getAttribute('small-boxes') || this.inventoryData.smallBoxes;
    const largeBoxes = this.getAttribute('large-boxes') || this.inventoryData.largeBoxes;
    const lastUpdated = this.getAttribute('last-updated') || this.inventoryData.lastUpdated;
    const updatedBy = this.getAttribute('updated-by') || this.inventoryData.updatedBy;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: var(--body-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
        }
        .section {
          margin-bottom: 10px;
          margin-top: 2px;
          padding: 10px;
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          width: 100%;
          max-width: 100vw;
          box-sizing: border-box;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          margin-top: 5px;
        }
        .box-card {
          text-align: center;
          padding: 8px;
          background: #f8f9fa;
          border: 1px solid #ddd;
          border-radius: 8px;
        }
        .box-count {
          font-size: 1.2rem;
          font-weight: bold;
          color: #333;
          line-height: 1;
          margin-bottom: 2px;
        }
        .box-label {
          font-size: 0.75rem;
          color: #666;
          line-height: 1;
          margin-bottom: 1px;
        }
        .box-size {
          font-size: 0.6rem;
          color: #999;
          line-height: 1;
        }
        .timestamp {
          text-align: center;
          margin-top: 5px;
          color: #666;
          font-size: 0.7rem;
          line-height: 1;
        }
        .form-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 8px;
        }
        .form-label {
          flex: 1;
          font-size: 0.9rem;
        }
        .form-input {
          width: 60px;
          height: 40px;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          text-align: center;
          font-size: 1.0rem;
        }
        .btn {
          background: #28a745;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.9rem;
        }
        .btn:hover {
          background: #218838;
        }
        .calculation-result {
          padding: 2px;
          background: #e8f5e8;
          border-radius: 4px;
          margin-top: 2px;
          display: none;
        }
      </style>

      <!-- Box Inventory Section -->
      <div class="section">
        <h4>📦 Box Inventory</h4>
        <div class="grid-2">
          <div class="box-card">
            <div class="box-count">${smallBoxes}</div>
            <div class="box-label">${this.boxConfig.small.label}</div>
            <div class="box-size">${this.boxConfig.small.description}</div>
          </div>
          <div class="box-card">
            <div class="box-count">${largeBoxes}</div>
            <div class="box-label">${this.boxConfig.large.label}</div>
            <div class="box-size">${this.boxConfig.large.description}</div>
          </div>
        </div>
        ${lastUpdated ? `
          <div class="timestamp">
            Last updated by ${updatedBy} at ${lastUpdated}
          </div>
        ` : `
          <div class="timestamp">No updates yet</div>
        `}
      </div>

      <!-- Box Calculator Section -->
      <div class="section">
        <h4>🧮 Box Calculator</h4>
        <div style="display: grid; gap: 8px; margin-top: 5px;">
          <div class="form-row">
            <label class="form-label">How many farmers:</label>
            <input type="number" id="farmersInput" min="1" value="1" inputmode="numeric" class="form-input" onfocus="this.select()">
          </div>
          <div class="form-row">
            <label class="form-label">How many small boxes:</label>
            <input type="number" id="smallBoxesCalcInput" min="0" value="0" inputmode="numeric" class="form-input" onfocus="this.select()">
          </div>
          <div class="form-row">
            <label class="form-label">How many LARGE boxes:</label>
            <input type="number" id="largeBoxesCalcInput" min="0" value="0" inputmode="numeric" class="form-input" onfocus="this.select()">
          </div>
          <div id="calculationResult" class="calculation-result">
            <h4 style="margin: 2px 0; font-size: 0.9rem;">Give to each farmer:</h4>
            <div id="distributionText" style="margin: 2px 0;"></div>
          </div>
        </div>
      </div>

      <!-- Update Inventory Section -->
      <div class="section">
        <h4>📝 Update Inventory</h4>
        <div style="display: grid; gap: 8px; margin-top: 5px;">
          <div class="form-row">
            <label class="form-label" style="font-size: 0.85rem; font-weight: normal;">small boxes:</label>
            <input type="number" id="updateSmallBoxes" min="0" value="${smallBoxes}" inputmode="numeric" class="form-input" onfocus="this.select()">
          </div>
          <div class="form-row">
            <label class="form-label" style="font-size: 0.85rem; font-weight: normal;">LARGE boxes:</label>
            <input type="number" id="updateLargeBoxes" min="0" value="${largeBoxes}" inputmode="numeric" class="form-input" onfocus="this.select()">
          </div>
          <div class="form-row">
            <label class="form-label" style="font-size: 0.85rem; font-weight: normal;">Your name:</label>
            <input type="text" id="updateName" placeholder="Enter your name" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.9rem;">
          </div>
          <button id="updateBtn" class="btn" style="margin-top: 5px; font-size: 0.9rem;">📊 Update & Share Inventory</button>
        </div>
      </div>
    `;

    // Re-setup event listeners after render
    this.setupEventListeners();
    // Update calculator display
    this.updateCalculator();
    // Attach scroll helpers for sections
    this.attachSectionScrollHandlers();
  }
}

customElements.define('inventory-component', InventoryComponent);
