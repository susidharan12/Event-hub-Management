/**
 * Configuration
 * Port 8080 - Frontend (Live Server)
 * Port 3000 - Backend (Express)
 */

const CONFIG = {
  // API Configuration
  API: {
    BASE_URL: `http://127.0.0.1:3000/api`,
    ENDPOINTS: {
      AUTH: '/auth',
      EVENTS: '/events',
      BOOKINGS: '/bookings',
      PAYMENTS: '/payments'
    },
    TIMEOUT: 60000 // 60 seconds
  },

  // Storage keys
  STORAGE: {
    TOKEN: 'auth_token',
    USER: 'auth_user',
    PREFERENCES: 'app_preferences'
  },

  // Validation rules
  VALIDATION: {
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    MOBILE_REGEX: /^\d{10}$/,
    PASSWORD_MIN_LENGTH: 6,
    NAME_MIN_LENGTH: 2
  },

  // User roles
  ROLES: {
    ORGANIZER: 'organizer',
    EXPLORER: 'explorer'
  },

  // Pages
  PAGES: {
    HOME: './index.html',
    LOGIN: './Public/auth/pages/login.html',
    SIGNUP: './Public/auth/pages/signup.html',
    DASHBOARD: './Public/User/pages/index.html',
    EVENTS: './Public/User/pages/index.html',
    EVENT_DETAIL: './Public/User/pages/event-detail.html',
    ADMIN: './Public/Admin/pages/index.html',
    CHECKIN: './Public/User/pages/checkin.html'
  },

  // Messages
  MESSAGES: {
    LOADING: 'Loading...',
    SUCCESS: 'Operation successful!',
    ERROR: 'An error occurred. Please try again.',
    INVALID_CREDENTIALS: 'Invalid email or password',
    SIGNUP_SUCCESS: 'Account created successfully!',
    LOGIN_SUCCESS: 'Logged in successfully!',
    LOGOUT_SUCCESS: 'Logged out successfully!',
    NETWORK_ERROR: 'Network error. Please check your connection.',
    SESSION_EXPIRED: 'Your session has expired. Please login again.'
  },

  // Timeouts (in milliseconds)
  TIMEOUTS: {
    TOAST: 3000,
    MODAL: 300,
    API_RETRY: 5000
  }
};

// Export for both ES modules and regular scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}
