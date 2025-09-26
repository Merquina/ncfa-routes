import sheetsAPI from "../services/sheets-api.js";
import dataService from "../services/data-service.js";
import "./app-header.js";

class AppLayout extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
    this.registerDefaultRoutes();
    this.setupMenuHandlers();
    this.setupRouting();
    this._wireSyncStatus();
    this.setupHeaderHandler();
  }
  disconnectedCallback() {}

  registerDefaultRoutes() {
    try {
      const router = document.querySelector("hash-router");
      if (!router || typeof router.registerRoute !== "function") return;
      const existing = router.getRoutes && router.getRoutes();
      if (existing && existing.length > 0) return; // already registered
      router.registerRoute("/", "reminders-page", "Reminders Dashboard");
      router.registerRoute(
        "/reminders",
        "reminders-page",
        "Reminders Dashboard"
      );
      router.registerRoute("/boxes", "boxes-page", "Box Inventory");
      router.registerRoute("/dates", "dates-page", "Upcoming Routes");
      router.registerRoute("/workers", "workers-page", "Routes by Worker");

      router.registerRoute("/route", "route-details-page", "Route Details");
    } catch {}
  }

  setupRouting() {
    // Listen for route changes to update active tabs
    const router = document.querySelector("hash-router");
    if (router) {
      router.addEventListener("route-changed", (e) => {
        this.updateActiveTab(e.detail.path);
      });
    }
  }

  toggleMenu() {
    const menu = this.shadowRoot.querySelector("#dropdownMenu");
    if (menu) {
      menu.style.display = menu.style.display === "none" ? "block" : "none";
    }
  }

  setupMenuHandlers() {
    const hamburger = this.shadowRoot.querySelector("#hamburgerMenu");
    if (hamburger) {
      hamburger.addEventListener("click", () => this.toggleMenu());
    }

    // Close menu when clicking outside
    this.shadowRoot.addEventListener("click", (event) => {
      const menu = this.shadowRoot.querySelector("#dropdownMenu");
      const hamburger = this.shadowRoot.querySelector("#hamburgerMenu");
      if (
        menu &&
        hamburger &&
        !menu.contains(event.target) &&
        !hamburger.contains(event.target)
      ) {
        menu.style.display = "none";
      }
    });

    // Set up tab navigation
    const tabs = this.shadowRoot.querySelectorAll(".tab-btn");
    tabs.forEach((tab) => {
      tab.addEventListener("click", (e) => {
        e.preventDefault();
        const route = tab.getAttribute("data-route");
        if (route) {
          window.location.hash = route;
        }
      });
    });
  }

  handleSignOut() {
    this.dispatchEvent(new CustomEvent("sign-out", { bubbles: true }));
  }

  openBackendData() {
    const SPREADSHEET_ID = "1yn3yPWW5ThhPvHzYiSkwwNztVnAQLD2Rk_QEQJwlr2k";
    const sheetsUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`;
    window.open(sheetsUrl, "_blank");
  }

  setupHeaderHandler() {
    const header = this.shadowRoot.querySelector("app-header");
    if (header) {
      header.addEventListener("header-click", () => {
        this.goToSignInPage();
      });
    }
  }

  goToSignInPage() {
    // Call the global function to show sign-in page
    if (typeof window.showSignInPage === "function") {
      window.showSignInPage();
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        @import url("https://cdnjs.cloudflare.com/ajax/libs/MaterialDesign-Webfont/7.4.47/css/materialdesignicons.min.css");

        :host {
          display: flex;
          flex-direction: column;
          height: 100vh;
          font-family: var(--body-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
          background: #f5f5f5;
          overflow: hidden;
        }





        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
        }

        .page-container {
          flex: 1;
          overflow-y: auto;
          padding: 10px;
          background: white;
        }

        .bottom-tabs {
          background: white;
          border-top: 1px solid #ddd;
          display: flex;
          justify-content: space-around;
          padding: 8px 0;
          flex-shrink: 0;
          position: relative;
          z-index: 100;
        }

        .tab-btn {
          flex: 1;
          background: none;
          border: none;
          padding: 8px 4px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
          color: #666;
          font-family: inherit;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .tab-btn.active {
          color: #007bff;
          background: #f8f9fa;
        }

        .tab-btn:hover {
          background: #f8f9fa;
        }

        .tab-icon {
          font-size: 1.2rem;
        }

        .tab-label {
          font-size: 0.75rem;
          font-weight: 500;
        }

        /* Mobile optimizations */
        @media (max-width: 600px) {
          .tab-label {
            font-size: 0.7rem;
          }
        }
      </style>

      <app-header></app-header>

      <div class="main-content">
        <div class="page-container">
          <slot></slot>
        </div>
      </div>

      <div class="bottom-tabs">
        <a href="/reminders" class="tab-btn" data-route="/reminders">
          <div class="tab-icon"><i class="mdi mdi-bell"></i></div>
          <div class="tab-label">Reminders</div>
        </a>
        <a href="/boxes" class="tab-btn" data-route="/boxes">
          <div class="tab-icon"><i class="mdi mdi-package-variant"></i></div>
          <div class="tab-label">Boxes</div>
        </a>
        <a href="/dates" class="tab-btn" data-route="/dates">
          <div class="tab-icon"><i class="mdi mdi-calendar"></i></div>
          <div class="tab-label">By Date</div>
        </a>
        <a href="/workers" class="tab-btn" data-route="/workers">
          <div class="tab-icon"><i class="mdi mdi-account"></i></div>
          <div class="tab-label">By Worker</div>
        </a>

      </div>
    `;
  }

  _wireSyncStatus() {
    const el = this.shadowRoot.querySelector("#lastSynced");
    const set = () => {
      if (!el) return;
      const ts = sheetsAPI?.lastFetchTs || 0;
      if (!ts) {
        el.textContent = "—";
        return;
      }
      const d = new Date(ts);
      el.textContent = d.toLocaleString();
    };
    try {
      sheetsAPI.addEventListener("updated", set);
    } catch {}
    set();
  }

  updateActiveTab(route) {
    const tabs = this.shadowRoot.querySelectorAll(".tab-btn");
    tabs.forEach((tab) => {
      const tabRoute = tab.getAttribute("data-route");
      if (tabRoute === route) {
        tab.classList.add("active");
      } else {
        tab.classList.remove("active");
      }
    });
  }
}

customElements.define("app-layout", AppLayout);
