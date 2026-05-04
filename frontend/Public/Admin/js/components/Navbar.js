const navbar = document.getElementById('navbar');

function renderNavbar() {
  const token = (typeof CONFIG !== 'undefined' && CONFIG.STORAGE) 
    ? localStorage.getItem(CONFIG.STORAGE.TOKEN) 
    : (localStorage.getItem('token') || localStorage.getItem('authToken') || localStorage.getItem('eventhub_token') || localStorage.getItem('auth_token'));

  const userJSON = (typeof CONFIG !== 'undefined' && CONFIG.STORAGE)
    ? localStorage.getItem(CONFIG.STORAGE.USER)
    : (localStorage.getItem('user') || localStorage.getItem('auth_user'));

  const user = token && userJSON ? JSON.parse(userJSON) : null;
  const isSpecialPage = window.location.pathname.endsWith('profile.html') || window.location.pathname.endsWith('edit.html');

  let navContent = '';
  
  if (token && user) {
    if (isSpecialPage) {
      // User is logged in and on the profile page
      navContent = `
        <div class="nav-inner container">
          <div class="nav-logo">
            <span>EventHub Admin</span>
          </div>
          <div class="nav-actions">
            <button id="back-btn" class="btn btn-primary">Back</button>
            <button id="logout-btn" class="btn btn-primary">Logout</button>
          </div>
        </div>
      `;
    } else {
      // User is logged in but not on the profile page
      navContent = `
        <div class="nav-inner container">
          <div class="nav-logo">
            <span>EventHub Admin</span>
          </div>
          <div class="nav-actions">
            <button id="profile-btn" class="btn btn-primary">Profile</button>
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
          <span>EventHub Admin</span>
        </div>
        <div class="nav-actions">
          <a href="/Public/auth/pages/login.html" class="btn btn-primary">Login</a>
        </div>
      </div>
    `;
  }

  navbar.innerHTML = navContent;

  if (token && user) {
    if (isSpecialPage) {
      const backBtn = document.getElementById('back-btn');
      const logoutBtn = document.getElementById('logout-btn');
      if (backBtn) backBtn.addEventListener('click', () => {
        window.history.back();
      });
      if (logoutBtn) logoutBtn.addEventListener('click', logout);
    } else {
      const profileBtn = document.getElementById('profile-btn');
      const logoutBtn = document.getElementById('logout-btn');
      if (profileBtn) profileBtn.addEventListener('click', viewProfile);
      if (logoutBtn) logoutBtn.addEventListener('click', logout);
    }
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

document.addEventListener('DOMContentLoaded', renderNavbar);
