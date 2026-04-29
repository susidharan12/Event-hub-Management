// API Configuration - dynamically set for any deployment
const API_URL = `http://13.203.105.12:3000/api`;

// Helper function to get JWT token
function getToken() {
  return localStorage.getItem('token');
}

// Helper function to get authorization headers
function getHeaders(includeAuth = false) {
  const headers = { 'Content-Type': 'application/json' };
  if (includeAuth) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return headers;
}

// Get all events with optional search/filter
export async function getEvents(params = {}) {
  try {
    const url = new URL(`${API_URL}/events`);
    // Safely append search parameters if they exist
    Object.keys(params).forEach(key => {
      if (params[key]) {
        url.searchParams.append(key, params[key]);
      }
    });

    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!response.ok) {
      // Try to parse the error body for a more descriptive message
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || 'Failed to fetch events');
    }

    // Return the full JSON response, which should be an object like { events: [], total: 0 }
    return await response.json();

  } catch (error) {
    console.error('Error fetching events:', error);
    // On error, return an object that matches the expected structure to prevent client-side errors
    return { events: [], total: 0 };
  }
}

// Get single event by ID
export async function getEventById(eventId) {
  try {
    const response = await fetch(`${API_URL}/events/${eventId}`, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!response.ok) {
      throw new Error('Event not found');
    }

    const data = await response.json();
    return data.event;
  } catch (error) {
    console.error('Error fetching event:', error);
    throw error;
  }
}

// Get available seats (calculated from event data)
export async function getAvailableSeats(eventId) {
  try {
    const event = await getEventById(eventId);
    return {
      available: event.available_seats,
      total: event.total_seats,
      booked: event.total_seats - event.available_seats
    };
  } catch (error) {
    console.error('Error fetching seats:', error);
    throw error;
  }
}

// Create a booking
export async function bookTickets(eventId, numberOfSeats, promoCode = '') {
  try {
    const response = await fetch(`${API_URL}/bookings`, {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify({
        event_id: eventId,
        number_of_seats: numberOfSeats,
        promo_code: promoCode
      })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Booking failed');
    }

    const data = await response.json();
    return {
      id: data.booking.id,
      message: 'Booking successful',
      booking: data.booking
    };
  } catch (error) {
    console.error('Error booking tickets:', error);
    throw error;
  }
}

// Get user bookings
export async function getUserBookings() {
  try {
    const response = await fetch(`${API_URL}/bookings`, {
      method: 'GET',
      headers: getHeaders(true)
    });

    if (!response.ok) {
      throw new Error('Failed to fetch bookings');
    }

    const data = await response.json();
    return data.bookings || [];
  } catch (error) {
    console.error('Error fetching bookings:', error);
    return [];
  }
}

// Get organizer analytics (requires organizer role)
export async function getOrganizerAnalytics(organizerId) {
  try {
    const response = await fetch(`${API_URL}/events?organizer=${organizerId}`, {
      method: 'GET',
      headers: getHeaders(true)
    });

    if (!response.ok) {
      throw new Error('Failed to fetch analytics');
    }

    const data = await response.json();
    const events = data.events || [];

    // Calculate analytics
    const totalRevenue = events.reduce((sum, event) => {
      const bookedSeats = event.total_seats - event.available_seats;
      return sum + (bookedSeats * event.ticket_price);
    }, 0);

    const totalRegistrations = events.reduce((sum, event) => {
      return sum + (event.total_seats - event.available_seats);
    }, 0);

    return {
      totalRevenue,
      totalRegistrations,
      totalEvents: events.length,
      noShowRate: 5 // Mock value
    };
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return {
      totalRevenue: 0,
      totalRegistrations: 0,
      totalEvents: 0,
      noShowRate: 0
    };
  }
}

// Check in to an event
export async function checkInToEvent(bookingId, qrCode = '') {
  try {
    const response = await fetch(`${API_URL}/bookings/${bookingId}/checkin`, {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify({ qr_code: qrCode })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Check-in failed');
    }

    const data = await response.json();
    return data.checkin;
  } catch (error) {
    console.error('Error checking in:', error);
    throw error;
  }
}

// Record a payment
export async function recordPayment(bookingId, paymentMethod, transactionId = '') {
  try {
    const response = await fetch(`${API_URL}/payments`, {
      method: 'POST',
      headers: getHeaders(true),
      body: JSON.stringify({
        booking_id: bookingId,
        payment_method: paymentMethod,
        transaction_id: transactionId
      })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Payment recording failed');
    }

    const data = await response.json();
    return data.payment;
  } catch (error) {
    console.error('Error recording payment:', error);
    throw error;
  }
}

