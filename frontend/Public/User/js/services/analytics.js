// Dynamically set API URL - works with backend on port 3000
const API_BASE = `${window.location.protocol}//${window.location.hostname}:3000/api`;

export async function getRevenueStats(organizerId, days = 30) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE}/analytics/revenue/${organizerId}?days=${days}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
}

export async function getNoShowRate(eventId) {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE}/events/${eventId}/no-show-rate`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
}
