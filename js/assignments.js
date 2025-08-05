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
    const assignmentsContainer = document.getElementById("assignmentsContainer");
    if (!assignmentsContainer) return;

    const workerEmoji = this.getWorkerEmoji(workerName);

    if (!assignments || (assignments.spfm.length === 0 && assignments.recovery.length === 0)) {
      assignmentsContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #666; background: #f8f9fa; margin: 10px; border-radius: 8px;">
          <div style="font-size: 2rem; margin-bottom: 10px;">${workerEmoji}</div>
          <h3>${workerName}</h3>
          <p>No assignments found for this worker.</p>
        </div>
      `;
      return;
    }

    let html = `
      <div style="background: #f8f9fa; margin: 10px; padding: 15px; border-radius: 8px; border: 2px solid #007bff;">
        <div style="text-align: center; margin-bottom: 15px;">
          <div style="font-size: 2rem; margin-bottom: 5px;">${workerEmoji}</div>
          <h3 style="margin: 0; color: #007bff;">${workerName}'s Assignments</h3>
          <div style="border-top: 2px solid #ddd; margin: 10px 20px;"></div>
        </div>
    `;

    // Add SPFM assignments
    if (assignments.spfm.length > 0) {
      html += `<div style="margin-bottom: 20px;">`;
      html += `<h4 style="color: #007bff; margin-bottom: 10px;">🚚 SPFM Routes (${assignments.spfm.length})</h4>`;

      assignments.spfm.forEach(route => {
        const vanEmoji = this.getVanEmoji(route.van1 || route.van2);
        html += `
          <div style="background: white; padding: 12px; margin-bottom: 8px; border-radius: 6px; border-left: 4px solid #007bff;">
            <div style="font-weight: bold; color: #333;">
              ${vanEmoji} ${route.date} - ${route.market || 'Market'} ${route.startTime ? `at ${route.startTime}` : ''}
            </div>
            <div style="font-size: 0.9rem; color: #666; margin-top: 4px;">
              Van: ${route.van1 || route.van2 || 'Not assigned'} |
              Workers: ${[route.worker1, route.worker2, route.worker3, route.worker4].filter(w => w && w.trim()).join(', ')}
            </div>
            ${route.dropOff ? `<div style="font-size: 0.8rem; color: #888; margin-top: 2px;">Drop-off: ${route.dropOff}</div>` : ''}
          </div>
        `;
      });
      html += `</div>`;
    }

    // Add Recovery assignments
    if (assignments.recovery.length > 0) {
      html += `<div style="margin-bottom: 20px;">`;
      html += `<h4 style="color: #28a745; margin-bottom: 10px;">🚗 Recovery Routes (${assignments.recovery.length})</h4>`;

      assignments.recovery.forEach(route => {
        html += `
          <div style="background: white; padding: 12px; margin-bottom: 8px; border-radius: 6px; border-left: 4px solid #28a745;">
            <div style="font-weight: bold; color: #333;">
              🚗 ${route.Day || 'Day'} Recovery - ${route.Location || 'Location'}
            </div>
            <div style="font-size: 0.9rem; color: #666; margin-top: 4px;">
              Time: ${route.Time || 'Not specified'} |
              Contact: ${route.Contact || 'Not specified'}
            </div>
            ${route.Notes ? `<div style="font-size: 0.8rem; color: #888; margin-top: 2px;">Notes: ${route.Notes}</div>` : ''}
          </div>
        `;
      });
      html += `</div>`;
    }

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
  // DATE ASSIGNMENTS RENDERING
  // ========================================
  renderDateAssignments(date, routes) {
    const assignmentsContainer = document.getElementById("assignmentsContainer");
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

    let html = `
      <div style="background: #f8f9fa; margin: 10px; padding: 15px; border-radius: 8px; border: 2px solid #007bff;">
        <div style="text-align: center; margin-bottom: 15px;">
          <div style="font-size: 2rem; margin-bottom: 5px;">📅</div>
          <h3 style="margin: 0; color: #007bff;">${formattedDate}</h3>
          <div style="border-top: 2px solid #ddd; margin: 10px 20px;"></div>
        </div>
    `;

    routes.forEach(route => {
      const vanEmoji = this.getVanEmoji(route.van1 || route.van2);
      const workers = [route.worker1, route.worker2, route.worker3, route.worker4]
        .filter(w => w && w.trim() && w.toLowerCase() !== 'cancelled')
        .map(w => `${this.getWorkerEmoji(w)} ${w}`)
        .join(', ');

      html += `
        <div style="background: white; padding: 12px; margin-bottom: 12px; border-radius: 6px; border-left: 4px solid #007bff;">
          <div style="font-weight: bold; color: #333; margin-bottom: 8px;">
            ${vanEmoji} ${route.market || 'Market'} Route ${route.startTime ? `- ${route.startTime}` : ''}
          </div>
          <div style="display: grid; gap: 4px; font-size: 0.9rem;">
            <div><strong>Workers:</strong> ${workers || 'Not assigned'}</div>
            <div><strong>Van:</strong> ${route.van1 || route.van2 || 'Not assigned'}</div>
            ${route.dropOff ? `<div><strong>Drop-off:</strong> ${route.dropOff}</div>` : ''}
            ${route.pickupAmount ? `<div><strong>Pickup Amount:</strong> ${route.pickupAmount}</div>` : ''}
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
  // RECOVERY ROUTE ASSIGNMENTS RENDERING
  // ========================================
  renderRecoveryRouteAssignment(worker, dayName) {
    const assignmentsContainer = document.getElementById("assignmentsContainer");
    if (!assignmentsContainer) return;

    const workerEmoji = this.getWorkerEmoji(worker);

    // Find recovery routes for this worker and day
    const recoveryRoutes = sheetsAPI.recoveryData.filter(route => {
      const routeWorker = (route.Worker || '').trim().toLowerCase();
      const routeDay = (route.Day || '').trim().toLowerCase();
      return routeWorker === worker.toLowerCase() && routeDay === dayName.toLowerCase();
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

    recoveryRoutes.forEach(route => {
      html += `
        <div style="background: white; padding: 12px; margin-bottom: 12px; border-radius: 6px; border-left: 4px solid #28a745;">
          <div style="font-weight: bold; color: #333; margin-bottom: 8px;">
            📍 ${route.Location || 'Location'}
          </div>
          <div style="display: grid; gap: 4px; font-size: 0.9rem;">
            <div><strong>Time:</strong> ${route.Time || 'Not specified'}</div>
            <div><strong>Contact:</strong> ${route.Contact || 'Not specified'}</div>
            ${route.Phone ? `<div><strong>Phone:</strong> ${route.Phone}</div>` : ''}
            ${route.Address ? `<div><strong>Address:</strong> ${route.Address}</div>` : ''}
            ${route.Notes ? `<div><strong>Notes:</strong> ${route.Notes}</div>` : ''}
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
