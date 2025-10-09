class AppHeader extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
    this.setupClickHandler();
  }

  static get observedAttributes() {
    return ["hide-menu"];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "hide-menu") {
      this.updateMenuVisibility();
    }
  }

  updateMenuVisibility() {
    const hamburgerContainer = this.shadowRoot.querySelector(
      ".hamburger-container"
    );
    if (hamburgerContainer) {
      const hideMenu = this.hasAttribute("hide-menu");
      hamburgerContainer.style.display = hideMenu ? "none" : "flex";
    }
  }

  setupClickHandler() {
    // Set up hamburger menu click handler
    const hamburgerBtn = this.shadowRoot.querySelector("#hamburgerBtn");
    if (hamburgerBtn) {
      hamburgerBtn.addEventListener("click", () => {
        this.dispatchEvent(
          new CustomEvent("hamburger-click", { bubbles: true })
        );
      });
    }
    // Initial menu visibility check
    this.updateMenuVisibility();
  }

  render() {
    // Import Material Design Icons if not already present
    if (!document.querySelector('link[href*="materialdesignicons"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href =
        "https://cdnjs.cloudflare.com/ajax/libs/MaterialDesign-Webfont/7.4.47/css/materialdesignicons.min.css";
      document.head.appendChild(link);
    }

    this.shadowRoot.innerHTML = `
      <style>
        @import url("https://cdnjs.cloudflare.com/ajax/libs/MaterialDesign-Webfont/7.4.47/css/materialdesignicons.min.css");

        :host {
          display: block;
          width: 100%;
        }

        .header {
          background: linear-gradient(135deg, #1a365d 0%, #2c5282 50%, #3182ce 100%);
          color: white;
          padding: 12px 12px 8px 12px;
          text-align: center;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          flex-shrink: 0;
          z-index: 1001;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          width: 100%;
          box-sizing: border-box;
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
          margin: 0 0 8px 0;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
          letter-spacing: 0.025em;
        }

        .hamburger-container {
          display: flex;
          justify-content: center;
          padding-bottom: 4px;
        }

        .hamburger-btn {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          font-size: 1.2rem;
          padding: 6px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.2s ease;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .hamburger-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      </style>

      <div class="header" id="headerTitle">
        <h1>North Country Food Alliance</h1>
        <p>SPFM and Recovery Routes</p>
        <div class="hamburger-container">
          <button class="hamburger-btn" id="hamburgerBtn">
            <i class="mdi mdi-menu"></i>
          </button>
        </div>
      </div>
    `;
  }
}

customElements.define("app-header", AppHeader);
