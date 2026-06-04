package com.payment.controller;

import com.payment.model.CreateOrderRequest;
import com.payment.model.UpiConfirmRequest;
import com.payment.model.VerifyPaymentRequest;
import com.payment.service.RazorpayService;
import com.razorpay.RazorpayException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@RestController
@RequestMapping("/api/payment")
@RequiredArgsConstructor
public class PaymentController {

    private final RazorpayService razorpay;

    /** Static UPI ID & merchant name for the QR-fallback path. Configured from properties. */
    @Value("${upi.id:devilsusi54@oksbi}")    private String upiId;
    @Value("${upi.payee:EventHub}")          private String upiPayee;

    /** In-memory store of UPI payment confirmations awaiting organizer review.
     *  In production this would be persisted to a database. */
    private final Map<String, Object> pendingUpi = new ConcurrentHashMap<>();

    // ─────────────────────────────────────────────────────────────────
    // Health
    // ─────────────────────────────────────────────────────────────────
    @GetMapping("/health")
    public Map<String, Object> health() {
        Map<String, Object> r = new HashMap<>();
        r.put("status",            "OK");
        r.put("razorpayConfigured", razorpay.isConfigured());
        r.put("upiId",              upiId);
        return r;
    }

    // ─────────────────────────────────────────────────────────────────
    // Razorpay path — official, supports cards / UPI / netbanking / wallets.
    // Test mode is genuinely free; switch keys to live mode when going to production.
    // ─────────────────────────────────────────────────────────────────

    /**
     * POST /api/payment/create-order
     *  body: { amount: 250, currency: "INR", receipt: "BK-12", notes: { ... } }
     * Returns the Razorpay order id + your public keyId so the frontend
     * Razorpay Checkout widget can launch.
     */
    @PostMapping("/create-order")
    public ResponseEntity<?> createOrder(@Valid @RequestBody CreateOrderRequest req) {
        try {
            return ResponseEntity.ok(razorpay.createOrder(req));
        } catch (RazorpayException e) {
            log.error("Razorpay create-order failed: {}", e.getMessage());
            return ResponseEntity.status(502).body(Map.of("error", "Razorpay: " + e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(503).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * POST /api/payment/verify-payment
     *  body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
     * Returns { success: true } if the HMAC signature checks out, false otherwise.
     */
    @PostMapping("/verify-payment")
    public ResponseEntity<?> verify(@Valid @RequestBody VerifyPaymentRequest req) {
        boolean ok = razorpay.verifySignature(req);
        if (ok) log.info("Razorpay payment verified: {}", req.getRazorpay_payment_id());
        else    log.warn("Razorpay signature mismatch for payment {}", req.getRazorpay_payment_id());
        Map<String, Object> r = new HashMap<>();
        r.put("success",   ok);
        r.put("paymentId", req.getRazorpay_payment_id());
        r.put("orderId",   req.getRazorpay_order_id());
        return ResponseEntity.ok(r);
    }

    // ─────────────────────────────────────────────────────────────────
    // UPI fallback — the customer scans your QR with any UPI app
    // (GPay / PhonePe / Paytm / BHIM) and pays directly to your account.
    // After paying they hit "I have paid", enter their UTR, and we
    // record the confirmation so the organizer can acknowledge it.
    // ─────────────────────────────────────────────────────────────────

    /**
     * GET /api/payment/upi/info?amount=250&reference=BK-12
     * Returns the merchant UPI ID + a payment URL ("upi://pay?...") that
     * Android UPI apps can deep-link to. Frontend can build a QR from this
     * URL or just show the static QR image (uploaded by the organizer).
     */
    @GetMapping("/upi/info")
    public Map<String, Object> upiInfo(
            @RequestParam(required = false) Double amount,
            @RequestParam(required = false) String reference) {
        StringBuilder url = new StringBuilder("upi://pay?pa=" + upiId + "&pn=" + upiPayee);
        if (amount != null && amount > 0) url.append("&am=").append(amount);
        if (reference != null && !reference.isBlank()) url.append("&tn=").append(reference);
        url.append("&cu=INR");
        Map<String, Object> r = new HashMap<>();
        r.put("upiId",       upiId);
        r.put("payeeName",   upiPayee);
        r.put("amount",      amount);
        r.put("reference",   reference);
        r.put("upiUrl",      url.toString());     // open this on a phone with a UPI app installed
        return r;
    }

    /**
     * POST /api/payment/upi/confirm
     *  body: { reference, amount, utr, payerUpi? }
     * Records the customer's claim that they paid via UPI. The host app
     * (EventHub) should mark the booking as "pending verification" until
     * the organizer manually approves it.
     */
    @PostMapping("/upi/confirm")
    public ResponseEntity<?> upiConfirm(@Valid @RequestBody UpiConfirmRequest req) {
        Map<String, Object> entry = new HashMap<>();
        entry.put("reference",  req.getReference());
        entry.put("amount",     req.getAmount());
        entry.put("utr",        req.getUtr());
        entry.put("payerUpi",   req.getPayerUpi());
        entry.put("submittedAt", OffsetDateTime.now().toString());
        entry.put("status",      "PENDING_REVIEW");
        pendingUpi.put(req.getUtr(), entry);
        log.info("UPI confirm received: ref={}  amount={}  utr={}",
                req.getReference(), req.getAmount(), req.getUtr());
        Map<String, Object> r = new HashMap<>();
        r.put("success",  true);
        r.put("status",   "PENDING_REVIEW");
        r.put("message",  "Thanks! We've recorded your payment. The organizer will verify shortly.");
        r.put("utr",      req.getUtr());
        return ResponseEntity.ok(r);
    }

    /**
     * GET /api/payment/upi/pending
     * Returns all pending UPI confirmations — the organizer dashboard polls this.
     */
    @GetMapping("/upi/pending")
    public Map<String, Object> upiPending() {
        Map<String, Object> r = new HashMap<>();
        r.put("count", pendingUpi.size());
        r.put("items", pendingUpi.values());
        return r;
    }
}
