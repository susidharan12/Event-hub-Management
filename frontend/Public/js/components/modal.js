/**
 * Modal Component
 * Handles modal dialogs and confirmations
 */

class Modal {
  static create(options = {}) {
    const {
      title = 'Confirm',
      message = 'Are you sure?',
      type = 'info', // info, warning, error, success
      buttons = [
        { label: 'Cancel', action: 'cancel', style: 'secondary' },
        { label: 'OK', action: 'confirm', style: 'primary' }
      ],
      onConfirm = () => {},
      onCancel = () => {},
      backdropClose = true
    } = options;

    // Create modal container
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      z-index: 9998;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.cssText = `
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      max-width: 400px;
      width: 90%;
      animation: modalSlideIn 0.3s ease-in-out;
      z-index: 9999;
    `;

    // Add modal styles if not present
    if (!document.getElementById('modal-styles')) {
      const style = document.createElement('style');
      style.id = 'modal-styles';
      style.textContent = `
        @keyframes modalSlideIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes modalSlideOut {
          from {
            opacity: 1;
            transform: scale(1);
          }
          to {
            opacity: 0;
            transform: scale(0.9);
          }
        }
        .modal-header {
          padding: 20px;
          border-bottom: 1px solid #e0e0e0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .modal-title {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #333;
        }
        .modal-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #999;
          padding: 0;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .modal-close:hover {
          color: #333;
        }
        .modal-body {
          padding: 20px;
          color: #666;
          line-height: 1.5;
        }
        .modal-footer {
          padding: 15px 20px;
          border-top: 1px solid #e0e0e0;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }
        .modal-button {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: background-color 0.2s;
        }
        .modal-button-primary {
          background-color: #2196f3;
          color: white;
        }
        .modal-button-primary:hover {
          background-color: #0b7dda;
        }
        .modal-button-secondary {
          background-color: #e0e0e0;
          color: #333;
        }
        .modal-button-secondary:hover {
          background-color: #d0d0d0;
        }
        .modal-button-danger {
          background-color: #f44336;
          color: white;
        }
        .modal-button-danger:hover {
          background-color: #da190b;
        }
        .modal-button-success {
          background-color: #4caf50;
          color: white;
        }
        .modal-button-success:hover {
          background-color: #45a049;
        }
      `;
      document.head.appendChild(style);
    }

    // Create header
    const header = document.createElement('div');
    header.className = 'modal-header';
    header.innerHTML = `
      <h2 class="modal-title">${title}</h2>
      <button class="modal-close">×</button>
    `;

    // Create body
    const body = document.createElement('div');
    body.className = 'modal-body';
    body.textContent = message;

    // Create footer with buttons
    const footer = document.createElement('div');
    footer.className = 'modal-footer';

    buttons.forEach(btn => {
      const button = document.createElement('button');
      button.className = `modal-button modal-button-${btn.style}`;
      button.textContent = btn.label;
      button.addEventListener('click', () => {
        close();
        if (btn.action === 'confirm') {
          onConfirm();
        } else if (btn.action === 'cancel') {
          onCancel();
        } else if (typeof btn.callback === 'function') {
          btn.callback();
        }
      });
      footer.appendChild(button);
    });

    // Assemble modal
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    // Close function
    const close = () => {
      modal.style.animation = 'modalSlideOut 0.3s ease-in-out';
      setTimeout(() => {
        backdrop.remove();
      }, 300);
    };

    // Close button handler
    header.querySelector('.modal-close').addEventListener('click', close);

    // Backdrop click to close
    if (backdropClose) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          close();
          onCancel();
        }
      });
    }

    return { close, backdrop, modal };
  }

  /**
   * Show confirmation dialog
   */
  static confirm(message, onConfirm, onCancel) {
    return this.create({
      title: 'Confirm',
      message,
      type: 'warning',
      buttons: [
        { label: 'Cancel', action: 'cancel', style: 'secondary' },
        { label: 'Confirm', action: 'confirm', style: 'primary' }
      ],
      onConfirm,
      onCancel
    });
  }

  /**
   * Show alert dialog
   */
  static alert(message, onClose) {
    return this.create({
      title: 'Alert',
      message,
      type: 'info',
      buttons: [
        { label: 'OK', action: 'confirm', style: 'primary' }
      ],
      onConfirm: onClose,
      backdropClose: false
    });
  }

  /**
   * Show error dialog
   */
  static error(message, onClose) {
    return this.create({
      title: 'Error',
      message,
      type: 'error',
      buttons: [
        { label: 'OK', action: 'confirm', style: 'primary' }
      ],
      onConfirm: onClose,
      backdropClose: false
    });
  }

  /**
   * Show success dialog
   */
  static success(message, onClose) {
    return this.create({
      title: 'Success',
      message,
      type: 'success',
      buttons: [
        { label: 'OK', action: 'confirm', style: 'success' }
      ],
      onConfirm: onClose
    });
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Modal };
}
