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
    const workerComponent = document.getElementById("workerComponent");
    if (!workerComponent) {
      console.error("❌ Worker component not found");
      return;
    }

    const workers = sheetsAPI.getAllWorkers();

    // Set up the worker component with current data
    workerComponent.setWorkers(workers);
    workerComponent.setWorkerIcons(this.workerIcons);
    workerComponent.setDefaultIcon("👤");

    // Listen for worker selection events
    workerComponent.addEventListener('worker-selected', (e) => {
      this.selectWorker(e.detail.worker);
    });
  }

  // ========================================
  // WORKER SELECTION
  // ========================================
  selectWorker(worker) {
    this.currentWorker = worker;

    // Scroll to top first when worker is selected
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

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
