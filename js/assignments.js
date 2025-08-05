/* ========================================
   SPFM Routes - Assignments Management
   Fresh rewrite to fix syntax errors
   ======================================== */

class AssignmentsManager {
  constructor() {
    this.currentAssignment = null;
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
      assignmentsContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666; background: #f8f9fa; margin: 10px; border-radius: 8px;">
          <div style="font-size: 2rem; margin-bottom: 10px;">${workerEmoji}</div>
          <h3>${workerName}</h3>
          <p>No upcoming assignments found for this worker.</p>
        </div>
      `;
      return;
    }

    // Interleave SPFM and recovery routes chronologically
    const allRoutes = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Add SPFM routes with date parsing
    assignments.spfm.forEach((route) => {
      const routeDate = new Date(route.date);
      if (routeDate >= today) {
        allRoutes.push({
          ...route,
          type: "spfm",
          sortDate: routeDate,
          displayDate: route.date,
        });
      }
    });

    // Add recovery routes with generated dates
    assignments.recovery.forEach((route) => {
      const dayName = route.Day;
      if (dayName) {
        // Generate next few occurrences of this day
        for (let i = 0; i < 4; i++) {
          // Look ahead 4 weeks
          const nextDate = this.getNextDateForDay(dayName, i);
          if (nextDate >= today) {
            allRoutes.push({
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

    // Sort all routes by date and take only next 4
    const upcomingRoutes = allRoutes
      .sort((a, b) => a.sortDate - b.sortDate)
      .slice(0, 4);

    console.log("🔍 Debug worker assignments for", workerName);
    console.log("🔍 Total routes found:", allRoutes.length);
    console.log("🔍 Upcoming routes (limited to 4):", upcomingRoutes.length);
    console.log("🔍 Upcoming routes:", upcomingRoutes);

    if (upcomingRoutes.length === 0) {
      assignmentsContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666; background: #f8f9fa; margin: 10px; border-radius: 8px;">
          <div style="font-size: 2rem; margin-bottom: 10px;">${workerEmoji}</div>
          <h3>${workerName}</h3>
          <p>No upcoming assignments found for this worker.</p>
        </div>
      `;
      return;
    }

    let html = `
      <div style="background: #f8f9fa; margin: 10px; padding: 15px; border-radius: 8px; border: 2px solid #007bff;">
        <div style="text-align: center; margin-bottom: 15px;">
          <div style="font-size: 2rem; margin-bottom: 5px;">${workerEmoji}</div>
          <h3 style="margin: 0; color: #007bff;">${workerName}'s Upcoming Assignments</h3>
          <div style="border-top: 2px solid #ddd; margin: 10px 20px;"></div>
        </div>
    `;

    // Render interleaved routes
    upcomingRoutes.forEach((route, index) => {
      if (route.type === "spfm") {
        const vanEmoji = this.getVanEmoji(route.van1 || route.van2);
        html += `
          <div style="background: white; padding: 12px; margin-bottom: 12px; border-radius: 6px; border-left: 4px solid #007bff;">
            <div style="font-weight: bold; color: #333; margin-bottom: 8px;">
              ${vanEmoji} ${route.displayDate} - ${route.market || "Market"} ${route.startTime ? `at ${route.startTime}` : ""}
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
                  .filter((w) => w && w.trim())
                  .map((w) => `${this.getWorkerEmoji(w)} ${w}`);
                const vans = [route.van1, route.van2]
                  .filter((v) => v && v.trim())
                  .map((v) => `${this.getVanEmoji(v)} ${v}`);
                return [...workers, ...vans].join(", ") || "Not assigned";
              })()}</div>
              ${route.dropOff ? `<div><strong>Drop-off:</strong> ${route.dropOff}</div>` : ""}
            </div>
          </div>
        `;
      } else {
        // Recovery route
        html += `
          <div style="background: white; padding: 12px; margin-bottom: 12px; border-radius: 6px; border-left: 4px solid #28a745;">
            <div style="font-weight: bold; color: #333; margin-bottom: 8px;">
              🚗 ${route.displayDate} - ${route.Location || "Location"}
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

  // Helper method to get next occurrence of a day
  getNextDateForDay(dayName, weeksOffset = 0) {
    const days = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const targetDay = days.indexOf(dayName.toLowerCase());

    if (targetDay === -1) return new Date(); // fallback

    const today = new Date();
    const currentDay = today.getDay();
    let daysUntilTarget = (targetDay - currentDay + 7) % 7;

    if (daysUntilTarget === 0 && weeksOffset === 0) {
      daysUntilTarget = 7; // If it's the same day, go to next week
    }

    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + daysUntilTarget + weeksOffset * 7);

    return targetDate;
  }

  // ========================================
  // DATE ASSIGNMENTS RENDERING
  // ========================================
  renderDateAssignments(date, routes) {
    const assignmentsContainer = document.getElementById(
      "assignmentsContainer",
    );
    if (!assignmentsContainer) return;

    if (!routes || routes.length === 0) {
      assignmentsContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666; background: #f8f9fa; margin: 10px; border-radius: 8px;">
          <div style="font-size: 2rem; margin-bottom: 10px;">📅</div>
          <h3>${date}</h3>
          <p>No routes found for this date.</p>
        </div>
      `;
      return;
    }

    const formattedDate = this.formatDateForDisplay(date);

    // Group routes by market
    const marketGroups = {};
    routes.forEach((route) => {
      const market = route.market || "Market";
      if (!marketGroups[market]) {
        marketGroups[market] = [];
      }
      marketGroups[market].push(route);
    });

    const markets = Object.keys(marketGroups);
    const totalMarkets = markets.length;

    let html = `
      <div style="background: #f8f9fa; margin: 10px; padding: 15px; border-radius: 8px; border: 2px solid #007bff;">
        <div style="text-align: center; margin-bottom: 15px;">
          <div style="font-size: 2rem; margin-bottom: 5px;">📅</div>
          <h3 style="margin: 0; color: #007bff;">${formattedDate}</h3>
          <div style="border-top: 2px solid #ddd; margin: 10px 20px;"></div>
        </div>
    `;

    markets.forEach((market, marketIndex) => {
      const marketRoutes = marketGroups[market];
      const marketId = `market-${date.replace(/[^a-zA-Z0-9]/g, "")}-${marketIndex}`;

      html += `
        <div id="${marketId}" class="market-section" style="margin-bottom: 20px;">
      `;

      // Add market banner if multiple markets
      if (totalMarkets > 1) {
        html += `
          <div style="background: #007bff; color: white; padding: 8px 12px; margin-bottom: 12px; border-radius: 4px; font-weight: bold; text-align: center; font-size: 0.9rem;">
            Market ${marketIndex + 1} of ${totalMarkets}
          </div>
        `;
      }

      marketRoutes.forEach((route) => {
        const vanEmoji = this.getVanEmoji(route.van1 || route.van2);
        html += `
          <div style="background: white; padding: 12px; margin-bottom: 12px; border-radius: 6px; border-left: 4px solid #007bff;">
            <div style="font-weight: bold; color: #333; margin-bottom: 8px;">
              ${vanEmoji} ${market} Route ${route.startTime ? `- ${route.startTime}` : ""}
            </div>
            <div style="display: grid; gap: 4px; font-size: 0.9rem;">
              <div><strong>Team:</strong> ${(() => {
                const workers = [
                  route.worker1,
                  route.worker2,
                  route.worker3,
                  route.worker4,
                ]
                  .filter(
                    (w) => w && w.trim() && w.toLowerCase() !== "cancelled",
                  )
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
      });

      // Individual print button for each market
      html += `
          <div style="text-align: center; margin-top: 15px; margin-bottom: 15px;">
            <button onclick="printMarketSection('${marketId}')" class="directions-btn" style="background: #6c757d; font-size: 0.9rem;">
              🖨️ Print ${totalMarkets > 1 ? `Market ${marketIndex + 1}` : "Assignment"}
            </button>
          </div>
        </div>
      `;
    });

    html += `</div>`;

    assignmentsContainer.innerHTML = html;
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
