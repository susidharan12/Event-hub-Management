# 🔐 Environment Configuration Setup

## Overview
This project uses environment variables to manage sensitive credentials and configuration. **NEVER commit `.env` files to GitHub.**

## Setup Instructions

### 1. Root Level Configuration (`.env`)
This file configures all Docker services (PostgreSQL, Backend, AI, Payment, Frontend).

```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your credentials
nano .env
```

**Required values to update:**
- `GROQ_API_KEY` or `ANTHROPIC_API_KEY` (AI service)
- `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` (Payment service)
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (Email service)
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` (SMS service)

### 2. Backend Configuration (`backend/.env`)
This file is only used when running the backend locally (outside Docker).

```bash
# Copy the example file
cp backend/.env.example backend/.env

# Edit backend/.env and add your credentials
nano backend/.env
```

## Getting API Keys

### 🤖 Groq API (AI Service - Recommended)
1. Go to: https://console.groq.com/keys
2. Sign up or log in
3. Click "Create API Key"
4. Copy the key (format: `gsk_xxxxxxxxxxxxxxxxxxxxxx`)
5. Paste in `.env`: `GROQ_API_KEY=gsk_xxxxxx...`

### 🧠 Anthropic Claude (Alternative AI)
1. Go to: https://console.anthropic.com/
2. Sign up or log in
3. Create an API key
4. Copy the key (format: `sk-ant-xxxxxxxxxxxxxxxxxxxxxx`)
5. Paste in `.env`: `ANTHROPIC_API_KEY=sk-ant-xxxxx...`
6. Comment out `GROQ_API_KEY`

### 💳 Razorpay (Payment)
1. Go to: https://dashboard.razorpay.com/
2. Log in to your account
3. Navigate to Settings > API Keys
4. Copy Key ID and Key Secret
5. Paste in `.env`

### 📧 SMTP (Email)
- Gmail: https://myaccount.google.com/apppasswords
- SendGrid: https://app.sendgrid.com/settings/api_keys
- Brevo: https://www.brevo.com/
- Mailtrap: https://mailtrap.io/

### 📱 Twilio (SMS)
1. Go to: https://www.twilio.com/
2. Create account and project
3. Get Account SID, Auth Token, and Phone Number
4. Paste in `.env`

## Security Best Practices

✅ **DO:**
- Use `.env.example` as a template
- Generate strong JWT secrets
- Rotate API keys regularly
- Use different keys for dev/staging/production
- Never commit `.env` files
- Add `.env` to `.gitignore`

❌ **DON'T:**
- Commit `.env` files to GitHub
- Share API keys in chat/email
- Use dummy keys in production
- Hardcode credentials in code
- Use same keys for all environments

## Docker Compose

When running with Docker Compose:

```bash
# Services automatically load from .env
docker compose up -d

# Check if services are running
docker compose ps

# View logs
docker compose logs -f ai
docker compose logs -f backend
```

## Local Development

When running locally (without Docker):

```bash
# Install dependencies
npm install

# Create .env from example
cp .env.example .env

# Update .env with your dev credentials

# Start the backend
npm start
# or
npm run dev
```

## Troubleshooting

### "Invalid API Key" Error (AI Service)
- Verify `GROQ_API_KEY` is not a placeholder
- Check Groq console for key expiration
- Generate a new key at https://console.groq.com/keys

### "CORS Error" from Frontend
- Verify `NGROK_URL` matches your ngrok tunnel (if using)
- Check backend `.env` values match root `.env`

### Database Connection Failed
- Verify `DB_HOST`, `DB_USER`, `DB_PASSWORD`
- Check PostgreSQL container is running: `docker ps | grep db`

### Email Not Sending
- Verify SMTP credentials in `.env`
- Check email service allows third-party access
- View logs: `docker compose logs backend`

## For New Team Members

1. Clone the repository
2. Copy `.env.example` to `.env`
3. Ask team lead for API keys
4. Paste keys into `.env`
5. Run: `docker compose up -d`
6. Access: http://localhost:5050

Never ask team members to share API keys in chat! Use a secure password manager or encrypted credentials.
