import { QRScanner } from '../components/QRScanner.js';

document.addEventListener('DOMContentLoaded', () => {
  const scannerContainer = document.getElementById('qr-scanner-container');
  const resultDiv = document.getElementById('checkin-result');
  
  const scanner = new QRScanner(scannerContainer, async (qrData) => {
    try {
      // Send QR data to backend for validation
      const response = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId: qrData })
      });
      
      const result = await response.json();
      resultDiv.innerHTML = `
        <div class="event-card ${result.valid ? 'success' : 'error'}">
          <h3>${result.valid ? 'Check-in Successful' : 'Invalid Ticket'}</h3>
          <p>${result.message}</p>
        </div>
      `;
      
      if (result.valid) scanner.stop();
    } catch (error) {
      resultDiv.innerHTML = '<p>Check-in failed</p>';
    }
  });

  scanner.start();
});
