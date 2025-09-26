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
      if (
        window.dataService &&
        typeof window.dataService.getVehicleEmoji === "function"
      ) {
        return window.dataService.getVehicleEmoji(name) || "🚐";
      }
    } catch {}
    return "🚐";
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

  async render() {
    const route = this._route;
    if (!route) {
      this.shadowRoot.innerHTML = `<div style="padding:12px;color:#666;">No route selected</div>`;
      return;
    }

    const type = route.type || "spfm";
    const titleEmoji =
      type === "recovery" ? "<i class='mdi mdi-shopping-cart'></i>" : type === "spfm-delivery" ? "<i class='mdi mdi-truck'></i>" : "<i class='mdi mdi-account-hard-hat'></i>";
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
    // Pull dropoff reminders from Misc sheet (via sheetsAPI), matched by market, dropOff, or type
    let reminderBuckets = {
      dropoff: [],
    };
    try {
      const res =
        window.dataService &&
        typeof window.dataService.getRemindersForRoute === "function"
          ? await window.dataService.getRemindersForRoute(route)
          : null;
      if (Array.isArray(res)) {
        // Backward-compat: older API returned a flat array; treat as dropoff list
        reminderBuckets.dropoff = res;
      } else if (res && typeof res === "object") {
        reminderBuckets.dropoff = Array.isArray(res.dropoff) ? res.dropoff : [];
      }
    } catch {}

    // No special layout sections needed anymore

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
            <button class="btn" onclick="window.print()"><i class="mdi mdi-printer"></i> Print</button>
            ${
              stops.length
                ? `<button class="btn" style="background:#6f42c1" onclick="window.open('${this.buildFullRouteUrl(
                    stops
                  )}','_blank')"><i class="mdi mdi-map"></i> Full route on Google Maps</button>`
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
                ${this.renderContactInfo(s.location)}
                <div style="margin-top:8px;">
                  ${this.renderAddressButton(s.location)}
                  ${this.renderPhoneButtons(s.location)}
                </div>
                ${this.renderJobInfo(s.location)}
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

  renderStandardLayout(reminderBuckets, route, stops) {
    const dropoff = Array.isArray(reminderBuckets.dropoff)
      ? reminderBuckets.dropoff
      : [];

    const list = (items) =>
      items && items.length
        ? `<ul style="margin:6px 0 0 18px; padding:0;">${items
            .map((t) => `<li>${String(t)}</li>`)
            .join("")}</ul>`
        : '<div class="subtle">No items</div>';

    const section = (label, items) => {
      if (!items || items.length === 0) return "";
      return `
        <div class="section">
          <div class="label">${label}</div>
          ${list(items)}
        </div>
      `;
    };

    // Render sections when there is content; keep the page compact otherwise
    return `
      ${section("Drop-off Reminders", dropoff)}
    `;
  }

  renderAddressButton(location) {
    if (!location) return "";
    try {
      const contact =
        window.dataService &&
        typeof window.dataService.getAddressForLocation === "function"
          ? window.dataService.getAddressForLocation(location)
          : null;
      const address = contact && contact.address ? contact.address : location;
      const link = `https://maps.google.com/maps?q=${encodeURIComponent(
        address
      )}`;
      return `<button class="btn" onclick="window.open('${link}', '_blank')"><i class="mdi mdi-map-marker"></i> ${address}</button>`;
    } catch {
      const link = `https://maps.google.com/maps?q=${encodeURIComponent(
        location
      )}`;
      return `<button class="btn" onclick="window.open('${link}', '_blank')"><i class="mdi mdi-map-marker"></i> ${location}</button>`;
    }
  }

  renderPhoneButtons(location) {
    if (!location) return "";
    try {
      const contact =
        window.dataService &&
        typeof window.dataService.getAddressForLocation === "function"
          ? window.dataService.getAddressForLocation(location)
          : null;
      if (contact && contact.phones && contact.phones.length) {
        return contact.phones
          .map(
            (p) =>
              `<button class="btn" style="background:#007bff;margin-left:6px;" onclick="window.open('tel:${p}','_blank')"><i class="mdi mdi-phone"></i> ${p}</button>`
          )
          .join("");
      }
    } catch {}
    return "";
  }

  renderContactInfo(location) {
    if (!location) return "";
    try {
      const contact = window.sheetsAPI?.getAddressFromContacts?.(location);
      if (contact) {
        const contactsDisplay = [];

        // Add all contacts (Contact1, Contact2, etc.)
        if (contact.contacts && contact.contacts.length) {
          contactsDisplay.push(...contact.contacts);
        }

        // Add notes if available
        if (contact.notes && contact.notes.trim()) {
          contactsDisplay.push(contact.notes.trim());
        }

        if (contactsDisplay.length > 0) {
          return `<div class="contact-notes" style="margin-top:4px; color:#333; font-size:0.85rem; line-height:1.3;">
            <strong>Notes:</strong> ${contactsDisplay.join(", ")}
          </div>`;
        }
      }
    } catch {}
    return "";
  }

  renderJobInfo(location) {
    if (!location) return "";
    try {
      const contact = window.sheetsAPI?.getAddressFromContacts?.(location);
      if (contact && contact.job && contact.job.trim()) {
        return `<div class="job-info" style="margin-top:6px; color:#666; font-size:0.8rem; font-style:italic;">
          Job: ${contact.job.trim()}
        </div>`;
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
