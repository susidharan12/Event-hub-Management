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

  console.log('Signup form submitted');
  console.log('Form data:', { name, mobile, role, email, password_length: password?.length });

  // --- Validations ---
  if (password !== confirmPassword) {
    if (errorMsg) errorMsg.textContent = 'Passwords do not match.';
    console.log('Passwords do not match');
    return;
  }

  if (!Utils.validatePassword(password)) {
    if (errorMsg) errorMsg.textContent = 'Password must be at least 6 characters.';
    console.log('Password too short');
    return;
  }

  if (!Utils.validateEmail(email)) {
    if (errorMsg) errorMsg.textContent = 'Please enter a valid email address (e.g., user@example.com)';
    console.log('Invalid email');
    return;
  }

  if (!Utils.validateMobile(mobile)) {
    if (errorMsg) errorMsg.textContent = 'Please enter a valid 10-digit mobile number';
    console.log('Invalid mobile');
    return;
  }

  if (!Utils.validateName(name)) {
    if (errorMsg) errorMsg.textContent = 'Please enter a valid name.';
    console.log('Invalid name');
    return;
  }

  if (!role) {
    if (errorMsg) errorMsg.textContent = 'Please select a role.';
    console.log('No role selected');
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

  console.log('All validations passed');

  // --- Disable button and show loading ---
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  const originalText = submitBtn.textContent;
  submitBtn.textContent = 'Sending OTP…';

  // --- Step 1: send OTP to the email --------------------------------
  const API_BASE = (typeof CONFIG !== 'undefined' && CONFIG.API && CONFIG.API.BASE_URL) || 'http://localhost:3000/api';
  let sendRes;
  try {
    const r = await fetch(`${API_BASE}/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: email, target_type: 'email', purpose: 'signup', name })
    });
    sendRes = await r.json();
    if (!r.ok) throw new Error(sendRes.error || 'Failed to send OTP');
  } catch (err) {
    if (errorMsg) errorMsg.textContent = err.message;
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
    return;
  }

  // --- Step 2: open OTP modal, get verification_token --------------
  let verification_token;
  try {
    verification_token = await openOtpModal({
      title: 'Verify your email',
      subtitle: `We sent a 6-digit code to <b>${escapeHtml(sendRes.delivered_to || email)}</b>.`,
      target: email,
      purpose: 'signup',
      devOtp: sendRes.devMode ? sendRes.otp : null
    });
  } catch (cancelOrErr) {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
    return;
  }

  // --- Step 3: actual signup with the verification token -----------
  submitBtn.textContent = 'Creating Account…';
  Utils.showLoading();
  try {
    console.log('Sending signup request to backend...');
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
      organization_description,
      verification_token
    });

    console.log('Signup response received:', response);
    if (successMsg) successMsg.textContent = 'Account created successfully! Redirecting to login...';

    setTimeout(() => { window.location.href = './login.html'; }, 1500);
  } catch (error) {
    console.error('Signup failed:', error.message);
    if (errorMsg) errorMsg.textContent = `Error: ${error.message}`;
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  } finally {
    Utils.hideLoading();
  }
});

// ───────── Reusable OTP modal ─────────
// Returns Promise<verification_token>; rejects if user cancels.
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function openOtpModal(opts) {
  const API_BASE = (typeof CONFIG !== 'undefined' && CONFIG.API && CONFIG.API.BASE_URL) || 'http://localhost:3000/api';
  return new Promise((resolve, reject) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:99000;display:flex;align-items:center;justify-content:center;background:rgba(7,9,26,0.6);backdrop-filter:blur(8px);padding:1.5rem;font-family:Inter,Segoe UI,sans-serif;animation:otpFade 0.22s ease;';
    wrap.innerHTML = `
      <style>
        @keyframes otpFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes otpZoom { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
      </style>
      <div style="background:white;border-radius:22px;width:100%;max-width:420px;overflow:hidden;box-shadow:0 30px 60px rgba(15,23,42,0.4);animation:otpZoom 0.3s cubic-bezier(.2,.9,.3,1.2);">
        <div style="position:relative;padding:1.6rem 1.5rem 1.2rem;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 35%,#ec4899 100%);color:white;text-align:center;overflow:hidden;">
          <div style="width:54px;height:54px;border-radius:50%;background:white;color:#6366f1;display:grid;place-items:center;font-size:1.4rem;margin:0 auto 0.7rem;box-shadow:0 8px 22px rgba(0,0,0,0.18);">
            <i class="fas fa-shield-halved"></i>
          </div>
          <h3 style="font-family:'Space Grotesk',Inter,sans-serif;font-size:1.25rem;font-weight:800;margin:0 0 4px;">${escapeHtml(opts.title || 'Verify')}</h3>
          <p style="opacity:0.95;font-size:0.88rem;margin:0;">${opts.subtitle || ''}</p>
        </div>
        <div style="padding:1.4rem 1.5rem 0;">
          <input class="otp-input" inputmode="numeric" maxlength="6" placeholder="• • • • • •" autocomplete="one-time-code" style="
            width:100%;padding:1rem;text-align:center;
            font-family:'JetBrains Mono','Fira Code',monospace;
            font-size:1.6rem;letter-spacing:0.5em;font-weight:700;
            border:2px solid #eef2ff;border-radius:14px;
            background:#fafbff;color:#1f2937;outline:none;
            transition:border-color 0.2s,box-shadow 0.2s;
          ">
          <div class="otp-error" style="margin-top:8px;color:#ef4444;font-size:0.85rem;text-align:center;min-height:18px;"></div>
          ${opts.devOtp ? `<div style="margin-top:6px;padding:8px 12px;background:rgba(245,158,11,0.1);border:1px dashed rgba(245,158,11,0.3);border-radius:10px;color:#92400e;font-size:0.78rem;text-align:center;">
            <b>DEV mode:</b> SMTP not configured — your code is <b style="font-family:'JetBrains Mono',monospace;letter-spacing:0.1em;">${escapeHtml(opts.devOtp)}</b>
          </div>` : ''}
          <div style="margin-top:10px;text-align:center;font-size:0.82rem;color:#94a3b8;">
            <a class="otp-resend" href="#" style="color:#6366f1;font-weight:600;text-decoration:none;">Resend code</a>
          </div>
        </div>
        <div style="display:flex;gap:10px;padding:1.2rem 1.5rem 1.5rem;">
          <button class="otp-cancel" style="flex:1;padding:0.85rem 1rem;border-radius:12px;border:1px solid rgba(99,102,241,0.2);background:rgba(99,102,241,0.08);color:#6366f1;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.92rem;">Cancel</button>
          <button class="otp-verify" style="flex:1;padding:0.85rem 1rem;border-radius:12px;border:none;background:linear-gradient(135deg,#6366f1,#ec4899);color:white;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.92rem;box-shadow:0 8px 20px rgba(99,102,241,0.35);">
            <i class="fas fa-check"></i> Verify
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    document.body.style.overflow = 'hidden';
    const close = () => { wrap.remove(); document.body.style.overflow = ''; };
    const inp = wrap.querySelector('.otp-input');
    const err = wrap.querySelector('.otp-error');
    const verifyBtn = wrap.querySelector('.otp-verify');
    const resendLink = wrap.querySelector('.otp-resend');
    inp.addEventListener('focus', () => { inp.style.borderColor = '#6366f1'; inp.style.boxShadow = '0 0 0 4px rgba(99,102,241,0.12)'; });
    inp.addEventListener('blur',  () => { inp.style.borderColor = '#eef2ff'; inp.style.boxShadow = 'none'; });
    inp.addEventListener('input', () => { inp.value = inp.value.replace(/\D/g, '').slice(0, 6); });
    inp.focus();

    async function doVerify() {
      err.textContent = '';
      const code = (inp.value || '').trim();
      if (!/^\d{6}$/.test(code)) { err.textContent = 'Enter the 6-digit code.'; return; }
      verifyBtn.disabled = true;
      verifyBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying…';
      try {
        const r = await fetch(`${API_BASE}/otp/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target: opts.target, code, purpose: opts.purpose })
        });
        const d = await r.json();
        if (!r.ok) { err.textContent = d.error || 'Verification failed.'; return; }
        close();
        resolve(d.verification_token);
      } catch (e) {
        err.textContent = 'Network error.';
      } finally {
        verifyBtn.disabled = false;
        verifyBtn.innerHTML = '<i class="fas fa-check"></i> Verify';
      }
    }
    verifyBtn.addEventListener('click', doVerify);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') doVerify(); });
    wrap.querySelector('.otp-cancel').addEventListener('click', () => { close(); reject(new Error('cancelled')); });
    wrap.addEventListener('click', e => { if (e.target === wrap) { close(); reject(new Error('cancelled')); } });
    if (resendLink) {
      resendLink.addEventListener('click', async (e) => {
        e.preventDefault();
        resendLink.textContent = 'Sending…';
        try {
          const r = await fetch(`${API_BASE}/otp/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target: opts.target, target_type: opts.targetType || 'email', purpose: opts.purpose, name: opts.name })
          });
          await r.json();
          resendLink.textContent = 'Code resent';
          err.textContent = '';
        } catch (_) {
          resendLink.textContent = 'Resend failed';
        }
        setTimeout(() => { resendLink.textContent = 'Resend code'; }, 4000);
      });
    }
  });
}
window.openOtpModal = openOtpModal;     // exposed so other pages can reuse
window.escapeHtml   = window.escapeHtml || escapeHtml;
