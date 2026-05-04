const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Avatar uploads — same /uploads dir used by event images.
const avatarStorage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, 'uploads/'); },
  filename: function (req, file, cb) {
    cb(null, 'avatar-' + Date.now() + path.extname(file.originalname));
  }
});
const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5 MB
});

// Authentication Routes
router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/send-otp', authController.sendOTP);

// Profile Routes
router.get('/profile', authenticateToken, authController.getProfile);
router.put('/update-profile', authenticateToken, authController.updateProfile);
router.post('/upload-avatar', authenticateToken, avatarUpload.single('avatar'), authController.uploadAvatar);

// Forgot-password (mobile-first lookup, OTP delivered via email).
router.post('/forgot-password/request', authController.forgotPasswordRequest);
router.post('/forgot-password/reset',   authController.forgotPasswordReset);

module.exports = router;