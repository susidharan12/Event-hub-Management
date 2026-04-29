document.addEventListener('DOMContentLoaded', () => {
    loadBookings();

    // Tab switching logic — booking-history.js historically uses tab text
    // ("All" / "Upcoming" / "Past") to find the active tab and toggles
    // card visibility via card.dataset.type. We keep that contract.
    window.filterBookings = (type) => {
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.classList.remove('active');
            if (type === 'all' && tab.textContent.includes('All')) tab.classList.add('active');
            if (type === 'upcoming' && tab.textContent.includes('Upcoming')) tab.classList.add('active');
            if (type === 'past' && tab.textContent.includes('Past')) tab.classList.add('active');
        });

        const cards = document.querySelectorAll('.booking-card');
        cards.forEach(card => {
            if (type === 'all') {
                card.style.display = 'flex';
            } else {
                card.style.display = card.dataset.type === type ? 'flex' : 'none';
            }
        });
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
            const type = isPast ? 'past' : 'upcoming';
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
                            <div style="display: flex; gap: 10px;">
                                <button class="btn btn-primary" onclick="window.location.href='confirmation.html?bookingId=${booking.id}'">View Ticket</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error(error);
        container.innerHTML = '<p style="text-align:center; color: red;">Error loading bookings. Please try again later.</p>';
    }
}
