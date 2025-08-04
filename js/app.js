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
let currentView = "worker"; // 'worker' or 'date'

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
    updateVersionStatus("Loading data...");

    // Load data directly using fetch API (no Google API client needed)
    console.log("📊 Fetching sheet data...");
    await sheetsAPI.fetchSheetData();
    console.log("✅ Sheet data loaded");

    updateVersionStatus("Initializing UI...");
    // Initialize UI
    initializeUI();
    console.log("✅ UI initialized");

    updateVersionStatus("Setting up views...");
    // Set default view
    showWorkerView();
    console.log("✅ Worker view set");

    console.log("✅ App initialized successfully");
    updateVersionStatus("✅ Working");
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
  // Set up view toggle buttons
  const workerViewBtn = document.getElementById("workerViewBtn");
  const dateViewBtn = document.getElementById("dateViewBtn");

  if (workerViewBtn) {
    workerViewBtn.addEventListener("click", showWorkerView);
  }

  if (dateViewBtn) {
    dateViewBtn.addEventListener("click", showDateView);
  }

  // Hide loading
  hideLoading();
}

// ========================================
// VIEW MANAGEMENT
// ========================================
function showWorkerView() {
  currentView = "worker";

  // Update button states
  document.getElementById("workerViewBtn")?.classList.add("active");
  document.getElementById("dateViewBtn")?.classList.remove("active");

  // Show/hide containers
  document.getElementById("workerViewContainer")?.classList.remove("hidden");
  document.getElementById("dateViewContainer")?.classList.add("hidden");

  // Clear assignments
  clearAssignments();

  // Render workers
  workersManager.renderWorkers();
}

function showDateView() {
  currentView = "date";

  // Update button states
  document.getElementById("dateViewBtn")?.classList.add("active");
  document.getElementById("workerViewBtn")?.classList.remove("active");

  // Show/hide containers
  document.getElementById("dateViewContainer")?.classList.remove("hidden");
  document.getElementById("workerViewContainer")?.classList.add("hidden");

  // Clear assignments
  clearAssignments();

  // Render dates
  datesManager.renderDates();
}

// ========================================
// GLOBAL FUNCTIONS (called from HTML)
// ========================================
function selectWorker(worker) {
  workersManager.selectWorker(worker);
}

function selectDate(date) {
  datesManager.selectDate(date);
}

function selectRecoveryRoute(worker, dayName) {
  datesManager.selectRecoveryRoute(worker, dayName);
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
  const statusEl = document.getElementById("status");
  if (statusEl) {
    statusEl.textContent = status;
  } else {
    console.log("Status element not found");
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
    await sheetsAPI.fetchSheetData();

    if (currentView === "worker") {
      workersManager.renderWorkers();
    } else {
      datesManager.renderDates();
    }

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
window.showWorkerView = showWorkerView;
window.showDateView = showDateView;
window.clearAssignments = clearAssignments;
window.showLoading = showLoading;
window.showError = showError;

// Also attach modules to window for debugging
window.sheetsAPI = sheetsAPI;
window.workersManager = workersManager;
window.datesManager = datesManager;

// Confirm this file loaded
console.log("✅ app.js loaded");
window.appLoaded = true;
