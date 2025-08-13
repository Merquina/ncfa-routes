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
    const assignmentsContainer = document.getElementById(
      "assignmentsContainer"
    );
    const chronologicalContainer =
      document.getElementById("chronologicalDates");

    if (!assignmentsContainer) return;

    // Hide the chronological dates container since we're using assignmentsContainer
    if (chronologicalContainer) {
      chronologicalContainer.innerHTML = "";
      chronologicalContainer.style.display = "none";
    }

    // Skip loading state - show cards directly
    if (sheetsAPI.data.length === 0) {
      assignmentsContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666;">
          <p>No route data available. Click a tab to load data.</p>
        </div>
      `;
      return;
    }

    // Get next 7 upcoming routes in chronological order
    const upcomingRoutes = assignmentsManager.getUpcomingRoutes(7);

    // Render using unified renderer without market grouping
    assignmentsManager.renderUnifiedAssignments({
      routes: upcomingRoutes,
      title: "Next Upcoming Routes",
      emoji: "📅",
      color: "#007bff",
      groupByMarket: false,
      showPrintButton: false,
    });

    // Scroll to the top of assignments container
    setTimeout(() => {
      if (assignmentsContainer) {
        assignmentsContainer.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 100);
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
          .flatMap((r) => sheetsAPI.getAllWorkersFromRoute(r))
          .map((w) => `${workersManager.getWorkerEmoji(w)} ${w}`)
          .join(", ");

        const markets = [...new Set(routes.map((r) => r.market))].join(", ");

        return `
                    <div class="date-card" onclick="selectDate('${
                      dateObj.original
                    }')">
                        <h3>${this.formatDate(dateObj.parsed)}</h3>
                        <p><strong>Markets:</strong> ${markets || "TBD"}</p>
                        <p><strong>Workers:</strong> ${
                          workers || "None assigned"
                        }</p>
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
          route["recovery route"] &&
          sheetsAPI.getAllWorkersFromRoute(route).length > 0
      )
      .map((route) => {
        const calculatedDate = this.getNextDateForDay(route["recovery route"]);
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
      .map((route) => {
        console.log("🔍 DEBUG Recovery Route Card:", route);
        console.log("🔍 DEBUG Route keys:", Object.keys(route));
        console.log(
          "🔍 DEBUG getAllWorkers result:",
          sheetsAPI.getAllWorkersFromRoute(route)
        );
        console.log(
          "🔍 DEBUG getAllRouteContacts result:",
          sheetsAPI.getAllRouteContacts(route)
        );
        console.log(
          "🔍 DEBUG getAllRoutePhones result:",
          sheetsAPI.getAllRoutePhones(route)
        );

        const workers = sheetsAPI.getAllWorkersFromRoute(route);
        const firstWorker = workers[0] || "No Worker";
        const workerDisplay =
          workers.length > 0
            ? workers
                .map((w) => `${workersManager.getWorkerEmoji(w)} ${w}`)
                .join(", ")
            : "No workers assigned";

        return `
                <div class="date-card" onclick="selectRecoveryRoute('${firstWorker}', '${
          route["recovery route"]
        }')">
                    <h3>${route.calculatedDate || route["recovery route"]}</h3>
                    <p><strong>Worker:</strong> ${workerDisplay}</p>
                    <p><strong>Type:</strong> Recovery Route</p>
                </div>
            `;
      })
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
        "assignmentsContainer"
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
      const dayName =
        route["recovery route"] ||
        route["Recovery Routes"] ||
        route.Day ||
        route.day;
      const stop1 = route["Stop 1"] || route["stop1"] || "";

      if (!dayName || stop1.trim() === "") continue;

      console.log(
        `🔍 Debug: Checking recovery route for ${dayName} with stop: ${stop1}`
      );

      // Generate multiple occurrences to check against target date
      for (let occurrence = 0; occurrence < 10; occurrence++) {
        const calculatedDate = this.calculateNextOccurrence(
          dayName,
          occurrence
        );
        if (calculatedDate) {
          const calculatedDateStr = calculatedDate.toLocaleDateString("en-US");
          console.log(
            `🔍 Debug: Comparing ${calculatedDateStr} with ${targetDateStr}`
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
    console.log("🔍 DEBUG selectRecoveryRoute called with:", {
      worker,
      dayName,
    });
    console.log(
      "🔍 DEBUG recoveryData available:",
      sheetsAPI.recoveryData.length
    );
    console.log(
      "🔍 DEBUG First few recovery routes:",
      sheetsAPI.recoveryData.slice(0, 3)
    );

    const route = sheetsAPI.recoveryData.find((r) => {
      const workers = sheetsAPI.getAllWorkersFromRoute(r);
      console.log(
        `🔍 DEBUG Checking route: ${
          r["recovery route"]
        }, workers: ${workers}, matches worker: ${workers.includes(
          worker
        )}, matches day: ${r["recovery route"] === dayName}`
      );
      return workers.includes(worker) && r["recovery route"] === dayName;
    });

    console.log("🔍 DEBUG Found route:", route);
    if (!route) {
      console.log("🔍 DEBUG No route found for worker/day combination");
      return;
    }

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
  // SHARED RENDERING SYSTEM
  // ========================================
  // Screen 2 now uses assignmentsManager.renderAllUpcomingRoutes()
  // No duplicate code - single source of truth in assignments.js

  // ========================================
  // OLD DATE BUTTON RENDERING (kept for reference)
  // ========================================
  renderChronologicalDates(container) {
    console.log("🔍 Debug: renderChronologicalDates called");
    console.log("🔍 Debug: sheetsAPI.data length:", sheetsAPI.data.length);
    console.log(
      "🔍 Debug: sheetsAPI.recoveryData length:",
      sheetsAPI.recoveryData.length
    );

    // Get all SPFM dates with market info, excluding completed routes
    const allSPFMRoutes = sheetsAPI.data.filter((route) => {
      const status = route["Status"] || route["status"] || route["A"] || "";
      return !flexibleTextMatch(status, "completed");
    });

    const spfmDates = [
      ...new Set(allSPFMRoutes.map((route) => route.date).filter(Boolean)),
    ].map((date) => {
      const routes = allSPFMRoutes.filter((route) => route.date === date);
      const markets = routes.map(
        (route) => route.market || route.Market || "Market"
      );
      const uniqueMarkets = [...new Set(markets)];

      let displayText;
      if (uniqueMarkets.length === 1) {
        displayText = uniqueMarkets[0];
      } else {
        displayText = `${routes.length} Markets`;
      }

      return {
        date: date,
        type: "spfm",
        emoji: "👨‍🌾",
        color: "#007bff", // blue
        market: displayText,
        markets: uniqueMarkets,
        routeCount: routes.length,
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
      recoveryDates.length
    );

    const combinedDates = [...spfmDates, ...recoveryDates];
    console.log("🔍 Debug: Combined dates before dedup:", combinedDates.length);

    // Debug: Check for Tuesday routes in combined data
    const tuesdayItems = combinedDates.filter((item) => {
      if (
        item.type === "recovery" &&
        item.dayName &&
        flexibleTextMatch(item.dayName, "tuesday")
      ) {
        return true;
      }
      if (item.date && new Date(item.date).getDay() === 2) {
        // Tuesday is day 2
        return true;
      }
      return false;
    });
    console.log(
      `🚨 TUESDAY DEBUG: Found ${tuesdayItems.length} Tuesday items in combined dates:`,
      tuesdayItems
    );

    // Remove duplicates based on date and type
    const seenDates = new Set();
    const deduplicatedDates = combinedDates.filter((item) => {
      const key = `${item.date}-${item.type}`;
      if (seenDates.has(key)) {
        console.log(
          `🔍 Debug: Removing duplicate ${item.type} for ${item.date}`
        );
        return false;
      }
      seenDates.add(key);
      return true;
    });

    console.log(
      "🔍 Debug: Combined dates after dedup:",
      deduplicatedDates.length
    );

    // Debug: Check for Tuesday routes after dedup
    const tuesdayAfterDedup = deduplicatedDates.filter((item) => {
      if (
        item.type === "recovery" &&
        item.dayName &&
        flexibleTextMatch(item.dayName, "tuesday")
      ) {
        return true;
      }
      if (item.date && new Date(item.date).getDay() === 2) {
        // Tuesday is day 2
        return true;
      }
      return false;
    });
    console.log(
      `🚨 TUESDAY DEBUG: Found ${tuesdayAfterDedup.length} Tuesday items after dedup:`,
      tuesdayAfterDedup
    );

    const parsedDates = deduplicatedDates.map((item) => {
      const parsed = new Date(item.date);
      console.log(
        `🔍 Debug: Parsing date "${item.date}" -> ${parsed}, isValid: ${!isNaN(
          parsed.getTime()
        )}`
      );
      return {
        ...item,
        parsed: parsed,
      };
    });

    const filteredDates = parsedDates.filter(
      (item) => !isNaN(item.parsed.getTime())
    );
    console.log(
      "🔍 Debug: After filtering invalid dates:",
      filteredDates.length
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
                ? dateItem.market || "Market"
                : "Recovery";
            const bgColor = dateItem.type === "spfm" ? "#fff3e0" : "#e3f2fd"; // Orange tint for SPFM, Blue tint for Recovery
            const borderColor =
              dateItem.type === "spfm" ? "#ff8c00" : "#007bff";
            const emoji = dateItem.type === "spfm" ? "👨‍🌾" : "🛒";

            console.log(
              `🔍 Debug: Rendering card for ${formattedDate}, type: ${dateItem.type}, bgColor: ${bgColor}`
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
      container.innerHTML.length
    );
  }

  // ========================================
  // RECOVERY DATE GENERATION
  // ========================================
  generateWeeklyRecoveryDates() {
    const recoveryDates = [];
    const today = new Date();
    const seenDates = new Set(); // Track seen dates to prevent duplicates

    console.log("🔍 Debug: generateWeeklyRecoveryDates called");
    console.log("🔍 Debug: sheetsAPI.recoveryData:", sheetsAPI.recoveryData);

    // Get recovery route patterns from sheets (day of week info)
    if (sheetsAPI.recoveryData && sheetsAPI.recoveryData.length > 0) {
      console.log("🔍 Debug: Found recovery data, processing routes...");
      sheetsAPI.recoveryData.forEach((route, index) => {
        console.log(`🔍 Debug: Processing recovery route ${index}:`, route);
        const dayName =
          route["recovery route"] ||
          route["Recovery Routes"] ||
          route.Day ||
          route.day;
        const stop1 = route["Stop 1"] || route["stop1"] || "";
        console.log(`🔍 Debug: Day name extracted: ${dayName}`);
        console.log(`🔍 Debug: Stop 1 extracted: ${stop1}`);

        if (dayName && stop1.trim() !== "") {
          // Generate next 12 occurrences of this recovery route
          for (let occurrence = 0; occurrence < 12; occurrence++) {
            const nextDate = this.calculateNextOccurrence(dayName, occurrence);
            if (nextDate && nextDate >= today) {
              const dateString = nextDate.toLocaleDateString("en-US");
              const dateKey = `${dateString}-${normalizeText(dayName)}`;

              // Check if we've already added this date/day combination
              if (seenDates.has(dateKey)) {
                console.log(
                  `🔍 Debug: Skipping duplicate ${dayName} for ${dateString}`
                );
                continue;
              }

              seenDates.add(dateKey);
              const recoveryRoute = {
                ...route,
                date: dateString,
                displayDate: nextDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                }),
                parsed: nextDate,
                type: "recovery",
                emoji: "🛒",
                color: "#ff8c00",
                dayName: dayName,
                sortDate: nextDate,
                startTime: route.startTime || route.Time || "TBD",
                Time: route.Time || route.startTime || "TBD",
              };
              console.log(
                `🔍 Debug: Adding ${dayName} for ${dateString} (occurrence ${occurrence})`
              );
              if (flexibleTextMatch(dayName, "tuesday")) {
                console.log(
                  `🚨 TUESDAY DEBUG: Adding Tuesday recovery for ${dateString}, total Tuesday routes so far:`,
                  recoveryDates.filter((r) =>
                    flexibleTextMatch(r.dayName, "tuesday")
                  ).length + 1
                );
              }
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

    const tuesdayRoutes = recoveryDates.filter(
      (r) => r.dayName && flexibleTextMatch(r.dayName, "tuesday")
    );
    console.log("🔍 Debug: Final recovery dates array:", recoveryDates.length);
    console.log(
      `🚨 TUESDAY DEBUG: Total Tuesday recovery routes generated: ${tuesdayRoutes.length}`
    );
    console.log(
      `🚨 TUESDAY DEBUG: Tuesday dates:`,
      tuesdayRoutes.map((r) => r.date)
    );
    return recoveryDates;
  }

  // ========================================
  // MONDAY DELIVERY DATE GENERATION
  // ========================================
  generateMondayDeliveryDates() {
    const deliveryDates = [];
    const today = new Date();

    console.log("🔍 Debug: generateMondayDeliveryDates called");
    console.log("🔍 Debug: sheetsAPI.deliveryData:", sheetsAPI.deliveryData);
    console.log("🔍 Debug: sheetsAPI.data (SPFM routes):", sheetsAPI.data);

    // Debug delivery data "Food from" values
    if (sheetsAPI.deliveryData && sheetsAPI.deliveryData.length > 0) {
      sheetsAPI.deliveryData.forEach((delivery, index) => {
        console.log(
          `🔍 Debug: Delivery ${index} - Food from: "${delivery["Food from"]}"`
        );
        console.log(`🔍 Debug: All delivery keys:`, Object.keys(delivery));
        console.log(`🔍 Debug: Full delivery object:`, delivery);
      });
    } else {
      console.log("🔍 Debug: No delivery data available or empty array");
    }

    // Check if delivery data exists
    if (!sheetsAPI.deliveryData || sheetsAPI.deliveryData.length === 0) {
      console.log(
        "🔍 Debug: No delivery data available, returning empty array"
      );
      return deliveryDates;
    }

    // Get all Sunday SPFM markets
    const sundayMarkets = sheetsAPI.data.filter((route) => {
      const routeDate = new Date(route.date);
      const isSunday = routeDate.getDay() === 0; // Sunday = 0
      console.log(
        `🔍 Debug: Route date ${
          route.date
        }, day: ${routeDate.getDay()}, isSunday: ${isSunday}`
      );
      return isSunday;
    });

    console.log("🔍 Debug: Found Sunday markets:", sundayMarkets);

    // For each Sunday market, find the corresponding delivery route
    sundayMarkets.forEach((sundayMarket) => {
      const marketLocation = sundayMarket.market;
      console.log("🔍 Debug: Processing Sunday market:", marketLocation);

      // Find delivery route for this market location
      const deliveryRoute = sheetsAPI.deliveryData.find((delivery) => {
        const foodFrom = delivery["Food from"] || delivery["food from"] || "";
        console.log(
          `🔍 Debug: Comparing "${foodFrom}" with "${marketLocation}"`
        );

        // Handle multiple markets separated by comma
        const foodFromMarkets = foodFrom
          .split(",")
          .map((m) => normalizeText(m));
        const targetMarket = normalizeText(marketLocation);

        // Check for exact match or partial match
        return foodFromMarkets.some(
          (market) =>
            market === targetMarket ||
            targetMarket.includes(market) ||
            market.includes(targetMarket)
        );
      });

      if (deliveryRoute) {
        console.log("🔍 Debug: Found matching delivery route:", deliveryRoute);

        // Calculate next Monday after this Sunday market
        const sundayDate = new Date(sundayMarket.date);
        const mondayDate = new Date(sundayDate);
        mondayDate.setDate(sundayDate.getDate() + 1); // Next day (Monday)

        // Only include future dates
        if (mondayDate >= today) {
          const mondayDelivery = {
            date: mondayDate.toLocaleDateString("en-US"),
            displayDate: mondayDate.toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "short",
              day: "numeric",
            }),
            parsed: mondayDate,
            type: "spfm-delivery",
            emoji: "👨‍🌾",
            color: "#ff8c00", // orange like SPFM
            market: `${marketLocation} Delivery`,
            dayName: "Monday",
            startTime: deliveryRoute.startTime || "TBD",
            Time: deliveryRoute.startTime || "TBD",
            worker1: deliveryRoute.worker1 || "",
            worker2: deliveryRoute.worker2 || "",
            van1: deliveryRoute.van1 || "",
            // Copy all stop data
            ...deliveryRoute,
            sortDate: mondayDate,
          };

          console.log("🔍 Debug: Generated Monday delivery:", mondayDelivery);
          deliveryDates.push(mondayDelivery);
        }
      } else {
        console.log(
          "🔍 Debug: No delivery route found for market:",
          marketLocation
        );
      }
    });

    console.log("🔍 Debug: Final Monday delivery dates array:", deliveryDates);
    return deliveryDates;
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
      flexibleTextMatch(key, workerName)
    );

    return workerIcon ? workerIcons[workerIcon] : "👤";
  }
}

// Export instance
const datesManager = new DatesManager();

// Confirm this file loaded
console.log("✅ dates.js loaded");
window.datesManagerLoaded = true;
