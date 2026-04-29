import { createEventCard } from '../components/EventCard.js';
import { showModal } from '../components/Modal.js';
import { getEvents } from '../services/api.js';

document.addEventListener('DOMContentLoaded', async () => {
  const eventsContainer = document.getElementById('events-container');
  const searchInput = document.getElementById('search-input');
  const loadMoreBtn = document.getElementById('load-more-btn');

  let currentPage = 1;
  const limit = 3;
  let currentSearch = '';
  let totalEvents = 0;

  async function loadEvents(isSearch = false) {
    if (isSearch) {
      currentPage = 1;
      eventsContainer.innerHTML = '';
    }

    try {
      loadMoreBtn.textContent = 'Loading...';
      loadMoreBtn.disabled = true;

      const params = {
        search: currentSearch,
        limit: limit,
        offset: (currentPage - 1) * limit,
      };
      
      const { events, total } = await getEvents(params);
      totalEvents = total;
      
      if (events.length === 0 && currentPage === 1) {
        eventsContainer.innerHTML = '<p>No events found</p>';
        loadMoreBtn.style.display = 'none';
        return;
      }
      
      events.forEach(event => {
        const card = createEventCard(event);
        eventsContainer.appendChild(card);
      });

      currentPage++;

      // Show/hide load more button
      if (eventsContainer.children.length >= totalEvents) {
        loadMoreBtn.style.display = 'none';
      } else {
        loadMoreBtn.style.display = 'block';
      }

    } catch (error) {
      showModal('Error', 'Failed to load events. Please try again.');
    } finally {
      loadMoreBtn.textContent = 'Load More';
      loadMoreBtn.disabled = false;
    }
  }
  
  searchInput.addEventListener('input', debounce(() => {
    currentSearch = searchInput.value;
    loadEvents(true); // isSearch = true
  }, 300));

  loadMoreBtn.addEventListener('click', () => {
    loadEvents(false);
  });

  loadEvents(true); // Initial load
});

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
