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
    } else if (route.type === "spfm-delivery" || route.type === "spfm") {
      return this.renderSPFMDeliveryCard(route);
    } else {
      return this.renderSPFMCard(route);
    }
  }

  renderSPFMCard(route) {
    const workers = sheetsAPI.getAllWorkersFromRoute(route);
    const volunteers = sheetsAPI.getAllVolunteers(route);

    // Combine workers and volunteers into team members
    const allTeamMembers = [...workers, ...volunteers]
      .filter((person) => person && person.trim())
      .map((person) => `${this.getWorkerEmoji(person)} ${person}`);

    const vans = sheetsAPI
      .getAllVans(route)
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
            const teamSlots = [...allTeamMembers];
            // Fill remaining slots up to 3 with "Need worker"
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
          ${route.startTime || route.Time || "TBD"}
        </div>
        <div style="font-size: 0.85rem; color: #007bff; margin-bottom: 4px;">
          🛒 Recovery Route
        </div>
        <div style="font-size: 0.9rem; color: #666; margin-bottom: 4px;">
          ${(() => {
            const workers = sheetsAPI.getAllWorkersFromRoute(route);
            return workers.length > 0
              ? workers.map((w) => `${this.getWorkerEmoji(w)} ${w}`).join(", ")
              : '<span style="color: #800020; font-style: italic;">Need worker</span>';
          })()}
        </div>
        <div style="font-size: 0.9rem; color: #666;">
          ${(() => {
            const vans = sheetsAPI.getAllVans(route);
            return vans.length > 0
              ? vans.map((v) => `${this.getVanEmoji(v)} ${v}`).join(", ")
              : '<span style="color: #800020; font-style: italic;">No vans assigned</span>';
          })()}
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
      (assignments.spfm.length === 0 &&
        assignments.recovery.length === 0 &&
        (!assignments.delivery || assignments.delivery.length === 0))
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
      const status = route.status || route.Status || "";
      const routeDate = new Date(route.date);
      console.log(
        `🔍 Route ${route.routeId}: status="${status}", date=${route.date}, dateObj=${routeDate}, future=${routeDate >= today}`,
      );
      return !flexibleTextMatch(status, "completed") && routeDate >= today;
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

    // Add delivery assignments from sheets API
    if (assignments.delivery && assignments.delivery.length > 0) {
      assignments.delivery.forEach((deliveryRoute) => {
        // Generate next 12 occurrences for each delivery route
        const dayName = deliveryRoute.Weekday || deliveryRoute.weekday;
        if (dayName) {
          for (let occurrence = 0; occurrence < 12; occurrence++) {
            const nextDate = this.calculateNextOccurrence(dayName, occurrence);
            if (nextDate && nextDate >= today) {
              allRoutes.push({
                ...deliveryRoute,
                type: "spfm-delivery",
                sortDate: nextDate,
                displayDate: nextDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }),
                _routeId: `delivery-${normalizeText(dayName)}-${occurrence}`,
              });
            }
          }
        }
      });
    }

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
      "🔍 Original delivery assignments:",
      assignments.delivery ? assignments.delivery.length : 0,
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

    const targetDay = dayMap[normalizeText(dayName)];
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
      const routeWorkers = sheetsAPI.getAllWorkersFromRoute(route);
      const routeDay = (route["recovery route"] || route.Day || "").trim();
      return (
        routeWorkers.some((w) => flexibleTextMatch(w, worker)) &&
        flexibleTextMatch(routeDay, dayName)
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
          ${(() => {
            const routeContacts = sheetsAPI.getAllRouteContacts(route);
            const contactName =
              routeContacts.length > 0 ? routeContacts[0] : "";
            const notes = route.Notes || "";

            let notesContent = "";
            if (contactName && contactName.trim()) {
              notesContent += `• Contact person: ${contactName}`;
            }
            if (notes.trim()) {
              if (notesContent) notesContent += "<br>";
              notesContent += `• ${notes}`;
            }

            return notesContent
              ? `<p style="margin: 10px 0 0 0; color: #333; font-size: 0.9rem;"><strong>Notes:</strong><br>${notesContent}</p>`
              : "";
          })()}
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

    if (flexibleTextIncludes(workerName, "volunteer")) {
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

    const workerIcon = Object.keys(workerIcons).find((key) =>
      flexibleTextMatch(key, workerName),
    );

    return workerIcon ? workerIcons[workerIcon] : "👤";
  }

  getVanEmoji(vanName) {
    if (!vanName) return "🚐";

    const vanName_lower = vanName.toLowerCase();

    // Specific emoji mappings
    if (vanName_lower.includes("green bean")) return "🫛";
    if (vanName_lower.includes("tooth")) return "🦷";
    if (vanName_lower.includes("peapod")) return "🫛";
    if (vanName_lower.includes("marshmallow")) return "🍫";

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
      const status = route.status || route.Status || "";
      const routeDate = new Date(route.date);
      return !flexibleTextMatch(status, "completed") && routeDate >= today;
    });

    // Get recovery routes
    const recoveryDates = datesManager.generateWeeklyRecoveryDates();
    const upcomingRecoveryRoutes = recoveryDates.slice(0, 4);

    // Get Monday delivery routes
    const mondayDeliveryDates = datesManager.generateMondayDeliveryDates();

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
          month: "short",
          day: "numeric",
        }),
      });
    });

    // Add Monday delivery routes
    mondayDeliveryDates.forEach((route) => {
      allRoutes.push({
        ...route,
        type: "spfm-delivery",
        sortDate: route.sortDate,
        displayDate: route.displayDate,
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

    // Use unified renderer for all route types
    this.renderUnifiedDetailedView(route);
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

    const workers = sheetsAPI.getAllWorkersFromRoute(route);
    const googleMapsUrl = this.buildSPFMGoogleMapsUrl(route);

    assignmentsContainer.innerHTML = `
      <div style="background: #f8f9fa; margin: 10px; padding: 15px; border-radius: 8px; border: 2px solid #ff8c00;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #ff8c00; margin: 0 0 10px 0;">👨‍🌾 ${route.market || "Market"} - SPFM Route</h2>
          <p style="margin: 0 0 15px 0; color: #666;">${route.displayDate || route.date} at ${route.startTime || "TBD"}</p>
          <p style="margin: 0 0 15px 0;"><strong>Workers:</strong> ${workers.length > 0 ? workers.map((w) => `${this.getWorkerEmoji(w)} ${w}`).join(", ") : "No workers assigned"}</p>

          <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
            <button onclick="assignmentsManager.printAssignment()" style="background: #6f42c1; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer;">
              🖨️ Print this assignment
            </button>
            <button onclick="window.open('${googleMapsUrl.replace(/'/g, "\\'")}', '_blank')" style="background: #28a745; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer;">
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
                <h4 style="margin: 0 0 10px 0; color: #666;">📁</h4>
                ${materialsOffice
                  .map(
                    (item) => `
                  <label style="display: block; margin-bottom: 5px; cursor: pointer; font-size: 0.85rem;">
                    <input type="checkbox" style="margin-right: 8px;"> ${item.trim()}
                  </label>
                `,
                  )
                  .join("")}
                ${materialsOffice.length === 0 ? '<p style="color: #999; font-style: italic;">No items listed</p>' : ""}
              </div>
              <div>
                <h4 style="margin: 0 0 10px 0; color: #666;">📦</h4>
                ${materialsStorage
                  .map(
                    (item) => `
                  <label style="display: block; margin-bottom: 5px; cursor: pointer; font-size: 0.85rem;">
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
                ${(() => {
                  const contact = sheetsAPI.getAddressFromContacts(
                    route.market,
                  );
                  const addressToUse =
                    contact && contact.address ? contact.address : route.market;
                  return `<button onclick="window.open('https://maps.google.com/maps?q=${encodeURIComponent(addressToUse)}', '_blank')" style="background: #28a745; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">📍 ${addressToUse}</button>`;
                })()}
              </div>
              `
                : ""
            }
            ${atMarket
              .map(
                (item) => `
              <label style="display: block; margin-bottom: 5px; cursor: pointer; font-size: 0.85rem;">
                <input type="checkbox" style="margin-right: 8px;"> ${item.trim()}
              </label>
            `,
              )
              .join("")}
            ${atMarket.length === 0 ? '<p style="color: #999; font-style: italic;">No items listed</p>' : ""}
          </div>



          <!-- Dropoff Section -->
          <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745;">
            <h3 style="color: #333; margin: 0 0 15px 0;">🚚 Dropoff - ${(() => {
              const locationName = route.dropOff || "Location TBD";
              if (locationName === "Location TBD") return locationName;
              const contact = sheetsAPI.getAddressFromContacts(locationName);
              console.log(
                `🔍 DEBUG Dropoff contact data for "${locationName}":`,
                contact,
              );
              console.log(
                `🔍 DEBUG Dropoff keys:`,
                contact ? Object.keys(contact) : "null",
              );
              console.log(
                `🔍 DEBUG Dropoff Type:`,
                contact ? contact.Type : "no contact",
              );
              const type =
                contact && (contact.Type || contact.type || contact.TYPE)
                  ? (contact.Type || contact.type || contact.TYPE).trim()
                  : "";
              console.log(`🔍 DEBUG Dropoff final type: "${type}"`);
              return type ? `${locationName} - ${type}` : locationName;
            })()}</h3>
            <div style="margin-bottom: 10px;">
              ${
                route.dropOff
                  ? `
                ${(() => {
                  const contact = sheetsAPI.getAddressFromContacts(
                    route.dropOff,
                  );
                  const addressToUse =
                    contact && contact.address
                      ? contact.address
                      : route.dropOff;
                  return `<button onclick="window.open('https://maps.google.com/maps?q=${encodeURIComponent(addressToUse)}', '_blank')" style="background: #28a745; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-right: 10px;">📍 ${addressToUse}</button>`;
                })()}
              `
                  : '<p style="color: #999; font-style: italic;">No dropoff location specified</p>'
              }
              ${(() => {
                const contacts = sheetsAPI.getAllRouteContacts(route);
                return contacts.length > 0
                  ? `<button onclick="window.open('tel:${contacts[0]}', '_blank')" style="background: #007bff; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">📞 ${contacts[0]}</button>`
                  : "";
              })()}
            </div>
          </div>

          <!-- Back at Office Section -->
          <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #6c757d;">
            <h3 style="color: #6c757d; margin: 0 0 15px 0;">🏢 Back at Office</h3>
            ${backAtOffice
              .map(
                (item) => `
              <label style="display: block; margin-bottom: 5px; cursor: pointer; font-size: 0.85rem;">
                <input type="checkbox" style="margin-right: 8px;"> ${item.trim()}
              </label>
            `,
              )
              .join("")}
            ${backAtOffice.length === 0 ? '<p style="color: #999; font-style: italic;">No items listed</p>' : ""}
          </div>
        </div>

        </div>

        <div style="text-align: center; margin-top: 20px;">
          <button onclick="history.back()" style="background: #6c757d; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer;">
            ← Back to assignments
          </button>
        </div>
      </div>
    `;

    // Remove any total weight sections that might be added dynamically
    setTimeout(() => {
      this.removeWeightSections();
    }, 100);
  }

  renderUnifiedDetailedView(route) {
    const assignmentsContainer = document.getElementById(
      "assignmentsContainer",
    );

    // Extract stops based on route type
    const stops = this.extractStopsFromRoute(route);
    const workers = sheetsAPI.getAllWorkersFromRoute(route);
    const googleMapsUrl = this.buildGoogleMapsUrl(route, stops);

    // Route type-specific display info
    const routeInfo = this.getRouteDisplayInfo(route);

    assignmentsContainer.innerHTML = `
      <div style="background: #f8f9fa; margin: 10px; padding: 15px; border-radius: 8px; border: 2px solid #333;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #333; margin: 0 0 10px 0;">${routeInfo.emoji} ${routeInfo.title}</h2>
          <p style="margin: 0 0 15px 0; color: #666;">${route.displayDate || route.date} at ${route.startTime || route.Time || "TBD"}</p>
          <p style="margin: 0 0 15px 0;"><strong>Workers:</strong> ${workers.length > 0 ? workers.map((w) => `${this.getWorkerEmoji(w)} ${w}`).join(", ") : "No workers assigned"}</p>

          <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
            <button onclick="assignmentsManager.printAssignment()" style="background: #6f42c1; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer;">
              🖨️ Print this assignment
            </button>
            <button onclick="window.open('${googleMapsUrl.replace(/'/g, "\\'")}', '_blank')" style="background: #28a745; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer;">
              🗺️ Full route on Google Maps
            </button>
          </div>
        </div>

        ${this.renderRouteSpecificContent(route)}

        <div style="display: grid; gap: 15px;">
          ${stops
            .map(
              (stop, index) => `
            <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #333;">
              <h3 style="color: #333; margin: 0 0 15px 0;">${index + 1} - ${this.getStopDisplayName(stop.location)}</h3>
              <div style="margin-bottom: 10px;">
                ${this.renderAddressButton(stop.location)}
                ${this.renderPhoneButtons(stop.location)}
              </div>
              ${this.renderPickupForm(route, stop.location)}
              ${this.renderStopNotes(route, stop.location)}
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

  extractStopsFromRoute(route) {
    const stops = [];

    if (route.type === "recovery") {
      // Recovery routes use Stop 1, Stop 2, etc.
      for (let i = 1; i <= 7; i++) {
        const stop = route[`Stop ${i}`];
        if (stop && stop.trim()) {
          stops.push({ location: stop.trim(), contact: null });
        }
      }
    } else if (route.type === "spfm-delivery" || route.type === "spfm") {
      // First try delivery format (Stop 1, Stop 2, etc.)
      for (let i = 1; i <= 10; i++) {
        const stop =
          route[`Stop ${i}`] || route[`stop${i}`] || route[`stop ${i}`];
        const contact =
          route[`Contact ${i}`] ||
          route[`contact${i}`] ||
          route[`contact ${i}`];
        if (stop && stop.trim()) {
          stops.push({ location: stop.trim(), contact: contact?.trim() });
        }
      }

      // If no delivery stops, use traditional SPFM structure
      if (stops.length === 0) {
        if (route.market && route.market.trim()) {
          stops.push({ location: route.market.trim(), contact: null });
        }
        if (route.dropOff && route.dropOff.trim()) {
          stops.push({ location: route.dropOff.trim(), contact: null });
        }
      }
    } else {
      // Traditional SPFM routes
      if (route.market && route.market.trim()) {
        stops.push({ location: route.market.trim(), contact: null });
      }
      if (route.dropOff && route.dropOff.trim()) {
        stops.push({ location: route.dropOff.trim(), contact: null });
      }
    }

    return stops;
  }

  getRouteDisplayInfo(route) {
    if (route.type === "recovery") {
      return {
        emoji: "🛒",
        title: `${route.dayName || route["recovery route"] || "Recovery"} Route`,
      };
    } else if (route.type === "spfm-delivery" || route.type === "spfm") {
      return {
        emoji: "👨‍🌾",
        title: `${route.market || "SPFM"} Route`,
      };
    } else {
      return {
        emoji: "👨‍🌾",
        title: `${route.market || "Market"} - SPFM Route`,
      };
    }
  }

  buildGoogleMapsUrl(route, stops) {
    if (route.type === "recovery") {
      return this.buildRecoveryGoogleMapsUrl(stops);
    } else {
      return this.buildSPFMGoogleMapsUrl(route);
    }
  }

  renderRouteSpecificContent(route) {
    if (route.type === "recovery") {
      return ""; // Recovery routes don't have material sections
    }

    // SPFM routes have material sections
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

    return `
      <div style="display: grid; gap: 20px; margin-bottom: 20px;">
        <!-- At the Office Section -->
        <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #17a2b8;">
          <h3 style="color: #17a2b8; margin: 0 0 15px 0;">🏢 At the Office</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div>
              <h4 style="margin: 0 0 10px 0; color: #666;">📁 Materials</h4>
              ${materialsOffice
                .map(
                  (item) => `
                <label style="display: block; margin-bottom: 5px; cursor: pointer; font-size: 0.85rem;">
                  <input type="checkbox" style="margin-right: 8px;"> ${item.trim()}
                </label>
              `,
                )
                .join("")}
              ${materialsOffice.length === 0 ? '<p style="color: #999; font-style: italic;">No items listed</p>' : ""}
            </div>
            <div>
              <h4 style="margin: 0 0 10px 0; color: #666;">🏪 Storage</h4>
              ${materialsStorage
                .map(
                  (item) => `
                <label style="display: block; margin-bottom: 5px; cursor: pointer; font-size: 0.85rem;">
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
        <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745;">
          <h3 style="color: #28a745; margin: 0 0 15px 0;">🛒 At Market</h3>
          ${atMarket
            .map(
              (item) => `
            <label style="display: block; margin-bottom: 5px; cursor: pointer; font-size: 0.85rem;">
              <input type="checkbox" style="margin-right: 8px;"> ${item.trim()}
            </label>
          `,
            )
            .join("")}
          ${atMarket.length === 0 ? '<p style="color: #999; font-style: italic;">No items listed</p>' : ""}
        </div>

        <!-- Back at Office Section -->
        <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #dc3545;">
          <h3 style="color: #dc3545; margin: 0 0 15px 0;">🏢 Back at Office</h3>
          ${backAtOffice
            .map(
              (item) => `
            <label style="display: block; margin-bottom: 5px; cursor: pointer; font-size: 0.85rem;">
              <input type="checkbox" style="margin-right: 8px;"> ${item.trim()}
            </label>
          `,
            )
            .join("")}
          ${backAtOffice.length === 0 ? '<p style="color: #999; font-style: italic;">No items listed</p>' : ""}
        </div>
      </div>
    `;
  }

  getStopDisplayName(location) {
    const contact = sheetsAPI.getAddressFromContacts(location);
    const type =
      contact && (contact.Type || contact.type || contact.TYPE)
        ? (contact.Type || contact.type || contact.TYPE).trim()
        : "";
    return type ? `${location} - ${type}` : location;
  }

  renderAddressButton(location) {
    const contact = sheetsAPI.getAddressFromContacts(location);
    return contact && contact.address
      ? `<button onclick="window.open('https://maps.google.com/maps?q=${encodeURIComponent(contact.address)}', '_blank')" style="background: #28a745; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-right: 10px;">📍 ${contact.address}</button>`
      : `<button onclick="window.open('https://maps.google.com/maps?q=${encodeURIComponent(location)}', '_blank')" style="background: #28a745; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-right: 10px;">📍 ${location}</button>`;
  }

  renderPhoneButtons(location) {
    const contact = sheetsAPI.getAddressFromContacts(location);
    if (!contact) return "";

    if (contact.phones && contact.phones.length > 0) {
      return contact.phones
        .map((phone, index) => {
          const contactName =
            contact.contacts && contact.contacts[index]
              ? contact.contacts[index]
              : contact.contactName || `Contact ${index + 1}`;
          return `<button onclick="window.open('tel:${phone}', '_blank')" style="background: #007bff; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-right: 5px;">📞 ${contactName} - ${phone}</button>`;
        })
        .join("");
    } else if (contact.phone) {
      const contactName = contact.contactName || "Contact";
      return `<button onclick="window.open('tel:${contact.phone}', '_blank')" style="background: #007bff; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">📞 ${contactName} - ${contact.phone}</button>`;
    }
    return "";
  }

  renderPickupForm(route, location) {
    const contact = sheetsAPI.getAddressFromContacts(location);
    const type =
      contact && (contact.Type || contact.type || contact.TYPE)
        ? (contact.Type || contact.type || contact.TYPE).trim().toLowerCase()
        : "";

    // Show pickup form for both "market" and "pick up" types
    if (type === "market" || type === "pick up") {
      const routeId = route._routeId || route.routeId || "unknown";
      return `
        <div style="margin: 8px 0; padding: 8px; background: #f8f9fa; border-radius: 4px; border-left: 3px solid #28a745;">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="font-size: 0.9em; color: #495057; font-weight: 500;">📦 Pickup:</span>
            <input type="number" id="boxes_${routeId}_${location.replace(/[^a-zA-Z0-9]/g, "_")}"
                   placeholder="Boxes" min="0" step="1"
                   onchange="assignmentsManager.handlePickupInputChange('boxes', '${routeId}', '${location}')"
                   style="width: 65px; height: 32px; padding: 4px 8px; border: 1px solid #ced4da; border-radius: 3px; font-size: 0.85em;">
            <span style="color: #6c757d; font-size: 0.85em;">or</span>
            <input type="number" id="lbs_${routeId}_${location.replace(/[^a-zA-Z0-9]/g, "_")}"
                   placeholder="Lbs" min="0" step="0.1"
                   onchange="assignmentsManager.handlePickupInputChange('lbs', '${routeId}', '${location}')"
                   style="width: 65px; height: 32px; padding: 4px 8px; border: 1px solid #ced4da; border-radius: 3px; font-size: 0.85em;">
            <button onclick="assignmentsManager.submitPickupData('${routeId}', '${location}', '${route.date || ""}')"
                    style="background: #28a745; color: white; border: none; padding: 6px 10px; border-radius: 3px; cursor: pointer; font-size: 0.8em; height: 32px;">
              💾 Log
            </button>
          </div>
        </div>
      `;
    }
    return "";
  }

  renderStopNotes(route, location) {
    const contact = sheetsAPI.getAddressFromContacts(location);
    const routeContacts = sheetsAPI.getAllRouteContacts(route);
    const routePhones = sheetsAPI.getAllRoutePhones(route);
    const notes = contact && contact.notes ? contact.notes : "";

    let notesContent = "";

    // Add contact persons from route data only if corresponding phone is available
    if (routeContacts.length > 0) {
      routeContacts.forEach((contactPerson, index) => {
        if (
          contactPerson &&
          contactPerson.trim() &&
          routePhones[index] &&
          routePhones[index].trim()
        ) {
          if (notesContent) notesContent += "<br>";
          notesContent += `• Contact person: ${contactPerson.trim()}`;
        }
      });
    }

    // Add notes from contacts sheet
    if (notes.trim()) {
      if (notesContent) notesContent += "<br>";
      notesContent += `• ${notes}`;
    }

    return notesContent
      ? `<p style="margin: 10px 0 0 0; color: #333; font-size: 0.9rem;"><strong>Notes:</strong><br>${notesContent}</p>`
      : "";
  }

  // Legacy method - now uses unified renderer
  renderRecoveryDetailedView(route) {
    this.renderUnifiedDetailedView(route);
  }

  buildSPFMGoogleMapsUrl(route) {
    const waypoints = [];

    // Check for different field name variations used in SPFM routes
    const market =
      route.market || route.Market || route.Location || route.location;
    const dropOff =
      route.dropOff ||
      route.DropOff ||
      route["Drop Off"] ||
      route.Destination ||
      route.destination;

    if (market) waypoints.push(encodeURIComponent(market));
    if (dropOff) waypoints.push(encodeURIComponent(dropOff));

    if (waypoints.length === 0) return "#";
    if (waypoints.length === 1)
      return `https://maps.google.com/maps?q=${waypoints[0]}`;

    return `https://maps.google.com/maps/dir/${waypoints.join("/")}`;
  }

  renderSPFMDeliveryCard(route) {
    return `
      <div onclick="assignmentsManager.openDetailedView('${route._routeId}')" style="background: white; padding: 12px; margin: 0 0 8px 0; border-radius: 6px; border-left: 4px solid #ff8c00; cursor: pointer; transition: transform 0.1s;" onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
        <div style="font-weight: bold; color: #333; margin-bottom: 4px;">
          ${route.displayDate} - ${route.market || "SPFM Delivery"}
        </div>
        <div style="font-size: 0.9rem; color: #666; margin-bottom: 4px;">
          ${route.startTime || route.Time || "TBD"}
        </div>
        <div style="font-size: 0.85rem; color: #ff8c00; margin-bottom: 4px;">
          👨‍🌾 SPFM Route
        </div>
        <div style="font-size: 0.9rem; color: #666; margin-bottom: 4px;">
          ${(() => {
            const workers = sheetsAPI
              .getAllWorkersFromRoute(route)
              .map((w) => `${this.getWorkerEmoji(w)} ${w}`);
            return workers.length > 0
              ? workers.join(", ")
              : '<span style="color: #800020; font-style: italic;">Need worker</span>';
          })()}
        </div>
        <div style="font-size: 0.9rem; color: #666;">
          ${(() => {
            const vans = sheetsAPI.getAllVans(route);
            return vans.length > 0
              ? vans.map((v) => `${this.getVanEmoji(v)} ${v}`).join(", ")
              : '<span style="color: #800020; font-style: italic;">No vans assigned</span>';
          })()}
        </div>
      </div>
    `;
  }

  buildRecoveryGoogleMapsUrl(stops) {
    if (stops.length === 0) return "#";

    // Use addresses from contacts when available, fallback to location names
    const waypoints = stops.map((stop) => {
      const contact = sheetsAPI.getAddressFromContacts(stop.location);
      const addressToUse =
        contact && contact.address ? contact.address : stop.location;
      return encodeURIComponent(addressToUse);
    });

    if (waypoints.length === 1)
      return `https://maps.google.com/maps?q=${waypoints[0]}`;

    return `https://maps.google.com/maps/dir/${waypoints.join("/")}`;
  }

  renderSPFMDeliveryDetailedView(route) {
    const assignmentsContainer = document.getElementById(
      "assignmentsContainer",
    );

    const stops = [];

    // First try to get stops from delivery format (Stop 1, Stop 2, etc.)
    for (let i = 1; i <= 10; i++) {
      const stop =
        route[`Stop ${i}`] || route[`stop${i}`] || route[`stop ${i}`];
      const contact =
        route[`Contact ${i}`] || route[`contact${i}`] || route[`contact ${i}`];
      if (stop && stop.trim()) {
        stops.push({ location: stop.trim(), contact: contact?.trim() });
      }
    }

    // If no delivery stops found, use traditional SPFM structure
    if (stops.length === 0) {
      // Add market as first stop
      if (route.market && route.market.trim()) {
        stops.push({
          location: route.market.trim(),
          contact: sheetsAPI.getAllRouteContacts(route)[0]?.trim(),
        });
      }

      // Add dropoff as second stop
      if (route.dropOff && route.dropOff.trim()) {
        stops.push({
          location: route.dropOff.trim(),
          contact: sheetsAPI.getAllRouteContacts(route)[0]?.trim(),
        });
      }
    }

    const workers = sheetsAPI.getAllWorkersFromRoute(route);
    const googleMapsUrl = this.buildRecoveryGoogleMapsUrl(stops);

    assignmentsContainer.innerHTML = `
      <div style="background: #f8f9fa; margin: 10px; padding: 15px; border-radius: 8px; border: 2px solid #ff8c00;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #ff8c00; margin: 0 0 10px 0;">👨‍🌾 ${route.market || "SPFM"} Route</h2>
          <p style="margin: 0 0 15px 0; color: #666;">${route.displayDate || route.date} at ${route.startTime || route.Time || "TBD"}</p>
          <p style="margin: 0 0 15px 0;"><strong>Workers:</strong> ${workers.length > 0 ? workers.map((w) => `${this.getWorkerEmoji(w)} ${w}`).join(", ") : "No workers assigned"}</p>

          <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
            <button onclick="assignmentsManager.printAssignment()" style="background: #6f42c1; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer;">
              🖨️ Print this assignment
            </button>
            ${stops.length > 0 ? `<button onclick="window.open('${googleMapsUrl.replace(/'/g, "\\'")}', '_blank')" style="background: #28a745; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer;">🗺️ Full route on Google Maps</button>` : ""}
          </div>
        </div>

        ${
          stops.length > 0
            ? `
        <div style="display: grid; gap: 15px;">
          ${stops
            .map(
              (stop, index) => `
            <div style="background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #ff8c00;">
              <h3 style="color: #333; margin: 0 0 15px 0;">${stops.length > 1 ? `${index + 1} - ` : ""}${(() => {
                const contact = sheetsAPI.getAddressFromContacts(stop.location);
                console.log(
                  `🔍 DEBUG Delivery contact data for "${stop.location}":`,
                  contact,
                );
                console.log(
                  `🔍 DEBUG Delivery object keys:`,
                  contact ? Object.keys(contact) : "null",
                );
                console.log(
                  `🔍 DEBUG Delivery Type value:`,
                  contact ? contact.Type : "no contact",
                );
                const type =
                  contact && (contact.Type || contact.type || contact.TYPE)
                    ? (contact.Type || contact.type || contact.TYPE).trim()
                    : "";
                console.log(`🔍 DEBUG Delivery final type: "${type}"`);
                return type ? `${stop.location} - ${type}` : stop.location;
              })()}</h3>
              <div style="margin-bottom: 10px;">
                ${(() => {
                  const contact = sheetsAPI.getAddressFromContacts(
                    stop.location,
                  );
                  return contact && contact.address
                    ? `<button onclick="window.open('https://maps.google.com/maps?q=${encodeURIComponent(contact.address)}', '_blank')" style="background: #28a745; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-right: 10px;">📍 ${contact.address}</button>`
                    : `<button onclick="window.open('https://maps.google.com/maps?q=${encodeURIComponent(stop.location)}', '_blank')" style="background: #28a745; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-right: 10px;">📍 ${stop.location}</button>`;
                })()}
                ${(() => {
                  const contact = sheetsAPI.getAddressFromContacts(
                    stop.location,
                  );
                  if (!contact) return "";

                  // Show all phone numbers with contact names
                  if (contact.phones && contact.phones.length > 0) {
                    return contact.phones
                      .map((phone, index) => {
                        const contactName =
                          contact.contacts && contact.contacts[index]
                            ? contact.contacts[index]
                            : contact.contactName || `Contact ${index + 1}`;
                        return `<button onclick="window.open('tel:${phone}', '_blank')" style="background: #007bff; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; margin-right: 5px;">📞 ${contactName} - ${phone}</button>`;
                      })
                      .join("");
                  } else if (contact.phone) {
                    const contactName = contact.contactName || "Contact";
                    return `<button onclick="window.open('tel:${contact.phone}', '_blank')" style="background: #007bff; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer;">📞 ${contactName} - ${contact.phone}</button>`;
                  }
                  return "";
                })()}
              </div>
              ${(() => {
                // Add pickup tracking form for Market locations
                const contact = sheetsAPI.getAddressFromContacts(stop.location);
                const type =
                  contact && (contact.Type || contact.type || contact.TYPE)
                    ? (contact.Type || contact.type || contact.TYPE).trim()
                    : "";

                if (type.toLowerCase() === "market") {
                  const routeId = route._routeId || route.routeId || "unknown";
                  return `
                    <div style="margin: 8px 0; padding: 8px; background: #f8f9fa; border-radius: 4px; border-left: 3px solid #28a745;">
                      <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span style="font-size: 0.9em; color: #495057; font-weight: 500;">📦 Pickup:</span>
                        <input type="number" id="boxes_${routeId}_${stop.location.replace(/[^a-zA-Z0-9]/g, "_")}"
                               placeholder="Boxes" min="0" step="1"
                               onchange="assignmentsManager.handlePickupInputChange('boxes', '${routeId}', '${stop.location}')"
                               style="width: 65px; height: 32px; padding: 4px 8px; border: 1px solid #ced4da; border-radius: 3px; font-size: 0.85em;">
                        <span style="color: #6c757d; font-size: 0.85em;">or</span>
                        <input type="number" id="lbs_${routeId}_${stop.location.replace(/[^a-zA-Z0-9]/g, "_")}"
                               placeholder="Lbs" min="0" step="0.1"
                               onchange="assignmentsManager.handlePickupInputChange('lbs', '${routeId}', '${stop.location}')"
                               style="width: 65px; height: 32px; padding: 4px 8px; border: 1px solid #ced4da; border-radius: 3px; font-size: 0.85em;">
                        <button onclick="assignmentsManager.submitPickupData('${routeId}', '${stop.location}', '${route.date || ""}')"
                                style="background: #28a745; color: white; border: none; padding: 6px 10px; border-radius: 3px; cursor: pointer; font-size: 0.8em; height: 32px;">
                          💾 Log
                        </button>
                      </div>
                    </div>
                  `;
                }
                return "";
              })()}
              ${(() => {
                const contact = sheetsAPI.getAddressFromContacts(stop.location);
                const notes = contact && contact.notes ? contact.notes : "";

                let notesContent = "";
                // Add contact person from stop-specific contact only if there's a corresponding phone
                if (stop.contact && stop.contact.trim()) {
                  // For delivery routes, we need to check stop-specific phones, but they're not implemented yet
                  // For now, just show the contact person if it exists
                  notesContent += `• Contact person: ${stop.contact.trim()}`;
                }
                // Add notes from contacts sheet
                if (notes.trim()) {
                  if (notesContent) notesContent += "<br>";
                  notesContent += `• ${notes}`;
                }

                return notesContent
                  ? `<p style="margin: 10px 0 0 0; color: #333; font-size: 0.9rem;"><strong>Notes:</strong><br>${notesContent}</p>`
                  : "";
              })()}
            </div>
          `,
            )
            .join("")}
        </div>
        `
            : `
        <div style="background: white; padding: 20px; border-radius: 8px; text-align: center; color: #666;">
          <div style="font-size: 2rem; margin-bottom: 15px;">📍</div>
          <h3 style="color: #ff8c00; margin-bottom: 15px;">Route Information</h3>
          <p style="margin-bottom: 10px;"><strong>Market:</strong> ${route.market || "Not specified"}</p>
          <p style="margin-bottom: 10px;"><strong>Start Time:</strong> ${route.startTime || route.Time || "TBD"}</p>
          ${route.dropOff ? `<p style="margin-bottom: 10px;"><strong>Drop Off:</strong> ${route.dropOff}</p>` : ""}
          ${(() => {
            const contacts = sheetsAPI.getAllRouteContacts(route);
            return contacts.length > 0
              ? `<p style="margin-bottom: 10px;"><strong>Contact:</strong> ${contacts[0]}</p>`
              : "";
          })()}
          <p style="margin-top: 15px; font-style: italic; color: #999;">No detailed stops available for this route</p>
        </div>
        `
        }

        <div style="text-align: center; margin-top: 20px;">
          <button onclick="history.back()" style="background: #6c757d; color: white; border: none; padding: 10px 15px; border-radius: 5px; cursor: pointer;">
            ← Back to assignments
          </button>
        </div>
      </div>
    `;
  }

  printAssignment() {
    window.print();
  }
  // Remove total weight sections from the DOM
  removeWeightSections() {
    const assignmentsContainer = document.getElementById(
      "assignmentsContainer",
    );
    if (!assignmentsContainer) return;

    // Remove any elements containing "total weight", "Total Weight", or weight-related content
    const weightElements = assignmentsContainer.querySelectorAll("*");
    weightElements.forEach((element) => {
      const text = element.textContent || element.innerText || "";
      if (
        text.toLowerCase().includes("total weight") ||
        text.toLowerCase().includes("save functionality") ||
        (text.toLowerCase().includes("under construction") &&
          text.toLowerCase().includes("save")) ||
        (text.toLowerCase().includes("lbs") &&
          text.toLowerCase().includes("save"))
      ) {
        element.remove();
        console.log("🗑️ Removed weight section:", text.substring(0, 50));
      }
    });
  }

  // ========================================
  // CONTACT DISPLAY HELPERS
  // ========================================

  renderAllContacts(route) {
    const contacts = sheetsAPI.getAllRouteContacts(route);
    const phones = sheetsAPI.getAllRoutePhones(route);

    let html = "";

    // Show all contacts
    if (contacts.length > 0) {
      html += contacts
        .map(
          (contact, index) =>
            `<p style="margin-bottom: 5px;"><strong>Contact ${index + 1}:</strong> ${contact}</p>`,
        )
        .join("");
    }

    // Show all phone numbers with contact names
    if (phones.length > 0) {
      html += phones
        .map((phone, index) => {
          const contactName =
            contacts && contacts[index]
              ? contacts[index]
              : `Contact ${index + 1}`;
          return `<button onclick="window.open('tel:${phone}', '_blank')" style="background: #007bff; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; margin: 2px;">📞 ${contactName} - ${phone}</button>`;
        })
        .join("");
    }

    return html;
  }

  renderAllContactsForLocation(locationName) {
    const contactData = sheetsAPI.getAddressFromContacts(locationName);
    if (!contactData) return "";

    let html = "";

    // Show all contacts from contacts sheet
    if (contactData.contacts && contactData.contacts.length > 0) {
      html += contactData.contacts
        .map(
          (contact, index) =>
            `<p style="margin-bottom: 5px;"><strong>Contact ${index + 1}:</strong> ${contact}</p>`,
        )
        .join("");
    } else if (contactData.contactName) {
      html += `<p style="margin-bottom: 5px;"><strong>Contact:</strong> ${contactData.contactName}</p>`;
    }

    // Show all phone numbers from contacts sheet with contact names
    if (contactData.phones && contactData.phones.length > 0) {
      html += contactData.phones
        .map((phone, index) => {
          const contactName =
            contactData.contacts && contactData.contacts[index]
              ? contactData.contacts[index]
              : contactData.contactName || `Contact ${index + 1}`;
          return `<button onclick="window.open('tel:${phone}', '_blank')" style="background: #007bff; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; margin: 2px;">📞 ${contactName} - ${phone}</button>`;
        })
        .join("");
    } else if (contactData.phone) {
      const contactName = contactData.contactName || "Contact";
      html += `<button onclick="window.open('tel:${contactData.phone}', '_blank')" style="background: #007bff; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; margin: 2px;">📞 ${contactName} - ${contactData.phone}</button>`;
    }

    return html;
  }

  // ========================================
  // PICKUP TRACKING
  // ========================================

  async submitPickupData(routeId, location, date) {
    try {
      const safeLocation = location.replace(/[^a-zA-Z0-9]/g, "_");
      const boxesInput = document.getElementById(
        `boxes_${routeId}_${safeLocation}`,
      );
      const lbsInput = document.getElementById(
        `lbs_${routeId}_${safeLocation}`,
      );

      const boxes = boxesInput ? parseFloat(boxesInput.value) || 0 : 0;
      const lbs = lbsInput ? parseFloat(lbsInput.value) || 0 : 0;

      if (boxes === 0 && lbs === 0) {
        alert("Please enter either boxes or lbs amount");
        return;
      }

      // Prepare data for Charts sheet
      const pickupData = {
        date: date,
        routeId: routeId,
        location: location,
        boxes: boxes || "",
        lbs: lbs || "",
        timestamp: new Date().toLocaleString(),
        submittedBy: "User", // Could be enhanced to get actual user name
      };

      console.log("📊 Submitting pickup data:", pickupData);

      // Submit to Charts sheet
      const success = await this.submitToChartsSheet(pickupData);

      if (success) {
        // Clear the inputs
        if (boxesInput) boxesInput.value = "";
        if (lbsInput) lbsInput.value = "";

        // Show success feedback
        const button = event.target;
        const originalText = button.innerHTML;
        button.innerHTML = "✅ Logged!";
        button.style.background = "#218838";

        setTimeout(() => {
          button.innerHTML = originalText;
          button.style.background = "#28a745";
        }, 2000);
      }
    } catch (error) {
      console.error("❌ Error submitting pickup data:", error);
      alert("Error logging pickup data. Please try again.");
    }
  }

  async submitToChartsSheet(data) {
    try {
      // First, ensure Charts sheet exists
      await this.ensureChartsSheet();

      // Prepare row data
      const rowData = [
        data.date,
        data.routeId,
        data.location,
        data.boxes,
        data.lbs,
        data.timestamp,
        data.submittedBy,
      ];

      // Append to Charts sheet
      const success = await sheetsAPI.appendToChartsSheet(rowData);
      return success;
    } catch (error) {
      console.error("❌ Error in submitToChartsSheet:", error);
      return false;
    }
  }

  async ensureChartsSheet() {
    try {
      // Check if Charts sheet exists, if not create it with headers
      const sheets = await sheetsAPI.listSheetsInSpreadsheet();
      const chartsExists = sheets.some((sheet) => sheet.title === "Charts");

      if (!chartsExists) {
        console.log("📊 Creating Charts sheet...");
        await sheetsAPI.createChartsSheet();

        // Add headers
        const headers = [
          "Date",
          "Route ID",
          "Location",
          "Boxes",
          "Lbs",
          "Timestamp",
          "Submitted By",
        ];
        await sheetsAPI.appendToChartsSheet(headers);
      }
    } catch (error) {
      console.error("❌ Error ensuring Charts sheet exists:", error);
      throw error;
    }
  }

  // Handle mutual exclusivity between boxes and lbs inputs
  handlePickupInputChange(inputType, routeId, location) {
    const safeLocation = location.replace(/[^a-zA-Z0-9]/g, "_");
    const boxesInput = document.getElementById(
      `boxes_${routeId}_${safeLocation}`,
    );
    const lbsInput = document.getElementById(`lbs_${routeId}_${safeLocation}`);

    if (inputType === "boxes" && boxesInput && boxesInput.value) {
      if (lbsInput) lbsInput.value = "";
    } else if (inputType === "lbs" && lbsInput && lbsInput.value) {
      if (boxesInput) boxesInput.value = "";
    }
  }
}

// Export instance
const assignmentsManager = new AssignmentsManager();

// Confirm this file loaded
console.log("✅ assignments.js loaded");
window.assignmentsManagerLoaded = true;
