const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

const MAX_TICKETS_PER_USER_PER_EVENT = 10;

// Generate per-seat ticket codes derived from a base ticket id, e.g. TKT-XYZ-1, -2, -3
function makeSeatTicketIds(baseTicketId, seatCount) {
  const arr = [];
  for (let i = 1; i <= seatCount; i++) arr.push(`${baseTicketId}-${i}`);
  return arr;
}

// CREATE BOOKING
router.post('/', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { event_id, seats_booked, ticket_holder_name, ticket_holder_email, ticket_holder_mobile, transaction_id } = req.body;

    if (!event_id || !seats_booked) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const seatsRequested = Number(seats_booked);
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
      'SELECT id, ticket_price, available_seats, total_seats FROM events WHERE id = $1 FOR UPDATE',
      [event_id]
    );
    if (eventResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Event not found' });
    }
    const event = eventResult.rows[0];

    const availableSeats = (event.available_seats !== null && event.available_seats !== undefined)
      ? event.available_seats
      : (event.total_seats || 0);

    if (availableSeats < seatsRequested) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Not enough seats available. Available: ${availableSeats}` });
    }

    const totalPrice = (Number(event.ticket_price) || 0) * seatsRequested;

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

    // Decrement available seats.
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

    const booking = bookingResult.rows[0];
    booking.ticket_codes = makeSeatTicketIds(baseTicketId, seatsRequested);

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
    booking.ticket_codes = makeSeatTicketIds(booking.ticket_id || `BK-${booking.id}`, Number(booking.number_of_seats) || 1);
    res.json({ booking });
  } catch (error) {
    console.error('Fetch booking error:', error);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// CANCEL BOOKING
router.put('/:id/cancel', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const userId = req.user.userId || req.user.id;

    const bookingResult = await client.query(
      'SELECT * FROM bookings WHERE id = $1 AND user_id = $2',
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

    await client.query("UPDATE bookings SET status = 'cancelled' WHERE id = $1", [id]);
    await client.query(
      'UPDATE events SET available_seats = available_seats + $1 WHERE id = $2',
      [booking.number_of_seats, booking.event_id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Booking cancelled successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Cancel booking error:', error);
    res.status(500).json({ error: 'Cancellation failed' });
  } finally {
    client.release();
  }
});

module.exports = router;
