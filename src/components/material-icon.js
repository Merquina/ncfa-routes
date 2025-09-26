class MaterialIcon extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  static get observedAttributes() {
    return ['icon', 'size', 'color'];
  }

  attributeChangedCallback() {
    this.render();
  }

  render() {
    const icon = this.getAttribute('icon') || 'help';
    const size = this.getAttribute('size') || '24px';
    const color = this.getAttribute('color') || 'currentColor';

    this.shadowRoot.innerHTML = `
      <style>
        @import url('https://cdnjs.cloudflare.com/ajax/libs/MaterialDesign-Webfont/7.4.47/css/materialdesignicons.min.css');
        
        :host {
          display: inline-block;
        }
        
        .icon {
          font-family: "Material Design Icons" !important;
          font-style: normal !important;
          font-weight: normal !important;
          font-variant: normal !important;
          text-transform: none !important;
          line-height: 1 !important;
          -webkit-font-smoothing: antialiased !important;
          -moz-osx-font-smoothing: grayscale !important;
          font-size: ${size} !important;
          color: ${color} !important;
          speak: none !important;
        }
      </style>
      <i class="icon mdi mdi-${icon}"></i>
    `;
  }
}

if (!customElements.get('material-icon')) {
  customElements.define('material-icon', MaterialIcon);
}

export default MaterialIcon;