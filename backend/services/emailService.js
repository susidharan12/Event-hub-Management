/**
 * Email Service
 * Handles sending emails for OTP and notifications
 */

const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter - using Gmail for demo
// In production, use your email service provider
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASSWORD || 'your-app-password'
  }
});

/**
 * Send OTP Email
 */
async function sendOTPEmail(email, otp, userName = 'User') {
  try {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px 10px 0 0; color: white; text-align: center;">
          <h2>EventHub - Password Reset</h2>
        </div>
        
        <div style="padding: 30px; background-color: #f9fafb; border-radius: 0 0 10px 10px;">
          <p style="color: #333; font-size: 16px;">Hello ${userName},</p>
          
          <p style="color: #666; font-size: 14px; line-height: 1.6;">
            We received a request to reset your EventHub account password. 
            Use the OTP below to proceed:
          </p>
          
          <div style="background-color: white; border: 2px solid #667eea; padding: 20px; margin: 20px 0; text-align: center; border-radius: 8px;">
            <p style="font-size: 12px; color: #999; margin: 0 0 10px 0;">Your One-Time Password:</p>
            <h1 style="color: #667eea; letter-spacing: 5px; margin: 0; font-size: 32px;">${otp}</h1>
          </div>
          
          <p style="color: #999; font-size: 12px;">
            ⏱️ This OTP is valid for 10 minutes.
          </p>
          
          <p style="color: #999; font-size: 12px;">
            ⚠️ If you didn't request this, please ignore this email or contact support.
          </p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center;">
            <p style="color: #999; font-size: 12px;">EventHub Team</p>
          </div>
        </div>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@eventhub.com',
      to: email,
      subject: 'EventHub - Your Password Reset OTP',
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ OTP email sent to ${email}`);
    return true;

  } catch (error) {
    console.error('❌ Failed to send OTP email:', error.message);
    // In development, we'll show the OTP in console
    // In production, you should handle this error appropriately
    return false;
  }
}

/**
 * Send Booking Confirmation Email
 */
async function sendBookingConfirmationEmail(email, bookingDetails) {
  try {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 20px; border-radius: 10px 10px 0 0; color: white; text-align: center;">
          <h2>Booking Confirmed! 🎉</h2>
        </div>
        
        <div style="padding: 30px; background-color: #f9fafb; border-radius: 0 0 10px 10px;">
          <p style="color: #333; font-size: 16px;">Thank you for your booking!</p>
          
          <div style="background-color: white; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 5px 0;"><strong>Event:</strong> ${bookingDetails.eventTitle}</p>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${bookingDetails.eventDate}</p>
            <p style="margin: 5px 0;"><strong>Seats:</strong> ${bookingDetails.seats}</p>
            <p style="margin: 5px 0;"><strong>Total Amount:</strong> ₹${bookingDetails.totalAmount}</p>
          </div>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center;">
            <p style="color: #999; font-size: 12px;">EventHub Team</p>
          </div>
        </div>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER || 'noreply@eventhub.com',
      to: email,
      subject: `EventHub - Booking Confirmed for ${bookingDetails.eventTitle}`,
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Booking confirmation email sent to ${email}`);
    return true;

  } catch (error) {
    console.error('❌ Failed to send booking email:', error.message);
    return false;
  }
}

module.exports = {
  sendOTPEmail,
  sendBookingConfirmationEmail
};
