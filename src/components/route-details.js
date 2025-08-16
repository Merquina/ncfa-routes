class RouteDetails extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._route = null;
  }

  static get observedAttributes() {
    return ["route"];
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === "route" && oldVal !== newVal) {
      try {
        this._route = JSON.parse(newVal || "null");
      } catch {
        this._route = null;
      }
      this.render();
    }
  }

  connectedCallback() {
    this.render();
  }

  setRoute(route) {
    this._route = route || null;
    this.setAttribute("route", JSON.stringify(route || null));
  }

  formatDate(dateStr) {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return String(dateStr || "");
    }
  }

  getWorkerEmoji(name) {
    const icons =
      window.dataService &&
      typeof window.dataService.getWorkerIcons === "function"
        ? window.dataService.getWorkerIcons()
        : {};
    return icons[name] || "👤";
  }

  getVehicleEmoji(name) {
    try {
      if (window.dataService && typeof window.dataService.getVehicleEmoji === 'function') {
        return window.dataService.getVehicleEmoji(name) || '🚐';
      }
    } catch {}
    return '🚐';
  }

  renderWorkers(workers = [], volunteers = [], required = 0) {
    const list = [...workers, ...volunteers]
      .filter(Boolean)
      .map((w) => `${this.getWorkerEmoji(w)} ${w}`);
    const display = [...list];
    while (required && display.length < required)
      display.push(
        '<span style="color:#800020;font-style:italic;">Need worker</span>'
      );
    return display.length
      ? display.join(", ")
      : '<span style="color:#800020;font-style:italic;">No workers assigned</span>';
  }

  render() {
    const route = this._route;
    if (!route) {
      this.shadowRoot.innerHTML = `<div style="padding:12px;color:#666;">No route selected</div>`;
      return;
    }

    const type = route.type || "spfm";
    const titleEmoji =
      type === "recovery" ? "🛒" : type === "spfm-delivery" ? "🚚" : "👨‍🌾";
    const title =
      type === "recovery"
        ? "Recovery Route"
        : type === "spfm-delivery"
        ? "SPFM Delivery"
        : "SPFM Route";
    const workers = route.workers || [];
    const volunteers = route.volunteers || [];
    const vans = route.vans || [];
    const stops = route.stops || [];
    const materials = route.materials || {
      office: [],
      storage: [],
      atMarket: [],
      backAtOffice: [],
    };

    // Pull reminders from Misc sheet (via sheetsAPI), matched by market, dropOff, or type
    let reminderBuckets = {
      dropoff: [],
      atoffice: [],
      backatoffice: [],
      atmarket: [],
      materials_office: [],
      materials_storage: [],
    };
    try {
      const res = (window.dataService && typeof window.dataService.getRemindersForRoute === 'function')
        ? await window.dataService.getRemindersForRoute(route)
        : null;
      if (Array.isArray(res)) {
        // Backward-compat: older API returned a flat array; treat as dropoff list
        reminderBuckets.dropoff = res;
      } else if (res && typeof res === "object") {
        reminderBuckets = {
          dropoff: Array.isArray(res.dropoff) ? res.dropoff : [],
          atoffice: Array.isArray(res.atoffice) ? res.atoffice : [],
          backatoffice: Array.isArray(res.backatoffice) ? res.backatoffice : (Array.isArray(res.backAtOffice) ? res.backAtOffice : []),
          atmarket: Array.isArray(res.atmarket) ? res.atmarket : (Array.isArray(res.atMarket) ? res.atMarket : []),
          materials_office: Array.isArray(res.materials_office)
            ? res.materials_office
            : [],
          materials_storage: Array.isArray(res.materials_storage)
            ? res.materials_storage
            : [],
        };
      }
    } catch {}

    // All routes use standard layout (no special SPFM materials sections)
    const standardLayout = this.renderStandardLayout(
      materials,
      reminderBuckets,
      route,
      stops
    );

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; font-family: var(--body-font, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif); }
        .container { background:#fff; border:1px solid #ddd; border-radius:8px; overflow:hidden; }
        .header { padding:16px; border-bottom:1px solid #eee; }
        .title { margin:0 0 6px 0; color:#333; }
        .meta { color:#666; font-size:0.9rem; }
        .section { padding:16px; border-top:1px solid #f1f1f1; }
        .label { color:#666; font-weight:600; }
        .chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }
        .chip { background:#f0f0f0; border-radius:12px; padding:4px 8px; font-size:0.85rem; }
        .stop { padding:10px; border:1px solid #eee; border-radius:6px; margin:8px 0; }
        .btn { background:#28a745; color:#fff; border:none; padding:8px 12px; border-radius:4px; cursor:pointer; }
        .btn:disabled { opacity:0.6; cursor:default; }
        .subtle { color:#999; font-style: italic; }
      </style>
      <div class="container">
        <div class="header">
          <h3 class="title">${titleEmoji} ${
      route.market || route.route || "Route"
    } - ${title}</h3>
          <div class="meta">${this.formatDate(
            route.displayDate || route.date
          )} · ${route.startTime || route.Time || "TBD"}</div>
          <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn" onclick="window.print()">🖨️ Print</button>
            ${
              stops.length
                ? `<button class="btn" style="background:#6f42c1" onclick="window.open('${this.buildFullRouteUrl(
                    stops
                  )}','_blank')">🗺️ Full route on Google Maps</button>`
                : ""
            }
          </div>
        </div>
        <div class="section">
          <div class="label">Workers</div>
          <div>${this.renderWorkers(
            workers,
            volunteers,
            type === "recovery" ? 1 : 3
          )}</div>
        </div>
        ${
          vans && vans.length
            ? `
          <div class="section">
            <div class="label">Vans</div>
            <div class="chips">${vans
              .map(
                (v) =>
                  `<span class="chip">${this.getVehicleEmoji(v)} ${v}</span>`
              )
              .join("")}</div>
          </div>
        `
            : ""
        }

        ${standardLayout}
        ${
          stops && stops.length
            ? `
          <div class="section">
            <div class="label">Stops (${stops.length})</div>
            ${stops
              .map(
                (s, idx) => `
              <div class="stop">
                <div><strong>${idx + 1} - ${
                  s.location || s.name || "Stop"
                }</strong></div>
                ${s.address ? `<div>${s.address}</div>` : ""}
                <div style="margin-top:6px;">
                  ${this.renderAddressButton(s.location)}
                  ${this.renderPhoneButtons(s.location)}
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        `
            : ""
        }
      </div>
    `;
  }

  renderStandardLayout(materials, reminderBuckets, route, stops) {
    const dropoff = Array.isArray(reminderBuckets.dropoff)
      ? reminderBuckets.dropoff
      : [];
    const atOffice = Array.isArray(reminderBuckets.atoffice)
      ? reminderBuckets.atoffice
      : [];
    // Support both camelCase and snake/lowercase variants
    const backAtOffice = Array.isArray(reminderBuckets.backAtOffice)
      ? reminderBuckets.backAtOffice
      : (Array.isArray(reminderBuckets.backatoffice)
        ? reminderBuckets.backatoffice
        : []);
    const atMarket = Array.isArray(reminderBuckets.atMarket)
      ? reminderBuckets.atMarket
      : (Array.isArray(reminderBuckets.atmarket)
        ? reminderBuckets.atmarket
        : []);
    const materialsOffice = Array.isArray(reminderBuckets.materials_office)
      ? reminderBuckets.materials_office
      : [];
    const materialsStorage = Array.isArray(reminderBuckets.materials_storage)
      ? reminderBuckets.materials_storage
      : [];

    const list = (items) =>
      items && items.length
        ? `<ul style="margin:6px 0 0 18px; padding:0;">${items
            .map((t) => `<li>${String(t)}</li>`) 
            .join("")}</ul>`
        : '<div class="subtle">No items</div>';

    const section = (label, items) => {
      if (!items || items.length === 0) return '';
      return `
        <div class="section">
          <div class="label">${label}</div>
          ${list(items)}
        </div>
      `;
    };

    // Render sections when there is content; keep the page compact otherwise
    return `
      ${section('Drop-off Reminders', dropoff)}
      ${section('At Office – Tasks', atOffice)}
      ${section('Back at Office – Tasks', backAtOffice)}
      ${section('At Market – Tasks', atMarket)}
      ${section('Materials – Office', materialsOffice)}
      ${section('Materials – Storage', materialsStorage)}
    `;
  }

  renderAddressButton(location) {
    if (!location) return "";
    try {
      const contact = (window.dataService && typeof window.dataService.getAddressForLocation === 'function')
        ? window.dataService.getAddressForLocation(location)
        : null;
      const address = contact && contact.address ? contact.address : location;
      const link = `https://maps.google.com/maps?q=${encodeURIComponent(address)}`;
      return `<button class="btn" onclick="window.open('${link}', '_blank')">📍 ${address}</button>`;
    } catch {
      const link = `https://maps.google.com/maps?q=${encodeURIComponent(location)}`;
      return `<button class="btn" onclick="window.open('${link}', '_blank')">📍 ${location}</button>`;
    }
  }

  renderPhoneButtons(location) {
    if (!location) return "";
    try {
      const contact = (window.dataService && typeof window.dataService.getAddressForLocation === 'function')
        ? window.dataService.getAddressForLocation(location)
        : null;
      if (contact && contact.phones && contact.phones.length) {
        return contact.phones
          .map(
            (p) =>
              `<button class="btn" style="background:#007bff;margin-left:6px;" onclick="window.open('tel:${p}','_blank')">📞 ${p}</button>`
          )
          .join("");
      }
    } catch {}
    return "";
  }

  buildFullRouteUrl(stops) {
    try {
      const locs = stops.map((s) => s.address || s.location).filter(Boolean);
      if (locs.length === 0) return "https://maps.google.com/maps";
      if (locs.length === 1)
        return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          locs[0]
        )}`;
      const origin = encodeURIComponent(locs[0]);
      const destination = encodeURIComponent(locs[locs.length - 1]);
      const waypoints = locs.slice(1, -1).map(encodeURIComponent).join("|");
      const base = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
      return waypoints ? `${base}&waypoints=${waypoints}` : base;
    } catch {
      return "https://maps.google.com/maps";
    }
  }
}

if (!customElements.get("route-details")) {
  customElements.define("route-details", RouteDetails);
}

export default RouteDetails;
