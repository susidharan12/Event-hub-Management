/* ──────────────────────────────────────────────────────────────────
   goldenTicket.js — renders a premium GOLD ticket from booking data.
   ------------------------------------------------------------------
   window.GoldenTicket.build({
     eventTitle, when, venue, place, seat, holder, code, category,
     vip:false, price
   })  → returns a DOM element. The element contains <img class="gt-qr">
   for the QR (set its .src after building). Self-styling; mobile-first.
   A VIP ticket (vip:true) switches to the VIP-pass treatment.
   ────────────────────────────────────────────────────────────────── */
(function () {
  if (window.GoldenTicket) return;

  const STYLE_ID = 'golden-ticket-styles';
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
    .gt{--gold1:#f9efc2;--gold2:#d4af37;--gold3:#b8860b;--ink:#3a2c05;--ink2:#6b5414;
      position:relative;display:flex;width:100%;max-width:640px;margin:0 auto;border-radius:18px;overflow:hidden;
      color:var(--ink);font-family:Inter,system-ui,sans-serif;
      background:linear-gradient(135deg,#bf953f 0%,#fcf6ba 18%,#d4af37 42%,#fbf5b7 62%,#aa771c 100%);
      box-shadow:0 18px 44px rgba(120,86,10,.35), inset 0 0 0 1px rgba(255,255,255,.35);}
    .gt::before{content:'';position:absolute;inset:0;pointer-events:none;
      background:linear-gradient(115deg,transparent 30%,rgba(255,255,255,.55) 47%,transparent 60%);
      mix-blend-mode:screen;opacity:.7;}
    .gt::after{content:'';position:absolute;inset:7px;border:1.5px solid rgba(90,66,8,.45);border-radius:12px;pointer-events:none;}
    .gt-main{flex:1 1 auto;min-width:0;padding:18px 20px;position:relative;z-index:1;}
    .gt-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;}
    .gt-cat{display:inline-flex;align-items:center;gap:6px;font-size:.62rem;font-weight:800;letter-spacing:.14em;
      text-transform:uppercase;color:var(--ink);background:rgba(255,255,255,.45);padding:4px 10px;border-radius:999px;
      border:1px solid rgba(90,66,8,.35);}
    .gt-admit{font-size:.6rem;font-weight:900;letter-spacing:.22em;text-transform:uppercase;color:var(--ink2);}
    .gt-title{font-family:'Space Grotesk',Inter,sans-serif;font-weight:800;letter-spacing:-.01em;line-height:1.05;
      font-size:clamp(1.3rem,5vw,1.9rem);color:#2a2000;margin:2px 0 12px;text-shadow:0 1px 0 rgba(255,255,255,.4);}
    .gt-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px 14px;margin-bottom:12px;}
    .gt-field{min-width:0;}
    .gt-lbl{display:block;font-size:.56rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--ink2);opacity:.85;}
    .gt-val{display:block;font-size:.9rem;font-weight:700;color:#2a2000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .gt-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:auto;
      border-top:1px dashed rgba(90,66,8,.4);padding-top:8px;font-size:.64rem;font-weight:700;color:var(--ink2);}
    /* Perforation between main + stub */
    .gt-perf{position:relative;flex:0 0 0;border-left:2px dashed rgba(90,66,8,.5);margin:14px 0;}
    .gt-perf::before,.gt-perf::after{content:'';position:absolute;left:-9px;width:16px;height:16px;border-radius:50%;
      background:#0b1020;}
    .gt-perf::before{top:-15px;} .gt-perf::after{bottom:-15px;}
    /* Stub */
    .gt-stub{flex:0 0 130px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;
      padding:16px 12px;position:relative;z-index:1;}
    .gt-seat-big{font-family:'Space Grotesk',Inter,sans-serif;font-weight:900;font-size:1.5rem;color:#2a2000;line-height:1;
      letter-spacing:.02em;text-shadow:0 1px 0 rgba(255,255,255,.4);}
    .gt-seat-cap{font-size:.55rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--ink2);margin-top:-4px;}
    .gt-qr-wrap{background:#fff;border-radius:10px;padding:6px;box-shadow:0 4px 12px rgba(90,66,8,.3);}
    .gt-qr{width:96px;height:96px;display:block;}
    .gt-scan{font-size:.52rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--ink2);}
    /* ── VIP variant: deeper gold + black accents + crown ───────────── */
    .gt.vip{background:linear-gradient(135deg,#caa84a 0%,#fff4c1 16%,#e6c558 40%,#fff7cf 60%,#9c7416 100%);
      box-shadow:0 20px 50px rgba(90,66,8,.5), inset 0 0 0 1px rgba(255,255,255,.4);}
    .gt.vip .gt-admit{color:#1a1306;}
    .gt.vip .gt-cat{background:#1a1306;color:#ffe98a;border-color:#1a1306;}
    .gt.vip .gt-perf{border-left-color:rgba(26,19,6,.6);}
    .gt.vip .gt-vipband{display:flex;}
    .gt-vipband{display:none;align-items:center;gap:6px;font-family:'Space Grotesk',Inter,sans-serif;
      font-weight:900;letter-spacing:.18em;font-size:.66rem;color:#1a1306;}
    /* Responsive: stub drops below on small screens */
    @media (max-width:520px){
      .gt{flex-direction:column;}
      .gt-perf{border-left:none;border-top:2px dashed rgba(90,66,8,.5);margin:0 14px;}
      .gt-perf::before{top:-9px;left:-15px;} .gt-perf::after{bottom:auto;top:-9px;left:auto;right:-15px;}
      .gt-stub{flex:0 0 auto;flex-direction:row;justify-content:space-around;width:100%;}
    }`;
    const el = document.createElement('style');
    el.id = STYLE_ID; el.textContent = css;
    document.head.appendChild(el);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function build(data) {
    injectStyles();
    data = data || {};
    const vip = !!data.vip;
    const venue = [data.venue, data.place].filter(Boolean).join(' · ') || '—';
    const seat = data.seat || 'GA';
    const admit = vip ? 'VIP PASS' : 'ADMIT ONE';

    const el = document.createElement('div');
    el.className = 'gt' + (vip ? ' vip' : '');
    el.innerHTML = `
      <div class="gt-main">
        <div class="gt-top">
          <span class="gt-cat">${vip ? '<i class="fas fa-crown"></i> ' : ''}${esc(data.category || 'Event')}</span>
          <span class="gt-admit">${admit}</span>
        </div>
        ${vip ? '<div class="gt-vipband"><i class="fas fa-star"></i> VIP ACCESS · ALL AREAS</div>' : ''}
        <div class="gt-title">${esc(data.eventTitle || 'Event')}</div>
        <div class="gt-grid">
          <div class="gt-field"><span class="gt-lbl">Venue</span><span class="gt-val">${esc(venue)}</span></div>
          <div class="gt-field"><span class="gt-lbl">Date &amp; Time</span><span class="gt-val">${esc(data.when || '—')}</span></div>
          <div class="gt-field"><span class="gt-lbl">Seat</span><span class="gt-val">${esc(seat)}</span></div>
          <div class="gt-field"><span class="gt-lbl">Ticket Holder</span><span class="gt-val">${esc(data.holder || '—')}</span></div>
        </div>
        <div class="gt-foot">
          <span><i class="fas fa-ticket"></i> ${esc(data.code || '')}</span>
          <span>${data.price > 0 ? '₹' + esc(data.price) : 'FREE'}</span>
        </div>
      </div>
      <div class="gt-perf"></div>
      <div class="gt-stub">
        <div>
          <div class="gt-seat-big">${esc(seat)}</div>
          <div class="gt-seat-cap">Seat</div>
        </div>
        <div class="gt-qr-wrap"><img class="gt-qr" alt="QR ${esc(data.code || '')}"></div>
        <div class="gt-scan">Scan at entry</div>
      </div>`;
    return el;
  }

  window.GoldenTicket = { build, injectStyles };
})();
