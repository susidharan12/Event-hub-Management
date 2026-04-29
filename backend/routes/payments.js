const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// RECORD PAYMENT
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { booking_id, payment_method, transaction_id } = req.body;

    const bookingResult = await pool.query(
      'SELECT total_price FROM bookings WHERE id = $1 AND user_id = $2',
      [booking_id, req.user.id]
    );

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const result = await pool.query(
      `INSERT INTO payments (booking_id, amount, payment_method, transaction_id, payment_status) 
       VALUES ($1, $2, $3, $4, 'completed') 
       RETURNING *`,
      [booking_id, bookingResult.rows[0].total_price, payment_method, transaction_id]
    );

    res.status(201).json({ message: 'Payment recorded', payment: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Payment failed' });
  }
});

// GET PAYMENT HISTORY
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, e.title as event_title 
       FROM payments p 
       JOIN bookings b ON p.booking_id = b.id 
       JOIN events e ON b.event_id = e.id 
       WHERE b.user_id = $1`,
      [req.user.id]
    );
    res.json({ payments: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

module.exports = router;