const express = require('express');
const router = express.Router();
const eventController = require('../controllers/eventController');
const multer = require('multer');
const path = require('path');

console.log('[EVENTS ROUTE] Loading events router...');

// Import your auth middleware (Adjust path if your file is named differently, e.g., auth.js)
// If you don't have this file yet, you can comment this line out temporarily
const { authenticateToken,authorizeRoles } = require('../middleware/authMiddleware'); 

// Configure Image Uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Make sure this folder exists in your backend
  },
  filename: function (req, file, cb) {  
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });



// GET /api/events - List events
router.get('/', eventController.getEvents);

// GET MY EVENTS - Fixed to use PostgreSQL
router.get('/my-events', authenticateToken, async (req, res) => {
  try {
    console.log("User from token:", req.user);
    const pool = require('../db');
    
    const query = 'SELECT * FROM events WHERE organizer_id = $1 ORDER BY event_date DESC';
    const result = await pool.query(query, [req.user.id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error("MY EVENTS ERROR:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// THIS MUST COME AFTER
router.get('/:id', eventController.getEventById);

// DELETE /api/events/:id - Delete event
router.delete('/:id', eventController.deleteEvent);

// PUT /api/events/:id - Update event (organizer only, must own the event)
router.put('/:id', authenticateToken, upload.fields([
  { name: 'image',  maxCount: 1 },
  { name: 'images', maxCount: 10 }
]), eventController.updateEvent);

// Optional auth middleware - tries to authenticate but doesn't fail if token is missing
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (token && token !== 'null' && token !== 'undefined') {
      const jwt = require('jsonwebtoken');
      const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key';
      
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        console.log('[EVENTS] Token verified for user:', decoded.id);
      } catch (err) {
        console.log('[EVENTS] Token verification failed:', err.message);
        // Continue without user - will use fallback organizer
      }
    }
  }
  next();
};

// POST /api/events - Create event (optional auth - uses authenticated user if provided, otherwise fallback)
console.log('[EVENTS ROUTE] Registering POST / route');
router.post('/', optionalAuth, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'images', maxCount: 10 }
]), (req, res) => {
  console.log('[EVENTS ROUTE POST] Handler called!');
  console.log('[EVENTS ROUTE POST] Files:', req.files);
  eventController.createEvent(req, res); 
  
});




module.exports = router;