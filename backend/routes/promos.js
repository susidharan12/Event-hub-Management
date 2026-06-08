const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

/**
 * Validate a code for a given event/user/subtotal and compute the discount.
 * Reusable by the booking route (pass a txn client as `db`). Returns
 * { ok, promo, discount, reason }. Does NOT mutate anything.
 */
async function evaluatePromo(db, { codeRaw, eventId, userId, subtotal }) {
  const code = String(codeRaw || '').trim().toUpperCase();
  if (!code) return { ok: false, reason: 'Enter a code' };
  const sub = Number(subtotal) || 0;

  const r = await db.query('SELECT * FROM promo_codes WHERE UPPER(code) = $1', [code]);
  if (!r.rows.length) return { ok: false, reason: 'Invalid code' };
  const p = r.rows[0];

  if (!p.active) return { ok: false, reason: 'This code is no longer active' };
  if (p.expires_at && new Date(p.expires_at) < new Date()) return { ok: false, reason: 'This code has expired' };
  if (p.event_id && Number(p.event_id) !== Number(eventId)) return { ok: false, reason: 'Not valid for this event' };
  if (p.max_uses != null && p.used_count >= p.max_uses) return { ok: false, reason: 'This code is fully redeemed' };
  if (sub < Number(p.min_amount || 0)) return { ok: false, reason: `Minimum order is ₹${p.min_amount}` };
  if (p.kind === 'referral' && userId && Number(p.owner_id) === Number(userId)) {
    return { ok: false, reason: "You can't use your own referral code" };
  }
  if (p.per_user_limit != null && userId) {
    const u = await db.query(
      'SELECT count(*)::int AS c FROM promo_redemptions WHERE promo_id = $1 AND user_id = $2',
      [p.id, userId]
    );
    if (u.rows[0].c >= p.per_user_limit) return { ok: false, reason: "You've already used this code" };
  }

  let discount = p.discount_type === 'percent'
    ? sub * (Number(p.discount_value) / 100)
    : Number(p.discount_value);
  if (p.discount_type === 'percent' && p.max_discount) discount = Math.min(discount, Number(p.max_discount));
  discount = round2(Math.min(discount, sub)); // never exceed the subtotal
  if (discount <= 0) return { ok: false, reason: 'This code gives no discount on your order' };

  return { ok: true, promo: p, discount, reason: null };
}

/** Record a redemption inside the booking txn + bump the usage counter. */
async function recordRedemption(db, promoId, userId, bookingId, amount) {
  await db.query(
    'INSERT INTO promo_redemptions (promo_id, user_id, booking_id, amount) VALUES ($1,$2,$3,$4)',
    [promoId, userId || null, bookingId || null, round2(amount)]
  );
  await db.query('UPDATE promo_codes SET used_count = used_count + 1 WHERE id = $1', [promoId]);
}

// ── CREATE a promo code (organizer) ─────────────────────────────────
router.post('/', authenticateToken, async (req, res) => {
  try {
    const ownerId = req.user.userId || req.user.id;
    let { code, event_id, discount_type, discount_value, max_discount, min_amount, max_uses, per_user_limit, expires_at } = req.body;

    code = String(code || '').trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,40}$/.test(code)) {
      return res.status(400).json({ error: 'Code must be 3–40 chars (letters, numbers, - or _).' });
    }
    discount_type = (discount_type === 'flat') ? 'flat' : 'percent';
    const value = Number(discount_value) || 0;
    if (value <= 0) return res.status(400).json({ error: 'Discount value must be greater than 0.' });
    if (discount_type === 'percent' && value > 100) return res.status(400).json({ error: 'Percentage cannot exceed 100.' });

    // If event_id given, ensure the organizer owns that event.
    if (event_id) {
      const ev = await pool.query('SELECT organizer_id FROM events WHERE id = $1', [event_id]);
      if (!ev.rows.length) return res.status(404).json({ error: 'Event not found' });
      if (Number(ev.rows[0].organizer_id) !== Number(ownerId)) {
        return res.status(403).json({ error: 'You can only add codes to your own events.' });
      }
    }

    const ins = await pool.query(
      `INSERT INTO promo_codes
         (code, kind, owner_id, event_id, discount_type, discount_value, max_discount, min_amount, max_uses, per_user_limit, expires_at)
       VALUES ($1,'promo',$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [code, ownerId, event_id || null, discount_type, value,
       max_discount ? Number(max_discount) : null, Number(min_amount) || 0,
       max_uses ? parseInt(max_uses, 10) : null,
       per_user_limit != null && per_user_limit !== '' ? parseInt(per_user_limit, 10) : 1,
       expires_at || null]
    );
    res.status(201).json({ message: 'Promo code created', promo: ins.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That code already exists. Pick another.' });
    console.error('Create promo error:', err);
    res.status(500).json({ error: 'Failed to create promo code' });
  }
});

// ── LIST the organizer's own promo codes (+ usage) ──────────────────
router.get('/', authenticateToken, async (req, res) => {
  try {
    const ownerId = req.user.userId || req.user.id;
    const r = await pool.query(
      `SELECT p.*, e.title AS event_title,
              COALESCE(SUM(pr.amount),0)::numeric(10,2) AS total_discounted
         FROM promo_codes p
         LEFT JOIN events e ON e.id = p.event_id
         LEFT JOIN promo_redemptions pr ON pr.promo_id = p.id
        WHERE p.owner_id = $1
        GROUP BY p.id, e.title
        ORDER BY p.created_at DESC`,
      [ownerId]
    );
    res.json({ promos: r.rows });
  } catch (err) {
    console.error('List promos error:', err);
    res.status(500).json({ error: 'Failed to list promo codes' });
  }
});

// ── VALIDATE a code at checkout (no mutation) ───────────────────────
router.post('/validate', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { code, event_id, subtotal } = req.body;
    const out = await evaluatePromo(pool, { codeRaw: code, eventId: event_id, userId, subtotal });
    if (!out.ok) return res.status(200).json({ valid: false, reason: out.reason });
    res.json({
      valid: true,
      code: out.promo.code,
      kind: out.promo.kind,
      discount_type: out.promo.discount_type,
      discount_value: Number(out.promo.discount_value),
      max_discount: out.promo.max_discount != null ? Number(out.promo.max_discount) : null,
      discount: out.discount
    });
  } catch (err) {
    console.error('Validate promo error:', err);
    res.status(500).json({ error: 'Failed to validate code' });
  }
});

// ── DELETE a promo code (organizer who owns it) ─────────────────────
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const ownerId = req.user.userId || req.user.id;
    const r = await pool.query('SELECT id, kind FROM promo_codes WHERE id = $1 AND owner_id = $2', [req.params.id, ownerId]);
    if (!r.rows.length) return res.status(404).json({ error: 'Code not found or not yours' });
    if (r.rows[0].kind === 'referral') return res.status(400).json({ error: 'Referral codes are managed automatically and can’t be deleted.' });
    await pool.query('DELETE FROM promo_codes WHERE id = $1', [req.params.id]); // redemptions cascade
    res.json({ message: 'Promo code deleted' });
  } catch (err) {
    console.error('Delete promo error:', err);
    res.status(500).json({ error: 'Failed to delete promo code' });
  }
});

module.exports = router;
module.exports.evaluatePromo = evaluatePromo;
module.exports.recordRedemption = recordRedemption;
