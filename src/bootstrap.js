// Central bootstrap to register routes once and keep concerns out of index.html
import "./components/index.js";

function registerRoutes() {
  const router = document.querySelector("hash-router");
  if (!router || typeof router.registerRoute !== "function") return false;
  const existing = router.getRoutes && router.getRoutes();
  if (existing && existing.length > 0) return true; // already registered elsewhere
  try {
    router.registerRoute("/", "reminders-page", "Reminders Dashboard");
    router.registerRoute("/reminders", "reminders-page", "Reminders Dashboard");
    router.registerRoute("/boxes", "boxes-page", "Box Inventory");
    router.registerRoute("/dates", "dates-page", "Upcoming Routes");
    router.registerRoute("/workers", "workers-page", "Routes by Worker");
    router.registerRoute("/route", "route-details-page", "Route Details");
    return true;
  } catch (e) {
    console.warn("Bootstrap route registration failed:", e);
    return false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Retry for a short time in case custom elements instantiate after DOMContentLoaded
  let attempts = 0;
  const maxAttempts = 40; // ~2s total
  const tick = () => {
    if (registerRoutes()) return;
    if (++attempts < maxAttempts) setTimeout(tick, 50);
  };
  tick();
});
