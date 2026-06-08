const express = require('express');
const db = require('../db');
const router = express.Router();

// Middleware to verify user
const verifyUser = (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  req.userId = userId;
  next();
};

// ============ WATCHLIST ENDPOINTS ============

// Get user's watchlist
router.get('/watchlist', verifyUser, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT e.*,
              w.added_at,
              (SELECT COUNT(*) FROM bookings WHERE event_id = e.id AND status = 'confirmed') as total_bookings,
              (SELECT AVG(rating) FROM event_reviews WHERE event_id = e.id) as avg_rating
       FROM event_watchlist w
       JOIN events e ON w.event_id = e.id
       WHERE w.user_id = $1
       ORDER BY w.added_at DESC`,
      [req.userId]
    );
    res.json({ watchlist: result.rows, count: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch watchlist', details: err.message });
  }
});

// Add event to watchlist
router.post('/watchlist/:eventId', verifyUser, async (req, res) => {
  try {
    const { eventId } = req.params;

    // Check if event exists
    const eventCheck = await db.query('SELECT id FROM events WHERE id = $1', [eventId]);
    if (!eventCheck.rows[0]) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Add to watchlist
    const result = await db.query(
      `INSERT INTO event_watchlist (user_id, event_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, event_id) DO NOTHING
       RETURNING *`,
      [req.userId, eventId]
    );

    res.json({
      message: 'Event added to watchlist',
      watchlist_item: result.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add to watchlist', details: err.message });
  }
});

// Remove event from watchlist
router.delete('/watchlist/:eventId', verifyUser, async (req, res) => {
  try {
    const { eventId } = req.params;

    const result = await db.query(
      'DELETE FROM event_watchlist WHERE user_id = $1 AND event_id = $2',
      [req.userId, eventId]
    );

    res.json({
      message: 'Event removed from watchlist',
      rows_affected: result.rowCount
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove from watchlist', details: err.message });
  }
});

// ============ RECOMMENDATIONS ENDPOINTS ============

// Get personalized event recommendations
router.get('/recommendations', verifyUser, async (req, res) => {
  try {
    // Get user's booking history to understand preferences
    const userBookings = await db.query(
      `SELECT DISTINCT e.category, e.location
       FROM bookings b
       JOIN events e ON b.event_id = e.id
       WHERE b.user_id = $1 AND b.status = 'confirmed'
       LIMIT 5`,
      [req.userId]
    );

    const categories = userBookings.rows.map(b => b.category).filter(Boolean);
    const locations = userBookings.rows.map(b => b.location).filter(Boolean);

    // Build recommendation query
    let query = `
      SELECT e.*,
             (SELECT AVG(rating) FROM event_reviews WHERE event_id = e.id) as avg_rating,
             (SELECT COUNT(*) FROM event_reviews WHERE event_id = e.id) as review_count,
             (SELECT COUNT(*) FROM bookings WHERE event_id = e.id AND status = 'confirmed') as total_bookings,
             CASE
               WHEN e.category = ANY($1::TEXT[]) THEN 3
               WHEN e.location = ANY($2::TEXT[]) THEN 2
               ELSE 1
             END as relevance_score
      FROM events e
      WHERE e.event_date > NOW()
      AND e.id NOT IN (
        SELECT DISTINCT event_id FROM bookings WHERE user_id = $3
      )
      AND e.id NOT IN (
        SELECT event_id FROM event_watchlist WHERE user_id = $3
      )
      ORDER BY relevance_score DESC, avg_rating DESC, total_bookings DESC
      LIMIT 10
    `;

    const result = await db.query(query, [categories, locations, req.userId]);
    res.json({ recommendations: result.rows, count: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch recommendations', details: err.message });
  }
});

// ============ TRENDING EVENTS ENDPOINTS ============

// Get trending events (most booked in last 30 days)
router.get('/trending', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT e.*,
              COUNT(DISTINCT b.id) as booking_count,
              AVG(er.rating) as avg_rating,
              COUNT(DISTINCT er.id) as review_count,
              (COUNT(DISTINCT b.id) * 0.6 + COALESCE(AVG(er.rating), 0) * 0.4) as popularity_score
       FROM events e
       LEFT JOIN bookings b ON e.id = b.event_id AND b.created_at > NOW() - INTERVAL '30 days' AND b.status = 'confirmed'
       LEFT JOIN event_reviews er ON e.id = er.event_id
       WHERE e.event_date > NOW()
       GROUP BY e.id
       HAVING COUNT(DISTINCT b.id) > 0 OR COUNT(DISTINCT er.id) > 0
       ORDER BY popularity_score DESC
       LIMIT 12`
    );

    res.json({ trending_events: result.rows, count: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trending events', details: err.message });
  }
});

// ============ SMART FILTERS ENDPOINTS ============

// Get events with smart filters
router.get('/search', async (req, res) => {
  try {
    const {
      category,
      location,
      minPrice,
      maxPrice,
      startDate,
      endDate,
      minRating,
      sortBy = 'trending'
    } = req.query;

    let query = `
      SELECT e.*,
             AVG(er.rating) as avg_rating,
             COUNT(DISTINCT er.id) as review_count,
             COUNT(DISTINCT b.id) as total_bookings
      FROM events e
      LEFT JOIN event_reviews er ON e.id = er.event_id
      LEFT JOIN bookings b ON e.id = b.event_id AND b.status = 'confirmed'
      WHERE e.event_date > NOW()
    `;

    const params = [];

    if (category) {
      params.push(category);
      query += ` AND e.category = $${params.length}`;
    }

    if (location) {
      params.push(`%${location}%`);
      query += ` AND e.location ILIKE $${params.length}`;
    }

    if (minPrice) {
      params.push(minPrice);
      query += ` AND e.ticket_price >= $${params.length}`;
    }

    if (maxPrice) {
      params.push(maxPrice);
      query += ` AND e.ticket_price <= $${params.length}`;
    }

    if (startDate) {
      params.push(startDate);
      query += ` AND e.event_date >= $${params.length}`;
    }

    if (endDate) {
      params.push(endDate);
      query += ` AND e.event_date <= $${params.length}`;
    }

    query += ` GROUP BY e.id`;

    if (minRating) {
      params.push(minRating);
      query += ` HAVING AVG(er.rating) >= $${params.length}`;
    }

    // Sorting options
    if (sortBy === 'trending') {
      query += ` ORDER BY COUNT(DISTINCT b.id) DESC, AVG(er.rating) DESC`;
    } else if (sortBy === 'rating') {
      query += ` ORDER BY AVG(er.rating) DESC, COUNT(DISTINCT b.id) DESC`;
    } else if (sortBy === 'price_low') {
      query += ` ORDER BY e.ticket_price ASC`;
    } else if (sortBy === 'price_high') {
      query += ` ORDER BY e.ticket_price DESC`;
    } else if (sortBy === 'date') {
      query += ` ORDER BY e.event_date ASC`;
    }

    query += ` LIMIT 20`;

    const result = await db.query(query, params);
    res.json({ events: result.rows, count: result.rows.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to search events', details: err.message });
  }
});

// ============ EVENT REVIEWS ENDPOINTS ============

// Add review for an event
router.post('/reviews/:eventId', verifyUser, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { rating, review_title, review_text } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Check if user has booked this event
    const booking = await db.query(
      `SELECT id FROM bookings
       WHERE user_id = $1 AND event_id = $2 AND status = 'confirmed'
       LIMIT 1`,
      [req.userId, eventId]
    );

    if (!booking.rows[0]) {
      return res.status(403).json({ error: 'You must have booked this event to leave a review' });
    }

    // Add or update review
    const result = await db.query(
      `INSERT INTO event_reviews (user_id, event_id, booking_id, rating, review_title, review_text)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, event_id) DO UPDATE
       SET rating = $4, review_title = $5, review_text = $6, updated_at = NOW()
       RETURNING *`,
      [req.userId, eventId, booking.rows[0].id, rating, review_title, review_text]
    );

    // Update event analytics
    const avgRating = await db.query(
      `SELECT AVG(rating) as avg, COUNT(*) as count FROM event_reviews WHERE event_id = $1`,
      [eventId]
    );

    await db.query(
      `INSERT INTO event_analytics (event_id, avg_rating, review_count)
       VALUES ($1, $2, $3)
       ON CONFLICT (event_id) DO UPDATE
       SET avg_rating = $2, review_count = $3, last_updated = NOW()`,
      [eventId, avgRating.rows[0].avg, avgRating.rows[0].count]
    );

    res.json({ message: 'Review added successfully', review: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add review', details: err.message });
  }
});

// Get reviews for an event
router.get('/reviews/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;

    const result = await db.query(
      `SELECT er.*, u.name as reviewer_name
       FROM event_reviews er
       JOIN users u ON er.user_id = u.id
       WHERE er.event_id = $1
       ORDER BY er.created_at DESC`,
      [eventId]
    );

    const statsResult = await db.query(
      `SELECT AVG(rating) as avg_rating, COUNT(*) as total_reviews
       FROM event_reviews
       WHERE event_id = $1`,
      [eventId]
    );

    res.json({
      reviews: result.rows,
      stats: statsResult.rows[0],
      count: result.rows.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reviews', details: err.message });
  }
});

// ============ USER PREFERENCES ENDPOINTS ============

// Update user preferences
router.put('/preferences', verifyUser, async (req, res) => {
  try {
    const { interested_categories, interested_locations, price_range_min, price_range_max } = req.body;

    const result = await db.query(
      `INSERT INTO user_preferences (user_id, interested_categories, interested_locations, price_range_min, price_range_max)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE
       SET interested_categories = $2, interested_locations = $3, price_range_min = $4, price_range_max = $5, updated_at = NOW()
       RETURNING *`,
      [req.userId, interested_categories, interested_locations, price_range_min, price_range_max]
    );

    res.json({ message: 'Preferences updated', preferences: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update preferences', details: err.message });
  }
});

// Get user preferences
router.get('/preferences', verifyUser, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [req.userId]
    );

    res.json({ preferences: result.rows[0] || {} });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch preferences', details: err.message });
  }
});

module.exports = router;
