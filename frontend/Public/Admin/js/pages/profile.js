// Remove imports and use global objects
// import { getUser, updateUser } from '../../js/services/auth.js';
// import { showToast } from '../../js/components/toast.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Table elements
  const userNameEl = document.getElementById('user-name');
  const userMobileEl = document.getElementById('user-mobile');
  const userEmailEl = document.getElementById('user-email');

  // Form elements
  const updateForm = document.getElementById('update-form');
  const mobileInput = document.getElementById('mobile');
  const emailInput = document.getElementById('email');

  // API Base URL
  const API_BASE = 'http://localhost:3000/api';

  // Check if user is logged in
  const token = (typeof CONFIG !== 'undefined' && CONFIG.STORAGE) 
    ? localStorage.getItem(CONFIG.STORAGE.TOKEN)
    : (localStorage.getItem('token') || localStorage.getItem('authToken') || localStorage.getItem('eventhub_token') || localStorage.getItem('auth_token'));

  if (!token || token === 'null' || token === 'undefined') {
    Toast.error('You must be logged in to view this page.');
    setTimeout(() => {
      window.location.href = '/';
    }, 1500);
    return;
  }

  // Fetch and display user data
  try {
    const response = await fetch(`${API_BASE}/auth/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      const user = data.user || data; // Handle { user: ... } or { ... }

      // Populate the table
      // Backend returns 'username' for getProfile, but 'name' might be used elsewhere
      userNameEl.textContent = user.username || user.name || 'N/A';
      userMobileEl.textContent = user.mobile || 'N/A';
      userEmailEl.textContent = user.email || 'N/A';

      // Populate the form
      mobileInput.value = user.mobile || '';
      emailInput.value = user.email || '';
    } else {
      if (response.status === 401) throw new Error('Session expired');
      throw new Error('Could not load user information');
    }
  } catch (error) {
    console.error('Error fetching user data:', error);
    Toast.error(`Error: ${error.message}`);
    setTimeout(() => {
      window.location.href = '/';
    }, 1500);
  }

  // Handle profile update
  updateForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const updatedData = {
      mobile: mobileInput.value,
      email: emailInput.value,
    };

    try {
      const response = await fetch(`${API_BASE}/auth/update-profile`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedData)
      });

      let result;
      try {
        result = await response.json();
      } catch (e) {
        result = { message: `Server Error: ${response.status}` };
      }

      if (response.ok) {
        Toast.success('Profile updated successfully!');
        const updatedUser = result.user || result;

        // Update the table with the new data from DB
        userNameEl.textContent = updatedUser.name || 'N/A';
        userMobileEl.textContent = updatedUser.mobile || 'N/A';
        userEmailEl.textContent = updatedUser.email || 'N/A';
      } else {
        throw new Error(result.message || 'Update failed');
      }
      
    } catch (error) {
      console.error('Error updating profile:', error);
      Toast.error(`Failed to update profile: ${error.message}`);
    }
  });
});
