# EventHub NgROK Deployment Guide

This guide explains how to enable your EventHub application for deployment using ngrok, allowing external access to your local development environment.

## What is ngrok?

ngrok is a tool that creates secure public URLs for your locally running applications. It's perfect for:
- Testing webhooks and external API integrations
- Sharing your app with team members
- Demoing your application to stakeholders
- Testing on mobile devices
- External API access without cloud deployment

## Prerequisites

1. **Node.js** - v14+ installed
2. **PostgreSQL** - running locally
3. **ngrok account** - sign up free at https://ngrok.com

## Installation Steps

### 1. Install ngrok

**Windows:**
```bash
# Using Chocolatey
choco install ngrok

# Or download from https://ngrok.com/download
```

**Mac:**
```bash
brew install ngrok/ngrok/ngrok
```

**Linux:**
```bash
# Download and extract
wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.zip
unzip ngrok-v3-stable-linux-amd64.zip
sudo mv ngrok /usr/local/bin
```

### 2. Authenticate ngrok

Get your auth token from: https://dashboard.ngrok.com/get-started/your-authtoken

```bash
ngrok config add-authtoken <YOUR_AUTH_TOKEN>
```

Or set environment variable:
```bash
export NGROK_AUTHTOKEN=<YOUR_AUTH_TOKEN>
```

### 3. Configure EventHub

Copy the example configuration:
```bash
cp backend/.env.ngrok.example backend/.env.ngrok
# Then edit backend/.env to add your ngrok URL
```

## Usage

### Option 1: Start Backend with ngrok (Recommended)

**Step 1: Start PostgreSQL**
```bash
# Windows (PowerShell)
pg_ctl -D "C:\Program Files\PostgreSQL\14\data" start

# Mac/Linux
brew services start postgresql
# or
sudo service postgresql start
```

**Step 2: Start Backend Server**
```bash
cd backend
npm install  # if needed
npm run dev  # starts server on http://localhost:3000
```

**Step 3: Create ngrok Tunnel (in new terminal)**
```bash
cd backend
ngrok start eventhub-backend
```

This will output:
```
Forwarding                    https://abc123def456.ngrok-free.io -> http://localhost:3000
```

**Step 4: Update .env with ngrok URL**
```bash
# Add to backend/.env
NGROK_URL=https://abc123def456.ngrok-free.io
```

**Step 5: Restart backend** (to pick up new NGROK_URL)
```bash
# Press Ctrl+C and restart npm run dev
```

### Option 2: Quick ngrok Start

For simple tunneling without configuration file:
```bash
# Terminal 1 - Start backend
cd EventHub-Event-Management/backend
npm run dev

# Terminal 2 - Create tunnel
ngrok http 3000
```

## Frontend Configuration

Update your frontend to use the ngrok URL instead of localhost:

### For HTML/JavaScript Frontend:
```javascript
// In your frontend code, change API endpoint:
const API_BASE_URL = 'https://abc123def456.ngrok-free.io/api';

// or load from environment
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';
```

### For React (.env):
```bash
REACT_APP_API_URL=https://abc123def456.ngrok-free.io/api
REACT_APP_SOCKET_URL=https://abc123def456.ngrok-free.io
```

## Testing the Deployment

### Test Backend Accessibility
```bash
# From another machine or ngrok browser
curl https://abc123def456.ngrok-free.io/api/events
```

### Test API Documentation
Visit: `https://abc123def456.ngrok-free.io/api-docs`

### Test CORS
```bash
curl -i https://abc123def456.ngrok-free.io/api/events \
  -H "Origin: https://your-frontend-domain.ngrok-free.io"
```

## Supported Features

✅ **Enabled for ngrok:**
- Dynamic CORS configuration
- ngrok URL pattern matching
- Multiple simultaneous tunnels (backend + frontend)
- OAuth integration ready
- Custom domain support (paid plan)

## Troubleshooting

### CORS Errors
- Verify `NGROK_URL` is set in backend/.env
- Restart the backend after changing environment variables
- Check frontend is using the correct ngrok URL

### Connection Refused
- Ensure backend is running on port 3000
- Check PostgreSQL is connected
- Verify ngrok tunnel is active

### 502 Bad Gateway
- ngrok can't reach your local server
- Check backend is listening on localhost:3000
- Check firewall isn't blocking the connection

### Session/Token Issues
- ngrok URLs change with each connection (free tier)
- Update NGROK_URL and restart when URL changes
- Use custom domains for stable URLs (requires paid plan)

## Advanced Configuration

### Custom Domain (Paid Plan)
```bash
# In ngrok.yml
tunnels:
  eventhub-backend:
    domain: my-custom-domain.ngrok.io
```

### Add OAuth Protection
The `ngrok.yml` includes OAuth configuration. To enable:
```yaml
oauth:
  provider: google
  allow_emails: your-email@example.com
```

### Multiple Tunnels
```bash
# Backend tunnel
ngrok start eventhub-backend

# Or specific tunnel
ngrok start eventhub-backend eventhub-frontend
```

## Production Considerations

⚠️ **Note:** ngrok is for development/testing only. For production deployment:
- Use cloud platforms (AWS, Azure, Heroku, Vercel, etc.)
- Use traditional domain names and SSL certificates
- Implement proper security measures
- Use environment-specific configurations

## Useful ngrok Commands

```bash
# View active tunnels
ngrok api tunnels list

# View ngrok logs
ngrok log -n 50

# Inspect HTTP traffic (dev mode)
ngrok http 3000 -inspect=false  # disable inspector

# Restart tunnel
ngrok stop
ngrok start eventhub-backend
```

## Environment Variables Summary

| Variable | Purpose | Example |
|----------|---------|---------|
| `NGROK_URL` | Backend tunnel URL | `https://abc123def456.ngrok-free.io` |
| `NGROK_AUTHTOKEN` | Authentication | Your token from dashboard |
| `NGROK_DOMAIN` | Custom domain for backend | `api.example.ngrok.io` |
| `NGROK_FRONTEND_DOMAIN` | Custom domain for frontend | `app.example.ngrok.io` |
| `NGROK_ALLOWED_EMAILS` | OAuth email whitelist | `user@example.com,admin@example.com` |

## Support

- **ngrok Documentation:** https://ngrok.com/docs
- **ngrok Status:** https://status.ngrok.com
- **ngrok Pricing:** https://ngrok.com/pricing
- **EventHub Issues:** Check project repository

---

**Last Updated:** 2024
**Version:** 1.0
