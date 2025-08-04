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
        const datesContainer = document.getElementById("datesContainer");
        const recoveryContainer = document.getElementById("recoveryDates");

        if (!datesContainer || !recoveryContainer) return;

        // Render SPFM dates
        this.renderSPFMDates(datesContainer);

        // Render Recovery dates
        this.renderRecoveryDates(recoveryContainer);
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
            .map(date => ({
                original: date,
                parsed: new Date(date)
            }))
            .filter(dateObj => dateObj.parsed >= today)
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
            .map(dateObj => {
                const routes = sheetsAPI.getRoutesByDate(dateObj.original);
                const workers = routes
                    .flatMap((r) => [r.worker1, r.worker2, r.worker3, r.worker4])
                    .filter(Boolean)
                    .filter((w) => w.toLowerCase() !== "cancelled")
                    .map((w) => `${workersManager.getWorkerEmoji(w)} ${w}`)
                    .join(", ");

                const markets = [...new Set(routes.map(r => r.market))].join(", ");

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
            .filter(route =>
                route["Recovery Routes"] &&
                route.Worker &&
                route.Worker.toLowerCase() !== "worker"
            )
            .map(route => {
                const calculatedDate = this.getNextDateForDay(route["Recovery Routes"]);
                return {
                    ...route,
                    calculatedDate,
                    sortDate: calculatedDate ? new Date(calculatedDate) : new Date("1900-01-01")
                };
            })
            .filter(route => route.sortDate >= today)
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
            .map(route => `
                <div class="date-card" onclick="selectRecoveryRoute('${route.Worker}', '${route["Recovery Routes"]}')">
                    <h3>${route.calculatedDate || route["Recovery Routes"]}</h3>
                    <p><strong>Worker:</strong> ${workersManager.getWorkerEmoji(route.Worker)} ${route.Worker}</p>
                    <p><strong>Type:</strong> Recovery Route</p>
                </div>
            `)
            .join("");
    }

    // ========================================
    // DATE SELECTION
    // ========================================
    selectDate(date) {
        this.currentDate = date;

        // Update UI
        document.querySelectorAll(".date-card").forEach(card => {
            card.classList.remove("selected");
        });

        event.target.classList.add("selected");

        // Get routes for this date
        const routes = sheetsAPI.getRoutesByDate(date);
        this.renderDateAssignments(date, routes);
    }

    selectRecoveryRoute(worker, dayName) {
        const route = sheetsAPI.recoveryData.find(r =>
            r.Worker === worker && r["Recovery Routes"] === dayName
        );

        if (!route) return;

        const calculatedDate = this.getNextDateForDay(dayName);
        route.calculatedDate = calculatedDate;

        this.renderRecoveryRouteAssignment(route);
    }

    // ========================================
    // DATE ASSIGNMENTS RENDERING
    // ========================================
    renderDateAssignments(date, routes) {
        const assignmentsContainer = document.getElementById("assignmentsContainer");
        if (!assignmentsContainer) return;

        if (routes.length === 0) {
            assignmentsContainer.innerHTML = `
                <div class="no-assignments">
                    <h3>📅 ${date}</h3>
                    <p>No routes scheduled for this date.</p>
                </div>
            `;
            return;
        }

        assignmentsContainer.innerHTML = routes
            .map(assignment => this.renderSingleDateAssignment(assignment))
            .join("");
    }

    renderSingleDateAssignment(assignment) {
        const marketContact = sheetsAPI.getAddressFromContacts(assignment.market);
        const dropOffContact = sheetsAPI.getAddressFromContacts(assignment.dropOff);
        const marketAddress = marketContact ? marketContact.address : assignment.marketAddress;
        const dropOffAddress = dropOffContact ? dropOffContact.address : assignment.dropOffAddress;

        const fullRouteUrl = assignment.dropOff && assignment.dropOff.trim() && assignment.dropOff !== "TBD" && dropOffAddress && dropOffAddress.trim()
            ? `https://www.google.com/maps/dir/${encodeURIComponent(marketAddress)}/${encodeURIComponent(dropOffAddress.trim())}`
            : "";

        return `
            <div class="assignment-card">
                <div style="text-align: center; padding: 8px; background: white;">
                    <button onclick="printAssignment()" class="print-btn">🖨️ Print This Assignment</button>
                    ${fullRouteUrl ? `<br><a href="${fullRouteUrl}" target="_blank" class="directions-btn" style="margin-top: 10px;">🗺️ Open Full Route in Maps</a>` : ""}
                </div>

                <div class="market-section">
                    <h2>${assignment.market} – ${assignment.date}</h2>
                    <p><strong>Time:</strong> ${assignment.startTime} – ${assignment.endTime}</p>
                    <p><strong>Pickup Amount:</strong> ${assignment.pickupAmount || assignment["pickupAmount "] || "TBD"}</p>
                    <p>
                        <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(marketAddress)}"
                           target="_blank" class="directions-btn">📍 ${marketAddress}</a>
                    </p>
                    ${marketContact && marketContact.phone ? `<p><strong>Phone:</strong> <a href="tel:${marketContact.phone}" class="phone-btn">📞 ${marketContact.phone}</a></p>` : ''}
                </div>

                <div class="single-column">
                    <div>
                        <h3>👥 Team</h3>
                        ${assignment.worker1 ? `<span class="team-member">${workersManager.getWorkerEmoji(assignment.worker1)} ${assignment.worker1}</span>` : ""}
                        ${assignment.worker2 ? `<span class="team-member">${workersManager.getWorkerEmoji(assignment.worker2)} ${assignment.worker2}</span>` : ""}
                        ${assignment.worker3 ? `<span class="team-member">${workersManager.getWorkerEmoji(assignment.worker3)} ${assignment.worker3}</span>` : ""}
                        ${assignment.worker4 ? `<span class="team-member">${workersManager.getWorkerEmoji(assignment.worker4)} ${assignment.worker4}</span>` : ""}
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

                ${assignment.dropOff && assignment.dropOff.trim() && assignment.dropOff !== "TBD"
                    ? this.renderDropOffSection(assignment, dropOffContact, dropOffAddress)
                    : ""
                }

                ${this.renderFinalSection(assignment)}
            </div>
        `;
    }

    renderRecoveryRouteAssignment(route) {
        const assignmentsContainer = document.getElementById("assignmentsContainer");
        if (!assignmentsContainer) return;

        const routeDate = route.calculatedDate || route["Recovery Routes"];
        const startTime = route["Start Time"] || route.startTime || "TBD";

        const stops = this.buildRecoveryStops(route);
        const fullRouteUrl = this.buildFullRouteUrl(stops);

        assignmentsContainer.innerHTML = `
            <div class="assignment-card">
                <div class="recovery-header">🚗 Recovery Assignment</div>
                <div style="text-align: center; padding: 8px; background: white;">
                    <button onclick="printAssignment()" class="print-btn">🖨️ Print This Assignment</button>
                    ${stops.length > 1 ? `<br><a href="${fullRouteUrl}" target="_blank" class="directions-btn" style="margin-top: 8px;">🗺️ Open Full Route in Maps</a>` : ""}
                </div>

                <div class="market-section">
                    <h2>${routeDate}</h2>
                    <p><strong>Start Time:</strong> ${startTime}</p>
                    <p><strong>Worker:</strong> ${workersManager.getWorkerEmoji(route.Worker)} ${route.Worker}</p>
                </div>

                ${stops.map((stop, index) => `
                    <div class="step-header">
                        <span class="step-number">${index + 1}</span>
                        ${stop.name}
                    </div>
                    <div class="single-column">
                        ${stop.address
                            ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stop.address)}" target="_blank" class="directions-btn">📍 ${stop.address}</a>
                               ${stop.phone ? `<p><strong>Phone:</strong> <a href="tel:${stop.phone}" class="phone-btn">📞 ${stop.phone}</a></p>` : ''}`
                            : `<p><em>Address not specified</em></p>`
                        }
                    </div>
                `).join("")}
            </div>
        `;
    }

    // ========================================
    // HELPER METHODS
    // ========================================
    formatDate(date) {
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
    }

    getNextDateForDay(dayName) {
        if (!dayName) return null;

        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayIndex = days.findIndex(day => day.toLowerCase() === dayName.toLowerCase());

        if (dayIndex === -1) return null;

        const today = new Date();
        const currentDay = today.getDay();
        const daysUntilTarget = (dayIndex - currentDay + 7) % 7;
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + (daysUntilTarget === 0 ? 7 : daysUntilTarget));

        return targetDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
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
                    address: contactInfo ? contactInfo.address : (stopAddress || ""),
                    phone: contactInfo ? contactInfo.phone : "",
                });
            }
        }
        return stops;
    }

    buildFullRouteUrl(stops) {
        if (stops.length <= 1) return "";

        const addresses = stops
            .map(stop => stop.address)
            .filter(addr => addr && addr.trim())
            .map(addr => encodeURIComponent(addr.trim()));

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
                content: assignment.officeMaterials
            });
        }

        // Storage Materials
        if (assignment.storageMaterials && assignment.storageMaterials.trim()) {
            steps.push({
                title: "📦 Storage Materials",
                content: assignment.storageMaterials
            });
        }

        return steps.map((step, index) => `
            <div class="step-header">
                <span class="step-number">${index + 1}</span>
                ${step.title}
            </div>
            <div class="single-column">
                <p>${step.content}</p>
            </div>
        `).join("");
    }

    renderDropOffSection(assignment, dropOffContact, dropOffAddress) {
        return `
            <div class="dropoff-section">
                <div class="step-header">
                    <span class="step-number">🚚</span>
                    Drop-off at ${assignment.dropOff}
                </div>
                <div class="single-column">
                    <p><strong>Drop-off Amount:</strong> ${assignment.dropoffAmount || assignment["dropoffAmount "] || "TBD"}</p>
                    ${dropOffAddress && dropOffAddress.trim() !== "" && dropOffAddress.trim() !== "TBD"
                        ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dropOffAddress.trim())}" target="_blank" class="directions-btn">📍 ${dropOffAddress}</a>`
                        : ""
                    }
                    ${dropOffContact && dropOffContact.phone ? `<p><strong>Phone:</strong> <a href="tel:${dropOffContact.phone}" class="phone-btn">📞 ${dropOffContact.phone}</a></p>` : ''}
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
}

// Export instance
const datesManager = new DatesManager();
