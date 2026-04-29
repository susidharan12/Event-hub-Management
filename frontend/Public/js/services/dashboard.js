/**
 * Dashboard Service
 * Handles dashboard route logic and role-based navigation
 */

class DashboardService {
  /**
   * Get dashboard URL based on user role
   */
  static getDashboardURL(user) {
    if (!user) return '/Public/auth/pages/login.html';
    
    if (user.role === 'organizer') {
      return '/Public/organizer/pages/dashboard.html';
    } else if (user.role === 'explorer') {
      return '/Public/explorer/pages/dashboard.html';
    }
    
    return '/Public/auth/pages/login.html';
  }

  /**
   * Navigate to appropriate dashboard after login
   */
  static navigateToDashboard(user) {
    const url = this.getDashboardURL(user);
    window.location.href = url;
  }

  /**
   * Get dashboard data based on role
   */
  static async getDashboardData(role) {
    try {
      if (role === 'organizer') {
        return await this.getOrganizerData();
      } else if (role === 'explorer') {
        return await this.getExplorerData();
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      throw error;
    }
  }

  /**
   * Get organizer dashboard data
   */
  static async getOrganizerData() {
    try {
      const response = await api.get('/events/organizer/events');
      return response;
    } catch (error) {
      console.error('Failed to fetch organizer events:', error);
      throw error;
    }
  }

  /**
   * Get explorer dashboard data
   */
  static async getExplorerData() {
    try {
      const response = await api.get('/events');
      return response;
    } catch (error) {
      console.error('Failed to fetch explorer events:', error);
      throw error;
    }
  }

  /**
   * Verify user has access to dashboard
   */
  static canAccessDashboard(user) {
    return user && (user.role === 'organizer' || user.role === 'explorer');
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DashboardService;
}
