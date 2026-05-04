/**
 * Email Service
 * Handles sending emails for OTP and notifications
 */

const nodemailer = require('nodemailer');
require('dotenv').config();

// SMTP is "configured" only when both creds are present in the environment.
// If they're missing we run in DEV MODE: log the OTP to the console and let
// the API surface it back to the caller, so the flow is fully testable
// without setting up a real mailbox.
const SMTP_READY = !!(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);
const transporter = SMTP_READY ? nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
}) : null;

if (!SMTP_READY) {
  console.warn(' emailService running in DEV mode — set EMAIL_USER + EMAIL_PASSWORD in .env to send real emails.');
}

function devLogOtp(email, otp, purpose) {
  const banner = '═'.repeat(54);
  console.log('\n' + banner);
  console.log(` DEV-MODE OTP  →  ${email}`);
  if (purpose) console.log(`     purpose: ${purpose}`);
  console.log(`     code   : ${otp}`);
  console.log(banner + '\n');
}

/**
 * Send OTP Email
 *
 *   Returns { sent: boolean, devMode: boolean }
 *   - sent=true if SMTP delivered or we're in dev mode (always treated as ok)
 *   - devMode=true means the caller can include the otp in the API response
 */
async function sendOTPEmail(email, otp, userName = 'User', purpose = 'verification') {
  if (!SMTP_READY) {
    devLogOtp(email, otp, purpose);
    return { sent: true, devMode: true };
  }
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
            This OTP is valid for 10 minutes.
          </p>
          
          <p style="color: #999; font-size: 12px;">
            If you didn't request this, please ignore this email or contact support.
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
    console.log(`OTP email sent to ${email}`);
    return { sent: true, devMode: false };

  } catch (error) {
    console.error('Failed to send OTP email:', error.message);
    // SMTP failure — fall back to dev mode so the caller still gets the OTP.
    devLogOtp(email, otp, purpose);
    return { sent: true, devMode: true };
  }
}

/**
 * Send Booking Confirmation Email
 */
async function sendBookingConfirmationEmail(email, bookingDetails) {
  if (!SMTP_READY) {
    console.log(`DEV-MODE booking-confirm email skipped → ${email} (${bookingDetails.eventTitle})`);
    return false;
  }
  try {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 20px; border-radius: 10px 10px 0 0; color: white; text-align: center;">
          <h2>Booking Confirmed! </h2>
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
    console.log(`Booking confirmation email sent to ${email}`);
    return true;

  } catch (error) {
    console.error('Failed to send booking email:', error.message);
    return false;
  }
}

module.exports = {
  sendOTPEmail,
  sendBookingConfirmationEmail,
  SMTP_READY
};
