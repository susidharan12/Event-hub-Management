/**
 * Payment Page Script
 * Handles payment processing with multiple payment methods
 */

class PaymentPage {
  constructor() {
    this.user = auth.getCurrentUser();
    this.bookingId = this.getBookingIdFromURL();
    this.paymentService = new PaymentService();
    this.selectedMethod = null;
    this.bookingDetails = null;
    
    if (!this.user) {
      window.location.href = '../../auth/pages/login.html';
      return;
    }

    this.init();
  }

  init() {
    this.loadNavbar();
    this.loadBookingDetails();
    this.setupPaymentMethods();
  }

  getBookingIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('booking_id');
  }

  loadNavbar() {
    const navbar = document.getElementById('navbar');
    if (navbar && typeof Navbar !== 'undefined') {
      const navComponent = new Navbar();
      navbar.innerHTML = navComponent.render();
    }
  }

  async loadBookingDetails() {
    try {
      const response = await api.get(`/bookings/${this.bookingId}`);
      this.bookingDetails = response.booking;

      // Update UI with booking details
      document.getElementById('event-name').textContent = this.bookingDetails.event_name;
      document.getElementById('event-date').textContent = new Date(this.bookingDetails.event_date).toLocaleDateString();
      document.getElementById('event-location').textContent = this.bookingDetails.location;
      document.getElementById('seats-count').textContent = this.bookingDetails.number_of_seats;
      document.getElementById('price-per-seat').textContent = `₹${this.bookingDetails.ticket_price}`;

      // Calculate prices
      const subtotal = this.bookingDetails.total_price;
      const tax = Math.round(subtotal * 0.18);
      const total = subtotal + tax;

      document.getElementById('subtotal').textContent = `₹${subtotal.toLocaleString()}`;
      document.getElementById('tax').textContent = `₹${tax.toLocaleString()}`;
      document.getElementById('total-amount').textContent = `₹${total.toLocaleString()}`;
      document.getElementById('pay-amount').textContent = total.toLocaleString();

    } catch (error) {
      console.error('Error loading booking details:', error);
      Toast.error('Failed to load booking details');
      setTimeout(() => window.history.back(), 2000);
    }
  }

  setupPaymentMethods() {
    const container = document.getElementById('payment-methods-container');
    const methods = this.paymentService.getAvailablePaymentMethods();

    container.innerHTML = methods.map((method, index) => `
      <label class="payment-method" onclick="window.payment.selectPaymentMethod('${method.id}')">
        <div class="payment-method-header">
          <div class="payment-icon">${method.icon}</div>
          <div class="payment-info">
            <h4>${method.name}</h4>
            <p>${method.description}</p>
          </div>
          <input type="radio" name="payment-method" value="${method.id}" class="payment-radio">
        </div>
      </label>
    `).join('');
  }

  selectPaymentMethod(method) {
    this.selectedMethod = method;

    // Update UI
    document.querySelectorAll('.payment-method').forEach(el => {
      el.classList.remove('active');
    });
    event.currentTarget.classList.add('active');

    // Update form visibility
    document.querySelectorAll('.hidden-form').forEach(form => {
      form.style.display = 'none';
    });

    // Show relevant form
    if (method === 'upi') {
      document.getElementById('upi-form').style.display = 'block';
      this.generateUPIQRCode();
    } else if (method === 'card') {
      document.getElementById('card-form').style.display = 'block';
    } else if (method === 'netbanking') {
      document.getElementById('netbanking-form').style.display = 'block';
    } else if (['googlepay', 'phonepe', 'paytm'].includes(method)) {
      document.getElementById('app-payment').style.display = 'block';
      this.generateAppPaymentQR(method);
    }
  }

  generateUPIQRCode() {
    const amount = this.bookingDetails.total_price + Math.round(this.bookingDetails.total_price * 0.18);
    const merchantName = 'EventHub';
    const transactionRef = `BOOKING${this.bookingId}`;

    // UPI Format: upi://pay?pa=UPI_ID&pn=NAME&am=AMOUNT&tn=DESCRIPTION&tr=TRANSACTION_REF
    const upiString = `upi://pay?pa=merchant@okhdfcbank&pn=${encodeURIComponent(merchantName)}&am=${amount}&tn=${encodeURIComponent('Event Registration')}&tr=${transactionRef}`;

    const qrContainer = document.getElementById('qr-code');
    qrContainer.innerHTML = '';

    // Create QR code using QRCode library
    new QRCode(qrContainer, {
      text: upiString,
      width: 200,
      height: 200,
      colorDark: '#2c3e50',
      colorLight: '#ffffff'
    });
  }

  generateAppPaymentQR(appName) {
    const qrContainer = document.getElementById('app-qr-code');
    qrContainer.innerHTML = '';

    const amount = this.bookingDetails.total_price + Math.round(this.bookingDetails.total_price * 0.18);
    
    let qrString = '';
    let message = '';

    switch (appName) {
      case 'googlepay':
        qrString = `https://pay.google.com/gp/p/ui/pay?amount=${amount}`;
        message = 'Scan with Google Pay';
        break;
      case 'phonepe':
        qrString = `phonepe://pay?amount=${amount}&merchantId=YOUR_MERCHANT_ID`;
        message = 'Scan with PhonePe';
        break;
      case 'paytm':
        qrString = `https://securegw.paytm.in/theia/start/?orderId=BOOKING${this.bookingId}`;
        message = 'Scan with Paytm';
        break;
    }

    new QRCode(qrContainer, {
      text: qrString,
      width: 200,
      height: 200,
      colorDark: '#2c3e50',
      colorLight: '#ffffff'
    });

    const msgEl = document.createElement('p');
    msgEl.textContent = message;
    msgEl.style.marginTop = '15px';
    msgEl.style.textAlign = 'center';
    msgEl.style.color = '#7f8c8d';
    qrContainer.appendChild(msgEl);
  }

  async processPayment() {
    if (!this.selectedMethod) {
      this.showError('Please select a payment method');
      return;
    }

    try {
      Utils.showLoading();
      const payBtn = document.getElementById('pay-now-btn');
      payBtn.disabled = true;

      // Validate payment details
      const isValid = this.validatePaymentDetails();
      if (!isValid) {
        Utils.hideLoading();
        payBtn.disabled = false;
        return;
      }

      // Process payment
      const amount = this.bookingDetails.total_price + Math.round(this.bookingDetails.total_price * 0.18);
      
      const response = await this.paymentService.processPayment(
        this.bookingId,
        this.selectedMethod,
        amount
      );

      Utils.hideLoading();

      if (response.status === 'success' || response.status === 'completed') {
        Toast.success('Payment successful!');
        setTimeout(() => {
          window.location.href = `./booking-success.html?booking_id=${this.bookingId}&payment_id=${response.payment_id}`;
        }, 1500);
      } else {
        throw new Error('Payment processing failed');
      }

    } catch (error) {
      Utils.hideLoading();
      const payBtn = document.getElementById('pay-now-btn');
      payBtn.disabled = false;
      
      this.showError(error.message || 'Payment failed. Please try again.');
      console.error('Payment error:', error);
    }
  }

  validatePaymentDetails() {
    const errorEl = document.getElementById('error-message');
    errorEl.style.display = 'none';
    errorEl.textContent = '';

    switch (this.selectedMethod) {
      case 'upi': {
        const upiId = document.getElementById('upi-id').value.trim();
        if (!upiId || !/^[a-zA-Z0-9._-]+@[a-zA-Z]+$/.test(upiId)) {
          this.showError('Please enter a valid UPI ID');
          return false;
        }
        break;
      }
      case 'card': {
        const name = document.getElementById('cardholder-name').value.trim();
        const number = document.getElementById('card-number').value.replace(/\s/g, '');
        const expiry = document.getElementById('expiry-date').value;
        const cvv = document.getElementById('cvv').value;

        if (!name || name.length < 3) {
          this.showError('Please enter a valid cardholder name');
          return false;
        }

        if (!number || number.length !== 16 || !/^\d+$/.test(number)) {
          this.showError('Please enter a valid 16-digit card number');
          return false;
        }

        if (!expiry || !/^\d{2}\/\d{2}$/.test(expiry)) {
          this.showError('Please enter expiry date in MM/YY format');
          return false;
        }

        if (!cvv || !/^\d{3,4}$/.test(cvv)) {
          this.showError('Please enter a valid CVV');
          return false;
        }
        break;
      }
      case 'netbanking': {
        const bankName = document.getElementById('bank-name').value;
        const accountNumber = document.getElementById('account-number').value.trim();

        if (!bankName) {
          this.showError('Please select a bank');
          return false;
        }

        if (!accountNumber || accountNumber.length < 9) {
          this.showError('Please enter a valid account number');
          return false;
        }
        break;
      }
    }

    return true;
  }

  showError(message) {
    const errorEl = document.getElementById('error-message');
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    Toast.error(message);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.payment = new PaymentPage();
});
