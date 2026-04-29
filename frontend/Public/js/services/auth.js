/**
 * Authentication Service
 * Handles login, signup, and session management
 */

class AuthService {
  constructor() {
    this.user = this.loadUser();
    this.token = this.loadToken();
  }

  /**
   * Load User from localStorage
   */
  loadUser() {
    const userData = localStorage.getItem(CONFIG.STORAGE.USER);
    try {
      return userData ? JSON.parse(userData) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Load Token from localStorage
   */
  loadToken() {
    return localStorage.getItem(CONFIG.STORAGE.TOKEN);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!this.token && !Utils.isTokenExpired(this.token);
  }

  /**
   * Check user role
   */
  hasRole(role) {
    return this.user && this.user.role === role;
  }

  /**
   * Check if user is organizer
   */
  isOrganizer() {
    return this.hasRole(CONFIG.ROLES.ORGANIZER);
  }

  /**
   * Check if user is explorer
   */
  isExplorer() {
    return this.hasRole(CONFIG.ROLES.EXPLORER);
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    if (!this.isAuthenticated()) {
      return null;
    }
    return this.user;
  }

  /**
   * Get current user ID
   */
  getCurrentUserId() {
    return this.user?.id;
  }

  /**
   * Get current user role
   */
  getCurrentUserRole() {
    return this.user?.role;
  }

  /**
   * Get current user name
   */
  getCurrentUserName() {
    return this.user?.name;
  }

  /**
   * Signup new user
   */
  async signup(data) {
    // Validate input
    const validation = this.validateSignupData(data);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    try {
      Utils.showLoading();
      
      const response = await api.signup(data);

      // Update local state and save to localStorage
      this.user = response.user;
      this.token = response.token;
      localStorage.setItem(CONFIG.STORAGE.USER, JSON.stringify(this.user));
      localStorage.setItem(CONFIG.STORAGE.TOKEN, this.token);

      Utils.showSuccess(CONFIG.MESSAGES.SIGNUP_SUCCESS);
      
      return response;
    } catch (error) {
      Utils.showError(error.message || CONFIG.MESSAGES.SIGNUP_ERROR);
      throw error;
    } finally {
      Utils.hideLoading();
    }
  }

  /**
   * Login user
   */
  async login(email, password) {
    console.log('🔐 [AuthService] Login initiated for:', email);
    
    // Validate input
    if (!Utils.validateEmail(email)) {
      console.error('❌ [AuthService] Invalid email format');
      throw new Error('Invalid email address');
    }
    if (!password || password.length < 6) {
      console.error('❌ [AuthService] Invalid password length');
      throw new Error('Password must be at least 6 characters');
    }

    try {
      console.log('📤 [AuthService] Making API request to backend...');
      
      const response = await api.login(email, password);
      console.log('📥 [AuthService] Backend response:', response);

      // Update local state and save to localStorage
      this.user = response.user;
      this.token = response.token;
      
      console.log('💾 [AuthService] Saving to localStorage...');
      console.log('   - Token:', this.token?.substring(0, 20) + '...');
      console.log('   - User:', {
        id: this.user.id,
        name: this.user.name,
        email: this.user.email,
        mobile: this.user.mobile,
        role: this.user.role
      });
      
      localStorage.setItem(CONFIG.STORAGE.USER, JSON.stringify(this.user));
      localStorage.setItem(CONFIG.STORAGE.TOKEN, this.token);

      console.log('✅ [AuthService] Login successful!');
      console.log('🎯 User role:', this.user.role);
      
      return response;
    } catch (error) {
      console.error('❌ [AuthService] Login failed:', error.message);
      throw error;
    }
  }

  /**
   * Refresh user profile
   */
  async refreshProfile() {
    try {
      const response = await api.getProfile();
      this.user = response.user;
      localStorage.setItem(CONFIG.STORAGE.USER, JSON.stringify(this.user));
      return this.user;
    } catch (error) {
      console.error('Failed to refresh profile:', error);
      throw error;
    }
  }

  /**
   * Logout user
   */
  logout() {
    // Clear local state
    this.user = null;
    this.token = null;

    // Clear localStorage
    localStorage.removeItem(CONFIG.STORAGE.TOKEN);
    localStorage.removeItem(CONFIG.STORAGE.USER);

    Utils.showSuccess(CONFIG.MESSAGES.LOGOUT_SUCCESS);
    
    // Redirect to login
    setTimeout(() => {
      Utils.redirect(CONFIG.PAGES.LOGIN);
    }, 500);
  }

  /**
   * Verify authentication status
   */
  verifyAuth() {
    if (!this.isAuthenticated()) {
      this.logout();
      return false;
    }
    return true;
  }

  /**
   * Require authentication
   * Redirects to login if not authenticated
   */
  requireAuth() {
    if (!this.isAuthenticated()) {
      Utils.showError('Please login to continue');
      Utils.redirect(CONFIG.PAGES.LOGIN);
      return false;
    }
    return true;
  }

  /**
   * Require organizer role
   */
  requireOrganizer() {
    if (!this.isOrganizer()) {
      Utils.showError('This page is only for organizers');
      Utils.redirect(CONFIG.PAGES.HOME);
      return false;
    }
    return true;
  }

  /**
   * Validate Signup Data
   */
  validateSignupData(data) {
    // Check all required fields
    if (!data.name || !data.name.trim()) {
      return { valid: false, error: 'Name is required' };
    }

    if (!Utils.validateName(data.name)) {
      return { valid: false, error: 'Name must be at least 2 characters' };
    }

    if (!data.email || !data.email.trim()) {
      return { valid: false, error: 'Email is required' };
    }

    if (!Utils.validateEmail(data.email)) {
      return { valid: false, error: 'Invalid email address' };
    }

    if (!data.mobile || !data.mobile.trim()) {
      return { valid: false, error: 'Mobile number is required' };
    }

    if (!Utils.validateMobile(data.mobile)) {
      return { valid: false, error: 'Mobile number must be 10 digits' };
    }

    if (!data.role) {
      return { valid: false, error: 'Role is required' };
    }

    if (!data.password || !data.password.trim()) {
      return { valid: false, error: 'Password is required' };
    }

    if (!Utils.validatePassword(data.password)) {
      return { valid: false, error: 'Password must be at least 6 characters' };
    }

    if (data.password !== data.confirmPassword) {
      return { valid: false, error: 'Passwords do not match' };
    }

    return { valid: true };
  }

  /**
   * Clear auth on token expiry
   */
  handleTokenExpiry() {
    Utils.showError(CONFIG.MESSAGES.SESSION_EXPIRED);
    this.logout();
  }
}

// Create singleton instance
const auth = new AuthService();

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AuthService };
}
