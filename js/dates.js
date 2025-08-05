/* ========================================
   SPFM Routes - Dates Management
   ======================================== */

class DatesManager {
  constructor() {
    this.currentDate = null;
  }

  // ========================================
  // DATES RENDERING
  // ========================================
  renderDates() {
    const chronologicalContainer =
      document.getElementById("chronologicalDates");

    if (!chronologicalContainer) return;

    // Render all dates chronologically
    this.renderChronologicalDates(chronologicalContainer);
  }

  renderSPFMDates(container) {
    const dates = sheetsAPI.getAllDates();

    if (dates.length === 0) {
      container.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #666;">
                    <p>No SPFM dates found.</p>
                </div>
            `;
      return;
    }

    // Get next 4 upcoming dates
    const today = new Date();
    const upcomingDates = dates
      .map((date) => ({
        original: date,
        parsed: new Date(date),
      }))
      .filter((dateObj) => dateObj.parsed >= today)
      .slice(0, 4);

    if (upcomingDates.length === 0) {
      container.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #666;">
                    <p>No upcoming SPFM dates found.</p>
                </div>
            `;
      return;
    }

    container.innerHTML = upcomingDates
      .map((dateObj) => {
        const routes = sheetsAPI.getRoutesByDate(dateObj.original);
        const workers = routes
          .flatMap((r) => [r.worker1, r.worker2, r.worker3, r.worker4])
          .filter(Boolean)
          .filter((w) => w.toLowerCase() !== "cancelled")
          .map((w) => `${workersManager.getWorkerEmoji(w)} ${w}`)
          .join(", ");

        const markets = [...new Set(routes.map((r) => r.market))].join(", ");

        return `
                    <div class="date-card" onclick="selectDate('${dateObj.original}')">
                        <h3>${this.formatDate(dateObj.parsed)}</h3>
                        <p><strong>Markets:</strong> ${markets || "TBD"}</p>
                        <p><strong>Workers:</strong> ${workers || "None assigned"}</p>
                        <p><strong>Routes:</strong> ${routes.length}</p>
                    </div>
                `;
      })
      .join("");
  }

  renderRecoveryDates(container) {
    if (sheetsAPI.recoveryData.length === 0) {
      container.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 8px; color: #666;">
                    No recovery routes scheduled.
                </div>
            `;
      return;
    }

    // Get next 4 recovery route dates
    const today = new Date();
    const recoveryRoutes = sheetsAPI.recoveryData
      .filter(
        (route) =>
          route["Recovery Routes"] &&
          route.Worker &&
          route.Worker.toLowerCase() !== "worker",
      )
      .map((route) => {
        const calculatedDate = this.getNextDateForDay(route["Recovery Routes"]);
        return {
          ...route,
          calculatedDate,
          sortDate: calculatedDate
            ? new Date(calculatedDate)
            : new Date("1900-01-01"),
        };
      })
      .filter((route) => route.sortDate >= today)
      .sort((a, b) => a.sortDate - b.sortDate)
      .slice(0, 4);

    if (recoveryRoutes.length === 0) {
      container.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 8px; color: #666;">
                    No upcoming recovery routes.
                </div>
            `;
      return;
    }

    container.innerHTML = recoveryRoutes
      .map(
        (route) => `
                <div class="date-card" onclick="selectRecoveryRoute('${route.Worker}', '${route["Recovery Routes"]}')">
                    <h3>${route.calculatedDate || route["Recovery Routes"]}</h3>
                    <p><strong>Worker:</strong> ${workersManager.getWorkerEmoji(route.Worker)} ${route.Worker}</p>
                    <p><strong>Type:</strong> Recovery Route</p>
                </div>
            `,
      )
      .join("");
  }

  // ========================================
  // DATE SELECTION
  // ========================================
  selectDate(date) {
    this.currentDate = date;

    // Update UI
    document.querySelectorAll(".date-card").forEach((card) => {
      card.classList.remove("selected");
    });

    event.target.classList.add("selected");

    // Get routes for this date
    const routes = sheetsAPI.getRoutesByDate(date);
    assignmentsManager.renderDateAssignments(date, routes);
  }

  selectRecoveryRoute(worker, dayName) {
    const route = sheetsAPI.recoveryData.find(
      (r) => r.Worker === worker && r["Recovery Routes"] === dayName,
    );

    if (!route) return;

    const calculatedDate = this.getNextDateForDay(dayName);
    route.calculatedDate = calculatedDate;

    assignmentsManager.renderRecoveryRouteAssignment(route);
  }

  // ========================================
  // DATE ASSIGNMENTS RENDERING
  // ========================================
  renderDateAssignments(date, routes) {
    // Delegate to assignments manager
    assignmentsManager.renderDateAssignments(date, routes);
  }

  renderRecoveryRouteAssignment(route) {
    // Delegate to assignments manager
    assignmentsManager.renderRecoveryRouteAssignment(route);
  }

  // ========================================
  // CHRONOLOGICAL RENDERING
  // ========================================
  renderChronologicalDates(container) {
    console.log("🔍 Debug: renderChronologicalDates called");
    console.log("🔍 Debug: sheetsAPI.data length:", sheetsAPI.data.length);
    console.log(
      "🔍 Debug: sheetsAPI.recoveryData length:",
      sheetsAPI.recoveryData.length,
    );

    // Get all SPFM dates with market info, excluding completed routes
    const allSPFMRoutes = sheetsAPI.data.filter((route) => {
      const status = (
        route["Status"] ||
        route["status"] ||
        route["A"] ||
        ""
      ).toLowerCase();
      return status !== "completed";
    });

    const spfmDates = [
      ...new Set(allSPFMRoutes.map((route) => route.date).filter(Boolean)),
    ].map((date) => {
      const routes = allSPFMRoutes.filter((route) => route.date === date);
      const market =
        routes.length > 0
          ? routes[0].market || routes[0].Market || "Market"
          : "Market";
      return {
        date: date,
        type: "spfm",
        emoji: "👨‍🌾",
        color: "#007bff", // blue
        market: market,
      };
    });

    // Generate weekly recovery dates based on day of week
    const recoveryDates = this.generateWeeklyRecoveryDates();

    console.log("🔍 Debug: spfmDates:", spfmDates);
    console.log("🔍 Debug: recoveryDates:", recoveryDates);

    // Combine and sort chronologically
    const allDates = [...spfmDates, ...recoveryDates]
      .map((item) => ({
        ...item,
        parsed: new Date(item.date),
      }))
      .filter((item) => !isNaN(item.parsed.getTime()))
      .sort((a, b) => a.parsed - b.parsed)
      .slice(0, 7); // Show next 7 dates

    console.log("🔍 Debug: allDates:", allDates);

    if (allDates.length === 0) {
      // Check if API data hasn't loaded yet
      if (sheetsAPI.data.length === 0 && sheetsAPI.recoveryData.length === 0) {
        const cacheBreaker = Date.now();
        container.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666;">
            <p>🔄 Loading route data... (${cacheBreaker})</p>
            <p style="font-size: 0.8rem; margin-top: 10px;">Click to load Google Sheets data</p>
            <button class="directions-btn" onclick="loadApiDataIfNeeded().then(() => datesManager.renderDates())" style="margin-top: 15px;">Load Routes</button>
          </div>
        `;
      } else {
        const cacheBreaker = Date.now();
        container.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666;">
            <p>No upcoming dates found. (${cacheBreaker})</p>
          </div>
        `;
      }
      return;
    }

    const cacheBreaker = Date.now();
    container.innerHTML =
      `<!-- Route cards rendered at ${cacheBreaker} -->` +
      allDates
        .map((dateItem) => {
          const formattedDate = this.formatDate(dateItem.parsed);
          const routes =
            dateItem.type === "spfm"
              ? allSPFMRoutes.filter((route) => route.date === dateItem.date)
              : [dateItem]; // For generated recovery routes, use the dateItem itself

          const workers =
            dateItem.type === "spfm"
              ? routes
                  .flatMap((r) => [r.worker1, r.worker2, r.worker3, r.worker4])
                  .filter(Boolean)
                  .filter((w) => w.toLowerCase() !== "cancelled")
              : dateItem.worker
                ? [dateItem.worker]
                : [];

          // Add worker emojis
          const workersWithEmojis = workers
            .map((worker) => {
              const emoji = this.getWorkerEmoji(worker);
              return `${emoji} ${worker}`;
            })
            .slice(0, 3);
          const workersText =
            workersWithEmojis.join(", ") + (workers.length > 3 ? "..." : "");

          const routeQty = dateItem.type === "spfm" ? routes.length : 1;
          const locations =
            dateItem.type === "spfm"
              ? routes
                  .map((r) => r.location || r.Location)
                  .filter(Boolean)
                  .slice(0, 2)
              : [dateItem.location];
          const locationsText = locations.filter(Boolean).join(", ");
          const routeType =
            dateItem.type === "spfm" ? "SPFM Routes" : "Recovery Routes";
          const marketName =
            dateItem.type === "spfm"
              ? routeQty >= 2
                ? routes
                    .map((r) => r.market || r.Market || "Market")
                    .filter(Boolean)
                    .join(", ")
                : dateItem.market
              : dateItem.location || "Recovery Route";
          const firstLine = `${dateItem.emoji} ${routeType} - ${formattedDate}`;

          return `
          <div class="date-card" onclick="selectDate('${dateItem.date}')"
               style="border: 2px solid ${dateItem.color}; border-radius: 8px; padding: 10px; text-align: left;">
            <div style="font-weight: bold; margin-bottom: 3px;">${firstLine}</div>
            <div style="margin-bottom: 3px;">${marketName}</div>
            ${dateItem.type === "spfm" && locationsText ? `<div style="margin-bottom: 3px;">${locationsText}</div>` : ""}
            ${routeQty < 2 ? `<div style="margin-bottom: 3px;"><strong>Workers:</strong> ${workersText}</div>` : ""}
            ${routeQty >= 2 ? `<div style="font-weight: bold;">Routes: ${routeQty}</div>` : ""}
          </div>
        `;
        })
        .join("");
  }

  // ========================================
  // RECOVERY DATE GENERATION
  // ========================================
  generateWeeklyRecoveryDates() {
    const recoveryDates = [];
    const today = new Date();

    console.log("🔍 Debug: generateWeeklyRecoveryDates called");
    console.log("🔍 Debug: sheetsAPI.recoveryData:", sheetsAPI.recoveryData);

    // Get recovery route patterns from sheets (day of week info)
    if (sheetsAPI.recoveryData && sheetsAPI.recoveryData.length > 0) {
      console.log("🔍 Debug: Found recovery data, processing routes...");
      sheetsAPI.recoveryData.forEach((route, index) => {
        console.log(`🔍 Debug: Processing recovery route ${index}:`, route);
        const dayName = route["Recovery Routes"] || route.Day || route.day;
        const stop1 = route["Stop 1"] || route["stop1"] || "";
        console.log(`🔍 Debug: Day name extracted: ${dayName}`);
        console.log(`🔍 Debug: Stop 1 extracted: ${stop1}`);
        if (dayName && stop1.trim() !== "") {
          // Generate next 12 occurrences of this recovery route
          for (let occurrence = 0; occurrence < 12; occurrence++) {
            const nextDate = this.calculateNextOccurrence(dayName, occurrence);
            if (nextDate) {
              const recoveryRoute = {
                date: nextDate.toLocaleDateString("en-US"),
                parsed: nextDate,
                type: "recovery",
                emoji: "🛒",
                color: "#ff8c00", // orange
                dayName: dayName,
                worker: route.Worker || route.worker,
                location: route.Location || route.location || "Recovery Route",
              };
              console.log(
                `🔍 Debug: Generated recovery route for ${dayName}, occurrence ${occurrence}:`,
                recoveryRoute,
              );
              recoveryDates.push(recoveryRoute);
            }
          }
        } else {
          console.log(`🔍 Debug: No day name found for route ${index}`);
        }
      });
    } else {
      console.log("🔍 Debug: No recovery data found or empty array");
    }

    console.log("🔍 Debug: Final recovery dates array:", recoveryDates);
    return recoveryDates;
  }

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
  // HELPER METHODS
  // ========================================
  formatDate(date) {
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  getNextDateForDay(dayName, weeksFromNow = 0) {
    return this.calculateNextOccurrence(dayName, weeksFromNow);
  }

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
}

// Export instance
const datesManager = new DatesManager();

// Confirm this file loaded
console.log("✅ dates.js loaded");
window.datesManagerLoaded = true;
