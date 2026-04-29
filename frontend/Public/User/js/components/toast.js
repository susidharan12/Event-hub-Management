/**
 * Toast Component
 * Handles notifications and alerts
 */

class Toast {
  static show(message, type = 'info', duration = CONFIG.TIMEOUTS.TOAST) {
    // Create container if doesn't exist
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        max-width: 400px;
      `;
      document.body.appendChild(container);
    }

    // Create toast element
    const toast = document.createElement('div');
    const toastId = `toast-${Date.now()}`;
    toast.id = toastId;

    // Set styles based on type
    const colors = {
      success: { bg: '#4caf50', border: '#45a049' },
      error: { bg: '#f44336', border: '#da190b' },
      info: { bg: '#2196f3', border: '#0b7dda' },
      warning: { bg: '#ff9800', border: '#e68900' }
    };

    const color = colors[type] || colors.info;

    toast.style.cssText = `
      background-color: ${color.bg};
      color: white;
      padding: 16px;
      margin-bottom: 10px;
      border-radius: 4px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      animation: slideIn 0.3s ease-in-out;
      word-wrap: break-word;
      word-break: break-word;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      font-size: 14px;
      line-height: 1.4;
    `;

    toast.textContent = message;

    // Add animation styles
    if (!document.getElementById('toast-styles')) {
      const style = document.createElement('style');
      style.id = 'toast-styles';
      style.textContent = `
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        @keyframes slideOut {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(400px);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }

    // Add to container
    container.appendChild(toast);

    // Remove after duration
    if (duration > 0) {
      setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in-out';
        setTimeout(() => {
          toast.remove();
        }, 300);
      }, duration);
    }

    return toastId;
  }

  /**
   * Show success toast
   */
  static success(message, duration = CONFIG.TIMEOUTS.TOAST) {
    return this.show(message, 'success', duration);
  }

  /**
   * Show error toast
   */
  static error(message, duration = CONFIG.TIMEOUTS.TOAST) {
    return this.show(message, 'error', duration);
  }

  /**
   * Show info toast
   */
  static info(message, duration = CONFIG.TIMEOUTS.TOAST) {
    return this.show(message, 'info', duration);
  }

  /**
   * Show warning toast
   */
  static warning(message, duration = CONFIG.TIMEOUTS.TOAST) {
    return this.show(message, 'warning', duration);
  }

  /**
   * Clear all toasts
   */
  static clearAll() {
    const container = document.getElementById('toast-container');
    if (container) {
      container.innerHTML = '';
    }
  }

  /**
   * Remove specific toast
   */
  static remove(toastId) {
    const toast = document.getElementById(toastId);
    if (toast) {
      toast.remove();
    }
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Toast };
}