/**
 * Email Service
 * Handles sending emails for OTP and booking notifications.
 *
 * SMTP configuration (env vars):
 *
 *   Generic SMTP (preferred — works for any provider):
 *     SMTP_HOST       smtp.gmail.com / smtp.sendgrid.net / smtp-relay.brevo.com / …
 *     SMTP_PORT       587 (STARTTLS) or 465 (SSL)
 *     SMTP_SECURE     "true" for port 465, "false" for 587 (default: auto by port)
 *     SMTP_USER       SMTP login (often the from-address)
 *     SMTP_PASS       SMTP password / App Password / API key
 *     SMTP_FROM       optional "EventHub <noreply@you.com>" (default: SMTP_USER)
 *
 *   Legacy Gmail shortcut (kept for backwards compatibility):
 *     EMAIL_USER      Gmail address
 *     EMAIL_PASSWORD  Gmail App Password (NOT the regular password — Gmail
 *                     refuses regular passwords for SMTP since 2022)
 *
 * If neither set is configured, the service falls back to DEV MODE: it logs
 * the OTP to stdout AND returns it in the API response (devMode:true) so the
 * flow remains testable without a mailbox.
 */

const nodemailer = require('nodemailer');
require('dotenv').config();

// ── Build the transporter from whichever env-var set is provided ────
function buildTransport() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    const port = parseInt(process.env.SMTP_PORT, 10) || 587;
    const secure = process.env.SMTP_SECURE
      ? /^(1|true|yes)$/i.test(process.env.SMTP_SECURE)
      : port === 465;
    return {
      mode: 'smtp',
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      transport: nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      })
    };
  }
  if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    return {
      mode: 'gmail',
      from: process.env.EMAIL_USER,
      transport: nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASSWORD }
      })
    };
  }
  return null;
}

const built       = buildTransport();
const transporter = built?.transport || null;
const FROM        = built?.from      || 'noreply@eventhub.com';
let SMTP_READY    = !!transporter;   // mutable: flipped to false if verify fails

// Verify the SMTP connection on startup so the operator sees a clear
// "auth ok" / "auth failed" log instead of waiting for the first email
// to silently fall back to dev mode.
if (transporter) {
  transporter.verify()
    .then(() => console.log(`[email] SMTP ready (${built.mode}) — sending as ${FROM}`))
    .catch((err) => {
      SMTP_READY = false;
      console.error('[email] SMTP verify FAILED — falling back to DEV mode.');
      console.error('        reason:', err.message);
      if (built.mode === 'gmail') {
        console.error('        hint:  for Gmail you must use an APP PASSWORD');
        console.error('               (https://myaccount.google.com/apppasswords),');
        console.error('               not your regular Gmail password.');
      }
    });
} else {
  console.warn('[email] No SMTP configured — running in DEV mode. Set SMTP_HOST + SMTP_USER + SMTP_PASS (or EMAIL_USER + EMAIL_PASSWORD) to enable real delivery.');
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
// Purpose → email copy. Each entry returns the subject line and the
// header/body wording. Keeping the visual frame identical across purposes,
// only the words change so the email always feels on-brand.
function templateForPurpose(purpose) {
  switch (purpose) {
    case 'signup':
      return {
        subject: 'EventHub - Confirm your account',
        headerTitle: 'Welcome to EventHub',
        bannerLabel: 'Account confirmation',
        intro: "Thanks for signing up! Use the code below to confirm your email address and finish creating your EventHub account.",
        codeLabel: 'Your account confirmation code',
        disclaimer: "If you didn't create an EventHub account, you can safely ignore this email."
      };
    case 'update-email':
      return {
        subject: 'EventHub - Verify your new email',
        headerTitle: 'Email change',
        bannerLabel: 'Email update',
        intro: 'Use the code below to confirm the change of email on your EventHub account.',
        codeLabel: 'Your verification code',
        disclaimer: "If you didn't request an email change, please change your password and contact support."
      };
    case 'update-mobile':
      return {
        subject: 'EventHub - Verify your mobile change',
        headerTitle: 'Mobile change',
        bannerLabel: 'Mobile update',
        intro: 'Use the code below to confirm the change of mobile number on your EventHub account.',
        codeLabel: 'Your verification code',
        disclaimer: "If you didn't request a mobile change, please change your password and contact support."
      };
    case 'password-reset':
      return {
        subject: 'EventHub - Your password reset code',
        headerTitle: 'Password reset',
        bannerLabel: 'Password reset',
        intro: 'We received a request to reset your EventHub account password. Use the code below to proceed.',
        codeLabel: 'Your one-time password',
        disclaimer: "If you didn't request this, please ignore this email or contact support."
      };
    default:
      return {
        subject: 'EventHub - Your verification code',
        headerTitle: 'EventHub',
        bannerLabel: 'Verification',
        intro: 'Use the code below to verify your request.',
        codeLabel: 'Your verification code',
        disclaimer: "If you didn't request this, please ignore this email."
      };
  }
}

function buildOtpHtml(otp, userName, t) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 10px 10px 0 0; color: white; text-align: center;">
        <h2 style="margin:0 0 4px 0;">EventHub — ${t.headerTitle}</h2>
        <p style="margin:0; opacity:0.85; font-size:13px;">${t.bannerLabel}</p>
      </div>

      <div style="padding: 30px; background-color: #f9fafb; border-radius: 0 0 10px 10px;">
        <p style="color: #333; font-size: 16px;">Hello ${userName},</p>

        <p style="color: #666; font-size: 14px; line-height: 1.6;">
          ${t.intro}
        </p>

        <div style="background-color: white; border: 2px solid #667eea; padding: 20px; margin: 20px 0; text-align: center; border-radius: 8px;">
          <p style="font-size: 12px; color: #999; margin: 0 0 10px 0;">${t.codeLabel}:</p>
          <h1 style="color: #667eea; letter-spacing: 5px; margin: 0; font-size: 32px;">${otp}</h1>
        </div>

        <p style="color: #999; font-size: 12px;">
          This code is valid for 10 minutes.
        </p>

        <p style="color: #999; font-size: 12px;">
          ${t.disclaimer}
        </p>

        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center;">
          <p style="color: #999; font-size: 12px;">EventHub Team</p>
        </div>
      </div>
    </div>
  `;
}

async function sendOTPEmail(email, otp, userName = 'User', purpose = 'verification') {
  // SMTP_READY can flip to false at runtime if verify() reported auth failure.
  if (!transporter || !SMTP_READY) {
    devLogOtp(email, otp, purpose);
    return { sent: true, devMode: true };
  }
  try {
    const tpl = templateForPurpose(purpose);
    const htmlContent = buildOtpHtml(otp, userName, tpl);

    const mailOptions = {
      from: FROM,
      to: email,
      subject: tpl.subject,
      html: htmlContent
    };

    await transporter.sendMail(mailOptions);
    console.log(`OTP email sent to ${email} (purpose=${purpose})`);
    return { sent: true, devMode: false };

  } catch (error) {
    // SMTP is configured but the send failed (auth, network, recipient
    // bounce, etc.). Surface a real error to the caller instead of silently
    // exposing the OTP — only TRUE dev mode (no SMTP configured at all)
    // should ever leak the code.
    console.error('Failed to send OTP email:', error.message);
    devLogOtp(email, otp, purpose);   // still log to server console
    return {
      sent: false,
      devMode: false,
      error: 'We couldn\'t deliver the verification email. Please try again in a moment.'
    };
  }
}

/**
 * Send Booking Confirmation Email
 */
async function sendBookingConfirmationEmail(email, bookingDetails) {
  if (!transporter || !SMTP_READY) {
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
      from: FROM,
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
