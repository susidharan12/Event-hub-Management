/* ──────────────────────────────────────────────────────────────────
   seats.js — reserved-seating logic for the live seat map.
   ------------------------------------------------------------------
   Owns: generating an event's seats from its layout, reading the seat
   map with effective status, holding/releasing seats (5-min TTL) and
   sweeping expired holds. Booking (marking seats 'booked') lives in the
   bookings route so it shares that route's transaction — see bookSeats().
   ────────────────────────────────────────────────────────────────── */
const pool = require('../db');
const realtime = require('./realtime');

const HOLD_MINUTES = 5;
const MAX_SEATS_PER_BOOKING = 10;

/** A1, A2 … Z, then AA, AB … for >26 rows. */
function rowLetter(i) {
  let s = '';
  let n = i;
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
}

/** Effective status of a seat row given the current time. */
function effectiveStatus(row, nowMs) {
  if (row.status === 'booked') return 'booked';
  if (row.held_by && row.hold_expires && new Date(row.hold_expires).getTime() > nowMs) return 'held';
  return 'available';
}

/**
 * Generate event_seats rows from a layout object.
 * layout = { zones: [{ name, price, rows, cols }] }
 * Runs inside the caller's transaction `client`. Idempotent via ON CONFLICT.
 * Returns the total number of seats defined by the layout.
 */
async function generateSeats(client, eventId, layout) {
  const seats = [];

  if (layout && Array.isArray(layout.rows) && layout.rows.length) {
    // ── ROW-WISE layout ──────────────────────────────────────────────
    // Each row defines its own seat count + price (+ optional section).
    // Seats in a row that has fewer seats than the grid width are simply
    // omitted, so the organizer can shape non-rectangular auditoriums.
    layout.rows.forEach((r, idx) => {
      const label = (r.label && String(r.label).trim()) || rowLetter(idx);
      const count = Math.min(100, Math.max(1, parseInt(r.seats, 10) || 1));
      const price = Math.max(0, Number(r.price) || 0);
      const zone  = String(r.section || r.category || r.zone || ('₹' + price)).slice(0, 60);
      for (let c = 1; c <= count; c++) {
        seats.push({ label: `${label}${c}`, row: label, num: c, zone, price });
      }
    });
  } else {
    // ── ZONE layout (uniform rows × cols per zone) — legacy/alternative ─
    const zones = (layout && Array.isArray(layout.zones)) ? layout.zones : [];
    let rowIndex = 0;
    for (const zone of zones) {
      const rows = Math.min(200, Math.max(1, parseInt(zone.rows, 10) || 1));
      const cols = Math.min(100, Math.max(1, parseInt(zone.cols, 10) || 1));
      const price = Math.max(0, Number(zone.price) || 0);
      const zoneName = String(zone.name || 'Standard').slice(0, 60);
      for (let r = 0; r < rows; r++) {
        const rl = rowLetter(rowIndex++);
        for (let c = 1; c <= cols; c++) {
          seats.push({ label: `${rl}${c}`, row: rl, num: c, zone: zoneName, price });
        }
      }
    }
  }

  if (!seats.length) return 0;

  // Insert in chunks (6 params/seat; stay well under the pg param cap).
  const CHUNK = 800;
  for (let i = 0; i < seats.length; i += CHUNK) {
    const slice = seats.slice(i, i + CHUNK);
    const values = [];
    const params = [];
    slice.forEach((s, j) => {
      const b = j * 6;
      values.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6})`);
      params.push(eventId, s.label, s.row, s.num, s.zone, s.price);
    });
    await client.query(
      `INSERT INTO event_seats (event_id, seat_label, row_label, seat_num, zone, price)
       VALUES ${values.join(',')}
       ON CONFLICT (event_id, seat_label) DO NOTHING`,
      params
    );
  }
  return seats.length;
}

/** Read the full seat map for an event with effective per-seat status. */
async function getSeatMap(eventId) {
  const ev = await pool.query(
    'SELECT id, title, reserved_seating, seating_layout, ticket_price FROM events WHERE id = $1',
    [eventId]
  );
  if (!ev.rows.length) return null;
  const event = ev.rows[0];

  const seatsRes = await pool.query(
    `SELECT seat_label, row_label, seat_num, zone, price, status, held_by, hold_expires
       FROM event_seats WHERE event_id = $1
      ORDER BY row_label, seat_num`,
    [eventId]
  );
  const nowMs = Date.now();
  const seats = seatsRes.rows.map((s) => ({
    label: s.seat_label,
    row: s.row_label,
    num: s.seat_num,
    zone: s.zone,
    price: Number(s.price),
    status: effectiveStatus(s, nowMs)
  }));

  // Distinct zones with their price range (rows in a zone may differ).
  const zoneMap = {};
  for (const s of seats) {
    const z = zoneMap[s.zone] || (zoneMap[s.zone] = { min: s.price, max: s.price });
    z.min = Math.min(z.min, s.price);
    z.max = Math.max(z.max, s.price);
  }
  const zones = Object.entries(zoneMap).map(([name, p]) => ({ name, price: p.min, priceMin: p.min, priceMax: p.max }));

  return {
    eventId: Number(eventId),
    reserved_seating: !!event.reserved_seating,
    ticket_price: Number(event.ticket_price) || 0,
    layout: event.seating_layout || null,
    zones,
    seats
  };
}

/**
 * Hold a set of seats for `userId` for HOLD_MINUTES. Atomic & row-locked.
 * Returns { ok, expires_at, hold_minutes } or { ok:false, reason }.
 */
async function holdSeats(eventId, userId, labels) {
  if (!Array.isArray(labels) || !labels.length) return { ok: false, reason: 'No seats selected' };
  if (labels.length > MAX_SEATS_PER_BOOKING) return { ok: false, reason: `You can hold at most ${MAX_SEATS_PER_BOOKING} seats` };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query(
      `SELECT seat_label, status, held_by, hold_expires
         FROM event_seats
        WHERE event_id = $1 AND seat_label = ANY($2)
        FOR UPDATE`,
      [eventId, labels]
    );
    if (res.rows.length !== labels.length) {
      await client.query('ROLLBACK');
      return { ok: false, reason: 'Some selected seats do not exist' };
    }
    const nowMs = Date.now();
    for (const s of res.rows) {
      const booked = s.status === 'booked';
      const heldByOther = s.held_by && s.held_by !== userId &&
        s.hold_expires && new Date(s.hold_expires).getTime() > nowMs;
      if (booked || heldByOther) {
        await client.query('ROLLBACK');
        return { ok: false, reason: `Seat ${s.seat_label} is no longer available` };
      }
    }
    const expires = new Date(nowMs + HOLD_MINUTES * 60 * 1000);
    await client.query(
      `UPDATE event_seats SET held_by = $3, hold_expires = $4
        WHERE event_id = $1 AND seat_label = ANY($2) AND status = 'available'`,
      [eventId, labels, userId, expires]
    );
    await client.query('COMMIT');
    realtime.emitSeatUpdate(eventId, labels.map((l) => ({ seat_label: l, status: 'held' })));
    return { ok: true, expires_at: expires.toISOString(), hold_minutes: HOLD_MINUTES };
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally {
    client.release();
  }
}

/** Release seats currently held by this user (no-op for booked seats). */
async function releaseSeats(eventId, userId, labels) {
  if (!Array.isArray(labels) || !labels.length) return { ok: true };
  await pool.query(
    `UPDATE event_seats SET held_by = NULL, hold_expires = NULL
      WHERE event_id = $1 AND seat_label = ANY($2) AND status = 'available' AND held_by = $3`,
    [eventId, labels, userId]
  );
  realtime.emitSeatUpdate(eventId, labels.map((l) => ({ seat_label: l, status: 'available' })));
  return { ok: true };
}

/**
 * Mark held/available seats as booked inside an EXISTING transaction `client`.
 * Verifies the seats belong to the event and are bookable by this user.
 * Returns { ok, seats:[{label,price}], total } or { ok:false, reason }.
 * Caller is responsible for COMMIT/ROLLBACK and for broadcasting on success
 * (use emitBooked() after commit).
 */
async function bookSeats(client, eventId, userId, labels, bookingId) {
  if (!Array.isArray(labels) || !labels.length) return { ok: false, reason: 'No seats selected' };

  const res = await client.query(
    `SELECT seat_label, price, status, held_by, hold_expires
       FROM event_seats
      WHERE event_id = $1 AND seat_label = ANY($2)
      FOR UPDATE`,
    [eventId, labels]
  );
  if (res.rows.length !== labels.length) return { ok: false, reason: 'Some selected seats do not exist' };

  const nowMs = Date.now();
  for (const s of res.rows) {
    const booked = s.status === 'booked';
    const heldByOther = s.held_by && s.held_by !== userId &&
      s.hold_expires && new Date(s.hold_expires).getTime() > nowMs;
    if (booked || heldByOther) return { ok: false, reason: `Seat ${s.seat_label} is no longer available` };
  }

  await client.query(
    `UPDATE event_seats
        SET status = 'booked', booking_id = $3, held_by = NULL, hold_expires = NULL
      WHERE event_id = $1 AND seat_label = ANY($2) AND status = 'available'`,
    [eventId, labels, bookingId]
  );

  const total = res.rows.reduce((sum, s) => sum + Number(s.price), 0);
  return { ok: true, seats: res.rows.map((s) => ({ label: s.seat_label, price: Number(s.price) })), total };
}

/** Broadcast that seats became booked (call AFTER the booking commit). */
function emitBooked(eventId, labels) {
  realtime.emitSeatUpdate(eventId, labels.map((l) => ({ seat_label: l, status: 'booked' })));
}

/** Free seats back to the pool when a booking is cancelled. */
async function freeSeatsForBooking(eventId, bookingId) {
  const res = await pool.query(
    `UPDATE event_seats SET status = 'available', booking_id = NULL, held_by = NULL, hold_expires = NULL
      WHERE event_id = $1 AND booking_id = $2
      RETURNING seat_label`,
    [eventId, bookingId]
  );
  if (res.rows.length) {
    realtime.emitSeatUpdate(eventId, res.rows.map((r) => ({ seat_label: r.seat_label, status: 'available' })));
  }
  return res.rows.map((r) => r.seat_label);
}

/**
 * Reconcile generated seats with existing (non-cancelled) bookings so every
 * booked ticket is reflected as a 'booked' seat. For each booking, if it has
 * fewer booked seats than it paid for, claim the shortfall from the available
 * pool (in row order). Then sync the event's total/available counts. Used
 * after a layout (re)generation so previously-sold seats stay SOLD.
 */
async function reconcileBookedSeats(eventId) {
  const bks = await pool.query(
    "SELECT id, number_of_seats FROM bookings WHERE event_id = $1 AND status <> 'cancelled'",
    [eventId]
  );
  for (const bk of bks.rows) {
    const need = Number(bk.number_of_seats) || 0;
    if (need <= 0) continue;
    const haveRes = await pool.query(
      "SELECT count(*)::int AS c FROM event_seats WHERE event_id = $1 AND booking_id = $2 AND status = 'booked'",
      [eventId, bk.id]
    );
    const gap = need - (haveRes.rows[0].c || 0);
    if (gap > 0) {
      await pool.query(
        `UPDATE event_seats SET status = 'booked', booking_id = $2, held_by = NULL, hold_expires = NULL
          WHERE id IN (
            SELECT id FROM event_seats
             WHERE event_id = $1 AND status = 'available'
             ORDER BY row_label, seat_num LIMIT $3
          )`,
        [eventId, bk.id, gap]
      );
    }
  }
  // Keep the aggregate counters in sync with the real seat states.
  await pool.query(
    `UPDATE events SET
        total_seats     = (SELECT count(*) FROM event_seats WHERE event_id = $1),
        available_seats = (SELECT count(*) FROM event_seats WHERE event_id = $1 AND status = 'available')
      WHERE id = $1`,
    [eventId]
  );
}

/** Periodic sweep: release expired holds and tell watchers they're free again. */
async function sweepExpiredHolds() {
  let res;
  try {
    res = await pool.query(
      `UPDATE event_seats SET held_by = NULL, hold_expires = NULL
        WHERE status = 'available' AND held_by IS NOT NULL AND hold_expires < now()
        RETURNING event_id, seat_label`
    );
  } catch (e) {
    return; // table may not exist yet on a brand-new DB; ignore
  }
  if (!res.rows.length) return;
  const byEvent = {};
  for (const r of res.rows) {
    (byEvent[r.event_id] = byEvent[r.event_id] || []).push({ seat_label: r.seat_label, status: 'available' });
  }
  for (const [eid, seats] of Object.entries(byEvent)) realtime.emitSeatUpdate(eid, seats);
}

module.exports = {
  HOLD_MINUTES,
  MAX_SEATS_PER_BOOKING,
  generateSeats,
  getSeatMap,
  holdSeats,
  releaseSeats,
  bookSeats,
  emitBooked,
  freeSeatsForBooking,
  reconcileBookedSeats,
  sweepExpiredHolds
};
