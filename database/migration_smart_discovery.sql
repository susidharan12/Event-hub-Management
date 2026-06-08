-- Smart Event Discovery & Personalization Tables

-- Event Watchlist: Users can save favorite events
CREATE TABLE IF NOT EXISTS event_watchlist (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, event_id),
  INDEX idx_watchlist_user (user_id),
  INDEX idx_watchlist_event (event_id)
);

-- Event Reviews: Users rate and review events they attended
CREATE TABLE IF NOT EXISTS event_reviews (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_title VARCHAR(255),
  review_text TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, event_id),
  INDEX idx_reviews_event (event_id),
  INDEX idx_reviews_user (user_id)
);

-- User Preferences: Track user interests for recommendations
CREATE TABLE IF NOT EXISTS user_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  interested_categories TEXT[] DEFAULT ARRAY[]::TEXT[],
  interested_locations TEXT[] DEFAULT ARRAY[]::TEXT[],
  price_range_min DECIMAL(10, 2),
  price_range_max DECIMAL(10, 2),
  distance_preference INTEGER,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_preferences_user (user_id)
);

-- Event Analytics: Track popularity and trending data
CREATE TABLE IF NOT EXISTS event_analytics (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL UNIQUE REFERENCES events(id) ON DELETE CASCADE,
  total_views INTEGER DEFAULT 0,
  total_bookings INTEGER DEFAULT 0,
  total_revenue DECIMAL(12, 2) DEFAULT 0,
  avg_rating DECIMAL(3, 2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_analytics_event (event_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON event_watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_event ON event_watchlist(event_id);
CREATE INDEX IF NOT EXISTS idx_reviews_event ON event_reviews(event_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON event_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_preferences_user ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event ON event_analytics(event_id);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_events_location ON events(location);
