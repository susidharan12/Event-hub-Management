// Ensure services are loaded
if (typeof auth === 'undefined' || typeof Utils === 'undefined') {
  console.error('Services not loaded. Make sure config.js, utils.js, api.js, and auth.js are included before this script.');
}

const form = document.getElementById('signup-form');
const passwordInput = document.getElementById('password');
const confirmPasswordInput = document.getElementById('confirm-password');
const errorMsg = document.getElementById('error-msg');
const successMsg = document.getElementById('success-msg');

// Back to login button listener
const backBtn = form.querySelector('button[type="button"]');
if (backBtn) {
  backBtn.addEventListener('click', () => {
    window.location.href = './login.html';
  });
}

// Reveal/hide organization fields when role changes
const roleSelect = document.getElementById('role');
const orgBlock = document.getElementById('org-fields');
function syncOrgVisibility() {
  if (!orgBlock) return;
  if (roleSelect.value === 'organizer') orgBlock.classList.add('show');
  else orgBlock.classList.remove('show');
}
if (roleSelect) {
  roleSelect.addEventListener('change', syncOrgVisibility);
  syncOrgVisibility();
}

// Submit signup form
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Clear previous messages
  if (errorMsg) errorMsg.textContent = '';
  if (successMsg) successMsg.textContent = '';

  // Get form values
  const name = document.getElementById('name').value.trim();
  const mobile = document.getElementById('mobile').value.trim();
  const role = document.getElementById('role').value;
  const email = document.getElementById('email').value.trim();
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  console.log('📝 Signup form submitted');
  console.log('Form data:', { name, mobile, role, email, password_length: password?.length });

  // --- Validations ---
  if (password !== confirmPassword) {
    if (errorMsg) errorMsg.textContent = 'Passwords do not match.';
    console.log('❌ Passwords do not match');
    return;
  }

  if (!Utils.validatePassword(password)) {
    if (errorMsg) errorMsg.textContent = 'Password must be at least 6 characters.';
    console.log('❌ Password too short');
    return;
  }

  if (!Utils.validateEmail(email)) {
    if (errorMsg) errorMsg.textContent = 'Please enter a valid email address (e.g., user@example.com)';
    console.log('❌ Invalid email');
    return;
  }

  if (!Utils.validateMobile(mobile)) {
    if (errorMsg) errorMsg.textContent = 'Please enter a valid 10-digit mobile number';
    console.log('❌ Invalid mobile');
    return;
  }

  if (!Utils.validateName(name)) {
    if (errorMsg) errorMsg.textContent = 'Please enter a valid name.';
    console.log('❌ Invalid name');
    return;
  }

  if (!role) {
    if (errorMsg) errorMsg.textContent = 'Please select a role.';
    console.log('❌ No role selected');
    return;
  }

  // Organizer-only fields
  let organization_name, organization_address, organization_phone, organization_website, organization_description;
  if (role === 'organizer') {
    organization_name = document.getElementById('organization_name').value.trim();
    organization_address = document.getElementById('organization_address').value.trim();
    organization_phone = document.getElementById('organization_phone').value.trim();
    organization_website = document.getElementById('organization_website').value.trim();
    organization_description = document.getElementById('organization_description').value.trim();

    if (!organization_name) {
      if (errorMsg) errorMsg.textContent = 'Organization name is required.';
      Utils.showError && Utils.showError('Organization name is required.');
      return;
    }
    if (!organization_address) {
      if (errorMsg) errorMsg.textContent = 'Organization address is required.';
      Utils.showError && Utils.showError('Organization address is required.');
      return;
    }
  }

  console.log('✅ All validations passed');

  // --- Disable button and show loading ---
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Creating Account...';
  Utils.showLoading();

  // --- Call signup API ---
  try {
    console.log('🔄 Sending signup request to backend...');
    const response = await auth.signup({
      name,
      mobile,
      role,
      email,
      password,
      confirmPassword,
      organization_name,
      organization_address,
      organization_phone,
      organization_website,
      organization_description
    });

    console.log('✅ Signup response received:', response);
    if (successMsg) successMsg.textContent = '✓ Account created successfully! Redirecting to login...';

    // Redirect after 1.5s
    setTimeout(() => {
      window.location.href = './login.html';
    }, 1500);

  } catch (error) {
    console.error('❌ Signup failed:', error.message);
    console.error('Error details:', error);
    if (errorMsg) errorMsg.textContent = `Error: ${error.message}`;

    // Re-enable button and reset text
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;

  } finally {
    Utils.hideLoading();
  }
});
