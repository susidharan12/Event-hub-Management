const path = require('path');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config();

// ✅ VERIFY JWT_SECRET is loaded
console.log('🔐 JWT_SECRET loaded from .env:', process.env.JWT_SECRET ? 'YES ✅' : 'NO ❌ (using fallback)');

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./Swagger");
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. PRE-REQUISITE SETUP
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Created uploads directory:', uploadsDir);
}

// 2. GLOBAL MIDDLEWARE
// 2. GLOBAL MIDDLEWARE
app.use(cors({
    origin: [
      "http://127.0.0.1:5050", 
      "http://localhost:5050", 
      "http://127.0.0.1:5500", // Common Live Server port
      "http://localhost:5500"
    ],
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
    console.log('✅ Connected to PostgreSQL database');
  } catch (err) {
    console.error('❌ Unable to connect to PostgreSQL:', err.message || err);
    return false;
  }

  try {
    console.log('📊 Initializing database schema...');
    
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
    await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ticket_holder_name VARCHAR(255)`);
    await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ticket_holder_email VARCHAR(255)`);
    await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ticket_holder_mobile VARCHAR(20)`);
    await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(255)`);
    // Add ticket_id column to store unique ticket codes
    await client.query(`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS ticket_id VARCHAR(50) UNIQUE`);
    
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
    
    // Create check_ins table
    await client.query(`
      CREATE TABLE IF NOT EXISTS check_ins (
        id SERIAL PRIMARY KEY,
        booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
        checked_in_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

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
    
    console.log('✅ Database initialization complete!');
    return true;
  } catch (error) {
    if (error.code !== '42P07') {
      console.error('⚠️ Database initialization warning:', error.message || error);
    } else {
      console.log('✅ Database tables already exist');
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

      // Mount routers to specific paths
      // This enables /api/auth/signup, /api/auth/profile, /api/auth/update-profile etc.
      app.use('/api/auth', authRouter);
      app.use('/api/events', eventsRouter);
      app.use('/api/bookings', bookingsRouter);
      app.use('/api/payments', paymentsRouter);
      app.use('/api/messages', messagesRouter);
      
      console.log('✅ Mounted real API routes (PostgreSQL)');
    } catch (err) {
      console.error('❌ Failed to mount real routes:', err.message);
    }
  } else {
    try {
      const devAuth = require('./routes/devAuth');
      app.use('/api/auth', devAuth);
      console.log('⚠️ PostgreSQL unavailable — mounted development auth routes');
    } catch (err) {
      console.error('❌ Failed to mount development auth router:', err.message);
    }
  }

  // Swagger Documentation Route
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // 5. ERROR HANDLING MIDDLEWARE (Must be after routes)
  app.use((err, req, res, next) => {
    console.error('🔥 Error:', err.stack || err);
    res.status(500).json({ 
      error: 'Internal server error',
      message: err.message 
    });
  });

  // Start Listening
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
    console.log(`👤 Profile Endpoint: http://localhost:${PORT}/api/auth/profile`);
    console.log(`pencil Update Endpoint: http://localhost:${PORT}/api/auth/update-profile`);
    console.log(`🎟️   Events Endpoint: http://localhost:${PORT}/api/events`);
    console.log(`📅   Bookings Endpoint: http://localhost:${PORT}/api/bookings`);
    console.log(`💳   Payments Endpoint: http://localhost:${PORT}/api/payments`);
    console.log(`Frontend port is: ${process.env.FRONTEND_PORT} || 5050`);


    console.log("Event Created status: ", app._router.stack.some(layer => layer.route && layer.route.path === '/api/events' && layer.route.methods.post) ? '✅ POST /api/events route exists' : '❌ POST /api/events route missing');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`⚠️ Port ${PORT} is already in use.`);
      process.exit(1);
    }
    console.error('Server error:', err);
  });
};

startServer();