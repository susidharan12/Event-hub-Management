(async function(){
  const API_BASE = 'http://localhost:3000/api';
  const list = document.getElementById('tickets-list');

  function renderTicket(t){
    const seatCount = Number(t.seats_booked || t.number_of_seats || t.numberOfTickets || 1);
    const baseId = t.ticket_id || t.ticketId || `BK-${t.id}`;
    const codes = Array.isArray(t.ticket_codes) && t.ticket_codes.length
      ? t.ticket_codes
      : Array.from({ length: seatCount }, (_, i) => `${baseId}-${i + 1}`);

    const div = document.createElement('div');
    div.className = 'ticket';
    div.innerHTML = `
      <div class="qr-strip" style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-start;"></div>
      <div class="meta">
        <div style="font-weight:700">${t.eventTitle || t.event_title || 'Event'}</div>
        <div style="color:#6b7280">${new Date(t.event_date || t.eventDate || '').toLocaleString() || ''}</div>
        <div style="margin-top:6px">Holder: ${t.ticket_holder_name || t.ticketHolderName || t.user_name || '—'}</div>
        <div style="color:#374151">Seats: ${seatCount} • ₹${t.total_price || t.totalAmount || t.total_amount || 0}</div>
      </div>
      <div class="actions">
        <button class="btn" onclick="window.location.href='confirmation.html?bookingId=${t.id}';">View</button>
      </div>
    `;
    list.appendChild(div);

    // One QR per individual ticket.
    const strip = div.querySelector('.qr-strip');
    codes.forEach((code, idx) => {
      const cell = document.createElement('div');
      cell.style.cssText = 'background:white;border:1px solid #e5e7eb;border-radius:8px;padding:6px;display:flex;flex-direction:column;align-items:center;gap:4px;';
      const canvas = document.createElement('canvas');
      cell.appendChild(canvas);
      const label = document.createElement('div');
      label.textContent = `#${idx + 1} • ${code}`;
      label.style.cssText = 'font-size:0.65rem;color:#475569;font-family:monospace;';
      cell.appendChild(label);
      strip.appendChild(cell);

      // Encode a verify-page URL so scanning opens the styled ticket page.
      const u = new URL('/Public/User/pages/verify.html', window.location.origin);
      u.searchParams.set('t', code);
      if (t.id)          u.searchParams.set('b', t.id);
      const holder = t.ticket_holder_name || t.ticketHolderName;
      if (holder)        u.searchParams.set('n', holder);
      const evtTitle = t.eventTitle || t.event_title;
      if (evtTitle)      u.searchParams.set('e', evtTitle);
      const evtDate = t.event_date || t.eventDate;
      if (evtDate)       u.searchParams.set('d', evtDate);
      const evtLoc = t.event_location || t.eventLocation || t.location;
      if (evtLoc)        u.searchParams.set('l', evtLoc);
      const evtPlace = t.event_place || t.place;
      if (evtPlace)      u.searchParams.set('p', evtPlace);
      const evtMap = t.event_map_url || t.map_url;
      if (evtMap)        u.searchParams.set('g', evtMap);
      u.searchParams.set('i', idx + 1);
      u.searchParams.set('m', codes.length);
      const payload = u.toString();
      if (typeof QRCode !== 'undefined') {
        try { QRCode.toCanvas(canvas, payload, { width: 70 }); } catch(e){}
      } else {
        cell.textContent = code;
      }
    });
  }

  // Try API first if authenticated
  const token = localStorage.getItem('token') || localStorage.getItem('authToken') || localStorage.getItem('eventhub_token') || (typeof CONFIG !== 'undefined' && CONFIG.STORAGE ? localStorage.getItem(CONFIG.STORAGE.TOKEN) : null);
  if (token) {
    try {
      const resp = await fetch(`${API_BASE}/bookings`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (resp.ok) {
        const json = await resp.json();
        list.innerHTML = '';
        const bookings = json.bookings || [];
        if (bookings.length === 0) list.innerHTML = '<p>No tickets found.</p>';
        bookings.forEach(renderTicket);
        return;
      }
    } catch (e) {
      console.warn('Failed to fetch bookings from API', e);
    }
  }

  // Fallback to localStorage
  try {
    const local = JSON.parse(localStorage.getItem('myTickets') || '[]');
    list.innerHTML = '';
    if (!local || local.length === 0) { list.innerHTML = '<p>No tickets found locally.</p>'; return; }
    local.forEach(renderTicket);
  } catch (e) {
    list.innerHTML = '<p>Could not load tickets.</p>';
  }
})();
