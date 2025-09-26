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
          background: #4a9b5e;
          background-image:
            linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%),
            linear-gradient(-45deg, rgba(255,255,255,0.1) 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.1) 75%),
            linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.1) 75%);
          background-size: 20px 20px;
          background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
          color: white;
          padding: 8px;
          text-align: center;
          position: relative;
          flex-shrink: 0;
          z-index: 1001;
          cursor: pointer;
          transition: opacity 0.2s ease;
        }

        .header:hover {
          opacity: 0.9;
        }

        .header h1 {
          font-family: var(--header-font, "Barrio", cursive);
          font-size: clamp(1rem, 4.8vw, 2.2rem);
          line-height: 1.1;
          font-weight: 400;
          margin: 0 0 8px 0;
          white-space: nowrap;
        }

        .header p {
          font-size: 1rem;
          opacity: 0.9;
          margin: 0 0 8px 0;
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
