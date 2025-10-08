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
    // Ensure page starts at top
    setTimeout(() => this.scrollToTop(), 100);
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
      router.registerRoute(
        "/address-book",
        "address-book-page",
        "Address Book"
      );
      router.registerRoute("/tasks", "tasks-page", "Tasks");
      router.registerRoute("/timesheet", "timesheet-page", "Timesheet");

      router.registerRoute("/route", "route-details-page", "Route Details");
    } catch {}
  }

  setupRouting() {
    // Listen for route changes to update active tabs
    const router = document.querySelector("hash-router");
    if (router) {
      router.addEventListener("route-changed", (e) => {
        this.updateActiveTab(e.detail.path);
        // Scroll to top when route changes
        this.scrollToTop();
      });
    }
  }

  scrollToTop() {
    const pageContainer = this.shadowRoot.querySelector(".page-container");
    if (pageContainer) {
      pageContainer.scrollTop = 0;
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

  navigateToAddressBook() {
    console.log("navigateToAddressBook called");
    console.log("Current hash:", window.location.hash);
    window.location.hash = "/address-book";
    console.log("New hash:", window.location.hash);
    this.toggleMenu(); // Close menu after navigation
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
          height: 100dvh; /* Dynamic viewport height for mobile */
          width: 100vw;
          width: 100dvw;
          max-width: 100%;
          font-family: var(--font-family, 'OpenDyslexic', 'Comic Sans MS', 'Trebuchet MS', 'Verdana', 'Arial', sans-serif);
          font-size: var(--font-size-base, 1rem);
          line-height: var(--line-height, 1.5);
          letter-spacing: var(--letter-spacing, 0.025em);
          background: #f8f9fa;
          overflow-x: hidden;
          overflow-y: hidden;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          box-sizing: border-box;
          -webkit-overflow-scrolling: touch;
        }

        * {
          box-sizing: border-box;
        }





        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
          min-height: 0; /* Allow flex shrinking */
        }

        .page-container {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 8px;
          padding-top: 110px;
          background: white;
          -webkit-overflow-scrolling: touch;
          scroll-behavior: smooth;
          /* Mobile optimizations */
          overscroll-behavior: contain;
          -webkit-transform: translateZ(0); /* Hardware acceleration */
          transform: translateZ(0);
          width: 100%;
          max-width: 100%;
          box-sizing: border-box;
        }

        .bottom-tabs {
          background: white;
          border-top: 1px solid #ddd;
          display: flex;
          justify-content: space-around;
          padding: 6px 0 max(6px, env(safe-area-inset-bottom));
          flex-shrink: 0;
          position: relative;
          z-index: 100;
          /* Mobile safe area */
          padding-bottom: max(6px, env(safe-area-inset-bottom));
          box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
        }

        .tab-btn {
          flex: 1;
          background: none;
          border: none;
          padding: 8px 4px;
          text-align: center;
          cursor: pointer;
          transition: all 0.15s ease;
          color: #666;
          font-family: inherit;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          position: relative;
          min-height: 44px;
          /* Touch optimization */
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }

        .tab-btn.active {
          color: #3182ce;
          background: linear-gradient(135deg, #e3f2fd 0%, #f0f8ff 100%);
        }

        .tab-btn.active::after {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 24px;
          height: 3px;
          background: #3182ce;
          border-radius: 0 0 2px 2px;
        }

        .tab-btn:hover:not(.active) {
          background: #f8f9fa;
          color: #4a5568;
        }

        .tab-icon {
          font-size: 1.1rem;
          line-height: 1;
        }

        .tab-label {
          font-size: var(--font-size-small, 0.875rem);
          font-weight: 500;
          font-family: var(--font-family, 'OpenDyslexic', 'Comic Sans MS', 'Trebuchet MS', 'Verdana', 'Arial', sans-serif);
          letter-spacing: var(--letter-spacing, 0.025em);
        }

        /* Mobile optimizations */
        @media (max-width: 600px) {
          .tab-label {
            font-size: var(--font-size-small, 0.875rem);
          }
        }
      </style>

      <div style="position: sticky; top: 0; z-index: 1001; background: white;">
        <app-header></app-header>

        <!-- Hamburger Menu Button -->
        <button id="hamburgerMenu" style="
          position: fixed;
          top: 60px;
          right: 12px;
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          font-size: 1.2rem;
          padding: 6px;
          border-radius: 6px;
          cursor: pointer;
          z-index: 1002;
          transition: background 0.2s ease;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        " onmouseover="this.style.background='rgba(255, 255, 255, 0.3)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.2)'">
          <i class="mdi mdi-menu"></i>
        </button>

        <!-- Dropdown Menu -->
        <div id="dropdownMenu" style="
          position: absolute;
          top: 100%;
          right: 15px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          min-width: 200px;
          z-index: 1003;
          display: none;
        ">
          <button onclick="window.location.hash='/timesheet'; this.getRootNode().host.toggleMenu();" style="
            width: 100%;
            padding: 12px 16px;
            border: none;
            background: none;
            text-align: left;
            cursor: pointer;
            border-bottom: 1px solid #eee;
            font-family: inherit;
          " onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background='none'">
            <i class="mdi mdi-clipboard-clock-outline" style="margin-right: 8px; color: #666;"></i>
            Timesheet
          </button>
          <button onclick="this.getRootNode().host.openBackendData()" style="
            width: 100%;
            padding: 12px 16px;
            border: none;
            background: none;
            text-align: left;
            cursor: pointer;
            border-bottom: 1px solid #eee;
            font-family: inherit;
          " onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background='none'">
            <i class="mdi mdi-table" style="margin-right: 8px; color: #666;"></i>
            Open Backend Data
          </button>
          <button onclick="this.getRootNode().host.handleSignOut()" style="
            width: 100%;
            padding: 12px 16px;
            border: none;
            background: none;
            text-align: left;
            cursor: pointer;
            font-family: inherit;
            color: #e53e3e;
          " onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background='none'">
            <i class="mdi mdi-logout" style="margin-right: 8px;"></i>
            Sign Out
          </button>
        </div>
      </div>

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
        <a href="/tasks" class="tab-btn" data-route="/tasks">
          <div class="tab-icon"><i class="mdi mdi-clipboard-list-outline"></i></div>
          <div class="tab-label">Tasks</div>
        </a>
        <a href="/boxes" class="tab-btn" data-route="/boxes">
          <div class="tab-icon"><i class="mdi mdi-package-variant"></i></div>
          <div class="tab-label">Boxes</div>
        </a>
        <a href="/dates" class="tab-btn" data-route="/dates">
          <div class="tab-icon"><i class="mdi mdi-calendar"></i></div>
          <div class="tab-label">Date</div>
        </a>
        <a href="/workers" class="tab-btn" data-route="/workers">
          <div class="tab-icon"><i class="mdi mdi-account"></i></div>
          <div class="tab-label">Worker</div>
        </a>
        <a href="/address-book" class="tab-btn" data-route="/address-book">
          <div class="tab-icon"><i class="mdi mdi-book-open-page-variant"></i></div>
          <div class="tab-label">Contacts</div>
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
