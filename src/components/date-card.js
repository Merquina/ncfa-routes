class DateCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.dateData = null;
  }

  static get observedAttributes() {
    return ['date-data', 'variant'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      if (name === 'date-data') {
        try {
          this.dateData = JSON.parse(newValue || 'null');
        } catch (e) {
          this.dateData = null;
        }
      }
      this.render();
    }
  }

  connectedCallback() {
    this.render();
  }

  setDate(dateData) {
    this.dateData = dateData;
    this.setAttribute('date-data', JSON.stringify(dateData));
  }

  formatDate(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (e) {
      return dateString;
    }
  }

  isUpcoming(dateString) {
    try {
      const date = new Date(dateString);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return date >= today;
    } catch (e) {
      return false;
    }
  }

  handleDateClick() {
    this.dispatchEvent(new CustomEvent('date-selected', {
      detail: { 
        date: this.dateData?.date,
        dateData: this.dateData 
      },
      bubbles: true
    }));
  }

  render() {
    if (!this.dateData) {
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
            font-family: var(--body-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
          }
        </style>
        <div>No date data</div>
      `;
      return;
    }

    const variant = this.getAttribute('variant') || 'default';
    const isUpcoming = this.isUpcoming(this.dateData.date);
    const routeCount = this.dateData.routes?.length || 0;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: var(--body-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
        }
        .date-card {
          background: white;
          border: 2px solid #ddd;
          border-radius: 12px;
          padding: 16px;
          margin: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: center;
          user-select: none;
          min-width: 120px;
        }
        .date-card:hover {
          border-color: #007bff;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,123,255,0.15);
        }
        .date-card.upcoming {
          border-color: #28a745;
          background: linear-gradient(135deg, #fff 0%, #f8fff9 100%);
        }
        .date-card.upcoming:hover {
          border-color: #20c997;
          box-shadow: 0 4px 12px rgba(40,167,69,0.2);
        }
        .date-card.past {
          opacity: 0.7;
          border-color: #6c757d;
        }
        .date-card.past:hover {
          border-color: #495057;
        }
        .date-display {
          font-size: 1.1rem;
          font-weight: bold;
          color: #333;
          margin-bottom: 8px;
        }
        .route-count {
          font-size: 0.9rem;
          color: #666;
          margin-bottom: 4px;
        }
        .route-badge {
          background: #007bff;
          color: white;
          border-radius: 12px;
          padding: 2px 8px;
          font-size: 0.8rem;
          font-weight: 500;
        }
        .upcoming .route-badge {
          background: #28a745;
        }
        .past .route-badge {
          background: #6c757d;
        }
        .market-info {
          font-size: 0.8rem;
          color: #666;
          margin-top: 8px;
        }
        .compact {
          padding: 8px;
          min-width: 80px;
        }
        .compact .date-display {
          font-size: 0.9rem;
          margin-bottom: 4px;
        }
        .compact .route-count {
          font-size: 0.8rem;
        }
      </style>

      <div class="date-card ${isUpcoming ? 'upcoming' : 'past'} ${variant === 'compact' ? 'compact' : ''}">
        <div class="date-display">
          📅 ${this.formatDate(this.dateData.date)}
        </div>
        
        <div class="route-count">
          <span class="route-badge">${routeCount} routes</span>
        </div>

        ${this.dateData.market && variant !== 'compact' ? `
          <div class="market-info">
            ${this.dateData.market}
          </div>
        ` : ''}
      </div>
    `;

    // Add click event listener
    this.shadowRoot.querySelector('.date-card').addEventListener('click', () => {
      this.handleDateClick();
    });
  }
}

customElements.define('date-card', DateCard);