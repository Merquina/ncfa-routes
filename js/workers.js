/* ========================================
   SPFM Routes - Workers Management
   ======================================== */

class WorkersManager {
  constructor() {
    this.currentWorker = null;
    this.workerIcons = {
      Samuel: "🐋",
      Emmanuel: "🦁",
      Irmydel: "🐸",
      Tess: "🌟",
      Ayoyo: "⚡",
      Rosey: "🌹",
      Boniat: "🌊",
      Volunteer: "👤",
    };
  }

  // ========================================
  // WORKER RENDERING
  // ========================================
  renderWorkers() {
    const workersContainer = document.getElementById("workersContainer");
    if (!workersContainer) return;

    const workers = sheetsAPI.getAllWorkers();

    if (workers.length === 0) {
      workersContainer.innerHTML = `
                <div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #666;">
                    <p>No workers found. Make sure your spreadsheet has worker data.</p>
                </div>
            `;
      return;
    }

    workersContainer.innerHTML = workers
      .map(
        (worker) => `
                <div class="worker-card" onclick="selectWorker('${worker}')">
                    ${this.getWorkerEmoji(worker)} ${worker}
                </div>
            `,
      )
      .join("");
  }

  // ========================================
  // WORKER SELECTION
  // ========================================
  selectWorker(worker) {
    this.currentWorker = worker;

    // Update UI
    document.querySelectorAll(".worker-card").forEach((card) => {
      card.classList.remove("selected");
    });

    event.target.classList.add("selected");

    // Add visual separator and loading state
    const assignmentsContainer = document.getElementById(
      "assignmentsContainer",
    );
    if (assignmentsContainer) {
      assignmentsContainer.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #666; background: #f8f9fa; margin: 10px; border-radius: 8px; border: 2px solid #007bff;">
          <div style="font-size: 2rem; margin-bottom: 10px;">📋</div>
          <div style="border-top: 2px solid #ddd; margin: 0 20px 15px 20px;"></div>
          <p style="font-weight: bold; color: #007bff;">Loading assignment for ${this.getWorkerEmoji(worker)} ${worker}...</p>
          <div style="font-size: 0.8rem; color: #999; margin-top: 10px;">Scrolling to assignment view...</div>
        </div>
      `;

      // Immediately scroll to show the loading state
      assignmentsContainer.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }

    // Get worker assignments and slide to assignments view
    const assignments = sheetsAPI.getWorkerAssignments(worker);

    // Small delay for loading effect
    setTimeout(() => {
      this.renderWorkerAssignments(worker, assignments);

      // Simple, direct mobile scrolling
      setTimeout(() => {
        if (assignmentsContainer) {
          // Force scroll to bottom of page to ensure assignment is visible
          const isMobile = /iPhone|iPad|iPod|Android/i.test(
            navigator.userAgent,
          );

          if (isMobile) {
            // Mobile: scroll to bottom of document
            const documentHeight = Math.max(
              document.body.scrollHeight,
              document.body.offsetHeight,
              document.documentElement.clientHeight,
              document.documentElement.scrollHeight,
              document.documentElement.offsetHeight,
            );

            window.scrollTo({
              top: documentHeight,
              behavior: "smooth",
            });

            console.log("Mobile scroll triggered to:", documentHeight);
          } else {
            // Desktop: scroll to assignment
            assignmentsContainer.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }
        }
      }, 300);
    }, 100);
  }

  // ========================================
  // WORKER ASSIGNMENTS RENDERING
  // ========================================
  renderWorkerAssignments(worker, assignments) {
    const assignmentsContainer = document.getElementById(
      "assignmentsContainer",
    );
    if (!assignmentsContainer) return;

    // Combine and sort assignments by date
    const allAssignments = [
      ...assignments.spfm.map((a) => ({ ...a, type: "spfm" })),
      ...assignments.recovery.map((a) => ({ ...a, type: "recovery" })),
    ];

    // Sort by date
    allAssignments.sort((a, b) => {
      const dateA = new Date(a.date || a["Recovery Routes"] || "1900-01-01");
      const dateB = new Date(b.date || b["Recovery Routes"] || "1900-01-01");
      return dateA - dateB;
    });

    if (allAssignments.length === 0) {
      assignmentsContainer.innerHTML = `
                <div class="no-assignments">
                    <h3>${this.getWorkerEmoji(worker)} ${worker}</h3>
                    <p>No assignments found for this worker.</p>
                </div>
            `;
      return;
    }

    // Show only the next assignment (chronologically)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nextAssignment =
      allAssignments.find((assignment) => {
        const assignmentDate = new Date(
          assignment.date || assignment["Recovery Routes"] || "1900-01-01",
        );
        assignmentDate.setHours(0, 0, 0, 0);
        return assignmentDate >= today;
      }) || allAssignments[0]; // Fallback to first assignment if none in future

    if (nextAssignment.type === "spfm") {
      this.renderSPFMAssignment(nextAssignment);
    } else {
      this.renderRecoveryAssignment(nextAssignment);
    }
  }

  // ========================================
  // SPFM ASSIGNMENT RENDERING
  // ========================================
  renderSPFMAssignment(assignment) {
    const assignmentsContainer = document.getElementById(
      "assignmentsContainer",
    );

    const marketContact = sheetsAPI.getAddressFromContacts(assignment.market);
    const dropOffContact = sheetsAPI.getAddressFromContacts(assignment.dropOff);
    const marketAddress = marketContact
      ? marketContact.address
      : assignment.marketAddress;
    const dropOffAddress = dropOffContact
      ? dropOffContact.address
      : assignment.dropOffAddress;

    const fullRouteUrl =
      assignment.dropOff &&
      assignment.dropOff.trim() &&
      assignment.dropOff !== "TBD" &&
      dropOffAddress &&
      dropOffAddress.trim()
        ? `https://www.google.com/maps/dir/${encodeURIComponent(marketAddress)}/${encodeURIComponent(dropOffAddress.trim())}`
        : "";

    assignmentsContainer.innerHTML = `
            <div class="assignment-card">
                <div style="text-align: center; padding: 8px; background: white;">
                    <button onclick="printAssignment()" class="print-btn">🖨️ Print This Assignment</button>
                    ${fullRouteUrl ? `<br><a href="${fullRouteUrl}" target="_blank" class="directions-btn" style="margin-top: 8px;">🗺️ Open Full Route in Maps</a>` : ""}
                </div>

                <div class="market-section">
                    <h2>${assignment.market} – ${assignment.date}</h2>
                    <p><strong>Time:</strong> ${assignment.startTime} – ${assignment.endTime}</p>
                    <p><strong>Pickup Amount:</strong> ${assignment.pickupAmount || assignment["pickupAmount "] || "TBD"}</p>
                    <p>
                        <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(marketAddress)}"
                           target="_blank" class="directions-btn">📍 ${marketAddress}</a>
                    </p>
                    ${marketContact && marketContact.phone ? `<p><strong>Phone:</strong> <a href="tel:${marketContact.phone}" class="phone-btn">📞 ${marketContact.phone}</a></p>` : ""}
                </div>

                <div class="single-column">
                    <div>
                        <h3>👥 Team</h3>
                        ${assignment.worker1 ? `<span class="team-member">${this.getWorkerEmoji(assignment.worker1)} ${assignment.worker1}</span>` : ""}
                        ${assignment.worker2 ? `<span class="team-member">${this.getWorkerEmoji(assignment.worker2)} ${assignment.worker2}</span>` : ""}
                        ${assignment.worker3 ? `<span class="team-member">${this.getWorkerEmoji(assignment.worker3)} ${assignment.worker3}</span>` : ""}
                        ${assignment.worker4 ? `<span class="team-member">${this.getWorkerEmoji(assignment.worker4)} ${assignment.worker4}</span>` : ""}
                    </div>
                    <div>
                        <h3>🚐 Vans</h3>
                        ${assignment.van1 ? `<div class="van-info">Van 1: ${assignment.van1}</div>` : ""}
                        ${assignment.van2 ? `<div class="van-info">Van 2: ${assignment.van2}</div>` : ""}
                        ${assignment.van3 ? `<div class="van-info">Van 3: ${assignment.van3}</div>` : ""}
                        ${assignment.van4 ? `<div class="van-info">Van 4: ${assignment.van4}</div>` : ""}
                    </div>
                </div>

                ${this.renderSteps(assignment)}

                ${
                  assignment.dropOff &&
                  assignment.dropOff.trim() &&
                  assignment.dropOff !== "TBD"
                    ? this.renderDropOffSection(
                        assignment,
                        dropOffContact,
                        dropOffAddress,
                      )
                    : ""
                }

                ${this.renderFinalSection(assignment)}
            </div>
        `;
  }

  // ========================================
  // RECOVERY ASSIGNMENT RENDERING
  // ========================================
  renderRecoveryAssignment(route) {
    const assignmentsContainer = document.getElementById(
      "assignmentsContainer",
    );

    const routeDate =
      this.getNextDateForDay(route["Recovery Routes"]) ||
      route["Recovery Routes"];
    const startTime = route["Start Time"] || route.startTime || "TBD";

    const stops = this.buildRecoveryStops(route);
    const fullRouteUrl = this.buildFullRouteUrl(stops);

    const recoveryHeader = `<div class="recovery-header">🚗 Recovery Assignment</div>`;

    assignmentsContainer.innerHTML = `
            <div class="assignment-card">
                ${recoveryHeader}
                <div style="text-align: center; padding: 8px; background: white;">
                    <button onclick="printAssignment()" class="print-btn">🖨️ Print This Assignment</button>
                    ${stops.length > 1 ? `<br><a href="${fullRouteUrl}" target="_blank" class="directions-btn" style="margin-top: 8px;">🗺️ Open Full Route in Maps</a>` : ""}
                </div>

                <div class="market-section">
                    <h2>${routeDate}</h2>
                    <p><strong>Start Time:</strong> ${startTime}</p>
                    <p><strong>Worker:</strong> ${this.getWorkerEmoji(route.Worker)} ${route.Worker}</p>
                </div>

                ${stops
                  .map(
                    (stop, index) => `
                    <div class="step-header">
                        <span class="step-number">${index + 1}</span>
                        ${stop.name}
                    </div>
                    <div class="single-column">
                        ${
                          stop.address
                            ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.address)}" target="_blank" class="directions-btn">📍 ${stop.address}</a>
                               ${stop.phone ? `<p><strong>Phone:</strong> <a href="tel:${stop.phone}" class="phone-btn">📞 ${stop.phone}</a></p>` : ""}`
                            : `<p><em>Address not specified</em></p>`
                        }
                    </div>
                `,
                  )
                  .join("")}
            </div>
        `;
  }

  // ========================================
  // HELPER METHODS
  // ========================================
  getWorkerEmoji(workerName) {
    if (!workerName || workerName.trim() === "") return "👤";

    if (workerName.trim().toLowerCase().includes("volunteer")) {
      return "👤";
    }

    const workerIcon = Object.keys(this.workerIcons).find(
      (key) => key.toLowerCase() === workerName.trim().toLowerCase(),
    );

    return workerIcon ? this.workerIcons[workerIcon] : "👤";
  }

  buildRecoveryStops(route) {
    const stops = [];
    for (let i = 1; i <= 7; i++) {
      const stopName = route[`Stop ${i}`];
      const stopAddress = route[`Stop ${i} Address`];

      if (stopName && stopName.trim() && stopName.toLowerCase() !== "stop") {
        const contactInfo = sheetsAPI.getAddressFromContacts(stopName);
        stops.push({
          name: stopName,
          address: contactInfo ? contactInfo.address : stopAddress || "",
          phone: contactInfo ? contactInfo.phone : "",
        });
      }
    }
    return stops;
  }

  buildFullRouteUrl(stops) {
    if (stops.length <= 1) return "";

    const addresses = stops
      .map((stop) => stop.address)
      .filter((addr) => addr && addr.trim())
      .map((addr) => encodeURIComponent(addr.trim()));

    if (addresses.length <= 1) return "";

    const origin = addresses[0];
    const destination = addresses[addresses.length - 1];
    const waypoints = addresses.slice(1, -1).join("|");

    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ""}`;
  }

  renderSteps(assignment) {
    const steps = [];

    // Office Materials
    if (assignment.officeMaterials && assignment.officeMaterials.trim()) {
      steps.push({
        title: "📋 Office Materials",
        content: assignment.officeMaterials,
      });
    }

    // Storage Materials
    if (assignment.storageMaterials && assignment.storageMaterials.trim()) {
      steps.push({
        title: "📦 Storage Materials",
        content: assignment.storageMaterials,
      });
    }

    return steps
      .map(
        (step, index) => `
            <div class="step-header">
                <span class="step-number">${index + 1}</span>
                ${step.title}
            </div>
            <div class="single-column">
                <p>${step.content}</p>
            </div>
        `,
      )
      .join("");
  }

  renderDropOffSection(assignment, dropOffContact, dropOffAddress) {
    return `
            <div class="dropoff-section">
                <div class="step-header">
                    <span class="step-number">🚚</span>
                    Drop-off at ${assignment.dropOff}
                </div>
                <div class="single-column">
                    ${
                      dropOffAddress &&
                      dropOffAddress.trim() !== "" &&
                      dropOffAddress.trim() !== "TBD"
                        ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dropOffAddress.trim())}" target="_blank" class="directions-btn">📍 ${dropOffAddress}</a>`
                        : ""
                    }
                    <p><strong>Drop-off Amount:</strong> ${assignment.dropoffAmount || assignment["dropoffAmount "] || "TBD"}</p>
                    ${dropOffContact && dropOffContact.phone ? `<p><strong>Phone:</strong> <a href="tel:${dropOffContact.phone}" class="phone-btn">📞 ${dropOffContact.phone}</a></p>` : ""}
                </div>
            </div>
        `;
  }

  renderFinalSection(assignment) {
    return `
            <div class="final-section">
                <div class="step-header">
                    <span class="step-number">✅</span>
                    Final Steps
                </div>
                <div class="single-column">
                    <p><strong>Return Time:</strong> ${assignment.returnTime || "TBD"}</p>
                    <p><strong>Notes:</strong> ${assignment.notes || "None"}</p>
                </div>
            </div>
        `;
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
const workersManager = new WorkersManager();

// Confirm this file loaded
console.log("✅ workers.js loaded");
window.workersManagerLoaded = true;
