const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const pool = require('../db');
const authController = require('../controllers/authController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// Avatar uploads — same /uploads dir used by event images.
const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, 'uploads/'); },
  filename: function (req, file, cb) {
    cb(null, 'avatar-' + Date.now() + path.extname(file.originalname));
  }
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

// Authentication Routes
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/send-otp', authController.sendOTP);

// Profile Routes
router.get('/profile', authenticateToken, authController.getProfile);
router.put('/update-profile', authenticateToken, authController.updateProfile);
router.post('/upload-avatar', authenticateToken, avatarUpload.single('avatar'), authController.uploadAvatar);

// Forgot-password (mobile-first lookup, OTP delivered via email).
router.post('/forgot-password/request', authController.forgotPasswordRequest);
router.post('/forgot-password/reset',   authController.forgotPasswordReset);

// ──────────────────────────────────────────────────────────────────
// List all registered users (organizer only)
//
// GET /api/auth/users
//   ?role=organizer|explorer   (filter, optional)
//   ?search=<text>             (matches name / email / mobile, optional)
//   ?limit=<n>                 (page size, default 50, max 200)
//   ?offset=<n>                (pagination offset, default 0)
//
// Restricted to organizer role. Never returns password_hash.
// Returns total count in the payload so the frontend can paginate.
// ──────────────────────────────────────────────────────────────────
router.get('/users',
  authenticateToken,
  authorizeRoles('organizer'),
  async (req, res) => {
    try {
      const role   = (req.query.role || '').trim();
      const search = (req.query.search || '').trim();
      let limit    = parseInt(req.query.limit, 10);
      let offset   = parseInt(req.query.offset, 10);
      if (!Number.isFinite(limit)  || limit  <= 0) limit  = 50;
      if (limit > 200) limit = 200;
      if (!Number.isFinite(offset) || offset < 0)  offset = 0;

      const where  = [];
      const params = [];
      if (role && ['organizer', 'explorer'].includes(role)) {
        params.push(role);
        where.push(`role = $${params.length}`);
      }
      if (search) {
        params.push('%' + search.toLowerCase() + '%');
        where.push(`(LOWER(name) LIKE $${params.length}
                  OR LOWER(email) LIKE $${params.length}
                  OR mobile LIKE $${params.length})`);
      }
      const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

      // Total count for pagination meta — uses the same filter.
      const cnt = await pool.query(
        `SELECT COUNT(*)::int AS total FROM users ${whereSql}`,
        params
      );

      // Page query — push limit + offset on the end.
      const queryParams = [...params, limit, offset];
      const result = await pool.query(
        `SELECT id, name, email, mobile, role,
                profile_image, address,
                organization_name, organization_phone, organization_website,
                last_seen, created_at
           FROM users
           ${whereSql}
       ORDER BY created_at DESC
          LIMIT $${queryParams.length - 1}
         OFFSET $${queryParams.length}`,
        queryParams
      );

      res.json({
        total:  cnt.rows[0].total,
        limit,
        offset,
        count:  result.rows.length,
        users:  result.rows
      });
    } catch (err) {
      console.error('List users error:', err);
      res.status(500).json({ error: 'Failed to list users' });
    }
  }
);

// ──────────────────────────────────────────────────────────────────
// DELETE /api/auth/users/:id
//
// Deletes a user by id. Restricted to organizer role.
// All dependent rows (bookings, events, messages, check_ins) are
// removed automatically by the existing ON DELETE CASCADE constraints.
//
// Safety:
//  • Prevents an organizer from deleting their own account here
//    (they should use a self-deletion flow if you build one — this is
//    the admin-style endpoint for managing OTHER users).
// ──────────────────────────────────────────────────────────────────
router.delete('/users/:id',
  authenticateToken,
  authorizeRoles('organizer'),
  async (req, res) => {
    const callerId = req.user.userId || req.user.id;
    const targetId = parseInt(req.params.id, 10);

    if (!Number.isFinite(targetId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }
    if (targetId === callerId) {
      return res.status(400).json({ error: "You can't delete your own account from this endpoint." });
    }

    try {
      const result = await pool.query(
        'DELETE FROM users WHERE id = $1 RETURNING id, name, email, role',
        [targetId]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({
        success: true,
        deleted: result.rows[0],
        message: `User ${result.rows[0].email} deleted along with their bookings, events, and messages.`
      });
    } catch (err) {
      console.error('Delete user error:', err);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }
);

// ──────────────────────────────────────────────────────────────────
// GET /api/auth/organizer/:id  — PUBLIC organizer profile
//
// Returns the safe-to-display fields plus a small stats summary so the
// dedicated organizer page can render hero, contact info and an at-a-glance
// "X events conducted, Y tickets sold" row in a single round-trip.
// 404s if the user doesn't exist or isn't an organizer.
// ──────────────────────────────────────────────────────────────────
router.get('/organizer/:id', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'Invalid organizer id' });
  }
  try {
    const profile = await pool.query(
      `SELECT id, name, role,
              organization_name, organization_address, organization_phone,
              organization_website, organization_description,
              profile_image, address, created_at
         FROM users
        WHERE id = $1 AND role = 'organizer'`,
      [id]
    );
    if (profile.rows.length === 0) {
      return res.status(404).json({ error: 'Organizer not found' });
    }

    // Aggregate stats — events count, success rate of bookings (% that
    // weren't cancelled), and the rolling review averages. tickets_sold is
    // still computed because some callers might want it; we just don't
    // surface it on the page anymore.
    const stats = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM events WHERE organizer_id = $1)                       AS events_count,
         (SELECT COALESCE(SUM(b.number_of_seats),0)::int
            FROM bookings b
            JOIN events  e ON e.id = b.event_id
           WHERE e.organizer_id = $1
             AND COALESCE(b.status, 'confirmed') <> 'cancelled')                          AS tickets_sold,
         (SELECT
            CASE WHEN COUNT(*) > 0
              THEN ROUND(
                COUNT(*) FILTER (WHERE COALESCE(b.status,'confirmed') = 'confirmed')::numeric
                  / COUNT(*) * 100, 1)
              ELSE NULL
            END
            FROM bookings b
            JOIN events  e ON e.id = b.event_id
           WHERE e.organizer_id = $1)                                                     AS success_rate,
         (SELECT COALESCE(ROUND(AVG(rating)::numeric, 1), 0)
            FROM organizer_reviews WHERE organizer_id = $1)                               AS avg_rating,
         (SELECT COUNT(*)::int
            FROM organizer_reviews WHERE organizer_id = $1)                               AS reviews_count`,
      [id]
    );

    res.status(200).json({
      organizer: profile.rows[0],
      stats:     stats.rows[0]
    });
  } catch (err) {
    console.error('Public organizer lookup error:', err);
    res.status(500).json({ error: 'Failed to load organizer' });
  }
});

// ──────────────────────────────────────────────────────────────────
// GET /api/auth/organizer/:id/reviews  — PUBLIC
// Lists all reviews left for this organizer, newest first, with the
// reviewer's display name + avatar joined in.
// ──────────────────────────────────────────────────────────────────
router.get('/organizer/:id/reviews', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'Invalid organizer id' });
  }
  try {
    const result = await pool.query(
      `SELECT r.id, r.rating, r.comment, r.created_at,
              u.id   AS user_id,
              u.name AS user_name,
              u.profile_image AS user_profile_image
         FROM organizer_reviews r
         JOIN users u ON u.id = r.user_id
        WHERE r.organizer_id = $1
        ORDER BY r.created_at DESC
        LIMIT 100`,
      [id]
    );
    res.status(200).json({ reviews: result.rows });
  } catch (err) {
    console.error('List reviews error:', err);
    res.status(500).json({ error: 'Failed to load reviews' });
  }
});

// ──────────────────────────────────────────────────────────────────
// POST /api/auth/organizer/:id/reviews  — AUTH
// Body: { rating: 1..5, comment?: string }
// Each user may submit up to MAX_REVIEWS_PER_USER reviews per organizer.
// Self-review is forbidden.
// ──────────────────────────────────────────────────────────────────
const MAX_REVIEWS_PER_USER = 2;

router.post('/organizer/:id/reviews', authenticateToken, async (req, res) => {
  const organizerId = parseInt(req.params.id, 10);
  const userId      = req.user.userId || req.user.id;
  if (!Number.isFinite(organizerId)) {
    return res.status(400).json({ error: 'Invalid organizer id' });
  }
  if (organizerId === userId) {
    return res.status(400).json({ error: "You can't review yourself." });
  }

  const rating = parseInt(req.body?.rating, 10);
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be a whole number from 1 to 5.' });
  }
  const comment = req.body?.comment ? String(req.body.comment).trim().slice(0, 1000) : null;

  try {
    // Verify the target is actually an organizer.
    const orgCheck = await pool.query(
      "SELECT id FROM users WHERE id = $1 AND role = 'organizer'",
      [organizerId]
    );
    if (orgCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Organizer not found' });
    }

    // Enforce per-user cap.
    const countRes = await pool.query(
      `SELECT COUNT(*)::int AS n FROM organizer_reviews
        WHERE organizer_id = $1 AND user_id = $2`,
      [organizerId, userId]
    );
    if ((countRes.rows[0]?.n ?? 0) >= MAX_REVIEWS_PER_USER) {
      return res.status(409).json({
        error: `You've already posted ${MAX_REVIEWS_PER_USER} reviews for this organizer.`
      });
    }

    const result = await pool.query(
      `INSERT INTO organizer_reviews (organizer_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       RETURNING id, rating, comment, created_at`,
      [organizerId, userId, rating, comment]
    );
    res.status(201).json({ review: result.rows[0] });
  } catch (err) {
    console.error('Create review error:', err);
    res.status(500).json({ error: 'Failed to save review' });
  }
});

module.exports = router;