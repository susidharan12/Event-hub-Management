/**
 * EventHub real-time chat widget
 * ------------------------------
 *  Drop-in floating chat for both attendees and organizers.
 *
 *  Drop the script anywhere with:   <script src="/Public/js/chat-widget.js"></script>
 *
 *  Behavior
 *  --------
 *  • Renders a floating "bot" button in the bottom-right with a small
 *    "Hi there! Need help?" speech bubble that softly animates in on load.
 *  • Click → opens a chat panel:
 *      - For an attendee: shows a list of their booked events. Each row
 *        opens a thread with that event's organizer.
 *      - For an organizer: shows existing conversations + "Pick an event"
 *        view that lists their events and the people who booked them.
 *  • Inside a thread, messages are polled every 3s for "real-time" feel.
 *  • Unread badge on the floating button polls every 8s when closed.
 *
 *  Requires localStorage to have either `auth_user` or `user`, and one of
 *  the standard token keys. Silently no-ops on logged-out pages.
 */
(function () {
  if (window.__ehChatWidgetLoaded) return;
  window.__ehChatWidgetLoaded = true;

  // Skip on auth pages and the marketing root.
  const path = location.pathname.toLowerCase();
  if (path.includes('/auth/') || path === '/index.html' || path === '/' || path === '') return;
  if (path.endsWith('/verify.html')) return; // standalone scan landing — no chat needed

  // ─────────── Auth ───────────
  function getToken() {
    return localStorage.getItem('auth_token')
        || localStorage.getItem('token')
        || localStorage.getItem('authToken')
        || localStorage.getItem('eventhub_token');
  }
  function getUser() {
    try {
      const j = localStorage.getItem('auth_user') || localStorage.getItem('user');
      return j ? JSON.parse(j) : null;
    } catch (_) { return null; }
  }
  const TOKEN = getToken();
  const ME    = getUser();
  if (!TOKEN || !ME || !ME.id) return; // not signed in — bail out silently
  const IS_ORGANIZER = String(ME.role || '').toLowerCase() === 'organizer';

  const API_BASE   = 'http://localhost:3000/api';
  const SERVER_URL = 'http://localhost:3000';

  function authedFetch(url, opts = {}) {
    return fetch(API_BASE + url, Object.assign({}, opts, {
      headers: Object.assign({ Authorization: 'Bearer ' + TOKEN }, opts.headers || {})
    }));
  }
  function authedJSON(url, opts = {}) {
    const body = opts.body && typeof opts.body === 'object' ? JSON.stringify(opts.body) : opts.body;
    return fetch(API_BASE + url, Object.assign({}, opts, {
      body,
      headers: Object.assign(
        { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
        opts.headers || {}
      )
    }));
  }

  // ─────────── Utilities ───────────
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function relTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60)     return 'just now';
    if (diff < 3600)   return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400)  return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return d.toLocaleDateString();
  }
  function avatarUrl(u) {
    if (!u || !u.avatar && !u.profile_image) return null;
    const v = u.avatar || u.profile_image;
    if (!v) return null;
    return v.startsWith('http') ? v : SERVER_URL + v;
  }
  function initials(name) {
    if (!name) return '?';
    const p = name.trim().split(/\s+/);
    return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase();
  }
  // Online status — based on `last_seen` from the API.
  function presence(lastSeenIso) {
    if (!lastSeenIso) return { online: false, label: '' };
    const t = new Date(lastSeenIso).getTime();
    if (isNaN(t)) return { online: false, label: '' };
    const diffSec = (Date.now() - t) / 1000;
    if (diffSec < 60)     return { online: true,  label: 'Online' };
    if (diffSec < 3600)   return { online: false, label: `Last seen ${Math.floor(diffSec/60)}m ago` };
    if (diffSec < 86400)  return { online: false, label: `Last seen ${Math.floor(diffSec/3600)}h ago` };
    return { online: false, label: `Last seen ${Math.floor(diffSec/86400)}d ago` };
  }

  // ─────────── One-shot CSS ───────────
  if (!document.getElementById('eh-chat-style')) {
    const css = `
      .eh-chat-fab {
        position: fixed; bottom: 22px; right: 22px;
        width: 60px; height: 60px;
        border-radius: 50%;
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 35%, #ec4899 100%);
        color: white;
        display: grid; place-items: center;
        box-shadow: 0 14px 30px rgba(139, 92, 246, 0.5);
        cursor: pointer; border: none;
        z-index: 99800;
        transition: transform 0.25s cubic-bezier(.2,.9,.3,1.2), box-shadow 0.25s ease;
        font-size: 1.4rem;
        animation: ehFabBob 4s ease-in-out infinite;
      }
      .eh-chat-fab:hover { transform: scale(1.08); box-shadow: 0 20px 38px rgba(236,72,153,0.55); }
      @keyframes ehFabBob {
        0%,100% { transform: translateY(0); }
        50%     { transform: translateY(-4px); }
      }
      .eh-chat-fab.has-unread::after {
        content: attr(data-unread);
        position: absolute; top: -4px; right: -4px;
        min-width: 22px; height: 22px;
        padding: 0 6px;
        border-radius: 999px;
        background: #ef4444;
        color: white; font-size: 0.72rem; font-weight: 800;
        display: grid; place-items: center;
        border: 2px solid white;
      }

      .eh-chat-tip {
        position: fixed; bottom: 32px; right: 92px;
        background: white;
        color: #1f2937;
        padding: 10px 14px;
        border-radius: 14px;
        box-shadow: 0 16px 36px rgba(15,23,42,0.18);
        font-size: 0.88rem; font-weight: 600;
        font-family: 'Inter','Segoe UI',sans-serif;
        z-index: 99799;
        display: flex; align-items: center; gap: 8px;
        animation: ehTipIn 0.45s cubic-bezier(.2,.9,.3,1.2) 1.6s both;
        cursor: pointer;
        max-width: 220px;
      }
      .eh-chat-tip::after {
        content: ''; position: absolute;
        right: -8px; bottom: 14px;
        width: 14px; height: 14px;
        background: white;
        transform: rotate(45deg);
        box-shadow: 4px -4px 12px -3px rgba(15,23,42,0.06);
      }
      .eh-chat-tip i { color: #ec4899; }
      .eh-chat-tip-close {
        background: transparent; border: none; cursor: pointer;
        color: #94a3b8; padding: 0 0 0 4px;
        font-size: 1rem;
      }
      .eh-chat-tip-close:hover { color: #1f2937; }
      @keyframes ehTipIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      .eh-chat-tip.eh-out { animation: ehTipOut 0.3s ease both; }
      @keyframes ehTipOut { to { opacity: 0; transform: translateY(8px); } }

      .eh-chat-panel {
        position: fixed; bottom: 96px; right: 22px;
        width: min(380px, calc(100vw - 32px));
        height: min(560px, calc(100vh - 130px));
        background: white;
        border-radius: 22px;
        box-shadow: 0 30px 60px rgba(15,23,42,0.28);
        z-index: 99801;
        display: none;
        flex-direction: column;
        overflow: hidden;
        font-family: 'Inter','Segoe UI',sans-serif;
        animation: ehPanelIn 0.32s cubic-bezier(.2,.9,.3,1.2);
      }
      .eh-chat-panel.show { display: flex; }
      @keyframes ehPanelIn {
        from { opacity: 0; transform: translateY(20px) scale(0.96); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }

      .eh-chat-head {
        position: relative;
        padding: 14px 16px;
        background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 35%, #ec4899 100%);
        color: white;
        display: flex; align-items: center; gap: 12px;
        overflow: hidden;
      }
      .eh-chat-head::after {
        content: ''; position: absolute;
        width: 140px; height: 140px; border-radius: 50%;
        background: rgba(255,255,255,0.18);
        top: -90px; right: -50px;
      }
      .eh-chat-head-back {
        background: rgba(255,255,255,0.18);
        border: none;
        width: 30px; height: 30px;
        border-radius: 50%;
        color: white; cursor: pointer;
        display: none;
        align-items: center; justify-content: center;
        transition: background 0.2s;
        flex-shrink: 0;
      }
      .eh-chat-head-back:hover { background: rgba(255,255,255,0.32); }
      .eh-chat-head-avatar {
        width: 36px; height: 36px;
        border-radius: 50%;
        background: rgba(255,255,255,0.22);
        display: grid; place-items: center;
        font-weight: 800; font-size: 0.85rem;
        flex-shrink: 0; overflow: hidden;
      }
      .eh-chat-head-avatar img { width: 100%; height: 100%; object-fit: cover; }
      .eh-chat-head-info { flex: 1; min-width: 0; line-height: 1.2; position: relative; z-index: 1; }
      .eh-chat-head-info .title { font-weight: 800; font-size: 0.98rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .eh-chat-head-info .subtitle { font-size: 0.78rem; opacity: 0.88; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .eh-chat-head-close {
        background: rgba(255,255,255,0.18);
        border: none;
        width: 30px; height: 30px;
        border-radius: 50%;
        color: white; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: background 0.2s;
        position: relative; z-index: 1;
        flex-shrink: 0;
      }
      .eh-chat-head-close:hover { background: rgba(255,255,255,0.32); }

      .eh-chat-body {
        flex: 1; overflow-y: auto;
        background: linear-gradient(180deg, #fafbff 0%, #ffffff 100%);
        padding: 12px;
      }
      .eh-chat-body::-webkit-scrollbar { width: 5px; }
      .eh-chat-body::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.25); border-radius: 999px; }

      .eh-chat-list-row {
        display: flex; align-items: center; gap: 12px;
        padding: 10px 12px; border-radius: 14px; cursor: pointer;
        transition: background 0.2s ease, transform 0.2s ease;
        margin-bottom: 6px;
      }
      .eh-chat-list-row:hover { background: rgba(99,102,241,0.07); transform: translateX(2px); }
      .eh-chat-list-avatar {
        width: 44px; height: 44px;
        border-radius: 50%;
        background: linear-gradient(135deg, #6366f1, #ec4899);
        display: grid; place-items: center;
        color: white; font-weight: 800;
        flex-shrink: 0; overflow: hidden;
        font-size: 0.95rem;
      }
      .eh-chat-list-avatar img { width: 100%; height: 100%; object-fit: cover; }
      .eh-chat-list-avatar { position: relative; }
      .eh-presence-dot {
        position: absolute;
        right: -1px; bottom: -1px;
        width: 13px; height: 13px;
        border-radius: 50%;
        border: 2px solid white;
        background: #94a3b8;       /* offline default */
        z-index: 1;
      }
      .eh-presence-dot.online {
        background: #10b981;       /* online green */
        box-shadow: 0 0 0 0 rgba(16,185,129,0.5);
        animation: ehDotPulse 1.6s ease-out infinite;
      }
      @keyframes ehDotPulse {
        0%   { box-shadow: 0 0 0 0 rgba(16,185,129,0.55); }
        80%  { box-shadow: 0 0 0 6px rgba(16,185,129,0); }
        100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
      }
      .eh-head-presence-dot {
        position: absolute;
        right: -2px; bottom: -2px;
        width: 12px; height: 12px;
        border-radius: 50%;
        border: 2px solid #6366f1;
        background: #94a3b8;
        z-index: 2;
      }
      .eh-head-presence-dot.online {
        background: #10b981;
        animation: ehDotPulse 1.6s ease-out infinite;
      }
      .eh-chat-head-avatar { position: relative; }
      .eh-chat-list-meta { flex: 1; min-width: 0; line-height: 1.25; }
      .eh-chat-list-meta .top { display: flex; justify-content: space-between; gap: 8px; }
      .eh-chat-list-meta .name { font-weight: 700; font-size: 0.95rem; color: #1f2937; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .eh-chat-list-meta .when { font-size: 0.7rem; color: #94a3b8; flex-shrink: 0; }
      .eh-chat-list-meta .preview { color: #64748b; font-size: 0.83rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .eh-chat-list-meta .preview b { color: #6366f1; font-weight: 700; }
      .eh-chat-list-row .pill {
        margin-left: 8px;
        background: #ef4444; color: white;
        font-size: 0.72rem; font-weight: 800;
        padding: 2px 7px; border-radius: 999px;
      }

      .eh-chat-tabs {
        display: flex; gap: 6px;
        padding: 8px 12px 4px;
        border-bottom: 1px solid #f1f5f9;
        background: #fafbff;
      }
      .eh-chat-tab {
        flex: 1;
        padding: 8px 10px;
        font-size: 0.85rem; font-weight: 700;
        background: transparent; border: none;
        border-radius: 10px;
        color: #64748b; cursor: pointer;
        transition: all 0.2s;
        font-family: inherit;
      }
      .eh-chat-tab:hover { background: rgba(99,102,241,0.07); color: #6366f1; }
      .eh-chat-tab.active {
        background: linear-gradient(135deg, #6366f1, #ec4899);
        color: white;
        box-shadow: 0 4px 10px rgba(99,102,241,0.35);
      }

      .eh-chat-empty {
        text-align: center; padding: 2rem 1rem; color: #64748b;
      }
      .eh-chat-empty i {
        font-size: 2rem;
        background: linear-gradient(135deg, #6366f1, #ec4899);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        margin-bottom: 0.5rem;
        display: block;
      }
      .eh-chat-empty .sub { font-size: 0.85rem; color: #94a3b8; margin-top: 4px; }

      .eh-msg {
        max-width: 78%;
        padding: 9px 12px;
        margin-bottom: 8px;
        border-radius: 16px;
        font-size: 0.92rem;
        line-height: 1.4;
        position: relative;
        word-wrap: break-word;
        animation: ehMsgIn 0.3s ease;
      }
      .eh-msg.theirs {
        background: white;
        color: #1f2937;
        border-top-left-radius: 6px;
        margin-right: auto;
        border: 1px solid #f1f5f9;
        box-shadow: 0 2px 6px rgba(15,23,42,0.04);
      }
      .eh-msg.mine {
        background: linear-gradient(135deg, #6366f1, #ec4899);
        color: white;
        border-top-right-radius: 6px;
        margin-left: auto;
      }
      .eh-msg .time {
        font-size: 0.66rem;
        opacity: 0.7;
        margin-top: 4px;
        display: block;
      }
      @keyframes ehMsgIn {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      .eh-chat-input {
        display: flex; gap: 8px;
        padding: 10px 12px;
        border-top: 1px solid #f1f5f9;
        background: white;
      }
      .eh-chat-input textarea {
        flex: 1; min-height: 38px; max-height: 90px;
        padding: 9px 12px;
        border-radius: 18px;
        border: 1px solid #e5e7eb;
        font-family: inherit;
        font-size: 0.92rem;
        resize: none;
        outline: none;
        transition: border-color 0.2s, box-shadow 0.2s;
      }
      .eh-chat-input textarea:focus {
        border-color: #6366f1;
        box-shadow: 0 0 0 3px rgba(99,102,241,0.15);
      }
      .eh-chat-input button {
        width: 38px; height: 38px;
        border-radius: 50%;
        border: none;
        background: linear-gradient(135deg, #6366f1, #ec4899);
        color: white; cursor: pointer;
        display: grid; place-items: center;
        transition: transform 0.2s;
        flex-shrink: 0;
        align-self: flex-end;
      }
      .eh-chat-input button:hover { transform: scale(1.08); }
      .eh-chat-input button:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

      .eh-chat-loading {
        text-align: center; padding: 2rem 1rem; color: #94a3b8;
        font-size: 0.85rem;
      }
      .eh-chat-loading i { animation: ehSpin 0.8s linear infinite; margin-right: 6px; }
      @keyframes ehSpin { to { transform: rotate(360deg); } }
    `;
    const s = document.createElement('style');
    s.id = 'eh-chat-style';
    s.textContent = css;
    document.head.appendChild(s);
  }

  // ─────────── DOM scaffolding ───────────
  const fab = document.createElement('button');
  fab.className = 'eh-chat-fab';
  fab.setAttribute('aria-label', 'Open chat');
  fab.innerHTML = '<i class="fas fa-robot"></i>';

  const tip = document.createElement('div');
  tip.className = 'eh-chat-tip';
  tip.innerHTML = '<i class="fas fa-comment-dots"></i> Hi there! Need help?';
  const tipClose = document.createElement('button');
  tipClose.className = 'eh-chat-tip-close';
  tipClose.setAttribute('aria-label', 'Dismiss tip');
  tipClose.innerHTML = '&times;';
  tip.appendChild(tipClose);

  const panel = document.createElement('div');
  panel.className = 'eh-chat-panel';
  panel.innerHTML = `
    <div class="eh-chat-head">
      <button class="eh-chat-head-back" aria-label="Back"><i class="fas fa-arrow-left"></i></button>
      <div class="eh-chat-head-avatar"><i class="fas fa-comments"></i></div>
      <div class="eh-chat-head-info">
        <div class="title">Messages</div>
        <div class="subtitle">${IS_ORGANIZER ? 'Chat with attendees of your events' : 'Chat with the event organizer'}</div>
      </div>
      <button class="eh-chat-head-close" aria-label="Close"><i class="fas fa-times"></i></button>
    </div>
    <div class="eh-chat-tabs" data-tabs>
      <button class="eh-chat-tab active" data-tab="threads"><i class="fas fa-comment"></i> Conversations</button>
      <button class="eh-chat-tab" data-tab="picker">${IS_ORGANIZER ? '<i class="fas fa-users"></i> My events' : '<i class="fas fa-plus"></i> Start new'}</button>
    </div>
    <div class="eh-chat-body" data-body></div>
    <div class="eh-chat-input" data-input style="display:none;">
      <textarea placeholder="Type a message…" rows="1"></textarea>
      <button type="button" aria-label="Send"><i class="fas fa-paper-plane"></i></button>
    </div>
  `;

  document.body.appendChild(fab);
  document.body.appendChild(tip);
  document.body.appendChild(panel);

  const head      = panel.querySelector('.eh-chat-head');
  const headBack  = panel.querySelector('.eh-chat-head-back');
  const headAva   = panel.querySelector('.eh-chat-head-avatar');
  const headTitle = panel.querySelector('.eh-chat-head-info .title');
  const headSub   = panel.querySelector('.eh-chat-head-info .subtitle');
  const headClose = panel.querySelector('.eh-chat-head-close');
  const tabs      = panel.querySelector('[data-tabs]');
  const body      = panel.querySelector('[data-body]');
  const inputBar  = panel.querySelector('[data-input]');
  const inputArea = inputBar.querySelector('textarea');
  const sendBtn   = inputBar.querySelector('button');

  // ─────────── State ───────────
  let view       = 'threads'; // threads | picker | thread
  let threadKey  = null;       // { eventId, otherId, eventTitle, otherName, otherAvatar }
  let pollTimer  = null;
  let unreadTimer= null;
  let isOpen     = false;

  // ─────────── Render: threads list ───────────
  async function renderThreads() {
    headBack.style.display = 'none';
    inputBar.style.display = 'none';
    tabs.style.display = 'flex';
    setTab('threads');
    body.innerHTML = '<div class="eh-chat-loading"><i class="fas fa-spinner"></i>Loading…</div>';
    try {
      const r = await authedFetch('/messages/threads');
      const data = await r.json();
      const threads = (data.threads || []);
      if (threads.length === 0) {
        body.innerHTML = `
          <div class="eh-chat-empty">
            <i class="fas fa-comments"></i>
            <div><b>No conversations yet</b></div>
            <div class="sub">${IS_ORGANIZER ? 'Once attendees message you, threads appear here.' : 'Tap "Start new" to message an organizer about an event you booked.'}</div>
          </div>`;
        return;
      }
      body.innerHTML = threads.map(t => {
        const ava = t.other_avatar
          ? `<img src="${esc(t.other_avatar.startsWith('http') ? t.other_avatar : SERVER_URL + t.other_avatar)}" alt="">`
          : esc(initials(t.other_name));
        const previewPrefix = (t.last_sender_id === ME.id) ? '<b>You:</b> ' : '';
        const pres = presence(t.other_last_seen);
        return `
          <div class="eh-chat-list-row" data-event-id="${t.event_id}" data-other-id="${t.other_id}"
               data-event-title="${esc(t.event_title)}" data-other-name="${esc(t.other_name)}"
               data-other-avatar="${esc(t.other_avatar || '')}"
               data-other-last-seen="${esc(t.other_last_seen || '')}">
            <div class="eh-chat-list-avatar">
              ${ava}
              <span class="eh-presence-dot ${pres.online ? 'online' : ''}" title="${esc(pres.label || 'Offline')}"></span>
            </div>
            <div class="eh-chat-list-meta">
              <div class="top">
                <span class="name">${esc(t.other_name)}</span>
                <span class="when">${esc(relTime(t.last_at))}</span>
              </div>
              <div class="preview">${previewPrefix}${esc(t.last_body || '—')}</div>
              <div class="preview" style="font-size:0.72rem;color:#94a3b8;display:flex;align-items:center;gap:6px;">
                <span><i class="fas fa-calendar-day"></i> ${esc(t.event_title)}</span>
                <span style="margin-left:auto;color:${pres.online ? '#10b981' : '#94a3b8'};font-weight:${pres.online ? '700' : '500'};">${pres.online ? '● Online' : esc(pres.label || 'Offline')}</span>
              </div>
            </div>
            ${t.unread > 0 ? `<span class="pill">${t.unread}</span>` : ''}
          </div>
        `;
      }).join('');
      body.querySelectorAll('.eh-chat-list-row').forEach(row => {
        row.addEventListener('click', () => {
          openThread({
            eventId:      parseInt(row.dataset.eventId, 10),
            otherId:      parseInt(row.dataset.otherId, 10),
            eventTitle:   row.dataset.eventTitle,
            otherName:    row.dataset.otherName,
            otherAvatar:  row.dataset.otherAvatar,
            otherLastSeen:row.dataset.otherLastSeen || ''
          });
        });
      });
    } catch (err) {
      console.error('Threads render error', err);
      body.innerHTML = `<div class="eh-chat-empty"><i class="fas fa-triangle-exclamation"></i><div>Couldn't load conversations</div></div>`;
    }
  }

  // ─────────── Render: picker (start a new thread) ───────────
  async function renderPicker() {
    headBack.style.display = 'none';
    inputBar.style.display = 'none';
    tabs.style.display = 'flex';
    setTab('picker');
    body.innerHTML = '<div class="eh-chat-loading"><i class="fas fa-spinner"></i>Loading…</div>';
    try {
      if (IS_ORGANIZER) {
        // For organizers: show their events + the people who booked each.
        const r = await authedFetch('/events/my-events');
        const events = await r.json();
        if (!Array.isArray(events) || events.length === 0) {
          body.innerHTML = `<div class="eh-chat-empty"><i class="fas fa-calendar"></i><div>You haven't created any events yet.</div></div>`;
          return;
        }
        body.innerHTML = events.map(ev => `
          <div class="eh-chat-list-row" data-org-event="${ev.id}" data-event-title="${esc(ev.title || 'Event')}">
            <div class="eh-chat-list-avatar">
              ${ev.image_url
                ? `<img src="${esc(SERVER_URL + ev.image_url)}" alt="">`
                : `<i class="fas fa-calendar-day"></i>`}
            </div>
            <div class="eh-chat-list-meta">
              <div class="top">
                <span class="name">${esc(ev.title)}</span>
                <span class="when">${esc(relTime(ev.created_at))}</span>
              </div>
              <div class="preview">Tap to see attendees you can message</div>
            </div>
          </div>
        `).join('');
        body.querySelectorAll('[data-org-event]').forEach(row => {
          row.addEventListener('click', () => {
            renderEventAttendees(parseInt(row.dataset.orgEvent, 10), row.dataset.eventTitle);
          });
        });
      } else {
        // For attendees: show events they've booked, with the organizer.
        const r = await authedFetch('/messages/my-events');
        const data = await r.json();
        const events = data.events || [];
        if (events.length === 0) {
          body.innerHTML = `<div class="eh-chat-empty"><i class="fas fa-ticket"></i><div>Book an event first to start a chat.</div><div class="sub">The organizer will answer here.</div></div>`;
          return;
        }
        body.innerHTML = events.map(ev => {
          const ava = ev.organizer_avatar
            ? `<img src="${esc(ev.organizer_avatar.startsWith('http') ? ev.organizer_avatar : SERVER_URL + ev.organizer_avatar)}" alt="">`
            : esc(initials(ev.organizer_name));
          return `
            <div class="eh-chat-list-row"
                 data-event-id="${ev.id}" data-other-id="${ev.organizer_id}"
                 data-event-title="${esc(ev.title)}" data-other-name="${esc(ev.organizer_name)}"
                 data-other-avatar="${esc(ev.organizer_avatar || '')}">
              <div class="eh-chat-list-avatar">${ava}</div>
              <div class="eh-chat-list-meta">
                <div class="top">
                  <span class="name">${esc(ev.title)}</span>
                </div>
                <div class="preview"><b>${esc(ev.organizer_name)}</b>${ev.organizer_org ? ' · ' + esc(ev.organizer_org) : ''}</div>
                <div class="preview" style="font-size:0.72rem;color:#94a3b8;">Tap to message the organizer</div>
              </div>
            </div>
          `;
        }).join('');
        body.querySelectorAll('.eh-chat-list-row').forEach(row => {
          row.addEventListener('click', () => {
            openThread({
              eventId:    parseInt(row.dataset.eventId, 10),
              otherId:    parseInt(row.dataset.otherId, 10),
              eventTitle: row.dataset.eventTitle,
              otherName:  row.dataset.otherName,
              otherAvatar:row.dataset.otherAvatar
            });
          });
        });
      }
    } catch (err) {
      console.error('Picker render error', err);
      body.innerHTML = `<div class="eh-chat-empty"><i class="fas fa-triangle-exclamation"></i><div>Couldn't load list</div></div>`;
    }
  }

  // Organizer drill-down: show attendees of an event they own
  async function renderEventAttendees(eventId, eventTitle) {
    headBack.style.display = 'flex';
    headTitle.textContent = eventTitle;
    headSub.textContent = 'Pick an attendee to message';
    body.innerHTML = '<div class="eh-chat-loading"><i class="fas fa-spinner"></i>Loading attendees…</div>';
    try {
      const r = await authedFetch(`/messages/event-attendees/${eventId}`);
      const data = await r.json();
      const list = data.attendees || [];
      if (list.length === 0) {
        body.innerHTML = `<div class="eh-chat-empty"><i class="fas fa-user-slash"></i><div>No bookings yet for this event.</div></div>`;
        return;
      }
      body.innerHTML = list.map(a => {
        const ava = a.profile_image
          ? `<img src="${esc(a.profile_image.startsWith('http') ? a.profile_image : SERVER_URL + a.profile_image)}" alt="">`
          : esc(initials(a.name));
        return `
          <div class="eh-chat-list-row"
               data-event-id="${eventId}" data-other-id="${a.id}"
               data-event-title="${esc(eventTitle)}" data-other-name="${esc(a.name)}"
               data-other-avatar="${esc(a.profile_image || '')}">
            <div class="eh-chat-list-avatar">${ava}</div>
            <div class="eh-chat-list-meta">
              <div class="top">
                <span class="name">${esc(a.name)}</span>
                <span class="when">${esc(relTime(a.last_booked_at))}</span>
              </div>
              <div class="preview">${esc(a.email || '')}</div>
            </div>
          </div>
        `;
      }).join('');
      body.querySelectorAll('.eh-chat-list-row').forEach(row => {
        row.addEventListener('click', () => {
          openThread({
            eventId:      parseInt(row.dataset.eventId, 10),
            otherId:      parseInt(row.dataset.otherId, 10),
            eventTitle:   row.dataset.eventTitle,
            otherName:    row.dataset.otherName,
            otherAvatar:  row.dataset.otherAvatar,
            otherLastSeen:row.dataset.otherLastSeen || ''
          });
        });
      });
    } catch (err) {
      body.innerHTML = `<div class="eh-chat-empty"><i class="fas fa-triangle-exclamation"></i><div>Couldn't load attendees</div></div>`;
    }
  }

  // ─────────── Render: thread (open conversation) ───────────
  function setHeaderForThread(t) {
    headBack.style.display = 'flex';
    headTitle.textContent = t.otherName || 'Conversation';
    // Subtitle shows event title + live presence (last_seen).
    const pres = presence(t.otherLastSeen);
    const presHtml = pres.online
      ? '<span style="color:#a7f3d0;font-weight:700;">● Online</span>'
      : pres.label
        ? `<span style="opacity:0.85;">${esc(pres.label)}</span>`
        : '<span style="opacity:0.7;">Offline</span>';
    headSub.innerHTML = `${esc(t.eventTitle || '')}${t.eventTitle ? ' · ' : ''}${presHtml}`;
    if (t.otherAvatar) {
      headAva.innerHTML = `<img src="${esc(t.otherAvatar.startsWith('http') ? t.otherAvatar : SERVER_URL + t.otherAvatar)}" alt="">`;
    } else {
      headAva.innerHTML = `<span>${esc(initials(t.otherName))}</span>`;
    }
    // Add / refresh the presence dot on the header avatar
    headAva.querySelector('.eh-head-presence-dot')?.remove();
    const dot = document.createElement('span');
    dot.className = 'eh-head-presence-dot' + (pres.online ? ' online' : '');
    dot.title = pres.label || 'Offline';
    headAva.appendChild(dot);
  }

  async function openThread(t) {
    threadKey = t;
    view = 'thread';
    setHeaderForThread(t);
    tabs.style.display = 'none';
    inputBar.style.display = 'flex';
    body.innerHTML = '<div class="eh-chat-loading"><i class="fas fa-spinner"></i>Loading messages…</div>';
    inputArea.value = '';
    inputArea.focus();
    await refreshThread(true);
    startThreadPolling();
  }

  let lastRenderedIds = new Set();
  async function refreshThread(initial = false) {
    if (!threadKey) return;
    try {
      const r = await authedFetch(`/messages/thread/${threadKey.eventId}/${threadKey.otherId}`);
      if (!r.ok) return;
      const data = await r.json();
      const messages = data.messages || [];
      // Refresh presence from the latest server timestamp every poll.
      if (data.other && data.other.last_seen !== undefined) {
        threadKey.otherLastSeen = data.other.last_seen;
        setHeaderForThread(threadKey);
      }
      // If nothing new, skip re-rendering (avoids scroll jumps).
      const ids = new Set(messages.map(m => m.id));
      const sameSet = ids.size === lastRenderedIds.size && [...ids].every(x => lastRenderedIds.has(x));
      if (!initial && sameSet) return;
      lastRenderedIds = ids;

      if (messages.length === 0) {
        body.innerHTML = `
          <div class="eh-chat-empty">
            <i class="fas fa-paper-plane"></i>
            <div><b>Say hi!</b></div>
            <div class="sub">No messages yet — type below to start the conversation.</div>
          </div>`;
        return;
      }
      const wasNearBottom = (body.scrollHeight - body.clientHeight - body.scrollTop) < 80;
      body.innerHTML = messages.map(m => {
        const mine = m.sender_id === ME.id;
        return `
          <div class="eh-msg ${mine ? 'mine' : 'theirs'}">
            ${esc(m.body)}
            <span class="time">${esc(relTime(m.created_at))}</span>
          </div>`;
      }).join('');
      if (initial || wasNearBottom) body.scrollTop = body.scrollHeight;
    } catch (err) { /* polling, ignore transient errors */ }
  }

  function startThreadPolling() {
    stopThreadPolling();
    pollTimer = setInterval(() => { if (isOpen && view === 'thread') refreshThread(false); }, 3000);
  }
  function stopThreadPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    lastRenderedIds = new Set();
  }

  async function sendMessage() {
    if (!threadKey) return;
    const text = inputArea.value.trim();
    if (!text) return;
    sendBtn.disabled = true;
    try {
      const r = await authedJSON('/messages', {
        method: 'POST',
        body: { event_id: threadKey.eventId, recipient_id: threadKey.otherId, body: text }
      });
      if (r.ok) {
        inputArea.value = '';
        await refreshThread(true);
      } else {
        const j = await r.json().catch(() => ({}));
        if (window.Popup) window.Popup.error(j.error || 'Couldn\'t send message');
        else alert(j.error || 'Couldn\'t send');
      }
    } catch (err) {
      if (window.Popup) window.Popup.error('Network error');
    } finally {
      sendBtn.disabled = false;
      inputArea.focus();
    }
  }

  // ─────────── Tabs / nav ───────────
  function setTab(name) {
    tabs.querySelectorAll('.eh-chat-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  }
  tabs.addEventListener('click', (e) => {
    const t = e.target.closest('.eh-chat-tab');
    if (!t) return;
    if (t.dataset.tab === 'threads') { view = 'threads'; resetHeader(); renderThreads(); }
    if (t.dataset.tab === 'picker')  { view = 'picker';  resetHeader(); renderPicker(); }
  });
  headBack.addEventListener('click', () => {
    stopThreadPolling();
    view = 'threads';
    resetHeader();
    renderThreads();
  });

  function resetHeader() {
    headTitle.textContent = 'Messages';
    headSub.textContent   = IS_ORGANIZER ? 'Chat with attendees of your events' : 'Chat with the event organizer';
    headAva.innerHTML     = '<i class="fas fa-comments"></i>';
    headBack.style.display = 'none';
  }

  // ─────────── Send wiring ───────────
  sendBtn.addEventListener('click', sendMessage);
  inputArea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // ─────────── Open / close ───────────
  function openPanel() {
    isOpen = true;
    panel.classList.add('show');
    tip.classList.add('eh-out');
    setTimeout(() => tip.style.display = 'none', 320);
    if (view === 'threads') renderThreads();
    else if (view === 'picker') renderPicker();
    else if (view === 'thread' && threadKey) {
      setHeaderForThread(threadKey);
      tabs.style.display = 'none';
      inputBar.style.display = 'flex';
      refreshThread(true);
      startThreadPolling();
    }
  }
  function closePanel() {
    isOpen = false;
    panel.classList.remove('show');
    stopThreadPolling();
  }
  fab.addEventListener('click', () => { isOpen ? closePanel() : openPanel(); });
  headClose.addEventListener('click', closePanel);
  tip.addEventListener('click', (e) => {
    if (e.target.closest('.eh-chat-tip-close')) return;
    openPanel();
  });
  tipClose.addEventListener('click', () => {
    tip.classList.add('eh-out');
    setTimeout(() => tip.style.display = 'none', 320);
  });

  // Auto-dismiss the tip after 8s if user doesn't interact.
  setTimeout(() => {
    if (!isOpen) { tip.classList.add('eh-out'); setTimeout(() => tip.style.display = 'none', 320); }
  }, 8000);

  // ─────────── Unread badge polling ───────────
  async function refreshUnreadBadge() {
    try {
      const r = await authedFetch('/messages/unread-count');
      if (!r.ok) return;
      const j = await r.json();
      const n = j.unread || 0;
      if (n > 0) {
        fab.classList.add('has-unread');
        fab.dataset.unread = String(n > 99 ? '99+' : n);
      } else {
        fab.classList.remove('has-unread');
      }
      // Broadcast so dashboards can update their own sidebar badges live.
      window.dispatchEvent(new CustomEvent('eh-chat-unread', { detail: { unread: n } }));
    } catch (_) {}
  }
  refreshUnreadBadge();
  unreadTimer = setInterval(refreshUnreadBadge, 8000);

  // ─────────── Public API for other pages ───────────
  // Lets the organizer dashboard's Messages section open a specific thread
  // by clicking a row, e.g. window.EHChat.openThread({eventId, otherId, ...}).
  window.EHChat = {
    openThread(opts) {
      threadKey = {
        eventId:      Number(opts.eventId),
        otherId:      Number(opts.otherId),
        eventTitle:   opts.eventTitle    || '',
        otherName:    opts.otherName     || 'Conversation',
        otherAvatar:  opts.otherAvatar   || '',
        otherLastSeen:opts.otherLastSeen || ''
      };
      view = 'thread';
      if (!isOpen) openPanel();
      else {
        setHeaderForThread(threadKey);
        tabs.style.display = 'none';
        inputBar.style.display = 'flex';
        body.innerHTML = '<div class="eh-chat-loading"><i class="fas fa-spinner"></i>Loading…</div>';
        refreshThread(true);
        startThreadPolling();
      }
    },
    fetchThreads() {
      // Convenience for embedded views (organizer Messages section).
      return authedFetch('/messages/threads').then(r => r.ok ? r.json() : { threads: [] });
    },
    presence,
    initials,
    SERVER_URL
  };
})();
