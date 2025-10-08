// Import services
import "../services/data-service.js";

// Import controllers
import "../controllers/page-controller.js";

// Import components
import "./app-header.js";
import "./inventory-component.js";
import "./worker-component.js";
import "./route-card.js";
import "./date-card.js";
import "./route-list.js";
import "./hash-router.js";
import "./app-layout.js";
import "./route-details.js";
import "./dev-overlay.js";
import "./material-icon.js";

// Import pages
import "../pages/reminders-page.js";
import "../pages/boxes-page.js";
import "../pages/workers-page.js";
import "../pages/dates-page.js";
import "../pages/route-details-page.js";
import "../pages/address-book-page.js";
import "../pages/tasks-page.js";
import "../pages/timesheet-page.js";

// Optional named exports for convenience (valid ESM syntax)
export const InventoryComponent = customElements.get("inventory-component");
export const WorkerComponent = customElements.get("worker-component");
export const RouteCard = customElements.get("route-card");
export const DateCard = customElements.get("date-card");
export const RouteList = customElements.get("route-list");
export const RouteDetails = customElements.get("route-details");
export const HashRouter = customElements.get("hash-router");
export const AppLayout = customElements.get("app-layout");
export const RemindersPage = customElements.get("reminders-page");
export const BoxesPage = customElements.get("boxes-page");
export const WorkersPage = customElements.get("workers-page");
export const DatesPage = customElements.get("dates-page");
export const RouteDetailsPage = customElements.get("route-details-page");
export const AddressBookPage = customElements.get("address-book-page");
export const TasksPage = customElements.get("tasks-page");
export const TimesheetPage = customElements.get("timesheet-page");

// In dev, force a full reload when any web component module changes.
// This avoids stale customElements definitions that cannot be re-registered.
if (import.meta && import.meta.hot) {
  try {
    import.meta.hot.accept(() => {
      console.log("[HMR] Web component update detected; reloading page.");
      window.location.reload();
    });
  } catch (e) {
    // ignore
  }
}

// Auto-register common routes when a router is present on the page
if (typeof window !== "undefined") {
  const registerRoutesIfReady = () => {
    try {
      const router = document.querySelector("hash-router");
      if (!router || typeof router.registerRoute !== "function") {
        return setTimeout(registerRoutesIfReady, 50);
      }
      // Avoid duplicate registration by checking if any route exists
      const existing = router.getRoutes && router.getRoutes();
      if (existing && existing.length > 0) return;
      router.registerRoute("/", "reminders-page", "Reminders Dashboard");
      router.registerRoute(
        "/reminders",
        "reminders-page",
        "Reminders Dashboard"
      );
      router.registerRoute("/boxes", "boxes-page", "Box Inventory");
      router.registerRoute("/dates", "dates-page", "Next Upcoming");
      router.registerRoute("/workers", "workers-page", "Routes by Worker");
      router.registerRoute(
        "/address-book",
        "address-book-page",
        "Address Book"
      );
      router.registerRoute("/tasks", "tasks-page", "Tasks");
      router.registerRoute("/timesheet", "timesheet-page", "Timesheet");

      router.registerRoute("/route", "route-details-page", "Route Details");
    } catch {}
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", registerRoutesIfReady);
  } else {
    registerRoutesIfReady();
  }

  // Optionally attach a dev overlay if enabled
  const maybeAttachOverlay = () => {
    try {
      const url = new URL(window.location.href);
      const enabled =
        url.searchParams.get("dev") === "1" ||
        localStorage.getItem("devOverlay") === "1";
      if (!enabled) return;
      if (!document.querySelector("dev-overlay")) {
        const el = document.createElement("dev-overlay");
        document.body.appendChild(el);
      }
      // Allow Ctrl/Meta + D to toggle visibility
      window.addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
          const flag = localStorage.getItem("devOverlay") === "1";
          localStorage.setItem("devOverlay", flag ? "0" : "1");
        }
      });
    } catch {}
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", maybeAttachOverlay);
  } else {
    maybeAttachOverlay();
  }
}
