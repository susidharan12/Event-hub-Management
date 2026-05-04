const navbar = document.getElementById('navbar');

function renderNavbar() {
  const token = (typeof CONFIG !== 'undefined' && CONFIG.STORAGE) 
    ? localStorage.getItem(CONFIG.STORAGE.TOKEN) 
    : (localStorage.getItem('token') || localStorage.getItem('authToken') || localStorage.getItem('eventhub_token') || localStorage.getItem('auth_token'));

  const userJSON = (typeof CONFIG !== 'undefined' && CONFIG.STORAGE)
    ? localStorage.getItem(CONFIG.STORAGE.USER)
    : (localStorage.getItem('user') || localStorage.getItem('auth_user'));

  const user = token && userJSON ? JSON.parse(userJSON) : null;
  const isSpecialPage = window.location.pathname.endsWith('profile.html') || window.location.pathname.endsWith('event-detail.html') || window.location.pathname.endsWith('booking.html') || window.location.pathname.endsWith('confirmation.html');
  const isEventDetail = window.location.pathname.includes('event-detail.html');
  const isProfile = window.location.pathname.includes('profile.html');
  const isDashboard = window.location.pathname.includes('dashboard.html');
  const isConfirmation = window.location.pathname.includes('confirmation.html');

  let navContent = '';
  
  if (token && user) {
    if (isSpecialPage) {
      // User is logged in and on the profile page
      // Updated layout: Logo left, optional logout right, full width
      navContent = `
        <div class="nav-inner" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <a href="dashboard.html" class="nav-logo" style="text-decoration: none; font-size: 1.5rem; font-weight: 800; color: #6366f1; display: flex; align-items: center; gap: 0.5rem;">
            <i class="fas fa-bolt" style="color: #ec4899;"></i> <span style="color: #1f2937;">EventHub</span>
          </a>
          <div class="nav-actions">
            ${(!isEventDetail && !isProfile && !isConfirmation) ? '<button id="logout-btn" class="btn btn-primary">Logout</button>' : 
            `<button onclick="history.back()" class="btn btn-primary" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1.5rem; font-size: 0.875rem; border-radius: 0.75rem; font-weight: 700;">
              <i class="fas fa-arrow-left"></i> Back
            </button>`}
          </div>
        </div>
      `;
    } else {
      // User is logged in but not on the profile page
      navContent = `
        <div class="nav-inner container">
          <div class="nav-logo">
            <span>EventHub</span>
          </div>
          <div class="nav-actions">
            <button id="profile-btn" class="btn btn-primary" style="margin-right: 10px;">Profile</button>
            ${isDashboard ? `<button onclick="history.back()" class="btn btn-primary" style="margin-right: 10px; display: flex; align-items: center; gap: 0.5rem;">
              <i class="fas fa-arrow-left"></i> Back
            </button>` : ''}
            <button id="logout-btn" class="btn btn-primary">Logout</button>
          </div>
        </div>
      `;
    }
  } else {
    // User is not logged in
    navContent = `
      <div class="nav-inner container">
        <div class="nav-logo">
          <span>EventHub</span>
        </div>
        <div class="nav-actions">
          <a href="/Public/auth/pages/login.html" class="btn btn-primary">Login</a>
          <a href="/Public/auth/pages/signup.html" class="btn btn-secondary">Sign Up</a>
        </div>
      </div>
    `;
  }

  navbar.innerHTML = navContent;

  if (token && user) {
    if (isSpecialPage) {
      const logoutBtn = document.getElementById('logout-btn');
      if (logoutBtn) logoutBtn.addEventListener('click', logout);
    } else {
      const profileBtn = document.getElementById('profile-btn');
      const logoutBtn = document.getElementById('logout-btn');
      if (profileBtn) profileBtn.addEventListener('click', viewProfile);
      if (logoutBtn) logoutBtn.addEventListener('click', logout);
    }
  }

  // Add floating back button to all pages except dashboard
  if (!window.location.pathname.includes('dashboard.html') && !window.location.pathname.includes('event-detail.html') && !window.location.pathname.includes('profile.html') && !window.location.pathname.includes('confirmation.html')) {
    addFloatingBackButton();
  }
}

function viewProfile() {
  window.location.href = './profile.html';
}

function logout() {
  showLogoutConfirm(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('eventhub_token');
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    if (typeof CONFIG !== 'undefined' && CONFIG.STORAGE) {
      localStorage.removeItem(CONFIG.STORAGE.TOKEN);
      localStorage.removeItem(CONFIG.STORAGE.USER);
    }
    window.location.href = '/index.html';
  });
}

// Shared logout-confirmation modal — same look-and-feel as the
// profile OTP / forgot-password modals so the UX feels consistent.
function showLogoutConfirm(onConfirm) {
  if (document.getElementById('logout-confirm-wrap')) return;
  const wrap = document.createElement('div');
  wrap.id = 'logout-confirm-wrap';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:99000;display:flex;align-items:center;justify-content:center;background:rgba(7,9,26,0.6);backdrop-filter:blur(8px);padding:1.5rem;font-family:Inter,Segoe UI,sans-serif;animation:lcFade 0.2s ease;';
  wrap.innerHTML = `
    <style>
      @keyframes lcFade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes lcZoom { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
    </style>
    <div style="background:white;border-radius:22px;width:100%;max-width:400px;overflow:hidden;box-shadow:0 30px 60px rgba(15,23,42,0.4);animation:lcZoom 0.25s cubic-bezier(.2,.9,.3,1.2);">
      <div style="padding:1.6rem 1.5rem 1.2rem;background:linear-gradient(135deg,#ef4444 0%,#ec4899 100%);color:white;text-align:center;">
        <div style="width:54px;height:54px;border-radius:50%;background:white;color:#ef4444;display:grid;place-items:center;font-size:1.4rem;margin:0 auto 0.7rem;box-shadow:0 8px 22px rgba(0,0,0,0.18);">
          <i class="fas fa-right-from-bracket"></i>
        </div>
        <h3 style="font-family:'Space Grotesk',Inter,sans-serif;font-size:1.2rem;font-weight:800;margin:0 0 4px;">Log out of EventHub?</h3>
        <p style="opacity:0.95;font-size:0.86rem;margin:0;">You'll need to sign in again to access your account.</p>
      </div>
      <div style="display:flex;gap:10px;padding:1.2rem 1.5rem 1.5rem;">
        <button class="lc-cancel" style="flex:1;padding:0.85rem 1rem;border-radius:12px;border:1px solid rgba(99,102,241,0.2);background:rgba(99,102,241,0.08);color:#6366f1;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.92rem;">Stay signed in</button>
        <button class="lc-confirm" style="flex:1;padding:0.85rem 1rem;border-radius:12px;border:none;background:linear-gradient(135deg,#ef4444,#ec4899);color:white;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.92rem;box-shadow:0 8px 20px rgba(239,68,68,0.35);">
          <i class="fas fa-right-from-bracket"></i> Log out
        </button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  document.body.style.overflow = 'hidden';
  const close = () => { wrap.remove(); document.body.style.overflow = ''; };
  wrap.querySelector('.lc-cancel').addEventListener('click', close);
  wrap.querySelector('.lc-confirm').addEventListener('click', () => { close(); try { onConfirm(); } catch (_) {} });
  wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
  document.addEventListener('keydown', function esc(ev) {
    if (ev.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });
}

function addFloatingBackButton() {
  // Prevent duplicates
  if (document.getElementById('floating-back-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'floating-back-btn';
  btn.textContent = 'Back';
  btn.className = 'btn btn-primary';
  
  Object.assign(btn.style, {
      position: 'fixed',
      top: '18px',
      right: '20px',
      zIndex: '1100',
      backgroundColor: '#6366f1',
      color: 'white',
      padding: '0.5rem 1.5rem',
      borderRadius: '8px',
      cursor: 'pointer',
      width: 'auto'
  });
  
  btn.onclick = () => window.location.href = 'dashboard.html';
  document.body.appendChild(btn);
}

document.addEventListener('DOMContentLoaded', renderNavbar);
