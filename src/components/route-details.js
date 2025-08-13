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
      const emoji = window.sheetsAPI?.getVehicleEmoji?.(name);
      return emoji || "🚐";
    } catch {
      return "🚐";
    }
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
      const res =
        window.sheetsAPI && window.sheetsAPI.getRemindersForRoute
          ? window.sheetsAPI.getRemindersForRoute(route)
          : null;
      if (Array.isArray(res)) {
        // Backward-compat: older API returned a flat array; treat as dropoff list
        reminderBuckets.dropoff = res;
      } else if (res && typeof res === "object") {
        reminderBuckets = {
          dropoff: Array.isArray(res.dropoff) ? res.dropoff : [],
          atoffice: Array.isArray(res.atoffice) ? res.atoffice : [],
          backatoffice: Array.isArray(res.backatoffice) ? res.backatoffice : [],
          atmarket: Array.isArray(res.atmarket) ? res.atmarket : [],
          materials_office: Array.isArray(res.materials_office)
            ? res.materials_office
            : [],
          materials_storage: Array.isArray(res.materials_storage)
            ? res.materials_storage
            : [],
        };
      }
    } catch {}

    // Create layout sections as variables to avoid nested template literal issues
    // Only show SPFM 3-section layout for routes with routeType = SPFM
    const spfmLayout =
      type === "spfm" && route.routeType === "SPFM"
        ? this.renderSPFMLayout(materials, reminderBuckets, route, stops)
        : "";
    const standardLayout =
      type !== "spfm" || route.routeType !== "SPFM"
        ? this.renderStandardLayout(materials, reminderBuckets, route, stops)
        : "";

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
        .two-col { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .checklist label { display:block; margin:6px 0; font-size:0.9rem; color:#333; }
        .subtle { color:#999; font-style: italic; }
        .three-sections { display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
        .task-section { padding:12px; border:1px solid #eee; border-radius:6px; background:#fafafa; }
        @media (max-width: 768px) {
          .three-sections { grid-template-columns: 1fr; gap: 12px; }
        }
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

        ${spfmLayout}
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

  renderSPFMLayout(materials, reminderBuckets, route, stops) {
    return `
      <!-- 3-Section Layout Box for SPFM routes only -->
      <div class="section">
        <div class="three-sections">
          <!-- Section 1: At Office (with materials and reminders) -->
          <div class="task-section">
            <div class="label" style="color:#17a2b8; font-weight:600; margin-bottom:8px;">&#128193; At Office</div>

            <!-- Materials from Reminders table (office + storage) -->
            <div class="two-col">
              <div class="checklist">
                <div class="label" style="color:#17a2b8; font-size:0.8rem; margin-bottom:6px;">&#128193; Office Materials</div>
                ${
                  reminderBuckets.materials_office.length
                    ? reminderBuckets.materials_office
                        .map(
                          (i) => `<label><input type="checkbox" /> ${i}</label>`
                        )
                        .join("")
                    : `<div class="subtle">No office materials listed (add to Misc sheet 'materials_office' column)</div>`
                }
              </div>
              <div class="checklist">
                <div class="label" style="color:#17a2b8; font-size:0.8rem; margin-bottom:6px;">&#128230; Storage Materials</div>
                ${
                  reminderBuckets.materials_storage.length
                    ? reminderBuckets.materials_storage
                        .map(
                          (i) => `<label><input type="checkbox" /> ${i}</label>`
                        )
                        .join("")
                    : `<div class="subtle">No storage materials listed (add to Misc sheet 'materials_storage' column)</div>`
                }
              </div>
            </div>
          </div>

          <!-- Section 2: At Market -->
          <div class="task-section">
            <div class="label" style="color:#28a745; font-weight:600; margin-bottom:8px;">&#127978; At Market</div>

            <!-- Location info -->
            ${(() => {
              const name =
                route.market && route.market.toLowerCase() !== "recovery"
                  ? route.market
                  : stops[0]?.location || "";
              return name
                ? `
              <div style="margin-bottom:8px;">
                ${this.renderAddressButton(name)}
                ${this.renderPhoneButtons(name)}
              </div>
            `
                : "";
            })()}

            <!-- Items from Misc sheet atmarket column -->
            <div class="checklist">
              ${
                reminderBuckets.atmarket.length
                  ? reminderBuckets.atmarket
                      .map(
                        (i) => `<label><input type="checkbox" /> ${i}</label>`
                      )
                      .join("")
                  : `<div class="subtle">No items listed (add to Misc sheet 'atmarket' column)</div>`
              }
            </div>

            <!-- Dropoff info (included in market section) -->
            ${(() => {
              const name =
                route.dropOff ||
                (stops.length > 1 ? stops[stops.length - 1]?.location : "");
              return name && name !== (route.market || stops[0]?.location || "")
                ? `
              <div style="margin-top:12px; padding-top:8px; border-top:1px solid #eee;">
                <div class="label" style="font-size:0.85rem; color:#666; margin-bottom:4px;">Dropoff</div>
                ${this.renderAddressButton(name)}
                ${this.renderPhoneButtons(name)}
                ${
                  reminderBuckets.dropoff.length
                    ? `
                  <div class="checklist" style="margin-top:4px;">
                    ${reminderBuckets.dropoff
                      .map(
                        (i) => `<label><input type="checkbox" /> ${i}</label>`
                      )
                      .join("")}
                  </div>
                `
                    : ""
                }
              </div>
            `
                : "";
            })()}
          </div>

          <!-- Section 3: Back At Office -->
          <div class="task-section">
            <div class="label" style="color:#dc3545; font-weight:600; margin-bottom:8px;">&#8617; Back At Office</div>

            <!-- Items from Misc sheet backatoffice column -->
            <div class="checklist">
              ${
                reminderBuckets.backatoffice.length
                  ? reminderBuckets.backatoffice
                      .map(
                        (i) => `<label><input type="checkbox" /> ${i}</label>`
                      )
                      .join("")
                  : `<div class="subtle">No items listed (add to Misc sheet 'backatoffice' column)</div>`
              }
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderStandardLayout(materials, reminderBuckets, route, stops) {
    return `
      <!-- Original layout for non-SPFM routes -->
      <div class="section">
        <div class="label">At Market</div>
        ${(() => {
          const name =
            route.market && route.market.toLowerCase() !== "recovery"
              ? route.market
              : stops[0]?.location || "";
          return name ? this.renderAddressButton(name) : "";
        })()}
        ${(() => {
          const name =
            route.market && route.market.toLowerCase() !== "recovery"
              ? route.market
              : stops[0]?.location || "";
          return this.renderPhoneButtons(name);
        })()}
        <div class="checklist" style="margin-top:8px;">
          ${
            reminderBuckets.atmarket
              .map((i) => `<label><input type="checkbox" /> ${i}</label>`)
              .join("") || `<div class="subtle">No items listed</div>`
          }
        </div>
      </div>
      <div class="section">
        <div class="label">Dropoff</div>
        ${(() => {
          const name =
            route.dropOff ||
            (stops.length > 1 ? stops[stops.length - 1]?.location : "");
          return name
            ? this.renderAddressButton(name)
            : `<div class="subtle">No dropoff location specified</div>`;
        })()}
        ${(() => {
          const name =
            route.dropOff ||
            (stops.length > 1 ? stops[stops.length - 1]?.location : "");
          return this.renderPhoneButtons(name);
        })()}
        <div class="checklist" style="margin-top:8px;">
          ${
            reminderBuckets.dropoff
              .map((i) => `<label><input type="checkbox" /> ${i}</label>`)
              .join("") || `<div class="subtle">No items listed</div>`
          }
        </div>
      </div>
      <div class="section">
        <div class="label">At Office</div>
        <div class="checklist">
          ${
            reminderBuckets.atoffice
              .map((i) => `<label><input type="checkbox" /> ${i}</label>`)
              .join("") || `<div class="subtle">No items listed</div>`
          }
        </div>
      </div>
      <div class="section">
        <div class="label">Back at Office</div>
        <div class="checklist">
          ${
            reminderBuckets.backatoffice
              .map((i) => `<label><input type="checkbox" /> ${i}</label>`)
              .join("") || `<div class="subtle">No items listed</div>`
          }
        </div>
      </div>
    `;
  }

  renderAddressButton(location) {
    if (!location) return "";
    try {
      const contact = window.sheetsAPI?.getAddressFromContacts?.(location);
      const address = contact && contact.address ? contact.address : location;
      const link = `https://maps.google.com/maps?q=${encodeURIComponent(
        address
      )}`;
      return `<button class="btn" onclick="window.open('${link}', '_blank')">📍 ${address}</button>`;
    } catch {
      const link = `https://maps.google.com/maps?q=${encodeURIComponent(
        location
      )}`;
      return `<button class="btn" onclick="window.open('${link}', '_blank')">📍 ${location}</button>`;
    }
  }

  renderPhoneButtons(location) {
    if (!location) return "";
    try {
      const contact = window.sheetsAPI?.getAddressFromContacts?.(location);
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
