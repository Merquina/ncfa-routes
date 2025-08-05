/* ========================================
   SPFM Routes - Assignments Management
   Fresh rewrite to fix syntax errors
   ======================================== */

class AssignmentsManager {
  constructor() {
    this.currentAssignment = null;
  }

  // ========================================
  // UNIFIED ASSIGNMENT CARD RENDERER
  // ========================================
  renderUnifiedAssignments(config) {
    const {
      routes,
      title,
      emoji,
      color = "#007bff",
      groupByMarket = false,
      printButtonText = "Print Assignment",
    } = config;

    const assignmentsContainer = document.getElementById(
      "assignmentsContainer",
    );
    if (!assignmentsContainer) return;

    if (!routes || routes.length === 0) {
      assignmentsContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666; background: #f8f9fa; margin: 10px; border-radius: 8px;">
          <div style="font-size: 2rem; margin-bottom: 10px;">${emoji}</div>
          <h3>${title}</h3>
          <p>No assignments found.</p>
        </div>
      `;
      return;
    }

    let html = `
      <div style="background: #f8f9fa; margin: 10px; padding: 15px; border-radius: 8px; border: 2px solid ${color};">
        <div style="text-align: center; margin-bottom: 15px;">
          <div style="font-size: 2rem; margin-bottom: 5px;">${emoji}</div>
          <h3 style="margin: 0; color: ${color};">${title}</h3>
          <div style="border-top: 2px solid #ddd; margin: 10px 20px;"></div>
        </div>
    `;

    // Render all routes with identical cards
    routes.forEach((route) => {
      html += this.renderSingleAssignmentCard(route);
    });

    // Add single print button (same for both screens for now)
    html += `
      <div style="text-align: center; margin-top: 20px;">
        <button onclick="printAssignment()" class="directions-btn" style="background: #6c757d;">
          🖨️ ${printButtonText}
        </button>
      </div>
    `;

    html += `</div>`;
    assignmentsContainer.innerHTML = html;
  }

  // ========================================
  // SINGLE ASSIGNMENT CARD RENDERER
  // ========================================
  renderSingleAssignmentCard(route) {
    if (route.type === "spfm") {
      return this.renderSPFMCard(route);
    } else {
      return this.renderRecoveryCard(route);
    }
  }

  renderSPFMCard(route) {
    const vanEmoji = this.getVanEmoji(route.van1 || route.van2);

    return `
      <div style="background: white; padding: 12px; margin-bottom: 12px; border-radius: 6px; border-left: 4px solid #007bff;">
        <div style="font-weight: bold; color: #333; margin-bottom: 8px;">
          ${route.displayDate || route.date} - ${route.market || "Market"} ${route.startTime ? `at ${route.startTime}` : ""}
        </div>
        <div style="font-size: 0.85rem; color: #007bff; margin-bottom: 4px;">🚚 SPFM Route</div>
        <div style="font-size: 0.9rem; color: #666;">
          <div><strong>Team:</strong> ${(() => {
            const workers = [
              route.worker1,
              route.worker2,
              route.worker3,
              route.worker4,
            ]
              .filter((w) => w && w.trim() && w.toLowerCase() !== "cancelled")
              .map((w) => `${this.getWorkerEmoji(w)} ${w}`);
            const vans = [route.van1, route.van2]
              .filter((v) => v && v.trim())
              .map((v) => `${this.getVanEmoji(v)} ${v}`);
            return [...workers, ...vans].join(", ") || "Not assigned";
          })()}</div>
          ${route.dropOff ? `<div><strong>Drop-off:</strong> ${route.dropOff}</div>` : ""}
          ${
            route.backAtOffice
              ? `
            <div><strong>Final Steps:</strong></div>
            <div style="margin-left: 10px; font-size: 0.85rem;">
              ${route.backAtOffice
                .split(",")
                .map((step) =>
                  step.trim() ? `<div>☐ ${step.trim()}</div>` : "",
                )
                .join("")}
            </div>
          `
              : ""
          }
        </div>
      </div>
    `;
  }

  renderRecoveryCard(route) {
    return `
      <div style="background: white; padding: 12px; margin-bottom: 12px; border-radius: 6px; border-left: 4px solid #28a745;">
        <div style="font-weight: bold; color: #333; margin-bottom: 8px;">
          ${route.displayDate} - ${route.Location || route.location || "Location"}
        </div>
        <div style="font-size: 0.85rem; color: #28a745; margin-bottom: 4px;">🚗 Recovery Route</div>
        <div style="font-size: 0.9rem; color: #666;">
          <div><strong>Time:</strong> ${route.Time || "Not specified"}</div>
          <div><strong>Contact:</strong> ${route.Contact || "Not specified"}</div>
          ${route.Notes ? `<div><strong>Notes:</strong> ${route.Notes}</div>` : ""}
        </div>
      </div>
    `;
  }

  // ========================================
  // WORKER ASSIGNMENTS RENDERING
  // ========================================
  renderWorkerAssignments(workerName, assignments) {
    const assignmentsContainer = document.getElementById(
      "assignmentsContainer",
    );
    if (!assignmentsContainer) return;

    const workerEmoji = this.getWorkerEmoji(workerName);

    if (
      !assignments ||
      (assignments.spfm.length === 0 && assignments.recovery.length === 0)
    ) {
      this.renderUnifiedAssignments({
        routes: [],
        title: `${workerName}'s Upcoming Assignments`,
        emoji: workerEmoji,
        color: "#007bff",
        groupByMarket: false,
        printButtonText: "Print Assignment",
      });
      return;
    }

    // Use the same logic as Screen 2 for generating dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get SPFM routes for this worker (not completed)
    const workerSPFMRoutes = assignments.spfm.filter((route) => {
      const status = (route.status || route.Status || "").toLowerCase();
      const routeDate = new Date(route.date);
      console.log(
        `🔍 Route ${route.routeId}: status="${status}", date=${route.date}, dateObj=${routeDate}, future=${routeDate >= today}`,
      );
      return status !== "completed" && routeDate >= today;
    });

    // Generate recovery dates using Screen 2's logic
    const allRecoveryDates = [];
    assignments.recovery.forEach((route) => {
      const dayName = route.Day || route["Recovery Routes"] || route.day;
      if (dayName) {
        // Generate next 12 occurrences like Screen 2
        for (let occurrence = 0; occurrence < 12; occurrence++) {
          const nextDate = this.calculateNextOccurrence(dayName, occurrence);
          if (nextDate && nextDate >= today) {
            allRecoveryDates.push({
              ...route,
              type: "recovery",
              sortDate: nextDate,
              displayDate: nextDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
                year: "numeric",
              }),
            });
          }
        }
      }
    });

    // Combine SPFM and recovery routes
    const allRoutes = [];

    // Add SPFM routes
    workerSPFMRoutes.forEach((route) => {
      allRoutes.push({
        ...route,
        type: "spfm",
        sortDate: new Date(route.date),
        displayDate: route.date,
      });
    });

    // Add recovery routes
    allRoutes.push(...allRecoveryDates);

    // Sort all routes by date and take only next 4
    const upcomingRoutes = allRoutes
      .sort((a, b) => a.sortDate - b.sortDate)
      .slice(0, 4);

    console.log("🔍 Debug worker assignments for", workerName);
    console.log("🔍 Original SPFM assignments:", assignments.spfm.length);
    console.log(
      "🔍 Original recovery assignments:",
      assignments.recovery.length,
    );
    console.log(
      "🔍 Filtered SPFM routes (not completed):",
      workerSPFMRoutes.length,
    );
    console.log("🔍 Generated recovery dates:", allRecoveryDates.length);
    console.log("🔍 Total routes found:", allRoutes.length);
    console.log("🔍 Upcoming routes (limited to 4):", upcomingRoutes.length);

    // Use unified renderer
    this.renderUnifiedAssignments({
      routes: upcomingRoutes,
      title: `${workerName}'s Upcoming Assignments`,
      emoji: workerEmoji,
      color: "#007bff",
      groupByMarket: false,
      printButtonText: "Print Assignment",
    });
  }

  // Use Screen 2's date calculation logic
  calculateNextOccurrence(dayName, occurrence) {
    const dayMap = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    const targetDay = dayMap[dayName.toLowerCase()];
    if (targetDay === undefined) return null;

    const today = new Date();
    const currentDay = today.getDay();

    // Calculate days until next occurrence of this weekday
    let daysUntilTarget = (targetDay - currentDay + 7) % 7;
    if (daysUntilTarget === 0 && occurrence === 0) {
      daysUntilTarget = 7; // If today is the target day, get next week's
    }

    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysUntilTarget + occurrence * 7);

    return targetDate;
  }

  // ========================================
  // DATE ASSIGNMENTS RENDERING
  // ========================================
  renderDateAssignments(date, routes) {
    // Convert routes to unified format
    const unifiedRoutes = routes.map((route) => ({
      ...route,
      type: "spfm",
      displayDate: date,
    }));

    const formattedDate = this.formatDateForDisplay(date);

    // Use unified renderer with market grouping
    this.renderUnifiedAssignments({
      routes: unifiedRoutes,
      title: formattedDate,
      emoji: "📅",
      color: "#007bff",
      groupByMarket: true,
      printButtonText: "Print Assignment",
    });
  }

  // ========================================
  // RECOVERY ROUTE ASSIGNMENTS RENDERING
  // ========================================
  renderRecoveryRouteAssignment(worker, dayName) {
    const assignmentsContainer = document.getElementById(
      "assignmentsContainer",
    );
    if (!assignmentsContainer) return;

    const workerEmoji = this.getWorkerEmoji(worker);

    // Find recovery routes for this worker and day
    const recoveryRoutes = sheetsAPI.recoveryData.filter((route) => {
      const routeWorker = (route.Worker || "").trim().toLowerCase();
      const routeDay = (route.Day || "").trim().toLowerCase();
      return (
        routeWorker === worker.toLowerCase() &&
        routeDay === dayName.toLowerCase()
      );
    });

    if (recoveryRoutes.length === 0) {
      assignmentsContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666; background: #f8f9fa; margin: 10px; border-radius: 8px;">
          <div style="font-size: 2rem; margin-bottom: 10px;">🚗</div>
          <h3>${workerEmoji} ${worker} - ${dayName} Recovery</h3>
          <p>No recovery routes found.</p>
        </div>
      `;
      return;
    }

    let html = `
      <div style="background: #f8f9fa; margin: 10px; padding: 15px; border-radius: 8px; border: 2px solid #28a745;">
        <div style="text-align: center; margin-bottom: 15px;">
          <div style="font-size: 2rem; margin-bottom: 5px;">🚗</div>
          <h3 style="margin: 0; color: #28a745;">${workerEmoji} ${worker} - ${dayName} Recovery</h3>
          <div style="border-top: 2px solid #ddd; margin: 10px 20px;"></div>
        </div>
    `;

    recoveryRoutes.forEach((route) => {
      html += `
        <div style="background: white; padding: 12px; margin-bottom: 12px; border-radius: 6px; border-left: 4px solid #28a745;">
          <div style="font-weight: bold; color: #333; margin-bottom: 8px;">
            📍 ${route.Location || "Location"}
          </div>
          <div style="display: grid; gap: 4px; font-size: 0.9rem;">
            <div><strong>Time:</strong> ${route.Time || "Not specified"}</div>
            <div><strong>Contact:</strong> ${route.Contact || "Not specified"}</div>
            ${route.Phone ? `<div><strong>Phone:</strong> ${route.Phone}</div>` : ""}
            ${route.Address ? `<div><strong>Address:</strong> ${route.Address}</div>` : ""}
            ${route.Notes ? `<div><strong>Notes:</strong> ${route.Notes}</div>` : ""}
          </div>
        </div>
      `;
    });

    html += `
        <div style="text-align: center; margin-top: 20px;">
          <button onclick="printAssignment()" class="directions-btn" style="background: #6c757d;">
            🖨️ Print Assignment
          </button>
        </div>
      </div>
    `;

    assignmentsContainer.innerHTML = html;
  }

  // ========================================
  // HELPER METHODS
  // ========================================
  getWorkerEmoji(workerName) {
    if (!workerName || workerName.trim() === "") return "👤";

    if (workerName.trim().toLowerCase().includes("volunteer")) {
      return "👤";
    }

    const workerIcons = {
      Samuel: "🐋",
      Emmanuel: "🦁",
      Irmydel: "🐸",
      Tess: "🌟",
      Ayoyo: "⚡",
      Rosey: "🌹",
      Boniat: "🌊",
      Volunteer: "👤",
    };

    const workerIcon = Object.keys(workerIcons).find(
      (key) => key.toLowerCase() === workerName.trim().toLowerCase(),
    );

    return workerIcon ? workerIcons[workerIcon] : "👤";
  }

  getVanEmoji(vanName) {
    if (!vanName || vanName.trim() === "") return "🚐";

    const vanIcons = {
      Tooth: "🦷",
      "Green Bean": "🫛",
      Marshmallow: "🧁",
    };

    const vanIcon = Object.keys(vanIcons).find(
      (key) => key.toLowerCase() === vanName.trim().toLowerCase(),
    );

    return vanIcon ? vanIcons[vanIcon] : "🚐";
  }

  formatDateForDisplay(dateString) {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString;
      }

      return date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (error) {
      return dateString;
    }
  }
}

// Export instance
const assignmentsManager = new AssignmentsManager();

// Confirm this file loaded
console.log("✅ assignments.js loaded");
window.assignmentsManagerLoaded = true;
