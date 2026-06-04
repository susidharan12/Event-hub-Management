package com.payment.service;

import com.payment.model.CreateOrderRequest;
import com.payment.model.VerifyPaymentRequest;
import com.razorpay.Order;
import com.razorpay.RazorpayClient;
import com.razorpay.RazorpayException;
import com.razorpay.Utils;
import lombok.extern.slf4j.Slf4j;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
public class RazorpayService {

    @Value("${razorpay.key.id}")
    private String keyId;

    @Value("${razorpay.key.secret}")
    private String keySecret;

    private RazorpayClient client;

    @PostConstruct
    public void init() throws RazorpayException {
        if (keyId == null || keyId.isBlank() || keyId.startsWith("${")) {
            log.warn("Razorpay key id not set. Set RAZORPAY_KEY_ID env var or hardcode in application.properties.");
            return;
        }
        this.client = new RazorpayClient(keyId, keySecret);
        log.info("Razorpay client initialised with keyId={}", keyId);
    }

    /**
     * Creates a Razorpay Order. The frontend uses the returned order_id +
     * key_id to launch the Razorpay Checkout widget.
     *
     * Razorpay accepts amount in PAISE, so we multiply rupees by 100.
     */
    public Map<String, Object> createOrder(CreateOrderRequest req) throws RazorpayException {
        if (client == null) {
            throw new IllegalStateException("Razorpay not initialised — set RAZORPAY_KEY_ID & RAZORPAY_KEY_SECRET");
        }
        JSONObject body = new JSONObject();
        body.put("amount",   Math.round(req.getAmount() * 100));     // paise
        body.put("currency", req.getCurrency() == null ? "INR" : req.getCurrency());
        body.put("receipt",  req.getReceipt() == null ? "rcpt_" + UUID.randomUUID() : req.getReceipt());
        if (req.getNotes() != null && !req.getNotes().isEmpty()) {
            body.put("notes", req.getNotes());
        }

        Order order = client.orders.create(body);

        Map<String, Object> resp = new HashMap<>();
        resp.put("orderId",  order.get("id"));
        resp.put("amount",   order.get("amount"));      // paise — frontend should use this
        resp.put("currency", order.get("currency"));
        resp.put("receipt",  order.get("receipt"));
        resp.put("status",   order.get("status"));
        resp.put("keyId",    keyId);                    // public key id for the checkout widget
        return resp;
    }

    /**
     * Verifies the HMAC SHA256 signature returned by Razorpay's checkout.
     * The signature is computed as: HMAC_SHA256(key_secret, order_id + "|" + payment_id).
     * We delegate to the SDK's Utils.verifyPaymentSignature so we never have to reimplement it.
     */
    public boolean verifySignature(VerifyPaymentRequest req) {
        try {
            JSONObject attrs = new JSONObject();
            attrs.put("razorpay_order_id",   req.getRazorpay_order_id());
            attrs.put("razorpay_payment_id", req.getRazorpay_payment_id());
            attrs.put("razorpay_signature",  req.getRazorpay_signature());
            return Utils.verifyPaymentSignature(attrs, keySecret);
        } catch (Exception e) {
            log.error("Signature verification failed: {}", e.getMessage());
            return false;
        }
    }

    public boolean isConfigured() { return client != null; }
}
