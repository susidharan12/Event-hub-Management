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
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('eventhub_token');
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
  if (typeof CONFIG !== 'undefined' && CONFIG.STORAGE) {
    localStorage.removeItem(CONFIG.STORAGE.TOKEN);
    localStorage.removeItem(CONFIG.STORAGE.USER);
  }
  // Redirect to home page on port 8001
  window.location.href = '/index.html';
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
