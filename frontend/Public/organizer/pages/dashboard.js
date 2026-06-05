const API_BASE = 'http://localhost:3000/api';

function getToken() {
    return localStorage.getItem('auth_token') || localStorage.getItem('token') || localStorage.getItem('authToken') || localStorage.getItem('eventhub_token');
}

// Edit mode: tracks which existing additional-image URLs the organizer wants
// to keep. Newly uploaded files are still managed by the file input.
let keptExistingImages = [];

// Resolve a possibly-relative upload URL into something the browser can load.
// Using a same-origin relative path lets nginx proxy /uploads to the backend
// (works in Docker and direct dev), with a fallback to the dev backend port.
function resolveAssetUrl(u) {
    if (!u) return '';
    if (/^https?:\/\//i.test(u)) return u;
    // Browser is already on the frontend origin; nginx proxies /uploads → backend.
    if (u.startsWith('/uploads/')) return u;
    return u.startsWith('/') ? u : `/${u}`;
}

// Image lightbox — click any additional-image thumbnail to expand it. Wired
// once on first call; subsequent calls just swap the src.
function openImageLightbox(src) {
    const lb     = document.getElementById('ev-lightbox');
    const lbImg  = document.getElementById('ev-lightbox-img');
    const lbX    = document.getElementById('ev-lightbox-close');
    if (!lb || !lbImg) return;
    lbImg.src = src;
    lb.classList.add('show');
    document.body.style.overflow = 'hidden';
    if (!lb.dataset.wired) {
        const close = () => {
            lb.classList.remove('show');
            document.body.style.overflow = '';
        };
        lb.addEventListener('click', (e) => { if (e.target === lb) close(); });
        if (lbX) lbX.addEventListener('click', close);
        lbImg.addEventListener('click', close);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && lb.classList.contains('show')) close();
        });
        lb.dataset.wired = '1';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadDashboardStats();
    loadMyEvents();
    setupEventHandlers();
    setupProfileHandlers();
    // Pre-fetch the profile so the avatar in the navbar reflects the user
    // even before they open the Profile section.
    loadProfile().catch(() => {});
    if (window.lucide) lucide.createIcons();
});

function setupEventHandlers() {
    document.getElementById('event-form').addEventListener('submit', handleEventSave);
    document.getElementById('profile-image').addEventListener('change', function() { handleProfileImageChange(this); });
    document.getElementById('ev-files').addEventListener('change', function() { handleFileChange(this); });
    
    ['ev-title', 'ev-cat', 'ev-date', 'ev-loc', 'ev-price', 'ev-seats', 'ev-desc'].forEach(id => {
        document.getElementById(id).addEventListener('input', validateForm);
    });
    
    validateForm();
}

function validateForm() {
    const title = document.getElementById('ev-title').value.trim();
    const category = document.getElementById('ev-cat').value.trim();
    const date = document.getElementById('ev-date').value;
    const location = document.getElementById('ev-loc').value.trim();
    const price = document.getElementById('ev-price').value;
    const seats = document.getElementById('ev-seats').value;
    const description = document.getElementById('ev-desc').value.trim();
    // In edit mode the existing cover image is already on the server; the
    // file input is necessarily empty because browsers can't pre-fill it.
    // Only REQUIRE a fresh image when creating a new event.
    const hasImage = !!editingEventId || document.getElementById('profile-image').files.length > 0;

    const isValid = title && category && date && location && price && seats && description && hasImage;

    document.getElementById('preview-btn').disabled = !isValid;
    document.getElementById('create-btn').disabled = !isValid;
}

function checkAuth() {
    const token = getToken();
    if (!token) {
        window.location.href = '/Public/auth/pages/login.html';
        return;
    }
    
    const userStr = localStorage.getItem('auth_user') || localStorage.getItem('user');
    if (userStr) {
        try {
            const user = JSON.parse(userStr);
            const displayName = user.name || user.username || 'Organizer';
            document.getElementById('top-username').textContent = displayName;
            document.getElementById('drop-username').textContent = displayName;
            document.getElementById('top-email').textContent = user.email || '';
            document.getElementById('drop-email').textContent = user.email || '';
            document.getElementById('user-initials').textContent = displayName.charAt(0).toUpperCase();
        } catch (e) {
            console.error('User parsing error', e);
        }
    }
}

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(`${sectionId}-section`);
    if (target) target.classList.add('active');

    document.querySelectorAll('.sidebar-menu a').forEach(el => el.classList.remove('active'));
    const navItem = document.getElementById(`nav-${sectionId}`);
    if (navItem) navItem.classList.add('active');

    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown) dropdown.classList.remove('active');

    if (sectionId === 'events') loadMyEvents();
    if (sectionId === 'dashboard') loadDashboardStats();
    if (sectionId === 'profile') loadProfile().catch(() => {});
    if (sectionId === 'messages') loadMessageThreads();
    if (sectionId === 'bookings') loadOrganizerBookings();
    if (sectionId === 'earnings') loadEarnings();
    if (sectionId === 'scanner')  loadScanner();
    // Stop the camera if the organizer navigates AWAY from the scanner.
    if (sectionId !== 'scanner' && window.__scnHandle) {
        try { window.__scnHandle.stop().catch(() => {}); } catch (_) {}
        window.__scnHandle = null;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleDropdown() {
    document.getElementById('profile-dropdown').classList.toggle('active');
}

function logout() {
    showLogoutConfirm(() => {
        localStorage.clear();
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
          <p style="opacity:0.95;font-size:0.86rem;margin:0;">You'll need to sign in again to access your dashboard.</p>
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

async function loadDashboardStats() {
    const token = getToken();
    const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    try {
        // Fetch organizer events + their bookings in parallel.
        const [eventsRes, bookingsRes] = await Promise.all([
            fetch(`${API_BASE}/events/my-events`,         { headers: { 'Authorization': `Bearer ${token}` } }),
            fetch(`${API_BASE}/bookings/organizer/all`,   { headers: { 'Authorization': `Bearer ${token}` } }),
        ]);

        // ── Events ──────────────────────────────────────────
        let events = [];
        if (eventsRes.ok) events = await eventsRes.json();
        if (!Array.isArray(events)) events = [];
        const now = Date.now();
        const upcoming = events.filter(ev => ev.event_date && new Date(ev.event_date).getTime() > now).length;
        setText('stat-events',     events.length);
        setText('stat-events-sub', events.length === 0
            ? 'No events yet'
            : `${upcoming} upcoming · ${events.length - upcoming} past`);

        // ── Bookings → Revenue + Attendees ─────────────────
        let bookings = [];
        if (bookingsRes.ok) {
            const data = await bookingsRes.json();
            bookings = Array.isArray(data) ? data : (data.bookings || []);
        }
        // A booking is "confirmed" if it isn't cancelled.
        const confirmed = bookings.filter(b => !b.cancelled_at);
        const cancelled = bookings.filter(b =>  b.cancelled_at);

        const revenue   = confirmed.reduce((sum, b) => sum + (Number(b.total_price)   || 0), 0);
        const refunded  = cancelled.reduce((sum, b) => sum + (Number(b.refund_amount) || 0), 0);
        const attendees = confirmed.reduce((sum, b) => sum + (Number(b.seats_booked)  || 0), 0);

        setText('stat-revenue',     '₹' + revenue.toLocaleString('en-IN'));
        setText('stat-revenue-sub', `from ${confirmed.length} booking${confirmed.length === 1 ? '' : 's'}`
            + (refunded > 0 ? ` · ₹${refunded.toLocaleString('en-IN')} refunded` : ''));

        setText('stat-attendees',     attendees);
        setText('stat-attendees-sub', `${confirmed.length} confirmed · ${cancelled.length} cancelled`);

        // ── Per-event performance — donut chart for each event ─────────
        renderEventPerformance(events, confirmed);
    } catch (error) {
        console.error('Error loading stats:', error);
        setText('stat-events',    '0');
        setText('stat-revenue',   '₹0');
        setText('stat-attendees', '0');
        renderEventPerformance([], []);
    }
}

/**
 * Renders a grid of per-event donut cards under the dashboard stats.
 * Each card shows: event title · date · animated SVG donut · booked/total numbers.
 *
 * Booked seats per event are computed from the bookings list (sum of seats_booked
 * for confirmed bookings on that event), so it stays accurate even if the
 * `available_seats` column gets out of sync with reality.
 */
function renderEventPerformance(events, confirmedBookings) {
    const grid = document.getElementById('events-perf-grid');
    const meta = document.getElementById('events-perf-meta');
    if (!grid) return;

    if (!events || events.length === 0) {
        grid.innerHTML = `
          <div class="perf-empty">
            <div class="ic"><i class="fas fa-calendar-plus"></i></div>
            <div style="font-family:'Space Grotesk',Inter,sans-serif;font-size:1.05rem;font-weight:800;color:var(--ink);">No events yet</div>
            <div style="font-size:0.88rem;margin-top:6px;">Create your first event to see seat-fill stats here.</div>
          </div>`;
        if (meta) meta.textContent = '';
        return;
    }

    // Group bookings by event_id so we can compute seats sold per event.
    const seatsByEvent = {};
    confirmedBookings.forEach(b => {
        const k = b.event_id;
        seatsByEvent[k] = (seatsByEvent[k] || 0) + (Number(b.seats_booked) || 0);
    });

    // Inject the SVG gradient definitions once (referenced by every donut).
    // Four palettes — default indigo→pink, plus green/amber/red for fill states.
    const gradDef = `
      <svg width="0" height="0" style="position:absolute;">
        <defs>
          <linearGradient id="perf-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"  stop-color="#6366f1"/>
            <stop offset="50%" stop-color="#8b5cf6"/>
            <stop offset="100%" stop-color="#ec4899"/>
          </linearGradient>
          <linearGradient id="perf-grad-green" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"  stop-color="#10b981"/>
            <stop offset="100%" stop-color="#06b6d4"/>
          </linearGradient>
          <linearGradient id="perf-grad-amber" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"  stop-color="#f59e0b"/>
            <stop offset="100%" stop-color="#ef4444"/>
          </linearGradient>
          <linearGradient id="perf-grad-red" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"  stop-color="#ef4444"/>
            <stop offset="100%" stop-color="#ec4899"/>
          </linearGradient>
        </defs>
      </svg>`;

    const fmtDate = iso => {
        if (!iso) return 'TBA';
        try {
            const d = new Date(iso);
            return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch (_) { return 'TBA'; }
    };

    // Status pill based on % filled — drives card color theme too.
    function statusFor(pct, total) {
        if (total <= 0)              return { cls: 'empty',   label: '<i class="fas fa-circle-pause"></i> Not set' };
        if (pct >= 100)              return { cls: 'soldout', label: '<i class="fas fa-fire"></i> Sold out' };
        if (pct >= 80)               return { cls: 'almost',  label: '<i class="fas fa-bolt"></i> Almost full' };
        if (pct >= 30)               return { cls: 'filling', label: '<i class="fas fa-arrow-trend-up"></i> Filling fast' };
        return                              { cls: 'low',     label: '<i class="fas fa-seedling"></i> Just started' };
    }

    const cards = events.map(ev => {
        const total  = Math.max(0, Number(ev.total_seats) || 0);
        const booked = Math.min(total, Number(seatsByEvent[ev.id]) || 0);
        const free   = Math.max(0, total - booked);
        const pct    = total > 0 ? Math.round((booked / total) * 100) : 0;
        const C = 2 * Math.PI * 40;
        const dash = (pct / 100) * C;
        const status = statusFor(pct, total);

        return `
          <div class="perf-card ${status.cls}" title="${escapeOrg(ev.title || '')}">
            <div class="perf-head">
              <div style="min-width:0;flex:1;">
                <div class="perf-title">${escapeOrg(ev.title || 'Untitled')}</div>
                <div class="perf-date"><i class="fas fa-calendar-day"></i> ${fmtDate(ev.event_date)}</div>
              </div>
              <span class="perf-pill ${status.cls}">${status.label}</span>
            </div>
            <div class="perf-body">
              <div class="perf-donut">
                <svg viewBox="0 0 100 100">
                  <circle class="perf-donut-track"    cx="50" cy="50" r="40"></circle>
                  <circle class="perf-donut-progress" cx="50" cy="50" r="40"
                          stroke-dasharray="${dash.toFixed(1)} ${(C - dash).toFixed(1)}"></circle>
                </svg>
                <div class="perf-donut-label">
                  <span class="perf-donut-pct">${pct}%</span>
                  <span class="perf-donut-sub">filled</span>
                </div>
              </div>
              <div class="perf-bar-wrap"><div class="perf-bar-fill" style="width:${pct}%"></div></div>
              <div class="perf-mini-row">
                <div class="perf-mini booked">
                  <div class="perf-mini-num">${booked}</div>
                  <div class="perf-mini-lbl">Booked</div>
                </div>
                <div class="perf-mini free">
                  <div class="perf-mini-num">${free}</div>
                  <div class="perf-mini-lbl">Available</div>
                </div>
                <div class="perf-mini cap">
                  <div class="perf-mini-num">${total}</div>
                  <div class="perf-mini-lbl">Capacity</div>
                </div>
              </div>
            </div>
          </div>`;
    }).join('');

    grid.innerHTML = gradDef + cards;
    if (meta) {
        const totalSeats  = events.reduce((s, e) => s + (Number(e.total_seats) || 0), 0);
        const totalBooked = Object.values(seatsByEvent).reduce((s, n) => s + n, 0);
        const overallPct  = totalSeats > 0 ? Math.round((totalBooked / totalSeats) * 100) : 0;
        meta.textContent = `${totalBooked} of ${totalSeats} seats booked · ${overallPct}% overall`;
    }
}

/**
 * Earnings page — KPI cards (Gross / Refund / Net / Avg), top earning events,
 * and a recent transactions table. Pulls from the same /bookings/organizer/all
 * endpoint that the dashboard uses, so numbers stay consistent.
 */
async function loadEarnings() {
    const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const fmtINR  = n => '₹' + (Number(n) || 0).toLocaleString('en-IN');
    const fmtDate = iso => {
        if (!iso) return '—';
        try {
            const d = new Date(iso);
            return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch (_) { return '—'; }
    };
    const token = getToken();

    try {
        const r = await fetch(`${API_BASE}/bookings/organizer/all`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = r.ok ? await r.json() : { bookings: [] };
        const bookings = Array.isArray(data) ? data : (data.bookings || []);

        const confirmed = bookings.filter(b => !b.cancelled_at);
        const cancelled = bookings.filter(b =>  b.cancelled_at);

        const gross   = confirmed.reduce((s, b) => s + (Number(b.total_price)   || 0), 0);
        const refund  = cancelled.reduce((s, b) => s + (Number(b.refund_amount) || 0), 0);
        const net     = gross - refund;
        const avg     = confirmed.length > 0 ? Math.round(gross / confirmed.length) : 0;

        // KPI cards
        setText('earn-gross',     fmtINR(gross));
        setText('earn-gross-sub', confirmed.length > 0
            ? `from ${confirmed.length} booking${confirmed.length === 1 ? '' : 's'}`
            : 'No bookings yet');
        setText('earn-refund',     fmtINR(refund));
        setText('earn-refund-sub', `${cancelled.length} cancellation${cancelled.length === 1 ? '' : 's'}`);
        setText('earn-net',        fmtINR(net));
        setText('earn-net-sub',    'Gross − Refunds');
        setText('earn-avg',        fmtINR(avg));
        setText('earn-avg-sub',    confirmed.length > 0 ? 'across all sales' : '—');

        // Top earning events — group confirmed by event_id, sum total_price.
        const byEvent = {};
        confirmed.forEach(b => {
            const id = b.event_id;
            if (!byEvent[id]) {
                byEvent[id] = { id, title: b.event_title || 'Untitled', revenue: 0, count: 0 };
            }
            byEvent[id].revenue += Number(b.total_price) || 0;
            byEvent[id].count   += 1;
        });
        const top = Object.values(byEvent).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
        const maxRev = top[0] ? top[0].revenue : 0;

        const topListEl = document.getElementById('earn-top-list');
        const topMetaEl = document.getElementById('earn-top-meta');
        if (topListEl) {
            if (top.length === 0) {
                topListEl.innerHTML = `<div class="earn-empty"><i class="fas fa-trophy"></i><br><b>No revenue yet</b><div style="font-size:0.85rem;margin-top:4px;">Once bookings roll in, your top events will appear here.</div></div>`;
            } else {
                const rankCls = ['gold','silver','bronze','',''];
                topListEl.innerHTML = top.map((ev, i) => {
                    const pct = maxRev > 0 ? Math.round((ev.revenue / maxRev) * 100) : 0;
                    return `
                      <div class="earn-top-row ${rankCls[i] || ''}">
                        <div class="earn-top-rank">${i+1}</div>
                        <div class="earn-top-info">
                          <div class="name">${escapeOrg(ev.title)}</div>
                          <div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>
                          <div style="font-size:0.72rem;color:var(--muted);margin-top:4px;">${ev.count} booking${ev.count === 1 ? '' : 's'}</div>
                        </div>
                        <div class="earn-top-amt">${fmtINR(ev.revenue)}</div>
                      </div>`;
                }).join('');
            }
        }
        if (topMetaEl) topMetaEl.textContent = top.length > 0 ? `Top ${top.length} of ${Object.keys(byEvent).length}` : '';

        // Recent transactions — last 10 (any status)
        const recent = bookings.slice(0, 10);
        const txBody = document.getElementById('earn-tx-body');
        const txMeta = document.getElementById('earn-tx-meta');
        if (txBody) {
            if (recent.length === 0) {
                txBody.innerHTML = `<tr><td colspan="6"><div class="earn-empty"><i class="fas fa-receipt"></i><br><b>No transactions yet</b></div></td></tr>`;
            } else {
                txBody.innerHTML = recent.map(b => {
                    const isCancelled = !!b.cancelled_at;
                    return `
                      <tr>
                        <td>${escapeOrg(fmtDate(b.booked_at))}</td>
                        <td class="ev-name">${escapeOrg(b.event_title || '—')}</td>
                        <td class="at-name">${escapeOrg(b.attendee_name || b.ticket_holder_name || '—')}</td>
                        <td>${Number(b.seats_booked) || 0}</td>
                        <td class="amt">${fmtINR(b.total_price)}</td>
                        <td><span class="earn-tx-pill ${isCancelled ? 'cancelled' : 'confirmed'}">${isCancelled ? 'Cancelled' : 'Confirmed'}</span></td>
                      </tr>`;
                }).join('');
            }
        }
        if (txMeta) txMeta.textContent = `Last ${Math.min(10, bookings.length)} of ${bookings.length} bookings`;
    } catch (err) {
        console.error('Failed to load earnings:', err);
        setText('earn-gross', '₹0');
        setText('earn-net',   '₹0');
        setText('earn-avg',   '₹0');
    }
}

/* ─────────────────────────── Ticket Scanner ───────────────────────────
 * In-app QR scanner for the organizer at the venue gate.
 *  - Picks an event → loads live counters
 *  - Camera reads the QR via html5-qrcode → POSTs to /scanner/scan
 *  - Backend rejects duplicates (one scan per seat) and wrong-event scans
 *  - Stats refresh after every successful scan
 * ─────────────────────────────────────────────────────────────────────── */
let scannerStatsTimer = null;
let scannerSelectedEventId = null;

async function loadScanner() {
    const sel = document.getElementById('scn-event-select');
    if (!sel) return;
    const token = getToken();

    // Populate the event dropdown if not already done.
    if (!sel.dataset.loaded) {
        sel.innerHTML = '<option value="">Loading…</option>';
        try {
            const r = await fetch(`${API_BASE}/bookings/scanner/events`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = r.ok ? await r.json() : { events: [] };
            const events = data.events || [];
            if (events.length === 0) {
                sel.innerHTML = '<option value="">No events to scan — create one first.</option>';
                return;
            }
            sel.innerHTML = '<option value="">— Choose one of your events —</option>'
                + events.map(e => {
                    const date = e.event_date ? new Date(e.event_date).toLocaleDateString() : '';
                    return `<option value="${e.id}">${escapeOrg(e.title || 'Untitled')}${date ? ' · ' + date : ''} (${e.scanned_count || 0}/${e.booked_seats || 0} scanned)</option>`;
                }).join('');
            sel.dataset.loaded = '1';
        } catch (err) {
            console.error('Scanner events load:', err);
            sel.innerHTML = '<option value="">Failed to load events.</option>';
            return;
        }

        // Bind the change handler once.
        sel.addEventListener('change', () => {
            const id = parseInt(sel.value, 10);
            if (!Number.isFinite(id)) {
                document.getElementById('scn-stats').style.display       = 'none';
                document.getElementById('scn-camera-wrap').style.display = 'none';
                document.getElementById('scn-recent-wrap').style.display = 'none';
                stopScannerStatsPolling();
                stopScannerCamera();
                scannerSelectedEventId = null;
                return;
            }
            scannerSelectedEventId = id;
            document.getElementById('scn-stats').style.display       = '';
            document.getElementById('scn-camera-wrap').style.display = '';
            document.getElementById('scn-recent-wrap').style.display = '';
            refreshScannerStats();
            startScannerStatsPolling();
        });

        document.getElementById('scn-start-btn').addEventListener('click', startScannerCamera);
        document.getElementById('scn-stop-btn').addEventListener('click',  stopScannerCamera);
    }
}

async function refreshScannerStats() {
    if (!scannerSelectedEventId) return;
    const token = getToken();
    const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    try {
        const r = await fetch(`${API_BASE}/bookings/scanner/event/${scannerSelectedEventId}/stats`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!r.ok) return;
        const s = await r.json();
        setText('scn-total',     s.total_seats || 0);
        setText('scn-booked',    s.booked_seats || 0);
        setText('scn-scanned',   s.scanned_count || 0);
        setText('scn-remaining', s.remaining_to_scan || 0);

        const list = document.getElementById('scn-recent-list');
        const meta = document.getElementById('scn-recent-meta');
        if (list) {
            const items = s.recent_scans || [];
            if (items.length === 0) {
                list.innerHTML = `<div class="earn-empty"><i class="fas fa-circle-info"></i><br>No check-ins yet for this event.</div>`;
            } else {
                list.innerHTML = items.map(c => `
                  <div class="scn-recent-row">
                    <div class="ic"><i class="fas fa-check"></i></div>
                    <div class="info">
                      <div class="nm">${escapeOrg(c.attendee_name || 'Guest')}</div>
                      <div class="code">${escapeOrg(c.seat_code || '')}</div>
                    </div>
                    <div class="when">${formatScanTime(c.checked_in_at)}</div>
                  </div>`).join('');
            }
        }
        if (meta) meta.textContent = `${s.scanned_count || 0} of ${s.booked_seats || 0} checked in`;
    } catch (e) { /* swallow — polling is best-effort */ }
}

function startScannerStatsPolling() {
    stopScannerStatsPolling();
    scannerStatsTimer = setInterval(refreshScannerStats, 5000);
}
function stopScannerStatsPolling() {
    if (scannerStatsTimer) { clearInterval(scannerStatsTimer); scannerStatsTimer = null; }
}

function formatScanTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60)    return 'just now';
    if (diff < 3600)  return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    return d.toLocaleDateString();
}

async function startScannerCamera() {
    if (!scannerSelectedEventId) {
        alert('Please pick an event first.');
        return;
    }
    if (typeof Html5Qrcode === 'undefined') {
        alert('Camera library failed to load. Hard-refresh the page.');
        return;
    }
    document.getElementById('scn-start-btn').style.display = 'none';
    document.getElementById('scn-stop-btn').style.display  = '';

    const handle = new Html5Qrcode('scn-camera');
    window.__scnHandle = handle;
    try {
        await handle.start(
            { facingMode: 'environment' },                 // back camera on mobile
            { fps: 10, qrbox: { width: 240, height: 240 } },
            onScanSuccess,
            () => { /* per-frame failures are normal — silence them */ }
        );
    } catch (e) {
        console.error('Camera start failed:', e);
        showScanResult('error', 'Camera blocked', 'Allow camera access in your browser settings and try again.');
        document.getElementById('scn-start-btn').style.display = '';
        document.getElementById('scn-stop-btn').style.display  = 'none';
        window.__scnHandle = null;
    }
}

async function stopScannerCamera() {
    document.getElementById('scn-start-btn').style.display = '';
    document.getElementById('scn-stop-btn').style.display  = 'none';
    const h = window.__scnHandle;
    if (h) { try { await h.stop(); } catch (_) {} window.__scnHandle = null; }
}

// Throttle: avoid firing the same QR repeatedly while it's still in frame.
let lastScannedText = '';
let lastScannedAt   = 0;
async function onScanSuccess(text) {
    const now = Date.now();
    if (text === lastScannedText && (now - lastScannedAt) < 2500) return;
    lastScannedText = text;
    lastScannedAt   = now;

    // Quick haptic feedback on supported devices.
    if (navigator.vibrate) navigator.vibrate(60);

    const token = getToken();
    try {
        const r = await fetch(`${API_BASE}/bookings/scanner/scan`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ event_id: scannerSelectedEventId, qr_text: text })
        });
        const data = await r.json();
        if (r.ok && data.ok) {
            showScanResult('success', 'Welcome in!',
                `${data.attendee || 'Guest'} · ${data.seat_code || ''}`);
        } else {
            const reason = (data && data.reason) || 'invalid';
            const msgs = {
                'already-scanned': ['Already used',     'This ticket was already scanned.'],
                'cancelled':       ['Cancelled ticket', 'This booking was cancelled.'],
                'wrong-event':     ['Wrong event',      'This ticket is for a different event.'],
                'ticket-not-found':['Invalid ticket',   'No matching booking found.'],
                'not-your-event':  ['Permission denied','You don\'t organize this event.'],
                'event-not-found': ['Event not found',  'Pick an event again.'],
                'empty-qr':        ['Empty QR',         'Scan a valid ticket.'],
                'missing-event-id':['No event picked',  'Pick an event first.']
            };
            const [t, m] = msgs[reason] || ['Scan failed', reason];
            showScanResult(reason === 'already-scanned' ? 'warning' : 'error', t, m);
        }
        refreshScannerStats();
    } catch (e) {
        showScanResult('error', 'Network error', 'Could not reach the server.');
    }
}

function showScanResult(kind, title, body) {
    const el = document.getElementById('scn-result');
    if (!el) return;
    el.className = 'scn-result show ' + (kind || '');
    el.innerHTML = `<b>${escapeOrg(title)}</b>${escapeOrg(body)}`;
    clearTimeout(window.__scnResultTimer);
    window.__scnResultTimer = setTimeout(() => { el.classList.remove('show'); }, 3500);
}

window.loadScanner = loadScanner;

// Cache the latest list of organizer events so the details modal doesn't need
// a second fetch when the user clicks a row.
let myEventsCache = [];

async function loadMyEvents() {
    const container = document.getElementById('events-list-container');
    const token = getToken();

    container.innerHTML = '<p>Loading your events…</p>';

    try {
        const response = await fetch(`${API_BASE}/events/my-events`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            container.innerHTML = '<p style="color:red">Failed to load events</p>';
            return;
        }

        const events = await response.json();
        myEventsCache = Array.isArray(events) ? events : [];

        if (myEventsCache.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No events yet</h3>
                    <p>Create your first event to get started.</p>
                    <button onclick="showSection('create')" class="btn btn-primary"><i class="fas fa-plus"></i> Create Event</button>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table class="events-table">
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Date</th>
                        <th>Venue</th>
                        <th>City</th>
                        <th>Price</th>
                        <th style="text-align:center;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${myEventsCache.map(ev => {
                        const dateStr = ev.event_date ? new Date(ev.event_date).toLocaleDateString() : '—';
                        const price = Number(ev.ticket_price) || 0;
                        return `
                            <tr data-event-id="${ev.id}" title="Click for details">
                                <td><strong>${escapeOrg(ev.title || 'Untitled')}</strong></td>
                                <td>${escapeOrg(dateStr)}</td>
                                <td>${escapeOrg(ev.location || '—')}</td>
                                <td>${escapeOrg(ev.place || '—')}</td>
                                <td>${price > 0 ? '₹' + price : 'Free'}</td>
                                <td style="text-align:center; white-space: nowrap;">
                                    <button class="org-row-share"  data-event-id="${ev.id}" style="background:linear-gradient(135deg,rgba(99,102,241,0.12),rgba(236,72,153,0.12)); color:#ec4899; border:1px solid rgba(236,72,153,0.3); padding:6px 12px; border-radius:8px; font-weight:600; cursor:pointer; margin-right:6px;">
                                        <i class="fas fa-share-nodes"></i> Invite
                                    </button>
                                    <button class="org-row-edit"   data-event-id="${ev.id}" style="background:rgba(99,102,241,0.1); color:#6366f1; border:1px solid rgba(99,102,241,0.25); padding:6px 12px; border-radius:8px; font-weight:600; cursor:pointer; margin-right:6px;">
                                        <i class="fas fa-pen"></i> Edit
                                    </button>
                                    <button class="org-row-delete" data-event-id="${ev.id}" style="background:rgba(239,68,68,0.08); color:#ef4444; border:1px solid rgba(239,68,68,0.25); padding:6px 12px; border-radius:8px; font-weight:600; cursor:pointer;">
                                        <i class="fas fa-trash"></i> Delete
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;

        // Wire up row clicks (open details) and per-row buttons.
        container.querySelectorAll('tr[data-event-id]').forEach(tr => {
            tr.addEventListener('click', (e) => {
                if (e.target.closest('button')) return; // buttons handle themselves
                const id = parseInt(tr.dataset.eventId, 10);
                const ev = myEventsCache.find(x => x.id === id);
                if (ev) openEventDetails(ev);
            });
        });
        container.querySelectorAll('.org-row-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.eventId, 10);
                const ev = myEventsCache.find(x => x.id === id);
                if (ev) setEditMode(ev);
            });
        });
        container.querySelectorAll('.org-row-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.eventId, 10);
                deleteEvent(id);
            });
        });
        container.querySelectorAll('.org-row-share').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.eventId, 10);
                const ev = myEventsCache.find(x => x.id === id);
                if (ev) showInvitationModal({ id: ev.id, title: ev.title });
            });
        });
    } catch (error) {
        console.error('Error fetching events:', error);
        container.innerHTML = '<p style="color:red">Failed to load events</p>';
    }
}

function escapeOrg(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ───────── Event details modal (View / Edit / Delete) ─────────
function openEventDetails(ev) {
    const modal = document.getElementById('ev-detail-modal');
    if (!modal) return;

    document.getElementById('evd-title').textContent    = ev.title || 'Untitled event';
    document.getElementById('evd-category').textContent = ev.category || 'Event';
    document.getElementById('evd-date').textContent     = ev.event_date
        ? new Date(ev.event_date).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'TBD';
    document.getElementById('evd-loc').textContent      = ev.location || '—';
    document.getElementById('evd-place').textContent    = ev.place || '—';
    const price = Number(ev.ticket_price) || 0;
    document.getElementById('evd-price').textContent    = price > 0 ? '₹' + price : 'Free';
    document.getElementById('evd-seats').textContent    = `${ev.available_seats ?? ev.total_seats ?? '—'} / ${ev.total_seats ?? '—'}`;
    document.getElementById('evd-desc').textContent     = ev.description || 'No description provided.';

    const cover = document.getElementById('evd-cover');
    if (ev.image_url) {
        cover.src = ev.image_url.startsWith('http') ? ev.image_url : `${SERVER_URL}${ev.image_url}`;
        cover.style.display = 'block';
    } else {
        cover.removeAttribute('src');
        cover.style.display = 'none';
    }

    const mapEl = document.getElementById('evd-map');
    const mapBtn = document.getElementById('evd-map-btn');
    if (ev.map_url) {
        mapEl.href = ev.map_url;
        mapEl.textContent = ev.map_url;
        mapBtn.href = ev.map_url;
        mapBtn.style.display = '';
    } else {
        mapEl.removeAttribute('href');
        mapEl.textContent = 'Not provided';
        mapBtn.style.display = 'none';
    }

    // Wire up actions for THIS event.
    document.getElementById('evd-edit-btn').onclick = () => { closeEventDetails(); setEditMode(ev); };
    document.getElementById('evd-delete-btn').onclick = () => { closeEventDetails(); deleteEvent(ev.id); };
    document.getElementById('evd-close-btn').onclick = closeEventDetails;
    modal.onclick = (e) => { if (e.target === modal) closeEventDetails(); };

    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeEventDetails() {
    const modal = document.getElementById('ev-detail-modal');
    if (modal) modal.classList.remove('show');
    document.body.style.overflow = '';
}

function handleEventSave(e) {
    e.preventDefault();

    const title = document.getElementById('ev-title').value.trim();
    const category = document.getElementById('ev-cat').value.trim();
    const date = document.getElementById('ev-date').value;
    const location = document.getElementById('ev-loc').value.trim();
    const price = document.getElementById('ev-price').value;
    const seats = document.getElementById('ev-seats').value;
    const description = document.getElementById('ev-desc').value.trim();
    // Edit mode keeps the existing cover image; a new file is optional.
    const hasImage = !!editingEventId || document.getElementById('profile-image').files.length > 0;

    if (!title || !category || !date || !location || !price || !seats || !description || !hasImage) {
        const msg = editingEventId
            ? 'Please fill all required fields'
            : 'Please fill all required fields including profile image';
        (window.Popup && window.Popup.error) ? window.Popup.error(msg) : alert(msg);
        return;
    }

    // The "Save Event" button (the form submit) is the primary create action.
    // Forward to createEvent() so submitting actually persists the event.
    createEvent();
}

function handleProfileImageChange(input) {
    const file = input.files[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB');
            input.value = '';
            validateForm();
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('profile-preview').innerHTML = `<img src="${e.target.result}" alt="Preview" style="width:100%; height:100%; object-fit:cover;">`;
        };
        reader.readAsDataURL(file);
    }
    validateForm();
}

function handleFileChange(input) {
    const files = Array.from(input.files).slice(0, 10);
    const container = document.getElementById('images-row');
    // Re-render kept thumbnails first, then append previews of newly chosen files.
    renderKeptImagesRow();

    files.forEach(file => {
        if (file.size > 5 * 1024 * 1024) {
            alert(`File ${file.name} is too large`);
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const div = document.createElement('div');
            div.className = 'image-item';
            div.style.cssText = 'position:relative; display:inline-block; margin:6px;';
            div.innerHTML = `
                <img src="${e.target.result}" style="width:120px; height:80px; object-fit:cover; border-radius:8px; display:block; cursor:zoom-in;">
                <span style="position:absolute; top:4px; right:4px; background:rgba(99,102,241,0.85); color:white; font-size:10px; padding:2px 6px; border-radius:999px; font-weight:700;">NEW</span>`;
            div.querySelector('img').addEventListener('click', () => openImageLightbox(e.target.result));
            container.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

// Render the kept-existing-images thumbnails (with × buttons) into #images-row.
// Called when entering edit mode and after the user picks new files (so the
// new-file previews append below the kept ones rather than overwriting them).
function renderKeptImagesRow() {
    const container = document.getElementById('images-row');
    if (!container) return;
    container.innerHTML = '';
    keptExistingImages.forEach((u, idx) => {
        const fullUrl = resolveAssetUrl(u);
        const div = document.createElement('div');
        div.className = 'image-item kept';
        div.style.cssText = 'position:relative; display:inline-block; margin:6px;';
        div.innerHTML = `
            <img src="${fullUrl}" style="width:120px; height:80px; object-fit:cover; border-radius:8px; display:block; cursor:zoom-in;">
            <button type="button" data-idx="${idx}" aria-label="Remove image"
                    style="position:absolute; top:-8px; right:-8px; width:24px; height:24px; border:none; border-radius:50%; background:#ef4444; color:white; cursor:pointer; box-shadow:0 4px 10px rgba(239,68,68,0.4); font-size:13px; line-height:1; display:grid; place-items:center;">
                <i class="fas fa-times"></i>
            </button>`;
        div.querySelector('img').addEventListener('click', () => openImageLightbox(fullUrl));
        div.querySelector('button').addEventListener('click', (e) => {
            e.stopPropagation();
            keptExistingImages.splice(idx, 1);
            renderKeptImagesRow();
        });
        container.appendChild(div);
    });
}

function previewEvent() {
    const title = document.getElementById('ev-title').value;
    const date = document.getElementById('ev-date').value;
    const location = document.getElementById('ev-loc').value;
    const price = document.getElementById('ev-price').value;
    const seats = document.getElementById('ev-seats').value;
    const description = document.getElementById('ev-desc').value;
    const profileImg = document.getElementById('profile-preview').querySelector('img');
    
    document.getElementById('preview-title').textContent = title;
    document.getElementById('preview-date').textContent = new Date(date).toLocaleDateString();
    document.getElementById('preview-location').textContent = location;
    document.getElementById('preview-price').textContent = `₹${price}`;
    document.getElementById('preview-seats').textContent = seats;
    document.getElementById('preview-description').textContent = description;
    
    if (profileImg) {
        document.getElementById('preview-image').src = profileImg.src;
        document.getElementById('preview-image').style.display = 'block';
    }
    
    document.getElementById('event-preview').style.display = 'block';
    document.getElementById('event-preview').scrollIntoView({ behavior: 'smooth' });
    
    lucide.createIcons();
}

// Edit-mode state. When set, the form submits a PUT to /api/events/:id
// instead of creating a new event.
let editingEventId = null;

function setEditMode(event) {
    // Pre-fill the form from the given event row, switch UI to "Update event".
    editingEventId = event.id;
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
    setVal('ev-title', event.title);
    setVal('ev-cat', event.category);
    setVal('ev-date', event.event_date ? new Date(event.event_date).toISOString().slice(0, 16) : '');
    setVal('ev-loc', event.location);
    setVal('ev-place', event.place);
    setVal('ev-map', event.map_url);
    setVal('ev-price', event.ticket_price);
    setVal('ev-seats', event.total_seats);
    setVal('ev-desc', event.description);

    // Reserved seating: restore the toggle + saved row layout when editing.
    const reservedEl = document.getElementById('ev-reserved');
    if (reservedEl) {
        reservedEl.checked = !!event.reserved_seating;
        reservedEl.dispatchEvent(new Event('change'));
        if (event.reserved_seating && event.seating_layout && typeof window.__loadSeatingLayout === 'function') {
            window.__loadSeatingLayout(event.seating_layout);
        }
    }

    // Show existing cover image as preview (without re-uploading).
    const cover = event.image_url ? resolveAssetUrl(event.image_url) : null;
    if (cover) {
        document.getElementById('profile-preview').innerHTML = `<img src="${cover}" alt="Cover" style="width:100%;height:100%;object-fit:cover;">`;
    } else {
        document.getElementById('profile-preview').innerHTML =
            `<div class="profile-placeholder"><i class="fas fa-image" style="font-size:2rem"></i><span>Event Cover</span></div>`;
    }

    // Show existing additional images as thumbnails. Each has a remove (×)
    // button so the organizer can drop individual photos. Whatever survives
    // is sent back to the server as `kept_images` on save.
    keptExistingImages = Array.isArray(event.images) ? event.images.slice() : [];
    renderKeptImagesRow();

    // Update headings + button labels.
    const formTitle = document.getElementById('form-title');
    if (formTitle) formTitle.textContent = 'Edit event';
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-floppy-disk"></i> Update event';
    const createBtn = document.getElementById('create-btn');
    if (createBtn) {
        createBtn.innerHTML = '<i class="fas fa-rotate"></i> Save changes';
        createBtn.disabled = false;
    }
    const previewBtn = document.getElementById('preview-btn');
    if (previewBtn) previewBtn.disabled = false;

    showSection('create');
}

function clearEditMode() {
    editingEventId = null;
    keptExistingImages = [];
    const formTitle = document.getElementById('form-title');
    if (formTitle) formTitle.textContent = 'Create New Event';
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-floppy-disk"></i> Save Event';
    const createBtn = document.getElementById('create-btn');
    if (createBtn) createBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Create Event';
}

async function createEvent() {
    const token = getToken();
    const isEdit = !!editingEventId;
    const btn = document.getElementById('create-btn');

    btn.disabled = true;
    btn.innerHTML = isEdit ? 'Saving…' : 'Creating…';

    const formData = new FormData();
    formData.append('title',        document.getElementById('ev-title').value.trim());
    formData.append('category',     document.getElementById('ev-cat').value.trim());
    formData.append('event_date',   document.getElementById('ev-date').value);
    formData.append('location',     document.getElementById('ev-loc').value.trim());
    formData.append('ticket_price', document.getElementById('ev-price').value);
    formData.append('total_seats',  document.getElementById('ev-seats').value);
    formData.append('description',  document.getElementById('ev-desc').value.trim());

    // New optional fields.
    const placeEl = document.getElementById('ev-place');
    const mapEl   = document.getElementById('ev-map');
    if (placeEl && placeEl.value.trim()) formData.append('place',   placeEl.value.trim());
    if (mapEl   && mapEl.value.trim())   formData.append('map_url', mapEl.value.trim());

    // Reserved seating (live seat map). When enabled, capacity + price are
    // derived from the row layout on the backend.
    const reserved = (typeof window.__isReservedSeating === 'function') && window.__isReservedSeating();
    if (reserved) {
      const layout = window.__getSeatingLayout ? window.__getSeatingLayout() : { rows: [] };
      const hasRows  = layout && Array.isArray(layout.rows)  && layout.rows.length  > 0;
      const hasZones = layout && Array.isArray(layout.zones) && layout.zones.length > 0; // legacy
      if (!hasRows && !hasZones) {
        const msg = 'Reserved seating is on — enter the rows & seats per row, click “Build rows”, then set each row before saving.';
        (window.Popup && window.Popup.error) ? window.Popup.error(msg) : alert(msg);
        btn.disabled = false; btn.innerHTML = isEdit ? 'Save Event' : 'Save Event';
        return;
      }
      formData.append('reserved_seating', 'true');
      formData.append('seating_layout', JSON.stringify(layout));
    } else {
      formData.append('reserved_seating', 'false');
    }

    const profileImage = document.getElementById('profile-image').files[0];
    if (profileImage) formData.append('image', profileImage);

    const additionalImages = document.getElementById('ev-files').files;
    for (let i = 0; i < additionalImages.length; i++) {
        formData.append('images', additionalImages[i]);
    }

    // On edit, send the list of existing image URLs the organizer chose to
    // keep. The backend merges this with any newly uploaded files and stores
    // the union as the event's images array. Sending `[]` explicitly removes
    // all existing images.
    if (isEdit) {
        formData.append('kept_images', JSON.stringify(keptExistingImages));
    }

    try {
        const url    = isEdit ? `${API_BASE}/events/${editingEventId}` : `${API_BASE}/events`;
        const method = isEdit ? 'PUT' : 'POST';
        const response = await fetch(url, {
            method,
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            const title = (result.event && result.event.title) || result.title || 'Event';
            const newId = (result.event && result.event.id) || result.id;
            (window.Popup && window.Popup.success)
                ? window.Popup.success(isEdit ? `“${title}” updated successfully` : `Event “${title}” created successfully`)
                : alert(isEdit ? 'Event updated' : `Event "${title}" created successfully!`);
            document.getElementById('event-form').reset();
            document.getElementById('profile-preview').innerHTML =
                `<div class="profile-placeholder"><i class="fas fa-image" style="font-size:2rem"></i><span>Event Cover</span></div>`;
            document.getElementById('images-row').innerHTML = '';
            document.getElementById('event-preview').style.display = 'none';
            clearEditMode();
            validateForm();
            loadDashboardStats();
            // Surface the auto-generated invitation card so the organizer can share it right away.
            if (!isEdit && newId) {
                showInvitationModal({ id: newId, title });
            } else {
                showSection('events');
            }
        } else {
            (window.Popup && window.Popup.error)
                ? window.Popup.error(result.error || (isEdit ? 'Failed to update event' : 'Failed to create event'))
                : alert(`Error: ${result.error}`);
        }
    } catch (error) {
        (window.Popup && window.Popup.error)
            ? window.Popup.error(isEdit ? 'Failed to update event' : 'Failed to create event')
            : alert(isEdit ? 'Failed to update event' : 'Failed to create event');
    } finally {
        btn.disabled = false;
        btn.innerHTML = editingEventId
            ? '<i class="fas fa-rotate"></i> Save changes'
            : '<i class="fas fa-plus-circle"></i> Create Event';
        if (window.lucide && window.lucide.createIcons) lucide.createIcons();
    }
}

async function deleteEvent(eventId) {
    const ok = (window.Popup && window.Popup.confirm)
        ? await window.Popup.confirm('This event will be permanently removed and any bookings will lose their reference. This cannot be undone.', {
            title: 'Delete this event?',
            okLabel: 'Yes, delete',
            cancelLabel: 'Keep it',
            type: 'error'
          })
        : window.confirm('Are you sure you want to delete this event?');
    if (!ok) return;

    const token = getToken();
    try {
        const response = await fetch(`${API_BASE}/events/${eventId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            (window.Popup && window.Popup.success)
                ? window.Popup.success('Event deleted successfully')
                : alert('Event deleted successfully!');
            loadMyEvents();
            loadDashboardStats();
        } else {
            (window.Popup && window.Popup.error)
                ? window.Popup.error('Failed to delete event')
                : alert('Failed to delete event');
        }
    } catch (error) {
        (window.Popup && window.Popup.error)
            ? window.Popup.error('Network error while deleting event')
            : alert('Error deleting event');
    }
}

window.showSection = showSection;
window.toggleDropdown = toggleDropdown;
window.logout = logout;
window.previewEvent = previewEvent;
window.createEvent = createEvent;
window.deleteEvent = deleteEvent;
window.showInvitationModal = showInvitationModal;

// ───────── Invitation share modal ─────────
// Generates a shareable invitation link (/Public/invite/?id=<eventId>) and
// presents the organizer with copy + WhatsApp + Twitter + Telegram + email
// share options. Called automatically right after a successful event creation.
function showInvitationModal(ev) {
    if (!ev || !ev.id) return;
    if (document.getElementById('invite-share-wrap')) return;

    const inviteUrl = `${window.location.origin}/Public/invite/?id=${encodeURIComponent(ev.id)}`;
    const shareText = `You're invited to ${ev.title || 'an event'} on EventHub!`;
    const enc = encodeURIComponent;

    const wrap = document.createElement('div');
    wrap.id = 'invite-share-wrap';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:99000;display:flex;align-items:center;justify-content:center;background:rgba(7,9,26,0.65);backdrop-filter:blur(10px);padding:1.5rem;font-family:Inter,Segoe UI,sans-serif;animation:isFade 0.25s ease;';
    wrap.innerHTML = `
      <style>
        @keyframes isFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes isPop  { from { opacity: 0; transform: scale(0.92) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes isSpin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
        @keyframes isFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        .is-share-btn { display:flex;align-items:center;justify-content:center;gap:8px;padding:0.85rem 0.5rem;border-radius:14px;border:none;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.9rem;color:white;transition:transform 0.2s ease, box-shadow 0.2s ease; }
        .is-share-btn:hover { transform: translateY(-2px); }
        .is-wa  { background:linear-gradient(135deg,#25d366,#128c7e); box-shadow:0 8px 18px rgba(37,211,102,0.35); }
        .is-tw  { background:linear-gradient(135deg,#0f172a,#334155); box-shadow:0 8px 18px rgba(15,23,42,0.4); }
        .is-tg  { background:linear-gradient(135deg,#2aabee,#0088cc); box-shadow:0 8px 18px rgba(42,171,238,0.35); }
        .is-em  { background:linear-gradient(135deg,#f59e0b,#ec4899); box-shadow:0 8px 18px rgba(245,158,11,0.35); }
        .is-link-input { width:100%;padding:0.85rem 1rem;padding-right:110px;border:2px solid #eef2ff;border-radius:12px;background:#fafbff;font-size:0.86rem;font-family:'JetBrains Mono','Fira Code',monospace;color:#1f2937;outline:none; }
        .is-copy-btn { position:absolute;top:50%;right:6px;transform:translateY(-50%);padding:0.55rem 0.9rem;border-radius:9px;border:none;background:linear-gradient(135deg,#6366f1,#ec4899);color:white;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.78rem;box-shadow:0 4px 10px rgba(99,102,241,0.35); }
      </style>
      <div style="background:white;border-radius:24px;width:100%;max-width:480px;overflow:hidden;box-shadow:0 40px 80px rgba(15,23,42,0.5);animation:isPop 0.4s cubic-bezier(.2,.9,.3,1.2);">
        <div style="position:relative;padding:1.8rem 1.6rem 1.4rem;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 35%,#ec4899 100%);color:white;text-align:center;overflow:hidden;">
          <div style="position:absolute;width:240px;height:240px;border-radius:50%;background:rgba(255,255,255,0.12);top:-100px;right:-80px;"></div>
          <div style="position:absolute;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,0.1);bottom:-80px;left:-60px;"></div>
          <div style="position:relative;z-index:1;">
            <div style="width:64px;height:64px;border-radius:50%;background:white;color:#ec4899;display:grid;place-items:center;font-size:1.6rem;margin:0 auto 0.9rem;box-shadow:0 10px 26px rgba(0,0,0,0.2);animation:isFloat 2.4s ease-in-out infinite;">
              <i class="fas fa-envelope-open-text"></i>
            </div>
            <h3 style="font-family:'Space Grotesk',Inter,sans-serif;font-size:1.3rem;font-weight:800;margin:0 0 6px;">Invitation card is ready! </h3>
            <p style="opacity:0.95;font-size:0.88rem;margin:0;">Share this link to invite people to <b>${escIs(ev.title || 'your event')}</b>.</p>
          </div>
        </div>
        <div style="padding:1.5rem 1.6rem 1.6rem;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;font-size:0.7rem;font-weight:700;color:#94a3b8;letter-spacing:0.12em;text-transform:uppercase;">
            <i class="fas fa-link" style="color:#6366f1;"></i> Invitation link
          </div>
          <div style="position:relative;margin-bottom:16px;">
            <input class="is-link-input" id="is-link" value="${escIs(inviteUrl)}" readonly>
            <button class="is-copy-btn" id="is-copy"><i class="fas fa-copy"></i> Copy</button>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
            <a class="is-share-btn is-wa" target="_blank" rel="noopener" href="https://wa.me/?text=${enc(shareText)}%20${enc(inviteUrl)}">
              <i class="fab fa-whatsapp"></i> WhatsApp
            </a>
            <a class="is-share-btn is-tw" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text=${enc(shareText)}&url=${enc(inviteUrl)}">
              <i class="fab fa-x-twitter"></i> X / Twitter
            </a>
            <a class="is-share-btn is-tg" target="_blank" rel="noopener" href="https://t.me/share/url?url=${enc(inviteUrl)}&text=${enc(shareText)}">
              <i class="fab fa-telegram"></i> Telegram
            </a>
            <a class="is-share-btn is-em" href="mailto:?subject=${enc('You’re invited!')}&body=${enc(shareText + '\n\n' + inviteUrl)}">
              <i class="fas fa-envelope"></i> Email
            </a>
          </div>
          <div style="display:flex;gap:10px;">
            <button id="is-preview" style="flex:1;padding:0.85rem 1rem;border-radius:12px;border:1px solid rgba(99,102,241,0.25);background:rgba(99,102,241,0.08);color:#6366f1;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.92rem;">
              <i class="fas fa-eye"></i> Preview card
            </button>
            <button id="is-done" style="flex:1;padding:0.85rem 1rem;border-radius:12px;border:none;background:linear-gradient(135deg,#10b981,#06b6d4);color:white;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.92rem;box-shadow:0 8px 20px rgba(16,185,129,0.35);">
              <i class="fas fa-check"></i> Done
            </button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    document.body.style.overflow = 'hidden';

    const close = () => { wrap.remove(); document.body.style.overflow = ''; showSection('events'); };
    wrap.querySelector('#is-done').addEventListener('click', close);
    wrap.querySelector('#is-preview').addEventListener('click', () => window.open(inviteUrl, '_blank'));
    wrap.querySelector('#is-copy').addEventListener('click', async () => {
        const inp = wrap.querySelector('#is-link');
        try {
            await navigator.clipboard.writeText(inviteUrl);
        } catch (_) {
            inp.select(); document.execCommand('copy');
        }
        const btn = wrap.querySelector('#is-copy');
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
        btn.style.background = 'linear-gradient(135deg,#10b981,#06b6d4)';
        setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; }, 1800);
    });
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    document.addEventListener('keydown', function esc(ev) {
        if (ev.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
}

function escIs(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ───────── Profile (fetch / update / avatar upload) ─────────
const SERVER_URL = 'http://localhost:3000';
let cachedUserRole = null;

function setAvatarImage(url) {
    const initialEl = document.getElementById('user-initials');
    const profAvatar = document.getElementById('prof-avatar');
    const profInitial = document.getElementById('prof-avatar-initial');
    if (!initialEl || !profAvatar) return;

    if (url) {
        const full = url.startsWith('http') ? url : SERVER_URL + url;
        initialEl.innerHTML = `<img src="${full}" alt="Avatar">`;
        // Replace just the initial node inside the big avatar (preserve the camera button + file input).
        if (profInitial) {
            profInitial.outerHTML = `<img id="prof-avatar-initial" src="${full}" alt="Avatar">`;
        } else {
            const img = profAvatar.querySelector('img#prof-avatar-initial');
            if (img) img.src = full;
        }
    }
}

function setAvatarInitial(letter) {
    const initialEl = document.getElementById('user-initials');
    const profInitial = document.getElementById('prof-avatar-initial');
    if (initialEl && !initialEl.querySelector('img')) initialEl.textContent = letter;
    if (profInitial && profInitial.tagName === 'SPAN') profInitial.textContent = letter;
}

async function loadProfile() {
    const token = getToken();
    if (!token) return;
    try {
        const res = await fetch(`${API_BASE}/auth/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const u = await res.json();
        cachedUserRole = u.role || null;

        // Header / dropdown
        const display = u.name || u.username || 'Organizer';
        const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v || ''; };
        setText('top-username', display);
        setText('drop-username', display);
        setText('top-email', u.email || '');
        setText('drop-email', u.email || '');
        setAvatarInitial((display.charAt(0) || 'U').toUpperCase());
        if (u.profile_image) setAvatarImage(u.profile_image);

        // Profile section header card
        setText('prof-display-name', display);
        setText('prof-display-email', u.email || '');
        setText('prof-display-role', (u.role || 'user').toUpperCase());

        // Personal form fields
        const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
        setVal('prof-name', u.name);
        setVal('prof-email', u.email);
        setVal('prof-mobile', u.mobile);
        setVal('prof-role', u.role);
        setVal('prof-address', u.address);

        // Org block — only for organizers
        const orgBlock = document.getElementById('prof-org-block');
        if (u.role === 'organizer') {
            if (orgBlock) orgBlock.style.display = '';
            setVal('prof-org-name', u.organization_name);
            setVal('prof-org-phone', u.organization_phone);
            setVal('prof-org-address', u.organization_address);
            setVal('prof-org-website', u.organization_website);
            setVal('prof-org-description', u.organization_description);
        } else if (orgBlock) {
            orgBlock.style.display = 'none';
        }

        // Keep localStorage roughly in sync (other pages may read from it).
        try {
            const cached = JSON.parse(localStorage.getItem('auth_user') || localStorage.getItem('user') || '{}');
            const merged = Object.assign(cached, {
                id: u.id, name: u.name, email: u.email, mobile: u.mobile,
                role: u.role, profile_image: u.profile_image
            });
            localStorage.setItem('auth_user', JSON.stringify(merged));
        } catch (_) {}
    } catch (err) {
        console.warn('Failed to load profile', err);
    }
}

function setupProfileHandlers() {
    const form = document.getElementById('profile-form');
    if (form) form.addEventListener('submit', saveProfile);

    const fileInput = document.getElementById('prof-avatar-input');
    if (fileInput) fileInput.addEventListener('change', handleAvatarChange);
}

async function saveProfile(e) {
    e.preventDefault();
    const token = getToken();
    const btn = document.getElementById('prof-save-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…'; }

    const payload = {
        name: document.getElementById('prof-name').value.trim(),
        email: document.getElementById('prof-email').value.trim(),
        mobile: document.getElementById('prof-mobile').value.trim(),
        address: document.getElementById('prof-address').value.trim()
    };
    if (cachedUserRole === 'organizer') {
        payload.organization_name = document.getElementById('prof-org-name').value.trim();
        payload.organization_phone = document.getElementById('prof-org-phone').value.trim();
        payload.organization_address = document.getElementById('prof-org-address').value.trim();
        payload.organization_website = document.getElementById('prof-org-website').value.trim();
        payload.organization_description = document.getElementById('prof-org-description').value.trim();
    }

    try {
        const res = await fetch(`${API_BASE}/auth/update-profile`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            alert(data.message || 'Profile updated successfully');
            await loadProfile();
        } else {
            alert(data.message || 'Update failed');
        }
    } catch (err) {
        alert('Network error while saving profile');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-floppy-disk"></i> Save Changes'; }
    }
}

async function handleAvatarChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5 MB'); e.target.value = ''; return; }

    // Optimistic local preview
    const reader = new FileReader();
    reader.onload = ev => setAvatarImage(ev.target.result);
    reader.readAsDataURL(file);

    const token = getToken();
    const fd = new FormData();
    fd.append('avatar', file);
    try {
        const res = await fetch(`${API_BASE}/auth/upload-avatar`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: fd
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.profile_image) {
            setAvatarImage(data.profile_image);
        } else {
            alert(data.message || 'Avatar upload failed');
        }
    } catch (err) {
        alert('Network error while uploading avatar');
    } finally {
        e.target.value = '';
    }
}

window.loadProfile = loadProfile;
window.saveProfile = saveProfile;

// ───────── Messages section (inline thread list) ─────────
function presence(lastSeenIso) {
    if (!lastSeenIso) return { online: false, label: 'Offline' };
    const t = new Date(lastSeenIso).getTime();
    if (isNaN(t)) return { online: false, label: 'Offline' };
    const diffSec = (Date.now() - t) / 1000;
    if (diffSec < 60)    return { online: true,  label: 'Online' };
    if (diffSec < 3600)  return { online: false, label: 'Last seen ' + Math.floor(diffSec / 60)   + 'm ago' };
    if (diffSec < 86400) return { online: false, label: 'Last seen ' + Math.floor(diffSec / 3600) + 'h ago' };
    return { online: false, label: 'Last seen ' + Math.floor(diffSec / 86400) + 'd ago' };
}
function relTimeOrg(iso) {
    if (!iso) return '';
    const d = new Date(iso); if (isNaN(d)) return '';
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60)     return 'just now';
    if (diff < 3600)   return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400)  return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return d.toLocaleDateString();
}
function escOrg(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function initialsOrg(name) {
    if (!name) return '?';
    const p = String(name).trim().split(/\s+/);
    return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase();
}

let _msgPollTimer = null;

async function loadMessageThreads() {
    const list    = document.getElementById('msg-thread-list');
    const summary = document.getElementById('msg-summary');
    if (!list) return;
    const token = getToken();
    if (!token) return;
    try {
        const res = await fetch(`${API_BASE}/messages/threads`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        const threads = data.threads || [];

        if (threads.length === 0) {
            if (summary) summary.textContent = 'No conversations yet.';
            list.innerHTML = `
                <div class="msg-empty">
                    <i class="fas fa-comments"></i>
                    <h3>No messages yet</h3>
                    <p>Once attendees of your events message you, threads appear here.</p>
                </div>`;
            return;
        }

        const totalUnread = threads.reduce((s, t) => s + (t.unread || 0), 0);
        if (summary) {
            summary.innerHTML = `Showing <b>${threads.length}</b> conversation${threads.length === 1 ? '' : 's'}`
                + (totalUnread > 0 ? ` · <span style="color:var(--danger);font-weight:700;">${totalUnread} unread</span>` : '');
        }

        list.innerHTML = threads.map(t => {
            const ava = t.other_avatar
                ? `<img src="${escOrg(t.other_avatar.startsWith('http') ? t.other_avatar : SERVER_URL + t.other_avatar)}" alt="">`
                : escOrg(initialsOrg(t.other_name));
            const pres = presence(t.other_last_seen);
            const previewPrefix = (t.last_sender_id === (cachedUser && cachedUser.id)) ? '<b>You:</b> ' : '';
            return `
                <div class="msg-thread-row"
                     data-event-id="${t.event_id}" data-other-id="${t.other_id}"
                     data-event-title="${escOrg(t.event_title)}"
                     data-other-name="${escOrg(t.other_name)}"
                     data-other-avatar="${escOrg(t.other_avatar || '')}"
                     data-other-last-seen="${escOrg(t.other_last_seen || '')}">
                    <div class="ava">
                        ${ava}
                        <span class="pdot ${pres.online ? 'online' : ''}" title="${escOrg(pres.label)}"></span>
                    </div>
                    <div class="meta">
                        <div class="top">
                            <span class="name">${escOrg(t.other_name)}</span>
                            <span class="when">${escOrg(relTimeOrg(t.last_at))}</span>
                        </div>
                        <div class="preview">${previewPrefix}${escOrg(t.last_body || '—')}</div>
                        <div class="below">
                            <span class="ev"><i class="fas fa-calendar-day"></i> ${escOrg(t.event_title)}</span>
                            <span class="pres ${pres.online ? 'online' : ''}" style="margin-left:auto;">${pres.online ? '● Online' : escOrg(pres.label)}</span>
                        </div>
                    </div>
                    ${t.unread > 0 ? `<span class="pill">${t.unread}</span>` : ''}
                </div>`;
        }).join('');

        // Wire row clicks → open the chat widget pre-filled with this thread.
        list.querySelectorAll('.msg-thread-row').forEach(row => {
            row.addEventListener('click', () => {
                if (window.EHChat && window.EHChat.openThread) {
                    window.EHChat.openThread({
                        eventId:       parseInt(row.dataset.eventId, 10),
                        otherId:       parseInt(row.dataset.otherId, 10),
                        eventTitle:    row.dataset.eventTitle,
                        otherName:     row.dataset.otherName,
                        otherAvatar:   row.dataset.otherAvatar,
                        otherLastSeen: row.dataset.otherLastSeen
                    });
                }
            });
        });
    } catch (err) {
        console.warn('Failed to load message threads', err);
        if (summary) summary.textContent = 'Couldn\'t load messages.';
    }
}

// Track the cached user id for "You: …" preview detection above.
let cachedUser = null;
(function loadCachedUser() {
    try {
        cachedUser = JSON.parse(localStorage.getItem('auth_user') || localStorage.getItem('user') || 'null');
    } catch (_) { cachedUser = null; }
})();

// Refresh the thread list every 6s while the Messages section is visible.
function startMessagesPolling() {
    stopMessagesPolling();
    _msgPollTimer = setInterval(() => {
        const sec = document.getElementById('messages-section');
        if (sec && sec.classList.contains('active')) loadMessageThreads();
    }, 6000);
}
function stopMessagesPolling() {
    if (_msgPollTimer) { clearInterval(_msgPollTimer); _msgPollTimer = null; }
}
startMessagesPolling();

// Refresh button
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('msg-refresh-btn');
    if (btn) btn.addEventListener('click', loadMessageThreads);
});

// ───────── Bookings section (organizer view: list of all attendees) ─────────
let _bkAll = [];        // cache of all bookings for the organizer
let _bkStatus = 'all';  // active filter pill: all | confirmed | cancelled
let _bkSearch = '';     // free-text search

async function loadOrganizerBookings() {
    const list    = document.getElementById('bk-list');
    const summary = document.getElementById('bk-summary');
    if (!list) return;
    const token = getToken();
    if (!token) return;

    list.innerHTML = '<p style="text-align:center;padding:1.5rem;color:var(--muted);"><i class="fas fa-spinner fa-spin"></i> Loading bookings…</p>';
    try {
        const res = await fetch(`${API_BASE}/bookings/organizer/all`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        _bkAll = Array.isArray(data.bookings) ? data.bookings : [];
        renderBookingStats(_bkAll);
        renderBookingsList();
    } catch (err) {
        console.warn('Failed to load organizer bookings', err);
        if (summary) summary.textContent = 'Couldn\'t load bookings.';
        list.innerHTML = '';
    }
}

function renderBookingStats(rows) {
    const totalBookings = rows.length;
    const confirmed     = rows.filter(b => b.status !== 'cancelled');
    const cancelled     = rows.filter(b => b.status === 'cancelled');
    const seatsSold     = confirmed.reduce((s, b) => s + (parseInt(b.seats_booked, 10) || 0), 0);
    const revenue       = confirmed.reduce((s, b) => s + (parseFloat(b.total_price) || 0), 0);

    const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setText('bk-stat-total',   totalBookings);
    setText('bk-stat-seats',   seatsSold);
    setText('bk-stat-revenue', '₹' + Math.round(revenue));
    setText('bk-stat-cancel',  cancelled.length);
}

function renderBookingsList() {
    const list    = document.getElementById('bk-list');
    const summary = document.getElementById('bk-summary');
    if (!list) return;

    const term = _bkSearch.trim().toLowerCase();
    const filtered = _bkAll.filter(b => {
        if (_bkStatus === 'confirmed' && b.status === 'cancelled') return false;
        if (_bkStatus === 'cancelled' && b.status !== 'cancelled') return false;
        if (!term) return true;
        const hay = [
            b.attendee_name, b.attendee_email, b.attendee_mobile,
            b.ticket_holder_name, b.ticket_holder_email,
            b.event_title, b.ticket_id
        ].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(term);
    });

    if (summary) {
        summary.innerHTML = `Showing <b>${filtered.length}</b> of <b>${_bkAll.length}</b> ${_bkAll.length === 1 ? 'booking' : 'bookings'}`;
    }

    if (filtered.length === 0) {
        list.innerHTML = `
          <div class="bk-empty">
            <i class="fas fa-ticket"></i>
            <h3>${_bkAll.length === 0 ? 'No bookings yet' : 'No bookings match these filters'}</h3>
            <p style="color:var(--muted);">${_bkAll.length === 0
                ? 'When attendees book your events, they\'ll appear here with their full contact details.'
                : 'Try clearing the search or switching the status filter.'}</p>
          </div>`;
        return;
    }

    list.innerHTML = filtered.map(b => {
        const ava = b.attendee_avatar
            ? `<img src="${escapeOrg(b.attendee_avatar.startsWith('http') ? b.attendee_avatar : SERVER_URL + b.attendee_avatar)}" alt="">`
            : escapeOrg(initialsOrg(b.ticket_holder_name || b.attendee_name));
        const eventDate = b.event_date ? new Date(b.event_date) : null;
        const eventDateStr = eventDate && !isNaN(eventDate)
            ? eventDate.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
            : '—';
        const bookedAt = b.booked_at ? relTimeOrg(b.booked_at) : '';
        const total = parseFloat(b.total_price) || 0;
        const isFree = total <= 0;
        const isCancelled = b.status === 'cancelled';
        const seats = parseInt(b.seats_booked, 10) || 0;
        const holderName = b.ticket_holder_name || b.attendee_name || '—';
        const holderEmail = b.ticket_holder_email || b.attendee_email || '';
        const holderMobile = b.ticket_holder_mobile || b.attendee_mobile || '';

        return `
            <div class="bk-row ${isCancelled ? 'cancelled-row' : ''}">
                <div class="bk-ava">${ava}</div>
                <div class="bk-info">
                    <div class="name">${escapeOrg(holderName)}</div>
                    <div class="contact">
                        ${holderEmail  ? `<span><i class="fas fa-envelope"></i> ${escapeOrg(holderEmail)}</span>` : ''}
                        ${holderMobile ? `<span><i class="fas fa-phone"></i> ${escapeOrg(holderMobile)}</span>`   : ''}
                        ${bookedAt     ? `<span><i class="fas fa-clock"></i> Booked ${escapeOrg(bookedAt)}</span>` : ''}
                    </div>
                    <div class="event">
                        <span class="ev-title"><i class="fas fa-calendar-day"></i> ${escapeOrg(b.event_title || 'Event')}</span>
                        <span class="meta"><i class="fas fa-calendar"></i> ${escapeOrg(eventDateStr)}</span>
                        ${b.event_location ? `<span class="meta"><i class="fas fa-map-marker-alt"></i> ${escapeOrg(b.event_location)}</span>` : ''}
                    </div>
                    ${b.ticket_id ? `<div class="ticket">#${escapeOrg(b.ticket_id)}${b.transaction_id ? ' · TXN ' + escapeOrg(b.transaction_id) : ''}</div>` : ''}
                    ${isCancelled && b.cancellation_reason ? `
                        <div style="margin-top:8px;padding:8px 12px;background:rgba(239,68,68,0.06);border-left:3px solid rgba(239,68,68,0.4);border-radius:8px;">
                            <div style="font-size:0.7rem;font-weight:700;color:#ef4444;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:2px;">
                                <i class="fas fa-comment-dots"></i> Reason given by attendee
                            </div>
                            <div style="font-size:0.86rem;color:#1f2937;font-style:italic;">"${escapeOrg(b.cancellation_reason)}"</div>
                        </div>
                    ` : (isCancelled ? `
                        <div style="margin-top:6px;font-size:0.78rem;color:#94a3b8;font-style:italic;">
                            <i class="fas fa-comment-slash"></i> No reason provided.
                        </div>
                    ` : '')}
                </div>
                <div class="bk-right">
                    <div class="bk-amount ${isFree ? 'free' : ''}">${isFree ? 'Free' : '₹' + total.toFixed(2)}</div>
                    <div class="bk-seats"><i class="fas fa-chair"></i> ${seats} seat${seats === 1 ? '' : 's'}</div>
                    <span class="bk-status ${isCancelled ? 'cancelled' : 'confirmed'}">${isCancelled ? 'Cancelled' : 'Confirmed'}</span>
                </div>
            </div>`;
    }).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    // Filter pills
    document.querySelectorAll('.bk-pill').forEach(p => {
        p.addEventListener('click', () => {
            _bkStatus = p.dataset.bkStatus;
            document.querySelectorAll('.bk-pill').forEach(x => x.classList.toggle('active', x === p));
            renderBookingsList();
        });
    });
    // Search
    const search = document.getElementById('bk-search');
    if (search) search.addEventListener('input', e => { _bkSearch = e.target.value; renderBookingsList(); });
    // Refresh button
    const refresh = document.getElementById('bk-refresh-btn');
    if (refresh) refresh.addEventListener('click', loadOrganizerBookings);
});

// Live unread badge on the sidebar Messages link.
window.addEventListener('eh-chat-unread', (e) => {
    const n = (e.detail && e.detail.unread) || 0;
    const badge = document.getElementById('nav-messages-badge');
    if (!badge) return;
    if (n > 0) {
        badge.textContent = n > 99 ? '99+' : String(n);
        badge.classList.add('show');
    } else {
        badge.classList.remove('show');
    }
    // If section is visible, refresh the list silently when unread count changes.
    const sec = document.getElementById('messages-section');
    if (sec && sec.classList.contains('active') && n > 0) loadMessageThreads();
});