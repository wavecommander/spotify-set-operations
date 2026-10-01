/**
 * Toast Notification Web Component (<sso-toast>)
 */

export class SsoToast extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    window.addEventListener('sso:notify', (e) => {
      if (e.detail) {
        this.show(e.detail.message, e.detail.type || 'info', e.detail.duration || 3500);
      }
    });
  }

  show(message, type = 'info', duration = 3500) {
    const container = this.shadowRoot.querySelector('.toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('visible');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        .toast-container {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 9999;
          display: flex;
          flex-direction: column;
          gap: 10px;
          pointer-events: none;
        }
        .toast {
          padding: 12px 18px;
          border-radius: 8px;
          font-family: var(--font-sans, sans-serif);
          font-size: 0.9rem;
          font-weight: 500;
          color: #ffffff;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
          opacity: 0;
          transform: translateY(12px) scale(0.96);
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          pointer-events: auto;
          max-width: 380px;
        }
        .toast.visible {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        .toast-info {
          background: #242424;
          border: 1px solid rgba(255, 255, 255, 0.15);
        }
        .toast-success {
          background: #1db954;
          color: #000000;
          font-weight: 600;
        }
        .toast-error {
          background: #ef4444;
        }
      </style>
      <div class="toast-container"></div>
    `;
  }
}

customElements.define('sso-toast', SsoToast);

export function notify(message, type = 'info', duration = 3500) {
  window.dispatchEvent(
    new CustomEvent('sso:notify', {
      detail: { message, type, duration },
    })
  );
}
