/* ──────────────────────────────────────────────────────────────────
   SeatMap.js — interactive LIVE seat-map component (vanilla, global).
   ------------------------------------------------------------------
   Usage:
     const map = new SeatMap({
       container: document.getElementById('seatmap'),
       eventId: 12,
       token: localStorage.getItem('token'),
       maxSeats: 10,
       onChange: (selected) => { ... }     // selected = [{label,price,zone}]
     });
   Reads GET /api/events/:id/seats, holds seats on click (5-min TTL) via
   POST .../seats/hold, releases via .../seats/release, and live-updates
   from the socket.io 'seat-update' broadcast. Self-styling + mobile-first.
   ────────────────────────────────────────────────────────────────── */
(function () {
  if (window.SeatMap) return;

  const STYLE_ID = 'seatmap-styles';
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
    .sm-wrap{font-family:Inter,system-ui,sans-serif;color:#1f2937;max-width:100%}
    /* Curved cinema screen */
    .sm-screen{margin:.3rem auto 1.5rem;max-width:80%;min-width:200px;height:30px;
      background:linear-gradient(180deg,#cbd5e1,#eef2f7);
      border-radius:60% 60% 10px 10px / 100% 100% 10px 10px;
      box-shadow:0 16px 26px -18px rgba(99,102,241,.9);
      color:#64748b;font-size:.66rem;font-weight:800;letter-spacing:.3em;
      text-align:center;line-height:26px;text-transform:uppercase}
    .sm-zone{margin:0 0 1.3rem}
    .sm-zone-head{display:flex;align-items:center;justify-content:center;gap:8px;margin:0 0 .6rem;
      font-size:.76rem;font-weight:800;color:#475569;text-transform:uppercase;letter-spacing:.04em}
    .sm-zone-dot{width:9px;height:9px;border-radius:50%}
    .sm-zone-price{color:#6366f1}
    /* Rows centred like a real auditorium; scroll only if wider than the box */
    .sm-rows{overflow-x:auto;-webkit-overflow-scrolling:touch;padding:2px 0 6px;text-align:center}
    .sm-row{display:inline-flex;align-items:center;gap:7px;margin:0 auto 7px;width:max-content}
    .sm-rowlabel{width:15px;flex:0 0 15px;text-align:center;font-size:.62rem;color:#94a3b8;font-weight:800}
    .sm-aisle{flex:0 0 16px}
    /* Theater seat: rounded-top "seat back" shape */
    .sm-seat{width:26px;height:26px;flex:0 0 26px;border-radius:8px 8px 4px 4px;border:1.5px solid #cbd5e1;
      background:#fff;font-size:.56rem;color:#94a3b8;cursor:pointer;display:grid;place-items:center;
      transition:transform .1s,background .15s,border-color .15s,color .15s;user-select:none}
    .sm-seat:hover:not(.booked):not(.held){border-color:#6366f1;color:#6366f1}
    .sm-seat:active{transform:scale(.86)}
    .sm-seat.sel{background:linear-gradient(135deg,#6366f1,#8b5cf6);border-color:transparent;color:#fff;font-weight:700;box-shadow:0 6px 14px rgba(99,102,241,.45)}
    .sm-seat.held{background:#fde68a;border-color:#f59e0b;color:#92400e;cursor:not-allowed}
    .sm-seat.booked{background:#e2e8f0;border-color:#e2e8f0;color:#cbd5e1;cursor:not-allowed}
    .sm-legend{display:flex;flex-wrap:wrap;gap:.8rem;justify-content:center;margin:1rem 0 0;padding-top:.9rem;border-top:1px dashed #e2e8f0}
    .sm-legend .lg{display:inline-flex;align-items:center;gap:6px;font-size:.72rem;color:#64748b}
    .sm-swatch{width:15px;height:15px;border-radius:5px 5px 3px 3px;border:1px solid rgba(0,0,0,.08)}
    .sm-sw-avail{background:#fff;border-color:#cbd5e1}
    .sm-sw-sel{background:linear-gradient(135deg,#6366f1,#8b5cf6);border-color:transparent}
    .sm-sw-held{background:#fde68a;border-color:#f59e0b}
    .sm-sw-booked{background:#e2e8f0;border-color:#e2e8f0}
    .sm-timer{margin:.8rem 0 0;text-align:center;font-size:.8rem;color:#b45309;font-weight:800;min-height:1.1em}
    .sm-empty{padding:1.4rem;text-align:center;color:#94a3b8}
    `;
    const el = document.createElement('style');
    el.id = STYLE_ID; el.textContent = css;
    document.head.appendChild(el);
  }

  const ZONE_COLORS = ['#6366f1', '#ec4899', '#06b6d4', '#f59e0b', '#10b981', '#8b5cf6'];

  class SeatMap {
    constructor(opts) {
      this.container = opts.container;
      this.eventId = opts.eventId;
      this.maxSeats = opts.maxSeats || 10;
      this.token = opts.token || '';
      this.apiBase = opts.apiBase || '';
      this.onChange = opts.onChange || function () {};
      this.selected = new Map();
      this.seats = [];
      this.zones = [];
      this.socket = null;
      this._holdInterval = null;
      this._holdExpiresAt = null;
      injectStyles();
      this._init();
    }

    async _init() { await this.load(); this._connectSocket(); }

    async load() {
      try {
        const res = await fetch(`${this.apiBase}/api/events/${this.eventId}/seats`);
        const data = await res.json();
        this.zones = data.zones || [];
        this.seats = data.seats || [];
        for (const label of [...this.selected.keys()]) {
          const s = this.seats.find((x) => x.label === label);
          if (!s || s.status === 'booked') this.selected.delete(label);
        }
        this._render();
        this._emitChange();
      } catch (e) {
        this.container.innerHTML = '<div class="sm-empty">Could not load the seat map. Please refresh.</div>';
      }
    }

    _connectSocket() {
      if (typeof io === 'undefined') return;
      try {
        this.socket = io(this.apiBase || window.location.origin, { path: '/socket.io', transports: ['websocket', 'polling'] });
        this.socket.on('connect', () => this.socket.emit('join-seat-room', this.eventId));
        this.socket.on('seat-update', (payload) => {
          if (!payload || Number(payload.eventId) !== Number(this.eventId)) return;
          (payload.seats || []).forEach((u) => {
            const seat = this.seats.find((s) => s.label === u.seat_label);
            if (!seat) return;
            if (this.selected.has(seat.label) && u.status === 'held') return; // our own hold echo
            if (this.selected.has(seat.label) && u.status === 'booked') {
              this.selected.delete(seat.label);
              this._emitChange();
            }
            seat.status = u.status;
          });
          this._paint();
        });
      } catch (e) { /* live updates optional */ }
    }

    _zoneColor(name) {
      const idx = this.zones.findIndex((z) => z.name === name);
      return ZONE_COLORS[(idx < 0 ? 0 : idx) % ZONE_COLORS.length];
    }

    _render() {
      if (!this.seats.length) {
        this.container.innerHTML = '<div class="sm-empty">No seats configured for this event yet.</div>';
        return;
      }
      const wrap = document.createElement('div');
      wrap.className = 'sm-wrap';
      wrap.innerHTML = `<div class="sm-screen">All eyes this way · Screen</div>`;

      const byZone = {};
      for (const s of this.seats) { (byZone[s.zone] = byZone[s.zone] || []).push(s); }

      Object.keys(byZone).forEach((zoneName) => {
        const zoneSeats = byZone[zoneName];
        const zoneMeta = this.zones.find((z) => z.name === zoneName) || {};
        const pMin = (zoneMeta.priceMin !== undefined) ? Number(zoneMeta.priceMin)
                   : (zoneMeta.price !== undefined ? Number(zoneMeta.price) : Number(zoneSeats[0].price));
        const pMax = (zoneMeta.priceMax !== undefined) ? Number(zoneMeta.priceMax) : pMin;
        const priceText = (pMin === pMax)
          ? (pMin > 0 ? '₹' + pMin : 'Free')
          : ('₹' + pMin + '–₹' + pMax);
        const zoneEl = document.createElement('div');
        zoneEl.className = 'sm-zone';
        zoneEl.innerHTML = `
          <div class="sm-zone-head">
            <span class="sm-zone-name"><span class="sm-zone-dot" style="background:${this._zoneColor(zoneName)}"></span>${zoneName}</span>
            <span class="sm-zone-price">${priceText}</span>
          </div>`;
        const rowsWrap = document.createElement('div');
        rowsWrap.className = 'sm-rows';

        const byRow = {};
        for (const s of zoneSeats) { (byRow[s.row] = byRow[s.row] || []).push(s); }
        Object.keys(byRow).forEach((rowLabel) => {
          const rowEl = document.createElement('div');
          rowEl.className = 'sm-row';
          rowEl.innerHTML = `<span class="sm-rowlabel">${rowLabel}</span>`;
          const rowSeats = byRow[rowLabel].sort((a, b) => a.num - b.num);
          const mid = Math.ceil(rowSeats.length / 2);
          rowSeats.forEach((seat, i) => {
            // Central aisle for rows wide enough to need one.
            if (i === mid && rowSeats.length > 6) {
              const gap = document.createElement('span');
              gap.className = 'sm-aisle';
              rowEl.appendChild(gap);
            }
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'sm-seat';
            b.dataset.label = seat.label;
            b.textContent = seat.num;
            b.title = `${seat.label} · ${Number(seat.price) > 0 ? '₹' + seat.price : 'Free'}`;
            b.addEventListener('click', () => this._toggleSeat(seat.label));
            rowEl.appendChild(b);
          });
          rowEl.insertAdjacentHTML('beforeend', `<span class="sm-rowlabel">${rowLabel}</span>`);
          rowsWrap.appendChild(rowEl);
        });
        zoneEl.appendChild(rowsWrap);
        wrap.appendChild(zoneEl);
      });

      const legend = document.createElement('div');
      legend.className = 'sm-legend';
      legend.innerHTML = `
        <span class="lg"><span class="sm-swatch sm-sw-avail"></span> Available</span>
        <span class="lg"><span class="sm-swatch sm-sw-sel"></span> Selected</span>
        <span class="lg"><span class="sm-swatch sm-sw-held"></span> On hold</span>
        <span class="lg"><span class="sm-swatch sm-sw-booked"></span> Sold</span>`;
      wrap.appendChild(legend);

      const timer = document.createElement('div');
      timer.className = 'sm-timer'; timer.id = 'sm-timer';
      wrap.appendChild(timer);

      this.container.innerHTML = '';
      this.container.appendChild(wrap);
      this._paint();
    }

    _paint() {
      this.container.querySelectorAll('.sm-seat').forEach((b) => {
        const seat = this.seats.find((s) => s.label === b.dataset.label);
        if (!seat) return;
        b.classList.remove('sel', 'held', 'booked');
        if (this.selected.has(seat.label)) b.classList.add('sel');
        else if (seat.status === 'booked') b.classList.add('booked');
        else if (seat.status === 'held') b.classList.add('held');
      });
    }

    async _toggleSeat(label) {
      const seat = this.seats.find((s) => s.label === label);
      if (!seat) return;
      if (this.selected.has(label)) {
        this.selected.delete(label);
        this._paint(); this._emitChange();
        await this._release([label]);
        return;
      }
      if (seat.status === 'booked' || seat.status === 'held') return;
      if (this.selected.size >= this.maxSeats) { this._notify(`You can select up to ${this.maxSeats} seats.`); return; }
      const ok = await this._hold([label]);
      if (ok) {
        this.selected.set(label, { label: seat.label, price: Number(seat.price), zone: seat.zone });
        seat.status = 'held';
        this._paint(); this._emitChange();
      }
    }

    async _hold(labels) {
      if (!this.token) { this._notify('Please log in to select seats.'); return false; }
      try {
        const res = await fetch(`${this.apiBase}/api/events/${this.eventId}/seats/hold`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
          body: JSON.stringify({ seat_labels: labels })
        });
        const data = await res.json();
        if (!res.ok || !data.ok) { this._notify(data.reason || 'That seat was just taken.'); await this.load(); return false; }
        this._startTimer(data.expires_at);
        return true;
      } catch (e) { this._notify('Network error — try again.'); return false; }
    }

    async _release(labels) {
      if (!this.token) return;
      try {
        await fetch(`${this.apiBase}/api/events/${this.eventId}/seats/release`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}` },
          body: JSON.stringify({ seat_labels: labels })
        });
      } catch (e) { /* best-effort */ }
      if (this.selected.size === 0) this._stopTimer();
    }

    _startTimer(expiresAtIso) {
      this._holdExpiresAt = new Date(expiresAtIso).getTime();
      if (this._holdInterval) return;
      const tick = () => {
        const el = document.getElementById('sm-timer');
        if (!el) return;
        if (this.selected.size === 0) { el.textContent = ''; return; }
        const left = Math.max(0, this._holdExpiresAt - Date.now());
        if (left <= 0) {
          el.textContent = 'Your seat hold expired — please reselect.';
          this.selected.clear(); this._stopTimer(); this._emitChange(); this.load();
          return;
        }
        const m = Math.floor(left / 60000);
        const s = Math.floor((left % 60000) / 1000);
        el.textContent = `⏱ Seats held for ${m}:${String(s).padStart(2, '0')}`;
      };
      tick();
      this._holdInterval = setInterval(tick, 1000);
    }

    _stopTimer() {
      if (this._holdInterval) { clearInterval(this._holdInterval); this._holdInterval = null; }
      const el = document.getElementById('sm-timer'); if (el) el.textContent = '';
    }

    _emitChange() { try { this.onChange(this.getSelected()); } catch (e) {} }
    _notify(msg) {
      if (typeof window.showToast === 'function') window.showToast(msg);
      else if (typeof window.toast === 'function') window.toast(msg);
      else alert(msg);
    }

    getSelected() { return [...this.selected.values()]; }
    getSelectedLabels() { return [...this.selected.keys()]; }
    getTotal() { return this.getSelected().reduce((sum, s) => sum + Number(s.price || 0), 0); }
    count() { return this.selected.size; }

    destroy() {
      const labels = this.getSelectedLabels();
      if (labels.length) this._release(labels);
      this._stopTimer();
      if (this.socket) { try { this.socket.disconnect(); } catch (e) {} }
    }
  }

  window.SeatMap = SeatMap;
})();
