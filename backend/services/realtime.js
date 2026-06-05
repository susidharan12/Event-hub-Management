/* ──────────────────────────────────────────────────────────────────
   realtime.js — socket.io wrapper for LIVE seat-map updates.
   ------------------------------------------------------------------
   One room per event ("event:<id>"). Clients join a room to receive
   `seat-update` broadcasts whenever a seat is held, released or booked.
   Kept tiny and dependency-light so it can't destabilise the API server.
   ────────────────────────────────────────────────────────────────── */
let io = null;

function roomFor(eventId) { return `event:${eventId}`; }

function init(server) {
  let Server;
  try { ({ Server } = require('socket.io')); }
  catch (e) {
    console.warn('[realtime] socket.io not installed — live seat updates disabled:', e.message);
    return null;
  }
  io = new Server(server, {
    // Same-origin in the browser; permissive here because the frontend is
    // served from a different port/host in dev and via nginx in prod.
    cors: { origin: true, credentials: true },
    path: '/socket.io'
  });

  io.on('connection', (socket) => {
    socket.on('join-seat-room', (eventId) => {
      if (eventId === undefined || eventId === null) return;
      socket.join(roomFor(eventId));
    });
    socket.on('leave-seat-room', (eventId) => {
      if (eventId === undefined || eventId === null) return;
      socket.leave(roomFor(eventId));
    });
  });

  console.log('[realtime] socket.io initialised on /socket.io');
  return io;
}

/**
 * Broadcast seat status changes to everyone watching an event.
 * @param {number|string} eventId
 * @param {Array<{seat_label:string,status:'available'|'held'|'booked'}>} seats
 */
function emitSeatUpdate(eventId, seats) {
  if (!io || !seats || !seats.length) return;
  io.to(roomFor(eventId)).emit('seat-update', { eventId: Number(eventId), seats });
}

function getIo() { return io; }

module.exports = { init, emitSeatUpdate, roomFor, getIo };
