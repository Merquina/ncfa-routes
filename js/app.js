/* ========================================
   SPFM Routes - Main Application
   ======================================== */

// Configuration
const SPREADSHEET_ID = "1yn3yPWW5ThhPvHzYiSkwwNztVnAQLD2Rk_QEQJwlr2k";
const API_KEY = "AIzaSyDQhg6nsoV3WE7aqdorOAbb6tobVkw__9s";
const CLIENT_ID =
  "679707714871-h18m1gdtsdoovh8tjufr8idmr905i5gc.apps.googleusercontent.com";
const DISCOVERY_DOCS = [
  "https://sheets.googleapis.com/$discovery/rest?version=v4",
];
const SCOPES = "https://www.googleapis.com/auth/spreadsheets.readonly";

// Current view state
let currentTab = "box"; // 'box', 'date', or 'worker'

// ========================================
// APPLICATION INITIALIZATION
// ========================================
async function initializeApp() {
  console.log("🚀 initializeApp called");
  updateVersionStatus("initializeApp started");

  try {
    updateVersionStatus("Showing loading...");
    showLoading();
    console.log("🚀 Starting SPFM Routes app...");
    updateVersionStatus("Initializing UI...");

    // Initialize UI (no API needed - only inventory uses local storage)
    initializeUI();
    console.log("✅ UI initialized");

    updateVersionStatus("Setting up views...");
    // Initialize URL routing and set view based on URL
    initializeRouting();
    console.log("✅ Routing initialized");

    // Set up tab handlers after initialization
    setupTabHandlers();

    console.log("✅ App initialized successfully");
    updateVersionStatus("✅ Ready - API loads on demand");
  } catch (error) {
    console.error("❌ Application initialization failed:", error);
    console.error("Error details:", error.stack);
    showError("Failed to initialize application: " + error.message);
    updateVersionStatus("❌ Error: " + error.message);
  }
}

// ========================================
// UI INITIALIZATION
// ========================================
function initializeUI() {
  // Initialize inventory display (no API needed - uses local storage)
  if (window.inventoryManager) {
    window.inventoryManager.renderInventory();
  } else {
    console.error("❌ inventoryManager not loaded yet");
  }

  // Hide loading
  hideLoading();
}

// ========================================
// TAB MANAGEMENT
// ========================================
function switchTab(tabName, updateUrl = true) {
  currentTab = tabName;

  // Update URL if requested
  if (updateUrl) {
    const newUrl = `#${tabName}`;
    window.history.pushState({ tab: tabName }, "", newUrl);
  }

  // Hide all tab contents
  document.querySelectorAll(".tab-content").forEach((tab) => {
    tab.classList.add("hidden");
    tab.classList.remove("active");
  });

  // Remove active class from all tab buttons
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  // Show selected tab content
  const selectedTab = document.getElementById(tabName + "Tab");
  if (selectedTab) {
    selectedTab.classList.remove("hidden");
    selectedTab.classList.add("active");
  }

  // Activate selected tab button
  const selectedBtn = document.getElementById(tabName + "TabBtn");
  if (selectedBtn) {
    selectedBtn.classList.add("active");
  }

  // Clear assignments when switching tabs
  clearAssignments();

  // Load content based on tab
  switch (tabName) {
    case "box":
      if (window.inventoryManager) {
        // Box inventory uses local storage - no API needed
        window.inventoryManager.renderInventory();
      } else {
        console.error("❌ inventoryManager not available");
        setTimeout(() => switchTab("box"), 500); // Retry after delay
      }
      break;
    case "date":
      if (window.datesManager) {
        // Only load API data when user actually clicks the tab
        if (updateUrl) {
          // Load API data when date tab is clicked
          loadApiDataIfNeeded().then(() => {
            datesManager.renderDates();
          });
        } else {
          // Just show empty state on initial load
          datesManager.renderDates();
        }
      }
      break;
    case "worker":
      if (window.workersManager) {
        // Only load API data when user actually clicks the tab
        if (updateUrl) {
          // Load API data when worker tab is clicked
          loadApiDataIfNeeded().then(() => {
            workersManager.renderWorkers();
          });
        } else {
          // Just show empty state on initial load
          workersManager.renderWorkers();
        }
      }
      break;
  }
}

// ========================================
// API LOADING ON DEMAND
// ========================================
async function loadApiDataIfNeeded() {
  if (sheetsAPI.data.length === 0) {
    console.log("📊 Loading API data on demand...");
    updateVersionStatus("Loading sheet data...");
    try {
      await sheetsAPI.fetchSheetData();
      console.log("✅ API data loaded");
      updateVersionStatus("✅ Ready");
    } catch (error) {
      console.error("❌ Error loading API data:", error);
      updateVersionStatus("❌ API Error");
      throw error;
    }
  }
}

// ========================================
// GLOBAL FUNCTIONS (called from HTML)
// ========================================
function selectWorker(worker) {
  // Load API data when worker is selected
  loadApiDataIfNeeded()
    .then(() => {
      workersManager.selectWorker(worker);
    })
    .catch((error) => {
      showError("Failed to load worker data: " + error.message);
    });
}

function selectDate(date) {
  // Load API data when date is selected
  loadApiDataIfNeeded()
    .then(() => {
      datesManager.selectDate(date);
    })
    .catch((error) => {
      showError("Failed to load date data: " + error.message);
    });
}

function selectRecoveryRoute(worker, dayName) {
  // Load API data when recovery route is selected
  loadApiDataIfNeeded()
    .then(() => {
      datesManager.selectRecoveryRoute(worker, dayName);
    })
    .catch((error) => {
      showError("Failed to load recovery route data: " + error.message);
    });
}

function printAssignment() {
  window.print();
}

// ========================================
// UTILITY FUNCTIONS
// ========================================
function clearAssignments() {
  const assignmentsContainer = document.getElementById("assignmentsContainer");
  if (assignmentsContainer) {
    assignmentsContainer.innerHTML = "";
  }
}

function showLoading() {
  const loadingHTML = `
        <div class="loading">
            <h3>🔄 Loading SPFM Routes...</h3>
            <p>Connecting to Google Sheets...</p>
        </div>
    `;

  document.getElementById("assignmentsContainer").innerHTML = loadingHTML;
}

function hideLoading() {
  // Loading will be replaced by actual content
}

function showError(message) {
  const errorHTML = `
        <div class="error">
            <h3>❌ Error</h3>
            <p><strong>Technical Error:</strong> ${message}</p>
            <br>
            <p>Contact admin if this continues.</p>
        </div>
    `;

  document.getElementById("assignmentsContainer").innerHTML = errorHTML;
}

function updateVersionStatus(status) {
  console.log("Status update:", status);
  // Status element was removed - just log the status
}

function updateLastModified() {
  const lastUpdatedEl = document.getElementById("lastUpdated");
  if (lastUpdatedEl && sheetsAPI && sheetsAPI.data.length > 0) {
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    lastUpdatedEl.textContent = `Data loaded: ${dateStr}`;
    console.log("✅ Data loaded timestamp set");
  }
}

// ========================================
// UTILITY CLASSES
// ========================================
function addClass(element, className) {
  if (element && !element.classList.contains(className)) {
    element.classList.add(className);
  }
}

function removeClass(element, className) {
  if (element && element.classList.contains(className)) {
    element.classList.remove(className);
  }
}

function toggleClass(element, className) {
  if (element) {
    element.classList.toggle(className);
  }
}

// ========================================
// ERROR HANDLING
// ========================================
window.addEventListener("error", function (e) {
  console.error("Global error caught:", e.error);
  showError("An unexpected error occurred: " + e.error.message);
});

window.addEventListener("unhandledrejection", function (e) {
  console.error("Unhandled promise rejection:", e.reason);
  showError("An unexpected error occurred: " + e.reason);
});

// ========================================
// REFRESH DATA
// ========================================
async function refreshData() {
  try {
    showLoading();
    // Force refresh API data
    sheetsAPI.data = []; // Clear cache to force reload
    await loadApiDataIfNeeded();

    // Refresh current tab
    switchTab(currentTab);

    clearAssignments();
  } catch (error) {
    console.error("❌ Error refreshing data:", error);
    showError("Failed to refresh data: " + error.message);
  }
}

// Make refresh available globally
window.refreshData = refreshData;

// ========================================
// EXPORT FOR GLOBAL ACCESS
// ========================================
window.selectWorker = selectWorker;
window.selectDate = selectDate;
window.selectRecoveryRoute = selectRecoveryRoute;
window.printAssignment = printAssignment;
window.initializeApp = initializeApp;
window.updateVersionStatus = updateVersionStatus;
window.switchTab = switchTab;
window.clearAssignments = clearAssignments;
window.showLoading = showLoading;
window.showError = showError;

// Also attach modules to window for debugging
window.sheetsAPI = sheetsAPI;
window.assignmentsManager = assignmentsManager;
window.workersManager = workersManager;
window.datesManager = datesManager;
window.updateLastModified = updateLastModified;

// Wait for all modules to be available
function waitForModules() {
  const requiredModules = [
    "inventoryManager",
    "datesManager",
    "workersManager",
    "assignmentsManager",
  ];
  const missing = requiredModules.filter((module) => !window[module]);

  if (missing.length > 0) {
    console.log("⏳ Waiting for modules:", missing);
    setTimeout(waitForModules, 100);
  } else {
    console.log("✅ All modules loaded");
  }
}

setTimeout(waitForModules, 100);

// ========================================
// TAB HANDLERS SETUP
// ========================================
function setupTabHandlers() {
  console.log("Setting up tab handlers...");

  const boxBtn = document.getElementById("boxTabBtn");
  const dateBtn = document.getElementById("dateTabBtn");
  const workerBtn = document.getElementById("workerTabBtn");

  // iPhone/mobile-specific event handling
  function addMobileHandler(btn, tabName) {
    if (!btn) return;

    // Multiple event types for better mobile compatibility
    ["click", "touchend", "touchstart"].forEach((eventType) => {
      btn.addEventListener(
        eventType,
        function (e) {
          e.preventDefault();
          e.stopPropagation();

          if (eventType === "touchstart") {
            console.log(`${tabName} tab touched`);
          } else if (eventType === "click" || eventType === "touchend") {
            console.log(`${tabName} tab activated`);
            switchTab(tabName, true);
          }
        },
        { passive: false },
      );
    });

    // Fallback onclick for desktop
    btn.onclick = function (e) {
      e.preventDefault();
      console.log(`${tabName} tab clicked (fallback)`);
      switchTab(tabName, true);
    };
  }

  addMobileHandler(boxBtn, "box");
  addMobileHandler(dateBtn, "date");
  addMobileHandler(workerBtn, "worker");

  console.log("✅ Tab handlers set up with mobile support");
}

// ========================================
// URL ROUTING
// ========================================
function initializeRouting() {
  // Get current hash from URL
  const hash = window.location.hash.slice(1); // Remove #
  const validTabs = ["box", "date", "worker"];
  const initialTab = validTabs.includes(hash) ? hash : "box";

  // Set initial tab without updating URL (since URL already has it)
  switchTab(initialTab, false);

  // Listen for back/forward button
  window.addEventListener("popstate", function (event) {
    const hash = window.location.hash.slice(1);
    const tab = validTabs.includes(hash) ? hash : "box";
    switchTab(tab, false);
  });
}

// Export to window
window.setupTabHandlers = setupTabHandlers;

// Confirm this file loaded
console.log("✅ app.js loaded");
window.appLoaded = true;
