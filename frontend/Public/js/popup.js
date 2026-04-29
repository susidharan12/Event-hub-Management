/**
 * EventHub Popup
 * --------------
 *  Drop-in replacement for the browser's native `alert()` / `confirm()`
 *  with the same gradient + glass design language used everywhere else.
 *
 *  Public API (attached to `window.Popup`):
 *    Popup.toast(message, type='info', duration=3500)
 *    Popup.alert(message, opts) -> Promise<void>
 *    Popup.confirm(message, opts) -> Promise<boolean>
 *
 *  This file ALSO overrides `window.alert` so the dozens of existing
 *  `alert()` calls in the codebase render the new popup automatically.
 *  Native alert is non-blocking here (a tiny behavioral change), but
 *  no existing call relies on its blocking semantics.
 *
 *  Just include the file once per page:
 *    <script src="/Public/js/popup.js"></script>
 */
(function () {
  if (window.Popup && window.Popup.__inited) return;

  // ---------- One-shot stylesheet injection ----------
  const STYLE_ID = 'eventhub-popup-style';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .eh-toast-container {
        position: fixed; top: 22px; right: 22px;
        z-index: 100000;
        display: flex; flex-direction: column; gap: 10px;
        max-width: 360px; width: calc(100vw - 44px);
        pointer-events: none;
      }
      .eh-toast {
        pointer-events: auto;
        display: flex; align-items: flex-start; gap: 12px;
        padding: 14px 16px;
        border-radius: 14px;
        color: white;
        font-family: 'Inter','Segoe UI',sans-serif;
        font-size: 0.92rem; font-weight: 500;
        line-height: 1.4;
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.22);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        animation: ehToastIn 0.35s cubic-bezier(.2,.9,.3,1.2) both;
      }
      .eh-toast.eh-out { animation: ehToastOut 0.3s ease both; }
      .eh-toast .eh-toast-icon {
        width: 28px; height: 28px; flex-shrink: 0;
        border-radius: 8px;
        display: grid; place-items: center;
        background: rgba(255,255,255,0.22);
        font-size: 0.95rem;
      }
      .eh-toast .eh-toast-body { flex: 1; min-width: 0; word-wrap: break-word; }
      .eh-toast .eh-toast-close {
        background: transparent; border: none; color: rgba(255,255,255,0.85);
        cursor: pointer; font-size: 1rem; padding: 2px 6px;
        flex-shrink: 0;
      }
      .eh-toast .eh-toast-close:hover { color: white; }
      .eh-toast.success { background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%); }
      .eh-toast.error   { background: linear-gradient(135deg, #ef4444 0%, #ec4899 100%); }
      .eh-toast.warning { background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); }
      .eh-toast.info    { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 35%, #ec4899 100%); }
      @keyframes ehToastIn  { from { opacity: 0; transform: translateX(110%); } to { opacity: 1; transform: translateX(0); } }
      @keyframes ehToastOut { from { opacity: 1; transform: translateX(0); }   to { opacity: 0; transform: translateX(110%); } }

      .eh-modal-backdrop {
        position: fixed; inset: 0; z-index: 99000;
        background: rgba(7, 9, 26, 0.6);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex; align-items: center; justify-content: center;
        padding: 1.5rem;
        animation: ehModalFade 0.2s ease;
      }
      @keyframes ehModalFade { from { opacity: 0; } to { opacity: 1; } }
      .eh-modal {
        background: white;
        border-radius: 22px;
        max-width: 440px; width: 100%;
        box-shadow: 0 30px 80px rgba(15, 23, 42, 0.4);
        overflow: hidden;
        font-family: 'Inter','Segoe UI',sans-serif;
        animation: ehModalZoom 0.32s cubic-bezier(.2,.9,.3,1.2);
        position: relative;
      }
      .eh-modal::before {
        content: ''; position: absolute;
        top: 0; left: 0; right: 0; height: 3px;
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 35%, #ec4899 100%);
      }
      @keyframes ehModalZoom {
        from { opacity: 0; transform: scale(0.94); }
        to   { opacity: 1; transform: scale(1); }
      }
      .eh-modal-icon {
        width: 64px; height: 64px;
        margin: 1.6rem auto 0.5rem;
        border-radius: 50%;
        display: grid; place-items: center;
        font-size: 1.6rem;
        animation: ehIconPop 0.45s cubic-bezier(.2,.9,.3,1.2) 0.05s both;
      }
      .eh-modal-icon.success { background: linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,182,212,0.15)); color: #10b981; }
      .eh-modal-icon.error   { background: linear-gradient(135deg, rgba(239,68,68,0.15), rgba(236,72,153,0.15)); color: #ef4444; }
      .eh-modal-icon.warning { background: linear-gradient(135deg, rgba(245,158,11,0.15), rgba(239,68,68,0.15)); color: #f59e0b; }
      .eh-modal-icon.info    { background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(236,72,153,0.15)); color: #6366f1; }
      @keyframes ehIconPop {
        0%   { transform: scale(0.5); opacity: 0; }
        60%  { transform: scale(1.18); opacity: 1; }
        100% { transform: scale(1); }
      }
      .eh-modal-title {
        font-family: 'Space Grotesk','Inter',sans-serif;
        font-size: 1.2rem; font-weight: 800;
        color: #1f2937;
        text-align: center;
        margin: 0 1.5rem 0.5rem;
      }
      .eh-modal-message {
        text-align: center;
        color: #64748b;
        font-size: 0.95rem;
        line-height: 1.5;
        margin: 0 1.5rem 1.4rem;
        white-space: pre-wrap;
      }
      .eh-modal-actions {
        display: flex; gap: 10px;
        padding: 0 1.5rem 1.5rem;
      }
      .eh-modal-btn {
        flex: 1;
        padding: 0.85rem 1rem;
        border: none; border-radius: 12px;
        font-weight: 700; font-size: 0.92rem;
        cursor: pointer;
        font-family: inherit;
        transition: all 0.25s ease;
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      }
      .eh-modal-btn-primary {
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 35%, #ec4899 100%);
        color: white;
        box-shadow: 0 8px 20px rgba(99,102,241,0.35);
      }
      .eh-modal-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 12px 26px rgba(236,72,153,0.45); }
      .eh-modal-btn-secondary {
        background: rgba(99,102,241,0.08);
        color: #6366f1;
        border: 1px solid rgba(99,102,241,0.2);
      }
      .eh-modal-btn-secondary:hover { background: rgba(99,102,241,0.15); }
    `;
    document.head.appendChild(style);
  }

  // ---------- Toast container ----------
  function getToastContainer() {
    let c = document.querySelector('.eh-toast-container');
    if (!c) {
      c = document.createElement('div');
      c.className = 'eh-toast-container';
      document.body.appendChild(c);
    }
    return c;
  }

  const TOAST_ICONS = {
    success: 'fa-check',
    error:   'fa-circle-exclamation',
    warning: 'fa-triangle-exclamation',
    info:    'fa-circle-info'
  };

  function toast(message, type = 'info', duration = 3500) {
    const container = getToastContainer();
    const el = document.createElement('div');
    el.className = `eh-toast ${TOAST_ICONS[type] ? type : 'info'}`;
    el.innerHTML = `
      <span class="eh-toast-icon"><i class="fas ${TOAST_ICONS[type] || TOAST_ICONS.info}"></i></span>
      <div class="eh-toast-body"></div>
      <button type="button" class="eh-toast-close" aria-label="Close">&times;</button>
    `;
    el.querySelector('.eh-toast-body').textContent = String(message ?? '');
    container.appendChild(el);

    const close = () => {
      el.classList.add('eh-out');
      setTimeout(() => el.remove(), 320);
    };
    el.querySelector('.eh-toast-close').addEventListener('click', close);
    if (duration > 0) setTimeout(close, duration);
    return { close };
  }

  // ---------- Modal helpers ----------
  function classifyMessage(msg) {
    const s = String(msg || '').toLowerCase();
    if (/(success|created|saved|updated|deleted|done|complete|confirm)/.test(s)) return 'success';
    if (/(fail|error|invalid|cannot|could not|not enough|missing|required|expired)/.test(s)) return 'error';
    if (/(too large|warning|please|min|max)/.test(s)) return 'warning';
    return 'info';
  }

  function buildModal({ title, message, okLabel = 'OK', cancelLabel = null, type = 'info' }) {
    return new Promise((resolve) => {
      const backdrop = document.createElement('div');
      backdrop.className = 'eh-modal-backdrop';

      const modal = document.createElement('div');
      modal.className = 'eh-modal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');

      const iconChar = type === 'success' ? 'fa-check'
                     : type === 'error'   ? 'fa-circle-xmark'
                     : type === 'warning' ? 'fa-triangle-exclamation'
                     :                      'fa-circle-info';

      modal.innerHTML = `
        <div class="eh-modal-icon ${type}"><i class="fas ${iconChar}"></i></div>
        <div class="eh-modal-title"></div>
        <div class="eh-modal-message"></div>
        <div class="eh-modal-actions">
          ${cancelLabel ? `<button type="button" class="eh-modal-btn eh-modal-btn-secondary">${escapeHtml(cancelLabel)}</button>` : ''}
          <button type="button" class="eh-modal-btn eh-modal-btn-primary">${escapeHtml(okLabel)}</button>
        </div>
      `;
      modal.querySelector('.eh-modal-title').textContent = title || '';
      modal.querySelector('.eh-modal-message').textContent = message || '';
      backdrop.appendChild(modal);
      document.body.appendChild(backdrop);

      const close = (result) => {
        backdrop.style.animation = 'ehModalFade 0.18s ease reverse';
        setTimeout(() => backdrop.remove(), 180);
        document.removeEventListener('keydown', onKey);
        resolve(result);
      };
      modal.querySelector('.eh-modal-btn-primary').addEventListener('click', () => close(true));
      const cancelBtn = modal.querySelector('.eh-modal-btn-secondary');
      if (cancelBtn) cancelBtn.addEventListener('click', () => close(false));
      backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(cancelLabel ? false : true); });
      const onKey = (e) => {
        if (e.key === 'Escape') close(cancelLabel ? false : true);
        if (e.key === 'Enter')  close(true);
      };
      document.addEventListener('keydown', onKey);
    });
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function alertPopup(message, opts = {}) {
    const type = opts.type || classifyMessage(message);
    const title = opts.title || ({
      success: 'Success',
      error:   'Something went wrong',
      warning: 'Heads up',
      info:    'Notice'
    }[type]);
    return buildModal({
      title, message: String(message ?? ''),
      okLabel: opts.okLabel || 'OK',
      type
    });
  }

  function confirmPopup(message, opts = {}) {
    const type = opts.type || 'warning';
    const title = opts.title || 'Are you sure?';
    return buildModal({
      title, message: String(message ?? ''),
      okLabel: opts.okLabel || 'Confirm',
      cancelLabel: opts.cancelLabel || 'Cancel',
      type
    });
  }

  // ---------- Public API ----------
  window.Popup = {
    __inited: true,
    toast,
    alert: alertPopup,
    confirm: confirmPopup,
    success: (m, t) => toast(m, 'success', t),
    error:   (m, t) => toast(m, 'error',   t),
    info:    (m, t) => toast(m, 'info',    t),
    warning: (m, t) => toast(m, 'warning', t)
  };

  // ---------- Override window.alert so existing alert() calls use the popup ----------
  // (Native alert is blocking; ours is non-blocking. None of the call sites in
  //  this codebase rely on the blocking behavior.)
  const _nativeAlert = window.alert;
  window.alert = function (message) {
    try { alertPopup(String(message ?? '')); }
    catch (e) { _nativeAlert.call(window, message); }
  };
})();
