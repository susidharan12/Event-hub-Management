const pool = require('../db');

const createBooking = async (req, res) => {
  const { event_id, seats_booked } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO bookings (user_id, event_id, seats_booked) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, event_id, seats_booked]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getUserBookings = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bookings WHERE user_id = $1', [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getBookingById = async (req, res) => { res.json({ message: "Detail logic" }); };
const cancelBooking = async (req, res) => { res.json({ message: "Cancel logic" }); };
const checkIn = async (req, res) => { res.json({ message: "Checkin logic" }); };
const getCheckIns = async (req, res) => { res.json({ message: "Checkins list logic" }); };

module.exports = { createBooking, getUserBookings, getBookingById, cancelBooking, checkIn, getCheckIns };