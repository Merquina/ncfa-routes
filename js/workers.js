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

    workersContainer.innerHTML = `
      <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; align-items: center;">
        ${workers
          .map(
            (worker) => `
              <div class="worker-card" onclick="selectWorker('${worker}')" style="display: inline-block; text-align: center;">
                ${this.getWorkerEmoji(worker)} ${worker}
              </div>
            `,
          )
          .join("")}
      </div>
    `;
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
        </div>
      `;
    }

    // Get worker assignments and render using assignments manager
    const assignments = sheetsAPI.getWorkerAssignments(worker);

    // Small delay for loading effect
    setTimeout(() => {
      assignmentsManager.renderWorkerAssignments(worker, assignments);

      // Scroll to assignments after rendering (like Screen 2)
      setTimeout(() => {
        const assignmentsContainer = document.getElementById(
          "assignmentsContainer",
        );
        if (assignmentsContainer) {
          assignmentsContainer.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }
      }, 500);
    }, 100);
  }

  // ========================================
  // WORKER EMOJI HELPER (Public method for assignments)
  // ========================================

  getWorkerEmoji(workerName) {
    if (!workerName || workerName.trim() === "") return "👤";

    if (flexibleTextIncludes(workerName, "volunteer")) {
      return "👤";
    }

    const workerIcon = Object.keys(this.workerIcons).find((key) =>
      flexibleTextMatch(key, workerName),
    );

    return workerIcon ? this.workerIcons[workerIcon] : "👤";
  }
}

// Export instance
const workersManager = new WorkersManager();

// Confirm this file loaded
console.log("✅ workers.js loaded");
window.workersManagerLoaded = true;
