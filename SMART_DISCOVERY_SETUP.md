# Smart Event Discovery & Personalization Setup Guide

## 📋 Overview

This document explains how to enable and use the Smart Event Discovery & Personalization features in EventHub, including:
- 🔍 AI-Powered Recommendations
- ❤️ Event Watchlist
- 🔥 Trending Events
- 🎯 Smart Filters
- ⭐ Event Reviews & Ratings

## 🚀 Installation Steps

### Step 1: Initialize Database Tables

Run the migration script to create new tables:

```bash
# Navigate to backend directory
cd backend

# Connect to PostgreSQL and run the migration
psql -U postgres -d eventhub < ../database/migration_smart_discovery.sql
```

Or if using Docker:

```bash
# Connect to the database container
docker exec -it eventhub-db psql -U postgres -d eventhub < ../database/migration_smart_discovery.sql
```

### Step 2: API Endpoints Available

All new endpoints are under `/api/recommendations/`:

#### Watchlist Management
- `GET /api/recommendations/watchlist` - Get user's watchlist
- `POST /api/recommendations/watchlist/:eventId` - Add to watchlist
- `DELETE /api/recommendations/watchlist/:eventId` - Remove from watchlist

#### Recommendations
- `GET /api/recommendations/recommendations` - Get personalized recommendations based on booking history

#### Trending Events
- `GET /api/recommendations/trending` - Get trending events (most booked last 30 days)

#### Smart Search
- `GET /api/recommendations/search?category=music&location=Mumbai&minPrice=100&maxPrice=5000&minRating=4&sortBy=trending`

#### Event Reviews
- `GET /api/recommendations/reviews/:eventId` - Get reviews for an event
- `POST /api/recommendations/reviews/:eventId` - Add/update review (requires booking)

#### User Preferences
- `GET /api/recommendations/preferences` - Get user's saved preferences
- `PUT /api/recommendations/preferences` - Update preferences

### Step 3: Frontend Integration

The discovery page is available at:
```
http://localhost:5050/Public/User/pages/discover.html
```

Features included:
1. **Recommendations Tab** - Shows AI-powered recommendations
2. **Trending Tab** - Shows most popular events
3. **Watchlist Tab** - Manage your saved events
4. **Smart Search Tab** - Advanced filtering and search

## 🎯 How It Works

### Recommendations Algorithm

The system analyzes:
1. **Booking History** - Categories and locations of past bookings
2. **User Preferences** - Manually set interests and preferences
3. **Event Popularity** - Trending events get boosted
4. **Ratings** - Highly-rated events are prioritized

### Trending Events Calculation

Based on:
- **Bookings in Last 30 Days** (60% weight)
- **Average Rating** (40% weight)
- **Minimum Threshold** - Must have at least 1 booking or review

### Smart Filters Support

Available filter options:
- **Category** - music, sports, tech, business, other
- **Location** - Free text search
- **Price Range** - Min and max price
- **Minimum Rating** - 3+, 3.5+, 4+ stars
- **Sort By** - trending, rating, price_low, price_high, date

## 📊 Database Schema

### New Tables Created

#### event_watchlist
```sql
- id (Primary Key)
- user_id (FK to users)
- event_id (FK to events)
- added_at (Timestamp)
```

#### event_reviews
```sql
- id (Primary Key)
- user_id (FK to users)
- event_id (FK to events)
- booking_id (FK to bookings)
- rating (1-5)
- review_title
- review_text
- created_at, updated_at
```

#### user_preferences
```sql
- id (Primary Key)
- user_id (FK to users, Unique)
- interested_categories (Array)
- interested_locations (Array)
- price_range_min
- price_range_max
- distance_preference
- updated_at
```

#### event_analytics
```sql
- id (Primary Key)
- event_id (FK to events, Unique)
- total_views
- total_bookings
- total_revenue
- avg_rating
- review_count
- last_updated
```

## 🔧 API Usage Examples

### Get Recommendations
```bash
curl -X GET http://localhost:3000/api/recommendations/recommendations \
  -H "Authorization: Bearer <token>"
```

### Add to Watchlist
```bash
curl -X POST http://localhost:3000/api/recommendations/watchlist/5 \
  -H "Authorization: Bearer <token>"
```

### Search with Filters
```bash
curl "http://localhost:3000/api/recommendations/search?category=music&location=Mumbai&minPrice=100&maxPrice=5000&sortBy=rating"
```

### Add Review
```bash
curl -X POST http://localhost:3000/api/recommendations/reviews/5 \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 5,
    "review_title": "Amazing event!",
    "review_text": "Had a great time at this event..."
  }'
```

## 📱 Frontend Components

### discover.html Features

1. **Tab Navigation**
   - Recommended For You
   - Trending Events
   - My Watchlist
   - Smart Search

2. **Event Cards Display**
   - Event title, location, date
   - Average rating
   - Price
   - Watchlist toggle button

3. **Smart Search Filters**
   - Category dropdown
   - Location text input
   - Price range inputs
   - Rating filter
   - Sort options
   - Search button

4. **Empty States**
   - Shows helpful messages when no events found
   - Encourages user action

## 🎨 Customization Options

### Modify Recommendation Algorithm

Edit `backend/routes/recommendations.js`, function `GET /recommendations`:

```javascript
// Change relevance scoring
CASE
  WHEN e.category = ANY($1::TEXT[]) THEN 5  // Increase category weight
  WHEN e.location = ANY($2::TEXT[]) THEN 3  // Adjust location weight
  ELSE 1
END as relevance_score
```

### Adjust Trending Events Weights

Edit trending events calculation:

```javascript
// Adjust the popularity score formula
(COUNT(DISTINCT b.id) * 0.5 + COALESCE(AVG(er.rating), 0) * 0.5) as popularity_score
```

### Change Review Requirements

Modify review validation in `POST /reviews/:eventId`:

```javascript
// Only allow reviews after event has passed
WHERE b.user_id = $1 
AND b.event_id = $2 
AND b.status = 'confirmed'
AND event_date < NOW()  // Add this line
```

## ⚙️ Configuration

### Environment Variables

No additional environment variables required. The feature uses existing database connection.

### Feature Flags

To disable specific features, comment out routes in `server.js`:

```javascript
// Temporarily disable recommendations
// app.use('/api/recommendations', recommendationsRouter);
```

## 🧪 Testing the Features

### Test Workflow

1. **Create User Account** - Sign up as explorer
2. **Book Some Events** - Create booking history
3. **Visit Discover Page** - Go to `/Public/User/pages/discover.html`
4. **Check Recommendations** - Should show personalized suggestions
5. **Add to Watchlist** - Click heart icon on any event
6. **Leave Reviews** - Rate your attended events
7. **Use Smart Search** - Filter events by various criteria

### Sample Test Data

```sql
-- Add sample event reviews
INSERT INTO event_reviews (user_id, event_id, booking_id, rating, review_title, review_text)
VALUES 
  (1, 1, 1, 5, 'Excellent event!', 'Great organization and atmosphere'),
  (1, 2, 2, 4, 'Good experience', 'Well managed but could be better'),
  (2, 1, 3, 5, 'Amazing!', 'Highly recommend this event');
```

## 🐛 Troubleshooting

### Recommendations showing empty

**Cause**: User has no booking history

**Solution**: Ensure user has made at least one booking before checking recommendations

### Watchlist not saving

**Cause**: Authentication token missing or expired

**Solution**: 
- Check browser console for errors
- Re-login to get fresh token
- Verify Authorization header in network requests

### Trending events not showing

**Cause**: No recent bookings in database

**Solution**: Create sample bookings with `created_at` in last 30 days

### Review endpoints return 403

**Cause**: User hasn't booked the event

**Solution**: Only users who have confirmed bookings can review events

## 📈 Performance Optimization

### Database Indexes

The migration script creates indexes for:
- `watchlist_user` - Fast user watchlist queries
- `reviews_event` - Fast event review lookups
- `preferences_user` - Quick preference retrieval
- `analytics_event` - Event stats lookups
- `events_category` - Category filtering
- `events_location` - Location filtering

### Query Optimization Tips

1. **Watchlist Queries** - Indexed by user_id, very fast
2. **Recommendations** - Uses indexed category/location lookups
3. **Trending Events** - Aggregates with date filter, may benefit from materialized views for high traffic

### Scaling Recommendations

For high-traffic deployments:
1. Create materialized views for trending events
2. Cache recommendations for 1 hour
3. Use Redis for watchlist operations
4. Archive old reviews (> 1 year)

## 🔒 Security Considerations

- ✅ All endpoints require authentication
- ✅ Users can only see their own watchlist
- ✅ Users can only review their own bookings
- ✅ SQL injection prevented via parameterized queries
- ⚠️ Consider adding rate limiting for search endpoint
- ⚠️ Consider adding CORS restrictions for API endpoints

## 📞 Support & Feedback

For issues or feature requests related to Smart Discovery:
1. Check the troubleshooting section above
2. Review API endpoint documentation
3. Check browser console for JavaScript errors
4. Verify database tables are created correctly

## 🎉 What's Next?

Future enhancements:
- [ ] Machine learning recommendations using TensorFlow
- [ ] Social recommendations (friends' choices)
- [ ] Push notifications for watchlist price drops
- [ ] Comparison shopping across platforms
- [ ] Calendar integration
- [ ] Personalized email digests
