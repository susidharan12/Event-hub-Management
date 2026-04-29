const form = document.getElementById('payment-form');
const msgEl = document.getElementById('payment-msg');
const paymentsTbody = document.getElementById('payments-tbody');

const STORAGE_KEY = 'eventhub-admin-payment';
const RECORDS_STORAGE_KEY = 'eventhub-admin-payment-records';

// Pre-fill if data exists and update form title
(function prefill() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const formTitle = document.querySelector('.panel h2');
  const submitBtn = document.querySelector('button[type="submit"]');
  
  if (saved) {
    const data = JSON.parse(saved);
    
    document.getElementById('acc-name').value = data.accountName || '';
    document.getElementById('bank-name').value = data.bankName || '';
    document.getElementById('acc-number').value = data.accountNumber || '';
    document.getElementById('ifsc').value = data.ifsc || '';
    document.getElementById('branch-id').value = data.branchId || '';
    document.getElementById('upi-id').value = data.upiId || '';
    
    // Update UI for update mode
    if (formTitle) formTitle.textContent = 'Update Payment Details';
    if (submitBtn) submitBtn.textContent = 'Update Payment Details';
  } else {
    // Ensure UI is in add mode
    if (formTitle) formTitle.textContent = 'Payment Setup';
    if (submitBtn) submitBtn.textContent = 'Save Payment Details';
  }
})();

// Load and display payment records
function loadPaymentRecords() {
  const records = localStorage.getItem(RECORDS_STORAGE_KEY);
  const paymentRecords = records ? JSON.parse(records) : [];
  
  paymentsTbody.innerHTML = '';
  
  if (paymentRecords.length === 0) {
    paymentsTbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #9ca3af;">No payment records yet.</td></tr>';
    return;
  }
  
  paymentRecords.forEach((record, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${record.accountName}</td>
      <td>${record.bankName}</td>
      <td>${record.accountNumber}</td>
      <td>${record.ifsc}</td>
      <td>${record.upiId}</td>
      <td>
        <button class="action-btn action-edit" onclick="editPaymentRecord(${index})">Edit</button>
      </td>
    `;
    paymentsTbody.appendChild(row);
  });
}

// Edit payment record
window.editPaymentRecord = function(index) {
  const records = JSON.parse(localStorage.getItem(RECORDS_STORAGE_KEY) || '[]');
  const record = records[index];
  
  document.getElementById('acc-name').value = record.accountName || '';
  document.getElementById('bank-name').value = record.bankName || '';
  document.getElementById('acc-number').value = record.accountNumber || '';
  document.getElementById('ifsc').value = record.ifsc || '';
  document.getElementById('branch-id').value = record.branchId || '';
  document.getElementById('upi-id').value = record.upiId || '';
  
  // Store the edit index
  form.dataset.editIndex = index;
  
  // Scroll to form
  form.scrollIntoView({ behavior: 'smooth' });
};

form.addEventListener('submit', async e => {
  e.preventDefault();
  msgEl.textContent = '';

  const payload = {
    accountName: document.getElementById('acc-name').value.trim(),
    bankName: document.getElementById('bank-name').value.trim(),
    accountNumber: document.getElementById('acc-number').value.trim(),
    ifsc: document.getElementById('ifsc').value.trim(),
    branchId: document.getElementById('branch-id').value.trim(),
    upiId: document.getElementById('upi-id').value.trim()
  };

  // Basic front-end validation
  if (!payload.accountName || !payload.bankName || !payload.accountNumber || !payload.ifsc || !payload.upiId) {
    msgEl.textContent = 'Please fill all required fields.';
    msgEl.style.color = '#fca5a5';
    return;
  }

  // Save as main payment config
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  localStorage.setItem('eventhub-admin-payment-set', 'true');

  // Add to records table
  const records = JSON.parse(localStorage.getItem(RECORDS_STORAGE_KEY) || '[]');
  
  // If editing, update the record
  const editIndex = form.dataset.editIndex;
  if (editIndex !== undefined) {
    records[editIndex] = payload;
    delete form.dataset.editIndex;
  } else {
    records.push(payload);
  }
  
  localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(records));

  // Optional: send to backend API (if implemented)
  try {
    const res = await fetch('/api/admin/payment-setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Server error');
  } catch (err) {
    // For now, just log; local storage is still updated
    console.error('Payment setup API failed (mock only).', err);
  }

  const wasExisting = localStorage.getItem('eventhub-admin-payment-set') === 'true';
  msgEl.textContent = wasExisting ? 'Payment details updated successfully.' : 'Payment details saved successfully.';
  msgEl.style.color = '#6ee7b7';
  
  // Update the flag for future reference
  localStorage.setItem('eventhub-admin-payment-set', 'true');
  
  // Clear form
  form.reset();
  
  // Reload table
  loadPaymentRecords();
  
  setTimeout(() => {
    msgEl.textContent = '';
  }, 3000);
});

// Load records on page load
loadPaymentRecords();
