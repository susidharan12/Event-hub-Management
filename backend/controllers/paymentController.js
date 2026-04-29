const pool = require('../db');

const recordPayment = async (req, res) => {
  const { booking_id, amount, payment_method, transaction_id } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO payments (booking_id, amount, payment_method, transaction_id, payment_status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [booking_id, amount, payment_method, transaction_id, 'completed']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getPaymentHistory = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM payments ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const setOrganizerDetails = async (req, res) => { res.json({ success: true }); };
const getOrganizerDetails = async (req, res) => { res.json({ bank: "XXXX" }); };

module.exports = { recordPayment, getPaymentHistory, setOrganizerDetails, getOrganizerDetails };
