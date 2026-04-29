# EventHub Organizer Dashboard - Quick Start Guide

## 🎯 Quick Reference

### Dashboard URL
```
http://127.0.0.1:5050/Public/organizer/pages/dashboard.html
```

### Auto-Login Test Page
```
http://127.0.0.1:5050/test-organizer.html
```
This page automatically creates/logs in a test organizer account and redirects to the dashboard.

---

## 📋 Features

### 1. **Dashboard Overview**
- View total number of events you've created
- See your event revenue (feature ready for expansion)
- Quick navigation sidebar

### 2. **My Events Section**
- **View Events**: All your events displayed in a professional table
- **Table Columns**: 
  - Title: Event name
  - Category: Event type
  - Date: Event date (formatted to local date)
  - Location: Event location
  - Price: Ticket price in rupees (₹)
  - Seats: Available seats vs total seats
  - Actions: Edit / Delete buttons

- **Empty State**: If no events exist, see a friendly message with "Create Event" button
- **Empty State Message**: "No Events Yet" with CTA to create first event

### 3. **Create Event Section**
- Form fields:
  - **Event Title** (required)
  - **Category** (required, e.g., Concert, Tech, Workshop)
  - **Date & Time** (required)
  - **Location** (required)
  - **Price** (required, in rupees)
  - **Total Seats** (required)
  - **Description** (optional)
  - **Images** (optional, multiple files supported)

- **Submit Behavior**:
  - Click "Save Event" button
  - Form validates required fields
  - Server processes the event
  - **Success**: Modal shows event title with "See My Events" button
  - **Failure**: Modal shows error message with "Try Again" button
  - Form automatically clears on success

### 4. **Event Management**
- **Edit Button**: Click to edit event details (coming soon)
- **Delete Button**: 
  - Click to delete event
  - Confirmation dialog appears
  - On confirm: Event deleted and removed from table
  - Success modal confirms deletion

### 5. **Profile Section**
- View your organizer profile details
- Name, email, mobile, and role information
- All fields are read-only for security

---

## 🎨 Modal Feedback System

### Success Modal (Green)
```
✓ (Green checkmark icon)
Event Created Successfully! 🎉
"YOUR_EVENT_TITLE" has been added to your events.

Buttons:
[See My Events] [Close]
```
- Click "See My Events" to view your events immediately
- Click "Close" to dismiss and continue editing

### Failure Modal (Red)
```
✕ (Red X icon)
Event Creation Failed ❌
Error message details shown here

Buttons:
[Try Again] [Close]
```
- Click "Try Again" to retry submission
- Click "Close" to dismiss

### Delete Success Modal
```
✓ (Green checkmark)
Event Deleted ✓
Your event has been removed.

Buttons:
[Close]
```

---

## 📊 Console Logs

Open browser console (F12) to see detailed operation logs:

### Event Creation Logs
```
✅ Event created successfully: {event_object}
❌ Event creation failed: {status, error_details}
❌ Save error: {error_message}
POST /api/events response: {status, ok, body}
```

### Event Loading Logs
```
📋 Loaded X events for organizer 1
❌ Failed to load events - API returned status 404
❌ Error fetching events: Network error
```

### Event Deletion Logs
```
🗑️ Deleting event 42...
✅ Event 42 deleted successfully
❌ Failed to delete event 42 - status 400
🚫 Event deletion cancelled
```

---

## 🔐 Authentication

### Session Data Stored (Multiple Locations)
```javascript
// Token stored in:
localStorage.token
localStorage.authToken
localStorage.auth_token
localStorage.eventhub_token

// User data stored in:
localStorage.user
localStorage.auth_user
```

### Logout
- Click on your name/avatar in top-right
- Click "Logout"
- Session cleared, redirected to home page

---

## 🌐 API Endpoints Used

All endpoints use `http://localhost:3000/api` base URL

### Events Endpoints
```
GET    /events                      → Get all events
GET    /events?organizer=1          → Get events for organizer ID 1
GET    /events/:id                  → Get specific event
POST   /events                      → Create new event
DELETE /events/:id                  → Delete event by ID
```

### Request Headers
```javascript
Authorization: Bearer {jwt_token}
Content-Type: application/json (for JSON)
Content-Type: multipart/form-data (for file uploads)
```

---

## 🐛 Troubleshooting

### Issue: "CONFIG is not defined"
**Solution**: 
1. Clear browser cache (Ctrl+F5)
2. Verify `config.js` is loaded in Network tab (F12 → Network)
3. Check that config.js is imported BEFORE dashboard.js in HTML

### Issue: Events not showing
**Solution**:
1. Open browser console (F12)
2. Look for log: "📋 Loaded X events..."
3. If X=0, create a test event
4. Check API directly: `http://localhost:3000/api/events`

### Issue: Modal not appearing
**Solution**:
1. Check browser console for JavaScript errors
2. Verify modal HTML elements exist in page source
3. Check modal CSS in developer tools
4. Clear cache and hard refresh

### Issue: Form submission fails
**Solution**:
1. Check all required fields are filled
2. Open console (F12) for detailed error
3. Look for error modal with specific error message
4. Verify backend is running: `http://localhost:3000/api/events` returns data

### Issue: Delete not working
**Solution**:
1. Confirm you clicked the red Delete button (not Edit)
2. Accept the confirmation dialog
3. Check console for "🗑️ Deleting event..." log
4. Verify event ID is correct

---

## 🧪 Test Scenarios

### Scenario 1: Create & View Event
```
1. Go to "Create Event" section
2. Fill form with test data:
   Title: "My First Event"
   Category: "Workshop"
   Date: Tomorrow at 10:00 AM
   Location: "New Delhi, India"
   Price: 500
   Seats: 100
3. Click "Save Event"
4. See success modal with "My First Event" title
5. Click "See My Events"
6. Verify event appears in table
7. Check console for success log
```

### Scenario 2: Delete Event
```
1. In "My Events" section
2. Find an event row
3. Click Delete button (red)
4. Confirm deletion in dialog
5. See success modal
6. Event disappears from table
7. Check console for delete log
```

### Scenario 3: Empty State
```
1. Delete all events (if any exist)
2. Go to "My Events" section
3. See "No Events Yet" message
4. See inbox icon and "Create Event" button
5. Click "Create Event" button
6. Should navigate to Create Event section
```

---

## 📱 Mobile Support

- Dashboard is fully responsive
- Modal displays correctly on mobile screens
- Table scrolls horizontally on small screens
- Touch-friendly button sizes (44px+ minimum)
- Easy-to-tap form inputs

---

## ⌨️ Keyboard Shortcuts

- **Tab**: Navigate form fields
- **Enter**: Submit form (when form is focused)
- **Escape**: Close modal (optional, can implement)
- **F12**: Open developer console

---

## 💾 Data Persistence

- All events stored in PostgreSQL database
- User session stored in browser localStorage
- Files uploaded to `/backend/uploads` directory
- Images referenced by URL in event record

---

## 🔔 Notifications

### Types of Notifications
1. **Form Validation**: Browser alerts for missing required fields
2. **Success Modal**: Green checkmark with success message
3. **Error Modal**: Red X with error details
4. **Confirmation Dialog**: Yes/No for destructive actions

### Console Notifications
- Emoji-prefixed logs for easy identification
- ✅ = Success operation
- ❌ = Error or failure
- 📋 = Information
- 🗑️ = Deletion operation
- 📝 = Edit operation

---

## 📞 Support

For issues or questions:
1. Check browser console (F12)
2. Verify backend is running
3. Check network requests in Network tab
4. Look for error messages in modals
5. Read implementation summary for detailed info

---

## ✨ Best Practices

1. **Always check console**: Click F12 and check console for detailed logs
2. **Confirm before delete**: Always confirm deletion in dialog
3. **Save frequently**: Create events with proper details first time
4. **Clear cache regularly**: Clear browser cache if seeing stale data
5. **Use valid credentials**: Ensure you're logged in as organizer

---

*Last Updated: 2025-02-11*
*Version: 1.0*
