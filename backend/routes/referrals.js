const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

const REFERRAL_PERCENT = 10;   // friend gets 10% off
const REFERRAL_CAP     = 200;  // …capped at ₹200

// GET /api/referrals/me — returns the user's referral code + stats, creating
// the code (and its backing referral promo) lazily on first call.
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;

    const u = await pool.query('SELECT referral_code FROM users WHERE id = $1', [userId]);
    if (!u.rows.length) return res.status(404).json({ error: 'User not found' });

    let code = u.rows[0].referral_code;
    if (!code) {
      code = 'REF' + Number(userId).toString(36).toUpperCase().padStart(4, '0');
      await pool.query('UPDATE users SET referral_code = $1 WHERE id = $2', [code, userId]);
    }

    // Ensure a referral promo backs the code (so it works at checkout).
    const ex = await pool.query('SELECT id FROM promo_codes WHERE UPPER(code) = $1', [code.toUpperCase()]);
    if (!ex.rows.length) {
      await pool.query(
        `INSERT INTO promo_codes
           (code, kind, owner_id, discount_type, discount_value, max_discount, per_user_limit, active)
         VALUES ($1,'referral',$2,'percent',$3,$4,1,true)`,
        [code, userId, REFERRAL_PERCENT, REFERRAL_CAP]
      );
    }

    const stats = await pool.query(
      `SELECT COUNT(pr.id)::int AS uses, COALESCE(SUM(pr.amount),0)::numeric(10,2) AS friends_saved
         FROM promo_codes p
         LEFT JOIN promo_redemptions pr ON pr.promo_id = p.id
        WHERE p.owner_id = $1 AND p.kind = 'referral'`,
      [userId]
    );
    const signups = await pool.query('SELECT COUNT(*)::int AS c FROM users WHERE referred_by = $1', [userId]);

    res.json({
      code,
      discount_percent: REFERRAL_PERCENT,
      uses: stats.rows[0].uses || 0,
      friends_saved: Number(stats.rows[0].friends_saved) || 0,
      signups: signups.rows[0].c || 0
    });
  } catch (err) {
    console.error('Referral me error:', err);
    res.status(500).json({ error: 'Failed to load referral info' });
  }
});

module.exports = router;
