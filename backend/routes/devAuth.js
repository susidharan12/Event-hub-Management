const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();
const dataDir = path.join(__dirname, '..', 'dev-data');
const usersFile = path.join(dataDir, 'users.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(usersFile)) {
  fs.writeFileSync(usersFile, JSON.stringify([]));
}

function readUsers() {
  const raw = fs.readFileSync(usersFile, 'utf8');
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}

function writeUsers(users) {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

function generateToken(userId, role) {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '7d' });
}

// Signup
router.post('/signup', async (req, res) => {
  try {
    const { name, mobile, role, email, password } = req.body;
    if (!name || !mobile || !role || !password) {
      console.log('❌ Dev signup failed - missing fields', { name, mobile, role, email });
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const users = readUsers();
    if (users.find(u => u.email === email || u.mobile === mobile)) {
      console.log('❌ Dev signup failed - user exists', { email, mobile });
      return res.status(409).json({ error: 'User already exists' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const id = (users.length ? users[users.length-1].id : 0) + 1;
    const user = { id, name, mobile, role, email, password_hash: passwordHash, created_at: new Date().toISOString() };
    users.push(user);
    writeUsers(users);
    const token = generateToken(user.id, user.role);
    console.log('✅ Dev signup successful:', { id: user.id, name: user.name, email: user.email, mobile: user.mobile, role: user.role });
    return res.status(201).json({ message: 'User registered (dev)', token, user: { id: user.id, name: user.name, mobile: user.mobile, role: user.role, email: user.email } });
  } catch (err) {
    console.error('Dev signup error:', err.message || err);
    return res.status(500).json({ error: 'Dev signup failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      console.log('❌ Dev login failed - missing fields', { email });
      return res.status(400).json({ error: 'Email and password required' });
    }
    const users = readUsers();
    const user = users.find(u => u.email === email);
    if (!user) {
      console.log('❌ Dev login failed - user not found', { email });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      console.log('❌ Dev login failed - wrong password', { email });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = generateToken(user.id, user.role);
    console.log('🔐 Dev login successful:', { id: user.id, name: user.name, email: user.email, role: user.role });
    return res.json({ message: 'Login successful (dev)', token, user: { id: user.id, name: user.name, mobile: user.mobile, role: user.role, email: user.email } });
  } catch (err) {
    console.error('Dev login error:', err.message || err);
    return res.status(500).json({ error: 'Dev login failed' });
  }
});

// Simple OTP store in-memory for dev
const otpStorage = new Map();

router.post('/send-otp', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });
  const users = readUsers();
  const user = users.find(u => u.email === email);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStorage.set(email, { otp, expiresAt: Date.now() + 10*60*1000, attempts: 0 });
  console.log(`📧 Dev OTP for ${email}: ${otp}`);
  return res.json({ message: 'OTP sent (dev)', otpSent: true });
});

router.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });
  const data = otpStorage.get(email);
  if (!data) return res.status(400).json({ error: 'OTP not found' });
  if (Date.now() > data.expiresAt) { otpStorage.delete(email); return res.status(400).json({ error: 'OTP expired' }); }
  if (data.otp !== otp) { data.attempts += 1; if (data.attempts >=3) { otpStorage.delete(email); return res.status(400).json({ error: 'Too many attempts' }); } return res.status(400).json({ error: 'Invalid OTP' }); }
  return res.json({ message: 'OTP verified', verified: true });
});

router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, new_password } = req.body;
    if (!email || !otp || !new_password) return res.status(400).json({ error: 'Missing fields' });
    const data = otpStorage.get(email);
    if (!data || data.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });
    const users = readUsers();
    const idx = users.findIndex(u => u.email === email);
    if (idx === -1) return res.status(404).json({ error: 'User not found' });
    const passwordHash = await bcrypt.hash(new_password, 10);
    users[idx].password_hash = passwordHash;
    writeUsers(users);
    otpStorage.delete(email);
    console.log('🔁 Dev password reset successful for', { email });
    return res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error('Dev reset-password error:', err.message || err);
    return res.status(500).json({ error: 'Reset failed' });
  }
});

module.exports = router;
