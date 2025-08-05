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

    // Get all SPFM dates
    const spfmDates = sheetsAPI.getAllDates().map((date) => ({
      date: date,
      type: "spfm",
      emoji: "👨‍🌾",
      color: "#28a745", // green
    }));

    // Get all recovery dates
    const recoveryDates = sheetsAPI.recoveryData
      .map((route) => ({
        date: route.Date || route.date,
        type: "recovery",
        emoji: "🛒",
        color: "#ff8c00", // orange
      }))
      .filter((item) => item.date);

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
      .slice(0, 8); // Show next 8 dates

    console.log("🔍 Debug: allDates:", allDates);

    if (allDates.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666;">
          <p>No upcoming dates found. Check console for debug info.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = allDates
      .map((dateItem) => {
        const formattedDate = this.formatDate(dateItem.parsed);
        const routes =
          dateItem.type === "spfm"
            ? sheetsAPI.getRoutesByDate(dateItem.date)
            : sheetsAPI.recoveryData.filter(
                (r) => (r.Date || r.date) === dateItem.date,
              );

        const workers =
          dateItem.type === "spfm"
            ? routes
                .flatMap((r) => [r.worker1, r.worker2, r.worker3, r.worker4])
                .filter(Boolean)
                .filter((w) => w.toLowerCase() !== "cancelled")
            : routes.map((r) => r.Worker).filter(Boolean);

        const routeQty = routes.length;
        const locations =
          dateItem.type === "spfm"
            ? routes
                .map((r) => r.location || r.Location)
                .filter(Boolean)
                .slice(0, 2)
            : routes
                .map((r) => r.Location || r.location)
                .filter(Boolean)
                .slice(0, 2);
        const locationsText =
          locations.join(", ") +
          (locations.length < routes.length ? "..." : "");
        const routeType =
          dateItem.type === "spfm" ? "SPFM Routes" : "Recovery Routes";

        return `
          <div class="date-card" onclick="selectDate('${dateItem.date}')"
               style="border: 2px solid ${dateItem.color}; border-radius: 8px; padding: 10px; text-align: left;">
            <div style="font-weight: bold; margin-bottom: 3px;">${routeType}</div>
            <div style="margin-bottom: 3px;">${locationsText || "Market"}</div>
            <div style="margin-bottom: 3px;">${formattedDate}</div>
            ${routeQty < 2 ? `<div style="margin-bottom: 3px;">${workers.slice(0, 3).join(", ")}${workers.length > 3 ? "..." : ""}</div>` : ""}
            <div style="font-weight: bold;">Routes: ${routeQty}</div>
          </div>
        `;
      })
      .join("");
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

  getNextDateForDay(dayName) {
    if (!dayName) return null;

    const days = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const dayIndex = days.findIndex(
      (day) => day.toLowerCase() === dayName.toLowerCase(),
    );

    if (dayIndex === -1) return null;

    const today = new Date();
    const currentDay = today.getDay();
    const daysUntilTarget = (dayIndex - currentDay + 7) % 7;
    const targetDate = new Date(today);
    targetDate.setDate(
      today.getDate() + (daysUntilTarget === 0 ? 7 : daysUntilTarget),
    );

    return targetDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
}

// Export instance
const datesManager = new DatesManager();

// Confirm this file loaded
console.log("✅ dates.js loaded");
window.datesManagerLoaded = true;
