const jwt = require("jsonwebtoken");
const pool = require("../db");

// Use the same JWT_SECRET as authController — should be loaded from process.env by server.js
const JWT_SECRET = process.env.JWT_SECRET;

// Lazy heartbeat — updates users.last_seen at most once every 20 s per user.
// Used to power online/offline indicators in the chat without flooding the DB.
const _lastBeat = new Map();
function bumpLastSeen(userId) {
  if (!userId) return;
  const now = Date.now();
  const prev = _lastBeat.get(userId) || 0;
  if (now - prev < 20_000) return;
  _lastBeat.set(userId, now);
  // Fire-and-forget — never block the request on this.
  pool.query('UPDATE users SET last_seen = NOW() WHERE id = $1', [userId])
      .catch(err => console.warn('last_seen update failed', err.message));
}


/**
 * Middleware to authenticate the JWT token
 */
const authenticateToken = (req, res, next) => {
  try {
    // 1. Get the Authorization header
    const authHeader = req.headers['authorization'];
    console.log('Auth Header:', authHeader ? 'Present' : 'Missing');
    console.log('JWT_SECRET being used:', JWT_SECRET);

    // 2. Check if header exists and starts with "Bearer "
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("Auth Error: No Bearer token provided in header");
      return res.status(401).json({
        success: false,
        error: "Access denied. Please log in."
      });
    }

    // 3. Extract the token
    const token = authHeader.split(" ")[1];
    console.log('Token extracted:', token ? token.substring(0, 20) + '...' : 'None');

    if (!token || token === "null" || token === "undefined") {
      console.error("Auth Error: Token is null or undefined");
      return res.status(401).json({
        success: false,
        error: "Invalid session. Please log in again."
      });
    }

    // 4. Verify the token
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        console.error("JWT Verification Error:", err.message);
        console.error("Error name:", err.name);

        // If token is expired
        if (err.name === "TokenExpiredError") {
          return res.status(401).json({
            success: false,
            error: "Session expired. Please login again."
          });
        }

        // If token is invalid (wrong secret, tampered, etc.)
        return res.status(403).json({
          success: false,
          error: "Invalid or expired token."
        });
      }

      console.log('Token verified successfully. User:', decoded);
      // 5. Attach user data to the request object
      // This allows routes to access req.user.id, req.user.role, etc.
      req.user = decoded;
      // Silently update last_seen for presence indicators.
      bumpLastSeen(decoded && (decoded.userId || decoded.id));
      next();
    });

  } catch (error) {
    console.error("Middleware Error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal server error during authentication."
    });
  }
};

/**
 * Middleware for Role-Based Access Control (Optional)
 * Usage: router.post('/api/events', authenticateToken, authorizeRoles('organizer', 'admin'), createEvent)
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    console.log(`Authorizing role: ${req.user.role} against allowed roles: ${allowedRoles.join(', ')}`);
    console.log('Requesting user role:', req.user.role);
    console.log('Requsted user name :', req.user.name);

    if (!allowedRoles.includes(req.user.role)) {
      console.error(`Auth Error: Role ${req.user.role} not authorized for this route`);
      return res.status(403).json({
        success: false,
        error: "You do not have permission to perform this action."
      });
    }
    next();
  };
};

module.exports = {
  authenticateToken,
  authorizeRoles
};
