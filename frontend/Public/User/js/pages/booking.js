document.addEventListener('DOMContentLoaded', async () => {
  // Get the event ID from the URL query parameters (support both 'id' and 'eventId')
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get('id') || urlParams.get('eventId');

  console.log('Booking Page Loaded. Event ID:', eventId);

  // API Base URL
  const API_BASE = 'http://localhost:3000/api';
  const SERVER_URL = 'http://localhost:3000';

  // DOM Elements - Support multiple common ID naming conventions
  // Helper to find elements by ID or Class
  const getElement = (selectors) => {
    for (const selector of selectors) {
      // Try ID first, then Class
      const el = document.getElementById(selector) || document.querySelector(`.${selector}`);
      if (el) return el;
    }
    return null;
  };

  const eventNameEl = getElement(['event-name', 'event-title', 'title', 'event_title']);
  const eventDateEl = getElement(['event-date', 'event-time', 'event-date-time', 'date', 'time', 'event_date']);
  const eventLocationEl = getElement(['event-location', 'event-venue', 'location', 'venue', 'event_location']);
  const eventDescriptionEl = getElement(['event-description', 'event-desc', 'description', 'desc', 'event_description']);
  const eventPriceEl = getElement(['event-price', 'event-cost', 'price', 'cost', 'ticket-price']);
  const eventImageEl = getElement(['event-image', 'event-img', 'image', 'img', 'event_image']);
  
  // Store price for calculation
  let currentTicketPrice = 0;
  let currentEventDate = new Date().toISOString(); // Default fallback

  console.log('Booking Page Elements Found:', { eventNameEl, eventDateEl, eventLocationEl });

  // Show loading state to indicate script is active
  if (eventNameEl) eventNameEl.textContent = 'Loading Event Details...';
  if (eventDateEl) eventDateEl.textContent = '';
  if (eventLocationEl) eventLocationEl.textContent = 'Please wait...';
  if (eventDescriptionEl) eventDescriptionEl.textContent = '';
  if (eventPriceEl) eventPriceEl.textContent = '';

  // Pre-fill the Ticket Holder Name with the logged-in user's name. We
  // check the various localStorage keys the rest of the app uses.
  (function prefillHolder() {
    const holderInput = document.getElementById('ticket-holder');
    if (!holderInput) return;
    let cachedName = '';
    try {
      const userJSON = localStorage.getItem('auth_user') || localStorage.getItem('user') || localStorage.getItem('authUser');
      if (userJSON) {
        const u = JSON.parse(userJSON);
        cachedName = u.name || u.username || u.full_name || '';
      }
    } catch (_) {}
    if (cachedName) holderInput.value = cachedName;

    // Also fetch the latest profile from the server (in case the user has
    // updated their name since login) and overwrite if the user hasn't
    // typed anything custom yet.
    const token = localStorage.getItem('auth_token') ||
                  localStorage.getItem('token') ||
                  localStorage.getItem('authToken') ||
                  localStorage.getItem('eventhub_token');
    if (!token) return;
    fetch(`${API_BASE}/auth/profile`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(u => {
        if (!u) return;
        const fresh = u.name || u.username || '';
        if (!fresh) return;
        // Only overwrite if the field still matches the cached value or is empty.
        if (!holderInput.value || holderInput.value === cachedName) {
          holderInput.value = fresh;
        }
      })
      .catch(() => {});
  })();

  if (!eventId) {
    console.error('No event ID found in URL');
    if (typeof Toast !== 'undefined') Toast.error('Invalid Event URL');
    return;
  }

  try {
    // Fetch event details from the database via API
    console.log(`Fetching event details for ID: ${eventId}...`);
    const response = await fetch(`${API_BASE}/events/${eventId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      // Handle response structure: { event: {...} } or just {...}
      const event = data.event || data; 
      console.log('Event data received:', event);

      // Populate the page with event details
      if (eventNameEl) eventNameEl.textContent = event.title || event.name || 'N/A';
      
      if (eventDateEl) {
        const dateStr = event.event_date || event.date;
        if (dateStr) currentEventDate = dateStr;
        eventDateEl.textContent = dateStr ? new Date(dateStr).toLocaleString() : 'Date TBD';
      }

      if (eventLocationEl) eventLocationEl.textContent = event.location || 'N/A';
      if (eventDescriptionEl) eventDescriptionEl.textContent = event.description || '';
      
      // Extract price and update global state regardless of UI element presence
      const price = (event.ticket_price !== undefined) ? event.ticket_price : event.price;
      currentTicketPrice = price || 0;

      if (eventPriceEl) {
        eventPriceEl.textContent = (price && price > 0) ? `₹${price}` : 'Free';
      }

      // Update global price for calculation in booking.html
      if (typeof window.updateBookingPrice === 'function') {
        window.updateBookingPrice(price || 0);
      }
      
      // If there is an image element and the event has an image URL
      let imageUrl = (event.images && event.images.length > 0) ? event.images[0] : (event.image_url || event.image);
      if (eventImageEl && imageUrl) {
        if (!imageUrl.startsWith('http')) {
            if (!imageUrl.startsWith('/')) imageUrl = '/' + imageUrl;
            imageUrl = `${SERVER_URL}${imageUrl}`;
        }
        eventImageEl.src = imageUrl;
        eventImageEl.alt = event.title || event.name || 'Event Image';
      }
    } else {
      throw new Error('Event not found');
    }
  } catch (error) {
    console.error('Error fetching event data:', error);
    if (typeof Toast !== 'undefined') Toast.error('Could not load event details.');
  }

  // Handle Booking Form Submission
  const bookingForm = document.getElementById('booking-form');
  if (bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const submitBtn = document.getElementById('submit-btn');
      const originalBtnText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'Processing...';

      try {
        const token = localStorage.getItem('token') || 
                      localStorage.getItem('authToken') || 
                      localStorage.getItem('eventhub_token') ||
                      localStorage.getItem('auth_token');

        if (!token) {
          alert('Please login to book tickets');
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
          return;
        }

        let numTickets = parseInt(document.getElementById('num-tickets').value) || 1;

        // Reserved-seating events: the seat map drives quantity + price.
        const reserved = window.__reservedSeating === true;
        const seatLabels = (typeof window.__getSeatLabels === 'function') ? window.__getSeatLabels() : [];
        if (reserved) {
          if (!seatLabels || !seatLabels.length) {
            alert('Please select at least one seat from the map.');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
            return;
          }
          numTickets = seatLabels.length;
        }

        // Ensure ticket holder name is not empty
        const ticketHolderInput = document.getElementById('ticket-holder');
        const ticketHolder = ticketHolderInput.value.trim() || 'Demo User';

        const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value || 'card';
        // For reserved seating the backend re-prices from zones; this is display only.
        const totalAmount = reserved
          ? (Number(window.__seatTotal) || 0)
          : numTickets * currentTicketPrice;

        // Get user ID from local storage
        const userJSON = localStorage.getItem('user') || localStorage.getItem('auth_user');
        const user = userJSON ? JSON.parse(userJSON) : null;
        const userId = user ? (user.id || user.userId) : null;

        if (!userId) {
          alert('User session invalid. Please login again.');
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnText;
          return;
        }
        
        // Demo Mode: Payment is simulated
        console.log('Processing payment (Demo Mode)...');

        // 1. Prepare API Payload - Strictly matching DB columns
        const apiPayload = {
          event_id: !isNaN(Number(eventId)) ? Number(eventId) : eventId,
          seats_booked: Number(numTickets),
          // Reserved seating: send the specific seats so the backend books them.
          ...(reserved ? { seat_labels: seatLabels } : {}),
          total_price: Number(totalAmount),
          payment_method: paymentMethod,
          transaction_id: 'TXN-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
          ticket_holder_name: ticketHolder,
          ticket_holder_email: (user && user.email) ? user.email : null,
          ticket_holder_mobile: (user && (user.mobile || user.phone)) ? (user.mobile || user.phone) : null
        };

        // 2. Prepare Frontend Data - For confirmation page & localStorage
        const frontendData = {
            ...apiPayload,
            ticket_holder_name: ticketHolder,
            ticket_holder_email: (user && user.email) ? user.email : 'demo@example.com',
            ticket_holder_mobile: (user && (user.mobile || user.phone)) ? (user.mobile || user.phone) : '0000000000',
            event_date: currentEventDate,
            eventTitle: eventNameEl ? eventNameEl.textContent : 'Event',
            eventLocation: eventLocationEl ? eventLocationEl.textContent : 'Location',
            ticketId: 'TKT-' + Math.random().toString(36).substr(2, 9).toUpperCase()
        };

        // Save to localStorage for confirmation page fallback
        localStorage.setItem('currentBooking', JSON.stringify(frontendData));

        console.log('Sending API Payload:', apiPayload);

        const response = await fetch(`${API_BASE}/bookings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(apiPayload)
        });

        const result = await response.json();

        if (response.ok) {
           const bookingId = result.booking ? result.booking.id : (result.id || result.bookingId);
           
           if (!bookingId) {
             console.warn('Success response but no booking ID:', result);
           } else {
             console.log('Booking created in DB with ID:', bookingId);
           }
           
           // Update localStorage with the real ID from DB and add to user tickets
           frontendData.id = bookingId;
           // If server returned booking object with ticket_id, prefer that
           if (result.booking && result.booking.ticket_id) {
             frontendData.ticketId = result.booking.ticket_id;
           }
           localStorage.setItem('currentBooking', JSON.stringify(frontendData));

           // Save in `myTickets` list for user's tickets page
           try {
             const existing = JSON.parse(localStorage.getItem('myTickets') || '[]');
             existing.unshift(frontendData);
             localStorage.setItem('myTickets', JSON.stringify(existing));
           } catch (e) { console.warn('Could not update myTickets', e); }

           // Success UI - show centered modal with QR and option to view full ticket
           submitBtn.innerHTML = 'Payment Done';
           submitBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
           submitBtn.classList.add('bg-green-600', 'hover:bg-green-700');

           // Populate modal
           const modal = document.getElementById('booking-modal');
           const qrContainer = document.getElementById('booking-qr');
           const nameEl = document.getElementById('modal-booking-name');
           const countEl = document.getElementById('modal-booking-count');
           const viewBtn = document.getElementById('view-ticket-btn');
           const closeBtn = document.getElementById('booking-modal-close');
           const closeSecondary = document.getElementById('modal-close-secondary');

           if (nameEl) nameEl.textContent = frontendData.ticket_holder_name || 'Ticket Holder';
           if (countEl) countEl.textContent = `${frontendData.seats_booked || frontendData.number_of_seats || 1} person(s)`;

           // Render one unique QR per ticket. Backend returns
           // `ticket_codes: ["TKT-XXX-1", "TKT-XXX-2", …]`.
           const baseTicketId = (result.booking && result.booking.ticket_id) || frontendData.ticketId || 'TKT';
           const seatCount = Number(frontendData.seats_booked) || 1;
           const ticketCodes = (result.booking && Array.isArray(result.booking.ticket_codes) && result.booking.ticket_codes.length)
             ? result.booking.ticket_codes
             : Array.from({ length: seatCount }, (_, i) => `${baseTicketId}-${i + 1}`);
           frontendData.ticket_codes = ticketCodes;
           localStorage.setItem('currentBooking', JSON.stringify(frontendData));

           // Build the QR grid by drawing each code into its own off-DOM canvas
           // (callback API — proven reliable on this CDN build), converting to
           // a PNG data URL, and feeding it to an <img>.
           if (qrContainer) {
             qrContainer.innerHTML = '';
             const renderOne = (code, idx) => {
               const cell = document.createElement('div');
               cell.className = 'bm-qr-cell';

               const seatNo = document.createElement('div');
               seatNo.className = 'seat-no';
               seatNo.textContent = `Ticket #${idx + 1}`;

               const img = document.createElement('img');
               img.alt = `Ticket ${idx + 1}`;

               const codeEl = document.createElement('div');
               codeEl.className = 'code';
               codeEl.textContent = code;

               cell.appendChild(seatNo);
               cell.appendChild(img);
               cell.appendChild(codeEl);
               qrContainer.appendChild(cell);

               // Encode a verify-page URL — scanning the QR will open a styled
               // ticket-details page rather than dumping raw JSON.
               const verifyUrl = (() => {
                 const u = new URL('/Public/User/pages/verify.html', window.location.origin);
                 u.searchParams.set('t', code);
                 if (bookingId) u.searchParams.set('b', bookingId);
                 if (frontendData.ticket_holder_name) u.searchParams.set('n', frontendData.ticket_holder_name);
                 if (frontendData.eventTitle)        u.searchParams.set('e', frontendData.eventTitle);
                 if (frontendData.event_date)        u.searchParams.set('d', frontendData.event_date);
                 if (frontendData.eventLocation)     u.searchParams.set('l', frontendData.eventLocation);
                 if (frontendData.eventPlace)        u.searchParams.set('p', frontendData.eventPlace);
                 if (frontendData.eventMapUrl)       u.searchParams.set('g', frontendData.eventMapUrl);
                 u.searchParams.set('i', idx + 1);
                 u.searchParams.set('m', ticketCodes.length);
                 return u.toString();
               })();

               if (typeof QRCode !== 'undefined' && QRCode.toCanvas) {
                 const tmp = document.createElement('canvas');
                 QRCode.toCanvas(tmp, verifyUrl, { width: 220, margin: 1 }, (err) => {
                   if (err) { console.error('QR fail for', code, err); img.alt = code; return; }
                   try { img.src = tmp.toDataURL('image/png'); }
                   catch (e) { console.error(e); img.alt = code; }
                 });
               } else {
                 img.alt = code;
               }
             };
             ticketCodes.forEach(renderOne);
           }

           // Show modal (centered via .show class — see booking.html styles)
           if (modal) modal.classList.add('show');
           document.body.style.overflow = 'hidden';

           // The modal stays put until the user picks an action. Closing
           // dismisses it WITHOUT redirecting so they don't lose the QR codes
           // accidentally on a stray click.
           const dismissModal = () => {
             if (modal) modal.classList.remove('show');
             document.body.style.overflow = '';
           };
           // View Ticket → confirmation page (full ticket cards)
           if (viewBtn) viewBtn.onclick = () => { window.location.href = `confirmation.html?bookingId=${bookingId}`; };
           if (closeBtn)       closeBtn.onclick      = dismissModal;
           if (closeSecondary) closeSecondary.onclick = dismissModal;
           // Click-outside dismiss (only on the dark backdrop, never the card)
           if (modal) modal.addEventListener('click', (ev) => { if (ev.target === modal) dismissModal(); });
           // Esc-to-close
           document.addEventListener('keydown', function escClose(ev) {
             if (ev.key === 'Escape' && modal && modal.classList.contains('show')) {
               dismissModal();
               document.removeEventListener('keydown', escClose);
             }
           });
        } else {
           console.error('Server Error:', result);
           alert('Booking Failed: ' + (result.message || result.error || 'Unknown error'));
           submitBtn.disabled = false;
           submitBtn.innerHTML = originalBtnText;
        }
      } catch (error) {
        console.error('Booking Process Error:', error);
        alert('An error occurred: ' + error.message);
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
    });
  }
});