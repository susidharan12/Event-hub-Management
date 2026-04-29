const STORAGE_KEY = 'eventhub-events';

// Load events from API (backend)
async function loadEvents() {
  try {
    // Try to load from API first
    const response = await api.getEvents();
    if (response && response.events) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(response.events));
      return response.events;
    }
  } catch (error) {
    console.warn('Failed to load from API, using localStorage fallback:', error);
  }
  
  // Fallback to localStorage
  const fromStorage = localStorage.getItem(STORAGE_KEY);
  if (fromStorage) {
    return JSON.parse(fromStorage);
  }
  
  // Final fallback to data file
  try {
    const res = await fetch('../data/events.json');
    const json = await res.json();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(json.events));
    return json.events;
  } catch (e) {
    return [];
  }
}

function saveEvents(events) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

/* DOM refs (may be null on some pages) */
const form = document.getElementById('event-form');
const idInput = document.getElementById('event-id');
const nameInput = document.getElementById('event-name');
const categoryInput = document.getElementById('event-category');
const dateInput = document.getElementById('event-date');
const locationInput = document.getElementById('event-location');
const priceInput = document.getElementById('event-price');
const capacityInput = document.getElementById('event-capacity');
const descriptionInput = document.getElementById('event-description');
const coverInput = document.getElementById('event-cover');
const eventsTbody = document.getElementById('events-tbody');
const resetBtn = document.getElementById('reset-btn');

let events = [];

// Render events table (used on edit.html)
function renderTable() {
  if (!eventsTbody) return;
  eventsTbody.innerHTML = '';
  events.forEach(ev => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${ev.title}</td>
      <td>${ev.category}</td>
      <td>${new Date(ev.event_date).toLocaleString()}</td>
      <td>${ev.location}</td>
      <td>₹${ev.ticket_price}</td>
      <td>${ev.total_seats}</td>
      <td>
        <button class="action-btn action-edit" data-id="${ev.id}">Edit</button>
      </td>
    `;
    eventsTbody.appendChild(tr);
  });
}

function resetForm() {
  if (!form) return;
  idInput.value = '';
  form.reset();
  if (descriptionInput) descriptionInput.value = '';
}

// Handle create / update (on create.html and edittable.html)
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
      Utils.showLoading('Saving event...');
      
      const eventId = idInput.value;

      let response;
      
      if (eventId) {
        // Handle update - only price, time, and capacity
        const formData = new FormData();
        formData.append('ticket_price', Number(priceInput.value));
        formData.append('event_date', dateInput.value);
        formData.append('total_seats', Number(capacityInput.value));
        
        response = await api.updateEvent(eventId, formData);
        Toast.success('Event updated successfully!');
      } else {
        // Handle create
        const formData = new FormData();
        formData.append('title', nameInput.value.trim());
        formData.append('category', categoryInput.value);
        formData.append('event_date', dateInput.value);
        formData.append('location', locationInput.value.trim());
        formData.append('ticket_price', Number(priceInput.value));
        formData.append('total_seats', Number(capacityInput.value));
        formData.append('description', descriptionInput ? descriptionInput.value.trim() : '');
        
        if (coverInput && coverInput.files.length > 0) {
          formData.append('event-cover', coverInput.files[0]);
        }
        
        response = await api.createEvent(formData);
        Toast.success('Event created successfully!');
      }

      Utils.hideLoading();
      
      events = await loadEvents();
      renderTable();
      resetForm();
      
      setTimeout(() => {
        window.location.href = 'edit.html';
      }, 1000);

    } catch (error) {
      Utils.hideLoading();
      Toast.error(`Error: ${error.message}`);
      console.error('Event save error:', error);
    }
  });
}

if (resetBtn) {
  resetBtn.addEventListener('click', resetForm);
}

// Edit button on table (edit.html → edittable.html)
if (eventsTbody) {
  eventsTbody.addEventListener('click', e => {
    const id = e.target.dataset.id;
    if (!id) return;

    if (e.target.classList.contains('action-edit')) {
      window.location.href = `edittable.html?id=${encodeURIComponent(id)}`;
    }
  });
}

// On create.html or edittable.html, if there is ?id= in URL, prefill form for editing
function prefillFromQuery() {
  if (!form) return;
  const params = new URLSearchParams(window.location.search);
  const editId = params.get('id');
  if (!editId) return;
  const ev = events.find(ev => ev.id === editId);
  if (!ev) return;

  idInput.value = ev.id;
  priceInput.value = ev.ticket_price;
  capacityInput.value = ev.total_seats;
  
  if (dateInput && ev.event_date) {
    // Format date for datetime-local input (YYYY-MM-DDTHH:MM)
    const d = new Date(ev.event_date);
    const localIso = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    dateInput.value = localIso;
  }
  
  if (descriptionInput) descriptionInput.value = ev.description || '';
}

// Init
(async function init() {
  try {
    // Verify user is authenticated and is an organizer
    if (!auth || !auth.isAuthenticated()) {
      Toast.error('Please login first');
      setTimeout(() => {
        window.location.href = '/Public/auth/pages/login.html';
      }, 1000);
      return;
    }

    if (!auth.isOrganizer()) {
      Toast.error('Only organizers can access this page');
      setTimeout(() => {
        window.location.href = '/index.html';
      }, 1000);
      return;
    }

    events = await loadEvents();
    renderTable();
    prefillFromQuery();
  } catch (error) {
    console.error('Failed to initialize admin page:', error);
    Toast.error(`Error: ${error.message}`);
  }
})();
