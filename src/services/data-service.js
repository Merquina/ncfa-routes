/**
 * Data Service - Abstracts all external data sources (Google Sheets, localStorage, etc.)
 * Provides clean APIs for components without exposing implementation details
 */
import localStore from "./local-store.js";
import sheetsAPI, {
  loadApiDataIfNeeded,
  getDataSignature,
} from "./sheets-api.js";

class DataService extends EventTarget {
  constructor() {
    super();
    this.inventory = {
      smallBoxes: 0,
      largeBoxes: 0,
      lastUpdated: null,
      updatedBy: null,
    };
    this.workers = [];
    this.routes = [];
    this.isLoading = false;
    // Cache for normalized routes to avoid recomputation on tab switches
    this._routesCacheKey = null;
    this._routesCache = [];
    this._lastSignature = null;

    try {
      // When sheets data updates (via polling), refresh normalized caches
      if (sheetsAPI && typeof sheetsAPI.addEventListener === "function") {
        sheetsAPI.addEventListener("updated", async () => {
          console.info(
            "Auto-refresh: Sheets updated, recomputing normalized routes"
          );
          try {
            const normalized = await this.getRoutes();
            await localStore.putCache("normalizedRoutes", normalized);
            await localStore.setMeta("dataSignature", this._makeSignature());
            console.info(
              "Auto-refresh: normalized routes =",
              normalized.length
            );
            this.dispatchEvent(new CustomEvent("data-loaded"));
          } catch (e) {
            this.dispatchEvent(new CustomEvent("data-error", { detail: e }));
          }
        });
      }
    } catch {}
  }

  async _ensureApiLoaded(force = false) {
    try {
      await loadApiDataIfNeeded(force);
    } catch (e) {
      console.error("Failed to ensure API loaded:", e);
      throw e;
    }
  }

  _makeSignature() {
    try {
      return getDataSignature();
    } catch {
      return "";
    }
  }

  // ========================================
  // INVENTORY METHODS
  // ========================================

  async getInventory() {
    await localStore.init();
    // Try to load from localStorage first (fast)
    try {
      const stored = localStorage.getItem("spfm_inventory");
      if (stored) {
        this.inventory = { ...this.inventory, ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error("Error loading inventory from localStorage:", error);
    }

    // Try to sync with Google Sheets (slower)
    if (
      window.inventoryManager &&
      typeof window.inventoryManager.loadInventoryFromSheets === "function"
    ) {
      try {
        await window.inventoryManager.loadInventoryFromSheets();
        const freshInventory = window.inventoryManager.getLocalInventory();
        if (freshInventory) {
          this.inventory = { ...this.inventory, ...freshInventory };
        }
      } catch (error) {
        console.error("Error syncing inventory with sheets:", error);
      }
    }

    return { ...this.inventory };
  }

  async updateInventory(smallBoxes, largeBoxes, updatedBy) {
    const newInventory = {
      smallBoxes: parseInt(smallBoxes) || 0,
      largeBoxes: parseInt(largeBoxes) || 0,
      lastUpdated: new Date().toLocaleString(),
      updatedBy: updatedBy || "Anonymous",
    };

    // Update local state
    this.inventory = newInventory;

    // Save to localStorage
    try {
      localStorage.setItem("spfm_inventory", JSON.stringify(newInventory));
    } catch (error) {
      console.error("Error saving to localStorage:", error);
    }

    // Sync to Google Sheets
    let synced = false;
    if (
      window.inventoryManager &&
      typeof window.inventoryManager.tryUploadInventoryToSheets === "function"
    ) {
      try {
        await window.inventoryManager.tryUploadInventoryToSheets(newInventory);
        synced = true;
      } catch (error) {
        console.error("Error syncing to sheets:", error);
      }
    }

    // Emit update event
    this.dispatchEvent(
      new CustomEvent("inventory-updated", {
        detail: { ...newInventory, synced },
      })
    );

    // Return sync status to callers so UI can confirm
    return { ...newInventory, synced };
  }

  // ========================================
  // WORKERS METHODS
  // ========================================

  async getWorkers() {
    await localStore.init();
    // Try fast path from cache in IndexedDB if signature matches
    const signature = this._makeSignature();
    const storedSig = await localStore.getMeta("dataSignature");
    if (storedSig && storedSig === signature) {
      const cache = await localStore.getCache("workersList");
      if (cache && Array.isArray(cache.data)) {
        this.workers = cache.data;
        return [...this.workers];
      }
    }
    // Load API data if needed
    try {
      await this._ensureApiLoaded();
      this.workers = sheetsAPI.getAllWorkers() || [];
    } catch (error) {
      console.error("Error loading workers:", error);
      this.workers = [];
    }

    // Persist to local store for quicker subsequent loads
    try {
      await localStore.putCache("workersList", this.workers);
      await localStore.setMeta("dataSignature", signature);
    } catch {}
    return [...this.workers];
  }

  async getWorkerAssignments(workerName) {
    if (!workerName) return [];

    // Ensure API data is loaded
    if (sheetsAPI) {
      try {
        await this._ensureApiLoaded();
        return [];
      } catch (error) {
        console.error("Error loading worker assignments:", error);
        return [];
      }
    }

    return [];
  }

  // ========================================
  // ROUTES METHODS
  // ========================================

  /**
   * Return a normalized list of all routes from SPFM, Recovery, and Delivery sources.
   * Does not touch DOM; pulls from sheetsAPI via the existing loadApiDataIfNeeded gate.
   */
  async getRoutes() {
    await localStore.init();
    // Ensure API data is loaded
    await this._ensureApiLoaded();

    // Build a lightweight signature of the current sheet data state
    const cacheKey = this._makeSignature();

    // Return cached normalization when the source signature hasn't changed
    if (
      cacheKey &&
      cacheKey === this._routesCacheKey &&
      this._routesCache.length
    ) {
      return [...this._routesCache];
    }

    // Try IndexedDB cache if signature matches
    const storedSig = await localStore.getMeta("dataSignature");
    if (storedSig && storedSig === cacheKey) {
      const cache = await localStore.getCache("normalizedRoutes");
      if (cache && Array.isArray(cache.data)) {
        this.routes = cache.data;
        this._routesCacheKey = cacheKey;
        this._routesCache = [...this.routes];
        return [...this.routes];
      }
    }

    const routes = [];

    // SPFM routes
    if (Array.isArray(sheetsAPI.data)) {
      console.debug("[DataService] SPFM data count:", sheetsAPI.data.length);
      sheetsAPI.data.forEach((r) => {
        // Skip routes if routeID is empty (same filter as Routes sheet)
        const routeId = this._getField(r, [
          "routeID",
          "routeId",
          "RouteID",
          "route_id",
          "id",
          "ID",
        ]);
        if (!routeId || routeId.toString().trim() === "") {
          // Debug: Show which SPFM routes are being filtered out
          const market = this._getField(r, [
            "market",
            "Market",
            "location",
            "Location",
          ]);
          const date = this._getField(r, ["date", "Date", "DATE"]);
          console.log("[DEBUG] Skipping SPFM route with empty routeID:", {
            market,
            date,
          });
          return; // Skip this route if no routeID
        }

        // Debug: Check for Woodbury in SPFM data
        const market = this._getField(r, [
          "market",
          "Market",
          "location",
          "Location",
        ]);
        const date = this._getField(r, ["date", "Date", "DATE"]);

        // Debug: Check for any Thursday routes (Aug 14, 2025) or upcoming routes
        if (
          date &&
          (date.includes("August 14") ||
            date.includes("Thursday") ||
            date.includes("Aug 14"))
        ) {
          console.log("[DEBUG] Found Thursday/Aug 14 route in SPFM:", {
            date: date,
            market: market,
            routeId: routeId,
            hasRouteId: !!(routeId && routeId.toString().trim()),
            rawRow: r,
          });
        }

        // Debug: Log ALL routes with dates to see what's available (first 10 only)
        if (date && routeId) {
          console.log("[DEBUG] SPFM route:", {
            date: date,
            market: market || "No market",
            routeId: routeId,
            dateContainsAug14: date.includes("14"),
          });
        }

        if (market && market.toLowerCase().includes("woodbury")) {
          const isAug17Date =
            date &&
            (date.includes("August 17") ||
              date.includes("8/17") ||
              date.includes("17/8"));
          console.log("[DEBUG] Found Woodbury in SPFM data:", {
            date: date,
            market: market,
            routeId: routeId,
            isAug17: isAug17Date,
            allFields: Object.keys(r).map((key) => `${key}: ${r[key]}`),
            rawRow: r,
          });

          if (isAug17Date) {
            console.warn(
              "[ISSUE] This might be the problematic Aug 17 route from SPFM sheet"
            );
          }
        }
        const normalizedRoute = this._normalizeRoute(r, "spfm");

        // Debug: Check what the normalized route looks like for Aug 17 Woodbury
        if (
          market &&
          market.toLowerCase().includes("woodbury") &&
          date &&
          date.includes("August 17")
        ) {
          console.log("[DEBUG] Normalized Aug 17 Woodbury route:", {
            originalMarket: market,
            normalizedMarket: normalizedRoute.market,
            originalDate: date,
            normalizedDate: normalizedRoute.date || normalizedRoute.displayDate,
            fullNormalized: normalizedRoute,
          });
        }

        routes.push(normalizedRoute);
      });
    }

    // Recovery routes (skip if consolidated Routes is available to avoid duplicates)
    if (
      (!Array.isArray(sheetsAPI.routesData) ||
        sheetsAPI.routesData.length === 0) &&
      Array.isArray(sheetsAPI.recoveryData)
    ) {
      console.debug(
        "[DataService] Recovery data count:",
        sheetsAPI.recoveryData.length
      );
      sheetsAPI.recoveryData.forEach((r) =>
        routes.push(this._normalizeRoute(r, "recovery"))
      );
    }

    // SPFM Delivery routes (if present)
    if (
      (!Array.isArray(sheetsAPI.routesData) ||
        sheetsAPI.routesData.length === 0) &&
      Array.isArray(sheetsAPI.deliveryData)
    ) {
      console.debug(
        "[DataService] Delivery data count:",
        sheetsAPI.deliveryData.length
      );
      sheetsAPI.deliveryData.forEach((r) =>
        routes.push(this._normalizeRoute(r, "spfm-delivery"))
      );
    }

    // Consolidated Routes sheet (if present) - expand periodic definitions into dated routes
    if (
      Array.isArray(sheetsAPI.routesData) &&
      sheetsAPI.routesData.length > 0
    ) {
      console.debug(
        "[DataService] Routes sheet count:",
        sheetsAPI.routesData.length
      );

      // 1) Split rows into explicitly dated and periodic
      const datedRows = [];
      const periodicRows = [];
      const otherRows = [];
      sheetsAPI.routesData.forEach((r) => {
        const hasDate = !!this._getField(r, ["date", "Date", "DATE"]);
        const weekday = this._getField(r, [
          "Weekday",
          "weekday",
          "DAY",
          "dayName",
          "Day",
          "day",
        ]);
        if (hasDate) datedRows.push(r);
        else if (weekday) periodicRows.push(r);
        else otherRows.push(r);
      });

      // 2) Collect override keys from custom (dated) rows keyed by date
      //    Each date maps to a list of override matchers: { type, marketNorm, marketEmpty }
      const overridesByDate = new Map();
      datedRows.forEach((r) => {
        const dv = this._getField(r, ["date", "Date", "DATE"]);
        const d = dv instanceof Date ? dv : new Date(dv);
        const iso = isNaN(d) ? String(dv || "") : d.toISOString().slice(0, 10);
        if (!iso) return;
        const rt = (
          this._getField(r, [
            "routeType",
            "RouteType",
            "type",
            "route type",
            "Route Type",
          ]) || ""
        ).toString();
        const fType = /recovery/i.test(rt)
          ? "recovery"
          : /delivery/i.test(rt)
          ? "spfm-delivery"
          : "spfm";
        const mktRaw = this._getField(r, [
          "market",
          "Market",
          "location",
          "Location",
        ]);
        const marketNorm = this._normStr(mktRaw);
        const marketEmpty = !marketNorm;
        const list = overridesByDate.get(iso) || [];
        list.push({ type: fType, marketNorm, marketEmpty });
        overridesByDate.set(iso, list);
      });

      // 3) Push dated rows as-is (custom overrides)
      datedRows.forEach((r) => {
        // Skip routes if routeID is empty
        const routeId = this._getField(r, [
          "routeID",
          "routeId",
          "RouteID",
          "route_id",
          "id",
          "ID",
        ]);
        if (!routeId || routeId.toString().trim() === "") {
          return; // Skip this route if no routeID
        }

        // Debug: Check for Woodbury in dated rows
        const market = this._getField(r, [
          "market",
          "Market",
          "location",
          "Location",
        ]);
        const date = this._getField(r, ["date", "Date", "DATE"]);
        if (market && market.toLowerCase().includes("woodbury")) {
          console.log("[DEBUG] Found Woodbury in DATED row:", {
            date: date,
            market: market,
            routeId: routeId,
            isAug17:
              date === "2025-08-17" ||
              date === "8/17/2025" ||
              date === "17/8/2025",
            rawRow: r,
          });
        }

        const rt = (
          this._getField(r, [
            "routeType",
            "RouteType",
            "type",
            "route type",
            "Route Type",
          ]) || ""
        ).toString();
        const fType = /recovery/i.test(rt)
          ? "recovery"
          : /delivery/i.test(rt)
          ? "spfm-delivery"
          : "spfm";
        routes.push(this._normalizeRoute(r, fType));
      });

      // 4) Expand periodic rows into occurrences, skipping those that match overrides by (date,type,market)
      periodicRows.forEach((r) => {
        // Skip routes if routeID is empty
        const routeId = this._getField(r, [
          "routeID",
          "routeId",
          "RouteID",
          "route_id",
          "id",
          "ID",
        ]);
        if (!routeId || routeId.toString().trim() === "") {
          return; // Skip this route if no routeID
        }

        const rt = (
          this._getField(r, [
            "routeType",
            "RouteType",
            "type",
            "route type",
            "Route Type",
          ]) || ""
        ).toString();
        const fType = /recovery/i.test(rt)
          ? "recovery"
          : /delivery/i.test(rt)
          ? "spfm-delivery"
          : "spfm";
        const weekday = this._getField(r, [
          "Weekday",
          "weekday",
          "DAY",
          "dayName",
          "Day",
          "day",
        ]);
        const market = this._getField(r, [
          "market",
          "Market",
          "location",
          "Location",
        ]);
        if (!weekday) return;

        // Debug: Filter out any dates that fall on Sunday (day 0)
        if (market && market.toLowerCase().includes("woodbury")) {
          console.log(
            "[DEBUG] Processing Woodbury route for weekday:",
            weekday
          );
        }

        const occurrences = this._generateNextOccurrences(String(weekday), 8);
        occurrences.forEach((d) => {
          // Skip Sunday route generation - Sundays come from SPFM sheet only
          if (weekday.toLowerCase() === "sunday" && d.getDay() === 0) {
            console.log(
              `[Sunday Skip] Skipping Sunday ${d.toDateString()} - using SPFM sheet instead of Routes template`
            );
            return; // Skip Sunday route generation entirely
          }

          // For Monday routes, only create routes that have a linked Sunday SPFM route
          if (weekday.toLowerCase() === "monday" && d.getDay() === 1) {
            const sundayDate = new Date(d);
            sundayDate.setDate(d.getDate() - 1); // Previous day (Sunday)
            const sundayIso = sundayDate.toISOString().slice(0, 10);

            // RouteId mapping: Sunday routeId → Monday routeId
            const sundayToMondayMapping = {
              1: "6",
              2: "5",
              3: "7",
            };

            // Get the current Monday route's routeId
            const mondayRouteId = this._getField(r, [
              "routeID",
              "routeId",
              "RouteID",
              "route_id",
              "id",
              "ID",
            ]);

            // Find the corresponding Sunday routeId for this Monday route
            let correspondingSundayRouteId = null;
            for (const [sundayId, mondayId] of Object.entries(
              sundayToMondayMapping
            )) {
              if (mondayId === String(mondayRouteId)) {
                correspondingSundayRouteId = sundayId;
                break;
              }
            }

            // Only proceed if we have a mapping and can find the Sunday route
            if (!correspondingSundayRouteId) {
              console.log(
                `[RouteId Skip] Monday routeId=${mondayRouteId} has no Sunday mapping - skipping`
              );
              return; // Skip this Monday route entirely
            }

            console.log(
              `[RouteId Link] Monday routeId=${mondayRouteId} should link to Sunday routeId=${correspondingSundayRouteId}`
            );

            // Look for Sunday SPFM route with the corresponding routeId
            let sundayRoute = null;
            if (Array.isArray(sheetsAPI.data)) {
              for (const spfmRow of sheetsAPI.data) {
                const spfmDate = this._getField(spfmRow, [
                  "date",
                  "Date",
                  "DATE",
                ]);
                const spfmRouteId = this._getField(spfmRow, [
                  "routeID",
                  "routeId",
                  "RouteID",
                  "route_id",
                  "id",
                  "ID",
                ]);

                // Skip if no routeID
                if (!spfmRouteId || spfmRouteId.toString().trim() === "")
                  continue;

                // Check if this SPFM row matches Sunday date and routeId
                let spfmDateObj;
                if (spfmDate instanceof Date) {
                  spfmDateObj = spfmDate;
                } else {
                  spfmDateObj = new Date(spfmDate);
                }

                if (
                  !isNaN(spfmDateObj) &&
                  spfmDateObj.toISOString().slice(0, 10) === sundayIso &&
                  String(spfmRouteId) === correspondingSundayRouteId
                ) {
                  sundayRoute = spfmRow;
                  console.log(
                    `[RouteId Link] Found Sunday ${sundayIso} routeId=${spfmRouteId} for Monday ${d.toDateString()} routeId=${mondayRouteId}`
                  );
                  break;
                }
              }
            }

            // If no Sunday route found, skip this Monday route entirely
            if (!sundayRoute) {
              console.log(
                `[RouteId Skip] No Sunday routeId=${correspondingSundayRouteId} found for Monday ${d.toDateString()} routeId=${mondayRouteId} - skipping`
              );
              return; // Skip this Monday route entirely
            }

            // Create the linked Monday route with Sunday market data
            const sundayMarket = this._getField(sundayRoute, [
              "market",
              "Market",
              "location",
              "Location",
            ]);
            const routeToNormalize = { ...r };
            if (sundayMarket) {
              routeToNormalize.market = sundayMarket;
              routeToNormalize.Market = sundayMarket;
            }
            // Mark as SPFM Delivery route
            routeToNormalize.routeType = "SPFM Delivery";
            routeToNormalize.type = "spfm-delivery";
            console.log(
              `[RouteId Link] Creating Monday ${d.toDateString()} routeId=${mondayRouteId} linked to Sunday routeId=${correspondingSundayRouteId} market="${sundayMarket}" as SPFM Delivery`
            );

            // Generate the route with linked data
            const iso = d.toISOString().slice(0, 10);
            const overrides = overridesByDate.get(iso) || [];
            if (overrides.length) {
              const pMarketNorm = this._normStr(
                this._getField(routeToNormalize, [
                  "market",
                  "Market",
                  "location",
                  "Location",
                ])
              );
              const skip = overrides.some((o) => {
                if (o.type !== "spfm-delivery") return false;
                if (o.type === "recovery" && o.marketEmpty) return true;
                return o.marketNorm === pMarketNorm;
              });
              if (skip) return;
            }
            const clone = { ...routeToNormalize, date: iso, sortDate: d };
            routes.push(this._normalizeRoute(clone, "spfm-delivery"));
            return; // Exit early for Monday routes
          }

          // For non-Monday routes, proceed with normal processing
          let routeToNormalize = r;

          // Debug: Log all generated dates for Woodbury route
          if (market && market.toLowerCase().includes("woodbury")) {
            console.log("[DEBUG] Generated date for Woodbury route:", {
              iso: d.toISOString().slice(0, 10),
              dayOfWeek: d.getDay(),
              dateString: d.toDateString(),
              weekday: weekday,
              isAug17: d.toISOString().slice(0, 10) === "2025-08-17",
            });
          }

          // Safety check: Skip any Sunday dates (day 0) that shouldn't be generated
          if (d.getDay() === 0 && weekday.toLowerCase() !== "sunday") {
            console.warn(
              "[FILTER] Skipping Sunday date generated from",
              weekday,
              "template:",
              d.toDateString(),
              "Market:",
              market
            );
            return;
          }

          const iso = d.toISOString().slice(0, 10);
          const overrides = overridesByDate.get(iso) || [];
          if (overrides.length) {
            const pMarketNorm = this._normStr(
              this._getField(routeToNormalize, [
                "market",
                "Market",
                "location",
                "Location",
              ])
            );
            const skip = overrides.some((o) => {
              if (o.type !== fType) return false;
              // Recovery special-case: blank market overrides all recovery routes that day
              if (o.type === "recovery" && o.marketEmpty) return true;
              // Otherwise require market match
              return o.marketNorm === pMarketNorm;
            });
            if (skip) return;
          }
          const clone = { ...routeToNormalize, date: iso, sortDate: d };
          routes.push(this._normalizeRoute(clone, fType));
        });
      });

      // 5) Any other rows, include normalized (rare)
      otherRows.forEach((r) => {
        const rt = (
          this._getField(r, [
            "routeType",
            "RouteType",
            "type",
            "route type",
            "Route Type",
          ]) || ""
        ).toString();
        const fType = /recovery/i.test(rt)
          ? "recovery"
          : /delivery/i.test(rt)
          ? "spfm-delivery"
          : "spfm";
        routes.push(this._normalizeRoute(r, fType));
      });
    }

    console.debug("[DataService] Normalized routes:", routes.length);
    this.routes = routes;
    this._routesCacheKey = cacheKey;
    this._routesCache = [...routes];
    // Persist normalized result for fast subsequent queries
    try {
      await localStore.putCache("normalizedRoutes", routes);
      await localStore.setMeta("dataSignature", cacheKey);
    } catch {}
    return [...routes];
  }

  // Alias used by some controllers
  async getAllRoutes() {
    return this.getRoutes();
  }

  /**
   * Derive workers assigned to a route using the canonical sheets API helper.
   */
  getWorkersFromRoute(route) {
    if (!route) return [];
    try {
      return sheetsAPI.getAllWorkersFromRoute(route) || [];
    } catch (e) {
      console.error("getWorkersFromRoute failed:", e);
      return [];
    }
  }

  /**
   * Volunteers from a route (if any)
   */
  getVolunteersFromRoute(route) {
    if (!route) return [];
    try {
      return sheetsAPI.getAllVolunteers(route) || [];
    } catch (e) {
      console.error("getVolunteersFromRoute failed:", e);
      return [];
    }
  }

  /**
   * Vans from a route (if any)
   */
  getVansFromRoute(route) {
    if (!route) return [];
    try {
      return sheetsAPI.getAllVans(route) || [];
    } catch (e) {
      console.error("getVansFromRoute failed:", e);
      return [];
    }
  }

  // Vehicle emoji helper for components
  getVehicleEmoji(name) {
    try {
      return sheetsAPI.getVehicleEmoji?.(name) || "🚐";
    } catch {
      return "🚐";
    }
  }

  // Address/contacts lookup for a given location name
  getAddressForLocation(name) {
    try {
      return sheetsAPI.getAddressFromContacts?.(name) || null;
    } catch {
      return null;
    }
  }

  // ========================================
  // REMINDERS METHODS
  // ========================================

  /**
   * Return reminder buckets for a route context.
   * Normalizes case variants so consumers can read either camelCase or lowercase keys.
   * { dropoff:[], atoffice:[], backatoffice:[], atmarket:[], materials_office:[], materials_storage:[], backAtOffice:[], atMarket:[] }
   */
  async getRemindersForRoute(routeOrKey) {
    try {
      await this._ensureApiLoaded();
      const res =
        typeof sheetsAPI.getRemindersForRoute === "function"
          ? sheetsAPI.getRemindersForRoute(routeOrKey)
          : null;
      if (!res)
        return {
          dropoff: [],
          atoffice: [],
          backatoffice: [],
          atmarket: [],
          materials_office: [],
          materials_storage: [],
          backAtOffice: [],
          atMarket: [],
        };
      const out = {
        dropoff: Array.isArray(res.dropoff) ? res.dropoff : [],
        atoffice: Array.isArray(res.atoffice) ? res.atoffice : [],
        backatoffice: Array.isArray(res.backatoffice)
          ? res.backatoffice
          : Array.isArray(res.backAtOffice)
          ? res.backAtOffice
          : [],
        atmarket: Array.isArray(res.atmarket)
          ? res.atmarket
          : Array.isArray(res.atMarket)
          ? res.atMarket
          : [],
        materials_office: Array.isArray(res.materials_office)
          ? res.materials_office
          : [],
        materials_storage: Array.isArray(res.materials_storage)
          ? res.materials_storage
          : [],
      };
      // Provide camelCase aliases for convenience
      out.backAtOffice = out.backatoffice;
      out.atMarket = out.atmarket;
      return out;
    } catch (e) {
      console.warn("getRemindersForRoute failed:", e);
      return {
        dropoff: [],
        atoffice: [],
        backatoffice: [],
        atmarket: [],
        materials_office: [],
        materials_storage: [],
        backAtOffice: [],
        atMarket: [],
      };
    }
  }

  /**
   * Return all parsed reminders rows for debugging or admin pages.
   */
  async getAllReminders() {
    try {
      await this._ensureApiLoaded();
      return Array.isArray(sheetsAPI.miscReminders)
        ? [...sheetsAPI.miscReminders]
        : [];
    } catch {
      return [];
    }
  }

  // ========================================
  // NORMALIZATION HELPERS
  // ========================================

  _normalizeRoute(raw, fallbackType = "spfm") {
    const rawType =
      this._getField(raw, [
        "type",
        "routeType",
        "route type",
        "RouteType",
        "Route Type",
      ]) ||
      fallbackType ||
      "spfm";
    let type = rawType;
    try {
      const t = (rawType || "").toString();
      if (/recovery/i.test(t)) type = "recovery";
      else if (/delivery/i.test(t)) type = "spfm-delivery";
      else type = "spfm";
    } catch {}
    const dateVal =
      this._getField(raw, ["date", "Date", "DATE"]) ||
      raw.sortDate ||
      raw.parsed ||
      "";
    const dateObj = dateVal instanceof Date ? dateVal : new Date(dateVal);
    const dateStr =
      dateObj && !isNaN(dateObj)
        ? dateObj.toISOString().slice(0, 10)
        : typeof dateVal === "string"
        ? dateVal
        : "";
    const startTime = this._getField(raw, ["startTime", "Time", "time"]) || "";
    // Do not default market to 'Recovery'—keep empty if absent to avoid UI confusion
    const market =
      this._getField(raw, ["market", "Market", "location", "Location"]) || "";
    const dropOff =
      this._getField(raw, [
        "dropOff",
        "dropoff",
        "drop off",
        "Drop Off",
        "Drop off",
      ]) || "";
    const workers = this.getWorkersFromRoute(raw) || [];
    const volunteers = this.getVolunteersFromRoute(raw) || [];
    const vans = this.getVansFromRoute(raw) || [];
    const officeMaterials = (raw.materials_office || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const storageMaterials = (raw.materials_storage || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const atMarket = (raw.atMarket || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const backAtOffice = (raw.backAtOffice || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Build stops list similar to legacy logic
    const stops = this._extractStops(raw, type, market, dropOff);

    // Build display date
    const displayDate = this._formatDisplayDate(dateVal);

    // id - create a more robust ID by filtering out empty values
    const idParts = [type, dateStr, startTime, market, dropOff].filter(
      (p) => p && p.toString().trim()
    );
    const id = raw._routeId || idParts.join("|");

    // Contacts for convenience
    const contactFor = (name) => {
      if (!name) return null;
      try {
        return sheetsAPI.getAddressFromContacts(name) || null;
      } catch {
        return null;
      }
    };

    return {
      ...raw,
      id,
      type,
      date: dateStr,
      displayDate,
      sortDate: dateObj && !isNaN(dateObj) ? dateObj : null,
      startTime,
      market,
      dropOff,
      workers,
      volunteers,
      vans,
      materials: {
        office: officeMaterials,
        storage: storageMaterials,
        atMarket,
        backAtOffice,
      },
      stops: stops.map((s) => ({
        location: s,
        contact: contactFor(s),
      })),
      contacts: sheetsAPI.getAllRouteContacts(raw) || [],
      phones: sheetsAPI.getAllRoutePhones(raw) || [],
    };
  }

  _extractStops(route, type, market, dropOff) {
    const stops = [];
    if (type === "recovery" || type === "spfm-delivery") {
      let i = 1;
      for (;;) {
        const s = route[`stop${i}`] || route[`Stop ${i}`] || route[`stop ${i}`];
        if (!s || !String(s).trim()) break;
        stops.push(String(s).trim());
        i++;
      }
      if (stops.length === 0) {
        if (market) stops.push(String(market).trim());
        if (dropOff) stops.push(String(dropOff).trim());
      }
    } else {
      if (market) stops.push(String(market).trim());
      if (dropOff) stops.push(String(dropOff).trim());
    }
    return stops;
  }

  // ========================================
  // PERIODIC DATES HELPERS
  // ========================================

  _weekdayIndex(name) {
    const n = (name || "").toString().trim().toLowerCase();
    const map = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };
    return map[n] ?? -1;
  }

  async getUpcomingRoutes(limit = 7) {
    // Load API data if needed
    if (true) {
      try {
        await this._ensureApiLoaded();
        if (
          window.assignmentsManager &&
          typeof window.assignmentsManager.getUpcomingRoutes === "function"
        ) {
          this.routes =
            window.assignmentsManager.getUpcomingRoutes(limit) || [];
        }
      } catch (error) {
        console.error("Error loading routes:", error);
        this.routes = [];
      }
    }

    return [...this.routes];
  }

  async getAllDates() {
    if (true) {
      try {
        await this._ensureApiLoaded();
        return [];
      } catch (error) {
        console.error("Error loading dates:", error);
        return [];
      }
    }
    return [];
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  // Retrieve a value from an object by trying multiple aliases and tolerant key matching
  _getField(obj, aliases = []) {
    if (!obj || typeof obj !== "object") return undefined;
    // Direct exact match first
    for (const a of aliases) {
      if (a in obj && obj[a] !== undefined && obj[a] !== "") return obj[a];
    }
    // Case-insensitive, space/underscore-insensitive matching
    const norm = (s) =>
      (s || "")
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    const keyMap = {};
    Object.keys(obj).forEach((k) => {
      keyMap[norm(k)] = k;
    });
    for (const a of aliases) {
      const nk = keyMap[norm(a)];
      if (nk && obj[nk] !== undefined && obj[nk] !== "") return obj[nk];
    }
    return undefined;
  }

  // Normalize strings for comparison (case-insensitive, trimmed)
  _normStr(s) {
    return (s == null ? "" : String(s)).trim().toLowerCase();
  }

  async loadApiData(force = false) {
    await localStore.init();
    if (this.isLoading) return;

    this.isLoading = true;
    this.dispatchEvent(new CustomEvent("loading-started"));

    try {
      if (true) {
        await this._ensureApiLoaded(force);
        // After sheets load, capture raw tables and caches in IndexedDB for unified access
        try {
          const s = sheetsAPI || {};
          const sig = this._makeSignature();
          await localStore.putTable("SPFM", s.data || []);
          await localStore.putTable("Routes", s.routesData || []);
          await localStore.putTable("Recovery", s.recoveryData || []);
          await localStore.putTable("SPFM_Delivery", s.deliveryData || []);
          await localStore.putTable("Status", s.inventoryData || []);
          await localStore.putTable("Contacts", s.contactsData || []);
          await localStore.putTable("Misc_Workers", s.miscWorkers || []);
          await localStore.putTable("Misc_Vehicles", s.miscVehicles || []);
          // Precompute workers list and normalized routes for quick lookups
          const workers =
            typeof s.getAllWorkers === "function" ? s.getAllWorkers() : [];
          await localStore.putCache("workersList", workers);
          // Normalize routes via existing method to keep logic centralized
          const normalized = await this.getRoutes();
          await localStore.putCache("normalizedRoutes", normalized);
          await localStore.setMeta("dataSignature", sig);
        } catch (e) {
          console.warn("LocalStore population skipped:", e);
        }
        this.dispatchEvent(new CustomEvent("data-loaded"));
        // Begin version polling to auto-refresh when Sheets change (faster during dev)
        try {
          sheetsAPI.startVersionPolling(20000);
        } catch {}
      }
    } catch (error) {
      console.error("Error loading API data:", error);
      this.dispatchEvent(new CustomEvent("data-error", { detail: error }));
    } finally {
      this.isLoading = false;
      this.dispatchEvent(new CustomEvent("loading-finished"));
    }
  }

  isApiDataLoaded() {
    return sheetsAPI && sheetsAPI.data && sheetsAPI.data.length > 0;
  }

  // ========================================
  // CONFIGURATION
  // ========================================

  getWorkerIcons() {
    try {
      // Build from Misc workers if available
      if (
        sheetsAPI &&
        Array.isArray(sheetsAPI.miscWorkers) &&
        sheetsAPI.miscWorkers.length > 0
      ) {
        const map = {};
        sheetsAPI.miscWorkers.forEach((w) => {
          if (!w || !w.worker) return;
          if (w.emoji) map[w.worker] = w.emoji;
        });
        // Provide default for Volunteer if not specified
        if (!map.Volunteer) map.Volunteer = "👤";
        return map;
      }
    } catch {}
    // Fallback hardcoded defaults
    return {
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
  // DEBUG / DIAGNOSTICS
  // ========================================
  getDebugInfo() {
    try {
      const sig = this._makeSignature();
      const s = sheetsAPI || {};
      const counts = {
        spfm: (s.data || []).length,
        recovery: (s.recoveryData || []).length,
        delivery: (s.deliveryData || []).length,
        routes: (s.routesData || []).length,
        status: (s.inventoryData || []).length,
        contacts: (s.contactsData || []).length,
        workers: (s.miscWorkers || []).length,
        vehicles: (s.miscVehicles || []).length,
        reminders: (s.miscReminders || []).length,
      };
      const sources = s._tableSources ? { ...s._tableSources } : {};
      return {
        lastFetchTs: s.lastFetchTs || 0,
        signature: sig,
        counts,
        sources,
      };
    } catch {
      return { lastFetchTs: 0, signature: "", counts: {}, sources: {} };
    }
  }

  _generateNextOccurrences(dayName, count = 8) {
    const dayMap = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
      sun: 0,
      mon: 1,
      tue: 2,
      wed: 3,
      thu: 4,
      fri: 5,
      sat: 6,
    };

    const targetDay = dayMap[dayName.toLowerCase().trim()];
    if (typeof targetDay !== "number") return [];

    // Use local midnight to avoid timezone issues
    const today = new Date();
    const results = [];
    let current = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );

    // Find the next occurrence of the target day (including today if it matches)
    let daysToAdd = (targetDay - current.getDay() + 7) % 7;
    if (daysToAdd === 0 && current.getTime() <= today.getTime()) {
      daysToAdd = 7; // If it's today but we want future occurrences, go to next week
    }
    current.setDate(current.getDate() + daysToAdd);

    // Generate the specified count of occurrences
    for (let i = 0; i < count; i++) {
      results.push(new Date(current));
      current.setDate(current.getDate() + 7); // Next week
    }

    return results;
  }

  _formatDisplayDate(dateStr) {
    if (!dateStr) return "";
    try {
      // Handle ISO date strings by parsing them as local dates to avoid timezone issues
      let d;
      if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // ISO date format - parse as local date
        const [year, month, day] = dateStr.split("-");
        d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      } else {
        d = new Date(dateStr);
      }

      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  }

  getBoxConfig() {
    return {
      small: {
        label: "small",
        description: "5/9 bushel",
        farmersRatio: 2,
      },
      large: {
        label: "LARGE",
        description: "1 1/9 bushel",
        farmersRatio: 1,
      },
    };
  }
}

// Create singleton instance
window.dataService = window.dataService || new DataService();

export { DataService };
export default window.dataService;
