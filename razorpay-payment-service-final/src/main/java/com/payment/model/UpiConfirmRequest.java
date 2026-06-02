package com.payment.model;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * Manual UPI confirmation — used when the customer scans the organizer's
 * UPI QR code with their own UPI app and pays directly. The frontend
 * collects the customer's UTR / transaction reference and POSTs it here
 * for the organizer to acknowledge.
 */
@Data
public class UpiConfirmRequest {
    /** Booking / order reference inside the host application (EventHub). */
    @NotBlank private String reference;

    /** Amount paid (in rupees) — used as a sanity check. */
    @NotNull @Min(1)
    private Double amount;

    /** UTR / UPI transaction reference number provided by the customer. */
    @NotBlank private String utr;

    /** Optional UPI ID the customer paid from. */
    private String payerUpi;
}
