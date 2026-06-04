# Frontend Integration with NgROK

This guide explains how to update your EventHub frontend to work with ngrok backend URLs.

## Where to Find Your Frontend Code

EventHub's frontend files are typically in:
- HTML files: `frontend/` or `public/` directory
- React app: `src/` directory
- API configuration: Usually in `config.js`, `api.js`, or `.env` file

## Option 1: Environment Variables (React)

### Step 1: Create `.env.local` for Development
```bash
# .env.local (for local development with ngrok)
REACT_APP_API_URL=https://abc123def456.ngrok-free.io/api
REACT_APP_SOCKET_URL=https://abc123def456.ngrok-free.io
REACT_APP_BACKEND_URL=https://abc123def456.ngrok-free.io
```

### Step 2: Update Your API Service

In your API service file (usually `src/services/api.js` or similar):

```javascript
// src/services/api.js
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';
const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';

export const api = {
  // Auth endpoints
  signup: (data) => fetch(`${API_BASE_URL}/auth/signup`, { 
    method: 'POST', 
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' }
  }),
  
  // Events endpoints
  getEvents: () => fetch(`${API_BASE_URL}/events`),
  createEvent: (data) => fetch(`${API_BASE_URL}/events`, {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' }
  }),
  
  // Add more endpoints as needed
};
```

## Option 2: Static Configuration

### For HTML/Vanilla JavaScript

In your main JavaScript file:

```javascript
// config.js or main.js
let API_BASE_URL;
let SOCKET_URL;

// Check if running behind ngrok
const isNgrok = window.location.hostname.includes('ngrok');

if (isNgrok) {
  API_BASE_URL = 'https://' + window.location.hostname + '/api';
  SOCKET_URL = 'https://' + window.location.hostname;
} else {
  API_BASE_URL = 'http://localhost:3000/api';
  SOCKET_URL = 'http://localhost:3000';
}

console.log('API Base URL:', API_BASE_URL);
```

### For Vue.js

In your Vue config:

```javascript
// vue.config.js
module.exports = {
  configureWebpack: {
    performance: { hints: false }
  },
  devServer: {
    proxy: {
      '/api': {
        target: process.env.VUE_APP_API_URL || 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
};
```

## Option 3: Runtime Configuration

Update API URL dynamically when ngrok URL changes:

```javascript
// updateApiUrl.js
function setApiUrl(ngrokUrl) {
  window.API_BASE_URL = ngrokUrl + '/api';
  window.SOCKET_URL = ngrokUrl;
  
  // Reload the app or update service worker
  localStorage.setItem('api_url', ngrokUrl);
  console.log('API URL updated to:', window.API_BASE_URL);
}

// Usage from console
setApiUrl('https://abc123def456.ngrok-free.io');
```

## Complete Frontend Integration Example

### React with Axios

```javascript
// src/api/client.js
import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add JWT token to all requests
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default client;
```

### Usage in Components

```javascript
// src/components/Events.jsx
import client from '../api/client';

function Events() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    client
      .get('/events')
      .then(res => setEvents(res.data))
      .catch(err => console.error('Failed to fetch events:', err));
  }, []);

  return <div>{/* Render events */}</div>;
}
```

## Updating Each Endpoint

### Auth Endpoints
```javascript
// Before (localhost)
POST http://localhost:3000/api/auth/signup

// After (ngrok)
POST https://abc123def456.ngrok-free.io/api/auth/signup
```

### Events Endpoints
```javascript
// List events
GET https://abc123def456.ngrok-free.io/api/events

// Create event
POST https://abc123def456.ngrok-free.io/api/events

// Get event details
GET https://abc123def456.ngrok-free.io/api/events/:id
```

### Bookings Endpoints
```javascript
// List user bookings
GET https://abc123def456.ngrok-free.io/api/bookings

// Create booking
POST https://abc123def456.ngrok-free.io/api/bookings
```

## WebSocket Integration (if using)

```javascript
// Socket connection
const socket = io(process.env.REACT_APP_SOCKET_URL, {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
});

socket.on('connect', () => {
  console.log('Connected to backend:', socket.id);
});
```

## Testing the Integration

### 1. Check Browser DevTools
```javascript
// In browser console
console.log('API URL:', window.API_BASE_URL);
console.log('Current hostname:', window.location.hostname);
```

### 2. Test API Call
```javascript
// In browser console
fetch('https://abc123def456.ngrok-free.io/api/events')
  .then(r => r.json())
  .then(data => console.log('Events:', data))
  .catch(err => console.error('Error:', err));
```

### 3. Check CORS Headers
```bash
curl -i https://abc123def456.ngrok-free.io/api/events
```

## Troubleshooting

### CORS Error in Browser Console
```
Access to XMLHttpRequest blocked by CORS policy...
```

**Solution:** 
- Verify backend `.env` has correct `NGROK_URL`
- Restart backend after updating `.env`
- Check frontend is using the same ngrok URL

### 401 Unauthorized
```
{error: "Unauthorized"}
```

**Solution:**
- Check JWT token is being sent in `Authorization` header
- Token might be from old localhost session - clear localStorage
- Verify JWT_SECRET matches between frontend and backend

### Network Error / Cannot Reach Backend
```
Failed to fetch: TypeError: Failed to fetch
```

**Solution:**
- Confirm backend is running and reachable
- Verify ngrok tunnel is active
- Check firewall isn't blocking the connection

## Environment Variables Reference

| Variable | Usage | Example |
|----------|-------|---------|
| `REACT_APP_API_URL` | API endpoint | `https://abc123.ngrok-free.io/api` |
| `REACT_APP_SOCKET_URL` | WebSocket URL | `https://abc123.ngrok-free.io` |
| `REACT_APP_BACKEND_URL` | File uploads | `https://abc123.ngrok-free.io` |

## Quick Checklist

- [ ] Install ngrok and get auth token
- [ ] Update frontend `.env` or config with ngrok URL
- [ ] Start backend with `npm run dev`
- [ ] Start ngrok tunnel with `ngrok http 3000`
- [ ] Update `NGROK_URL` in backend `.env`
- [ ] Restart backend
- [ ] Test API endpoint in browser
- [ ] Clear browser cache/localStorage if issues
- [ ] Test all main flows (signup, events, bookings)

---

**For more details:** See [`NGROK_SETUP.md`](./NGROK_SETUP.md)
