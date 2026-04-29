const API_BASE = 'http://localhost:3000/api';
const SERVER_URL = 'http://localhost:3000';
let allEvents = [];

document.addEventListener('DOMContentLoaded', () => {
    loadEvents();
    setupSearch();
});

function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filteredEvents = allEvents.filter(event => 
            (event.title && event.title.toLowerCase().includes(term)) ||
            (event.location && event.location.toLowerCase().includes(term)) ||
            (event.category && event.category.toLowerCase().includes(term))
        );
        renderEvents(filteredEvents);
    });
}

async function loadEvents() {
    // Target the container where events should be displayed.
    // This looks for an element with id="events-container" or "events-grid"
    const container = document.getElementById('events-container') || document.getElementById('events-grid');
    
    if (!container) {
        console.error('Error: Could not find event container (id="events-container" or "events-grid")');
        return;
    }

    // Clear any default/hardcoded content immediately
    container.innerHTML = '<p>Loading events...</p>';

    try {
        const response = await fetch(`${API_BASE}/events`);
        if (!response.ok) throw new Error('Failed to fetch events');

        const data = await response.json();
        allEvents = data.events || data;
        renderEvents(allEvents);

    } catch (error) {
        console.error('Error loading events:', error);
        container.innerHTML = '<p>Error loading events from server.</p>';
    }
}

function renderEvents(events) {
    const container = document.getElementById('events-container') || document.getElementById('events-grid');
    
    if (events.length === 0) {
        container.innerHTML = '<p>No events found.</p>';
        return;
    }

    container.innerHTML = events.map(event => {
        // Handle image URL
        let imageUrl = (event.images && event.images.length > 0) ? event.images[0] : (event.image_url || null);
        if (imageUrl && imageUrl.startsWith('/')) imageUrl = `${SERVER_URL}${imageUrl}`;

        const imageStyle = imageUrl ? `background: url('${imageUrl}') center/cover;` : '';
        const priceDisplay = (event.ticket_price || event.price) > 0 ? `₹${event.ticket_price || event.price}` : 'Free';
        const buttonText = (event.ticket_price || event.price) > 0 ? 'Book Now' : 'Register';

        return `
            <div class="event-card">
                <div class="event-img-placeholder" style="${imageStyle}"></div>
                <div class="event-info">
                    <span style="color: var(--secondary); font-size: 0.8rem; font-weight: bold; text-transform: uppercase;">${event.category || 'Event'}</span>
                    <h3 style="margin: 0.5rem 0;">${event.title}</h3>
                    <p style="color: #6b7280; font-size: 0.9rem;"><i class="fas fa-map-marker-alt"></i> ${event.location}</p>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem;">
                        <span style="font-weight: 800; color: var(--primary); font-size: 1.2rem;">${priceDisplay}</span>
                        <a href="event-detail.html?id=${event.id}" class="btn btn-primary" style="padding: 0.4rem 1rem; font-size: 0.9rem;">${buttonText}</a>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}