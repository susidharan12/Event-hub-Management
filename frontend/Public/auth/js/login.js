// Ensure services are loaded
if (typeof auth === 'undefined' || typeof api === 'undefined') {
  console.error('Services not loaded. Make sure config.js, utils.js, api.js, and auth.js are included before this script.');
}

// Global variable to track selected role
let selectedRole = 'explorer';

function selectRole(role, event) {
  selectedRole = role;
  console.log('Role selected:', role);
  document.querySelectorAll('.role-option').forEach(el => el.classList.remove('active'));
  event.currentTarget.classList.add('active');
}

// Notification functions
function showLoginSuccess(message) {
  const popup = document.createElement('div');
  popup.className = 'login-popup success';
  popup.innerHTML = `<h3>Success!</h3><p>${message}</p>`;
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 2000);
}

function showLoginError(message) {
  const popup = document.createElement('div');
  popup.className = 'login-popup error';
  popup.innerHTML = `<h3>Error</h3><p>${message}</p>`;
  document.body.appendChild(popup);
  setTimeout(() => popup.remove(), 4000);
}

// Form Logic
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    const submitBtn = document.getElementById('login-btn');
    const btnText = document.getElementById('btn-text');

    console.log('Login attempt started');
    console.log('Email:', email);
    console.log('Password length:', password.length);

    if (typeof Utils === 'undefined' || typeof auth === 'undefined') {
      console.error('Services not loaded properly');
      showLoginError("Services not loaded properly.");
      return;
    }

    try {
      submitBtn.disabled = true;
      btnText.textContent = 'Logging in...';

      // 1. Login via auth service
      console.log('Sending login request to backend...');
      const response = await auth.login(email, password);
      console.log('Backend response received:', response);

      // 2. Get user details
      const currentUser = auth.getCurrentUser();
      console.log('Current user loaded:', {
        id: currentUser?.id,
        name: currentUser?.name,
        email: currentUser?.email,
        mobile: currentUser?.mobile,
        role: currentUser?.role
      });

      // 3. Validate Role (FIXED LOGIC)
      console.log('Selected role:', selectedRole);
      console.log('User role:', currentUser?.role);
      
      if (currentUser && currentUser.role !== selectedRole) {
        console.error('Role mismatch');
        showLoginError(`Account is registered as ${currentUser.role.toUpperCase()}. Please select the correct role above.`);
        submitBtn.disabled = false;
        btnText.textContent = 'Login Now';
        return;
      }

      console.log('Role validated successfully');
      console.log('User data stored in localStorage');
      console.log('Auth token:', auth.token?.substring(0, 20) + '...');

      showLoginSuccess(`Welcome, ${currentUser?.name || 'User'}!`);

      // 4. Redirect
      console.log('Redirecting to dashboard...');
      setTimeout(() => {
        if (currentUser && currentUser.role === 'organizer') {
          console.log('Redirecting to organizer dashboard');
          window.location.href = '../../organizer/pages/dashboard.html';
        } else {
          console.log('Redirecting to user dashboard');
          window.location.href = '../../User/pages/dashboard.html';
        }
      }, 2000);

    } catch (error) {
      console.error('Login failed:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      submitBtn.disabled = false;
      btnText.textContent = 'Login Now';
      showLoginError(error.message || 'Login failed.');
    }
  });
});
