const pool = require('../db');
const seats = require('../services/seats');

// Parse the reserved-seating layout sent as a JSON string form-field.
// Returns { layout, totalSeats, minPrice } or null when not reserved/invalid.
function parseSeatingLayout(reservedRaw, layoutRaw) {
  const reserved = reservedRaw === true || reservedRaw === 'true' || reservedRaw === 'on' || reservedRaw === '1';
  if (!reserved) return null;
  let layout = layoutRaw;
  if (typeof layoutRaw === 'string') {
    try { layout = JSON.parse(layoutRaw); } catch (_) { return null; }
  }
  if (!layout) return null;

  let totalSeats = 0;
  let minPrice = Infinity;

  if (Array.isArray(layout.rows) && layout.rows.length) {
    // Row-wise: each row has its own seat count + price.
    for (const r of layout.rows) {
      const seats = Math.max(1, parseInt(r.seats, 10) || 1);
      totalSeats += seats;
      minPrice = Math.min(minPrice, Math.max(0, Number(r.price) || 0));
    }
  } else if (Array.isArray(layout.zones) && layout.zones.length) {
    // Zone-wise (legacy): uniform rows × cols.
    for (const z of layout.zones) {
      const rows = Math.max(1, parseInt(z.rows, 10) || 1);
      const cols = Math.max(1, parseInt(z.cols, 10) || 1);
      totalSeats += rows * cols;
      minPrice = Math.min(minPrice, Math.max(0, Number(z.price) || 0));
    }
  } else {
    return null;
  }

  if (!isFinite(minPrice)) minPrice = 0;
  return { layout, totalSeats, minPrice };
}

// Create a new event
const createEvent = async (req, res) => {
  try {
    console.log('createEvent invoked');
    console.log('   body:', req.body);
    console.log('   files:', req.files);
    
    const { title, category, event_date, location, ticket_price, total_seats, description, place, map_url } = req.body;

    // Reserved seating (opt-in): when enabled, capacity + price are DERIVED
    // from the zone/row layout rather than the flat total_seats/ticket_price.
    const seating = parseSeatingLayout(req.body.reserved_seating, req.body.seating_layout);

    // Validate required fields
    const missingFields = [];
    if (!title?.trim()) missingFields.push('title');
    if (!category?.trim()) missingFields.push('category');
    if (!event_date) missingFields.push('event_date');
    if (!location?.trim()) missingFields.push('location');
    if (!seating) {
      if (!ticket_price) missingFields.push('ticket_price');
      if (!total_seats) missingFields.push('total_seats');
    }
    if (!description?.trim()) missingFields.push('description');
    // If the organizer ticked reserved seating but the layout is empty/invalid:
    if ((req.body.reserved_seating === 'true' || req.body.reserved_seating === true) && !seating) {
      return res.status(400).json({ error: 'Reserved seating is on but the seat layout is empty. Add at least one zone with rows and seats.' });
    }
    
    // Check for profile image
    if (!req.files || !req.files['image'] || req.files['image'].length === 0) {
      missingFields.push('profile image');
    }
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }

    let organizer_id;
    if (req.user && req.user.id) {
      organizer_id = req.user.id;
    } else {
      const orgResult = await pool.query("SELECT id FROM users WHERE role = 'organizer' LIMIT 1");
      if (orgResult.rows.length === 0) {
        return res.status(400).json({ error: 'No organizer found' });
      }
      organizer_id = orgResult.rows[0].id;
    }

    // For reserved seating, capacity/price come from the layout.
    const priceVal = seating ? seating.minPrice : parseFloat(ticket_price);
    const seatsVal = seating ? seating.totalSeats : parseInt(total_seats, 10);

    // Handle profile image (single image field)
    const image_url = req.files['image'][0]
      ? `/uploads/${req.files['image'][0].filename}`
      : null;
    
    // Handle additional images (multiple images field)
    const images = req.files && req.files['images']
      ? req.files['images'].map(file => `/uploads/${file.filename}`)
      : [];

    const query = `
      INSERT INTO events (organizer_id, title, description, location, event_date, ticket_price, total_seats, available_seats, image_url, images, category, place, map_url, reserved_seating, seating_layout)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *;
    `;
    const values = [
      organizer_id,
      title.trim(),
      description.trim(),
      location.trim(),
      event_date,
      priceVal,
      seatsVal,
      seatsVal,
      image_url,
      images,
      category.trim(),
      (place && String(place).trim()) || null,
      (map_url && String(map_url).trim()) || null,
      !!seating,
      seating ? JSON.stringify(seating.layout) : null
    ];

    const result = await pool.query(query, values);
    const event = result.rows[0];

    // Generate the physical seats for a reserved-seating event.
    if (seating) {
      try {
        await seats.generateSeats(pool, event.id, seating.layout);
      } catch (seatErr) {
        console.error('Seat generation failed for event', event.id, seatErr.message);
      }
    }

    res.status(201).json({
      message: 'Event created successfully',
      title: event.title,
      id: event.id,
      event_date: event.event_date,
      location: event.location,
      ticket_price: event.ticket_price,
      reserved_seating: event.reserved_seating
    });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: error.message || 'Failed to create event' });
  }
};

// Get all events (or filter by organizer if needed)
const getEvents = async (req, res) => {
  try {
    let query = 'SELECT * FROM events';
    const values = [];

    // Support filtering by organizer (used by analytics)
    if (req.query.organizer) {
      query += ' WHERE organizer_id = $1';
      values.push(req.query.organizer);
    }

    query += ' ORDER BY event_date DESC';
    const result = await pool.query(query, values);
    res.status(200).json({ events: result.rows });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get single event by ID
// Joins users so the public event page can show "Presented by …" without
// a second round-trip — exposes only safe-to-display organizer fields.
const getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT
        e.*,
        u.name              AS organizer_name,
        u.organization_name AS organizer_organization_name,
        u.profile_image     AS organizer_profile_image
      FROM events e
      LEFT JOIN users u ON u.id = e.organizer_id
      WHERE e.id = $1
    `;
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update event by ID (organizer must own it)
const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId || req.user.id;

    // Ownership check.
    const ownerCheck = await pool.query('SELECT organizer_id FROM events WHERE id = $1', [id]);
    if (ownerCheck.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    if (ownerCheck.rows[0].organizer_id !== userId) {
      return res.status(403).json({ error: 'You can only edit events you created' });
    }

    // Sparse UPDATE — caller can omit any field.
    const sets = [];
    const values = [];
    const push = (column, value) => {
      if (value === undefined) return;
      values.push(value === '' ? null : value);
      sets.push(`${column} = $${values.length}`);
    };

    const b = req.body || {};
    push('title',       b.title);
    push('description', b.description);
    push('category',    b.category);
    push('location',    b.location);
    push('place',       b.place);
    push('map_url',     b.map_url);
    push('event_date',  b.event_date);
    // Reserved seating (opt-in). When enabled, capacity + price are DERIVED
    // from the row layout and the physical seats are (re)generated after the
    // update. When the layout is present we ignore the flat price/seats fields.
    const seating = parseSeatingLayout(b.reserved_seating, b.seating_layout);
    const reservedProvided = (b.reserved_seating !== undefined);

    if (seating) {
      push('reserved_seating', true);
      push('seating_layout', JSON.stringify(seating.layout));
      push('ticket_price',    seating.minPrice);
      push('total_seats',     seating.totalSeats);
      push('available_seats', seating.totalSeats);
    } else {
      if (reservedProvided) push('reserved_seating', false); // toggled off → GA
      if (b.ticket_price !== undefined) push('ticket_price', parseFloat(b.ticket_price));

      // Updating total_seats also bumps available_seats by the delta so an
      // organizer can grow capacity (or shrink, never below already-booked).
      if (b.total_seats !== undefined) {
        const newTotal = parseInt(b.total_seats, 10);
        const cur = await pool.query('SELECT total_seats, available_seats FROM events WHERE id = $1', [id]);
        const oldTotal = parseInt(cur.rows[0].total_seats, 10) || 0;
        const oldAvail = parseInt(cur.rows[0].available_seats, 10) || 0;
        const newAvail = Math.max(0, oldAvail + (newTotal - oldTotal));
        push('total_seats',     newTotal);
        push('available_seats', newAvail);
      }
    }

    // Handle uploaded files (optional).
    if (req.files && req.files['image'] && req.files['image'][0]) {
      push('image_url', `/uploads/${req.files['image'][0].filename}`);
    }

    // Additional images: merge whichever existing URLs the client chose to keep
    // (sent as `kept_images`, a JSON array of URL strings) with any newly
    // uploaded files. We only touch the column when the client explicitly told
    // us about kept images OR uploaded new files — otherwise leave it alone.
    const newUploadUrls = (req.files && req.files['images'])
      ? req.files['images'].map(f => `/uploads/${f.filename}`)
      : [];
    let keptUrls = null;
    if (b.kept_images !== undefined) {
      try {
        const parsed = typeof b.kept_images === 'string'
          ? JSON.parse(b.kept_images)
          : b.kept_images;
        if (Array.isArray(parsed)) {
          keptUrls = parsed.filter(u => typeof u === 'string');
        }
      } catch (_) { /* invalid JSON → treat as not provided */ }
    }
    if (keptUrls !== null || newUploadUrls.length > 0) {
      const merged = (keptUrls || []).concat(newUploadUrls);
      push('images', merged);
    }

    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });

    values.push(id);
    const sql = `UPDATE events SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`;
    const result = await pool.query(sql, values);

    // (Re)generate physical seats to match the new layout. Done after the
    // events row is updated so the seat map reflects the latest configuration.
    if (seating) {
      try {
        // Remember which seats were already SOLD (by which booking) so a layout
        // edit never silently un-sells them.
        const prevBooked = await pool.query(
          `SELECT booking_id, seat_label FROM event_seats
            WHERE event_id = $1 AND status = 'booked' AND booking_id IS NOT NULL`,
          [id]
        );
        await pool.query('DELETE FROM event_seats WHERE event_id = $1', [id]);
        await seats.generateSeats(pool, id, seating.layout);
        // Re-mark the exact same seats as sold where they still exist.
        for (const r of prevBooked.rows) {
          await pool.query(
            `UPDATE event_seats SET status = 'booked', booking_id = $2
              WHERE event_id = $1 AND seat_label = $3 AND status = 'available'`,
            [id, r.booking_id, r.seat_label]
          );
        }
        // Fill any remaining sold-seat shortfall (count-based bookings, or seats
        // whose labels no longer exist) and sync the capacity counters.
        await seats.reconcileBookedSeats(id);
      } catch (seatErr) {
        console.error('Seat regeneration failed for event', id, seatErr.message);
      }
    } else if (reservedProvided) {
      // Reserved seating turned off → drop any previously generated seats.
      try { await pool.query('DELETE FROM event_seats WHERE event_id = $1', [id]); } catch (_) {}
    }

    res.json({ message: 'Event updated successfully', event: result.rows[0] });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: error.message || 'Failed to update event' });
  }
};

// Delete event by ID
const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const query = 'DELETE FROM events WHERE id = $1 RETURNING *';
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    res.status(200).json({ message: 'Event deleted successfully', event: result.rows[0] });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { createEvent, getEvents, getEventById, updateEvent, deleteEvent };