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
}

document.addEventListener('DOMContentLoaded', renderNavbar);
