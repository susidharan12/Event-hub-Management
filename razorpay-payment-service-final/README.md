# Razorpay Payment Service

Spring Boot 3.3 microservice that handles payments for the EventHub platform.

Two payment paths are exposed:

1. **Razorpay Checkout** (test mode is genuinely FREE) — cards, UPI, netbanking, wallets. Uses the standard Razorpay flow: create order → frontend launches Razorpay widget → server verifies HMAC signature.
2. **Manual UPI** — the customer scans your personal UPI QR code (`devilsusi54@oksbi`) with any UPI app and pays directly to your bank. They submit the UTR / transaction reference back to this service, which holds it as `PENDING_REVIEW` for the organizer to acknowledge.

You can mix and match — e.g. show Razorpay for cards and UPI together, with the QR as a fallback.

---

## Quick start

### 1. Get Razorpay test keys (free, ~30 seconds)

1. Sign up at https://dashboard.razorpay.com/signup (no card required for test mode)
2. Switch the dashboard to **Test Mode** (toggle in top-right)
3. Settings → API Keys → **Generate Test Keys**
4. Copy the **Key Id** (`rzp_test_...`) and **Key Secret**

### 2. Set the env vars (PowerShell)

```powershell
$env:RAZORPAY_KEY_ID     = "rzp_test_xxxxxxxxxxxx"
$env:RAZORPAY_KEY_SECRET = "yyyyyyyyyyyyyyyyyyyyyyyy"
```

### 3. Run

```powershell
cd razorpay-payment-service-final
mvn spring-boot:run
```

Service starts on **http://localhost:8081**.

---

## Endpoints

| Method | URL                                      | Purpose |
|--------|------------------------------------------|---------|
| GET    | `/api/payment/health`                    | Health + config status |
| POST   | `/api/payment/create-order`              | Create a Razorpay order |
| POST   | `/api/payment/verify-payment`            | Verify Razorpay HMAC signature |
| GET    | `/api/payment/upi/info?amount=&reference=` | Returns the merchant UPI ID + a `upi://pay?...` deep link |
| POST   | `/api/payment/upi/confirm`               | Customer submits UTR after manual UPI payment |
| GET    | `/api/payment/upi/pending`               | List pending UPI confirmations awaiting organizer review |

### Sample requests

**Create Razorpay order:**
```bash
curl -X POST http://localhost:8081/api/payment/create-order \
  -H "Content-Type: application/json" \
  -d '{"amount": 250, "currency": "INR", "receipt": "BK-12"}'
```
Returns:
```json
{ "orderId": "order_NA...", "amount": 25000, "currency": "INR", "keyId": "rzp_test_..." }
```

**Verify payment** (the Razorpay widget gives you these three values on success):
```bash
curl -X POST http://localhost:8081/api/payment/verify-payment \
  -H "Content-Type: application/json" \
  -d '{
        "razorpay_order_id":   "order_NA...",
        "razorpay_payment_id": "pay_NB...",
        "razorpay_signature":  "abc123..."
      }'
```

**Manual UPI confirmation** (customer paid via QR, now records UTR):
```bash
curl -X POST http://localhost:8081/api/payment/upi/confirm \
  -H "Content-Type: application/json" \
  -d '{"reference": "BK-12", "amount": 250, "utr": "327654321098"}'
```

---

## Frontend integration sketch

```js
// 1. Create order on the backend
const orderRes = await fetch('http://localhost:8081/api/payment/create-order', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ amount: bookingTotal, receipt: bookingId })
});
const { orderId, amount, currency, keyId } = await orderRes.json();

// 2. Open Razorpay Checkout widget
//    (load https://checkout.razorpay.com/v1/checkout.js once on the page)
const rzp = new Razorpay({
  key:      keyId,
  amount:   amount,           // already in paise
  currency: currency,
  name:     'EventHub',
  order_id: orderId,
  handler:  async (response) => {
    // 3. Verify on the backend
    const v = await fetch('http://localhost:8081/api/payment/verify-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(response)
    }).then(r => r.json());
    if (v.success) confirmBooking();
    else           showError("Payment couldn't be verified");
  }
});
rzp.open();
```

For the UPI fallback, just show your QR image in the UI plus an input where the customer pastes their UTR after paying, then POST to `/api/payment/upi/confirm`.

---

## Free vs paid

| Path | Cost during dev | Cost in production |
|---|---|---|
| Razorpay test mode | **FREE** (unlimited fake transactions) | n/a |
| Razorpay live mode | n/a | 2% per transaction (Razorpay's standard fee) |
| Manual UPI QR | **FREE** (UPI is free in India) | **FREE** — money goes straight to your bank |

While you're building, keep Razorpay in test mode and use the QR fallback for any actual money collection. Both work side-by-side.
