// Simple Dark Mode System
const DarkMode = {
  // Initialize dark mode
  init() {
    this.setupStyles();
    this.loadUserPreference();
    this.attachButtonListeners();
  },

  // Setup CSS styles for dark mode
  setupStyles() {
    if (document.getElementById('dark-mode-styles')) return;
    const style = document.createElement('style');
    style.id = 'dark-mode-styles';
    style.textContent = `
      html.dark-mode {
        --bg-primary: #0f172a;
        --text-primary: #f1f5f9;
      }

      html.dark-mode {
        background-color: #0f172a !important;
        color: #f1f5f9 !important;
      }

      /* Base text color for dark mode */
      html.dark-mode {
        color: #f1f5f9 !important;
      }

      /* Smart text color: light text on dark backgrounds, dark text on light backgrounds */
      html.dark-mode * {
        color: #f1f5f9 !important;
      }

      /* Override text color for elements with light backgrounds */
      html.dark-mode [style*="background: #fff"],
      html.dark-mode [style*="background: white"],
      html.dark-mode [style*="background-color: #fff"],
      html.dark-mode [style*="background-color: white"],
      html.dark-mode [style*="background: #f"],
      html.dark-mode [style*="#fff"],
      html.dark-mode [style*="#ffffff"] {
        color: #1f2937 !important;
      }

      html.dark-mode [style*="background: #fff"] *,
      html.dark-mode [style*="background: white"] *,
      html.dark-mode [style*="background-color: #fff"] *,
      html.dark-mode [style*="background-color: white"] * {
        color: #1f2937 !important;
      }

      html.dark-mode .sidebar-menu a {
        color: #f1f5f9 !important;
      }

      html.dark-mode body {
        background: #0f172a !important;
        color: #f1f5f9 !important;
      }

      html.dark-mode input,
      html.dark-mode textarea,
      html.dark-mode select {
        background: #1e293b !important;
        color: #f1f5f9 !important;
        border-color: #475569 !important;
      }

      html.dark-mode button {
        background: #475569 !important;
        color: #f1f5f9 !important;
      }

      html.dark-mode button:hover {
        background: #64748b !important;
        color: #f1f5f9 !important;
      }

      html.dark-mode .btn {
        background: #475569 !important;
        color: #f1f5f9 !important;
      }

      html.dark-mode .btn:hover {
        background: #64748b !important;
        color: #f1f5f9 !important;
      }

      /* Filter buttons and tabs */
      html.dark-mode [class*="filter"],
      html.dark-mode [class*="tab"],
      html.dark-mode [class*="pills"],
      html.dark-mode [role="tablist"] {
        background: transparent !important;
      }

      html.dark-mode [class*="filter"] button,
      html.dark-mode [class*="tab"] button,
      html.dark-mode button[class*="pill"],
      html.dark-mode [role="tab"] {
        background: #334155 !important;
        color: #f1f5f9 !important;
        border: 1px solid #475569 !important;
      }

      html.dark-mode [class*="filter"] button:hover,
      html.dark-mode [class*="tab"] button:hover,
      html.dark-mode button[class*="pill"]:hover,
      html.dark-mode [role="tab"]:hover {
        background: #475569 !important;
        color: #f1f5f9 !important;
      }

      html.dark-mode [class*="filter"] button.active,
      html.dark-mode [class*="tab"] button.active,
      html.dark-mode button[class*="pill"].active,
      html.dark-mode [role="tab"][aria-selected="true"] {
        background: #6366f1 !important;
        color: #ffffff !important;
        border-color: #6366f1 !important;
      }

      /* Badge styling */
      html.dark-mode [class*="badge"],
      html.dark-mode [class*="tag"] {
        background: #475569 !important;
        color: #f1f5f9 !important;
      }

      html.dark-mode .card {
        background: #1e293b !important;
        color: #f1f5f9 !important;
      }

      html.dark-mode .navbar {
        background: rgba(15, 23, 42, 0.95) !important;
      }

      html.dark-mode .sidebar {
        background: #1e293b !important;
      }

      /* Dark mode cards and containers */
      html.dark-mode [class*="card"],
      html.dark-mode [class*="container"],
      html.dark-mode [class*="content"],
      html.dark-mode [class*="section"] {
        background: #1e293b !important;
        color: #f1f5f9 !important;
      }

      html.dark-mode .main-content {
        background: #0f172a !important;
      }

      html.dark-mode .main-content * {
        color: #f1f5f9 !important;
      }

      html.dark-mode h1,
      html.dark-mode h2,
      html.dark-mode h3,
      html.dark-mode h4,
      html.dark-mode h5,
      html.dark-mode h6 {
        color: #f1f5f9 !important;
      }

      /* Override white background elements */
      html.dark-mode [style*="background: #fff"],
      html.dark-mode [style*="background: white"] {
        background: #1e293b !important;
      }

      /* Specific organizer dashboard cards */
      html.dark-mode .dashboard-content {
        background: #0f172a !important;
      }

      html.dark-mode .stat-card {
        background: #1e293b !important;
        color: #f1f5f9 !important;
      }

      html.dark-mode .stat-card * {
        color: #f1f5f9 !important;
      }

      html.dark-mode .event-preview-card {
        background: #1e293b !important;
        color: #f1f5f9 !important;
      }

      html.dark-mode .event-preview-card * {
        color: #f1f5f9 !important;
      }

      html.dark-mode .profile-card-section {
        background: #1e293b !important;
        color: #f1f5f9 !important;
      }

      html.dark-mode .profile-card-section * {
        color: #f1f5f9 !important;
      }

      /* Generic light-colored containers */
      html.dark-mode .content,
      html.dark-mode .box,
      html.dark-mode .panel {
        background: #1e293b !important;
        color: #f1f5f9 !important;
      }

      /* Hover states in dark mode */
      html.dark-mode *:hover {
        color: #f1f5f9 !important;
      }

      html.dark-mode a:hover {
        color: #818cf8 !important;
      }

      html.dark-mode button:hover {
        color: #f1f5f9 !important;
      }

      html.dark-mode .stat-card:hover,
      html.dark-mode .event-preview-card:hover,
      html.dark-mode .profile-card-section:hover {
        background: #334155 !important;
        color: #f1f5f9 !important;
      }

      html.dark-mode .sidebar-menu a:hover {
        color: var(--primary) !important;
      }

      /* Active sidebar items - ensure text is visible on colored backgrounds */
      html.dark-mode .sidebar-menu a.active {
        color: #ffffff !important;
      }

      html.dark-mode .sidebar-menu a.active * {
        color: #ffffff !important;
      }

      /* Ensure all sidebar text is visible */
      html.dark-mode .sidebar-menu a {
        color: #f1f5f9 !important;
      }

      html.dark-mode .sidebar-menu a i {
        color: #f1f5f9 !important;
      }

      /* Ensure table rows stay readable on hover */
      html.dark-mode tr:hover {
        background: #334155 !important;
        color: #f1f5f9 !important;
      }

      html.dark-mode tr:hover * {
        color: #f1f5f9 !important;
      }

      /* Modal and overlay text in dark mode */
      html.dark-mode .modal,
      html.dark-mode .dialog,
      html.dark-mode .popup {
        background: #1e293b !important;
        color: #f1f5f9 !important;
      }

      html.dark-mode .modal *,
      html.dark-mode .dialog *,
      html.dark-mode .popup * {
        color: #f1f5f9 !important;
      }

      /* Light background elements - ensure DARK text with maximum contrast */
      html.dark-mode .booking-card,
      html.dark-mode .event-card,
      html.dark-mode .event-item,
      html.dark-mode tbody tr,
      html.dark-mode .table-row,
      html.dark-mode .white-bg {
        color: #000000 !important;
      }

      html.dark-mode .booking-card *,
      html.dark-mode .event-card *,
      html.dark-mode .event-item *,
      html.dark-mode tbody tr *,
      html.dark-mode .table-row *,
      html.dark-mode .white-bg * {
        color: #000000 !important;
      }

      /* Override all light backgrounds to have pure black text */
      html.dark-mode [style*="#fff"],
      html.dark-mode [style*="white"],
      html.dark-mode [style*="#f8f"],
      html.dark-mode [style*="#fff"] {
        color: #000000 !important;
      }

      html.dark-mode [style*="#fff"] *,
      html.dark-mode [style*="white"] *,
      html.dark-mode [style*="#f8f"] *,
      html.dark-mode [style*="#fff"] * {
        color: #000000 !important;
      }

      /* Ensure light text on dark backgrounds is bright white */
      html.dark-mode .sidebar,
      html.dark-mode .sidebar * {
        color: #ffffff !important;
      }

      html.dark-mode .navbar,
      html.dark-mode .navbar * {
        color: #ffffff !important;
      }
    `;
    document.head.appendChild(style);
  },

  // Load user preference from localStorage
  loadUserPreference() {
    const saved = localStorage.getItem('darkMode');
    if (saved === 'true') {
      document.documentElement.classList.add('dark-mode');
      this.updateIcon();
    } else if (saved === 'false') {
      document.documentElement.classList.remove('dark-mode');
      this.updateIcon();
    } else {
      // Check system preference
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark-mode');
      }
      this.updateIcon();
    }
  },

  // Toggle dark mode
  toggle() {
    const isDark = document.documentElement.classList.contains('dark-mode');
    if (isDark) {
      document.documentElement.classList.remove('dark-mode');
      localStorage.setItem('darkMode', 'false');
    } else {
      document.documentElement.classList.add('dark-mode');
      localStorage.setItem('darkMode', 'true');
    }
    this.updateIcon();
  },

  // Update button icon
  updateIcon() {
    const buttons = document.querySelectorAll('#dark-mode-toggle, #dark-mode-toggle-float');
    const isDark = document.documentElement.classList.contains('dark-mode');
    buttons.forEach(btn => {
      if (isDark) {
        btn.innerHTML = '<i class="fas fa-sun"></i>';
      } else {
        btn.innerHTML = '<i class="fas fa-moon"></i>';
      }
    });
  },

  // Attach event listeners to buttons
  attachButtonListeners() {
    const buttons = document.querySelectorAll('#dark-mode-toggle, #dark-mode-toggle-float');
    buttons.forEach(btn => {
      btn.removeEventListener('click', this._boundToggle);
      this._boundToggle = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggle();
      };
      btn.addEventListener('click', this._boundToggle);
    });
  }
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => DarkMode.init(), 50);
  });
} else {
  setTimeout(() => DarkMode.init(), 50);
}

// Watch for theme toggle buttons added dynamically
const observer = new MutationObserver(() => {
  DarkMode.attachButtonListeners();
});
observer.observe(document.body, { childList: true, subtree: true });
