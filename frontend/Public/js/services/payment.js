/**
 * Payment Service
 * Handles payment processing with multiple payment methods
 */

class PaymentService {
  constructor() {
    this.baseURL = CONFIG.API.BASE_URL;
  }

  /**
   * Generate QR Code for payment
   * Using QR Code generation library
   */
  async generateQRCode(paymentData) {
    // Using QR Code library (needs to be included in HTML)
    // Format: UPI ID | Transaction Details
    const qrString = `UPI://pay?pa=${paymentData.upiId}&pn=${paymentData.name}&am=${paymentData.amount}&tn=${paymentData.description}`;
    
    if (typeof QRCode !== 'undefined') {
      return QRCode.toDataURL(qrString);
    }
    
    return null;
  }

  /**
   * Process payment with different methods
   */
  async processPayment(bookingId, paymentMethod, amount) {
    try {
      const response = await api.post('/payments', {
        booking_id: bookingId,
        payment_method: paymentMethod,
        amount: amount,
        status: 'completed'
      });

      return response;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Validate payment details
   */
  validatePaymentDetails(method, details) {
    switch (method) {
      case 'upi':
        return /^[a-zA-Z0-9._-]+@[a-zA-Z]+$/.test(details.upiId);
      case 'card':
        return details.cardNumber && details.cvv && details.expiryDate;
      case 'netbanking':
        return details.bankName && details.accountNumber;
      default:
        return false;
    }
  }

  /**
   * Get available payment methods
   */
  getAvailablePaymentMethods() {
    return [
      {
        id: 'upi',
        name: 'UPI (Google Pay, PhonePe, Paytm)',
        icon: '📱',
        description: 'Fast and secure UPI payment'
      },
      {
        id: 'card',
        name: 'Credit/Debit Card',
        icon: '💳',
        description: 'Visa, Mastercard, RuPay'
      },
      {
        id: 'netbanking',
        name: 'Net Banking',
        icon: '🏦',
        description: 'Direct bank transfer'
      },
      {
        id: 'googlepay',
        name: 'Google Pay',
        icon: '🔵',
        description: 'Quick payment with Google Pay'
      },
      {
        id: 'phonepe',
        name: 'PhonePe',
        icon: '📱',
        description: 'Fast and easy PhonePe payment'
      },
      {
        id: 'paytm',
        name: 'Paytm',
        icon: '💰',
        description: 'Paytm wallet or UPI'
      }
    ];
  }

  /**
   * Handle redirect to payment gateway
   */
  redirectToPaymentGateway(method, amount, orderId) {
    // This would typically integrate with actual payment gateways
    // For now, we'll simulate the redirect
    const paymentGateways = {
      googlepay: `https://pay.google.com/gp/p/ui/pay?amount=${amount}`,
      phonepe: `phonepe://payment?merchantId=YOUR_MERCHANT_ID&amount=${amount}`,
      paytm: `https://securegw.paytm.in/theia/start/?orderId=${orderId}`
    };

    if (paymentGateways[method]) {
      window.location.href = paymentGateways[method];
    }
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PaymentService;
}
