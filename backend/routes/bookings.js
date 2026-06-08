const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');
const seats = require('../services/seats');
const gst = require('../services/gst');
const promos = require('./promos');

const router = express.Router();

const MAX_TICKETS_PER_USER_PER_EVENT = 10;

// Generate per-seat ticket codes derived from a base ticket id, e.g. TKT-XYZ-1, -2, -3
function makeSeatTicketIds(baseTicketId, seatCount) {
  const arr = [];
  for (let i = 1; i <= seatCount; i++) arr.push(`${baseTicketId}-${i}`);
  return arr;
}

/**
 * Time-tiered refund calculator (modelled on the IRCTC schedule the user shared).
 * Free tickets are always cancellable but no refund is involved.
 *
 *   > 48h before event  → full refund (no fee)
 *   48h to 12h          → 25% deducted as cancellation fee, 75% refunded
 *   12h to 4h           → 50% deducted, 50% refunded
 *   < 4h or past event  → not eligible — must keep the ticket
 */
function computeRefund(totalPrice, eventDate) {
  const total = Number(totalPrice) || 0;
  const dt    = eventDate ? new Date(eventDate) : null;
  if (!dt || isNaN(dt)) {
    return { eligible: false, refund: 0, deduction: 0, deductionPct: 0, hoursToEvent: null, total, reason: 'no-date', label: 'Cancellation not available — event date unknown.' };
  }
  const hoursToEvent = (dt.getTime() - Date.now()) / 3600000;

  // Past events can't be cancelled — same rule for free or paid tickets.
  if (hoursToEvent < 0) {
    return { eligible: false, refund: 0, deduction: total, deductionPct: 100, hoursToEvent, total, reason: 'past-event', label: 'This event has already happened — cancellation is no longer possible.' };
  }
  if (total <= 0) {
    return { eligible: true, refund: 0, deduction: 0, deductionPct: 0, hoursToEvent, total, reason: 'free', label: 'Free ticket — no refund involved. The ticket will be cancelled and the seat returned.' };
  }
  if (hoursToEvent < 4) {
    return { eligible: false, refund: 0, deduction: total, deductionPct: 100, hoursToEvent, total, reason: 'too-late', label: 'Less than 4 hours to the event — no refund is available.' };
  }
  if (hoursToEvent < 12) {
    const deduction = Math.round(total * 0.5 * 100) / 100;
    return { eligible: true, refund: total - deduction, deduction, deductionPct: 50, hoursToEvent, total, reason: '12-4h', label: '12 hours to 4 hours before the event — 50% of fare is deducted as cancellation fee.' };
  }
  if (hoursToEvent < 48) {
    const deduction = Math.round(total * 0.25 * 100) / 100;
    return { eligible: true, refund: total - deduction, deduction, deductionPct: 25, hoursToEvent, total, reason: '48-12h', label: '48 hours to 12 hours before the event — 25% of fare is deducted as cancellation fee.' };
  }
  return { eligible: true, refund: total, deduction: 0, deductionPct: 0, hoursToEvent, total, reason: 'early', label: 'More than 48 hours before the event — full refund.' };
}

// CREATE BOOKING
router.post('/', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { event_id, seats_booked, ticket_holder_name, ticket_holder_email, ticket_holder_mobile, transaction_id, promo_code } = req.body;

    // Reserved-seating bookings send specific seat labels (e.g. ["A1","A2"])
    // instead of a plain count. GA bookings keep sending seats_booked.
    let seatLabels = Array.isArray(req.body.seat_labels)
      ? req.body.seat_labels.map((s) => String(s).trim()).filter(Boolean)
      : null;
    const hasSeatLabels = !!(seatLabels && seatLabels.length);

    if (!event_id || (!seats_booked && !hasSeatLabels)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const seatsRequested = hasSeatLabels ? seatLabels.length : Number(seats_booked);
    if (!Number.isInteger(seatsRequested) || seatsRequested < 1) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'seats_booked must be a positive integer' });
    }
    if (seatsRequested > MAX_TICKETS_PER_USER_PER_EVENT) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `You can book at most ${MAX_TICKETS_PER_USER_PER_EVENT} tickets per event in a single booking.` });
    }

    const userId = req.user.userId || req.user.id;

    // Per-user-per-event ticket cap (sum of non-cancelled bookings).
    const cap = await client.query(
      "SELECT COALESCE(SUM(number_of_seats), 0)::int AS total FROM bookings WHERE user_id = $1 AND event_id = $2 AND status != 'cancelled'",
      [userId, event_id]
    );
    const alreadyBooked = (cap.rows[0] && cap.rows[0].total) || 0;
    if (alreadyBooked + seatsRequested > MAX_TICKETS_PER_USER_PER_EVENT) {
      await client.query('ROLLBACK');
      const remaining = Math.max(0, MAX_TICKETS_PER_USER_PER_EVENT - alreadyBooked);
      return res.status(400).json({
        error: `You already have ${alreadyBooked} ticket(s) for this event. Each user can book at most ${MAX_TICKETS_PER_USER_PER_EVENT} tickets per event (${remaining} remaining).`
      });
    }

    // Lock the event row for the seat count check.
    const eventResult = await client.query(
      'SELECT id, ticket_price, available_seats, total_seats, reserved_seating FROM events WHERE id = $1 FOR UPDATE',
      [event_id]
    );
    if (eventResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Event not found' });
    }
    const event = eventResult.rows[0];

    // Reserved-seating events MUST book specific seats; GA events ignore labels.
    if (event.reserved_seating) {
      if (!hasSeatLabels) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Please select your seat(s) before booking.' });
      }
    } else {
      seatLabels = null;
    }

    const availableSeats = (event.available_seats !== null && event.available_seats !== undefined)
      ? event.available_seats
      : (event.total_seats || 0);

    if (availableSeats < seatsRequested) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Not enough seats available. Available: ${availableSeats}` });
    }

    // Subtotal + tiered GST (free tickets are GST-free). Reserved-seating
    // bookings re-price from the chosen seats further below.
    let subtotal  = (Number(event.ticket_price) || 0) * seatsRequested;
    let gstAmount = gst.gstForUnit(Number(event.ticket_price) || 0, seatsRequested);
    let totalPrice = gst.round2(subtotal + gstAmount);

    // Fall back to the user's profile for ticket-holder details when missing.
    let holderName = ticket_holder_name || null;
    let holderEmail = ticket_holder_email || null;
    let holderMobile = ticket_holder_mobile || null;
    if ((!holderName || !holderEmail || !holderMobile) && userId) {
      try {
        const ures = await client.query('SELECT name, email, mobile FROM users WHERE id = $1', [userId]);
        if (ures.rows.length > 0) {
          const u = ures.rows[0];
          holderName = holderName || u.name;
          holderEmail = holderEmail || u.email;
          holderMobile = holderMobile || u.mobile;
        }
      } catch (uErr) {
        console.warn('Could not fetch user details for booking holder fallback', uErr.message);
      }
    }

    const baseTicketId = (req.body.ticket_id && String(req.body.ticket_id).trim()) ||
      ('TKT-' + Math.random().toString(36).slice(2, 11).toUpperCase());

    const bookingResult = await client.query(
      `INSERT INTO bookings
         (user_id, event_id, number_of_seats, total_price, status,
          ticket_holder_name, ticket_holder_email, ticket_holder_mobile,
          transaction_id, ticket_id)
       VALUES ($1, $2, $3, $4, 'confirmed', $5, $6, $7, $8, $9)
       RETURNING *,
                 number_of_seats AS seats_booked,
                 status AS booking_status`,
      [userId, event_id, seatsRequested, totalPrice, holderName, holderEmail, holderMobile, transaction_id || null, baseTicketId]
    );

    const booking = bookingResult.rows[0];
    let ticketCodes;

    if (seatLabels) {
      // Reserved seating: claim the specific seats inside this transaction.
      // bookSeats validates each seat is still bookable (not booked / not held
      // by someone else) and returns the zone-priced total.
      const claim = await seats.bookSeats(client, event_id, userId, seatLabels, booking.id);
      if (!claim.ok) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: claim.reason || 'Selected seat(s) are no longer available.' });
      }
      // Price comes from the seats' zones (per-seat), plus per-seat tiered GST.
      subtotal  = claim.total;
      gstAmount = gst.gstForSeats(claim.seats);
      totalPrice = gst.round2(subtotal + gstAmount);
      await client.query('UPDATE bookings SET total_price = $1 WHERE id = $2', [totalPrice, booking.id]);
      booking.total_price = totalPrice;
      booking.seat_labels = seatLabels;
      // Globally-unique per-seat codes embed the chosen seat (e.g. TKT-XYZ-A1).
      ticketCodes = seatLabels.map((l) => `${baseTicketId}-${l}`);
    } else {
      ticketCodes = makeSeatTicketIds(baseTicketId, seatsRequested);
    }

    // Apply a promo / referral code (validated server-side; authoritative).
    let discountAmount = 0;
    let appliedPromo = null;
    if (promo_code && String(promo_code).trim()) {
      const ev = await promos.evaluatePromo(client, { codeRaw: promo_code, eventId: event_id, userId, subtotal });
      if (!ev.ok) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: ev.reason || 'This promo code can’t be applied.' });
      }
      appliedPromo = ev.promo;
      discountAmount = Math.min(ev.discount, gst.round2(subtotal + gstAmount));
    }
    const finalTotal = gst.round2(subtotal + gstAmount - discountAmount);
    await client.query(
      'UPDATE bookings SET total_price = $1, discount_amount = $2, promo_code = $3 WHERE id = $4',
      [finalTotal, discountAmount, appliedPromo ? appliedPromo.code : null, booking.id]
    );
    booking.total_price = finalTotal;
    if (appliedPromo) {
      await promos.recordRedemption(client, appliedPromo.id, userId, booking.id, discountAmount);
    }

    // Decrement available seats (keeps the aggregate count in sync for both flows).
    await client.query(
      `UPDATE events
         SET available_seats = (CASE
           WHEN available_seats IS NULL THEN COALESCE(total_seats, 0) - $1
           ELSE available_seats - $1
         END)
       WHERE id = $2`,
      [seatsRequested, event_id]
    );

    await client.query('COMMIT');

    // Tell everyone watching the seat map that these seats are now taken.
    if (seatLabels) {
      try { seats.emitBooked(event_id, seatLabels); } catch (_) {}
    }

    booking.ticket_codes = ticketCodes;
    booking.subtotal = gst.round2(subtotal);
    booking.gst = gst.round2(gstAmount);
    booking.discount = gst.round2(discountAmount);
    booking.promo_code = appliedPromo ? appliedPromo.code : null;
    res.status(201).json({ message: 'Booking created successfully', booking });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  } finally {
    client.release();
  }
});

// GET USER BOOKINGS
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const result = await pool.query(
      `SELECT b.*, b.number_of_seats AS seats_booked, b.status AS booking_status,
              e.title, e.event_date, e.location, e.image_url, e.category,
              e.place, e.map_url
         FROM bookings b
         LEFT JOIN events e ON b.event_id = e.id
        WHERE b.user_id = $1
        ORDER BY b.created_at DESC`,
      [userId]
    );
    const rows = result.rows.map(r => ({
      ...r,
      ticket_codes: makeSeatTicketIds(r.ticket_id || `BK-${r.id}`, Number(r.number_of_seats) || 1)
    }));
    res.json({ bookings: rows });
  } catch (error) {
    console.error('List bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// GET booking by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT b.*, b.number_of_seats AS seats_booked, b.status AS booking_status,
              e.title AS event_title, e.event_date AS event_date, e.location AS event_location,
              e.image_url AS event_image_url, e.category AS event_category,
              e.place AS event_place, e.map_url AS event_map_url,
              u.name AS user_name
         FROM bookings b
         LEFT JOIN events e ON b.event_id = e.id
         LEFT JOIN users u ON b.user_id = u.id
        WHERE b.id = $1`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
    const booking = result.rows[0];

    // Reserved-seating bookings: return the ACTUAL seats (label + zone + price)
    // so the ticket can show real seat numbers and detect VIP by zone. The
    // per-seat codes embed the seat label (TKT-xxx-A1). Falls back to index
    // codes for general-admission bookings.
    const base = booking.ticket_id || `BK-${booking.id}`;
    const seatRows = await pool.query(
      `SELECT seat_label, zone, price FROM event_seats
        WHERE booking_id = $1 ORDER BY row_label, seat_num`,
      [id]
    );
    if (seatRows.rows.length) {
      booking.seats = seatRows.rows.map(s => ({ label: s.seat_label, zone: s.zone, price: Number(s.price) }));
      booking.ticket_codes = seatRows.rows.map(s => `${base}-${s.seat_label}`);
      booking.is_reserved = true;
    } else {
      booking.ticket_codes = makeSeatTicketIds(base, Number(booking.number_of_seats) || 1);
      booking.is_reserved = false;
    }
    res.json({ booking });
  } catch (error) {
    console.error('Fetch booking error:', error);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// CANCEL QUOTE — preview the refund without actually cancelling.
// The frontend uses this to show the refund breakdown in the confirm popup.
router.get('/:id/cancel-quote', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId || req.user.id;
    const result = await pool.query(
      `SELECT b.id, b.user_id, b.number_of_seats, b.total_price, b.status, b.ticket_id,
              e.id AS event_id, e.title AS event_title, e.event_date
         FROM bookings b
         LEFT JOIN events e ON e.id = b.event_id
        WHERE b.id = $1 AND b.user_id = $2`,
      [id, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Booking not found' });
    const b = result.rows[0];
    if (b.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });

    const quote = computeRefund(b.total_price, b.event_date);
    res.json({
      booking: {
        id: b.id, ticket_id: b.ticket_id,
        seats: b.number_of_seats, total_price: b.total_price,
        event_title: b.event_title, event_date: b.event_date
      },
      ...quote
    });
  } catch (err) {
    console.error('Cancel quote error:', err);
    res.status(500).json({ error: 'Failed to load cancel quote' });
  }
});

// CANCEL BOOKING — applies the time-tiered refund and frees up the seats.
router.put('/:id/cancel', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const userId = req.user.userId || req.user.id;

    const bookingResult = await client.query(
      `SELECT b.*, e.event_date, e.title AS event_title
         FROM bookings b
         LEFT JOIN events e ON e.id = b.event_id
        WHERE b.id = $1 AND b.user_id = $2`,
      [id, userId]
    );
    if (bookingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Booking not found' });
    }
    const booking = bookingResult.rows[0];
    if (booking.status === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Already cancelled' });
    }

    const quote = computeRefund(booking.total_price, booking.event_date);
    if (!quote.eligible) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: quote.label, ...quote });
    }

    // Optional reason from the user — capped at 500 chars to avoid abuse.
    const reasonRaw = req.body && req.body.reason ? String(req.body.reason).trim() : '';
    const reason    = reasonRaw ? reasonRaw.slice(0, 500) : null;

    // Mark cancelled, persist the refund amount + timestamp + reason, return seats.
    await client.query(
      `UPDATE bookings
          SET status = 'cancelled',
              cancelled_at = NOW(),
              refund_amount = $1,
              cancellation_reason = $2
        WHERE id = $3`,
      [quote.refund, reason, id]
    );
    await client.query(
      'UPDATE events SET available_seats = available_seats + $1 WHERE id = $2',
      [booking.number_of_seats, booking.event_id]
    );

    await client.query('COMMIT');

    // Reserved-seating events: release the specific seats back to the live map.
    try { await seats.freeSeatsForBooking(booking.event_id, id); } catch (_) {}

    res.json({
      message: 'Booking cancelled successfully',
      refund: quote.refund,
      deduction: quote.deduction,
      deductionPct: quote.deductionPct,
      reason: quote.reason,
      label: quote.label
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Cancel booking error:', error);
    res.status(500).json({ error: 'Cancellation failed' });
  } finally {
    client.release();
  }
});

// ──────────────────────────────────────────────────────────────────
// Organizer view — all bookings for events the current user organizes,
// joined with attendee + event info. Used by the organizer dashboard's
// "Bookings" section.
// ──────────────────────────────────────────────────────────────────
router.get('/organizer/all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const result = await pool.query(
      `SELECT b.id,
              b.event_id,
              b.user_id,
              b.number_of_seats AS seats_booked,
              b.total_price,
              b.status,
              b.ticket_id,
              b.transaction_id,
              b.ticket_holder_name,
              b.ticket_holder_email,
              b.ticket_holder_mobile,
              b.cancelled_at,
              b.refund_amount,
              b.cancellation_reason,
              b.created_at      AS booked_at,
              e.title           AS event_title,
              e.event_date      AS event_date,
              e.location        AS event_location,
              e.category        AS event_category,
              e.image_url       AS event_image_url,
              u.id              AS attendee_id,
              u.name            AS attendee_name,
              u.email           AS attendee_email,
              u.mobile          AS attendee_mobile,
              u.profile_image   AS attendee_avatar,
              u.last_seen       AS attendee_last_seen
         FROM bookings b
         JOIN events   e ON e.id = b.event_id
         JOIN users    u ON u.id = b.user_id
        WHERE e.organizer_id = $1
        ORDER BY b.created_at DESC`,
      [userId]
    );
    res.json({ bookings: result.rows });
  } catch (err) {
    console.error('Organizer bookings error:', err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// PUBLIC ticket validity check — used by the QR-scan landing page (verify.html)
// to detect cancelled tickets even if the QR was downloaded before cancellation.
// No auth: anyone with the QR can scan it. Returns minimal info.
router.get('/ticket-status/:bookingId', async (req, res) => {
  try {
    const id = parseInt(req.params.bookingId, 10);
    if (!id) return res.status(400).json({ error: 'Invalid booking id' });
    const result = await pool.query(
      'SELECT id, status, ticket_id, cancelled_at, event_id FROM bookings WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      // Don't 404 — just say "unknown". Avoids leaking whether ids exist.
      return res.json({ valid: false, status: 'unknown' });
    }
    const b = result.rows[0];
    const valid = b.status !== 'cancelled';
    res.json({
      valid,
      status: b.status,
      ticket_id: b.ticket_id,
      cancelled_at: b.cancelled_at,
      event_id: b.event_id
    });
  } catch (err) {
    console.error('Ticket status error:', err);
    res.status(500).json({ error: 'Failed to check ticket' });
  }
});

// ──────────────────────────────────────────────────────────────────
// Organizer in-app scanner — used at the venue gate.
//
// Flow:
//   1. Organizer opens the Scanner section in their dashboard
//   2. Picks one of their events
//   3. Camera scans a ticket QR; the QR encodes the verify-page URL
//      with `?t=<seat_code>&b=<booking_id>` query params
//   4. We validate: ticket exists, belongs to this event, isn't cancelled,
//      hasn't been scanned before → INSERT into check_ins → live count drops
//
// All endpoints require the caller to own the event being scanned.
// ──────────────────────────────────────────────────────────────────

// GET /api/bookings/scanner/events
// List the organizer's events with scan-relevant counters so the
// scanner UI can show a quick picker.
router.get('/scanner/events', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const result = await pool.query(`
      SELECT e.id,
             e.title,
             e.event_date,
             e.location,
             e.total_seats,
             e.image_url,
             COALESCE(SUM(CASE WHEN b.status <> 'cancelled' THEN b.number_of_seats ELSE 0 END), 0)::int AS booked_seats,
             (SELECT COUNT(*)::int FROM check_ins c WHERE c.event_id = e.id) AS scanned_count
        FROM events e
        LEFT JOIN bookings b ON b.event_id = e.id
       WHERE e.organizer_id = $1
    GROUP BY e.id
    ORDER BY e.event_date ASC NULLS LAST, e.id DESC
    `, [userId]);
    res.json({ events: result.rows });
  } catch (err) {
    console.error('Scanner events error:', err);
    res.status(500).json({ error: 'Failed to load events' });
  }
});

// GET /api/bookings/scanner/event/:eventId/stats
// Live counters for one event — polled by the scanner UI.
router.get('/scanner/event/:eventId/stats', authenticateToken, async (req, res) => {
  try {
    const userId  = req.user.userId || req.user.id;
    const eventId = parseInt(req.params.eventId, 10);
    if (!eventId) return res.status(400).json({ error: 'Invalid event id' });

    const ev = await pool.query(
      'SELECT id, title, total_seats, organizer_id FROM events WHERE id = $1',
      [eventId]
    );
    if (ev.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    if (ev.rows[0].organizer_id !== userId) return res.status(403).json({ error: 'Not your event' });

    const counts = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN status <> 'cancelled' THEN number_of_seats ELSE 0 END), 0)::int AS booked_seats
      FROM bookings WHERE event_id = $1
    `, [eventId]);

    const scanned = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM check_ins WHERE event_id = $1',
      [eventId]
    );

    const recent = await pool.query(`
      SELECT c.id, c.seat_code, c.checked_in_at,
             u.name AS attendee_name
        FROM check_ins c
        LEFT JOIN bookings b ON b.id = c.booking_id
        LEFT JOIN users u    ON u.id = b.user_id
       WHERE c.event_id = $1
    ORDER BY c.checked_in_at DESC
       LIMIT 10
    `, [eventId]);

    const total   = ev.rows[0].total_seats || 0;
    const booked  = counts.rows[0].booked_seats || 0;
    const checked = scanned.rows[0].cnt || 0;
    res.json({
      event_id: eventId,
      title:    ev.rows[0].title,
      total_seats:    total,
      booked_seats:   booked,
      scanned_count:  checked,
      remaining_to_scan: Math.max(0, booked - checked),
      recent_scans: recent.rows
    });
  } catch (err) {
    console.error('Scanner stats error:', err);
    res.status(500).json({ error: 'Failed to load stats' });
  }
});

// POST /api/bookings/scanner/scan
// body: { event_id, qr_text }
// Validates the ticket and records the check-in. Idempotency-safe:
// duplicate scans return { ok:false, reason:'already-scanned' }.
router.post('/scanner/scan', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const userId  = req.user.userId || req.user.id;
    const eventId = parseInt(req.body.event_id, 10);
    const qrText  = String(req.body.qr_text || '').trim();
    if (!eventId)  return res.status(400).json({ ok: false, reason: 'missing-event-id' });
    if (!qrText)   return res.status(400).json({ ok: false, reason: 'empty-qr' });

    // The QR encodes a verify-page URL like:
    //   .../verify.html?t=<seat_code>&b=<booking_id>&n=<name>...
    // Try to parse as URL first; fall back to raw text as the seat code.
    let seatCode = qrText;
    let bookingIdFromQr = null;
    try {
      const u = new URL(qrText);
      if (u.searchParams.get('t')) seatCode = u.searchParams.get('t');
      const b = u.searchParams.get('b');
      if (b) bookingIdFromQr = parseInt(b, 10) || null;
    } catch (_) { /* not a URL — treat raw text as seat_code */ }

    // Verify the organizer owns this event.
    const evCheck = await client.query(
      'SELECT id, organizer_id, title FROM events WHERE id = $1',
      [eventId]
    );
    if (evCheck.rows.length === 0) return res.status(404).json({ ok: false, reason: 'event-not-found' });
    if (evCheck.rows[0].organizer_id !== userId) return res.status(403).json({ ok: false, reason: 'not-your-event' });

    // Locate the booking that this seat code belongs to. Seat codes look like
    // "<base_ticket_id>-<seat_no>", so we strip the suffix and match against
    // booking.ticket_id. As a safety net, we also accept lookups by booking_id
    // if the QR included it as the `b` param.
    const baseTicketId = seatCode.replace(/-\d+$/, '');
    let booking = null;
    if (bookingIdFromQr) {
      const r = await client.query(
        'SELECT id, event_id, status, ticket_id, user_id, ticket_holder_name, number_of_seats FROM bookings WHERE id = $1',
        [bookingIdFromQr]
      );
      if (r.rows.length > 0) booking = r.rows[0];
    }
    if (!booking) {
      const r = await client.query(
        'SELECT id, event_id, status, ticket_id, user_id, ticket_holder_name, number_of_seats FROM bookings WHERE ticket_id = $1',
        [baseTicketId]
      );
      if (r.rows.length > 0) booking = r.rows[0];
    }
    if (!booking)                            return res.status(404).json({ ok: false, reason: 'ticket-not-found' });
    if (booking.event_id !== eventId)        return res.status(409).json({ ok: false, reason: 'wrong-event', expected_event: booking.event_id });
    if (booking.status === 'cancelled')      return res.status(410).json({ ok: false, reason: 'cancelled' });

    // INSERT and let the unique index reject duplicates.
    try {
      const ins = await client.query(
        `INSERT INTO check_ins (booking_id, event_id, seat_code, scanned_by)
         VALUES ($1, $2, $3, $4)
         RETURNING id, checked_in_at`,
        [booking.id, eventId, seatCode, userId]
      );

      // Look up the current scanned count for the live counter
      const cnt = await client.query(
        'SELECT COUNT(*)::int AS cnt FROM check_ins WHERE event_id = $1',
        [eventId]
      );

      const holderRow = await client.query(
        'SELECT b.ticket_holder_name, u.name AS user_name FROM bookings b LEFT JOIN users u ON u.id = b.user_id WHERE b.id = $1',
        [booking.id]
      );
      const holder = holderRow.rows[0] || {};

      return res.json({
        ok: true,
        seat_code:    seatCode,
        booking_id:   booking.id,
        attendee:     holder.ticket_holder_name || holder.user_name || null,
        scanned_at:   ins.rows[0].checked_in_at,
        scanned_count: cnt.rows[0].cnt
      });
    } catch (e) {
      // unique violation = already scanned
      if (e.code === '23505') {
        const prev = await client.query(
          'SELECT checked_in_at FROM check_ins WHERE seat_code = $1 LIMIT 1',
          [seatCode]
        );
        return res.status(409).json({
          ok: false,
          reason: 'already-scanned',
          seat_code: seatCode,
          first_scanned_at: prev.rows[0] ? prev.rows[0].checked_in_at : null
        });
      }
      throw e;
    }
  } catch (err) {
    console.error('Scanner scan error:', err);
    res.status(500).json({ ok: false, reason: 'server-error' });
  } finally {
    client.release();
  }
});

module.exports = router;
