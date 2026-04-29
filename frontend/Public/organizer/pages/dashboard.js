const API_BASE = 'http://localhost:3000/api';

function getToken() {
    return localStorage.getItem('auth_token') || localStorage.getItem('token') || localStorage.getItem('authToken') || localStorage.getItem('eventhub_token');
}

document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    loadDashboardStats();
    loadMyEvents();
    setupEventHandlers();
    setupProfileHandlers();
    // Pre-fetch the profile so the avatar in the navbar reflects the user
    // even before they open the Profile section.
    loadProfile().catch(() => {});
    if (window.lucide) lucide.createIcons();
});

function setupEventHandlers() {
    document.getElementById('event-form').addEventListener('submit', handleEventSave);
    document.getElementById('profile-image').addEventListener('change', function() { handleProfileImageChange(this); });
    document.getElementById('ev-files').addEventListener('change', function() { handleFileChange(this); });
    
    ['ev-title', 'ev-cat', 'ev-date', 'ev-loc', 'ev-price', 'ev-seats', 'ev-desc'].forEach(id => {
        document.getElementById(id).addEventListener('input', validateForm);
    });
    
    validateForm();
}

function validateForm() {
    const title = document.getElementById('ev-title').value.trim();
    const category = document.getElementById('ev-cat').value.trim();
    const date = document.getElementById('ev-date').value;
    const location = document.getElementById('ev-loc').value.trim();
    const price = document.getElementById('ev-price').value;
    const seats = document.getElementById('ev-seats').value;
    const description = document.getElementById('ev-desc').value.trim();
    const hasImage = document.getElementById('profile-image').files.length > 0;
    
    const isValid = title && category && date && location && price && seats && description && hasImage;
    
    document.getElementById('preview-btn').disabled = !isValid;
    document.getElementById('create-btn').disabled = !isValid;
}

function checkAuth() {
    const token = getToken();
    if (!token) {
        window.location.href = '/Public/auth/pages/login.html';
        return;
    }
    
    const userStr = localStorage.getItem('auth_user') || localStorage.getItem('user');
    if (userStr) {
        try {
            const user = JSON.parse(userStr);
            const displayName = user.name || user.username || 'Organizer';
            document.getElementById('top-username').textContent = displayName;
            document.getElementById('drop-username').textContent = displayName;
            document.getElementById('top-email').textContent = user.email || '';
            document.getElementById('drop-email').textContent = user.email || '';
            document.getElementById('user-initials').textContent = displayName.charAt(0).toUpperCase();
        } catch (e) {
            console.error('User parsing error', e);
        }
    }
}

function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(`${sectionId}-section`);
    if (target) target.classList.add('active');

    document.querySelectorAll('.sidebar-menu a').forEach(el => el.classList.remove('active'));
    const navItem = document.getElementById(`nav-${sectionId}`);
    if (navItem) navItem.classList.add('active');

    const dropdown = document.getElementById('profile-dropdown');
    if (dropdown) dropdown.classList.remove('active');

    if (sectionId === 'events') loadMyEvents();
    if (sectionId === 'dashboard') loadDashboardStats();
    if (sectionId === 'profile') loadProfile().catch(() => {});
    if (sectionId === 'messages') loadMessageThreads();

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleDropdown() {
    document.getElementById('profile-dropdown').classList.toggle('active');
}

function logout() {
    localStorage.clear();
    window.location.href = '/index.html';
}

async function loadDashboardStats() {
    const token = getToken();
    try {
        const response = await fetch(`${API_BASE}/events/my-events`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const events = await response.json();
            document.getElementById('stat-events').textContent = Array.isArray(events) ? events.length : 0;
        }
    } catch (error) {
        console.error('Error loading stats:', error);
        document.getElementById('stat-events').textContent = '0';
    }
}

// Cache the latest list of organizer events so the details modal doesn't need
// a second fetch when the user clicks a row.
let myEventsCache = [];

async function loadMyEvents() {
    const container = document.getElementById('events-list-container');
    const token = getToken();

    container.innerHTML = '<p>Loading your events…</p>';

    try {
        const response = await fetch(`${API_BASE}/events/my-events`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            container.innerHTML = '<p style="color:red">Failed to load events</p>';
            return;
        }

        const events = await response.json();
        myEventsCache = Array.isArray(events) ? events : [];

        if (myEventsCache.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>No events yet</h3>
                    <p>Create your first event to get started.</p>
                    <button onclick="showSection('create')" class="btn btn-primary"><i class="fas fa-plus"></i> Create Event</button>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table class="events-table">
                <thead>
                    <tr>
                        <th>Title</th>
                        <th>Date</th>
                        <th>Venue</th>
                        <th>City</th>
                        <th>Price</th>
                        <th style="text-align:center;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${myEventsCache.map(ev => {
                        const dateStr = ev.event_date ? new Date(ev.event_date).toLocaleDateString() : '—';
                        const price = Number(ev.ticket_price) || 0;
                        return `
                            <tr data-event-id="${ev.id}" title="Click for details">
                                <td><strong>${escapeOrg(ev.title || 'Untitled')}</strong></td>
                                <td>${escapeOrg(dateStr)}</td>
                                <td>${escapeOrg(ev.location || '—')}</td>
                                <td>${escapeOrg(ev.place || '—')}</td>
                                <td>${price > 0 ? '₹' + price : 'Free'}</td>
                                <td style="text-align:center; white-space: nowrap;">
                                    <button class="org-row-edit"   data-event-id="${ev.id}" style="background:rgba(99,102,241,0.1); color:#6366f1; border:1px solid rgba(99,102,241,0.25); padding:6px 12px; border-radius:8px; font-weight:600; cursor:pointer; margin-right:6px;">
                                        <i class="fas fa-pen"></i> Edit
                                    </button>
                                    <button class="org-row-delete" data-event-id="${ev.id}" style="background:rgba(239,68,68,0.08); color:#ef4444; border:1px solid rgba(239,68,68,0.25); padding:6px 12px; border-radius:8px; font-weight:600; cursor:pointer;">
                                        <i class="fas fa-trash"></i> Delete
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;

        // Wire up row clicks (open details) and per-row buttons.
        container.querySelectorAll('tr[data-event-id]').forEach(tr => {
            tr.addEventListener('click', (e) => {
                if (e.target.closest('button')) return; // buttons handle themselves
                const id = parseInt(tr.dataset.eventId, 10);
                const ev = myEventsCache.find(x => x.id === id);
                if (ev) openEventDetails(ev);
            });
        });
        container.querySelectorAll('.org-row-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.eventId, 10);
                const ev = myEventsCache.find(x => x.id === id);
                if (ev) setEditMode(ev);
            });
        });
        container.querySelectorAll('.org-row-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.eventId, 10);
                deleteEvent(id);
            });
        });
    } catch (error) {
        console.error('Error fetching events:', error);
        container.innerHTML = '<p style="color:red">Failed to load events</p>';
    }
}

function escapeOrg(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// ───────── Event details modal (View / Edit / Delete) ─────────
function openEventDetails(ev) {
    const modal = document.getElementById('ev-detail-modal');
    if (!modal) return;

    document.getElementById('evd-title').textContent    = ev.title || 'Untitled event';
    document.getElementById('evd-category').textContent = ev.category || 'Event';
    document.getElementById('evd-date').textContent     = ev.event_date
        ? new Date(ev.event_date).toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : 'TBD';
    document.getElementById('evd-loc').textContent      = ev.location || '—';
    document.getElementById('evd-place').textContent    = ev.place || '—';
    const price = Number(ev.ticket_price) || 0;
    document.getElementById('evd-price').textContent    = price > 0 ? '₹' + price : 'Free';
    document.getElementById('evd-seats').textContent    = `${ev.available_seats ?? ev.total_seats ?? '—'} / ${ev.total_seats ?? '—'}`;
    document.getElementById('evd-desc').textContent     = ev.description || 'No description provided.';

    const cover = document.getElementById('evd-cover');
    if (ev.image_url) {
        cover.src = ev.image_url.startsWith('http') ? ev.image_url : `${SERVER_URL}${ev.image_url}`;
        cover.style.display = 'block';
    } else {
        cover.removeAttribute('src');
        cover.style.display = 'none';
    }

    const mapEl = document.getElementById('evd-map');
    const mapBtn = document.getElementById('evd-map-btn');
    if (ev.map_url) {
        mapEl.href = ev.map_url;
        mapEl.textContent = ev.map_url;
        mapBtn.href = ev.map_url;
        mapBtn.style.display = '';
    } else {
        mapEl.removeAttribute('href');
        mapEl.textContent = 'Not provided';
        mapBtn.style.display = 'none';
    }

    // Wire up actions for THIS event.
    document.getElementById('evd-edit-btn').onclick = () => { closeEventDetails(); setEditMode(ev); };
    document.getElementById('evd-delete-btn').onclick = () => { closeEventDetails(); deleteEvent(ev.id); };
    document.getElementById('evd-close-btn').onclick = closeEventDetails;
    modal.onclick = (e) => { if (e.target === modal) closeEventDetails(); };

    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeEventDetails() {
    const modal = document.getElementById('ev-detail-modal');
    if (modal) modal.classList.remove('show');
    document.body.style.overflow = '';
}

function handleEventSave(e) {
    e.preventDefault();

    const title = document.getElementById('ev-title').value.trim();
    const category = document.getElementById('ev-cat').value.trim();
    const date = document.getElementById('ev-date').value;
    const location = document.getElementById('ev-loc').value.trim();
    const price = document.getElementById('ev-price').value;
    const seats = document.getElementById('ev-seats').value;
    const description = document.getElementById('ev-desc').value.trim();
    const hasImage = document.getElementById('profile-image').files.length > 0;

    if (!title || !category || !date || !location || !price || !seats || !description || !hasImage) {
        alert('Please fill all required fields including profile image');
        return;
    }

    // The "Save Event" button (the form submit) is the primary create action.
    // Forward to createEvent() so submitting actually persists the event.
    createEvent();
}

function handleProfileImageChange(input) {
    const file = input.files[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB');
            input.value = '';
            validateForm();
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('profile-preview').innerHTML = `<img src="${e.target.result}" alt="Preview" style="width:100%; height:100%; object-fit:cover;">`;
        };
        reader.readAsDataURL(file);
    }
    validateForm();
}

function handleFileChange(input) {
    const files = Array.from(input.files).slice(0, 10);
    const container = document.getElementById('images-row');
    container.innerHTML = '';
    
    files.forEach(file => {
        if (file.size > 5 * 1024 * 1024) {
            alert(`File ${file.name} is too large`);
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const div = document.createElement('div');
            div.className = 'image-item';
            div.innerHTML = `<img src="${e.target.result}" style="width:120px; height:80px; object-fit:cover; border-radius:8px;">`;
            container.appendChild(div);
        };
        reader.readAsDataURL(file);
    });
}

function previewEvent() {
    const title = document.getElementById('ev-title').value;
    const date = document.getElementById('ev-date').value;
    const location = document.getElementById('ev-loc').value;
    const price = document.getElementById('ev-price').value;
    const seats = document.getElementById('ev-seats').value;
    const description = document.getElementById('ev-desc').value;
    const profileImg = document.getElementById('profile-preview').querySelector('img');
    
    document.getElementById('preview-title').textContent = title;
    document.getElementById('preview-date').textContent = new Date(date).toLocaleDateString();
    document.getElementById('preview-location').textContent = location;
    document.getElementById('preview-price').textContent = `₹${price}`;
    document.getElementById('preview-seats').textContent = seats;
    document.getElementById('preview-description').textContent = description;
    
    if (profileImg) {
        document.getElementById('preview-image').src = profileImg.src;
        document.getElementById('preview-image').style.display = 'block';
    }
    
    document.getElementById('event-preview').style.display = 'block';
    document.getElementById('event-preview').scrollIntoView({ behavior: 'smooth' });
    
    lucide.createIcons();
}

// Edit-mode state. When set, the form submits a PUT to /api/events/:id
// instead of creating a new event.
let editingEventId = null;

function setEditMode(event) {
    // Pre-fill the form from the given event row, switch UI to "Update event".
    editingEventId = event.id;
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
    setVal('ev-title', event.title);
    setVal('ev-cat', event.category);
    setVal('ev-date', event.event_date ? new Date(event.event_date).toISOString().slice(0, 16) : '');
    setVal('ev-loc', event.location);
    setVal('ev-place', event.place);
    setVal('ev-map', event.map_url);
    setVal('ev-price', event.ticket_price);
    setVal('ev-seats', event.total_seats);
    setVal('ev-desc', event.description);

    // Show existing cover image as preview (without re-uploading).
    const cover = event.image_url ? `${SERVER_URL}${event.image_url}` : null;
    if (cover) {
        document.getElementById('profile-preview').innerHTML = `<img src="${cover}" alt="Cover" style="width:100%;height:100%;object-fit:cover;">`;
    }

    // Update headings + button labels.
    const formTitle = document.getElementById('form-title');
    if (formTitle) formTitle.textContent = 'Edit event';
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-floppy-disk"></i> Update event';
    const createBtn = document.getElementById('create-btn');
    if (createBtn) {
        createBtn.innerHTML = '<i class="fas fa-rotate"></i> Save changes';
        createBtn.disabled = false;
    }
    const previewBtn = document.getElementById('preview-btn');
    if (previewBtn) previewBtn.disabled = false;

    showSection('create');
}

function clearEditMode() {
    editingEventId = null;
    const formTitle = document.getElementById('form-title');
    if (formTitle) formTitle.textContent = 'Create New Event';
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) saveBtn.innerHTML = '<i class="fas fa-floppy-disk"></i> Save Event';
    const createBtn = document.getElementById('create-btn');
    if (createBtn) createBtn.innerHTML = '<i class="fas fa-plus-circle"></i> Create Event';
}

async function createEvent() {
    const token = getToken();
    const isEdit = !!editingEventId;
    const btn = document.getElementById('create-btn');

    btn.disabled = true;
    btn.innerHTML = isEdit ? 'Saving…' : 'Creating…';

    const formData = new FormData();
    formData.append('title',        document.getElementById('ev-title').value.trim());
    formData.append('category',     document.getElementById('ev-cat').value.trim());
    formData.append('event_date',   document.getElementById('ev-date').value);
    formData.append('location',     document.getElementById('ev-loc').value.trim());
    formData.append('ticket_price', document.getElementById('ev-price').value);
    formData.append('total_seats',  document.getElementById('ev-seats').value);
    formData.append('description',  document.getElementById('ev-desc').value.trim());

    // New optional fields.
    const placeEl = document.getElementById('ev-place');
    const mapEl   = document.getElementById('ev-map');
    if (placeEl && placeEl.value.trim()) formData.append('place',   placeEl.value.trim());
    if (mapEl   && mapEl.value.trim())   formData.append('map_url', mapEl.value.trim());

    const profileImage = document.getElementById('profile-image').files[0];
    if (profileImage) formData.append('image', profileImage);

    const additionalImages = document.getElementById('ev-files').files;
    for (let i = 0; i < additionalImages.length; i++) {
        formData.append('images', additionalImages[i]);
    }

    try {
        const url    = isEdit ? `${API_BASE}/events/${editingEventId}` : `${API_BASE}/events`;
        const method = isEdit ? 'PUT' : 'POST';
        const response = await fetch(url, {
            method,
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            const title = (result.event && result.event.title) || result.title || 'Event';
            (window.Popup && window.Popup.success)
                ? window.Popup.success(isEdit ? `“${title}” updated successfully` : `Event “${title}” created successfully`)
                : alert(isEdit ? 'Event updated' : `Event "${title}" created successfully!`);
            document.getElementById('event-form').reset();
            document.getElementById('profile-preview').innerHTML =
                `<div class="profile-placeholder"><i class="fas fa-image" style="font-size:2rem"></i><span>Event Cover</span></div>`;
            document.getElementById('images-row').innerHTML = '';
            document.getElementById('event-preview').style.display = 'none';
            clearEditMode();
            validateForm();
            loadDashboardStats();
            showSection('events');
        } else {
            (window.Popup && window.Popup.error)
                ? window.Popup.error(result.error || (isEdit ? 'Failed to update event' : 'Failed to create event'))
                : alert(`Error: ${result.error}`);
        }
    } catch (error) {
        (window.Popup && window.Popup.error)
            ? window.Popup.error(isEdit ? 'Failed to update event' : 'Failed to create event')
            : alert(isEdit ? 'Failed to update event' : 'Failed to create event');
    } finally {
        btn.disabled = false;
        btn.innerHTML = editingEventId
            ? '<i class="fas fa-rotate"></i> Save changes'
            : '<i class="fas fa-plus-circle"></i> Create Event';
        if (window.lucide && window.lucide.createIcons) lucide.createIcons();
    }
}

async function deleteEvent(eventId) {
    const ok = (window.Popup && window.Popup.confirm)
        ? await window.Popup.confirm('This event will be permanently removed and any bookings will lose their reference. This cannot be undone.', {
            title: 'Delete this event?',
            okLabel: 'Yes, delete',
            cancelLabel: 'Keep it',
            type: 'error'
          })
        : window.confirm('Are you sure you want to delete this event?');
    if (!ok) return;

    const token = getToken();
    try {
        const response = await fetch(`${API_BASE}/events/${eventId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            (window.Popup && window.Popup.success)
                ? window.Popup.success('Event deleted successfully')
                : alert('Event deleted successfully!');
            loadMyEvents();
            loadDashboardStats();
        } else {
            (window.Popup && window.Popup.error)
                ? window.Popup.error('Failed to delete event')
                : alert('Failed to delete event');
        }
    } catch (error) {
        (window.Popup && window.Popup.error)
            ? window.Popup.error('Network error while deleting event')
            : alert('Error deleting event');
    }
}

window.showSection = showSection;
window.toggleDropdown = toggleDropdown;
window.logout = logout;
window.previewEvent = previewEvent;
window.createEvent = createEvent;
window.deleteEvent = deleteEvent;

// ───────── Profile (fetch / update / avatar upload) ─────────
const SERVER_URL = 'http://localhost:3000';
let cachedUserRole = null;

function setAvatarImage(url) {
    const initialEl = document.getElementById('user-initials');
    const profAvatar = document.getElementById('prof-avatar');
    const profInitial = document.getElementById('prof-avatar-initial');
    if (!initialEl || !profAvatar) return;

    if (url) {
        const full = url.startsWith('http') ? url : SERVER_URL + url;
        initialEl.innerHTML = `<img src="${full}" alt="Avatar">`;
        // Replace just the initial node inside the big avatar (preserve the camera button + file input).
        if (profInitial) {
            profInitial.outerHTML = `<img id="prof-avatar-initial" src="${full}" alt="Avatar">`;
        } else {
            const img = profAvatar.querySelector('img#prof-avatar-initial');
            if (img) img.src = full;
        }
    }
}

function setAvatarInitial(letter) {
    const initialEl = document.getElementById('user-initials');
    const profInitial = document.getElementById('prof-avatar-initial');
    if (initialEl && !initialEl.querySelector('img')) initialEl.textContent = letter;
    if (profInitial && profInitial.tagName === 'SPAN') profInitial.textContent = letter;
}

async function loadProfile() {
    const token = getToken();
    if (!token) return;
    try {
        const res = await fetch(`${API_BASE}/auth/profile`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;
        const u = await res.json();
        cachedUserRole = u.role || null;

        // Header / dropdown
        const display = u.name || u.username || 'Organizer';
        const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v || ''; };
        setText('top-username', display);
        setText('drop-username', display);
        setText('top-email', u.email || '');
        setText('drop-email', u.email || '');
        setAvatarInitial((display.charAt(0) || 'U').toUpperCase());
        if (u.profile_image) setAvatarImage(u.profile_image);

        // Profile section header card
        setText('prof-display-name', display);
        setText('prof-display-email', u.email || '');
        setText('prof-display-role', (u.role || 'user').toUpperCase());

        // Personal form fields
        const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
        setVal('prof-name', u.name);
        setVal('prof-email', u.email);
        setVal('prof-mobile', u.mobile);
        setVal('prof-role', u.role);
        setVal('prof-address', u.address);

        // Org block — only for organizers
        const orgBlock = document.getElementById('prof-org-block');
        if (u.role === 'organizer') {
            if (orgBlock) orgBlock.style.display = '';
            setVal('prof-org-name', u.organization_name);
            setVal('prof-org-phone', u.organization_phone);
            setVal('prof-org-address', u.organization_address);
            setVal('prof-org-website', u.organization_website);
            setVal('prof-org-description', u.organization_description);
        } else if (orgBlock) {
            orgBlock.style.display = 'none';
        }

        // Keep localStorage roughly in sync (other pages may read from it).
        try {
            const cached = JSON.parse(localStorage.getItem('auth_user') || localStorage.getItem('user') || '{}');
            const merged = Object.assign(cached, {
                id: u.id, name: u.name, email: u.email, mobile: u.mobile,
                role: u.role, profile_image: u.profile_image
            });
            localStorage.setItem('auth_user', JSON.stringify(merged));
        } catch (_) {}
    } catch (err) {
        console.warn('Failed to load profile', err);
    }
}

function setupProfileHandlers() {
    const form = document.getElementById('profile-form');
    if (form) form.addEventListener('submit', saveProfile);

    const fileInput = document.getElementById('prof-avatar-input');
    if (fileInput) fileInput.addEventListener('change', handleAvatarChange);
}

async function saveProfile(e) {
    e.preventDefault();
    const token = getToken();
    const btn = document.getElementById('prof-save-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…'; }

    const payload = {
        name: document.getElementById('prof-name').value.trim(),
        email: document.getElementById('prof-email').value.trim(),
        mobile: document.getElementById('prof-mobile').value.trim(),
        address: document.getElementById('prof-address').value.trim()
    };
    if (cachedUserRole === 'organizer') {
        payload.organization_name = document.getElementById('prof-org-name').value.trim();
        payload.organization_phone = document.getElementById('prof-org-phone').value.trim();
        payload.organization_address = document.getElementById('prof-org-address').value.trim();
        payload.organization_website = document.getElementById('prof-org-website').value.trim();
        payload.organization_description = document.getElementById('prof-org-description').value.trim();
    }

    try {
        const res = await fetch(`${API_BASE}/auth/update-profile`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
            alert(data.message || 'Profile updated successfully');
            await loadProfile();
        } else {
            alert(data.message || 'Update failed');
        }
    } catch (err) {
        alert('Network error while saving profile');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-floppy-disk"></i> Save Changes'; }
    }
}

async function handleAvatarChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5 MB'); e.target.value = ''; return; }

    // Optimistic local preview
    const reader = new FileReader();
    reader.onload = ev => setAvatarImage(ev.target.result);
    reader.readAsDataURL(file);

    const token = getToken();
    const fd = new FormData();
    fd.append('avatar', file);
    try {
        const res = await fetch(`${API_BASE}/auth/upload-avatar`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: fd
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.profile_image) {
            setAvatarImage(data.profile_image);
        } else {
            alert(data.message || 'Avatar upload failed');
        }
    } catch (err) {
        alert('Network error while uploading avatar');
    } finally {
        e.target.value = '';
    }
}

window.loadProfile = loadProfile;
window.saveProfile = saveProfile;

// ───────── Messages section (inline thread list) ─────────
function presence(lastSeenIso) {
    if (!lastSeenIso) return { online: false, label: 'Offline' };
    const t = new Date(lastSeenIso).getTime();
    if (isNaN(t)) return { online: false, label: 'Offline' };
    const diffSec = (Date.now() - t) / 1000;
    if (diffSec < 60)    return { online: true,  label: 'Online' };
    if (diffSec < 3600)  return { online: false, label: 'Last seen ' + Math.floor(diffSec / 60)   + 'm ago' };
    if (diffSec < 86400) return { online: false, label: 'Last seen ' + Math.floor(diffSec / 3600) + 'h ago' };
    return { online: false, label: 'Last seen ' + Math.floor(diffSec / 86400) + 'd ago' };
}
function relTimeOrg(iso) {
    if (!iso) return '';
    const d = new Date(iso); if (isNaN(d)) return '';
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60)     return 'just now';
    if (diff < 3600)   return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400)  return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return d.toLocaleDateString();
}
function escOrg(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function initialsOrg(name) {
    if (!name) return '?';
    const p = String(name).trim().split(/\s+/);
    return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase();
}

let _msgPollTimer = null;

async function loadMessageThreads() {
    const list    = document.getElementById('msg-thread-list');
    const summary = document.getElementById('msg-summary');
    if (!list) return;
    const token = getToken();
    if (!token) return;
    try {
        const res = await fetch(`${API_BASE}/messages/threads`, {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        const threads = data.threads || [];

        if (threads.length === 0) {
            if (summary) summary.textContent = 'No conversations yet.';
            list.innerHTML = `
                <div class="msg-empty">
                    <i class="fas fa-comments"></i>
                    <h3>No messages yet</h3>
                    <p>Once attendees of your events message you, threads appear here.</p>
                </div>`;
            return;
        }

        const totalUnread = threads.reduce((s, t) => s + (t.unread || 0), 0);
        if (summary) {
            summary.innerHTML = `Showing <b>${threads.length}</b> conversation${threads.length === 1 ? '' : 's'}`
                + (totalUnread > 0 ? ` · <span style="color:var(--danger);font-weight:700;">${totalUnread} unread</span>` : '');
        }

        list.innerHTML = threads.map(t => {
            const ava = t.other_avatar
                ? `<img src="${escOrg(t.other_avatar.startsWith('http') ? t.other_avatar : SERVER_URL + t.other_avatar)}" alt="">`
                : escOrg(initialsOrg(t.other_name));
            const pres = presence(t.other_last_seen);
            const previewPrefix = (t.last_sender_id === (cachedUser && cachedUser.id)) ? '<b>You:</b> ' : '';
            return `
                <div class="msg-thread-row"
                     data-event-id="${t.event_id}" data-other-id="${t.other_id}"
                     data-event-title="${escOrg(t.event_title)}"
                     data-other-name="${escOrg(t.other_name)}"
                     data-other-avatar="${escOrg(t.other_avatar || '')}"
                     data-other-last-seen="${escOrg(t.other_last_seen || '')}">
                    <div class="ava">
                        ${ava}
                        <span class="pdot ${pres.online ? 'online' : ''}" title="${escOrg(pres.label)}"></span>
                    </div>
                    <div class="meta">
                        <div class="top">
                            <span class="name">${escOrg(t.other_name)}</span>
                            <span class="when">${escOrg(relTimeOrg(t.last_at))}</span>
                        </div>
                        <div class="preview">${previewPrefix}${escOrg(t.last_body || '—')}</div>
                        <div class="below">
                            <span class="ev"><i class="fas fa-calendar-day"></i> ${escOrg(t.event_title)}</span>
                            <span class="pres ${pres.online ? 'online' : ''}" style="margin-left:auto;">${pres.online ? '● Online' : escOrg(pres.label)}</span>
                        </div>
                    </div>
                    ${t.unread > 0 ? `<span class="pill">${t.unread}</span>` : ''}
                </div>`;
        }).join('');

        // Wire row clicks → open the chat widget pre-filled with this thread.
        list.querySelectorAll('.msg-thread-row').forEach(row => {
            row.addEventListener('click', () => {
                if (window.EHChat && window.EHChat.openThread) {
                    window.EHChat.openThread({
                        eventId:       parseInt(row.dataset.eventId, 10),
                        otherId:       parseInt(row.dataset.otherId, 10),
                        eventTitle:    row.dataset.eventTitle,
                        otherName:     row.dataset.otherName,
                        otherAvatar:   row.dataset.otherAvatar,
                        otherLastSeen: row.dataset.otherLastSeen
                    });
                }
            });
        });
    } catch (err) {
        console.warn('Failed to load message threads', err);
        if (summary) summary.textContent = 'Couldn\'t load messages.';
    }
}

// Track the cached user id for "You: …" preview detection above.
let cachedUser = null;
(function loadCachedUser() {
    try {
        cachedUser = JSON.parse(localStorage.getItem('auth_user') || localStorage.getItem('user') || 'null');
    } catch (_) { cachedUser = null; }
})();

// Refresh the thread list every 6s while the Messages section is visible.
function startMessagesPolling() {
    stopMessagesPolling();
    _msgPollTimer = setInterval(() => {
        const sec = document.getElementById('messages-section');
        if (sec && sec.classList.contains('active')) loadMessageThreads();
    }, 6000);
}
function stopMessagesPolling() {
    if (_msgPollTimer) { clearInterval(_msgPollTimer); _msgPollTimer = null; }
}
startMessagesPolling();

// Refresh button
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('msg-refresh-btn');
    if (btn) btn.addEventListener('click', loadMessageThreads);
});

// Live unread badge on the sidebar Messages link.
window.addEventListener('eh-chat-unread', (e) => {
    const n = (e.detail && e.detail.unread) || 0;
    const badge = document.getElementById('nav-messages-badge');
    if (!badge) return;
    if (n > 0) {
        badge.textContent = n > 99 ? '99+' : String(n);
        badge.classList.add('show');
    } else {
        badge.classList.remove('show');
    }
    // If section is visible, refresh the list silently when unread count changes.
    const sec = document.getElementById('messages-section');
    if (sec && sec.classList.contains('active') && n > 0) loadMessageThreads();
});