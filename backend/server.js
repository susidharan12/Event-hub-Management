const path = require('path');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();

// VERIFY JWT_SECRET is loaded
console.log('JWT_SECRET loaded from .env:', process.env.JWT_SECRET ? 'YES ' : 'NO (using fallback)');

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./Swagger");
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. PRE-REQUISITE SETUP
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory:', uploadsDir);
}

// 2. GLOBAL MIDDLEWARE
// Build allowed origins list dynamically to support ngrok URLs
const allowedOrigins = [
  "http://127.0.0.1:5050",
  "http://localhost:5050",
  "http://127.0.0.1:5500", // Common Live Server port
  "http://localhost:5500"
];

// Add ngrok URL from environment if provided
if (process.env.NGROK_URL) {
  allowedOrigins.push(process.env.NGROK_URL);
  console.log('NGROK_URL configured:', process.env.NGROK_URL);
}

app.use(cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      // Check if origin is in allowed list or matches an ngrok host.
      // ngrok issues URLs on several TLDs: ngrok.io, ngrok-free.io,
      // ngrok-free.app, ngrok-free.dev, ngrok.app, ngrok.dev — allow all.
      const isAllowed = allowedOrigins.includes(origin) ||
                       /^https?:\/\/[a-zA-Z0-9-]+\.ngrok(?:-free)?\.(io|app|dev)$/.test(origin);

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 3. DATABASE INITIALIZATION FUNCTION
async function initializeDatabase() {
  let client;
  try {
    client = await pool.connect();
    password = 'postgres';
    console.log('Connected to PostgreSQL database');
  } catch (err) {
    console.error('Unable to connect to PostgreSQL:', err.message || err);
    return false;
  }

  try {
    console.log('Initializing database schema...');
    
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        mobile VARCHAR(10) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) CHECK (role IN ('organizer', 'explorer')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // --- SCHEMA MIGRATION: profile photo + organization details for organizers ---
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image VARCHAR(255)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_name VARCHAR(255)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_address TEXT`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_phone VARCHAR(20)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_website VARCHAR(255)`);
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_description TEXT`);
    // Presence tracking — updated on every authenticated request.
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    // Bookkeeping column carried over from the legacy local DB schema, kept so
    // pg_dump imports from older databases don't fail with "column does not exist".
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    
    // Create events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        organizer_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(50),
        location VARCHAR(255),
        event_date TIMESTAMP,
        ticket_price DECIMAL(10,2),
        total_seats INTEGER,
        available_seats INTEGER,
        image_url VARCHAR(255),
        images TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // --- SCHEMA MIGRATION: Ensure columns exist if table was created by older version ---
    await client.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS ticket_price DECIMAL(10,2)`);
    await client.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS available_seats INTEGER`);
    await client.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url VARCHAR(255)`);
    await client.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS images TEXT[]`);
    await client.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS place VARCHAR(255)`);
    await client.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS map_url TEXT`);
    await client.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    // --- SCHEMA MIGRATION: live reserved-seating (opt-in per event) ---
    // reserved_seating = true makes the booking page show an interactive seat
    // map instead of the quantity picker. seating_layout stores the organizer's
    // zone/row design as JSON, e.g. { zones:[{ name, price, rows, cols }] }.
    await client.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS reserved_seating BOOLEAN DEFAULT false`);
    await client.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS seating_layout JSONB`);
    
    // Create bookings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
        seats_booked INTEGER,
        total_price DECIMAL(10,2),
        booking_status VARCHAR(20) DEFAULT 'confirmed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Ensure bookings have holder/contact and transaction columns for richer ticket data
    // Schema drift fix: the original schema used `seats_booked`, but every
    // route now reads/writes `number_of_seats`. Add the column if missing
    // (fresh DBs) and backfill from the old one (databases that were created
    // with the original schema). Both columns can coexist; queries use the new.
    await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS number_of_seats INTEGER`);
    await client.query(`
      UPDATE bookings
         SET number_of_seats = seats_booked
       WHERE number_of_seats IS NULL
         AND seats_booked    IS NOT NULL
    `).catch(() => { /* old column may not exist on truly-fresh DBs — ignore */ });
    // Add status alias too (some routes use b.status, schema uses booking_status)
    await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'confirmed'`);
    await client.query(`
      UPDATE bookings
         SET status = booking_status
       WHERE status IS NULL
         AND booking_status IS NOT NULL
    `).catch(() => { /* same — older DBs may not have booking_status either */ });

    await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ticket_holder_name VARCHAR(255)`);
    await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ticket_holder_email VARCHAR(255)`);
    await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ticket_holder_mobile VARCHAR(20)`);
    await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(255)`);
    // Add ticket_id column to store unique ticket codes
    await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ticket_id VARCHAR(50) UNIQUE`);
    // Cancellation bookkeeping — refund + when it was cancelled.
    await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP`);
    await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_amount DECIMAL(10,2)`);
    await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancellation_reason TEXT`);
    // Legacy columns from the older local DB schema — kept so pg_dump imports succeed.
    await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    
    // Create payments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
        amount DECIMAL(10,2),
        payment_method VARCHAR(50),
        payment_status VARCHAR(20),
        transaction_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Legacy columns from the older local DB schema — kept so pg_dump imports succeed.
    await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS status VARCHAR(20)`);
    await client.query(`ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    
    // Create check_ins table — used by the organizer's in-app scanner.
    // Each row is one validated entry. seat_code uniquely identifies which
    // seat of a multi-seat booking has already been scanned, so the same
    // QR can't be reused. event_id + scanned_by track who scanned where.
    await client.query(`
      CREATE TABLE IF NOT EXISTS check_ins (
        id SERIAL PRIMARY KEY,
        booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
        checked_in_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Idempotent migration for the scanner additions.
    await client.query(`ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS seat_code   VARCHAR(120)`);
    await client.query(`ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS event_id    INTEGER REFERENCES events(id) ON DELETE CASCADE`);
    await client.query(`ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS scanned_by  INTEGER REFERENCES users(id)  ON DELETE SET NULL`);
    // Each seat-code can only be scanned once globally.
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_check_ins_seat_unique ON check_ins (seat_code) WHERE seat_code IS NOT NULL`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_check_ins_event ON check_ins (event_id)`);

    // Create messages table — chat between attendees and organizers, scoped per event.
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body TEXT NOT NULL,
        read_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages (event_id, sender_id, recipient_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_messages_recipient_unread ON messages (recipient_id, read_at)`);
    // Track edits so the UI can show an "edited" label.
    await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP`);

    // Organizer reviews — public ratings + comments left by other users on an
    // organizer's profile page. Each user may post up to 2 reviews per
    // organizer; the row count is enforced in the POST handler.
    await client.query(`
      CREATE TABLE IF NOT EXISTS organizer_reviews (
        id SERIAL PRIMARY KEY,
        organizer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        rating       INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        comment      TEXT,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    // Older databases were created with UNIQUE (organizer_id, user_id), which
    // limited each user to ONE review per organizer. We now allow up to 2.
    await client.query(`ALTER TABLE organizer_reviews DROP CONSTRAINT IF EXISTS organizer_reviews_organizer_id_user_id_key`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reviews_organizer ON organizer_reviews(organizer_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_reviews_org_user ON organizer_reviews(organizer_id, user_id)`);

    // OTP store — used for signup, profile-update and password-reset.
    await client.query(`
      CREATE TABLE IF NOT EXISTS otps (
        id SERIAL PRIMARY KEY,
        target VARCHAR(255) NOT NULL,                      -- email or mobile
        target_type VARCHAR(20) NOT NULL,                  -- 'email' | 'mobile'
        code VARCHAR(10) NOT NULL,                         -- 6-digit numeric
        purpose VARCHAR(40) NOT NULL,                      -- 'signup' | 'update-email' | 'update-mobile' | 'password-reset'
        attempts INT DEFAULT 0,
        verified BOOLEAN DEFAULT FALSE,
        verification_token VARCHAR(64),                    -- issued on successful verify, single-use
        token_expires_at TIMESTAMP,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_otps_target ON otps (target, purpose)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_otps_token ON otps (verification_token)`);

    // --- LIVE SEAT MAP: one row per physical seat of a reserved-seating event ---
    // status: 'available' | 'booked'. A seat is effectively HELD (not bookable
    // by others) when held_by is set AND hold_expires is in the future; expired
    // holds are swept back to available. seat_label (e.g. 'A1') is reused as the
    // per-seat ticket/QR code so the existing scanner (check_ins.seat_code) works.
    await client.query(`
      CREATE TABLE IF NOT EXISTS event_seats (
        id SERIAL PRIMARY KEY,
        event_id     INTEGER NOT NULL REFERENCES events(id)   ON DELETE CASCADE,
        seat_label   VARCHAR(20)  NOT NULL,
        row_label    VARCHAR(10),
        seat_num     INTEGER,
        zone         VARCHAR(60)  DEFAULT 'Standard',
        price        DECIMAL(10,2) DEFAULT 0,
        status       VARCHAR(20)  DEFAULT 'available',
        booking_id   INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
        held_by      INTEGER REFERENCES users(id)    ON DELETE SET NULL,
        hold_expires TIMESTAMP,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_event_seats_label ON event_seats (event_id, seat_label)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_event_seats_event ON event_seats (event_id, status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_event_seats_hold ON event_seats (hold_expires) WHERE held_by IS NOT NULL`);

    console.log('Database initialization complete!');
    return true;
  } catch (error) {
    if (error.code !== '42P07') {
      console.error('Database initialization warning:', error.message || error);
    } else {
      console.log('Database tables already exist');
    }
    return true;
  } finally {
    if (client) client.release();
  }
}

// 4. SERVER STARTUP & ROUTE MOUNTING
const startServer = async () => {
  const dbReady = await initializeDatabase();

  // Mount Routes based on DB availability
  if (dbReady) {
    try {
      // Import routers
      const authRouter = require('./routes/auth');
      const eventsRouter = require('./routes/events');
      const bookingsRouter = require('./routes/bookings');
      const paymentsRouter = require('./routes/payments');
      const messagesRouter = require('./routes/messages');
      const { router: otpRouter } = require('./routes/otp');
      const aiRouter = require('./routes/ai');
      const seatsRouter = require('./routes/seats');

      // Mount routers to specific paths
      // This enables /api/auth/signup, /api/auth/profile, /api/auth/update-profile etc.
      app.use('/api/auth', authRouter);
      app.use('/api/events', eventsRouter);
      // Seat-map endpoints share the /api/events base (e.g. /api/events/:id/seats).
      // Mounted AFTER eventsRouter so the more-specific /:id/seats paths resolve
      // here without clashing with eventsRouter's /:id handlers.
      app.use('/api/events', seatsRouter);
      app.use('/api/bookings', bookingsRouter);
      app.use('/api/payments', paymentsRouter);
      app.use('/api/messages', messagesRouter);
      app.use('/api/otp', otpRouter);
      app.use('/api/ai', aiRouter);

      console.log('Mounted real API routes (PostgreSQL)');
    } catch (err) {
      console.error('Failed to mount real routes:', err.message);
    }
  } else {
    try {
      const devAuth = require('./routes/devAuth');
      app.use('/api/auth', devAuth);
      console.log('PostgreSQL unavailable — mounted development auth routes');
    } catch (err) {
      console.error('Failed to mount development auth router:', err.message);
    }
  }

  // Swagger Documentation Route
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // 5. ERROR HANDLING MIDDLEWARE (Must be after routes)
  app.use((err, req, res, next) => {
    console.error('Error:', err.stack || err);
    res.status(500).json({ 
      error: 'Internal server error',
      message: err.message 
    });
  });

  // Start Listening — wrap Express in an HTTP server so socket.io can share
  // the same port for live seat-map updates.
  const http = require('http');
  const server = http.createServer(app);

  // Attach socket.io (live seat availability). Safe no-op if the package is
  // missing — the REST seat API still works, just without live broadcasts.
  try {
    require('./services/realtime').init(server);
  } catch (e) {
    console.warn('Realtime (socket.io) not started:', e.message);
  }

  // Periodically release expired seat holds and notify watchers.
  if (dbReady) {
    const seatsSvc = require('./services/seats');
    setInterval(() => { seatsSvc.sweepExpiredHolds().catch(() => {}); }, 30 * 1000);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`API Documentation: http://localhost:${PORT}/api-docs`);
    console.log(`Profile Endpoint: http://localhost:${PORT}/api/auth/profile`);
    console.log(`pencil Update Endpoint: http://localhost:${PORT}/api/auth/update-profile`);
    console.log(`  Events Endpoint: http://localhost:${PORT}/api/events`);
    console.log(`  Bookings Endpoint: http://localhost:${PORT}/api/bookings`);
    console.log(`  Payments Endpoint: http://localhost:${PORT}/api/payments`);
    console.log(`Frontend port is: ${process.env.FRONTEND_PORT} || 5050`);


    console.log("Event Created status: ", app._router.stack.some(layer => layer.route && layer.route.path === '/api/events' && layer.route.methods.post) ? 'POST /api/events route exists' : 'POST /api/events route missing');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use.`);
      process.exit(1);
    }
    console.error('Server error:', err);
  });
};

startServer();