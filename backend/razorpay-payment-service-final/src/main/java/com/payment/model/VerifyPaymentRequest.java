package com.payment.model;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class VerifyPaymentRequest {
    @NotBlank private String razorpay_order_id;
    @NotBlank private String razorpay_payment_id;
    @NotBlank private String razorpay_signature;
}
