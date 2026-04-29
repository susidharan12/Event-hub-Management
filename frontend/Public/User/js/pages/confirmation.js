(function () {
  const API_BASE = 'http://localhost:3000/api';
  const SERVER_URL = 'http://localhost:3000';

  function getToken() {
    return (typeof CONFIG !== 'undefined' && CONFIG.STORAGE && localStorage.getItem(CONFIG.STORAGE.TOKEN))
      || localStorage.getItem('auth_token')
      || localStorage.getItem('token')
      || localStorage.getItem('authToken')
      || localStorage.getItem('eventhub_token');
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function formatWhen(iso) {
    if (!iso) return 'TBD';
    const d = new Date(iso);
    if (isNaN(d)) return 'TBD';
    return d.toLocaleString(undefined, {
      weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  // Wait until the QRCode CDN script is available (defensive; HTML loads it first).
  function whenQRCodeReady(timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
      const start = performance.now();
      (function poll() {
        // Some builds expose toCanvas without toDataURL — toCanvas is what we use.
        if (typeof QRCode !== 'undefined' && QRCode.toCanvas) return resolve();
        if (performance.now() - start > timeoutMs) return reject(new Error('QRCode lib not loaded'));
        requestAnimationFrame(poll);
      })();
    });
  }

  // Reliable QR → data URL helper.  We use toCanvas with the callback API
  // (proven path in this codebase) and convert the canvas to a PNG data URL
  // synchronously after the callback fires.  This sidesteps the toDataURL
  // Promise form, which was failing silently on this CDN build.
  function qrDataURL(text, opts) {
    return new Promise((resolve, reject) => {
      if (typeof QRCode === 'undefined' || !QRCode.toCanvas) {
        return reject(new Error('QRCode lib not loaded'));
      }
      const c = document.createElement('canvas');
      QRCode.toCanvas(c, text, Object.assign({ width: 360, margin: 1 }, opts || {}), (err) => {
        if (err) return reject(err);
        try { resolve(c.toDataURL('image/png')); }
        catch (e) { reject(e); }
      });
    });
  }

  async function fetchBooking(bookingId) {
    // Prefer the API (gets fresh ticket_codes, holder name, event details).
    const token = getToken();
    if (token) {
      try {
        const res = await fetch(`${API_BASE}/bookings/${bookingId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          return data.booking || data;
        }
      } catch (_) { /* fall through to local cache */ }
    }
    // Fallback: localStorage `currentBooking` written at booking time.
    try {
      const local = JSON.parse(localStorage.getItem('currentBooking') || 'null');
      if (local && (local.id == bookingId || local.bookingId == bookingId || !local.id)) {
        return local;
      }
    } catch (_) {}
    return null;
  }

  function ticketCodesFor(b) {
    if (Array.isArray(b.ticket_codes) && b.ticket_codes.length) return b.ticket_codes;
    const seats = Number(
      b.seats_booked || b.number_of_seats || b.numberOfTickets || b.number_of_tickets || 1
    ) || 1;
    const base = b.ticket_id || b.ticketId || `BK-${b.id || 'ticket'}`;
    return Array.from({ length: seats }, (_, i) => `${base}-${i + 1}`);
  }

  // Build the URL that gets baked into a QR. Scanning the QR opens the
  // verify page on the same origin (works under localhost AND ngrok), with
  // all the ticket details encoded in the query string.
  function buildVerifyUrl({ code, bookingId, name, eventTitle, eventDate, location, place, mapUrl, seatIndex, total }) {
    const u = new URL('/Public/User/pages/verify.html', window.location.origin);
    if (code)        u.searchParams.set('t', code);
    if (bookingId)   u.searchParams.set('b', bookingId);
    if (name)        u.searchParams.set('n', name);
    if (eventTitle)  u.searchParams.set('e', eventTitle);
    if (eventDate)   u.searchParams.set('d', eventDate);
    if (location)    u.searchParams.set('l', location);
    if (place)       u.searchParams.set('p', place);
    if (mapUrl)      u.searchParams.set('g', mapUrl);
    if (seatIndex)   u.searchParams.set('i', seatIndex);
    if (total)       u.searchParams.set('m', total);
    return u.toString();
  }

  function buildCard({ idx, total, code, holderName, eventTitle, when, location, place, mapUrl }) {
    const card = document.createElement('article');
    card.className = 'ticket-card';
    const venueLine = location
      ? `${escapeHtml(location)}${place ? ` · <span style="color:var(--muted);font-weight:500;">${escapeHtml(place)}</span>` : ''}`
      : '';
    card.innerHTML = `
      <div class="tc-head">
        <span class="seat">Ticket #${idx + 1} of ${total}</span>
        <span class="badge"><i class="fas fa-circle-check"></i> Confirmed</span>
      </div>
      <div class="tc-perf"><div class="dashes"></div></div>
      <div class="tc-qr">
        <div class="tc-qr-frame">
          <img alt="QR for ticket ${idx + 1}">
        </div>
      </div>
      <div class="tc-body">
        <div class="tc-name"><i class="fas fa-user-circle" style="color:var(--primary);"></i> ${escapeHtml(holderName || '—')}</div>
        <div class="tc-event">${escapeHtml(eventTitle || 'Event')}</div>
        <div class="tc-when"><i class="fas fa-calendar-days"></i> ${escapeHtml(when)}</div>
        ${venueLine ? `<div class="tc-when" style="margin-top:6px;"><i class="fas fa-map-marker-alt"></i> ${venueLine}</div>` : ''}
        ${mapUrl ? `
          <a href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener" style="
            display:inline-flex; align-items:center; gap:6px;
            margin-top: 10px;
            padding: 6px 14px;
            background: linear-gradient(135deg, #10b981 0%, #06b6d4 100%);
            color: white;
            border-radius: 999px;
            font-size: 0.78rem;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-decoration: none;
            box-shadow: 0 6px 14px rgba(16,185,129,0.3);
          "><i class="fas fa-map-location-dot"></i> Get directions</a>
        ` : ''}
        <div class="tc-code">${escapeHtml(code)}</div>
      </div>
    `;
    return card;
  }

  async function render() {
    const params = new URLSearchParams(window.location.search);
    const bookingId = params.get('bookingId') || params.get('id');
    const grid = document.getElementById('tickets-grid');
    const summary = document.getElementById('conf-summary');

    if (!bookingId) {
      grid.innerHTML = `
        <div class="state-card">
          <div class="ic"><i class="fas fa-circle-exclamation"></i></div>
          <h3>Missing booking id</h3>
          <p>We couldn't find a ticket to display. Try opening it from My Bookings.</p>
          <a href="booking-history.html" class="btn btn-primary"><i class="fas fa-ticket"></i> My Bookings</a>
        </div>`;
      return;
    }

    const b = await fetchBooking(bookingId);
    if (!b) {
      grid.innerHTML = `
        <div class="state-card">
          <div class="ic"><i class="fas fa-triangle-exclamation"></i></div>
          <h3>Couldn't load this booking</h3>
          <p>Your session may have expired. Please log in and try again.</p>
          <a href="/Public/auth/pages/login.html" class="btn btn-primary"><i class="fas fa-arrow-right-to-bracket"></i> Login</a>
        </div>`;
      return;
    }

    const codes = ticketCodesFor(b);
    const holderName = b.ticket_holder_name || b.ticketHolderName || b.user_name || '—';
    const eventTitle = b.event_title || b.eventTitle || (b.event && b.event.title) || b.title || 'Event';
    const when = formatWhen(b.event_date || b.eventDate || (b.event && b.event.event_date));
    const location = b.event_location || b.eventLocation || (b.event && b.event.location) || b.location || '';
    const place    = b.event_place    || b.place    || (b.event && b.event.place)    || '';
    const mapUrl   = b.event_map_url  || b.map_url  || (b.event && b.event.map_url)  || '';

    if (summary) {
      summary.textContent = codes.length === 1
        ? `Show this QR code at the entrance.`
        : `${codes.length} tickets — show any QR at the entrance.`;
    }

    grid.innerHTML = '';
    const cards = codes.map((code, idx) => {
      const card = buildCard({ idx, total: codes.length, code, holderName, eventTitle, when, location, place, mapUrl });
      grid.appendChild(card);
      return card;
    });

    // Generate QR codes as data URLs and feed them into each card's <img>.
    try { await whenQRCodeReady(); }
    catch (e) {
      console.warn('QRCode lib unavailable:', e);
      cards.forEach((c, i) => {
        const img = c.querySelector('img');
        if (img) img.alt = `QR unavailable: ${codes[i]}`;
      });
      setupDownload(b, codes, { holderName, eventTitle, when, location });
      return;
    }
    codes.forEach((code, idx) => {
      const payload = buildVerifyUrl({
        code, bookingId: b.id || bookingId,
        name: holderName,
        eventTitle, eventDate: b.event_date || b.eventDate || (b.event && b.event.event_date),
        location, place, mapUrl,
        seatIndex: idx + 1, total: codes.length
      });
      qrDataURL(payload, { width: 360 })
        .then(url => {
          const img = cards[idx].querySelector('img');
          if (img) img.src = url;
        })
        .catch(err => console.error('QR gen failed for', code, err));
    });

    setupDownload(b, codes, { holderName, eventTitle, when, location, place, mapUrl });
  }

  function setupDownload(b, codes, meta) {
    const btn = document.getElementById('download-ticket');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const original = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Preparing PDF…';
      try {
        const { jsPDF } = window.jspdf || {};
        if (!jsPDF) {
          alert('PDF library not loaded yet. Please retry in a moment.');
          return;
        }
        await whenQRCodeReady();

        // Render every QR up front (reliable; prevents one failure from
        // killing the whole PDF).
        const qrUrls = await Promise.all(codes.map((code, i) => qrDataURL(buildVerifyUrl({
          code,
          bookingId: b.id,
          name: meta.holderName,
          eventTitle: meta.eventTitle,
          eventDate: b.event_date || b.eventDate || (b.event && b.event.event_date),
          location: meta.location,
          place: meta.place,
          mapUrl: meta.mapUrl,
          seatIndex: i + 1,
          total: codes.length
        }), { width: 480 })));

        // Format display values once.
        const eventDate = b.event_date || b.eventDate || (b.event && b.event.event_date);
        const dateObj = eventDate ? new Date(eventDate) : null;
        const dateValid = dateObj && !isNaN(dateObj);
        const dayMon = dateValid
          ? dateObj.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }).toUpperCase()
          : 'TBD';
        const yearStr = dateValid ? String(dateObj.getFullYear()) : '';
        const timeStr = dateValid
          ? dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '';
        const priceNum = Number(b.total_price || 0) / Math.max(1, Number(b.number_of_seats || codes.length || 1));
        const isFree = !priceNum || priceNum <= 0;
        const priceLabel = isFree ? 'FREE' : 'PRICE';
        const priceText  = isFree ? 'FREE' : `Rs.${priceNum.toFixed(0)}`;
        const venue      = meta.location || 'Venue TBD';
        const place      = meta.place || '';

        // ─── Render one A4-landscape ticket per code (real-stub feel) ───
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const PAGE_W = 297, PAGE_H = 210;

        // Ticket bounding box
        const T_X = 18, T_W = 261;
        const T_H = 105;
        const T_Y = (PAGE_H - T_H) / 2;
        const STUB_W = 56;
        const PERF_X = T_X + STUB_W;
        const RIGHT_W = 78;
        const RIGHT_X = T_X + T_W - RIGHT_W;

        // Palette (matches the rest of the app)
        const COL_NAVY  = [11, 16, 32];
        const COL_INK   = [15, 23, 42];
        const COL_PINK  = [236, 72, 153];
        const COL_CYAN  = [6, 182, 212];
        const COL_WHITE = [255, 255, 255];

        for (let i = 0; i < codes.length; i++) {
          if (i > 0) doc.addPage('a4', 'landscape');
          const code = codes[i];
          const num = i + 1;
          const total = codes.length;

          // White page background
          doc.setFillColor(...COL_WHITE);
          doc.rect(0, 0, PAGE_W, PAGE_H, 'F');

          // === MAIN TICKET CARD (dark navy, rounded) ===
          doc.setFillColor(...COL_NAVY);
          doc.roundedRect(T_X, T_Y, T_W, T_H, 6, 6, 'F');

          // === Decorative rainbow accent bands (top + bottom) ===
          // Three colored blocks just inside the rounded corners.  Drawing
          // small inset rectangles so they respect the rounded edges visually.
          function accentBand(yTop) {
            const bandH = 2.2;
            const inset = 6;
            const segW = (T_W - inset * 2) / 3;
            doc.setFillColor(...COL_PINK);
            doc.rect(T_X + inset,                yTop, segW, bandH, 'F');
            doc.setFillColor(139, 92, 246);     // violet
            doc.rect(T_X + inset + segW,         yTop, segW, bandH, 'F');
            doc.setFillColor(...COL_CYAN);
            doc.rect(T_X + inset + segW * 2,     yTop, segW, bandH, 'F');
          }
          accentBand(T_Y + 4);                          // top stripe only — bottom area is busy with QR + scan caption

          // === PERFORATION ===
          // White semicircle cutouts at top + bottom of perf
          doc.setFillColor(...COL_WHITE);
          doc.circle(PERF_X, T_Y,         3.5, 'F');
          doc.circle(PERF_X, T_Y + T_H,   3.5, 'F');
          // Dashed perforation line between the cutouts
          doc.setDrawColor(...COL_WHITE);
          doc.setLineDashPattern([1.6, 1.6], 0);
          doc.setLineWidth(0.4);
          doc.line(PERF_X, T_Y + 5, PERF_X, T_Y + T_H - 5);
          doc.setLineDashPattern([], 0);

          // Top + bottom scalloped accent (small navy circles outside the card
          // top/bottom edge to simulate scallop). Keep subtle.
          // (Skipped — keeps file simple and rendering crisp.)

          // === LEFT STUB (rotated text) ===
          // "BOOKING NO. <id>" small in pink, rotated reading bottom→top
          doc.setTextColor(...COL_PINK);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.text(`BOOKING NO.`, T_X + 10, T_Y + T_H - 8, { angle: 90 });
          doc.setTextColor(...COL_WHITE);
          doc.setFontSize(9);
          doc.text(String(b.ticket_id || `BK-${b.id}`), T_X + 16, T_Y + T_H - 8, { angle: 90 });

          // Big rotated event title down the stub
          doc.setTextColor(...COL_WHITE);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(20);
          const stubTitle = (meta.eventTitle || 'EVENT').toUpperCase();
          doc.text(stubTitle, T_X + STUB_W / 2 - 5, T_Y + T_H - 10, { angle: 90, maxWidth: T_H - 20 });

          // Date label rotated near right edge of stub
          doc.setTextColor(...COL_PINK);
          doc.setFontSize(8);
          doc.text(`${dayMon}${yearStr ? ' · ' + yearStr : ''}`, T_X + STUB_W - 10, T_Y + T_H - 8, { angle: 90 });

          // === MAIN CENTER ===
          const cX = PERF_X + 10;
          const centerColW = RIGHT_X - cX - 8;   // available width before the right column

          // Top-left: event mark with star glyph
          doc.setTextColor(...COL_PINK);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.text('* EVENTHUB', cX, T_Y + 14);

          // Subtle pink underline under the mark
          doc.setDrawColor(...COL_PINK);
          doc.setLineWidth(0.6);
          doc.line(cX, T_Y + 16, cX + 22, T_Y + 16);

          // Event title — large, dynamically wrapped
          doc.setTextColor(...COL_WHITE);
          doc.setFontSize(28);
          doc.setFont('helvetica', 'bold');
          const titleMain = (meta.eventTitle || 'Event').toUpperCase();
          const titleLines = doc.splitTextToSize(titleMain, centerColW);
          const titleY = T_Y + 30;
          const titleLineH = 11; // mm per line at 28pt bold
          doc.text(titleLines, cX, titleY);
          const titleEndY = titleY + (titleLines.length - 1) * titleLineH;

          // Subline with star glyph — placed AFTER the title so they never overlap
          doc.setTextColor(...COL_PINK);
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text('* LIVE EXPERIENCE', cX, titleEndY + 9);

          // White date strip
          const dateBoxY = T_Y + T_H - 38;
          doc.setFillColor(...COL_WHITE);
          doc.roundedRect(cX, dateBoxY, 84, 13, 2, 2, 'F');
          doc.setTextColor(...COL_INK);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(13);
          doc.text(`${dayMon}${timeStr ? '  -  ' + timeStr : ''}`, cX + 4, dateBoxY + 9);

          // Three small decorative dots beside the date band
          doc.setFillColor(...COL_PINK);
          doc.circle(cX + 88, dateBoxY + 6.5, 0.9, 'F');
          doc.setFillColor(139, 92, 246);
          doc.circle(cX + 91, dateBoxY + 6.5, 0.9, 'F');
          doc.setFillColor(...COL_CYAN);
          doc.circle(cX + 94, dateBoxY + 6.5, 0.9, 'F');

          // Holder & venue lines
          doc.setTextColor(...COL_WHITE);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.text('ATTENDEE', cX, dateBoxY + 19);
          doc.text('VENUE',    cX + 50, dateBoxY + 19);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.text(meta.holderName || '—', cX, dateBoxY + 25);
          const venueText = place ? `${venue}, ${place}` : venue;
          const venueLine = doc.splitTextToSize(venueText, centerColW - 50)[0];
          doc.text(venueLine, cX + 50, dateBoxY + 25);

          // === RIGHT COLUMN ===
          // Subtle vertical divider line separating center & right columns
          doc.setDrawColor(255, 255, 255);
          doc.setLineDashPattern([0.8, 1.2], 0);
          doc.setLineWidth(0.25);
          doc.line(RIGHT_X - 2, T_Y + 12, RIGHT_X - 2, T_Y + T_H - 14);
          doc.setLineDashPattern([], 0);

          // Price label (small pink)
          doc.setTextColor(...COL_PINK);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.text(priceLabel, RIGHT_X + 6, T_Y + 12);

          // Big price number
          doc.setTextColor(...COL_WHITE);
          doc.setFontSize(isFree ? 26 : 22);
          doc.text(priceText, RIGHT_X + 6, T_Y + 25);

          // Pink horizontal divider under the price
          doc.setDrawColor(...COL_PINK);
          doc.setLineWidth(0.6);
          doc.line(RIGHT_X + 6, T_Y + 30, RIGHT_X + RIGHT_W - 6, T_Y + 30);

          // Ticket number + code (under the divider)
          doc.setTextColor(...COL_PINK);
          doc.setFontSize(8);
          doc.text(`TICKET ${num} OF ${total}`, RIGHT_X + 6, T_Y + 36);
          doc.setTextColor(...COL_WHITE);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.text(`#${code}`, RIGHT_X + 6, T_Y + 41);

          // QR code box on right (white frame with thin pink outline)
          const QR_SIZE = 44;
          const qrX = RIGHT_X + (RIGHT_W - QR_SIZE) / 2;
          const qrY = T_Y + T_H - QR_SIZE - 11;
          // Outer pink glow frame
          doc.setFillColor(...COL_PINK);
          doc.roundedRect(qrX - 3.2, qrY - 3.2, QR_SIZE + 6.4, QR_SIZE + 6.4, 2.5, 2.5, 'F');
          // Inner white frame
          doc.setFillColor(...COL_WHITE);
          doc.roundedRect(qrX - 2, qrY - 2, QR_SIZE + 4, QR_SIZE + 4, 2, 2, 'F');
          if (qrUrls[i]) doc.addImage(qrUrls[i], 'PNG', qrX, qrY, QR_SIZE, QR_SIZE);

          // "Scan at entrance" hint
          doc.setTextColor(...COL_PINK);
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.text('* SCAN AT ENTRANCE *', RIGHT_X + RIGHT_W / 2, T_Y + T_H - 6, { align: 'center' });

          // Tiny footer beneath ticket
          doc.setTextColor(150, 150, 150);
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8);
          doc.text(
            'Show this QR at the entrance. Each QR is unique to one ticket — non-transferable.',
            PAGE_W / 2,
            T_Y + T_H + 10,
            { align: 'center' }
          );
        }
        doc.save(`EventHub-Tickets-${b.ticket_id || b.id}.pdf`);
      } catch (err) {
        console.error('PDF download failed:', err);
        alert('Could not download tickets. Please try again.\n\n' + (err && err.message ? err.message : ''));
      } finally {
        btn.disabled = false;
        btn.innerHTML = original;
      }
    });
  }

  document.addEventListener('DOMContentLoaded', render);
})();
