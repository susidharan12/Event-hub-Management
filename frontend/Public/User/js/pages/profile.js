const API_BASE = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', () => {
    console.log("Profile Page Loaded. Fetching data...");
    fetchUserProfile();
    setupUpdateForm();
});

// 1. Fetch User Details from Database
async function fetchUserProfile() {
    const token = localStorage.getItem('token') || 
                  localStorage.getItem('authToken') || 
                  localStorage.getItem('eventhub_token') ||
                  localStorage.getItem('auth_token') ||
                  (typeof CONFIG !== 'undefined' && CONFIG.STORAGE ? localStorage.getItem(CONFIG.STORAGE.TOKEN) : null);
    
    if (!token || token === 'null' || token === 'undefined') {
        console.error("No token found in localStorage");
        window.location.href = '/Public/auth/pages/login.html'; 
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/auth/profile`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log("Response Status:", response.status);

        if (response.ok) {
            const user = await response.json();
            console.log("User Data Received:", user); // Check your console (F12) to see the keys

            // Update the UI Text (Display)
            document.getElementById('user-name').textContent = user.username || user.name || user.full_name || 'N/A';
            document.getElementById('user-mobile').textContent = user.mobile || user.phone || 'Not set';
            document.getElementById('user-email').textContent = user.email || 'N/A';
            document.getElementById('user-category').textContent = user.role || 'User';

            // Pre-fill the Form Inputs
            document.getElementById('mobile').value = user.mobile || user.phone || '';
            document.getElementById('email').value = user.email || '';
            
            lucide.createIcons();
        } else {
            // Try to log backend error body
            try {
                const errorData = await response.json();
                console.error("Backend Error:", errorData);
            } catch (e) {
                console.error("Backend Error (Non-JSON):", response.status, response.statusText);
            }

            // If unauthorized, do not immediately clear session — show cached profile instead
            if (response.status === 401 || response.status === 403) {
                console.warn('Auth error fetching profile. Showing cached user data (if available).');
                // Attempt to show cached user from various keys
                const cached = localStorage.getItem('user') || localStorage.getItem('auth_user') || localStorage.getItem('authUser') || (typeof CONFIG !== 'undefined' && CONFIG.STORAGE ? localStorage.getItem(CONFIG.STORAGE.USER) : null);
                if (cached) {
                    try {
                        const user = JSON.parse(cached);
                        document.getElementById('user-name').textContent = user.username || user.name || user.full_name || 'N/A';
                        document.getElementById('user-mobile').textContent = user.mobile || user.phone || 'Not set';
                        document.getElementById('user-email').textContent = user.email || 'N/A';
                        document.getElementById('mobile').value = user.mobile || '';
                        document.getElementById('email').value = user.email || '';
                        document.getElementById('user-category').textContent = user.role || 'User';
                    } catch (e) {
                        console.error('Failed to parse cached user:', e);
                    }
                } else {
                    console.warn('No cached user found; redirecting to login.');
                    // Only redirect if nothing useful to show
                    window.location.href = '/Public/auth/pages/login.html';
                }
            }
        }
    } catch (error) {
        console.error("Connection Error:", error);
        document.getElementById('user-category').textContent = "OFFLINE";
        showModal("Connection Error", "Could not connect to the backend server at " + API_BASE);
    }
}

// 2. Handle Profile Update — with OTP gating on email / mobile changes
function setupUpdateForm() {
    const form = document.getElementById('update-form');
    if (!form) return;

    // Snapshot the original values so we can detect actual changes.
    let originalEmail  = document.getElementById('email').value;
    let originalMobile = document.getElementById('mobile').value;
    // Re-read after fetchUserProfile populates the form.
    const refreshOriginals = () => {
        originalEmail  = document.getElementById('email').value;
        originalMobile = document.getElementById('mobile').value;
    };
    setTimeout(refreshOriginals, 1500);

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token') ||
                      localStorage.getItem('authToken') ||
                      localStorage.getItem('eventhub_token') ||
                      localStorage.getItem('auth_token') ||
                      (typeof CONFIG !== 'undefined' && CONFIG.STORAGE ? localStorage.getItem(CONFIG.STORAGE.TOKEN) : null);

        const newEmail  = document.getElementById('email').value.trim();
        const newMobile = document.getElementById('mobile').value.trim();
        const emailChanged  = newEmail  && newEmail  !== originalEmail;
        const mobileChanged = newMobile && newMobile !== originalMobile;

        const payload = { mobile: newMobile, email: newEmail };

        // ── OTP gates ───────────────────────────────────────────────
        try {
            if (emailChanged) {
                payload.email_verification_token =
                    await sendAndVerifyOtp(newEmail, 'email', 'update-email', `Verify your new email`);
            }
            if (mobileChanged) {
                payload.mobile_verification_token =
                    await sendAndVerifyOtp(newMobile, 'mobile', 'update-mobile', `Verify your new mobile`);
            }
        } catch (cancel) {
            // User cancelled the OTP modal — abort the save.
            return;
        }

        try {
            const response = await fetch(`${API_BASE}/auth/update-profile`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                showModal("Success", "Your profile has been updated successfully.");
                fetchUserProfile();
                refreshOriginals();
            } else {
                let errorMsg = "Something went wrong.";
                try { const e = await response.json(); errorMsg = e.message || errorMsg; }
                catch (e) { errorMsg = `Server Error: ${response.status}`; }
                showModal("Update Failed", errorMsg);
            }
        } catch (error) {
            showModal("Error", "Connection lost. Please try again.");
        }
    });
}

// Reusable OTP helper for the profile page — sends an OTP to the new
// target and opens an inline modal to verify it. Returns the verification_token.
function sendAndVerifyOtp(target, target_type, purpose, headerTitle) {
    return new Promise(async (resolve, reject) => {
        try {
            const r = await fetch(`${API_BASE}/otp/send`, {
                method: 'POST', headers: {'Content-Type':'application/json'},
                body: JSON.stringify({ target, target_type, purpose })
            });
            const d = await r.json();
            if (!r.ok) { showModal('Error', d.error || 'Failed to send OTP.'); reject(new Error('send')); return; }
            const token = await profileOtpModal({
                title: headerTitle,
                subtitle: `We sent a 6-digit code to <b>${escapePf(d.delivered_to || target)}</b>.`,
                target, target_type, purpose,
                devOtp: d.devMode ? d.otp : null
            });
            resolve(token);
        } catch (e) { reject(e); }
    });
}

function escapePf(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function profileOtpModal(opts) {
    return new Promise((resolve, reject) => {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'position:fixed;inset:0;z-index:99000;display:flex;align-items:center;justify-content:center;background:rgba(7,9,26,0.6);backdrop-filter:blur(8px);padding:1.5rem;font-family:Inter,Segoe UI,sans-serif;';
        wrap.innerHTML = `
          <div style="background:white;border-radius:22px;width:100%;max-width:420px;overflow:hidden;box-shadow:0 30px 60px rgba(15,23,42,0.4);">
            <div style="position:relative;padding:1.6rem 1.5rem 1.2rem;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 35%,#ec4899 100%);color:white;text-align:center;">
              <div style="width:54px;height:54px;border-radius:50%;background:white;color:#6366f1;display:grid;place-items:center;font-size:1.4rem;margin:0 auto 0.7rem;box-shadow:0 8px 22px rgba(0,0,0,0.18);">
                <i class="fas fa-shield-halved"></i>
              </div>
              <h3 style="font-family:'Space Grotesk',Inter,sans-serif;font-size:1.2rem;font-weight:800;margin:0 0 4px;">${escapePf(opts.title || 'Verify')}</h3>
              <p style="opacity:0.95;font-size:0.86rem;margin:0;">${opts.subtitle || ''}</p>
            </div>
            <div style="padding:1.4rem 1.5rem 0;">
              <input class="pf-otp" inputmode="numeric" maxlength="6" placeholder="• • • • • •" autocomplete="one-time-code" style="
                width:100%;padding:1rem;text-align:center;
                font-family:'JetBrains Mono','Fira Code',monospace;
                font-size:1.6rem;letter-spacing:0.5em;font-weight:700;
                border:2px solid #eef2ff;border-radius:14px;
                background:#fafbff;color:#1f2937;outline:none;transition:all 0.2s;
              ">
              <div class="pf-err" style="margin-top:8px;color:#ef4444;font-size:0.85rem;text-align:center;min-height:18px;"></div>
              ${opts.devOtp ? `<div style="margin-top:6px;padding:8px 12px;background:rgba(245,158,11,0.1);border:1px dashed rgba(245,158,11,0.3);border-radius:10px;color:#92400e;font-size:0.78rem;text-align:center;">
                <b>DEV mode:</b> Code: <b style="font-family:'JetBrains Mono',monospace;letter-spacing:0.1em;">${escapePf(opts.devOtp)}</b>
              </div>` : ''}
            </div>
            <div style="display:flex;gap:10px;padding:1.2rem 1.5rem 1.5rem;">
              <button class="pf-cancel" style="flex:1;padding:0.85rem 1rem;border-radius:12px;border:1px solid rgba(99,102,241,0.2);background:rgba(99,102,241,0.08);color:#6366f1;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.92rem;">Cancel</button>
              <button class="pf-verify" style="flex:1;padding:0.85rem 1rem;border-radius:12px;border:none;background:linear-gradient(135deg,#6366f1,#ec4899);color:white;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.92rem;box-shadow:0 8px 20px rgba(99,102,241,0.35);">
                <i class="fas fa-check"></i> Verify
              </button>
            </div>
          </div>`;
        document.body.appendChild(wrap);
        document.body.style.overflow = 'hidden';
        const close = () => { wrap.remove(); document.body.style.overflow = ''; };
        const inp = wrap.querySelector('.pf-otp');
        const err = wrap.querySelector('.pf-err');
        inp.focus();
        inp.addEventListener('input', () => { inp.value = inp.value.replace(/\D/g, '').slice(0, 6); });
        wrap.querySelector('.pf-verify').addEventListener('click', async () => {
            err.textContent = '';
            const code = (inp.value || '').trim();
            if (!/^\d{6}$/.test(code)) { err.textContent = 'Enter the 6-digit code.'; return; }
            try {
                const r = await fetch(`${API_BASE}/otp/verify`, {
                    method: 'POST', headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({ target: opts.target, code, purpose: opts.purpose })
                });
                const d = await r.json();
                if (!r.ok) { err.textContent = d.error || 'Verification failed.'; return; }
                close(); resolve(d.verification_token);
            } catch (e) { err.textContent = 'Network error.'; }
        });
        wrap.querySelector('.pf-cancel').addEventListener('click', () => { close(); reject(new Error('cancel')); });
        wrap.addEventListener('click', e => { if (e.target === wrap) { close(); reject(new Error('cancel')); } });
    });
}

// 3. Modal Helper
function showModal(title, message) {
    const modal = document.getElementById('modal');
    if (!modal) {
        alert(title + ": " + message);
        return;
    }
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    
    modal.style.display = 'flex';
    
    document.getElementById('modal-confirm').onclick = () => {
        modal.style.display = 'none';
    };
}