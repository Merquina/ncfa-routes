class AppHeader extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
    this.setupClickHandler();
  }

  setupClickHandler() {
    const headerTitle = this.shadowRoot.querySelector("#headerTitle");
    if (headerTitle) {
      headerTitle.addEventListener("click", () => {
        this.dispatchEvent(new CustomEvent("header-click", { bubbles: true }));
      });
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
        }

        .header {
          background: linear-gradient(135deg, #1a365d 0%, #2c5282 50%, #3182ce 100%);
          color: white;
          padding: 12px;
          text-align: center;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          flex-shrink: 0;
          z-index: 1001;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          width: 100%;
          box-sizing: border-box;
        }

        .header:hover {
          background: linear-gradient(135deg, #1e3a5f 0%, #2d5486 50%, #3687d1 100%);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
        }

        .header h1 {
          font-family: "Barrio", cursive;
          font-size: var(--font-size-xl, 1.5rem);
          line-height: 1.3;
          font-weight: 400;
          margin: 0 0 6px 0;
          white-space: nowrap;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
          letter-spacing: 0.025em;
        }

        .header p {
          font-family: var(--font-family, 'OpenDyslexic', 'Comic Sans MS', 'Trebuchet MS', 'Verdana', 'Arial', sans-serif);
          font-size: var(--font-size-base, 1rem);
          font-weight: 600;
          margin: 0;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
          letter-spacing: 0.025em;
        }
      </style>

      <div class="header" id="headerTitle">
        <h1>North Country Food Alliance</h1>
        <p>SPFM and Recovery Routes</p>
      </div>
    `;
  }
}

customElements.define("app-header", AppHeader);
