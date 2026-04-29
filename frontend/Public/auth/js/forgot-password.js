/**
 * Forgot Password Script
 * Handles OTP-based password reset
 */

class ForgotPasswordHandler {
  constructor() {
    this.currentStep = 1;
    this.userEmail = '';
    this.otpVerified = false;
    this.resendTimer = 0;
    
    this.init();
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Email Form
    const emailForm = document.getElementById('email-form');
    if (emailForm) {
      emailForm.addEventListener('submit', (e) => this.handleEmailSubmit(e));
    }

    // OTP Form
    const otpForm = document.getElementById('otp-form');
    if (otpForm) {
      otpForm.addEventListener('submit', (e) => this.handleOTPSubmit(e));
    }

    // Password Form
    const passwordForm = document.getElementById('password-form');
    if (passwordForm) {
      passwordForm.addEventListener('submit', (e) => this.handlePasswordSubmit(e));
    }

    // OTP Input Fields
    this.setupOTPInputs();

    // Resend OTP Button
    const resendBtn = document.getElementById('resend-btn');
    if (resendBtn) {
      resendBtn.addEventListener('click', () => this.resendOTP());
    }

    // Password Strength
    const passwordInput = document.getElementById('new-password');
    if (passwordInput) {
      passwordInput.addEventListener('input', () => this.checkPasswordStrength());
    }
  }

  setupOTPInputs() {
    const otpInputs = document.querySelectorAll('.otp-input');
    
    otpInputs.forEach((input, index) => {
      input.addEventListener('input', (e) => {
        if (e.target.value.length === 1) {
          // Move to next input
          if (index < otpInputs.length - 1) {
            otpInputs[index + 1].focus();
          }
        }
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && e.target.value.length === 0) {
          // Move to previous input
          if (index > 0) {
            otpInputs[index - 1].focus();
          }
        }
      });

      // Only allow numbers
      input.addEventListener('keypress', (e) => {
        if (!/[0-9]/.test(e.key)) {
          e.preventDefault();
        }
      });
    });
  }

  async handleEmailSubmit(e) {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const emailError = document.getElementById('email-error');

    if (!email) {
      emailError.textContent = 'Please enter your email address';
      return;
    }

    if (!Utils.validateEmail(email)) {
      emailError.textContent = 'Please enter a valid email address';
      return;
    }

    try {
      Utils.showLoading();
      emailError.textContent = '';

      const response = await api.post('/auth/send-otp', { email });

      Utils.hideLoading();

      this.userEmail = email;
      Toast.success('OTP sent to your email!');

      // Move to OTP step
      this.goToStep(2);

    } catch (error) {
      Utils.hideLoading();
      emailError.textContent = error.message || 'Failed to send OTP';
      console.error('Error sending OTP:', error);
    }
  }

  async handleOTPSubmit(e) {
    e.preventDefault();

    const otpInputs = document.querySelectorAll('.otp-input');
    const otp = Array.from(otpInputs).map(input => input.value).join('');
    const otpError = document.getElementById('otp-error');

    if (otp.length !== 6) {
      otpError.textContent = 'Please enter a valid 6-digit OTP';
      return;
    }

    try {
      Utils.showLoading();
      otpError.textContent = '';

      const response = await api.post('/auth/verify-otp', {
        email: this.userEmail,
        otp: otp
      });

      Utils.hideLoading();

      Toast.success('OTP verified successfully!');
      this.otpVerified = true;

      // Move to password reset step
      this.goToStep(3);

    } catch (error) {
      Utils.hideLoading();
      otpError.textContent = error.message || 'Invalid OTP. Please try again.';
      
      // Clear OTP inputs
      otpInputs.forEach(input => input.value = '');
      otpInputs[0].focus();
      
      console.error('Error verifying OTP:', error);
    }
  }

  async handlePasswordSubmit(e) {
    e.preventDefault();

    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const passwordError = document.getElementById('password-error');

    if (!newPassword || !confirmPassword) {
      passwordError.textContent = 'Please fill in all fields';
      return;
    }

    if (newPassword.length < 6) {
      passwordError.textContent = 'Password must be at least 6 characters';
      return;
    }

    if (newPassword !== confirmPassword) {
      passwordError.textContent = 'Passwords do not match';
      return;
    }

    try {
      Utils.showLoading();
      passwordError.textContent = '';

      const response = await api.post('/auth/reset-password', {
        email: this.userEmail,
        otp: this.getOTP(),
        new_password: newPassword
      });

      Utils.hideLoading();

      Toast.success('Password reset successfully!');

      // Show success message
      document.getElementById('password-section').style.display = 'none';
      document.getElementById('success-section').style.display = 'block';

      // Redirect to login after 3 seconds
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 3000);

    } catch (error) {
      Utils.hideLoading();
      passwordError.textContent = error.message || 'Failed to reset password';
      console.error('Error resetting password:', error);
    }
  }

  goToStep(step) {
    // Hide all sections
    document.getElementById('email-section').style.display = 'none';
    document.getElementById('otp-section').style.display = 'none';
    document.getElementById('password-section').style.display = 'none';

    // Show current section
    if (step === 1) {
      document.getElementById('email-section').style.display = 'block';
    } else if (step === 2) {
      document.getElementById('otp-section').style.display = 'block';
      document.querySelector('.otp-input').focus();
      this.startResendTimer();
    } else if (step === 3) {
      document.getElementById('password-section').style.display = 'block';
      document.getElementById('new-password').focus();
    }

    // Update progress steps
    document.querySelectorAll('.step').forEach(stepEl => {
      const stepNum = parseInt(stepEl.getAttribute('data-step'));
      stepEl.classList.remove('active', 'completed');

      if (stepNum < step) {
        stepEl.classList.add('completed');
      } else if (stepNum === step) {
        stepEl.classList.add('active');
      }
    });

    this.currentStep = step;
  }

  startResendTimer() {
    this.resendTimer = 30;
    const resendBtn = document.getElementById('resend-btn');
    const timer = document.getElementById('timer');

    resendBtn.disabled = true;

    const interval = setInterval(() => {
      this.resendTimer--;
      timer.textContent = `${this.resendTimer}s`;

      if (this.resendTimer <= 0) {
        clearInterval(interval);
        resendBtn.disabled = false;
        timer.textContent = '0s';
      }
    }, 1000);
  }

  async resendOTP() {
    try {
      Utils.showLoading();

      const response = await api.post('/auth/send-otp', {
        email: this.userEmail
      });

      Utils.hideLoading();
      Toast.success('OTP sent again!');

      // Clear OTP inputs
      document.querySelectorAll('.otp-input').forEach(input => input.value = '');
      document.querySelector('.otp-input').focus();

      // Clear error
      document.getElementById('otp-error').textContent = '';

      // Restart timer
      this.startResendTimer();

    } catch (error) {
      Utils.hideLoading();
      Toast.error('Failed to resend OTP');
      console.error('Error resending OTP:', error);
    }
  }

  getOTP() {
    const otpInputs = document.querySelectorAll('.otp-input');
    return Array.from(otpInputs).map(input => input.value).join('');
  }

  checkPasswordStrength() {
    const password = document.getElementById('new-password').value;
    const strengthBar = document.getElementById('strength-bar');

    let strength = 0;

    // Check length
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;

    // Check for lowercase
    if (/[a-z]/.test(password)) strength++;

    // Check for uppercase
    if (/[A-Z]/.test(password)) strength++;

    // Check for numbers
    if (/[0-9]/.test(password)) strength++;

    // Check for special characters
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    // Remove all classes
    strengthBar.classList.remove('weak', 'medium', 'strong');

    // Add appropriate class
    if (strength <= 2) {
      strengthBar.classList.add('weak');
    } else if (strength <= 4) {
      strengthBar.classList.add('medium');
    } else {
      strengthBar.classList.add('strong');
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.forgotPassword = new ForgotPasswordHandler();
});
