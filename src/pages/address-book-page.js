class AddressBookPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.contacts = [];
  }

  connectedCallback() {
    this.render();
    this.loadContacts();
  }

  async loadContacts() {
    try {
      // Get contacts from sheetsAPI
      if (window.sheetsAPI && window.sheetsAPI.contactsData) {
        this.contacts = window.sheetsAPI.contactsData.filter(c => {
          // Only include contacts with location
          return c.Location || c.location;
        });
        this.renderContacts();
      }

      // Listen for data updates
      if (window.dataService) {
        window.dataService.addEventListener('data-loaded', () => {
          if (window.sheetsAPI && window.sheetsAPI.contactsData) {
            this.contacts = window.sheetsAPI.contactsData.filter(c => {
              return c.Location || c.location;
            });
            this.renderContacts();
          }
        });
      }
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  }

  renderContacts() {
    const container = this.shadowRoot.querySelector('#contactsList');
    if (!container) return;

    if (this.contacts.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666;">
          <i class="mdi mdi-account-off" style="font-size: 3rem; margin-bottom: 10px; display: block;"></i>
          <p>No contacts available</p>
        </div>
      `;
      return;
    }

    // Sort contacts by location name
    const sorted = [...this.contacts].sort((a, b) => {
      const nameA = (a.Location || a.location || '').toLowerCase();
      const nameB = (b.Location || b.location || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    container.innerHTML = sorted.map(contact => this.renderContactCard(contact)).join('');
  }

  renderContactCard(contact) {
    const location = contact.Location || contact.location || 'Unknown';
    const address = contact.Address || contact.address || '';
    const type = contact.Type || contact.type || contact.TYPE || '';
    const job = contact.Job || contact.job || contact.JOB || '';
    const notes = contact['Notes/ Special Instructions'] || contact.Notes || contact.notes || '';

    // Get all contacts and phones
    const contacts = this.getAllContacts(contact);
    const phones = this.getAllPhones(contact);

    return `
      <div class="contact-card">
        <div class="contact-header">
          <h3 class="contact-title">
            <i class="mdi mdi-map-marker" style="color: #3182ce;"></i>
            ${location}
          </h3>
          ${type ? `<span class="contact-type">${type}</span>` : ''}
        </div>

        ${address ? `
          <div class="contact-row">
            <i class="mdi mdi-home-map-marker"></i>
            <span>${address}</span>
          </div>
        ` : ''}

        ${contacts.length > 0 ? `
          <div class="contact-row">
            <i class="mdi mdi-account"></i>
            <div>
              ${contacts.map((c, i) => `
                <div style="margin-bottom: 4px;">
                  <strong>${c}</strong>
                  ${phones[i] ? `<a href="tel:${phones[i]}" class="phone-link"><i class="mdi mdi-phone"></i> ${phones[i]}</a>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${job ? `
          <div class="contact-row">
            <i class="mdi mdi-briefcase"></i>
            <span>${job}</span>
          </div>
        ` : ''}

        ${notes ? `
          <div class="notes-section">
            <div class="notes-header">
              <i class="mdi mdi-note-text"></i>
              <strong>Notes / Special Instructions</strong>
            </div>
            <div class="notes-content">${notes}</div>
          </div>
        ` : ''}

        <div class="contact-actions">
          ${address ? `
            <button class="action-btn" onclick="window.open('https://maps.google.com/maps?q=${encodeURIComponent(address)}', '_blank')">
              <i class="mdi mdi-map"></i> Directions
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  getAllContacts(contact) {
    const contacts = [];
    let i = 1;
    while (contact[`contact${i}`] || contact[`Contact${i}`]) {
      const contactPerson = (contact[`contact${i}`] || contact[`Contact${i}`] || '').trim();
      if (contactPerson) contacts.push(contactPerson);
      i++;
    }
    // Fallback to single contact field
    if (contacts.length === 0 && (contact.Contact || contact.contact)) {
      const single = String(contact.Contact || contact.contact).trim();
      if (single) contacts.push(single);
    }
    return contacts;
  }

  getAllPhones(contact) {
    const phones = [];
    let i = 1;
    while (contact[`phone${i}`] || contact[`Phone${i}`]) {
      const phone = (contact[`phone${i}`] || contact[`Phone${i}`] || '').trim();
      if (phone) phones.push(phone);
      i++;
    }
    // Fallback to single phone field
    if (phones.length === 0 && (contact.Phone || contact.phone)) {
      const single = String(contact.Phone || contact.phone).trim();
      if (single) phones.push(single);
    }
    return phones;
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: var(--font-family, 'OpenDyslexic', 'Comic Sans MS', 'Trebuchet MS', 'Verdana', 'Arial', sans-serif);
          font-size: var(--font-size-base, 1rem);
          line-height: var(--line-height, 1.5);
          letter-spacing: var(--letter-spacing, 0.025em);
        }

        .page-header {
          text-align: center;
          margin-bottom: 20px;
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .page-title {
          margin: 0;
          color: #333;
          font-size: var(--font-size-xl, 1.5rem);
          font-weight: 600;
        }

        .page-description {
          margin: 8px 0 0 0;
          color: #666;
          font-size: var(--font-size-base, 1rem);
        }

        #contactsList {
          max-width: 800px;
          margin: 0 auto;
        }

        .contact-card {
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .contact-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        .contact-title {
          margin: 0;
          color: #1a365d;
          font-size: var(--font-size-large, 1.25rem);
          font-weight: 600;
        }

        .contact-type {
          background: #e3f2fd;
          color: #1976d2;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: var(--font-size-small, 0.875rem);
          font-weight: 500;
        }

        .contact-row {
          display: flex;
          gap: 8px;
          margin-bottom: 8px;
          color: #555;
        }

        .contact-row i {
          color: #666;
          flex-shrink: 0;
          margin-top: 2px;
        }

        .phone-link {
          color: #3182ce;
          text-decoration: none;
          margin-left: 8px;
          font-weight: 500;
        }

        .phone-link:hover {
          text-decoration: underline;
        }

        .notes-section {
          margin-top: 12px;
          padding: 12px;
          background: #f8f9fa;
          border-radius: 6px;
          border-left: 3px solid #3182ce;
        }

        .notes-header {
          display: flex;
          gap: 6px;
          align-items: center;
          color: #333;
          margin-bottom: 6px;
          font-weight: 600;
        }

        .notes-header i {
          color: #3182ce;
        }

        .notes-content {
          color: #555;
          line-height: 1.6;
          white-space: pre-wrap;
        }

        .contact-actions {
          margin-top: 12px;
          display: flex;
          gap: 8px;
        }

        .action-btn {
          background: #3182ce;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-family: inherit;
          font-size: var(--font-size-base, 1rem);
          font-weight: 600;
          transition: background 0.2s ease;
        }

        .action-btn:hover {
          background: #2c5282;
        }

        .action-btn i {
          margin-right: 4px;
        }

        @media (max-width: 600px) {
          .page-header {
            padding: 15px;
            margin-bottom: 15px;
          }

          .page-title {
            font-size: var(--font-size-large, 1.25rem);
          }

          .contact-card {
            padding: 12px;
          }

          .contact-header {
            flex-direction: column;
            gap: 8px;
          }
        }
      </style>

      <div class="page-header">
        <h2 class="page-title"><i class="mdi mdi-book-open-page-variant"></i> Address Book</h2>
        <p class="page-description">All locations with contact information and notes</p>
      </div>

      <div id="contactsList">
        <div style="text-align: center; padding: 40px; color: #666;">
          <i class="mdi mdi-loading mdi-spin" style="font-size: 2rem;"></i>
          <p>Loading contacts...</p>
        </div>
      </div>
    `;
  }
}

customElements.define('address-book-page', AddressBookPage);
