/**
 * SMS Service — sends OTP / transactional SMS via Twilio.
 *
 *   Env vars (all required to enable real delivery):
 *     TWILIO_ACCOUNT_SID    starts with "AC..."
 *     TWILIO_AUTH_TOKEN     32-char string from the Twilio console
 *     TWILIO_FROM           a Twilio phone number you own, e.g. "+12025550101",
 *                           OR a Messaging Service SID starting with "MG..."
 *     TWILIO_DEFAULT_COUNTRY  optional ISO country to assume for bare 10-digit
 *                             numbers (default: "IN" so 9876543210 → +919876543210)
 *
 *   If any of the first three are missing, we fall back to DEV MODE: log
 *   the OTP to stdout and return { sent:true, devMode:true } so the API
 *   surfaces the code back to the caller and the flow stays testable.
 */

require('dotenv').config();

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN  = process.env.TWILIO_AUTH_TOKEN;
const FROM        = process.env.TWILIO_FROM;
const DEFAULT_CC  = (process.env.TWILIO_DEFAULT_COUNTRY || 'IN').toUpperCase();

let client = null;
let SMS_READY = false;

if (ACCOUNT_SID && AUTH_TOKEN && FROM) {
  try {
    const twilio = require('twilio');
    client = twilio(ACCOUNT_SID, AUTH_TOKEN);
    SMS_READY = true;
    console.log(`[sms] Twilio ready — sending from ${FROM}`);
  } catch (err) {
    console.error('[sms] Twilio init failed:', err.message);
    console.error('       run `npm install twilio` inside the backend container.');
  }
} else {
  console.warn('[sms] No SMS provider configured — running in DEV mode. Set TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM to enable real delivery.');
}

// Country code to dial-prefix for the few defaults we care about. Add as
// needed; falls back to "+" if the number is already E.164.
const CC_PREFIX = { IN: '+91', US: '+1', GB: '+44', AE: '+971', SG: '+65' };

/**
 * Normalize a mobile number into Twilio's expected E.164 form (+<country><number>).
 *   "9629232936"        → "+919629232936"  (assumes DEFAULT_CC="IN")
 *   "+919629232936"     → "+919629232936"
 *   "9629 23 2936"      → "+919629232936"
 *   "(415) 555-0123"    → "+14155550123"   (when DEFAULT_CC="US")
 */
function toE164(raw) {
  if (!raw) return null;
  let s = String(raw).trim();
  if (s.startsWith('+')) {
    return '+' + s.slice(1).replace(/\D/g, '');
  }
  s = s.replace(/\D/g, '');
  if (!s) return null;
  // Heuristic: if length looks like it already includes a country code (>=11
  // for IN/US-like markets), prepend "+" without inferring a country.
  if (s.length >= 11) return '+' + s;
  const prefix = CC_PREFIX[DEFAULT_CC] || '+';
  return prefix + s;
}

function devLogOtpSms(to, otp, purpose) {
  const banner = '═'.repeat(54);
  console.log('\n' + banner);
  console.log(` DEV-MODE SMS-OTP  →  ${to}`);
  if (purpose) console.log(`     purpose: ${purpose}`);
  console.log(`     code   : ${otp}`);
  console.log(banner + '\n');
}

/**
 * Send an OTP via SMS.
 *   Returns { sent: boolean, devMode: boolean, deliveredTo: string }
 */
async function sendOTPSms(mobile, otp, purpose = 'verification') {
  const to = toE164(mobile);
  if (!to) return { sent: false, devMode: false, deliveredTo: null };

  if (!SMS_READY || !client) {
    devLogOtpSms(to, otp, purpose);
    return { sent: true, devMode: true, deliveredTo: to };
  }

  // Tailor the SMS copy to the purpose so it matches the email tone.
  const intro = purpose === 'signup'
      ? 'Your EventHub account confirmation code is'
    : purpose === 'password-reset'
      ? 'Your EventHub password reset code is'
    : purpose === 'update-mobile' || purpose === 'update-email'
      ? 'Your EventHub verification code is'
      : 'Your EventHub verification code is';
  const body = `${intro} ${otp}. It expires in 10 minutes. Do not share this code with anyone.`;

  try {
    // Twilio accepts `from` as either a phone number or a Messaging Service SID.
    const params = FROM.startsWith('MG')
      ? { to, body, messagingServiceSid: FROM }
      : { to, body, from: FROM };
    const msg = await client.messages.create(params);
    console.log(`[sms] OTP sent to ${to} (sid=${msg.sid}, status=${msg.status})`);
    return { sent: true, devMode: false, deliveredTo: to };
  } catch (err) {
    // SMS provider is configured but the send failed (unverified trial number,
    // insufficient funds, geo-permission, etc.). Surface the failure to the
    // caller — DO NOT fall back to dev mode here, because that would expose
    // the OTP in the API response to a real end user.
    console.error('[sms] Twilio send failed:', err.message);
    devLogOtpSms(to, otp, purpose);   // still log to server console for debugging
    const friendly = err.code === 21608
        ? 'This number isn\'t verified for trial sending. Add it to your Twilio Verified Caller IDs and try again.'
      : err.code === 21211
        ? 'That phone number doesn\'t look valid. Please double-check and try again.'
      : err.code === 21610
        ? 'This number has opted out of SMS messages.'
      : 'We couldn\'t deliver the OTP. Please try again or use email instead.';
    return { sent: false, devMode: false, deliveredTo: to, error: friendly };
  }
}

module.exports = { sendOTPSms, SMS_READY, toE164 };
