/* ========================================
   SPFM Routes - Main Application
   ======================================== */

// Configuration
const SPREADSHEET_ID = "1yn3yPWW5ThhPvHzYiSkwwNztVnAQLD2Rk_QEQJwlr2k";
const CLIENT_ID =
  "679707714871-h18m1gdtsdoovh8tjufr8idmr905i5gc.apps.googleusercontent.com";
const DISCOVERY_DOCS = [
  "https://sheets.googleapis.com/$discovery/rest?version=v4",
];

// Current view state
let currentTab = "box"; // 'box', 'date', or 'worker'

// ========================================
// TEXT NORMALIZATION UTILITIES
// ========================================

/**
 * Normalizes text for flexible matching by handling apostrophes and common variations
 * @param {string} text - Text to normalize
 * @returns {string} - Normalized text
 */
function normalizeText(text) {
  if (!text || typeof text !== "string") return "";

  return (
    text
      .trim()
      .toLowerCase()
      // Replace various apostrophe characters with standard one
      .replace(/[''`]/g, "'")
      // Remove extra whitespace
      .replace(/\s+/g, " ")
  );
}

/**
 * Flexible text comparison that handles apostrophe variations
 * @param {string} text1 - First text to compare
 * @param {string} text2 - Second text to compare
 * @returns {boolean} - True if texts match flexibly
 */
function flexibleTextMatch(text1, text2) {
  return normalizeText(text1) === normalizeText(text2);
}

/**
 * Check if text includes another text with flexible apostrophe handling
 * @param {string} text - Text to search in
 * @param {string} searchTerm - Term to search for
 * @returns {boolean} - True if text includes search term
 */
function flexibleTextIncludes(text, searchTerm) {
  return normalizeText(text).includes(normalizeText(searchTerm));
}

// Example usage:
// flexibleTextMatch("don't", "don't") -> true
// flexibleTextMatch("Samuel", "samuel") -> true
// flexibleTextIncludes("volunteer work", "volunteer") -> true
// normalizeText("Don't work") -> "don't work"

// ========================================
// APPLICATION INITIALIZATION
// ========================================
async function initializeApp() {
  console.log("🚀 initializeApp called");
  updateStatus("🚀 initializeApp started");

  try {
    updateStatus("Showing loading...");
    showLoading();
    console.log("🚀 Starting SPFM Routes app...");
    updateStatus("Initializing UI...");

    // Check if required modules are loaded
    const modules = [
      "inventoryManager",
      "datesManager",
      "workersManager",
      "assignmentsManager",
      "sheetsAPI",
    ];
    modules.forEach((module) => {
      const exists = window[module] ? "✅" : "❌";
      console.log(
        `${exists} Module ${module}: ${window[module] ? "loaded" : "missing"}`,
      );
      updateStatus(
        `${exists} ${module}: ${window[module] ? "loaded" : "missing"}`,
      );
    });

    // Check if DOM elements exist
    const elements = ["boxTabBtn", "dateTabBtn", "workerTabBtn"];
    elements.forEach((id) => {
      const exists = document.getElementById(id) ? "✅" : "❌";
      console.log(
        `${exists} Element ${id}: ${document.getElementById(id) ? "found" : "missing"}`,
      );
      updateStatus(
        `${exists} Element ${id}: ${document.getElementById(id) ? "found" : "missing"}`,
      );
    });

    // Initialize UI (no API needed - only inventory uses local storage)
    initializeUI();
    console.log("✅ UI initialized");

    updateStatus("Setting up views...");
    // Initialize URL routing and set view based on URL
    initializeRouting();
    console.log("✅ Routing initialized");

    // Set up tab handlers after initialization
    setupTabHandlers();

    console.log("✅ App initialized successfully");
    updateStatus("✅ Ready - API loads on demand");
  } catch (error) {
    console.error("❌ Application initialization failed:", error);
    console.error("Error details:", error.stack);
    showError("Failed to initialize application: " + error.message);
    updateStatus("❌ Error: " + error.message);
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
  console.log(`🔄 switchTab called with: ${tabName}, updateUrl: ${updateUrl}`);
  updateStatus(`🔄 Switching to ${tabName} tab`);

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

  // Scroll to top when any tab is clicked
  if (updateUrl) {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

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
      console.log("🔍 Switching to date tab, updateUrl:", updateUrl);
      if (window.datesManager) {
        // Only load API data when user actually clicks the tab
        if (updateUrl) {
          console.log("📊 Loading API data for date tab...");
          // Load API data when date tab is clicked
          loadApiDataIfNeeded()
            .then(() => {
              console.log("✅ API data loaded, rendering dates...");
              console.log("📊 sheetsAPI.data.length:", sheetsAPI.data.length);
              console.log(
                "📊 sheetsAPI.recoveryData.length:",
                sheetsAPI.recoveryData.length,
              );
              datesManager.renderDates();
            })
            .catch((error) => {
              console.error("❌ Error loading API data for dates:", error);
            });
        } else {
          // Just show empty state on initial load
          console.log("📅 Rendering dates without API load (initial)");
          datesManager.renderDates();
        }
      } else {
        console.error("❌ datesManager not available");
      }
      break;
    case "worker":
      console.log("🔍 Switching to worker tab, updateUrl:", updateUrl);

      // Clear assignments when switching to worker tab
      clearAssignments();

      if (window.workersManager) {
        // Only load API data when user actually clicks the tab
        if (updateUrl) {
          console.log("👥 Loading API data for worker tab...");
          // Load API data when worker tab is clicked
          loadApiDataIfNeeded()
            .then(() => {
              console.log("✅ API data loaded, rendering workers...");
              console.log("👥 sheetsAPI.data.length:", sheetsAPI.data.length);
              const workers = sheetsAPI.getAllWorkers();
              console.log("👥 Found workers:", workers);
              workersManager.renderWorkers();
            })
            .catch((error) => {
              console.error("❌ Error loading API data for workers:", error);
            });
        } else {
          // Just show empty state on initial load
          console.log("👥 Rendering workers without API load (initial)");
          workersManager.renderWorkers();
        }
      } else {
        console.error("❌ workersManager not available");
      }
      break;
    case "charts":
      console.log("🔍 Switching to charts tab");
      console.log("🔍 Charts tab content should be visible now");
      // Charts functionality is under construction
      // No additional logic needed since HTML already shows placeholder
      break;
  }
}

// ========================================
// API LOADING ON DEMAND
// ========================================
async function loadApiDataIfNeeded() {
  console.log(
    "📊 loadApiDataIfNeeded called, current data length:",
    sheetsAPI.data.length,
  );
  if (sheetsAPI.data.length === 0) {
    console.log("📊 Loading API data on demand...");
    updateVersionStatus("Loading sheet data...");
    try {
      await sheetsAPI.fetchSheetData();
      console.log("✅ API data loaded successfully");
      console.log("📊 SPFM data count:", sheetsAPI.data.length);
      console.log("📊 Recovery data count:", sheetsAPI.recoveryData.length);
      console.log("📊 Sample SPFM data:", sheetsAPI.data[0]);
      updateVersionStatus("✅ Ready");
    } catch (error) {
      console.error("❌ Error loading API data:", error);
      console.error("❌ Error details:", error.message);
      updateVersionStatus("❌ API Error");
      throw error;
    }
  } else {
    console.log("✅ API data already loaded, skipping fetch");
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

      // Scroll to assignments after a delay
      setTimeout(() => {
        const assignmentsContainer = document.getElementById(
          "assignmentsContainer",
        );
        if (assignmentsContainer) {
          assignmentsContainer.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      }, 500);
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

function printMarketSection(marketId) {
  const marketSection = document.getElementById(marketId);
  if (!marketSection) {
    console.error("Market section not found:", marketId);
    return;
  }

  // Create a new window for printing
  const printWindow = window.open("", "_blank");

  // Get the market content
  const marketContent = marketSection.outerHTML;

  // Create print-friendly HTML
  const printHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>NCFA Route Assignment</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 20px;
          font-size: 12px;
          line-height: 1.4;
        }
        .market-section {
          margin: 0 !important;
        }
        @media print {
          body { margin: 10px; }
          button { display: none !important; }
        }
      </style>
    </head>
    <body>
      <div style="text-align: center; margin-bottom: 20px;">
        <h2>North Country Food Alliance</h2>
        <p>Route Assignment</p>
      </div>
      ${marketContent}
      <script>
        window.onload = function() {
          window.print();
          window.onafterprint = function() {
            window.close();
          };
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(printHTML);
  printWindow.document.close();
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

  const el = document.getElementById("assignmentsContainer");
  if (el) {
    el.innerHTML = loadingHTML;
  }
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

  const el = document.getElementById("assignmentsContainer");
  if (el) {
    el.innerHTML = errorHTML;
  }
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
window.printMarketSection = printMarketSection;
window.initializeApp = initializeApp;
window.updateVersionStatus = updateVersionStatus;
window.switchTab = switchTab;
window.clearAssignments = clearAssignments;
window.showLoading = showLoading;
window.showError = showError;

// Also attach modules to window for debugging
window.sheetsAPI = sheetsAPI;
window.assignmentsManager = assignmentsManager;
try { window.workersManager = workersManager; } catch {}
try { window.datesManager = datesManager; } catch {}
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
  updateStatus("Setting up tab handlers...");

  const boxBtn = document.getElementById("boxTabBtn");
  const dateBtn = document.getElementById("dateTabBtn");
  const workerBtn = document.getElementById("workerTabBtn");

  console.log("Tab buttons found:", {
    boxBtn: !!boxBtn,
    dateBtn: !!dateBtn,
    workerBtn: !!workerBtn,
  });
  updateStatus(
    `Tab buttons: box=${!!boxBtn} date=${!!dateBtn} worker=${!!workerBtn}`,
  );

  // Tap/click handler with minimal interference
  function addMobileHandler(btn, tabName) {
    if (!btn) {
      console.log(`❌ Button not found for ${tabName}`);
      return;
    }

    console.log(`✅ Setting up handlers for ${tabName} tab`);

    // Primary click handler (works on desktop and most mobiles)
    btn.addEventListener("click", function (e) {
      console.log(`🔥 ${tabName} tab CLICKED!`);
      updateStatus(`🔥 ${tabName} tab clicked`);
      switchTab(tabName, true);
    });

    // Optional touch handler without blocking defaults
    btn.addEventListener(
      "touchend",
      function (e) {
        console.log(`👆 ${tabName} tab TOUCHED!`);
        updateStatus(`👆 ${tabName} tab touched`);
        switchTab(tabName, true);
      },
      { passive: true },
    );

    // Fallback onclick
    btn.onclick = function () {
      console.log(`📱 ${tabName} fallback onclick!`);
      updateStatus(`📱 ${tabName} fallback onclick`);
      switchTab(tabName, true);
    };
  }

  addMobileHandler(boxBtn, "box");
  addMobileHandler(dateBtn, "date");
  addMobileHandler(workerBtn, "worker");

  console.log("✅ Tab handlers set up with mobile support");
  updateStatus("✅ Tab handlers set up");
}

// ========================================
// URL ROUTING
// ========================================
function initializeRouting() {
  // Get current hash from URL
  const hash = window.location.hash.slice(1); // Remove #
  const validTabs = ["box", "date", "worker", "charts"];
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
