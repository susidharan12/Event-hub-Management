const API_BASE = 'http://localhost:3000/api';

document.addEventListener('DOMContentLoaded', () => {
    console.log("Profile Page Loaded. Fetching data...");
    fetchUserProfile();
    setupUpdateForm();
});

// 1. Fetch User Details from Database
async function fetchUserProfile() {
    const token = localStorage.getItem('token') || 
                  localStorage.getItem('authToken') || 
                  localStorage.getItem('eventhub_token') ||
                  localStorage.getItem('auth_token') ||
                  (typeof CONFIG !== 'undefined' && CONFIG.STORAGE ? localStorage.getItem(CONFIG.STORAGE.TOKEN) : null);
    
    if (!token || token === 'null' || token === 'undefined') {
        console.error("No token found in localStorage");
        window.location.href = '/Public/auth/pages/login.html'; 
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/auth/profile`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        console.log("Response Status:", response.status);

        if (response.ok) {
            const user = await response.json();
            console.log("User Data Received:", user); // Check your console (F12) to see the keys

            // Update the UI Text (Display)
            document.getElementById('user-name').textContent = user.username || user.name || user.full_name || 'N/A';
            document.getElementById('user-mobile').textContent = user.mobile || user.phone || 'Not set';
            document.getElementById('user-email').textContent = user.email || 'N/A';
            document.getElementById('user-category').textContent = user.role || 'User';

            // Pre-fill the Form Inputs
            document.getElementById('mobile').value = user.mobile || user.phone || '';
            document.getElementById('email').value = user.email || '';
            
            lucide.createIcons();
        } else {
            // Try to log backend error body
            try {
                const errorData = await response.json();
                console.error("Backend Error:", errorData);
            } catch (e) {
                console.error("Backend Error (Non-JSON):", response.status, response.statusText);
            }

            // If unauthorized, do not immediately clear session — show cached profile instead
            if (response.status === 401 || response.status === 403) {
                console.warn('Auth error fetching profile. Showing cached user data (if available).');
                // Attempt to show cached user from various keys
                const cached = localStorage.getItem('user') || localStorage.getItem('auth_user') || localStorage.getItem('authUser') || (typeof CONFIG !== 'undefined' && CONFIG.STORAGE ? localStorage.getItem(CONFIG.STORAGE.USER) : null);
                if (cached) {
                    try {
                        const user = JSON.parse(cached);
                        document.getElementById('user-name').textContent = user.username || user.name || user.full_name || 'N/A';
                        document.getElementById('user-mobile').textContent = user.mobile || user.phone || 'Not set';
                        document.getElementById('user-email').textContent = user.email || 'N/A';
                        document.getElementById('mobile').value = user.mobile || '';
                        document.getElementById('email').value = user.email || '';
                        document.getElementById('user-category').textContent = user.role || 'User';
                    } catch (e) {
                        console.error('Failed to parse cached user:', e);
                    }
                } else {
                    console.warn('No cached user found; redirecting to login.');
                    // Only redirect if nothing useful to show
                    window.location.href = '/Public/auth/pages/login.html';
                }
            }
        }
    } catch (error) {
        console.error("Connection Error:", error);
        document.getElementById('user-category').textContent = "OFFLINE";
        showModal("Connection Error", "Could not connect to the backend server at " + API_BASE);
    }
}

// 2. Handle Profile Update
function setupUpdateForm() {
    const form = document.getElementById('update-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token') || 
                      localStorage.getItem('authToken') || 
                      localStorage.getItem('eventhub_token') ||
                      localStorage.getItem('auth_token') ||
                      (typeof CONFIG !== 'undefined' && CONFIG.STORAGE ? localStorage.getItem(CONFIG.STORAGE.TOKEN) : null);
        
        const updatedData = {
            mobile: document.getElementById('mobile').value,
            email: document.getElementById('email').value
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

            if (response.ok) {
                showModal("Success", "Your profile has been updated successfully.");
                fetchUserProfile(); 
            } else {
                let errorMsg = "Something went wrong.";
                try {
                    const error = await response.json();
                    errorMsg = error.message || errorMsg;
                } catch (e) {
                    errorMsg = `Server Error: ${response.status}`;
                }
                showModal("Update Failed", errorMsg);
            }
        } catch (error) {
            showModal("Error", "Connection lost. Please try again.");
        }
    });
}

// 3. Modal Helper
function showModal(title, message) {
    const modal = document.getElementById('modal');
    if (!modal) {
        alert(title + ": " + message);
        return;
    }
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-message').textContent = message;
    
    modal.style.display = 'flex';
    
    document.getElementById('modal-confirm').onclick = () => {
        modal.style.display = 'none';
    };
}