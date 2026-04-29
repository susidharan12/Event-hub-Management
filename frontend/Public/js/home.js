// Home page navigation logic

// Scroll to sections
const scrollAboutBtn = document.getElementById('scroll-about');
const scrollContactBtn = document.getElementById('scroll-contact');

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth' });
}

if (scrollAboutBtn) {
  scrollAboutBtn.addEventListener('click', () => scrollToSection('about'));
}

if (scrollContactBtn) {
  scrollContactBtn.addEventListener('click', () => scrollToSection('contact'));
}

// Main CTA buttons (Login Now / Create Account)
const loginBtn = document.getElementById('login-btn');
const signupBtn = document.getElementById('signup-btn');

if (loginBtn) {
  loginBtn.addEventListener('click', () => {
    window.location.href = 'Public/auth/pages/login.html';
  });
}

if (signupBtn) {
  signupBtn.addEventListener('click', () => {
    window.location.href = 'Public/auth/pages/signup.html';
  });
}

// Header navigation buttons (Login / Sign Up)
const navLoginBtn = document.getElementById('nav-login');
const navSignupBtn = document.getElementById('nav-signup');

if (navLoginBtn) {
  navLoginBtn.addEventListener('click', () => {
    window.location.href = 'Public/auth/pages/login.html';
  });
}

if (navSignupBtn) {
  navSignupBtn.addEventListener('click', () => {
    window.location.href = 'Public/auth/pages/signup.html';
  });
}

// Check if user is already authenticated (optional - for future implementation)
// Note: Service scripts not loaded on home page for performance
// if (typeof auth !== 'undefined' && auth.isAuthenticated()) {
//   if (auth.isOrganizer()) {
//     window.location.href = './Public/Admin/pages/index.html';
//   } else {
//     window.location.href = './Public/User/pages/index.html';
//   }
// }
