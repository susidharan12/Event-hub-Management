const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/authMiddleware');

/**
 * Chat model
 * ----------
 * A "thread" is a conversation between two users (attendee ↔ organizer)
 * scoped to a single event. The same two users can have multiple threads
 * if they're chatting about different events.
 *
 * Authorization rules:
 *  • The event's organizer can message anyone who has booked their event.
 *  • An attendee (or anyone authenticated) can message the event's organizer.
 *  • No one can message themselves.
 */

// ──────────────────────────────────────────────────────────────────
// GET /api/messages/threads
// List all conversations the current user is part of.
// Returns one row per (event_id, other_user_id) with the latest message
// preview and unread count.
// ──────────────────────────────────────────────────────────────────
router.get('/threads', authenticateToken, async (req, res) => {
  const userId = req.user.userId || req.user.id;
  try {
    const result = await pool.query(`
      SELECT t.event_id,
             t.other_id,
             e.title         AS event_title,
             e.image_url     AS event_image_url,
             e.event_date    AS event_date,
             e.organizer_id  AS event_organizer_id,
             u.name          AS other_name,
             u.profile_image AS other_avatar,
             u.role          AS other_role,
             u.last_seen     AS other_last_seen,
             lm.body         AS last_body,
             lm.created_at   AS last_at,
             lm.sender_id    AS last_sender_id,
             COALESCE(unread.cnt, 0) AS unread
        FROM (
          SELECT DISTINCT
                 event_id,
                 CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END AS other_id
            FROM messages
           WHERE sender_id = $1 OR recipient_id = $1
        ) t
        JOIN events e ON e.id = t.event_id
        JOIN users  u ON u.id = t.other_id
        LEFT JOIN LATERAL (
          SELECT body, created_at, sender_id
            FROM messages m
           WHERE m.event_id = t.event_id
             AND ((m.sender_id = $1 AND m.recipient_id = t.other_id)
               OR (m.sender_id = t.other_id AND m.recipient_id = $1))
           ORDER BY m.created_at DESC
           LIMIT 1
        ) lm ON TRUE
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS cnt
            FROM messages m
           WHERE m.event_id    = t.event_id
             AND m.sender_id    = t.other_id
             AND m.recipient_id = $1
             AND m.read_at IS NULL
        ) unread ON TRUE
       ORDER BY lm.created_at DESC NULLS LAST
    `, [userId]);

    res.json({ threads: result.rows });
  } catch (err) {
    console.error('Threads error:', err);
    res.status(500).json({ error: 'Failed to load threads' });
  }
});

// ──────────────────────────────────────────────────────────────────
// GET /api/messages/thread/:eventId/:otherId
// Fetch all messages between current user and otherId for the given event.
// Marks inbound messages as read.
// ──────────────────────────────────────────────────────────────────
router.get('/thread/:eventId/:otherId', authenticateToken, async (req, res) => {
  const userId  = req.user.userId || req.user.id;
  const eventId = parseInt(req.params.eventId, 10);
  const otherId = parseInt(req.params.otherId, 10);
  if (!eventId || !otherId) return res.status(400).json({ error: 'Invalid params' });
  if (otherId === userId)    return res.status(400).json({ error: 'Cannot chat with yourself' });

  try {
    const messages = await pool.query(`
      SELECT id, event_id, sender_id, recipient_id, body, created_at, read_at
        FROM messages
       WHERE event_id = $1
         AND ((sender_id = $2 AND recipient_id = $3)
           OR (sender_id = $3 AND recipient_id = $2))
       ORDER BY created_at ASC
    `, [eventId, userId, otherId]);

    // Mark inbound messages as read
    await pool.query(`
      UPDATE messages
         SET read_at = NOW()
       WHERE event_id     = $1
         AND sender_id    = $2
         AND recipient_id = $3
         AND read_at IS NULL
    `, [eventId, otherId, userId]);

    const otherRes = await pool.query(
      'SELECT id, name, profile_image, role, organization_name, last_seen FROM users WHERE id = $1',
      [otherId]
    );
    const eventRes = await pool.query(
      'SELECT id, title, image_url, event_date, organizer_id FROM events WHERE id = $1',
      [eventId]
    );

    res.json({
      messages: messages.rows,
      other:    otherRes.rows[0] || null,
      event:    eventRes.rows[0] || null
    });
  } catch (err) {
    console.error('Thread fetch error:', err);
    res.status(500).json({ error: 'Failed to load thread' });
  }
});

// ──────────────────────────────────────────────────────────────────
// POST /api/messages
// Send a message. Body: { event_id, recipient_id, body }
// ──────────────────────────────────────────────────────────────────
router.post('/', authenticateToken, async (req, res) => {
  const userId = req.user.userId || req.user.id;
  const { event_id, recipient_id, body } = req.body || {};

  if (!event_id || !recipient_id || !body || !String(body).trim()) {
    return res.status(400).json({ error: 'event_id, recipient_id and body are required' });
  }
  if (Number(recipient_id) === Number(userId)) {
    return res.status(400).json({ error: 'You cannot message yourself' });
  }

  try {
    const evt = await pool.query('SELECT organizer_id FROM events WHERE id = $1', [event_id]);
    if (evt.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    const organizerId = evt.rows[0].organizer_id;

    // Allow only conversations between the organizer and another user about this event.
    // Either (a) the sender is the organizer, OR (b) the recipient is the organizer.
    const senderIsOrganizer    = Number(userId)        === Number(organizerId);
    const recipientIsOrganizer = Number(recipient_id) === Number(organizerId);
    if (!senderIsOrganizer && !recipientIsOrganizer) {
      return res.status(403).json({ error: 'You can only message the event organizer or attendees of your event' });
    }

    const result = await pool.query(`
      INSERT INTO messages (event_id, sender_id, recipient_id, body)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [event_id, userId, recipient_id, String(body).trim()]);

    res.status(201).json({ message: result.rows[0] });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// ──────────────────────────────────────────────────────────────────
// GET /api/messages/my-events
// For attendees: list events the user has booked, with organizer info.
// Used to populate the "pick an event to chat about" picker.
// ──────────────────────────────────────────────────────────────────
router.get('/my-events', authenticateToken, async (req, res) => {
  const userId = req.user.userId || req.user.id;
  try {
    const result = await pool.query(`
      SELECT DISTINCT ON (e.id)
             e.id, e.title, e.image_url, e.event_date,
             u.id   AS organizer_id,
             u.name AS organizer_name,
             u.profile_image    AS organizer_avatar,
             u.organization_name AS organizer_org
        FROM bookings b
        JOIN events  e ON e.id = b.event_id
        JOIN users   u ON u.id = e.organizer_id
       WHERE b.user_id = $1
       ORDER BY e.id, b.created_at DESC
    `, [userId]);
    res.json({ events: result.rows });
  } catch (err) {
    console.error('My events error:', err);
    res.status(500).json({ error: 'Failed to load events' });
  }
});

// ──────────────────────────────────────────────────────────────────
// GET /api/messages/event-attendees/:eventId
// For organizers: list users who booked the given event (must own the event).
// ──────────────────────────────────────────────────────────────────
router.get('/event-attendees/:eventId', authenticateToken, async (req, res) => {
  const userId  = req.user.userId || req.user.id;
  const eventId = parseInt(req.params.eventId, 10);
  if (!eventId) return res.status(400).json({ error: 'Invalid event id' });

  try {
    const evt = await pool.query('SELECT organizer_id, title FROM events WHERE id = $1', [eventId]);
    if (evt.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    if (Number(evt.rows[0].organizer_id) !== Number(userId)) {
      return res.status(403).json({ error: 'Not your event' });
    }

    const result = await pool.query(`
      SELECT DISTINCT ON (u.id)
             u.id, u.name, u.profile_image, u.email,
             MAX(b.created_at) AS last_booked_at
        FROM bookings b
        JOIN users u ON u.id = b.user_id
       WHERE b.event_id = $1
       GROUP BY u.id, u.name, u.profile_image, u.email
       ORDER BY u.id
    `, [eventId]);
    res.json({ event: evt.rows[0], attendees: result.rows });
  } catch (err) {
    console.error('Event attendees error:', err);
    res.status(500).json({ error: 'Failed to load attendees' });
  }
});

// ──────────────────────────────────────────────────────────────────
// GET /api/messages/unread-count
// Tiny endpoint the chat widget polls for the unread badge.
// ──────────────────────────────────────────────────────────────────
router.get('/unread-count', authenticateToken, async (req, res) => {
  const userId = req.user.userId || req.user.id;
  try {
    const result = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM messages WHERE recipient_id = $1 AND read_at IS NULL',
      [userId]
    );
    res.json({ unread: result.rows[0].cnt || 0 });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;
