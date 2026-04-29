/**
 * Search and Filter Utilities for Events
 * Provides advanced filtering, sorting, and search capabilities
 */

const SearchFilter = {
  // State
  state: {
    allEvents: [],
    filteredEvents: [],
    currentFilters: {
      search: '',
      category: 'all',
      priceRange: { min: 0, max: 10000 },
      sortBy: 'upcoming',
      dateRange: { start: null, end: null }
    }
  },

  // Initialize search/filter functionality
  init: function(events = []) {
    this.state.allEvents = events;
    this.state.filteredEvents = [...events];
    this.setupEventListeners();
    return this;
  },

  // Setup DOM event listeners
  setupEventListeners: function() {
    const searchInput = document.getElementById('search-input');
    const categoryFilter = document.getElementById('category-filter');
    const priceRange = document.getElementById('price-range');
    const sortBy = document.getElementById('sort-by');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.setFilter('search', e.target.value);
        this.applyFilters();
      });
    }

    if (categoryFilter) {
      categoryFilter.addEventListener('change', (e) => {
        this.setFilter('category', e.target.value);
        this.applyFilters();
      });
    }

    if (priceRange) {
      priceRange.addEventListener('input', (e) => {
        this.setFilter('priceRange', { min: 0, max: parseFloat(e.target.value) });
        this.applyFilters();
      });
    }

    if (sortBy) {
      sortBy.addEventListener('change', (e) => {
        this.setFilter('sortBy', e.target.value);
        this.applyFilters();
      });
    }
  },

  // Set a filter value
  setFilter: function(key, value) {
    this.state.currentFilters[key] = value;
  },

  // Apply all active filters
  applyFilters: function() {
    let filtered = [...this.state.allEvents];
    const filters = this.state.currentFilters;

    // Search filter
    if (filters.search.trim()) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(event => 
        event.title?.toLowerCase().includes(searchTerm) ||
        event.description?.toLowerCase().includes(searchTerm) ||
        event.location?.toLowerCase().includes(searchTerm) ||
        event.category?.toLowerCase().includes(searchTerm)
      );
    }

    // Category filter
    if (filters.category !== 'all') {
      filtered = filtered.filter(event => event.category === filters.category);
    }

    // Price range filter
    filtered = filtered.filter(event => 
      event.ticket_price >= filters.priceRange.min && 
      event.ticket_price <= filters.priceRange.max
    );

    // Date range filter
    if (filters.dateRange.start && filters.dateRange.end) {
      filtered = filtered.filter(event => {
        const eventDate = new Date(event.event_date);
        return eventDate >= filters.dateRange.start && eventDate <= filters.dateRange.end;
      });
    }

    // Sorting
    filtered = this.sortEvents(filtered, filters.sortBy);

    this.state.filteredEvents = filtered;
    return filtered;
  },

  // Sort events
  sortEvents: function(events, sortBy) {
    const sorted = [...events];

    switch(sortBy) {
      case 'upcoming':
        sorted.sort((a, b) => new Date(a.event_date) - new Date(b.event_date));
        break;
      case 'price-low':
        sorted.sort((a, b) => a.ticket_price - b.ticket_price);
        break;
      case 'price-high':
        sorted.sort((a, b) => b.ticket_price - a.ticket_price);
        break;
      case 'popular':
        sorted.sort((a, b) => (b.available_seats - b.total_seats) - (a.available_seats - a.total_seats));
        break;
      case 'nearest':
        // Would need user location - for now keep original order
        break;
      default:
        break;
    }

    return sorted;
  },

  // Get filtered events
  getFiltered: function() {
    return this.state.filteredEvents;
  },

  // Get all events
  getAll: function() {
    return this.state.allEvents;
  },

  // Get available categories
  getCategories: function() {
    const categories = new Set(this.state.allEvents.map(e => e.category).filter(Boolean));
    return Array.from(categories);
  },

  // Reset all filters
  reset: function() {
    this.state.currentFilters = {
      search: '',
      category: 'all',
      priceRange: { min: 0, max: 10000 },
      sortBy: 'upcoming',
      dateRange: { start: null, end: null }
    };
    this.state.filteredEvents = [...this.state.allEvents];
    
    // Reset UI
    if (document.getElementById('search-input')) {
      document.getElementById('search-input').value = '';
    }
    if (document.getElementById('category-filter')) {
      document.getElementById('category-filter').value = 'all';
    }
    if (document.getElementById('price-range')) {
      document.getElementById('price-range').value = '10000';
    }
    if (document.getElementById('sort-by')) {
      document.getElementById('sort-by').value = 'upcoming';
    }
  }
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SearchFilter;
}
