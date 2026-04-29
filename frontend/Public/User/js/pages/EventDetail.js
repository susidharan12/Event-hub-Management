document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get('id');
  
  if (!eventId) {
    window.location.href = '/frontend/pages/index.html'; // Assuming this is the correct home page
    return;
  }

  const eventCoverImage = document.getElementById('event-cover-image');
  const eventName = document.getElementById('event-name');
  const eventCategory = document.getElementById('event-category');
  const eventSeatingCapacity = document.getElementById('event-seating-capacity');
  const eventDateTime = document.getElementById('event-date-time');
  const eventLocation = document.getElementById('event-location');
  const eventDescription = document.getElementById('event-description');
  const bookTicketsBtn = document.getElementById('book-tickets-btn');

  let currentEvent;

  async function loadEvent() {
    try {
      const response = await fetch(`http://13.203.105.12:3000/api/events/${eventId}`);
      const data = await response.json();
      currentEvent = data.event || data;
      console.log('Event data:', currentEvent);
      
      // Build correct image URL pointing to API server (port 3000)
      let imageUrl = 'https://via.placeholder.com/600x400?text=No+Image';
      if (currentEvent.image_url) {
        if (!currentEvent.image_url.startsWith('http')) {
          imageUrl = `http://13.203.105.12:3000${currentEvent.image_url}`;
        } else {
          imageUrl = currentEvent.image_url;
        }
      }
      console.log('Image URL being used:', imageUrl);
      
      eventCoverImage.src = imageUrl;
      eventCoverImage.onerror = function() {
        console.error('Failed to load image from:', imageUrl);
        this.src = 'https://via.placeholder.com/600x400?text=No+Image';
      };
      
      if (currentEvent) {
        eventName.textContent = currentEvent.title || 'N/A';
        eventCategory.textContent = currentEvent.category || 'N/A';
        eventSeatingCapacity.textContent = currentEvent.total_seats || 'N/A';
        eventDateTime.textContent = currentEvent.event_date ? `${new Date(currentEvent.event_date).toLocaleDateString()} at ${new Date(currentEvent.event_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'N/A';
        eventLocation.textContent = currentEvent.location || 'N/A';
        eventDescription.textContent = currentEvent.description || 'N/A';
      }

      // Button click handler moved outside try block

    } catch (error) {
      console.error('Failed to load event details:', error);
      console.error('Failed to load event details:', error);
      alert('Event not found or failed to load details.');
    }
  }
  
  // Add button click handler regardless of API success/failure
  if (bookTicketsBtn) {
    console.log('Book tickets button found, adding click handler');
    bookTicketsBtn.style.cursor = 'pointer';
    bookTicketsBtn.onclick = function(e) {
      e.preventDefault();
      console.log('Book tickets button clicked, redirecting to booking.html with eventId:', eventId);
      window.location.href = `booking.html?eventId=${eventId}`;
      return false;
    };
  } else {
    console.error('Book tickets button not found!');
  }
  
  loadEvent();
});
