// Use the global API configuration and services
const API_URL = CONFIG.API.BASE_URL;

console.log('User Auth Service - API URL:', API_URL);

// Helper function to get JWT token
function getToken() {
  const token = localStorage.getItem(CONFIG.STORAGE.TOKEN);
  console.log('Token retrieved:', token ? 'Present' : 'Missing');
  return token;
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

export async function getUser() {
  try {
    const url = `${API_URL}/auth/profile`;
    const headerObj = getHeaders(true);
    console.log('Fetching user from:', url);
    console.log('Headers:', { ...headerObj, Authorization: headerObj.Authorization ? 'Bearer [token]' : 'None' });
    
    const response = await fetch(url, {
      method: 'GET',
      headers: headerObj
    });
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      if (response.status === 401) {
        // Token expired or invalid
        localStorage.removeItem(CONFIG.STORAGE.TOKEN);
        localStorage.removeItem(CONFIG.STORAGE.USER);
        throw new Error('Session expired. Please login again.');
      }
      const data = await response.json();
      throw new Error(data.error || 'Failed to fetch user data');
    }
    
    const data = await response.json();
    console.log('User data received:', data);
    return data.user;
  } catch (error) {
    console.error('Failed to get user:', error);
    throw error;
  }
}

export async function updateUser(userData) {
  try {
    const url = `${API_URL}/auth/profile`;
    const headerObj = getHeaders(true);
    console.log('Updating user at:', url);
    console.log('Update data:', userData);
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: headerObj,
      body: JSON.stringify(userData)
    });
    
    console.log('Update response status:', response.status);
    
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to update user');
    }
    
    const data = await response.json();
    console.log('Update response:', data);
    
    // Update localStorage with new user data using CONFIG keys
    const user = data.user;
    localStorage.setItem(CONFIG.STORAGE.USER, JSON.stringify(user));
    
    return user;
  } catch (error) {
    console.error('Failed to update user:', error);
    throw error;
  }
}