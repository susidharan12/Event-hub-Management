document.addEventListener('DOMContentLoaded', () => {
    loadBookings();

    // Tab switching logic. Cards carry data-type = upcoming | past | cancelled.
    // "All Bookings" shows upcoming + past (NOT cancelled — those live in their own tab).
    window.filterBookings = (type) => {
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.classList.remove('active');
            if (type === 'all'       && tab.textContent.includes('All'))      tab.classList.add('active');
            if (type === 'upcoming'  && tab.textContent.includes('Upcoming')) tab.classList.add('active');
            if (type === 'past'      && tab.textContent.includes('Past'))     tab.classList.add('active');
            if (type === 'cancelled' && tab.textContent.includes('Cancel'))   tab.classList.add('active');
        });

        const cards = document.querySelectorAll('.booking-card');
        let visible = 0;
        cards.forEach(card => {
            const t = card.dataset.type;
            const show = (type === 'all') ? (t !== 'cancelled') : (t === type);
            card.style.display = show ? 'flex' : 'none';
            if (show) visible++;
        });

        // If a tab ends up empty, surface a small empty-state message in place
        // of a blank screen.
        const container = document.getElementById('bookingContainer');
        let empty = container.querySelector('.booking-empty-state');
        if (visible === 0) {
            if (!empty) {
                empty = document.createElement('div');
                empty.className = 'booking-empty-state';
                empty.style.cssText = 'text-align:center;padding:3rem 1.5rem;background:linear-gradient(135deg,#eef2ff,#fdf2f8);border:1px dashed rgba(99,102,241,0.3);border-radius:18px;color:var(--muted);';
                container.appendChild(empty);
            }
            const labels = { all: 'No bookings', upcoming: 'No upcoming bookings', past: 'No past events', cancelled: 'No cancelled tickets' };
            empty.innerHTML = `<i class="fas fa-ticket" style="font-size:2rem;background:var(--gradient-hero);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;display:block;margin-bottom:0.5rem;"></i><h3 style="margin-bottom:4px;">${labels[type] || labels.all}</h3><p>Try a different tab.</p>`;
            empty.style.display = 'block';
        } else if (empty) {
            empty.style.display = 'none';
        }
    };
});

// Per-category default look used when an event has no image_url.
const CATEGORY_THEMES = {
    tech:           { gradient: 'linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)', icon: 'fa-microchip' },
    music:          { gradient: 'linear-gradient(135deg, #ec4899 0%, #f59e0b 100%)', icon: 'fa-music' },
    sports:         { gradient: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)', icon: 'fa-futbol' },
    'cultural fest':{ gradient: 'linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)', icon: 'fa-masks-theater' },
    cultural:       { gradient: 'linear-gradient(135deg, #f59e0b 0%, #ec4899 100%)', icon: 'fa-masks-theater' },
    workshop:       { gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', icon: 'fa-screwdriver-wrench' },
    fun:            { gradient: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)', icon: 'fa-face-laugh-beam' },
    concert:        { gradient: 'linear-gradient(135deg, #ec4899 0%, #6366f1 100%)', icon: 'fa-guitar' },
    food:           { gradient: 'linear-gradient(135deg, #ef4444 0%, #f59e0b 100%)', icon: 'fa-utensils' }
};
const DEFAULT_THEME = { gradient: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)', icon: 'fa-calendar-star' };

function themeFor(category) {
    const key = String(category || '').toLowerCase().trim();
    return CATEGORY_THEMES[key] || DEFAULT_THEME;
}

function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

async function loadBookings() {
    const container = document.getElementById('bookingContainer');
    const API_BASE = 'http://localhost:3000/api';
    const SERVER_URL = 'http://localhost:3000';

    const token = localStorage.getItem('token') ||
                  localStorage.getItem('authToken') ||
                  localStorage.getItem('eventhub_token') ||
                  localStorage.getItem('auth_token');

    if (!token) {
        window.location.href = '/Public/auth/pages/login.html';
        return;
    }

    container.innerHTML = '<p style="text-align:center; padding: 2rem;">Loading your bookings...</p>';

    try {
        const response = await fetch(`${API_BASE}/bookings`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to fetch bookings');
        const data = await response.json();
        const bookings = data.bookings || [];

        if (bookings.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 4rem 2rem;">
                    <i class="fas fa-ticket-alt" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 1rem;"></i>
                    <h3 style="font-size: 1.5rem; font-weight: 700; color: #1e293b; margin-bottom: 0.5rem;">No bookings yet</h3>
                    <p style="color: #64748b; margin-bottom: 2rem;">You haven't booked any events yet.</p>
                    <a href="dashboard.html#events" class="btn btn-primary">Browse Events</a>
                </div>`;
            return;
        }

        container.innerHTML = bookings.map(booking => {
            // The bookings GET endpoint joins the events table and returns
            // event fields directly on the booking row (title, event_date,
            // location, image_url, category). The old code looked them up
            // under booking.event which doesn't exist — that's why every
            // card showed "Event Name Unavailable".
            const title = booking.title || booking.event_title || (booking.event && booking.event.title) || 'Event';
            const rawEventDate = booking.event_date || (booking.event && booking.event.event_date);
            const eventDate = rawEventDate ? new Date(rawEventDate) : null;
            const dateValid = eventDate && !isNaN(eventDate);
            const isPast = dateValid ? eventDate < new Date() : false;
            const isCancelled = (booking.status || booking.booking_status) === 'cancelled';
            // data-type drives the tab filter. Cancelled bookings live in their
            // own tab and shouldn't be counted as upcoming/past anymore.
            const type = isCancelled ? 'cancelled' : (isPast ? 'past' : 'upcoming');
            const location = booking.location || booking.event_location || (booking.event && booking.event.location) || 'Location TBD';
            const category = booking.category || booking.event_category || (booking.event && booking.event.category) || '';

            // Image: prefer joined image_url, then images[], then theme fallback.
            let rawImage = booking.image_url || booking.event_image_url
                        || (booking.event && booking.event.image_url)
                        || (booking.images && booking.images[0])
                        || (booking.event && booking.event.images && booking.event.images[0])
                        || '';
            let imageUrl = '';
            if (rawImage) {
                imageUrl = rawImage.startsWith('http') ? rawImage
                         : `${SERVER_URL}${rawImage.startsWith('/') ? '' : '/'}${rawImage}`;
            }

            const theme = themeFor(category);
            const imageStyle = imageUrl
                ? `background-image: url('${escapeHtml(imageUrl)}');`
                : `background: ${theme.gradient};`;

            // Status badge: based on whether the event has happened yet.
            let badgeClass, badgeText;
            if ((booking.status || booking.booking_status) === 'cancelled') {
                badgeClass = 'status-past';
                badgeText  = 'CANCELLED';
            } else if (isPast) {
                badgeClass = 'status-past';
                badgeText  = 'PAST EVENT';
            } else if (dateValid) {
                badgeClass = 'status-confirmed';
                badgeText  = 'UPCOMING';
            } else {
                badgeClass = 'status-pending';
                badgeText  = 'PENDING';
            }

            const dateLabel = dateValid
                ? `${eventDate.toLocaleDateString()} ${eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                : 'Date TBD';

            const ticketRef = booking.ticket_id || booking.transaction_id || `BK-${booking.id}`;

            // Image cell: real image if present; otherwise gradient + centered
            // category icon so the card never looks empty.
            const imageCell = imageUrl
                ? `<div class="event-img" style="${imageStyle}"></div>`
                : `<div class="event-img" style="${imageStyle} display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.92);font-size:2.4rem;filter:drop-shadow(0 6px 16px rgba(0,0,0,0.18));">
                       <i class="fas ${theme.icon}"></i>
                   </div>`;

            return `
                <div class="booking-card" data-type="${type}">
                    ${imageCell}
                    <div class="booking-details">
                        <div class="booking-top">
                            <div>
                                <h3 class="event-name">${escapeHtml(title)}</h3>
                                <div class="event-meta">
                                    <span><i class="far fa-calendar"></i> ${escapeHtml(dateLabel)}</span>
                                    <span><i class="fas fa-map-marker-alt"></i> ${escapeHtml(location)}</span>
                                    ${category ? `<span><i class="fas fa-tag"></i> ${escapeHtml(category)}</span>` : ''}
                                </div>
                            </div>
                            <span class="status-badge ${badgeClass}">${badgeText}</span>
                        </div>
                        <div class="booking-footer">
                            <div>
                                <span style="font-size: 0.8rem; color: var(--gray); display: block;">Ticket ID</span>
                                <span class="ticket-id">#${escapeHtml(ticketRef)}</span>
                            </div>
                            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                                ${isCancelled
                                  ? `<button class="btn btn-primary" onclick="window.location.href='booking.html?id=${booking.event_id}'">
                                        <i class="fas fa-rotate-right"></i> Register again
                                     </button>`
                                  : `<button class="btn btn-primary" onclick="window.location.href='confirmation.html?bookingId=${booking.id}'">View Ticket</button>`}
                                ${(!isCancelled && !isPast)
                                  ? `<button class="btn-cancel-ticket" data-booking-id="${booking.id}" style="
                                        padding: 0.6rem 1.2rem; border-radius: 10px;
                                        background: rgba(239,68,68,0.08); color: #ef4444;
                                        border: 1px solid rgba(239,68,68,0.25);
                                        font-weight: 600; font-size: 0.88rem; cursor: pointer;
                                        transition: all 0.25s ease; font-family: inherit;
                                     "
                                     onmouseover="this.style.background='rgba(239,68,68,0.18)';this.style.transform='translateY(-1px)';"
                                     onmouseout="this.style.background='rgba(239,68,68,0.08)';this.style.transform='';">
                                        <i class="fas fa-xmark"></i> Cancel ticket
                                     </button>`
                                  : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Wire each Cancel button → fetch refund quote → confirm modal → cancel.
        container.querySelectorAll('.btn-cancel-ticket').forEach(btn => {
            btn.addEventListener('click', () => onCancelClicked(parseInt(btn.dataset.bookingId, 10), btn));
        });
    } catch (error) {
        console.error(error);
        container.innerHTML = '<p style="text-align:center; color: red;">Error loading bookings. Please try again later.</p>';
    }
}

// ───────── Cancel-ticket flow (refund preview + confirm) ─────────
async function onCancelClicked(bookingId, btn) {
    const API_BASE = 'http://localhost:3000/api';
    const token = localStorage.getItem('token') || localStorage.getItem('authToken')
               || localStorage.getItem('eventhub_token') || localStorage.getItem('auth_token');
    if (!token) return;

    btn.disabled = true;
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Checking…';

    try {
        const res = await fetch(`${API_BASE}/bookings/${bookingId}/cancel-quote`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        if (!res.ok) {
            const msg = data.error || data.label || 'Could not load cancel quote.';
            if (window.Popup) window.Popup.error(msg); else alert(msg);
            return;
        }

        showRefundConfirm(data, async (reason) => {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cancelling…';
            try {
                const r = await fetch(`${API_BASE}/bookings/${bookingId}/cancel`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ reason: reason || null })
                });
                const j = await r.json();
                if (!r.ok) {
                    if (window.Popup) window.Popup.error(j.error || 'Cancel failed');
                    else alert(j.error || 'Cancel failed');
                    return;
                }
                const successMsg = (data.reason === 'free' || data.total <= 0)
                    ? 'Ticket cancelled. The seat has been returned to the event.'
                    : `Ticket cancelled. ₹${j.refund} will be refunded to your original payment method within 5–7 business days.`;
                if (window.Popup) window.Popup.success(successMsg, 5500);
                else alert(successMsg);
                // Reload the list so the cancelled booking moves to its new state.
                await loadBookings();
            } catch (e) {
                if (window.Popup) window.Popup.error('Network error while cancelling.');
            }
        });
    } catch (e) {
        if (window.Popup) window.Popup.error('Network error.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = orig;
    }
}

// Build a custom centered modal with the refund breakdown — Popup.confirm
// is plain text only, so we render this ourselves using the same look-and-feel.
function showRefundConfirm(quote, onConfirm) {
    // Remove any leftover modal first.
    document.querySelectorAll('.bh-cancel-modal').forEach(m => m.remove());

    const free       = quote.total <= 0 || quote.reason === 'free';
    const eligible   = quote.eligible;
    const total      = Number(quote.total || 0);
    const refund     = Number(quote.refund || 0);
    const deduction  = Number(quote.deduction || 0);
    const pct        = quote.deductionPct || 0;
    const eventTitle = (quote.booking && quote.booking.event_title) || 'this event';
    const hours      = quote.hoursToEvent;

    const headerColor = !eligible ? 'linear-gradient(135deg,#ef4444,#ec4899)'
                      : free      ? 'linear-gradient(135deg,#10b981,#06b6d4)'
                      : 'linear-gradient(135deg,#6366f1,#8b5cf6 35%,#ec4899)';

    const breakdownHtml = free
      ? `<div style="background:linear-gradient(135deg,#ecfdf5,#f0fdf4);border:1px solid rgba(16,185,129,0.18);border-radius:12px;padding:14px 16px;margin:0 1.5rem 1.4rem;">
           <div style="display:flex;justify-content:space-between;font-weight:700;color:#047857;">
             <span><i class="fas fa-gift"></i> Free ticket</span>
             <span>No refund involved</span>
           </div>
           <p style="margin-top:6px;font-size:0.86rem;color:#065f46;">The seat will be returned to the event and your QR code will be permanently invalidated — even a downloaded PDF won't be accepted at the entrance.</p>
         </div>`
      : !eligible
        ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:14px 16px;margin:0 1.5rem 1.4rem;">
             <div style="font-weight:700;color:#b91c1c;"><i class="fas fa-circle-exclamation"></i> Cancellation not allowed</div>
             <p style="margin-top:6px;font-size:0.86rem;color:#7f1d1d;">${esc(quote.label)}</p>
           </div>`
        : `<div style="background:#fafbff;border:1px solid #eef2ff;border-radius:12px;padding:14px 16px;margin:0 1.5rem 1.4rem;">
             <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #e5e7eb;">
               <span style="color:#64748b;">Total paid</span>
               <span style="font-weight:700;">₹${total.toFixed(2)}</span>
             </div>
             <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed #e5e7eb;">
               <span style="color:#64748b;">Cancellation fee (${pct}%)</span>
               <span style="font-weight:700;color:#ef4444;">- ₹${deduction.toFixed(2)}</span>
             </div>
             <div style="display:flex;justify-content:space-between;padding:10px 0 4px;font-size:1.05rem;">
               <span style="color:#1f2937;font-weight:700;">Refund to you</span>
               <span style="font-weight:800;background:linear-gradient(135deg,#10b981,#06b6d4);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">₹${refund.toFixed(2)}</span>
             </div>
             <p style="margin-top:8px;font-size:0.78rem;color:#94a3b8;">${esc(quote.label)}</p>
           </div>`;

    const wrap = document.createElement('div');
    wrap.className = 'bh-cancel-modal';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:99000;display:flex;align-items:center;justify-content:center;background:rgba(7,9,26,0.6);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);padding:1.5rem;animation:bhModalFade 0.22s ease;';
    wrap.innerHTML = `
      <style>
        @keyframes bhModalFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes bhModalZoom { from { opacity: 0; transform: scale(0.94); } to { opacity: 1; transform: scale(1); } }
      </style>
      <div style="background:white;border-radius:22px;width:100%;max-width:480px;overflow:hidden;box-shadow:0 30px 60px rgba(15,23,42,0.4);font-family:'Inter','Segoe UI',sans-serif;animation:bhModalZoom 0.32s cubic-bezier(.2,.9,.3,1.2);">
        <div style="position:relative;padding:1.6rem 1.5rem 1.4rem;background:${headerColor};color:white;text-align:center;overflow:hidden;">
          <div style="width:54px;height:54px;border-radius:50%;background:white;color:${!eligible ? '#ef4444' : free ? '#10b981' : '#6366f1'};display:grid;place-items:center;font-size:1.5rem;margin:0 auto 0.7rem;box-shadow:0 8px 22px rgba(0,0,0,0.18);">
            <i class="fas ${!eligible ? 'fa-circle-exclamation' : free ? 'fa-gift' : 'fa-receipt'}"></i>
          </div>
          <h3 style="font-family:'Space Grotesk','Inter',sans-serif;font-size:1.25rem;font-weight:800;margin:0 0 4px;">${!eligible ? "Can't cancel this ticket" : "Cancel this ticket?"}</h3>
          <p style="opacity:0.9;font-size:0.88rem;margin:0;">${esc(eventTitle)}${typeof hours === 'number' ? ' · ' + esc(formatHours(hours)) : ''}</p>
        </div>
        ${breakdownHtml}
        ${eligible ? `
          <div style="margin:0 1.5rem 1rem;">
            <label style="display:block;font-size:0.72rem;color:#64748b;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:8px;">
              <i class="fas fa-comment-dots" style="color:#6366f1;"></i> Reason for cancellation <span style="color:#94a3b8;font-weight:500;text-transform:none;letter-spacing:0;">(optional — helps the organizer)</span>
            </label>
            <div class="bh-reason-chips" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;"></div>
            <textarea class="bh-reason" rows="2" maxlength="500" placeholder="e.g. Plans changed, can no longer attend…" style="width:100%;padding:0.7rem 0.9rem;border:1px solid #e5e7eb;border-radius:10px;font-family:inherit;font-size:0.9rem;background:#fafbff;color:#1f2937;resize:vertical;outline:none;transition:border-color 0.2s,box-shadow 0.2s;"></textarea>
            <div class="bh-reason-counter" style="text-align:right;font-size:0.7rem;color:#94a3b8;margin-top:4px;">0 / 500</div>
          </div>
        ` : ''}
        <p style="margin:0 1.5rem 1.2rem;color:#475569;font-size:0.86rem;line-height:1.5;">
          <i class="fas fa-shield-halved" style="color:#6366f1;"></i>
          Cancelling will <b>permanently invalidate</b> the QR codes for this booking. Even a previously downloaded ticket PDF won't be accepted at the entrance.
        </p>
        <div style="display:flex;gap:10px;padding:0 1.5rem 1.5rem;">
          <button class="bh-cancel-back" style="flex:1;padding:0.85rem 1rem;border-radius:12px;border:1px solid rgba(99,102,241,0.2);background:rgba(99,102,241,0.08);color:#6366f1;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.92rem;">Keep ticket</button>
          ${eligible ? `
            <button class="bh-cancel-go" style="flex:1;padding:0.85rem 1rem;border-radius:12px;border:none;background:linear-gradient(135deg,#ef4444,#ec4899);color:white;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.92rem;box-shadow:0 8px 20px rgba(239,68,68,0.35);">
              <i class="fas fa-xmark"></i> Yes, cancel
            </button>` : ''}
        </div>
      </div>
    `;
    document.body.appendChild(wrap);
    document.body.style.overflow = 'hidden';

    const reasonEl = wrap.querySelector('.bh-reason');
    const counter  = wrap.querySelector('.bh-reason-counter');
    const chipsBox = wrap.querySelector('.bh-reason-chips');

    // Quick-pick chips so users can cancel with one click without typing.
    if (chipsBox) {
        const presets = [
            'Plans changed',
            'Schedule conflict',
            'No longer attending',
            'Booked by mistake',
            'Travel issue'
        ];
        chipsBox.innerHTML = presets.map(p => `<button type="button" class="bh-rchip" style="
            padding:5px 12px;border-radius:999px;
            background:rgba(99,102,241,0.08);color:#6366f1;
            border:1px solid rgba(99,102,241,0.22);
            font-size:0.78rem;font-weight:600;cursor:pointer;
            font-family:inherit;transition:all 0.2s ease;
        ">${esc(p)}</button>`).join('');
        chipsBox.querySelectorAll('.bh-rchip').forEach(b => {
            b.addEventListener('mouseenter', () => { b.style.background = 'rgba(99,102,241,0.18)'; });
            b.addEventListener('mouseleave', () => { b.style.background = 'rgba(99,102,241,0.08)'; });
            b.addEventListener('click', () => {
                if (reasonEl) {
                    reasonEl.value = b.textContent;
                    reasonEl.dispatchEvent(new Event('input'));
                    reasonEl.focus();
                }
            });
        });
    }

    if (reasonEl && counter) {
        reasonEl.addEventListener('input', () => {
            counter.textContent = reasonEl.value.length + ' / 500';
        });
        reasonEl.addEventListener('focus', () => {
            reasonEl.style.borderColor = '#6366f1';
            reasonEl.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)';
        });
        reasonEl.addEventListener('blur', () => {
            reasonEl.style.borderColor = '#e5e7eb';
            reasonEl.style.boxShadow = 'none';
        });
    }

    const close = () => { wrap.remove(); document.body.style.overflow = ''; };
    wrap.querySelector('.bh-cancel-back').addEventListener('click', close);
    const go = wrap.querySelector('.bh-cancel-go');
    if (go) go.addEventListener('click', () => {
        const reason = reasonEl ? reasonEl.value.trim() : '';
        close();
        onConfirm(reason);
    });
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
}

function formatHours(h) {
    if (h === null || h === undefined) return '';
    if (h < 0) return 'event already started';
    if (h < 1) return Math.round(h * 60) + ' minutes to event';
    if (h < 48) return Math.round(h) + ' hours to event';
    return Math.round(h / 24) + ' days to event';
}
function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
