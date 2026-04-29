import { io } from 'https://cdn.socket.io/4.7.2/socket.io.esm.min.js';

let socket;

export function connectWebSocket() {
  socket = io('http://13.203.105.12:3000');
  return socket;
}

export function joinSeatRoom(eventId) {
  if (socket) {
    socket.emit('join-seat-room', eventId);
  }
}

export function listenSeatUpdates(callback) {
  if (socket) {
    socket.on('seat-update', (data) => {
      callback(data);
    });
  }
}

export function leaveSeatRoom(eventId) {
  if (socket) {
    socket.emit('leave-seat-room', eventId);
  }
}
