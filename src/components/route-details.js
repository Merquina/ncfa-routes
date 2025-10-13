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
      if (!dateStr) return "No date";
      const d = new Date(dateStr);
      // Check if the date is valid
      if (isNaN(d.getTime())) {
        return String(dateStr);
      }
      return d.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      });
    } catch {
      return String(dateStr || "No date");
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

  renderBoxesSection(route) {
    if (!route || route.type !== "spfm") return "";

    const boxesLarge = this.getField(route, [
      "boxesLARGE",
      "boxesLarge",
      "large",
      "Large",
    ]);
    const boxesSmall = this.getField(route, [
      "boxesSMALL",
      "boxesSmall",
      "small",
      "Small",
    ]);

    // Only show section if we have box data
    if (!boxesLarge && !boxesSmall) return "";

    const chips = [];
    if (boxesLarge) {
      chips.push(
        `<span class="chip" style="background: #e3f2fd;"><i class="mdi mdi-package-variant" style="margin-right: 4px;"></i>Large: ${boxesLarge}</span>`
      );
    }
    if (boxesSmall) {
      chips.push(
        `<span class="chip" style="background: #f3e5f5;"><i class="mdi mdi-package" style="margin-right: 4px;"></i>Small: ${boxesSmall}</span>`
      );
    }

    return `
      <div class="section">
        <div class="label">Boxes</div>
        <div class="chips">${chips.join("")}</div>
      </div>
    `;
  }

  getField(obj, aliases = []) {
    if (!obj || typeof obj !== "object") return undefined;
    for (const alias of aliases) {
      if (alias in obj && obj[alias] !== undefined && obj[alias] !== "") {
        return obj[alias];
      }
    }
    return undefined;
  }

  async render() {
    const route = this._route;
    if (!route) {
      this.shadowRoot.innerHTML = `<div style="padding:12px;color:#666;">No route selected</div>`;
      return;
    }

    const type = route.type || "spfm";
    const titleEmoji =
      type === "recovery"
        ? "<i class='mdi mdi-shopping-cart'></i>"
        : type === "spfm-delivery"
        ? "<i class='mdi mdi-truck'></i>"
        : "<i class='mdi mdi-account-hard-hat'></i>";
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
        :host {
          display: block;
          font-family: var(--font-family, 'OpenDyslexic', 'Comic Sans MS', 'Trebuchet MS', 'Verdana', 'Arial', sans-serif);
          font-size: var(--font-size-base, 1rem);
          line-height: var(--line-height, 1.5);
          letter-spacing: var(--letter-spacing, 0.025em);
        }
        .container { background:#fff; border:1px solid #ddd; border-radius:8px; overflow:hidden; }
        .header { padding:16px; border-bottom:1px solid #eee; }
        .title {
          margin:0 0 6px 0;
          color:#333;
          font-size: var(--font-size-large, 1.25rem);
          font-weight: 600;
          font-family: var(--font-family, 'OpenDyslexic', 'Comic Sans MS', 'Trebuchet MS', 'Verdana', 'Arial', sans-serif);
        }
        .meta {
          color:#666;
          font-size: var(--font-size-base, 1rem);
          font-family: var(--font-family, 'OpenDyslexic', 'Comic Sans MS', 'Trebuchet MS', 'Verdana', 'Arial', sans-serif);
        }
        .section { padding:16px; border-top:1px solid #f1f1f1; }
        .label {
          color:#666;
          font-weight:600;
          font-size: var(--font-size-base, 1rem);
          font-family: var(--font-family, 'OpenDyslexic', 'Comic Sans MS', 'Trebuchet MS', 'Verdana', 'Arial', sans-serif);
        }
        .chips { display:flex; flex-wrap:wrap; gap:6px; margin-top:6px; }
        .chip {
          background:#f0f0f0;
          border-radius:12px;
          padding:6px 10px;
          font-size: var(--font-size-small, 0.875rem);
          font-family: var(--font-family, 'OpenDyslexic', 'Comic Sans MS', 'Trebuchet MS', 'Verdana', 'Arial', sans-serif);
          font-weight: 500;
        }
        .stop {
          padding:12px;
          border:1px solid #eee;
          border-radius:6px;
          margin:8px 0;
          font-family: var(--font-family, 'OpenDyslexic', 'Comic Sans MS', 'Trebuchet MS', 'Verdana', 'Arial', sans-serif);
        }
        .btn {
          background:#3182ce;
          color:#fff;
          border:none;
          padding:10px 16px;
          border-radius:6px;
          cursor:pointer;
          font-size: var(--font-size-base, 1rem);
          font-weight: 600;
          font-family: var(--font-family, 'OpenDyslexic', 'Comic Sans MS', 'Trebuchet MS', 'Verdana', 'Arial', sans-serif);
          letter-spacing: var(--letter-spacing, 0.025em);
          transition: background 0.2s ease;
        }
        .btn:hover { background:#2c5282; }
        .btn:disabled { opacity:0.6; cursor:default; }
      </style>
      <div class="container">
        <div class="header">
          <h3 class="title">${titleEmoji} ${
      route.market || route.route || "Route"
    } - ${title}</h3>
          <div class="meta">${this.formatDate(
            route.displayDate || route.date
          )} · ${route.startTime || route.Time || "TBD"}${
      route.Job || route.job
        ? ` · <strong>${route.Job || route.job}</strong>`
        : ""
    }</div>
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
        ${this.renderBoxesSection(route)}
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
                ${this.renderPhoneNumbers(s.location)}
                ${this.renderContactInfo(s.location)}
                <div style="margin-top:8px;">
                  ${this.renderAddressButton(s.location)}
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

  renderPhoneNumbers(location) {
    if (!location) return "";
    try {
      console.log("renderPhoneNumbers - location:", location);
      console.log(
        "renderPhoneNumbers - window.sheetsAPI exists:",
        !!window.sheetsAPI
      );

      const contact = window.sheetsAPI?.getAddressFromContacts?.(location);
      console.log("renderPhoneNumbers - contact found:", !!contact, contact);

      if (!contact) return "";

      // Get all contacts and phones using helper methods
      const contacts = window.sheetsAPI?.getAllContacts?.(contact) || [];
      const phones = window.sheetsAPI?.getAllPhones?.(contact) || [];

      console.log("renderPhoneNumbers - contacts:", contacts);
      console.log("renderPhoneNumbers - phones:", phones);

      if (contacts.length === 0 && phones.length === 0) return "";

      const rows = [];
      for (let i = 0; i < Math.max(contacts.length, phones.length); i++) {
        const contactName =
          contacts[i] || (phones[i] ? `Contact ${i + 1}` : null);
        const phone = phones[i];

        // Only show row if we have a contact name or a phone number
        if (contactName || phone) {
          rows.push(`
            <div style="margin-bottom: 4px;">
              <i class="mdi mdi-account" style="color:#666;"></i>
              ${contactName ? `<strong>${contactName}</strong>` : ""}
              ${
                phone
                  ? `<a href="tel:${phone}" style="color:#3182ce;text-decoration:none;margin-left:8px;font-weight:500;"><i class="mdi mdi-phone"></i> ${phone}</a>`
                  : `${
                      contactName && !phone
                        ? '<span style="color:#999;margin-left:8px;font-style:italic;">(no phone)</span>'
                        : ""
                    }`
              }
            </div>
          `);
        }
      }

      console.log("renderPhoneNumbers - rows generated:", rows.length);
      return `<div style="margin-top:8px;">${rows.join("")}</div>`;
    } catch (e) {
      console.error("Error rendering phone numbers:", e);
    }
    return "";
  }

  renderContactInfo(location) {
    if (!location) return "";
    try {
      console.log("renderContactInfo - location:", location);
      console.log(
        "renderContactInfo - window.sheetsAPI exists:",
        !!window.sheetsAPI
      );
      console.log(
        "renderContactInfo - contactsData:",
        window.sheetsAPI?.contactsData
      );
      const contact = window.sheetsAPI?.getAddressFromContacts?.(location);
      console.log("renderContactInfo - contact:", contact);
      console.log("renderContactInfo - notes:", contact?.notes);

      if (contact && contact.notes && contact.notes.trim()) {
        return `<div class="contact-notes" style="margin-top:12px; padding:12px; background:#f8f9fa; border-radius:6px; border-left:4px solid #007bff;">
          <div style="font-weight:700; color:#000; margin-bottom:6px; font-size:0.95rem;">
            <i class="mdi mdi-note-text"></i> Notes / Special Instructions:
          </div>
          <div style="color:#000; font-size:0.9rem; line-height:1.6;">${contact.notes.trim()}</div>
        </div>`;
      }
    } catch (e) {
      console.error("Error rendering contact info:", e);
    }
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
