/**
 * Routes Page - Displays route templates from the Routes sheet
 * Shows all periodic routes (Monday, Tuesday, etc.) without requiring Sunday SPFM linking
 */
class RoutesPage extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.routes = [];
  }

  connectedCallback() {
    this.render();
    this.loadRoutes();
  }

  async loadRoutes() {
    const container = this.shadowRoot.querySelector(".routes-container");

    try {
      console.log("🔄 Loading routes...");

      // Wait for data service to be available
      if (!window.dataService) {
        console.log("⏳ Waiting for dataService...");
        setTimeout(() => this.loadRoutes(), 100);
        return;
      }

      console.log("✅ DataService available");

      // Ensure API data is loaded
      console.log("📊 Ensuring API data loaded...");
      await window.dataService._ensureApiLoaded();

      // Get template routes directly from sheetsAPI
      const sheetsAPI = window.sheetsAPI;
      console.log("🧭 SheetsAPI status:", !!sheetsAPI);
      console.log("📋 Routes data available:", !!sheetsAPI?.routesData);
      console.log("📏 Routes data length:", sheetsAPI?.routesData?.length || 0);

      if (!sheetsAPI || !Array.isArray(sheetsAPI.routesData)) {
        console.warn("❌ No routes data available from sheetsAPI");
        this.showError(
          "No routes data available. Check Google Sheets connection."
        );
        return;
      }

      this.routes = sheetsAPI.routesData;
      console.log("✅ Routes loaded:", this.routes.length, "items");
      this.renderRoutes();
    } catch (error) {
      console.error("❌ Failed to load routes:", error);
      this.showError(`Failed to load routes data: ${error.message}`);
    }
  }

  renderRoutes() {
    const container = this.shadowRoot.querySelector(".routes-list");
    if (!container) return;

    console.log("🎨 Rendering routes...", this.routes.length, "total");

    if (this.routes.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <p>No route templates found</p>
          <p style="font-size: 0.8rem; color: #666;">Check if Routes sheet contains weekday data</p>
        </div>
      `;
      return;
    }

    // Group routes by weekday
    const weekdays = [
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    const routesByDay = {};

    this.routes.forEach((route) => {
      // Debug each route
      const weekday = route.Weekday || route.weekday || route.day || "Unknown";
      console.log("📅 Route weekday:", weekday, "from route:", route);

      if (!routesByDay[weekday]) {
        routesByDay[weekday] = [];
      }
      routesByDay[weekday].push(route);
    });

    console.log("📊 Routes grouped by day:", routesByDay);

    // Render routes grouped by day
    let html = "";
    let renderedDays = 0;

    weekdays.forEach((day) => {
      const dayRoutes = routesByDay[day];
      if (!dayRoutes || dayRoutes.length === 0) return;

      renderedDays++;
      console.log(`📅 Rendering ${day}: ${dayRoutes.length} routes`);

      html += `<div class="day-group">
        <h3 class="day-header">${day} (${dayRoutes.length})</h3>
        <div class="day-routes">`;

      dayRoutes.forEach((route) => {
        const routeId = route.routeID || route.routeId || route.id || "";
        const routeType = route.routeType || route.type || "SPFM";
        const market = route.market || route.Market || route.location || "";
        const startTime = route.startTime || route.Time || route.time || "";
        const worker1 = route.worker1 || "";
        const worker2 = route.worker2 || "";
        const van1 = route.van1 || "";

        // Collect stops
        const stops = [];
        for (let i = 1; i <= 9; i++) {
          const stop = route[`stop${i}`] || route[`Stop ${i}`];
          if (stop && stop.trim()) {
            stops.push(stop.trim());
          }
        }

        // Determine route type styling
        let typeClass = "spfm";
        let typeLabel = routeType;
        if (routeType.toLowerCase().includes("recovery")) {
          typeClass = "recovery";
          typeLabel = "Recovery";
        } else if (routeType.toLowerCase().includes("delivery")) {
          typeClass = "delivery";
          typeLabel = "SPFM Delivery";
        }

        html += `
          <div class="route-card">
            <div class="route-header">
              <span class="route-id">#${routeId}</span>
              <span class="route-type ${typeClass}">${typeLabel}</span>
            </div>
            <div class="route-info">
              ${
                market
                  ? `<div class="route-market"><strong>${market}</strong></div>`
                  : ""
              }
              ${
                startTime ? `<div class="route-time">🕐 ${startTime}</div>` : ""
              }
              ${
                worker1
                  ? `<div class="route-worker">👤 ${worker1}${
                      worker2 ? ", " + worker2 : ""
                    }</div>`
                  : ""
              }
              ${van1 ? `<div class="route-van">🚐 ${van1}</div>` : ""}
            </div>
            ${
              stops.length > 0
                ? `
              <div class="route-stops">
                <div class="stops-label">📍 ${stops.length}:</div>
                <ol class="stops-list">
                  ${stops.map((stop) => `<li>${stop}</li>`).join("")}
                </ol>
              </div>
            `
                : ""
            }
          </div>
        `;
      });

      html += `</div></div>`;
    });

    // Show debug info if no days rendered
    if (renderedDays === 0) {
      html = `
        <div class="error-state">
          <div class="error-icon">⚠️</div>
          <h3>No Weekday Routes Found</h3>
          <p>Found ${this.routes.length} routes, but none have weekday data.</p>
          <details style="margin-top: 12px; font-size: 0.8rem;">
            <summary>Debug Info</summary>
            <pre>${JSON.stringify(this.routes.slice(0, 3), null, 2)}</pre>
          </details>
        </div>
      `;
    }

    console.log("✅ Routes rendered:", renderedDays, "days");
    container.innerHTML = html;
  }

  showError(message) {
    const container = this.shadowRoot.querySelector(".routes-list");
    if (container) {
      container.innerHTML = `
        <div class="error-state">
          <div class="error-icon">❌</div>
          <h3>Error Loading Routes</h3>
          <p>${message}</p>
        </div>
      `;
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          padding: 0;
          font-family: var(--font-family, 'OpenDyslexic', 'Comic Sans MS', 'Trebuchet MS', 'Verdana', 'Arial', sans-serif);
          max-width: 100%;
          overflow-x: hidden;
        }

        .routes-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 16px;
        }

        .page-header {
          text-align: center;
          margin-bottom: 20px;
          padding: 20px;
          background: #f8f8f8;
          border-radius: 12px;
          border: 1px solid #ddd;
        }

        .page-title {
          margin: 0;
          color: #333;
          font-size: 1.5rem;
          font-weight: 600;
        }

        .page-description {
          margin: 8px 0 0 0;
          color: #666;
          font-size: 0.9rem;
        }

        .routes-list {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .day-group {
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }

        .day-header {
          margin: 0;
          padding: 12px 16px;
          background: #666;
          color: white;
          font-size: 1.1rem;
          font-weight: 600;
        }

        .day-routes {
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .route-card {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 12px;
          border-left: 4px solid #999;
        }

        .route-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .route-id {
          font-weight: 600;
          color: #333;
        }

        .route-type {
          font-size: 0.75rem;
          padding: 2px 8px;
          border-radius: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .route-type.spfm {
          background: #e8f5e8;
          color: #555;
        }

        .route-type.recovery {
          background: #f0e6e6;
          color: #666;
        }

        .route-type.delivery {
          background: #f5f0e6;
          color: #666;
        }

        .route-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          font-size: 0.9rem;
          color: #666;
        }

        .route-market {
          font-size: 1rem;
          color: #333;
        }

        .route-stops {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px solid #e2e8f0;
        }

        .stops-label {
          font-weight: 600;
          font-size: 0.85rem;
          color: #666;
          margin-bottom: 4px;
        }

        .stops-list {
          margin: 0;
          padding-left: 20px;
          font-size: 0.85rem;
          color: #666;
        }

        .stops-list li {
          margin-bottom: 2px;
        }

        .empty-state,
        .error-state {
          text-align: center;
          padding: 40px;
          color: #666;
          background: #f8f9fa;
          border-radius: 8px;
        }

        .empty-icon,
        .error-icon {
          font-size: 2rem;
          margin-bottom: 10px;
        }

        .loading {
          text-align: center;
          padding: 40px;
          color: #666;
        }

        @media (max-width: 600px) {
          .routes-container {
            padding: 8px;
          }

          .page-header {
            padding: 15px;
            margin-bottom: 15px;
          }

          .page-title {
            font-size: 1.3rem;
          }

          .day-routes {
            padding: 8px;
          }

          .route-card {
            padding: 10px;
          }
        }
      </style>

      <div class="routes-container">
        <div class="page-header">
          <h2 class="page-title">🗺️ Routes</h2>
          <p class="page-description">Weekly schedules by day</p>
        </div>
        <div class="routes-list">
          <div class="loading">Loading routes...</div>
        </div>
      </div>
    `;
  }
}

customElements.define("routes-page", RoutesPage);
