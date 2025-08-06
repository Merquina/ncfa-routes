/* ========================================
   SPFM Routes - Assignments Management
   ======================================== */

class AssignmentsManager {
  constructor() {
    this.currentRoutes = []; // Store current routes for detailed view access
  }

  // ========================================
  // UNIFIED ASSIGNMENTS RENDERING
  // ========================================

  renderUnifiedAssignments(config) {
    const {
      routes,
      title,
      emoji,
      color = "#007bff",
      groupByMarket = false,
      printButtonText = "Print Assignment",
      showPrintButton = true,
    } = config;

    const assignmentsContainer = document.getElementById(
      "assignmentsContainer",
    );
    if (!assignmentsContainer) return;

    // Store routes for detailed view access
    this.currentRoutes = routes;

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

    if (groupByMarket) {
      const routesByMarket = {};
      routes.forEach((route) => {
        const market = route.market || "Unknown Market";
        if (!routesByMarket[market]) routesByMarket[market] = [];
        routesByMarket[market].push(route);
      });

      Object.keys(routesByMarket).forEach((market) => {
        html += `<h4 style="color: ${color}; margin-top: 20px;">${market}</h4>`;
        routesByMarket[market].forEach((route, index) => {
          route._routeId = `${market}_${index}`;
          html += this.renderSingleAssignmentCard(route);
        });
      });
    } else {
      routes.forEach((route, index) => {
        route._routeId = `route_${index}`;
        html += this.renderSingleAssignmentCard(route);
      });
    }

    if (showPrintButton) {
      html += `
        <div style="text-align: center; margin-top: 20px;">
          <button onclick="printAssignment()" class="directions-btn" style="background: #6c757d;">
            🖨️ ${printButtonText}
          </button>
        </div>
      `;
    }

    html += `</div>`;
    assignmentsContainer.innerHTML = html;
  }

  renderSingleAssignmentCard(route) {
    if (route.type === "recovery") {
      return this.renderRecoveryCard(route);
    } else {
      return this.renderSPFMCard(route);
    }
  }

  renderSPFMCard(route) {
    const workers = [route.worker1, route.worker2, route.worker3, route.worker4]
      .filter((w) => w && w.trim() && w.toLowerCase() !== "cancelled")
      .map((w) => `${this.getWorkerEmoji(w)} ${w}`);

    const vans = [route.van1, route.van2]
      .filter((v) => v && v.trim())
      .map((v) => `${this.getVanEmoji(v)} ${v}`);

    return `
      <div onclick="assignmentsManager.openDetailedView('${route._routeId}')" style="background: white; padding: 12px; margin: 0 0 8px 0; border-radius: 6px; border-left: 4px solid #ff8c00; cursor: pointer; transition: transform 0.1s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
        <div style="font-weight: bold; color: #333; margin-bottom: 4px;">
          ${route.displayDate || route.date} - ${route.market || "Market"}
        </div>
        <div style="font-size: 0.9rem; color: #666; margin-bottom: 4px;">
          ${route.startTime || "TBD"}
        </div>
        <div style="font-size: 0.85rem; color: #ff8c00; margin-bottom: 4px;">
          👨‍🌾 SPFM Route
        </div>
        <div style="font-size: 0.9rem; color: #666; margin-bottom: 4px;">
          ${(() => {
            const teamSlots = [...workers];
            while (teamSlots.length < 3) {
              teamSlots.push(
                '<span style="color: #800020; font-style: italic;">Need worker</span>',
              );
            }
            return teamSlots.slice(0, 3).join(", ");
          })()}
        </div>
        <div style="font-size: 0.9rem; color: #666;">
          ${vans.join(", ") || '<span style="color: #800020; font-style: italic;">No vans assigned</span>'}
        </div>
      </div>
    `;
  }

  renderRecoveryCard(route) {
    return `
      <div onclick="assignmentsManager.openDetailedView('${route._routeId}')" style="background: white; padding: 12px; margin: 0 0 8px 0; border-radius: 6px; border-left: 4px solid #007bff; cursor: pointer; transition: transform 0.1s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
        <div style="font-weight: bold; color: #333; margin-bottom: 4px;">
          ${route.displayDate}
        </div>
        <div style="font-size: 0.9rem; color: #666; margin-bottom: 4px;">
          ${route.Time || "TBD"}
        </div>
        <div style="font-size: 0.85rem; color: #007bff; margin-bottom: 4px;">
          🛒 Recovery Route
        </div>
        <div style="font-size: 0.9rem; color: #666; margin-bottom: 4px;">
          ${route.Worker ? `${this.getWorkerEmoji(route.Worker)} ${route.Worker}` : '<span style="color: #800020; font-style: italic;">Need worker</span>'}
        </div>
        <div style="font-size: 0.9rem; color: #666;">
          ${route.van ? `${this.getVanEmoji(route.van)} ${route.van}` : '<span style="color: #800020; font-style: italic;">No vans assigned</span>'}
        </div>
      </div>
    `;
  }

  // ========================================
  // WORKER ASSIGNMENTS RENDERING
  // ========================================

  renderWorkerAssignments(workerName, assignments) {
    if (
      !assignments ||
      (assignments.spfm.length === 0 && assignments.recovery.length === 0)
    ) {
      this.renderUnifiedAssignments({
        routes: [],
        title: `${workerName}'s Upcoming Assignments`,
        emoji: this.getWorkerEmoji(workerName),
        color: "#007bff",
        groupByMarket: false,
        printButtonText: "Print Assignment",
        showPrintButton: false,
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
      const dayName =
        route["recovery route"] ||
        route.Day ||
        route["Recovery Routes"] ||
        route.day;
      if (dayName) {
        // Generate next 12 occurrences like Screen 2
        for (let occurrence = 0; occurrence < 12; occurrence++) {
          const nextDate = this.calculateNextOccurrence(dayName, occurrence);
          if (nextDate && nextDate >= today) {
            allRecoveryDates.push({
              ...route,
              type: "recovery",
              sortDate: nextDate,
              dayName: dayName,
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
      emoji: this.getWorkerEmoji(workerName),
      color: "#007bff",
      groupByMarket: false,
      printButtonText: "Print Assignment",
      showPrintButton: false,
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

  renderDateAssignments(date, spfmRoutes, recoveryRoute) {
    const allRoutes = [...spfmRoutes];
    if (recoveryRoute) allRoutes.push(recoveryRoute);

    const formattedDate = new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    this.renderUnifiedAssignments({
      routes: allRoutes,
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
      const routeDay = (route["recovery route"] || route.Day || "")
        .trim()
        .toLowerCase();
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
        <div style="background: white; padding: 15px; margin-bottom: 10px; border-radius: 8px; border-left: 4px solid #007bff;">
          <h4>Recovery Route Details</h4>
          <p><strong>Day:</strong> ${dayName}</p>
          <p><strong>Worker:</strong> ${workerEmoji} ${worker}</p>
          ${route.Notes ? `<p><strong>Notes:</strong> ${route.Notes}</p>` : ""}
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
  // WORKER EMOJI HELPER
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
    if (!vanName) return "🚐";

    const vanIcons = {
      "Van 1": "🚐",
      "Van 2": "🚌",
      "Van 3": "🚚",
      "van 1": "🚐",
      "van 2": "🚌",
      "van 3": "🚚",
    };

    return vanIcons[vanName] || "🚐";
  }

  formatDateForDisplay(dateStr) {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (error) {
      return dateStr;
    }
  }

  // ========================================
  // UPCOMING ROUTES
  // ========================================

  getUpcomingRoutes(limit = 8) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get SPFM routes (not completed)
    const allSPFMRoutes = sheetsAPI.data.filter((route) => {
      const status = (route.status || route.Status || "").toLowerCase();
      const routeDate = new Date(route.date);
      return status !== "completed" && routeDate >= today;
    });

    // Get recovery routes
    const recoveryDates = datesManager.generateWeeklyRecoveryDates();
    const upcomingRecoveryRoutes = recoveryDates.slice(0, 4);

    const allRoutes = [];

    // Add SPFM routes with displayDate
    allSPFMRoutes.forEach((route) => {
      allRoutes.push({
        ...route,
        type: "spfm",
        sortDate: new Date(route.date),
        displayDate: route.date,
      });
    });

    // Add recovery routes with properly formatted dates
    upcomingRecoveryRoutes.forEach((route) => {
      allRoutes.push({
        ...route,
        type: "recovery",
        sortDate: route.parsed,
        displayDate: route.parsed.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
      });
    });

    // Sort and limit
    return allRoutes.sort((a, b) => a.sortDate - b.sortDate).slice(0, limit);
  }

  renderAllUpcomingRoutes() {
    const upcomingRoutes = this.getUpcomingRoutes(8);

    if (upcomingRoutes.length === 0) {
      this.renderUnifiedAssignments({
        routes: [],
        title: "All Upcoming Routes",
        emoji: "📅",
        color: "#007bff",
        groupByMarket: true,
        showPrintButton: true,
      });
    } else {
      this.renderUnifiedAssignments({
        routes: upcomingRoutes,
        title: "All Upcoming Routes",
        emoji: "📅",
        color: "#007bff",
        groupByMarket: true,
        showPrintButton: true,
      });
    }
  }

  // ========================================
  // DETAILED VIEW FUNCTIONALITY
  // ========================================

  openDetailedView(routeId) {
    const route = this.currentRoutes.find((r) => r._routeId === routeId);
    if (!route) return;

    if (route.type === "recovery") {
      this.renderRecoveryDetailedView(route);
    } else {
      this.renderSPFMDetailedView(route);
    }
  }

  renderSPFMDetailedView(route) {
    const assignmentsContainer = document.getElementById(
      "assignmentsContainer",
    );

    const materialsOffice = (route.materials_office || "")
      .split(",")
      .filter((item) => item.trim());
    const materialsStorage = (route.materials_storage || "")
      .split(",")
      .filter((item) => item.trim());
    const atMarket = (route.atMarket || "")
      .split(",")
      .filter((item) => item.trim());
    const backAtOffice = (route.backAtOffice || "")
      .split(",")
      .filter((item) => item.trim());

    const googleMapsUrl = this.buildSPFMGoogleMapsUrl(route);

    assignmentsContainer.innerHTML = `
      <div style="background: #f8f9fa; margin: 10px; padding: 15px; border-radius: 8px; border: 2px solid #ff8c00;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #ff8c00; margin: 0 0 10px 0;">👨‍🌾 ${route.market || "Market"} - SPFM Route</h2>
          <p style="margin: 0 0 15px 0; color: #666;">${route.displayDate || route.date} at ${route.startTime || "TBD"}</p>

          <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
            <button onclick="assignmentsManager.printAssignment()" style="background: #6f42c1; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer;">
              🖨️ Print this assignment
            </button>
            <button onclick="window.open('${googleMapsUrl}', '_blank')" style="background: #28a745; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer;">
              🗺️ Full route on Google Maps
            </button>
          </div>
        </div>

        <div style="display: grid; gap: 20px;">
          <!-- At the Office Section -->
          <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #17a2b8;">
            <h3 style="color: #17a2b8; margin: 0 0 15px 0;">🏢 At the Office</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
              <div>
                <h4 style="margin: 0 0 10px 0; color: #666;">Materials (Office)</h4>
                ${materialsOffice
                  .map(
                    (item) => `
                  <label style="display: block; margin-bottom: 5px; cursor: pointer;">
                    <input type="checkbox" style="margin-right: 8px;"> ${item.trim()}
                  </label>
                `,
                  )
                  .join("")}
                ${materialsOffice.length === 0 ? '<p style="color: #999; font-style: italic;">No items listed</p>' : ""}
              </div>
              <div>
                <h4 style="margin: 0 0 10px 0; color: #666;">Materials (Storage)</h4>
                ${materialsStorage
                  .map(
                    (item) => `
                  <label style="display: block; margin-bottom: 5px; cursor: pointer;">
                    <input type="checkbox" style="margin-right: 8px;"> ${item.trim()}
                  </label>
                `,
                  )
                  .join("")}
                ${materialsStorage.length === 0 ? '<p style="color: #999; font-style: italic;">No items listed</p>' : ""}
              </div>
            </div>
          </div>

          <!-- At Market Section -->
          <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #ff8c00;">
            <h3 style="color: #ff8c00; margin: 0 0 15px 0;">🏪 At Market</h3>
            ${
              route.market
                ? `
              <div style="margin-bottom: 15px;">
                <button onclick="window.open('https://maps.google.com/maps?q=${encodeURIComponent(route.market)}', '_blank')" style="background: #28a745; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">
                  📍 ${(() => {
                    const contact = sheetsAPI.getAddressFromContacts(
                      route.market,
                    );
                    return contact && contact.address
                      ? contact.address
                      : route.market;
                  })()}
                </button>
              </div>
              `
                : ""
            }
            ${atMarket
              .map(
                (item) => `
              <label style="display: block; margin-bottom: 5px; cursor: pointer;">
                <input type="checkbox" style="margin-right: 8px;"> ${item.trim()}
              </label>
            `,
              )
              .join("")}
            ${atMarket.length === 0 ? '<p style="color: #999; font-style: italic;">No items listed</p>' : ""}
          </div>

          <!-- Dropoff Section -->
          <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745;">
            <h3 style="color: #28a745; margin: 0 0 15px 0;">📍 Dropoff</h3>
            <div style="margin-bottom: 10px;">
              ${
                route.dropOff
                  ? `
                <button onclick="window.open('https://maps.google.com/maps?q=${encodeURIComponent(route.dropOff)}', '_blank')" style="background: #28a745; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                  📍 ${(() => {
                    const contact = sheetsAPI.getAddressFromContacts(
                      route.dropOff,
                    );
                    return contact && contact.address
                      ? contact.address
                      : route.dropOff;
                  })()}
                </button>
              `
                  : '<p style="color: #999; font-style: italic;">No dropoff location specified</p>'
              }
              ${
                route.contact
                  ? `
                <button onclick="window.open('tel:${route.contact}', '_blank')" style="background: #007bff; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">
                  📞 ${route.contact}
                </button>
              `
                  : ""
              }
            </div>
          </div>

          <!-- Back at Office Section -->
          <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #6c757d;">
            <h3 style="color: #6c757d; margin: 0 0 15px 0;">🏢 Back at Office</h3>
            ${backAtOffice
              .map(
                (item) => `
              <label style="display: block; margin-bottom: 5px; cursor: pointer;">
                <input type="checkbox" style="margin-right: 8px;"> ${item.trim()}
              </label>
            `,
              )
              .join("")}
            ${backAtOffice.length === 0 ? '<p style="color: #999; font-style: italic;">No items listed</p>' : ""}
          </div>
        </div>

        <div style="text-align: center; margin-top: 20px;">
          <button onclick="history.back()" style="background: #6c757d; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer;">
            ← Back to assignments
          </button>
        </div>
      </div>
    `;
  }

  renderRecoveryDetailedView(route) {
    const assignmentsContainer = document.getElementById(
      "assignmentsContainer",
    );

    const stops = [];
    for (let i = 1; i <= 10; i++) {
      const stop =
        route[`Stop ${i}`] || route[`stop${i}`] || route[`stop ${i}`];
      const contact =
        route[`Contact ${i}`] || route[`contact${i}`] || route[`contact ${i}`];
      if (stop && stop.trim()) {
        stops.push({ location: stop.trim(), contact: contact?.trim() });
      }
    }

    const googleMapsUrl = this.buildRecoveryGoogleMapsUrl(stops);

    assignmentsContainer.innerHTML = `
      <div style="background: #f8f9fa; margin: 10px; padding: 15px; border-radius: 8px; border: 2px solid #007bff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #007bff; margin: 0 0 10px 0;">🛒 ${route.dayName || route["recovery route"] || "Recovery"} Route</h2>
          <p style="margin: 0 0 15px 0; color: #666;">${route.displayDate} at ${route.Time || "TBD"}</p>

          <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
            <button onclick="assignmentsManager.printAssignment()" style="background: #6f42c1; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer;">
              🖨️ Print this assignment
            </button>
            <button onclick="window.open('${googleMapsUrl}', '_blank')" style="background: #28a745; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer;">
              🗺️ Full route on Google Maps
            </button>
          </div>
        </div>

        <div style="display: grid; gap: 15px;">
          ${stops
            .map(
              (stop, index) => `
            <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #007bff;">
              <h3 style="color: #007bff; margin: 0 0 15px 0;">📍 Stop ${index + 1}</h3>
              <div style="margin-bottom: 10px;">
                <button onclick="window.open('https://maps.google.com/maps?q=${encodeURIComponent(stop.location)}', '_blank')" style="background: #28a745; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                  📍 ${(() => {
                    const contact = sheetsAPI.getAddressFromContacts(
                      stop.location,
                    );
                    return contact && contact.address
                      ? contact.address
                      : stop.location;
                  })()}
                </button>
                ${
                  stop.contact
                    ? `
                  <button onclick="window.open('tel:${stop.contact}', '_blank')" style="background: #007bff; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">
                    📞 ${stop.contact}
                  </button>
                `
                    : ""
                }
              </div>
              ${route.Notes ? `<p style="margin: 10px 0 0 0; color: #666; font-style: italic;">${route.Notes}</p>` : ""}
            </div>
          `,
            )
            .join("")}

          ${stops.length === 0 ? '<div style="background: white; padding: 15px; border-radius: 8px; text-align: center; color: #999;">No stops found for this route</div>' : ""}
        </div>

        <div style="text-align: center; margin-top: 20px;">
          <button onclick="history.back()" style="background: #6c757d; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer;">
            ← Back to assignments
          </button>
        </div>
      </div>
    `;
  }

  buildSPFMGoogleMapsUrl(route) {
    const waypoints = [];
    if (route.market) waypoints.push(encodeURIComponent(route.market));
    if (route.dropOff) waypoints.push(encodeURIComponent(route.dropOff));

    if (waypoints.length === 0) return "#";
    if (waypoints.length === 1)
      return `https://maps.google.com/maps?q=${waypoints[0]}`;

    return `https://maps.google.com/maps/dir/${waypoints.join("/")}`;
  }

  buildRecoveryGoogleMapsUrl(stops) {
    if (stops.length === 0) return "#";
    if (stops.length === 1)
      return `https://maps.google.com/maps?q=${encodeURIComponent(stops[0].location)}`;

    const waypoints = stops.map((stop) => encodeURIComponent(stop.location));
    return `https://maps.google.com/maps/dir/${waypoints.join("/")}`;
  }

  printAssignment() {
    window.print();
  }
}

// Export instance
const assignmentsManager = new AssignmentsManager();

// Confirm this file loaded
console.log("✅ assignments.js loaded");
window.assignmentsManagerLoaded = true;
