const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const seed = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert a sample user (organizer)
    const userResult = await client.query(
      `INSERT INTO users (name, mobile, role, email, password_hash)
       VALUES ('Test Organizer', '1234567890', 'organizer', 'organizer@test.com', 'password')
       ON CONFLICT (email) DO NOTHING
       RETURNING id`
    );

    let userId;
    if (userResult.rows.length > 0) {
      userId = userResult.rows[0].id;
      console.log('Test user created with id:', userId);
    } else {
      const existingUser = await client.query(`SELECT id FROM users WHERE email = 'organizer@test.com'`);
      userId = existingUser.rows[0].id;
      console.log('Test user already exists with id:', userId);
    }


    // Insert a sample event with id=2
    await client.query(
      `INSERT INTO events (id, organizer_id, title, description, location, event_date, ticket_price, total_seats, available_seats, image_url, category)
       VALUES (2, $1, 'Tech Conference 2025', 'An annual conference about the future of technology.', 'San Francisco, CA', '2025-10-20 09:00:00', 100.00, 500, 500, '/uploads/img1.jpg', 'Technology')
       ON CONFLICT (id) DO UPDATE SET
         organizer_id = EXCLUDED.organizer_id,
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         location = EXCLUDED.location,
         event_date = EXCLUDED.event_date,
         ticket_price = EXCLUDED.ticket_price,
         total_seats = EXCLUDED.total_seats,
         available_seats = EXCLUDED.available_seats,
         image_url = EXCLUDED.image_url,
         category = EXCLUDED.category;
      `, [userId]
    );

    console.log('Event with id 2 created or updated.');

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error seeding database:', error);
  } finally {
    client.release();
    pool.end();
  }
};

seed();
