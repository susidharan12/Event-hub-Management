const API_BASE = 'http://localhost:3000/api';
const SERVER_URL = 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('id');

    if (!eventId) {
        alert('No event specified');
        window.location.href = 'dashboard.html';
        return;
    }

    loadEventDetails(eventId);
    setupBookingButton(eventId);
});

async function loadEventDetails(id) {
    try {
        const response = await fetch(`${API_BASE}/events/${id}`);
        if (!response.ok) throw new Error('Event not found');

        const event = await response.json();
        renderEvent(event);
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('loading').innerHTML = '<p style="text-align:center; color:red">Event not found or server error.</p>';
    }
}

function renderEvent(event) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('event-details').style.display = 'block';

    // Handle Image
    let imageUrl = (event.images && event.images.length > 0) ? event.images[0] : (event.image_url || 'https://via.placeholder.com/800x400');
    if (imageUrl && imageUrl.startsWith('/')) imageUrl = `${SERVER_URL}${imageUrl}`;
    
    document.getElementById('detail-image').src = imageUrl;
    document.getElementById('detail-category').textContent = event.category || 'Event';
    document.getElementById('detail-title').textContent = event.title;
    document.getElementById('detail-desc').textContent = event.description || 'No description provided.';
    document.getElementById('detail-location').textContent = event.location;
    
    // Date Formatting
    const date = new Date(event.event_date);
    document.getElementById('detail-date').textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

    // Price & Seats
    const price = event.ticket_price || event.price;
    document.getElementById('detail-price').textContent = price > 0 ? `₹${price}` : 'Free';
    const availableSeats = (event.available_seats !== null && event.available_seats !== undefined) ? event.available_seats : event.total_seats;
    document.getElementById('detail-seats').textContent = availableSeats;

    // Disable booking if sold out
    if (availableSeats === 0) {
        const btn = document.getElementById('book-btn');
        btn.textContent = 'Sold Out';
        btn.classList.add('btn-disabled');
        btn.classList.remove('btn-primary');
        btn.disabled = true;
    }
}

function setupBookingButton(eventId) {
    const btn = document.getElementById('book-btn');
    
    btn.addEventListener('click', () => {
        const token = localStorage.getItem('token') || 
                      localStorage.getItem('authToken') || 
                      localStorage.getItem('eventhub_token') ||
                      localStorage.getItem('auth_token') ||
                      (typeof CONFIG !== 'undefined' && CONFIG.STORAGE ? localStorage.getItem(CONFIG.STORAGE.TOKEN) : null);
        
        if (!token) {
            document.getElementById('auth-warning').style.display = 'block';
            // Optionally redirect to login
            // window.location.href = '/Public/auth/pages/login.html';
        } else {
            window.location.href = `booking.html?id=${eventId}`;
        }
    });
}