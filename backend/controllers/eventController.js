const pool = require('../db');

// Create a new event
const createEvent = async (req, res) => {
  try {
    console.log('➡️ createEvent invoked');
    console.log('   body:', req.body);
    console.log('   files:', req.files);
    
    const { title, category, event_date, location, ticket_price, total_seats, description, place, map_url } = req.body;

    // Validate required fields
    const missingFields = [];
    if (!title?.trim()) missingFields.push('title');
    if (!category?.trim()) missingFields.push('category');
    if (!event_date) missingFields.push('event_date');
    if (!location?.trim()) missingFields.push('location');
    if (!ticket_price) missingFields.push('ticket_price');
    if (!total_seats) missingFields.push('total_seats');
    if (!description?.trim()) missingFields.push('description');
    
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

    const priceVal = parseFloat(ticket_price);
    const seatsVal = parseInt(total_seats, 10);
    
    // Handle profile image (single image field)
    const image_url = req.files['image'][0]
      ? `/uploads/${req.files['image'][0].filename}`
      : null;
    
    // Handle additional images (multiple images field)
    const images = req.files && req.files['images']
      ? req.files['images'].map(file => `/uploads/${file.filename}`)
      : [];

    const query = `
      INSERT INTO events (organizer_id, title, description, location, event_date, ticket_price, total_seats, available_seats, image_url, images, category, place, map_url)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *;
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
      (map_url && String(map_url).trim()) || null
    ];

    const result = await pool.query(query, values);
    const event = result.rows[0];
    
    res.status(201).json({ 
      message: 'Event created successfully', 
      title: event.title,
      id: event.id,
      event_date: event.event_date,
      location: event.location,
      ticket_price: event.ticket_price
    });
  } catch (error) {
    console.error('❌ Error creating event:', error);
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
const getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    const query = 'SELECT * FROM events WHERE id = $1';
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

    // Handle uploaded files (optional).
    if (req.files && req.files['image'] && req.files['image'][0]) {
      push('image_url', `/uploads/${req.files['image'][0].filename}`);
    }
    if (req.files && req.files['images'] && req.files['images'].length > 0) {
      const newImgs = req.files['images'].map(f => `/uploads/${f.filename}`);
      push('images', newImgs);
    }

    if (sets.length === 0) return res.status(400).json({ error: 'No fields to update' });

    values.push(id);
    const sql = `UPDATE events SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`;
    const result = await pool.query(sql, values);
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