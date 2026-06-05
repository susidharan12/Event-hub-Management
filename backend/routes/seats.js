/* ──────────────────────────────────────────────────────────────────
   routes/seats.js — REST API for the live seat map.
   Mounted at /api/events, so:
     GET  /api/events/:id/seats           → seat map (public)
     POST /api/events/:id/seats/hold      → hold seats 5 min (auth)
     POST /api/events/:id/seats/release   → release your holds (auth)
   Booking (marking seats 'booked') happens in routes/bookings.js.
   ────────────────────────────────────────────────────────────────── */
const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const seats = require('../services/seats');

const router = express.Router();

// Public — anyone viewing the event can see live availability.
router.get('/:id/seats', async (req, res) => {
  try {
    const map = await seats.getSeatMap(req.params.id);
    if (!map) return res.status(404).json({ error: 'Event not found' });
    res.json(map);
  } catch (err) {
    console.error('[seats] getSeatMap error:', err.message);
    res.status(500).json({ error: 'Failed to load seat map' });
  }
});

// Hold seats for the authenticated user (5-minute timer).
router.post('/:id/seats/hold', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const labels = req.body && req.body.seat_labels;
    const result = await seats.holdSeats(req.params.id, userId, labels);
    if (!result.ok) return res.status(409).json(result);
    res.json(result);
  } catch (err) {
    console.error('[seats] hold error:', err.message);
    res.status(500).json({ error: 'Failed to hold seats' });
  }
});

// Release the authenticated user's holds (e.g. when they deselect or leave).
router.post('/:id/seats/release', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const labels = req.body && req.body.seat_labels;
    const result = await seats.releaseSeats(req.params.id, userId, labels);
    res.json(result);
  } catch (err) {
    console.error('[seats] release error:', err.message);
    res.status(500).json({ error: 'Failed to release seats' });
  }
});

module.exports = router;
