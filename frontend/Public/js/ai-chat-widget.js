/**
 * EventHub AI assistant widget
 * ----------------------------
 *  Floating bottom-LEFT button (so it never collides with the human-chat
 *  widget on bottom-right) that opens a streaming chat panel powered by
 *  the Java/Spring Boot AI service. The browser only ever talks to the
 *  Node backend at /api/ai/chat (proxy), which forwards SSE from the AI
 *  service. No CORS dance, no AI URL exposed.
 *
 *  Drop-in:  <script src="/Public/js/ai-chat-widget.js"></script>
 */
(function () {
  if (window.__ehAiWidgetLoaded) return;
  window.__ehAiWidgetLoaded = true;

  // Render on EVERY page so visitors and signed-in users alike can ask the
  // AI assistant. The only exception is the standalone QR-scan verify page,
  // which is a thin landing meant to look like a printed ticket — adding a
  // floating chat there would be visually distracting.
  const path = location.pathname.toLowerCase();
  if (path.endsWith('/verify.html')) return;

  // Resolve API base. The api-base-shim rewrites localhost→origin so this
  // works in both local dev and when served behind a reverse proxy.
  function apiBase() {
    if (typeof CONFIG !== 'undefined' && CONFIG.API && CONFIG.API.BASE_URL) return CONFIG.API.BASE_URL;
    return 'http://localhost:3000/api';
  }

  // ────────────────────────────────────────────────
  // Inject styles once
  // ────────────────────────────────────────────────
  const css = `
    .eh-ai-fab {
      position: fixed; left: 22px; bottom: 22px; z-index: 9998;
      width: 60px; height: 60px; border-radius: 50%; border: none; cursor: pointer;
      background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 50%, #8b5cf6 100%);
      color: white; display: grid; place-items: center;
      box-shadow: 0 14px 30px rgba(99,102,241,0.45), 0 6px 14px rgba(14,165,233,0.35);
      font-size: 1.45rem; transition: transform .25s ease, box-shadow .25s ease;
      animation: ehAiFloat 3.4s ease-in-out infinite;
    }
    .eh-ai-fab:hover { transform: translateY(-3px) scale(1.05); }
    .eh-ai-fab .pulse {
      position: absolute; inset: -4px; border-radius: 50%;
      box-shadow: 0 0 0 0 rgba(99,102,241,0.6); animation: ehAiPulse 2.4s ease-out infinite;
      pointer-events: none;
    }
    @keyframes ehAiFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }
    @keyframes ehAiPulse { 0% { box-shadow: 0 0 0 0 rgba(99,102,241,0.45); } 100% { box-shadow: 0 0 0 22px rgba(99,102,241,0); } }

    .eh-ai-bubble {
      position: fixed; left: 92px; bottom: 30px; z-index: 9997;
      background: white; color: #1f2937;
      padding: 8px 14px; border-radius: 20px 20px 20px 4px;
      box-shadow: 0 10px 24px rgba(15,23,42,0.18); font-size: 0.85rem; font-weight: 600;
      display: flex; align-items: center; gap: 6px;
      animation: ehAiBubble 0.5s ease-out 0.6s both;
      cursor: pointer;
    }
    @keyframes ehAiBubble {
      from { opacity: 0; transform: translateY(8px) scale(0.9); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    .eh-ai-bubble .x { opacity: 0.5; padding-left: 6px; }
    .eh-ai-bubble .x:hover { opacity: 1; }

    .eh-ai-panel {
      position: fixed; left: 22px; bottom: 96px; z-index: 9999;
      width: 380px; max-width: calc(100vw - 44px);
      height: 560px; max-height: calc(100vh - 130px);
      background: white; border-radius: 22px; overflow: hidden;
      display: flex; flex-direction: column;
      box-shadow: 0 30px 60px rgba(15,23,42,0.4);
      animation: ehAiOpen 0.28s cubic-bezier(.2,.9,.3,1.2);
      font-family: 'Inter','Segoe UI',sans-serif;
      transition: height 0.28s cubic-bezier(.2,.9,.3,1.2),
                  bottom 0.28s cubic-bezier(.2,.9,.3,1.2),
                  border-radius 0.28s ease;
    }
    /* Expanded mode — same width, near-full height for comfortable reading
       of longer AI answers. Width stays 380px (looked perfect already). */
    .eh-ai-panel.expanded {
      bottom: 22px;
      height: calc(100vh - 44px);
      max-height: calc(100vh - 44px);
    }
    @keyframes ehAiOpen { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }

    .eh-ai-head {
      padding: 14px 16px;
      background: linear-gradient(135deg,#0ea5e9 0%,#6366f1 50%,#8b5cf6 100%);
      color: white; display: flex; align-items: center; gap: 10px;
    }
    .eh-ai-head .dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #4ade80; box-shadow: 0 0 0 0 rgba(74,222,128,0.7);
      animation: ehAiDot 1.6s ease-out infinite;
    }
    .eh-ai-head .dot.off { background: #f87171; animation: none; }
    @keyframes ehAiDot { 0% { box-shadow: 0 0 0 0 rgba(74,222,128,0.7); } 100% { box-shadow: 0 0 0 10px rgba(74,222,128,0); } }
    .eh-ai-head .ttl { flex: 1; min-width: 0; line-height: 1.15; }
    .eh-ai-head .ttl b { font-family: 'Space Grotesk','Inter',sans-serif; font-weight: 800; font-size: 0.98rem; }
    .eh-ai-head .ttl span { display: block; font-size: 0.72rem; opacity: 0.9; }
    .eh-ai-head .close,
    .eh-ai-head .expand,
    .eh-ai-head .newchat {
      background: rgba(255,255,255,0.2); border: none; color: white;
      width: 30px; height: 30px; border-radius: 50%; cursor: pointer;
      display: grid; place-items: center; font-size: 0.85rem;
      transition: background 0.2s, transform 0.2s;
      flex-shrink: 0;
    }
    .eh-ai-head .close:hover,
    .eh-ai-head .expand:hover,
    .eh-ai-head .newchat:hover { background: rgba(255,255,255,0.35); }
    .eh-ai-head .expand:hover,
    .eh-ai-head .newchat:hover { transform: scale(1.08); }
    .eh-ai-head .close { font-size: 0.95rem; }

    .eh-ai-msgs {
      flex: 1; overflow-y: auto; padding: 16px;
      background: linear-gradient(180deg, #fafbff 0%, #f5f3ff 100%);
      display: flex; flex-direction: column; gap: 10px;
    }
    .eh-ai-msg { max-width: 86%; padding: 10px 14px; border-radius: 16px; line-height: 1.45; font-size: 0.92rem; word-wrap: break-word; white-space: pre-wrap; }
    .eh-ai-msg.user {
      align-self: flex-end;
      background: linear-gradient(135deg,#6366f1,#8b5cf6); color: white;
      border-bottom-right-radius: 4px;
      box-shadow: 0 6px 14px rgba(99,102,241,0.3);
    }
    .eh-ai-msg.bot {
      align-self: flex-start;
      background: white; color: #1f2937; border: 1px solid #eef2ff;
      border-bottom-left-radius: 4px;
    }
    .eh-ai-msg.bot b { color: #4338ca; font-weight: 700; }
    .eh-ai-msg.bot i { color: #6366f1; }
    .eh-ai-msg.bot code {
      background: #eef2ff; color: #4338ca;
      padding: 1px 6px; border-radius: 6px;
      font-family: 'JetBrains Mono','Fira Code','SFMono-Regular',monospace;
      font-size: 0.86em;
    }
    .eh-ai-msg.bot.error { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
    .eh-ai-msg .typing {
      display: inline-flex; gap: 4px; padding: 2px 0;
    }
    .eh-ai-msg .typing span {
      width: 6px; height: 6px; border-radius: 50%; background: #94a3b8;
      animation: ehAiTyping 1s ease-in-out infinite;
    }
    .eh-ai-msg .typing span:nth-child(2) { animation-delay: 0.2s; }
    .eh-ai-msg .typing span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes ehAiTyping { 0%,80%,100% { opacity: 0.3; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }

    .eh-ai-input-row {
      padding: 10px; border-top: 1px solid #eef2ff; background: white;
      display: flex; gap: 8px; align-items: flex-end;
    }
    .eh-ai-input {
      flex: 1; min-width: 0; resize: none;
      padding: 0.7rem 0.9rem; border: 1px solid #e5e7eb; border-radius: 14px;
      font-family: inherit; font-size: 0.92rem; color: #1f2937; background: #fafbff;
      max-height: 100px; line-height: 1.4;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .eh-ai-input:focus { outline: none; border-color: #6366f1; background: white; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
    .eh-ai-send {
      width: 40px; height: 40px; border-radius: 50%; border: none; cursor: pointer;
      background: linear-gradient(135deg,#6366f1,#8b5cf6); color: white;
      display: grid; place-items: center; font-size: 0.95rem; flex-shrink: 0;
      transition: transform 0.2s, box-shadow 0.2s;
      box-shadow: 0 6px 14px rgba(99,102,241,0.35);
    }
    .eh-ai-send:hover { transform: scale(1.07); }
    .eh-ai-send:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

    .eh-ai-actions { display: flex; gap: 6px; padding: 0 10px 8px; background: white; }
    .eh-ai-actions button {
      flex: 1; padding: 6px 8px; border-radius: 9px; border: 1px solid #eef2ff;
      background: #fafbff; color: #6366f1; font-size: 0.78rem; font-weight: 600; cursor: pointer;
      font-family: inherit; transition: all 0.2s;
      display: flex; align-items: center; justify-content: center; gap: 4px;
    }
    .eh-ai-actions button:hover { background: rgba(99,102,241,0.08); border-color: rgba(99,102,241,0.25); }

    @media (max-width: 480px) {
      .eh-ai-fab    { width: 52px; height: 52px; left: 14px; bottom: 14px; font-size: 1.2rem; }
      .eh-ai-bubble { display: none; }
      .eh-ai-panel  { left: 12px; bottom: 78px; right: 12px; width: auto; }
    }
  `;
  const style = document.createElement('style');
  style.id = 'eh-ai-widget-styles';
  style.textContent = css;
  document.head.appendChild(style);

  // ────────────────────────────────────────────────
  // DOM
  // ────────────────────────────────────────────────
  const fab = document.createElement('button');
  fab.className = 'eh-ai-fab';
  fab.title = 'Ask AI Assistant';
  // Magic-wand icon — visually distinct from the human-chat widget's robot.
  fab.innerHTML = `<span class="pulse"></span><i class="fas fa-wand-magic-sparkles"></i>`;
  document.body.appendChild(fab);

  // Welcome bubble appears once per session
  let bubble = null;
  if (!sessionStorage.getItem('eh-ai-bubble-dismissed')) {
    bubble = document.createElement('div');
    bubble.className = 'eh-ai-bubble';
    bubble.innerHTML = `<i class="fas fa-sparkles" style="color:#6366f1"></i> Need help? Ask AI! <span class="x"><i class="fas fa-xmark"></i></span>`;
    document.body.appendChild(bubble);
    bubble.addEventListener('click', (e) => {
      if (e.target.closest('.x')) {
        sessionStorage.setItem('eh-ai-bubble-dismissed', '1');
        bubble.remove();
        return;
      }
      open();
    });
    setTimeout(() => { if (bubble) { bubble.remove(); bubble = null; } }, 12000);
  }

  let panel = null;
  // Local conversation log — kept ONLY for re-rendering the panel when the user
  // closes and reopens it. The backend now uses sessionId for memory, so we
  // don't send `history` to the server anymore.
  let history = [];     // [{ role: 'user'|'assistant', content: string }, ...]
  let streaming = false;
  let abortCtl  = null;
  // Session id — generated once per browser tab. The Java AI service uses
  // this as the memory key for multi-turn context.
  const SESSION_ID = 'eh-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);

  function open() {
    if (panel) return;
    if (bubble) { bubble.remove(); bubble = null; sessionStorage.setItem('eh-ai-bubble-dismissed', '1'); }
    panel = document.createElement('div');
    panel.className = 'eh-ai-panel';
    panel.innerHTML = `
      <div class="eh-ai-head">
        <div class="dot" id="eh-ai-dot"></div>
        <div class="ttl"><b>EventHub AI</b><span id="eh-ai-status">Online · ready to help</span></div>
        <button class="newchat" title="New chat (clears memory)"><i class="fas fa-arrow-rotate-left"></i></button>
        <button class="expand" title="Expand"><i class="fas fa-up-right-and-down-left-from-center"></i></button>
        <button class="close" title="Close"><i class="fas fa-xmark"></i></button>
      </div>
      <div class="eh-ai-msgs" id="eh-ai-msgs"></div>
      <div class="eh-ai-actions">
        <button data-q="Suggest creative event ideas for a college fest"><i class="fas fa-lightbulb"></i> Event ideas</button>
        <button data-q="Help me write an attractive event description"><i class="fas fa-pen"></i> Write description</button>
        <button data-q="What are tips for promoting a paid event?"><i class="fas fa-bullhorn"></i> Promotion tips</button>
      </div>
      <form class="eh-ai-input-row" id="eh-ai-form">
        <textarea id="eh-ai-input" class="eh-ai-input" rows="1" placeholder="Ask anything about events…" autocomplete="off"></textarea>
        <button type="submit" class="eh-ai-send" id="eh-ai-send" title="Send"><i class="fas fa-paper-plane"></i></button>
      </form>
    `;
    document.body.appendChild(panel);

    if (history.length === 0) {
      addMsg('bot', "Hi! I'm your EventHub AI assistant. I can help with event ideas, descriptions, promotion tips, and more. What would you like to ask?");
    } else {
      // Re-render history if user reopens the panel
      history.forEach(m => addMsg(m.role === 'user' ? 'user' : 'bot', m.content));
    }

    panel.querySelector('.close').addEventListener('click', close);

    // New chat — wipes both the local UI history and the server-side memory
    // for this session, so the AI starts fresh without remembering prior turns.
    panel.querySelector('.newchat').addEventListener('click', async () => {
      if (streaming && abortCtl) { try { abortCtl.abort(); } catch (_) {} streaming = false; }
      history = [];
      const m = panel.querySelector('#eh-ai-msgs');
      if (m) m.innerHTML = '';
      // Greet again so the panel doesn't look empty.
      addMsg('bot', "Fresh start! What would you like to ask?");
      try {
        await fetch(`${apiBase()}/ai/memory/${encodeURIComponent(SESSION_ID)}`, { method: 'DELETE' });
      } catch (_) { /* if the server is down, the local reset is still useful */ }
    });

    // Expand / collapse — toggles the panel between its compact size and
    // a near-full-height layout for reading long AI answers comfortably.
    const expandBtn = panel.querySelector('.expand');
    expandBtn.addEventListener('click', () => {
      const expanded = panel.classList.toggle('expanded');
      expandBtn.title = expanded ? 'Collapse' : 'Expand';
      expandBtn.querySelector('i').className = expanded
        ? 'fas fa-down-left-and-up-right-to-center'
        : 'fas fa-up-right-and-down-left-from-center';
      // Keep the latest message visible after the resize transition.
      const m = panel.querySelector('#eh-ai-msgs');
      setTimeout(() => { if (m) m.scrollTop = m.scrollHeight; }, 220);
    });
    panel.querySelectorAll('.eh-ai-actions button').forEach(b => {
      b.addEventListener('click', () => send(b.dataset.q));
    });
    const form  = panel.querySelector('#eh-ai-form');
    const input = panel.querySelector('#eh-ai-input');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text || streaming) return;
      input.value = '';
      input.style.height = '';
      send(text);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.requestSubmit();
      }
    });
    // Auto-grow textarea
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(100, input.scrollHeight) + 'px';
    });
    setTimeout(() => input.focus(), 30);

    // Probe AI health on open so user sees "Offline" if Spring Boot is down
    fetch(`${apiBase()}/ai/health`).then(r => {
      if (!r.ok) markOffline();
    }).catch(markOffline);
  }

  function close() {
    if (!panel) return;
    if (streaming && abortCtl) { try { abortCtl.abort(); } catch (_) {} }
    streaming = false;
    panel.remove();
    panel = null;
  }

  function markOffline() {
    if (!panel) return;
    const dot = panel.querySelector('#eh-ai-dot');
    const st  = panel.querySelector('#eh-ai-status');
    if (dot) dot.classList.add('off');
    if (st)  st.textContent = 'Offline · service unavailable';
  }

  function addMsg(kind, text) {
    const msgs = panel && panel.querySelector('#eh-ai-msgs');
    if (!msgs) return null;
    const el = document.createElement('div');
    el.className = `eh-ai-msg ${kind}`;
    el.textContent = text;
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  }

  // Lightweight, XSS-safe markdown renderer for the AI's `**bold**`, `*italic*`,
  // and inline `code` so the assistant's formatted answers actually look formatted.
  function renderAiText(text) {
    const safe = String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return safe
      .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')          // **bold**
      .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>')    // *italic*
      .replace(/`([^`\n]+)`/g, '<code>$1</code>');         // `code`
  }

  async function send(message) {
    if (!message || streaming) return;
    addMsg('user', message);
    history.push({ role: 'user', content: message });

    const botEl = addMsg('bot', '');
    botEl.innerHTML = `<div class="typing"><span></span><span></span><span></span></div>`;

    const sendBtn = panel.querySelector('#eh-ai-send');
    sendBtn.disabled = true;
    streaming = true;
    abortCtl = new AbortController();

    let acc = '';
    try {
      const res = await fetch(`${apiBase()}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Backend uses sessionId-based memory, so we no longer send history.
        body: JSON.stringify({ message, sessionId: SESSION_ID }),
        signal: abortCtl.signal,
      });

      if (!res.ok || !res.body) {
        botEl.classList.add('error');
        botEl.textContent = 'Sorry, the AI service is unavailable right now. Please try again later.';
        markOffline();
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let firstToken = true;
      // SSE event boundary: blank line. Tolerate \n\n, \r\n\r\n, or mixed.
      const EVENT_SEP = /\r?\n\r?\n/;

      function flushEvents(force) {
        // Split buffer on event separator. Last item may be partial — keep it
        // unless `force` is set (stream ended).
        const parts = buffer.split(EVENT_SEP);
        buffer = force ? '' : parts.pop();
        for (const event of parts) {
          if (!event) continue;
          // Each event may contain multiple "data:" lines; concat them.
          // NOTE: do NOT strip a leading space after "data:". Spring Boot's
          // SSE writer doesn't insert a protocol space, so any leading space
          // we see is actual token content (e.g. " Event"). Stripping it
          // collapsed words into "EventHub" instead of " Event Hub".
          const dataLines = event
            .split(/\r?\n/)
            .filter(l => l.startsWith('data:'))
            .map(l => l.slice(5));
          if (dataLines.length === 0) continue;
          const chunk = dataLines.join('\n');
          if (chunk.trim() === '[DONE]') { buffer = ''; return true; }
          if (chunk.startsWith('[ERROR]')) {
            botEl.classList.add('error');
            botEl.textContent = chunk.replace(/^\[ERROR\]\s*/, '') || 'Something went wrong.';
            return true;
          }
          if (firstToken) { botEl.textContent = ''; firstToken = false; }
          acc += chunk;
          // Render with lightweight markdown so **bold**, *italic*, `code` look formatted.
          botEl.innerHTML = renderAiText(acc);
          const m = panel && panel.querySelector('#eh-ai-msgs');
          if (m) m.scrollTop = m.scrollHeight;
        }
        return false;
      }

      while (true) {
        const { value, done } = await reader.read();
        if (done) { flushEvents(true); break; }
        buffer += decoder.decode(value, { stream: true });
        if (flushEvents(false)) break;
      }

      if (acc) history.push({ role: 'assistant', content: acc });
      else { botEl.classList.add('error'); botEl.textContent = 'No response received.'; }
    } catch (err) {
      if (err.name === 'AbortError') {
        botEl.textContent = (acc || '') + '\n\n[stopped]';
      } else {
        botEl.classList.add('error');
        botEl.textContent = 'Network error. Is the AI service running?';
      }
    } finally {
      streaming = false;
      abortCtl = null;
      if (panel) {
        const btn = panel.querySelector('#eh-ai-send');
        if (btn) btn.disabled = false;
      }
    }
  }

  fab.addEventListener('click', () => { panel ? close() : open(); });
})();
