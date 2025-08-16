class DevOverlay extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._timer = null;
    this._visible = true;
  }

  connectedCallback() {
    this.render();
    this._startAutoRefresh();
    this._bindKeys();
  }

  disconnectedCallback() {
    if (this._timer) clearInterval(this._timer);
  }

  _bindKeys() {
    try {
      const onKey = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
          e.preventDefault();
          this.toggle();
        }
      };
      window.addEventListener('keydown', onKey);
      this._offKey = () => window.removeEventListener('keydown', onKey);
    } catch {}
  }

  toggle() {
    this._visible = !this._visible;
    this.style.display = this._visible ? 'block' : 'none';
  }

  _formatTs(ts) {
    if (!ts) return '—';
    try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
  }

  _startAutoRefresh() {
    this._timer = setInterval(() => this.render(), 2000);
  }

  render() {
    const info = (window.dataService && typeof window.dataService.getDebugInfo === 'function')
      ? window.dataService.getDebugInfo() : { lastFetchTs: 0, signature: '', counts: {}, sources: {} };
    const sig = info.signature || '';
    const last = this._formatTs(info.lastFetchTs);
    const c = info.counts || {};
    const src = info.sources || {};
    this.shadowRoot.innerHTML = `
      <style>
        :host { position: fixed; right: 12px; bottom: 12px; z-index: 9999; }
        .panel { background: rgba(0,0,0,0.8); color: #fff; padding: 10px 12px; border-radius: 8px; font: 12px/1.4 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 360px; }
        .row { display:flex; justify-content:space-between; gap:8px; }
        .muted { color:#bbb }
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace; font-size: 11px; }
        .grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap:6px 12px; margin-top:6px; }
        .tag { background:#333; border-radius:6px; padding:2px 6px; }
        .title { font-weight:600; margin-bottom:6px; }
        button { background:#444; color:#fff; border:none; padding:4px 8px; border-radius:6px; cursor:pointer; }
      </style>
      <div class="panel">
        <div class="row"><div class="title">Dev Overlay</div><button id="toggle">Hide</button></div>
        <div class="row"><div class="muted">Last fetch</div><div>${last}</div></div>
        <div class="row"><div class="muted">Signature</div><div class="mono">${sig}</div></div>
        <div class="title" style="margin-top:6px;">Counts</div>
        <div class="grid mono">
          <div>SPFM</div><div>${c.spfm ?? '—'}</div>
          <div>Recovery</div><div>${c.recovery ?? '—'}</div>
          <div>Delivery</div><div>${c.delivery ?? '—'}</div>
          <div>Routes</div><div>${c.routes ?? '—'}</div>
          <div>Status</div><div>${c.status ?? '—'}</div>
          <div>Contacts</div><div>${c.contacts ?? '—'}</div>
          <div>Workers</div><div>${c.workers ?? '—'}</div>
          <div>Vehicles</div><div>${c.vehicles ?? '—'}</div>
          <div>Reminders</div><div>${c.reminders ?? '—'}</div>
        </div>
        <div class="title" style="margin-top:6px;">Sources</div>
        <div class="mono">${Object.keys(src).length ? JSON.stringify(src) : '—'}</div>
      </div>
    `;
    try { this.shadowRoot.getElementById('toggle').onclick = () => this.toggle(); } catch {}
  }
}

if (!customElements.get('dev-overlay')) {
  customElements.define('dev-overlay', DevOverlay);
}

export default DevOverlay;

