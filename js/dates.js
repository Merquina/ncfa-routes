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

    // Check if API data is loaded
    if (sheetsAPI.data.length === 0) {
      // Show loading state in dates container
      chronologicalContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666; background: #f8f9fa; margin: 10px; border-radius: 8px;">
          <div style="font-size: 2rem; margin-bottom: 10px;">📅</div>
          <p style="font-weight: bold; color: #007bff;">Loading upcoming routes...</p>
        </div>
      `;
      return;
    }

    // Get upcoming routes and render them directly in dates container
    this.renderUpcomingRoutesAsAssignments(chronologicalContainer);
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

    // Get SPFM routes for this date
    const spfmRoutes = sheetsAPI.getRoutesByDate(date);

    // Check if this date matches any recovery routes
    const recoveryRoute = this.findRecoveryRouteForDate(date);

    if (recoveryRoute) {
      // Show recovery route assignment
      assignmentsManager.renderRecoveryAssignment(recoveryRoute);
    } else if (spfmRoutes.length > 0) {
      // Show SPFM routes assignment
      assignmentsManager.renderDateAssignments(date, spfmRoutes);
    } else {
      // No routes found
      const assignmentsContainer = document.getElementById(
        "assignmentsContainer",
      );
      if (assignmentsContainer) {
        assignmentsContainer.innerHTML = `
          <div class="no-assignments">
            <h3>📅 ${date}</h3>
            <p>No routes scheduled for this date.</p>
          </div>
        `;
      }
    }
  }

  findRecoveryRouteForDate(targetDate) {
    console.log("🔍 Debug: findRecoveryRouteForDate called with:", targetDate);

    if (!sheetsAPI.recoveryData || sheetsAPI.recoveryData.length === 0) {
      console.log("🔍 Debug: No recovery data available");
      return null;
    }

    const targetDateObj = new Date(targetDate);
    const targetDateStr = targetDateObj.toLocaleDateString("en-US");
    console.log("🔍 Debug: Target date normalized:", targetDateStr);

    for (const route of sheetsAPI.recoveryData) {
      const dayName = route["Recovery Routes"] || route.Day || route.day;
      const stop1 = route["Stop 1"] || route["stop1"] || "";

      if (!dayName || stop1.trim() === "") continue;

      console.log(
        `🔍 Debug: Checking recovery route for ${dayName} with stop: ${stop1}`,
      );

      // Generate multiple occurrences to check against target date
      for (let occurrence = 0; occurrence < 10; occurrence++) {
        const calculatedDate = this.calculateNextOccurrence(
          dayName,
          occurrence,
        );
        if (calculatedDate) {
          const calculatedDateStr = calculatedDate.toLocaleDateString("en-US");
          console.log(
            `🔍 Debug: Comparing ${calculatedDateStr} with ${targetDateStr}`,
          );

          if (calculatedDateStr === targetDateStr) {
            console.log("🔍 Debug: Match found! Returning recovery route");
            return { ...route, calculatedDate: calculatedDate };
          }
        }
      }
    }

    console.log("🔍 Debug: No matching recovery route found");
    return null;
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
  // RENDER UPCOMING ROUTES AS ASSIGNMENTS (Like worker selection)
  // ========================================
  renderUpcomingRoutesAsAssignments(container) {
    console.log("🔍 Debug: renderUpcomingRoutesAsAssignments called");

    // Get all upcoming SPFM routes (not completed)
    const allSPFMRoutes = sheetsAPI.data.filter((route) => {
      const status = (route.status || route.Status || "").toLowerCase();
      const routeDate = new Date(route.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return status !== "completed" && routeDate >= today;
    });

    // Get upcoming recovery routes
    const recoveryDates = this.generateWeeklyRecoveryDates();
    const upcomingRecoveryRoutes = recoveryDates.slice(0, 4);

    // Combine all routes
    const allRoutes = [];

    // Add SPFM routes
    allSPFMRoutes.forEach((route) => {
      allRoutes.push({
        ...route,
        type: "spfm",
        sortDate: new Date(route.date),
        displayDate: route.date,
      });
    });

    // Add recovery routes
    upcomingRecoveryRoutes.forEach((route) => {
      allRoutes.push({
        ...route,
        type: "recovery",
        sortDate: route.parsed,
        displayDate: route.date,
      });
    });

    // Sort by date and take next 8 routes
    const upcomingRoutes = allRoutes
      .sort((a, b) => a.sortDate - b.sortDate)
      .slice(0, 8);

    if (upcomingRoutes.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666;">
          <p>No upcoming routes found.</p>
        </div>
      `;
      return;
    }

    // Render assignment cards directly at the top with no header
    let html = `<div style="margin: 0; padding: 0;">`;

    // Render all routes with identical cards
    upcomingRoutes.forEach((route) => {
      html += assignmentsManager.renderSingleAssignmentCard(route);
    });

    html += `</div>`;
    container.innerHTML = html;
  }

  // ========================================
  // OLD DATE BUTTON RENDERING (kept for reference)
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
    console.log(
      "🔍 Debug: Before combining - spfmDates:",
      spfmDates.length,
      "recoveryDates:",
      recoveryDates.length,
    );

    const combinedDates = [...spfmDates, ...recoveryDates];
    console.log("🔍 Debug: Combined dates:", combinedDates.length);

    const parsedDates = combinedDates.map((item) => {
      const parsed = new Date(item.date);
      console.log(
        `🔍 Debug: Parsing date "${item.date}" -> ${parsed}, isValid: ${!isNaN(parsed.getTime())}`,
      );
      return {
        ...item,
        parsed: parsed,
      };
    });

    const filteredDates = parsedDates.filter(
      (item) => !isNaN(item.parsed.getTime()),
    );
    console.log(
      "🔍 Debug: After filtering invalid dates:",
      filteredDates.length,
    );

    const sortedDates = filteredDates.sort((a, b) => a.parsed - b.parsed);
    console.log("🔍 Debug: After sorting:", sortedDates.length);

    const allDates = sortedDates.slice(0, 7); // Show next 7 dates
    console.log("🔍 Debug: Final allDates after slice(0,7):", allDates.length);
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

    console.log("🔍 Debug: About to render", allDates.length, "dates");
    console.log("🔍 Debug: allDates array:", allDates);

    // Use single column layout on mobile
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 10px; align-items: center; padding: 20px;">
        ${allDates
          .map((dateItem) => {
            const formattedDate = this.formatDate(dateItem.parsed);
            const routes =
              dateItem.type === "spfm"
                ? allSPFMRoutes.filter((route) => route.date === dateItem.date)
                : [dateItem];
            const routeCount = routes.length;
            const marketName =
              dateItem.type === "spfm"
                ? routeCount > 1
                  ? `${routeCount} Routes`
                  : routes[0]?.market || "Market"
                : "Recovery";
            const bgColor = dateItem.type === "spfm" ? "#fff3e0" : "#e3f2fd"; // Orange tint for SPFM, Blue tint for Recovery
            const borderColor =
              dateItem.type === "spfm" ? "#ff8c00" : "#007bff";
            const emoji = dateItem.type === "spfm" ? "👨‍🌾" : "🛒";

            console.log(
              `🔍 Debug: Rendering card for ${formattedDate}, type: ${dateItem.type}, bgColor: ${bgColor}`,
            );

            return `
              <div class="worker-card" onclick="selectDate('${dateItem.date}')"
                   style="display: inline-block; text-align: center; background: ${bgColor} !important; border: 2px solid ${borderColor} !important; min-width: 120px; min-height: 60px;">
                <div style="font-weight: bold; color: #333;">${formattedDate}</div>
                <div style="font-size: 0.8rem; margin-top: 4px; color: ${borderColor};">
                  ${emoji} ${marketName}
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;

    console.log(
      "🔍 Debug: Container innerHTML set, length:",
      container.innerHTML.length,
    );
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
