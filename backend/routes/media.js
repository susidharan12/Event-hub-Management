const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');

const router = express.Router();

// Determine correct uploads directory path
// In Docker: /app/uploads (volume mount)
// In local dev: backend/uploads (relative to project root)
const uploadsDir = process.env.NODE_ENV === 'production'
  ? '/app/uploads'
  : path.join(__dirname, '../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Files land in the same /uploads volume the rest of the app uses.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, 'media-' + Date.now() + path.extname(file.originalname))
});
// Accept images + (small) videos; cap video size to keep the volume sane.
const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB hard cap (images are tiny; short clips only)
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype) || /^video\//.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only image or video files are allowed'));
  }
});

// Normalise a pasted video URL → an embeddable URL (YouTube / Vimeo).
function toEmbedUrl(raw) {
  const url = String(raw || '').trim();
  if (!url) return null;
  let m = url.match(/(?:youtube\.com\/.*[?&]v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;
  // Unknown provider — keep the raw URL (frontend will show a link/thumbnail).
  return url;
}

async function ownsEvent(eventId, userId) {
  const r = await pool.query('SELECT organizer_id FROM events WHERE id = $1', [eventId]);
  if (!r.rows.length) return { found: false };
  return { found: true, owns: Number(r.rows[0].organizer_id) === Number(userId) };
}

// ── ADD media to an event (organizer). Image/video file OR embed link. ──
router.post('/', authenticateToken, upload.single('media'), async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const { event_id, caption, video_url, featured } = req.body;

    // event_id is OPTIONAL — media can be organizer-level (no specific event).
    // If one is given, the organizer must own that event.
    let eventId = event_id || null;
    if (eventId) {
      const own = await ownsEvent(eventId, userId);
      if (!own.found) return res.status(404).json({ error: 'Event not found' });
      if (!own.owns) return res.status(403).json({ error: 'You can only add media to your own events' });
    }

    let type, source, url;
    if (req.file) {
      source = 'upload';
      type = /^video\//.test(req.file.mimetype) ? 'video' : 'image';
      url = `/uploads/${req.file.filename}`;
    } else if (video_url && String(video_url).trim()) {
      source = 'embed';
      type = 'video';
      url = toEmbedUrl(video_url);
    } else {
      return res.status(400).json({ error: 'Provide an image/video file or a video link' });
    }

    const ins = await pool.query(
      `INSERT INTO event_media (event_id, organizer_id, type, source, url, caption, featured)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [eventId, userId, type, source, url, (caption || '').slice(0, 300) || null,
       featured === 'true' || featured === true]
    );
    res.status(201).json({ message: 'Media added', media: ins.rows[0] });
  } catch (err) {
    if (err && err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'File too large (max 30 MB). Use a short clip or a video link.' });
    console.error('Add media error:', err);
    res.status(500).json({ error: err.message || 'Failed to add media' });
  }
});

// ── LIST media (public). Filters: ?event_id= , ?organizer_id= , ?type= ──
router.get('/', async (req, res) => {
  try {
    const { event_id, organizer_id, type } = req.query;
    const where = [];
    const vals = [];
    if (event_id)     { vals.push(event_id);     where.push(`m.event_id = $${vals.length}`); }
    if (organizer_id) { vals.push(organizer_id); where.push(`m.organizer_id = $${vals.length}`); }
    if (type)         { vals.push(type);         where.push(`m.type = $${vals.length}`); }
    const r = await pool.query(
      `SELECT m.*, e.title AS event_title, e.category AS event_category,
              e.event_date AS event_date, u.name AS organizer_name
         FROM event_media m
         LEFT JOIN events e ON e.id = m.event_id
         LEFT JOIN users  u ON u.id = m.organizer_id
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY m.featured DESC, m.sort_order ASC, m.created_at DESC
        LIMIT 500`,
      vals
    );
    res.json({ media: r.rows });
  } catch (err) {
    console.error('List media error:', err);
    res.status(500).json({ error: 'Failed to load media' });
  }
});

// ── DELETE a media item (organizer who owns the event) ──────────────
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.id;
    const r = await pool.query(
      `SELECT m.id FROM event_media m
         JOIN events e ON e.id = m.event_id
        WHERE m.id = $1 AND e.organizer_id = $2`,
      [req.params.id, userId]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Media not found or not yours' });
    await pool.query('DELETE FROM event_media WHERE id = $1', [req.params.id]);
    res.json({ message: 'Media deleted' });
  } catch (err) {
    console.error('Delete media error:', err);
    res.status(500).json({ error: 'Failed to delete media' });
  }
});

module.exports = router;
