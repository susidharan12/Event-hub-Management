/**
 * OTP routes
 * ----------
 *  POST /api/otp/send      → generate and email a 6-digit code
 *  POST /api/otp/verify    → consume the code, return a short-lived
 *                            verification_token the caller can present to
 *                            signup / update-profile / password-reset.
 *
 *  When SMTP isn't configured the OTP is also returned in the response
 *  (alongside `devMode:true`) so the flow is fully testable in dev.
 */
const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();
const pool    = require('../db');
const { sendOTPEmail, SMTP_READY } = require('../services/emailService');

const VALID_PURPOSES = new Set(['signup', 'update-email', 'update-mobile', 'password-reset']);
const OTP_TTL_MIN    = 10;      // minutes
const TOKEN_TTL_MIN  = 15;      // verification token good for 15 min after verify
const MAX_ATTEMPTS   = 5;

function genOtp() {
  return String(crypto.randomInt(100000, 1000000));   // 6-digit
}

/**
 * For email-type targets we send to the target address directly.
 * For mobile-type targets there's no SMS gateway in this project — so we
 * look up the user's registered email by mobile and send there. The
 * frontend tells the attendee where the OTP went via the response.
 */
async function resolveDeliveryEmail(target, target_type) {
  if (target_type === 'email') return target;
  // mobile → look up the registered user's email
  const r = await pool.query('SELECT email FROM users WHERE mobile = $1', [target]);
  if (r.rows.length === 0) return null;
  return r.rows[0].email || null;
}

function maskEmail(e) {
  if (!e || !e.includes('@')) return e || '';
  const [u, d] = e.split('@');
  const masked = u.length <= 2 ? u[0] + '*' : u[0] + '***' + u[u.length - 1];
  return masked + '@' + d;
}

// ──────────────────────────────────────────────────────────────────
// POST /api/otp/send
// body: { target, target_type, purpose, name? }
// ──────────────────────────────────────────────────────────────────
router.post('/send', async (req, res) => {
  try {
    const { target, target_type, purpose, name } = req.body || {};
    if (!target || !target_type || !purpose) {
      return res.status(400).json({ error: 'target, target_type and purpose are required' });
    }
    if (!['email', 'mobile'].includes(target_type)) {
      return res.status(400).json({ error: 'target_type must be "email" or "mobile"' });
    }
    if (!VALID_PURPOSES.has(purpose)) {
      return res.status(400).json({ error: 'invalid purpose' });
    }

    const deliveryEmail = await resolveDeliveryEmail(String(target).trim(), target_type);
    if (!deliveryEmail) {
      return res.status(404).json({
        error: target_type === 'mobile'
          ? 'No account found for this mobile number.'
          : 'No email address available to send the OTP.'
      });
    }

    const code = genOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60_000);
    // Drop any older, unconsumed OTPs for the same target+purpose so the
    // newest one is the only one in play.
    await pool.query(
      `DELETE FROM otps WHERE target = $1 AND purpose = $2 AND verified = FALSE`,
      [target, purpose]
    );
    await pool.query(
      `INSERT INTO otps (target, target_type, code, purpose, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [String(target).trim(), target_type, code, purpose, expiresAt]
    );

    const result = await sendOTPEmail(deliveryEmail, code, name || 'there', purpose);

    return res.json({
      success: true,
      delivered_to: maskEmail(deliveryEmail),
      via: 'email',                 // we always deliver via email today
      target_type,
      expires_in_min: OTP_TTL_MIN,
      // In dev mode (no SMTP creds, or SMTP failure) we surface the OTP
      // in the response so the user can paste it from the API/console.
      devMode: !!result.devMode,
      ...(result.devMode ? { otp: code } : {})
    });
  } catch (err) {
    console.error('OTP send error:', err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// ──────────────────────────────────────────────────────────────────
// POST /api/otp/verify
// body: { target, code, purpose }
// → returns { verification_token } usable for ~15 minutes
// ──────────────────────────────────────────────────────────────────
router.post('/verify', async (req, res) => {
  try {
    const { target, code, purpose } = req.body || {};
    if (!target || !code || !purpose) {
      return res.status(400).json({ error: 'target, code and purpose are required' });
    }
    const r = await pool.query(
      `SELECT * FROM otps
        WHERE target = $1 AND purpose = $2 AND verified = FALSE
        ORDER BY id DESC LIMIT 1`,
      [String(target).trim(), purpose]
    );
    if (r.rows.length === 0) {
      return res.status(400).json({ error: 'No active OTP. Please request a new one.' });
    }
    const row = r.rows[0];
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      return res.status(429).json({ error: 'Too many attempts. Please request a new OTP.' });
    }
    if (String(row.code).trim() !== String(code).trim()) {
      await pool.query('UPDATE otps SET attempts = attempts + 1 WHERE id = $1', [row.id]);
      const left = MAX_ATTEMPTS - (row.attempts + 1);
      return res.status(400).json({ error: `Incorrect code. ${left} attempt(s) left.` });
    }

    const token = crypto.randomBytes(24).toString('hex');
    const tokenExpiresAt = new Date(Date.now() + TOKEN_TTL_MIN * 60_000);
    await pool.query(
      `UPDATE otps
          SET verified = TRUE,
              verification_token = $1,
              token_expires_at = $2
        WHERE id = $3`,
      [token, tokenExpiresAt, row.id]
    );

    res.json({
      success: true,
      verification_token: token,
      target,
      purpose,
      target_type: row.target_type,
      expires_at: tokenExpiresAt
    });
  } catch (err) {
    console.error('OTP verify error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

/**
 * Helper used by other routes (signup / update-profile / password-reset) to
 * confirm an incoming verification_token matches the expected target+purpose
 * and consume it (single-use). Returns true on success, false otherwise.
 */
async function consumeVerifiedToken(client, { token, target, purpose }) {
  if (!token || !target || !purpose) return false;
  const r = await client.query(
    `SELECT id, token_expires_at, verified
       FROM otps
      WHERE verification_token = $1
        AND target = $2
        AND purpose = $3
        AND verified = TRUE
      LIMIT 1`,
    [token, String(target).trim(), purpose]
  );
  if (r.rows.length === 0) return false;
  if (new Date(r.rows[0].token_expires_at).getTime() < Date.now()) return false;
  // Single-use: invalidate the token after use.
  await client.query('DELETE FROM otps WHERE id = $1', [r.rows[0].id]);
  return true;
}

module.exports = { router, consumeVerifiedToken };
