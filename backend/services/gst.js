/* ──────────────────────────────────────────────────────────────────
   gst.js — tiered GST on ticket price. Free tickets (₹0) are GST-free;
   the rate rises with the ticket's face value. Applied PER ticket/seat
   so mixed-price reserved bookings are taxed accurately.

   ⚙️  Change the slabs here (one place) to adjust rates/thresholds.
   ────────────────────────────────────────────────────────────────── */
const GST_TIERS = [
  { upTo: 100,      rate: 0.05 }, // ₹1–100      → 5%
  { upTo: 500,      rate: 0.12 }, // ₹101–500    → 12%
  { upTo: 1000,     rate: 0.18 }, // ₹501–1000   → 18%
  { upTo: Infinity, rate: 0.28 }  // ₹1000+      → 28%
];

function gstRate(price) {
  const p = Number(price) || 0;
  if (p <= 0) return 0;                       // free → no GST
  for (const t of GST_TIERS) if (p <= t.upTo) return t.rate;
  return GST_TIERS[GST_TIERS.length - 1].rate;
}

function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }

// GST for `qty` tickets all at the same unit `price` (general admission).
function gstForUnit(price, qty = 1) {
  return round2((Number(price) || 0) * (Number(qty) || 0) * gstRate(price));
}

// GST for a set of seats [{ price }] with possibly different prices (reserved).
function gstForSeats(seats) {
  return round2((seats || []).reduce((sum, s) => sum + (Number(s.price) || 0) * gstRate(s.price), 0));
}

module.exports = { GST_TIERS, gstRate, gstForUnit, gstForSeats, round2 };
