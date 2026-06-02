package com.payment.model;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateOrderRequest {

    /** Amount in INR rupees — converted to paise internally. */
    @NotNull
    @Min(value = 1, message = "Amount must be at least ₹1")
    private Double amount;

    /** Optional. Defaults to "INR". */
    private String currency = "INR";

    /** Optional internal reference (booking id, ticket id, etc.) — echoed back as receipt. */
    private String receipt;

    /** Optional caller-provided notes that travel with the Razorpay order. */
    private java.util.Map<String, String> notes;
}
