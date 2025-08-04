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

    // Get worker assignments and render using assignments manager
    const assignments = sheetsAPI.getWorkerAssignments(worker);

    // Small delay for loading effect
    setTimeout(() => {
      assignmentsManager.renderWorkerAssignments(worker, assignments);

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
  // WORKER EMOJI HELPER (Public method for assignments)
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
}

// Export instance
const workersManager = new WorkersManager();

// Confirm this file loaded
console.log("✅ workers.js loaded");
window.workersManagerLoaded = true;
