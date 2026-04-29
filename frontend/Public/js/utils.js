/**
 * Utility Functions
 */

class Utils {
  /**
   * Validation Functions
   */
  static validate = {
    email: (email) => CONFIG.VALIDATION.EMAIL_REGEX.test(email),
    password: (password) => password.length >= CONFIG.VALIDATION.PASSWORD_MIN_LENGTH,
    mobile: (mobile) => CONFIG.VALIDATION.MOBILE_REGEX.test(mobile),
    name: (name) => name.length >= CONFIG.VALIDATION.NAME_MIN_LENGTH,
    required: (value) => value && value.toString().trim() !== ''
  };

  /**
   * Validation Wrapper Methods (for backward compatibility)
   */
  static validateEmail(email) {
    return this.validate.email(email);
  }

  static validatePassword(password) {
    return this.validate.password(password);
  }

  static validateMobile(mobile) {
    return this.validate.mobile(mobile);
  }

  static validateName(name) {
    return this.validate.name(name);
  }

  static validateRequired(value) {
    return this.validate.required(value);
  }

  /**
   * Display Loading State
   */
  static showLoading(message = CONFIG.MESSAGES.LOADING) {
    const existing = document.getElementById('app-loader');
    if (existing) existing.remove();

    const loader = document.createElement('div');
    loader.id = 'app-loader';
    loader.className = 'loader';
    loader.innerHTML = `
      <div class="loader-content">
        <div class="spinner"></div>
        <p>${message}</p>
      </div>
    `;
    document.body.appendChild(loader);
  }

  /**
   * Hide Loading State
   */
  static hideLoading() {
    const loader = document.getElementById('app-loader');
    if (loader) {
      loader.classList.add('fade-out');
      setTimeout(() => loader.remove(), 300);
    }
  }

  /**
   * Show Toast Notification
   */
  static showToast(message, type = 'info') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.setAttribute('role', 'alert');
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, CONFIG.TIMEOUTS.TOAST);
  }

  /**
   * Show Success Toast
   */
  static showSuccess(message = CONFIG.MESSAGES.SUCCESS) {
    this.showToast(message, 'success');
  }

  /**
   * Show Error Toast
   */
  static showError(message = CONFIG.MESSAGES.ERROR) {
    this.showToast(message, 'error');
  }

  /**
   * Show Info Toast
   */
  static showInfo(message) {
    this.showToast(message, 'info');
  }

  /**
   * Redirect to a page
   */
  static redirect(path) {
    // Simple absolute path redirect
    window.location.href = path;
  }

  /**
   * Parse JWT Token
   */
  static parseJWT(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error parsing JWT:', error);
      return null;
    }
  }

  /**
   * Check if Token is Expired
   */
  static isTokenExpired(token) {
    try {
      const decoded = this.parseJWT(token);
      if (!decoded || !decoded.exp) return true;
      return decoded.exp * 1000 < Date.now();
    } catch {
      return true;
    }
  }

  /**
   * Format Date
   */
  static formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  /**
   * Format Time
   */
  static formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Format DateTime
   */
  static formatDateTime(dateString) {
    return `${this.formatDate(dateString)} ${this.formatTime(dateString)}`;
  }

  /**
   * Debounce Function
   */
  static debounce(func, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
  }

  /**
   * Throttle Function
   */
  static throttle(func, delay) {
    let lastCall = 0;
    return function (...args) {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        return func.apply(this, args);
      }
    };
  }

  /**
   * Get Query Parameters
   */
  static getQueryParams() {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    for (const [key, value] of params) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Redirect to Page
   */
  static redirect(page) {
    window.location.href = page;
  }

  /**
   * Get Current Page
   */
  static getCurrentPage() {
    return window.location.pathname.split('/').pop() || 'index.html';
  }

  /**
   * Is User Authenticated
   */
  static isAuthenticated() {
    const token = localStorage.getItem(CONFIG.STORAGE.TOKEN);
    return token && !this.isTokenExpired(token);
  }

  /**
   * Format Currency
   */
  static formatCurrency(amount, currency = 'INR') {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency
    }).format(amount);
  }

  /**
   * Clone Object (Deep)
   */
  static deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * Merge Objects
   */
  static mergeObjects(target, source) {
    return { ...target, ...source };
  }

  /**
   * Remove Duplicates from Array
   */
  static removeDuplicates(arr, key) {
    return [...new Map(arr.map((item) => [item[key], item])).values()];
  }

  /**
   * Sort Array
   */
  static sortArray(arr, key, order = 'asc') {
    return arr.sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      if (order === 'desc') return bVal - aVal;
      return aVal - bVal;
    });
  }

  /**
   * Filter Array
   */
  static filterArray(arr, predicate) {
    return arr.filter(predicate);
  }

  /**
   * Find in Array
   */
  static findInArray(arr, predicate) {
    return arr.find(predicate);
  }

  /**
   * Capitalize String
   */
  static capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Trim String
   */
  static trim(str) {
    return str.trim();
  }

  /**
   * Sleep (Promise delay)
   */
  static sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Utils;
}
