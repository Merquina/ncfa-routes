class TimesheetPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.currentWeek = this.getWeekDates();
    this.timeEntries = {};
    this.initializeEmptyWeek();
  }

  connectedCallback() {
    console.log("Timesheet Page - connectedCallback");
    this.render();
    this.setupEventListeners();
    this.loadTimesheet();
  }

  getWeekDates() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1));

    const week = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      week.push(date);
    }
    return week;
  }

  initializeEmptyWeek() {
    this.currentWeek.forEach(date => {
      const dateKey = this.formatDateKey(date);
      if (!this.timeEntries[dateKey]) {
        this.timeEntries[dateKey] = {
          hours: "",
          notes: ""
        };
      }
    });
  }

  formatDateKey(date) {
    return date.toISOString().split('T')[0];
  }

  formatDateDisplay(date) {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  }

  async loadTimesheet() {
    try {
      // TODO: Load existing timesheet data from Google Sheets
      // For now, using mock data for demo
      console.log("Loading timesheet data...");
      this.renderTimeEntries();
    } catch (error) {
      console.error("Error loading timesheet:", error);
    }
  }

  setupEventListeners() {
    const submitBtn = this.shadowRoot.querySelector("#submitTimesheet");
    if (submitBtn) {
      submitBtn.addEventListener("click", () => this.submitTimesheet());
    }

    const prevWeekBtn = this.shadowRoot.querySelector("#prevWeek");
    const nextWeekBtn = this.shadowRoot.querySelector("#nextWeek");

    if (prevWeekBtn) {
      prevWeekBtn.addEventListener("click", () => this.changeWeek(-1));
    }

    if (nextWeekBtn) {
      nextWeekBtn.addEventListener("click", () => this.changeWeek(1));
    }

    // Listen to input changes
    this.shadowRoot.addEventListener("input", (e) => {
      if (e.target.classList.contains("hours-input") || e.target.classList.contains("notes-input")) {
        this.updateTimeEntry(e.target);
      }
    });
  }

  updateTimeEntry(input) {
    const dateKey = input.dataset.date;
    const field = input.classList.contains("hours-input") ? "hours" : "notes";

    if (!this.timeEntries[dateKey]) {
      this.timeEntries[dateKey] = { hours: "", notes: "" };
    }

    this.timeEntries[dateKey][field] = input.value;
    this.updateTotalHours();
  }

  updateTotalHours() {
    let total = 0;
    Object.values(this.timeEntries).forEach(entry => {
      const hours = parseFloat(entry.hours) || 0;
      total += hours;
    });

    const totalEl = this.shadowRoot.querySelector("#totalHours");
    if (totalEl) {
      totalEl.textContent = total.toFixed(1);
    }
  }

  changeWeek(direction) {
    const firstDay = this.currentWeek[0];
    firstDay.setDate(firstDay.getDate() + (direction * 7));
    this.currentWeek = this.getWeekDates();
    this.initializeEmptyWeek();
    this.render();
    this.setupEventListeners();
    this.loadTimesheet();
  }

  async submitTimesheet() {
    const userName = localStorage.getItem("gapi_user_name") || "Anonymous";

    // Validate that at least one day has hours
    const hasHours = Object.values(this.timeEntries).some(entry =>
      entry.hours && parseFloat(entry.hours) > 0
    );

    if (!hasHours) {
      alert("Please enter hours for at least one day before submitting.");
      return;
    }

    const submitBtn = this.shadowRoot.querySelector("#submitTimesheet");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="mdi mdi-loading mdi-spin"></i> Submitting...';
    }

    try {
      // TODO: Submit to Google Sheets
      const timesheetData = {
        userName,
        weekStart: this.formatDateKey(this.currentWeek[0]),
        weekEnd: this.formatDateKey(this.currentWeek[6]),
        entries: this.timeEntries,
        submittedAt: new Date().toISOString()
      };

      console.log("Submitting timesheet:", timesheetData);

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Show success message
      this.showSuccessMessage();

      // Clear entries after successful submission
      setTimeout(() => {
        this.timeEntries = {};
        this.initializeEmptyWeek();
        this.render();
        this.setupEventListeners();
        this.loadTimesheet();
      }, 2000);

    } catch (error) {
      console.error("Error submitting timesheet:", error);
      alert("Failed to submit timesheet. Please try again.");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="mdi mdi-send"></i> Submit Timesheet';
      }
    }
  }

  showSuccessMessage() {
    const container = this.shadowRoot.querySelector(".page-container");
    if (!container) return;

    const message = document.createElement("div");
    message.className = "success-toast";
    message.innerHTML = `
      <i class="mdi mdi-check-circle"></i>
      Timesheet submitted successfully!
    `;
    container.appendChild(message);

    setTimeout(() => {
      message.remove();
    }, 3000);
  }

  renderTimeEntries() {
    const container = this.shadowRoot.querySelector("#timeEntriesContainer");
    if (!container) return;

    container.innerHTML = this.currentWeek.map((date, index) => {
      const dateKey = this.formatDateKey(date);
      const entry = this.timeEntries[dateKey] || { hours: "", notes: "" };
      const isWeekend = index >= 5;

      return `
        <div class="day-entry ${isWeekend ? 'weekend' : ''}">
          <div class="day-header">
            <div class="day-name">${this.formatDateDisplay(date)}</div>
            ${isWeekend ? '<span class="weekend-badge">Weekend</span>' : ''}
          </div>

          <div class="entry-row">
            <div class="input-group">
              <label class="input-label">
                <i class="mdi mdi-clock-outline"></i>
                Hours
              </label>
              <input
                type="number"
                class="hours-input"
                data-date="${dateKey}"
                value="${entry.hours}"
                min="0"
                max="24"
                step="0.5"
                placeholder="0.0"
              />
            </div>

            <div class="input-group notes-group">
              <label class="input-label">
                <i class="mdi mdi-note-text-outline"></i>
                Notes
              </label>
              <input
                type="text"
                class="notes-input"
                data-date="${dateKey}"
                value="${entry.notes}"
                placeholder="What did you work on?"
              />
            </div>
          </div>
        </div>
      `;
    }).join('');

    this.updateTotalHours();
  }

  getWeekRange() {
    const start = this.currentWeek[0];
    const end = this.currentWeek[6];
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }

  render() {
    const userName = localStorage.getItem("gapi_user_name") || "Team Member";

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: var(--font-family, 'Atkinson Hyperlegible', sans-serif);
          font-size: var(--font-size-base, 1rem);
          line-height: var(--line-height, 1.5);
          letter-spacing: var(--letter-spacing, 0.025em);
        }

        .page-container {
          max-width: 900px;
          margin: 0 auto;
          padding: 20px;
        }

        .page-header {
          background: linear-gradient(135deg, #2c5282 0%, #3182ce 100%);
          color: white;
          padding: 24px;
          border-radius: 12px;
          margin-bottom: 24px;
          box-shadow: 0 4px 12px rgba(49, 130, 206, 0.3);
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }

        .page-title {
          margin: 0;
          font-size: var(--font-size-xl, 1.5rem);
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .user-name {
          font-size: 1rem;
          opacity: 0.9;
          font-weight: 500;
        }

        .week-navigation {
          display: flex;
          align-items: center;
          gap: 16px;
          background: rgba(255, 255, 255, 0.2);
          padding: 12px 16px;
          border-radius: 8px;
        }

        .week-nav-btn {
          background: rgba(255, 255, 255, 0.9);
          color: #2c5282;
          border: none;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 1.2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .week-nav-btn:hover {
          background: white;
          transform: scale(1.1);
        }

        .week-range {
          font-size: 1.1rem;
          font-weight: 600;
          min-width: 200px;
          text-align: center;
        }

        .time-entries {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          margin-bottom: 20px;
        }

        .day-entry {
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 12px;
          transition: all 0.2s ease;
        }

        .day-entry:hover {
          border-color: #3182ce;
          box-shadow: 0 2px 8px rgba(49, 130, 206, 0.1);
        }

        .day-entry.weekend {
          background: #f8f9fa;
          border-color: #ddd;
        }

        .day-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #e0e0e0;
        }

        .day-name {
          font-size: 1.1rem;
          font-weight: 700;
          color: #1a365d;
        }

        .weekend-badge {
          background: #e3f2fd;
          color: #1976d2;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 0.85rem;
          font-weight: 600;
        }

        .entry-row {
          display: grid;
          grid-template-columns: 120px 1fr;
          gap: 16px;
          align-items: start;
        }

        .input-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .input-label {
          font-size: 0.9rem;
          font-weight: 600;
          color: #666;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .input-label i {
          font-size: 1rem;
        }

        .hours-input,
        .notes-input {
          padding: 10px 12px;
          border: 2px solid #e0e0e0;
          border-radius: 6px;
          font-family: inherit;
          font-size: 1rem;
          transition: border-color 0.2s ease;
        }

        .hours-input {
          width: 100%;
          text-align: center;
          font-weight: 600;
          font-size: 1.1rem;
        }

        .notes-input {
          width: 100%;
        }

        .hours-input:focus,
        .notes-input:focus {
          outline: none;
          border-color: #3182ce;
        }

        .summary-section {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          margin-bottom: 20px;
        }

        .total-hours {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: linear-gradient(135deg, #e3f2fd 0%, #f0f8ff 100%);
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .total-label {
          font-size: 1.1rem;
          font-weight: 700;
          color: #1a365d;
        }

        .total-value {
          font-size: 2rem;
          font-weight: 700;
          color: #3182ce;
        }

        .total-unit {
          font-size: 1rem;
          color: #666;
          margin-left: 4px;
        }

        .submit-section {
          text-align: center;
        }

        #submitTimesheet {
          background: linear-gradient(135deg, #28a745 0%, #218838 100%);
          color: white;
          border: none;
          padding: 16px 32px;
          border-radius: 8px;
          font-family: inherit;
          font-size: 1.1rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        #submitTimesheet:hover:not(:disabled) {
          background: linear-gradient(135deg, #218838 0%, #1e7e34 100%);
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(40, 167, 69, 0.4);
        }

        #submitTimesheet:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .success-toast {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: #28a745;
          color: white;
          padding: 20px 32px;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          font-size: 1.2rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 12px;
          z-index: 2000;
          animation: slideIn 0.3s ease;
        }

        .success-toast i {
          font-size: 1.5rem;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }

        @media (max-width: 600px) {
          .page-container {
            padding: 12px;
          }

          .page-header {
            padding: 16px;
          }

          .header-content {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
          }

          .entry-row {
            grid-template-columns: 1fr;
            gap: 12px;
          }

          .week-range {
            font-size: 0.95rem;
            min-width: 150px;
          }

          .week-nav-btn {
            width: 32px;
            height: 32px;
          }
        }
      </style>

      <div class="page-container">
        <div class="page-header">
          <div class="header-content">
            <div>
              <h2 class="page-title">
                <i class="mdi mdi-clipboard-clock-outline"></i>
                Timesheet
              </h2>
              <div class="user-name">${userName}</div>
            </div>
          </div>

          <div class="week-navigation">
            <button id="prevWeek" class="week-nav-btn" title="Previous week">
              <i class="mdi mdi-chevron-left"></i>
            </button>
            <div class="week-range">${this.getWeekRange()}</div>
            <button id="nextWeek" class="week-nav-btn" title="Next week">
              <i class="mdi mdi-chevron-right"></i>
            </button>
          </div>
        </div>

        <div class="time-entries" id="timeEntriesContainer">
          <!-- Time entries will be rendered here -->
        </div>

        <div class="summary-section">
          <div class="total-hours">
            <span class="total-label">Total Hours This Week</span>
            <div>
              <span class="total-value" id="totalHours">0.0</span>
              <span class="total-unit">hours</span>
            </div>
          </div>

          <div class="submit-section">
            <button id="submitTimesheet">
              <i class="mdi mdi-send"></i>
              Submit Timesheet
            </button>
          </div>
        </div>
      </div>
    `;

    // Render time entries after initial render
    this.renderTimeEntries();
  }
}

customElements.define("timesheet-page", TimesheetPage);
