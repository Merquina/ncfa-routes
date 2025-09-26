class RouteCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.assignmentData = null;
    this.routeId = null;
    this.clickable = false;
  }

  static get observedAttributes() {
    return ["assignment-data", "route-id", "clickable"];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      if (name === "assignment-data") {
        try {
          this.assignmentData = JSON.parse(newValue || "null");
        } catch (e) {
          this.assignmentData = null;
        }
      } else if (name === "route-id") {
        this.routeId = newValue;
      } else if (name === "clickable") {
        this.clickable = newValue === "true";
      }
      this.render();
    }
  }

  connectedCallback() {
    this.render();
  }

  setRoute(assignment, routeId = null) {
    this.assignmentData = assignment;
    this.routeId = routeId;
    this.setAttribute("assignment-data", JSON.stringify(assignment));
    if (routeId) {
      this.setAttribute("route-id", routeId);
    }
  }

  getWorkerEmoji(workerName) {
    if (!workerName) return "👤";
    try {
      const icons =
        window.dataService &&
        typeof window.dataService.getWorkerIcons === "function"
          ? window.dataService.getWorkerIcons()
          : {};
      return icons[workerName] || "👤";
    } catch {
      return "👤";
    }
  }

  getVanEmoji(vanName) {
    if (!vanName) return "🚐";
    try {
      return window.dataService &&
        typeof window.dataService.getVehicleEmoji === "function"
        ? window.dataService.getVehicleEmoji(vanName)
        : "🚐";
    } catch {
      return "🚐";
    }
  }

  formatWorkerList(workers, volunteers, maxDisplay = 3) {
    const allWorkers = [...(workers || []), ...(volunteers || [])]
      .filter((person) => person && person.trim())
      .map((person) => `${this.getWorkerEmoji(person)} ${person}`);

    if (allWorkers.length === 0) {
      return '<span style="color: #800020; font-style: italic;">No workers assigned</span>';
    }

    if (allWorkers.length <= maxDisplay) {
      return allWorkers.join(", ");
    }

    return (
      allWorkers.slice(0, maxDisplay).join(", ") +
      ` +${allWorkers.length - maxDisplay} more`
    );
  }

  handleCardClick() {
    this.dispatchEvent(
      new CustomEvent("route-selected", {
        detail: { route: this.assignmentData, routeId: this.routeId },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    if (!this.assignmentData) {
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
            font-family: var(--body-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
          }
        </style>
        <div>No assignment data</div>
      `;
      return;
    }

    const route = this.assignmentData;

    // Debug: Check what market data the route card is receiving for any Woodbury route
    if (route.market && route.market.toLowerCase().includes("woodbury")) {
      console.log("[ROUTE CARD DEBUG] Woodbury route data:", {
        market: route.market,
        date: route.date,
        displayDate: route.displayDate,
        isAug17:
          (route.date &&
            route.date.includes &&
            route.date.includes("August 17")) ||
          (route.displayDate &&
            route.displayDate.includes &&
            route.displayDate.includes("Aug 17")),
        allFields: Object.keys(route).map((key) => `${key}: ${route[key]}`),
        fullRoute: route,
      });
    }

    // Get route type from sheets data (routeType) or fallback to internal type
    const routeTypeFromSheets = route.routeType || route.type || "SPFM";
    const normalizedType = routeTypeFromSheets.toString().toLowerCase();

    // Determine route styling based on type
    const isRecovery = normalizedType.includes("recovery");
    const isSPFM = normalizedType.includes("spfm") || normalizedType === "spfm";

    // Set border color and icon based on route type
    let borderColor = "#28a745"; // SPFM green
    let routeIcon = "🧑‍🌾"; // farmer emoji for SPFM
    let displayType = routeTypeFromSheets; // Use actual value from sheets
    let routeColor = "#28a745";

    if (isRecovery) {
      borderColor = "#007bff"; // Recovery blue
      routeIcon = "🛒"; // shopping cart emoji for Recovery
      routeColor = "#007bff";
    }

    // Get workers, volunteers, and vans
    const workers = route.workers || [];
    const volunteers = route.volunteers || [];
    const vans = route.vans || [];

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: var(--font-family, 'OpenDyslexic', 'Comic Sans MS', 'Trebuchet MS', 'Verdana', 'Arial', sans-serif);
        }
        .assignment-card {
          background: white;
          padding: 16px;
          margin: 0 0 8px 0;
          border-radius: 12px;
          border-left: 4px solid ${borderColor};
          cursor: pointer;
          transition: all 0.15s ease;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          /* Mobile touch optimization */
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
          min-height: 70px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }
        .assignment-card:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
        }
        .assignment-card:active {
          transform: translateY(0);
          transition: all 0.1s ease;
        }
        .card-title {
          font-weight: bold;
          color: #333;
          margin-bottom: 4px;
          font-size: 1rem;
        }
        .card-time {
          font-size: 0.9rem;
          color: #666;
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .card-type {
          font-size: 0.85rem;
          color: ${routeColor};
          margin-bottom: 4px;
        }
        .route-type-text {
          color: ${routeColor};
        }
        .market-text {
          color: #28a745;
        }
        .card-workers {
          font-size: 0.9rem;
          color: #666;
          margin-bottom: 4px;
        }
        .card-vans {
          font-size: 0.9rem;
          color: #666;
        }
        .no-assignment {
          color: #800020;
          font-style: italic;
        }
      </style>

      <div class="assignment-card">
        <div class="card-title">
          ${route.displayDate || route.date}
        </div>
        <div class="card-time">
          ${
            route.startTime || route.Time || "TBD"
          } · ${routeIcon}&nbsp;<span class="route-type-text">${displayType}</span>${
      isSPFM
        ? ` <span class="market-text">- ${route.market || "Market"}</span>`
        : ""
    }
        </div>
        <div class="card-workers">
          ${this.formatWorkerList(workers, volunteers, isRecovery ? 1 : 3)}
        </div>
        <div class="card-vans">
          ${
            vans.length > 0
              ? vans.map((v) => `${this.getVanEmoji(v)} ${v}`).join(", ")
              : '<span class="no-assignment">No vans assigned</span>'
          }
        </div>
      </div>
    `;

    // Add click handler only if clickable
    if (this.clickable) {
      const card = this.shadowRoot.querySelector(".assignment-card");
      card.style.cursor = "pointer";
      card.addEventListener("click", () => {
        this.handleCardClick();
      });
    }
  }
}

// Replace incorrect/legacy route-card with this implementation
if (customElements.get("route-card")) {
  // no-op: already defined, but we want to redefine only if not present
} else {
  customElements.define("route-card", RouteCard);
}
