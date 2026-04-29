export function createEventCard(event) {
  const card = document.createElement('div');
  card.classList.add('event-card');
  
  // Create a formatted date string
  const eventDate = new Date(event.event_date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

  // Build correct image URL pointing to API server (port 3000)
  let imageUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjI1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkV2ZW50IEltYWdlPC90ZXh0Pjwvc3ZnPg==';
  if (event.image_url) {
    if (!event.image_url.startsWith('http')) {
      imageUrl = `http://13.203.105.12:3000${event.image_url}`;
    } else {
      imageUrl = event.image_url;
    }
  }
  
  console.log(`Event: ${event.title}, Image URL: ${imageUrl}`);

  card.innerHTML = `
    <img src="${imageUrl}" alt="${event.title}" class="event-image">
    <h2 class="event-title">${event.title}</h2>
    <div class="event-meta">${eventDate} | ${event.location}</div>
    <div class="event-price">₹${event.ticket_price}</div>
    <button class="btn btn-primary">View Details</button>
  `;

  // Add error handling for image loading
  const img = card.querySelector('img');
  img.onerror = function() {
    console.error(`Failed to load image for ${event.title} from ${imageUrl}`);
    this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjI1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkV2ZW50IEltYWdlPC90ZXh0Pjwvc3ZnPg==';
  };

  card.querySelector('button').addEventListener('click', () => {
    window.location.href = `/Public/User/pages/event-detail.html?id=${event.id}`;
  });

  return card;
}
