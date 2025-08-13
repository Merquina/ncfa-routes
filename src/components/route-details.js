class RouteDetails extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._route = null;
  }

  static get observedAttributes() {
    return ['route'];
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (name === 'route' && oldVal !== newVal) {
      try { this._route = JSON.parse(newVal || 'null'); } catch { this._route = null; }
      this.render();
    }
  }

  connectedCallback() {
    this.render();
  }

  setRoute(route) {
    this._route = route || null;
    this.setAttribute('route', JSON.stringify(route || null));
  }

  formatDate(dateStr) {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return String(dateStr || ''); }
  }

  getWorkerEmoji(name) {
    const icons = (window.dataService && typeof window.dataService.getWorkerIcons === 'function')
      ? window.dataService.getWorkerIcons() : {};
    return icons[name] || '👤';
  }

  getVehicleEmoji(name) {
    try {
      const emoji = window.sheetsAPI?.getVehicleEmoji?.(name);
      return emoji || '🚐';
    } catch {
      return '🚐';
    }
  }

  renderWorkers(workers = [], volunteers = [], required = 0) {
    const list = [...workers, ...volunteers].filter(Boolean).map(w => `${this.getWorkerEmoji(w)} ${w}`);
    const display = [...list];
    while (required && display.length < required) display.push('<span style="color:#800020;font-style:italic;">Need worker</span>');
    return display.length ? display.join(', ') : '<span style="color:#800020;font-style:italic;">No workers assigned</span>';
  }

  render() {
    const route = this._route;
    if (!route) {
      this.shadowRoot.innerHTML = `<div style="padding:12px;color:#666;">No route selected</div>`;
      return;
    }

    const type = route.type || 'spfm';
    const titleEmoji = type === 'recovery' ? '🛒' : (type === 'spfm-delivery' ? '🚚' : '👨‍🌾');
    const title = type === 'recovery' ? 'Recovery Route' : (type === 'spfm-delivery' ? 'SPFM Delivery' : 'SPFM Route');
    const workers = route.workers || [];
    const volunteers = route.volunteers || [];
    const vans = route.vans || [];
    const stops = route.stops || [];
    const materials = route.materials || { office: [], storage: [], atMarket: [], backAtOffice: [] };

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
      </style>
      <div class="container">
        <div class="header">
          <h3 class="title">${titleEmoji} ${route.market || route.route || 'Route'} - ${title}</h3>
          <div class="meta">${this.formatDate(route.displayDate || route.date)} · ${route.startTime || route.Time || 'TBD'}</div>
          <div style="margin-top:8px; display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn" onclick="window.print()">🖨️ Print</button>
            ${stops.length ? `<button class="btn" style="background:#6f42c1" onclick="window.open('${this.buildFullRouteUrl(stops)}','_blank')">🗺️ Full route on Google Maps</button>` : ''}
          </div>
        </div>
        <div class="section">
          <div class="label">Workers</div>
          <div>${this.renderWorkers(workers, volunteers, type === 'recovery' ? 1 : 3)}</div>
        </div>
        ${vans && vans.length ? `
          <div class="section">
            <div class="label">Vans</div>
            <div class="chips">${vans.map(v => `<span class="chip">${this.getVehicleEmoji(v)} ${v}</span>`).join('')}</div>
          </div>
        `: ''}
        <div class="section">
          <div class="label">At Market</div>
          ${route.market ? this.renderAddressButton(route.market) : ''}
          ${this.renderPhoneButtons(route.market)}
          <div class="checklist" style="margin-top:8px;">
            ${materials.atMarket.map(i => `<label><input type="checkbox" /> ${i}</label>`).join('') || `<div class="subtle">No items listed</div>`}
          </div>
        </div>
        <div class="section">
          <div class="label">Dropoff</div>
          ${route.dropOff ? this.renderAddressButton(route.dropOff) : `<div class="subtle">No dropoff location specified</div>`}
          ${this.renderPhoneButtons(route.dropOff)}
        </div>
        <div class="section">
          <div class="label">At Office</div>
          <div class="two-col">
            <div class="checklist">
              <div class="label" style="color:#17a2b8;">📁</div>
              ${materials.office.map(i => `<label><input type="checkbox" /> ${i}</label>`).join('') || `<div class="subtle">No items listed</div>`}
            </div>
            <div class="checklist">
              <div class="label" style="color:#17a2b8;">📦</div>
              ${materials.storage.map(i => `<label><input type="checkbox" /> ${i}</label>`).join('') || `<div class="subtle">No items listed</div>`}
            </div>
          </div>
        </div>
        <div class="section">
          <div class="label">Back at Office</div>
          <div class="checklist">
            ${materials.backAtOffice.map(i => `<label><input type="checkbox" /> ${i}</label>`).join('') || `<div class="subtle">No items listed</div>`}
          </div>
        </div>
        ${stops && stops.length ? `
          <div class="section">
            <div class="label">Stops (${stops.length})</div>
            ${stops.map((s, idx) => `
              <div class="stop">
                <div><strong>${idx + 1} - ${s.location || s.name || 'Stop'}</strong></div>
                ${s.address ? `<div>${s.address}</div>` : ''}
                <div style="margin-top:6px;">
                  ${this.renderAddressButton(s.location)}
                  ${this.renderPhoneButtons(s.location)}
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  renderAddressButton(location) {
    if (!location) return '';
    try {
      const contact = window.sheetsAPI?.getAddressFromContacts?.(location);
      const address = (contact && contact.address) ? contact.address : location;
      const link = `https://maps.google.com/maps?q=${encodeURIComponent(address)}`;
      return `<button class="btn" onclick="window.open('${link}', '_blank')">📍 ${address}</button>`;
    } catch {
      const link = `https://maps.google.com/maps?q=${encodeURIComponent(location)}`;
      return `<button class="btn" onclick="window.open('${link}', '_blank')">📍 ${location}</button>`;
    }
  }

  renderPhoneButtons(location) {
    if (!location) return '';
    try {
      const contact = window.sheetsAPI?.getAddressFromContacts?.(location);
      if (contact && contact.phones && contact.phones.length) {
        return contact.phones.map((p) => `<button class="btn" style="background:#007bff;margin-left:6px;" onclick="window.open('tel:${p}','_blank')">📞 ${p}</button>`).join('');
      }
    } catch {}
    return '';
  }

  buildFullRouteUrl(stops) {
    try {
      const locs = stops.map(s => s.address || s.location).filter(Boolean);
      if (locs.length === 0) return 'https://maps.google.com/maps';
      if (locs.length === 1) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locs[0])}`;
      const origin = encodeURIComponent(locs[0]);
      const destination = encodeURIComponent(locs[locs.length - 1]);
      const waypoints = locs.slice(1, -1).map(encodeURIComponent).join('|');
      const base = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
      return waypoints ? `${base}&waypoints=${waypoints}` : base;
    } catch {
      return 'https://maps.google.com/maps';
    }
  }
}

if (!customElements.get('route-details')) {
  customElements.define('route-details', RouteDetails);
}

export default RouteDetails;
