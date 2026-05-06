/**
 * AI proxy router
 * ---------------
 *  POST /api/ai/chat   → proxies SSE stream from the Spring Boot AI service
 *
 *  The browser hits this route on the Node backend so it never has to deal
 *  with the localhost:8080 origin (avoids CORS) and the AI service URL stays
 *  on the server side. We stream tokens from Spring Boot straight back to
 *  the client without buffering, so first-token latency stays low.
 */
const express = require('express');
const router  = express.Router();

// Use 127.0.0.1 explicitly — Node 18+ fetch resolves "localhost" to ::1 (IPv6)
// first, but Tomcat may only listen on IPv4, causing fetch to hang silently.
const AI_BASE = process.env.AI_BASE_URL || 'http://127.0.0.1:8080';

// Quick health passthrough so the frontend can show "AI offline" gracefully.
router.get('/health', async (_req, res) => {
  try {
    const r = await fetch(`${AI_BASE}/api/ai/health`, { method: 'GET' });
    const text = await r.text();
    res.status(r.ok ? 200 : 503).type('text/plain').send(text || (r.ok ? 'OK' : 'AI offline'));
  } catch (_err) {
    res.status(503).type('text/plain').send('AI offline');
  }
});

router.post('/chat', async (req, res) => {
  const { message, sessionId, history } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }

  // SSE response headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Forward whichever the client sent. The new Spring Boot service uses
  // sessionId as the memory key (preferred); the old shape (history array)
  // is still passed through so older clients keep working during rollout.
  const upstreamBody = { message };
  if (sessionId) upstreamBody.sessionId = sessionId;
  if (Array.isArray(history)) upstreamBody.history = history;

  try {
    console.log('[AI proxy] → Spring Boot, sid:', sessionId || '(none)', 'msg:', JSON.stringify(message).slice(0, 60));
    // Note: no AbortSignal — it was interfering with response delivery in
    // the Express request context. If the client disconnects we'll just
    // let the upstream complete naturally.
    const aiRes = await fetch(`${AI_BASE}/api/ai/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'text/event-stream' },
      body: JSON.stringify(upstreamBody),
    });

    console.log('[AI proxy] ← Spring Boot status:', aiRes.status, 'CT:', aiRes.headers.get('content-type'));

    if (!aiRes.ok || !aiRes.body) {
      res.write(`data: [ERROR] AI service returned ${aiRes.status}\n\n`);
      res.write('data: [DONE]\n\n');
      return res.end();
    }

    // Pipe the upstream ReadableStream into the Express response.
    const reader = aiRes.body.getReader();
    let chunks = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      chunks++;
      res.write(Buffer.from(value));
    }
    console.log(`[AI proxy] Stream done. chunks=${chunks}`);
    res.end();
  } catch (err) {
    console.error('[AI proxy] error:', err.message);
    try { res.write(`data: [ERROR] ${err.message}\n\n`); res.write('data: [DONE]\n\n'); } catch (_) {}
    try { res.end(); } catch (_) {}
  }
});

// Memory clear — proxies to the Spring Boot service so the browser doesn't
// need to know the AI host. The client calls this when it wants to wipe
// the server-side conversation memory for a session (e.g. "New chat" button).
router.delete('/memory/:sessionId', async (req, res) => {
  const sid = String(req.params.sessionId || '').trim();
  if (!sid) return res.status(400).json({ error: 'sessionId is required' });
  try {
    const r = await fetch(`${AI_BASE}/api/ai/memory/${encodeURIComponent(sid)}`, { method: 'DELETE' });
    const text = await r.text();
    res.status(r.status).type(r.headers.get('content-type') || 'text/plain').send(text);
  } catch (err) {
    console.error('[AI proxy] memory-clear error:', err.message);
    res.status(503).json({ error: 'AI service unreachable' });
  }
});

module.exports = router;
