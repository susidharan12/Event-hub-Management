# EventHub NgROK Quick Start

Get your application online in 5 minutes!

## 1. Install ngrok
- Download: https://ngrok.com/download
- Or: `brew install ngrok/ngrok/ngrok` (Mac) or `choco install ngrok` (Windows)

## 2. Get Auth Token
- Go to https://dashboard.ngrok.com/get-started/your-authtoken
- Copy your auth token
- Run: `ngrok config add-authtoken YOUR_TOKEN_HERE`

## 3. Start Your Application

**Terminal 1: Start Backend**
```bash
cd EventHub-Event-Management/backend
npm install  # if first time
npm run dev
```

**Terminal 2: Start ngrok**

**Windows:**
```bash
double-click setup-ngrok.bat
# or manually:
ngrok http 3000
```

**Mac/Linux:**
```bash
chmod +x setup-ngrok.sh
./setup-ngrok.sh
# or manually:
ngrok http 3000
```

## 4. Get Your Public URL

ngrok will show something like:
```
Forwarding    https://abc123def456.ngrok-free.io -> http://localhost:3000
```

Your public URL is: **https://abc123def456.ngrok-free.io**

## 5. Update Your Configuration

**Option A: Update .env**
```bash
# Add to backend/.env
NGROK_URL=https://abc123def456.ngrok-free.io
```

Then restart your backend (Ctrl+C and `npm run dev` again)

**Option B: Update Frontend**
```javascript
// Change API endpoint in your frontend code
const API_URL = 'https://abc123def456.ngrok-free.io/api';
```

## 6. Test It

```bash
# Test from another machine
curl https://abc123def456.ngrok-free.io/api/events

# Or visit API docs
https://abc123def456.ngrok-free.io/api-docs
```

## Common Issues

| Issue | Solution |
|-------|----------|
| CORS Error | Update NGROK_URL in .env and restart backend |
| Connection Refused | Backend not running or not on port 3000 |
| 502 Bad Gateway | ngrok can't reach your backend |
| URL keeps changing | Upgrade to paid ngrok plan for stable domain |

## Next Steps

- Read full guide: [`NGROK_SETUP.md`](./NGROK_SETUP.md)
- Learn ngrok: https://ngrok.com/docs
- Share your URL with teammates

**That's it! Your app is now publicly accessible.** 🚀
