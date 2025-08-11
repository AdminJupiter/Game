const { Server } = require('socket.io');
const { gameManager } = require('./game');

function attachSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: '*' },
  });

  io.on('connection', (socket) => {
    // Create a new game room
    socket.on('createGame', ({ playerName }, ack) => {
      try {
        const { roomCode, player } = gameManager.createRoom(playerName, socket.id);
        socket.join(roomCode);
        safeAck(ack, { ok: true, roomCode, playerId: player.id });
        emitRoomState(io, roomCode);
      } catch (err) {
        safeAck(ack, { ok: false, error: err.message || 'create failed' });
      }
    });

    // Join existing room
    socket.on('joinGame', ({ roomCode, playerName }, ack) => {
      try {
        const { player } = gameManager.joinRoom(roomCode, playerName, socket.id);
        socket.join(roomCode);
        safeAck(ack, { ok: true, roomCode, playerId: player.id });
        emitRoomState(io, roomCode);
      } catch (err) {
        safeAck(ack, { ok: false, error: err.message || 'join failed' });
      }
    });

    // Reconnect by playerId
    socket.on('reconnectPlayer', ({ roomCode, playerId }, ack) => {
      try {
        gameManager.reconnect(roomCode, playerId, socket.id);
        socket.join(roomCode);
        safeAck(ack, { ok: true });
        emitPrivateState(io, roomCode, playerId);
        emitRoomState(io, roomCode);
      } catch (err) {
        safeAck(ack, { ok: false, error: err.message || 'reconnect failed' });
      }
    });

    socket.on('toggleReady', ({ roomCode, playerId }, ack) => {
      try {
        gameManager.toggleReady(roomCode, playerId);
        safeAck(ack, { ok: true });
        emitRoomState(io, roomCode);
      } catch (err) {
        safeAck(ack, { ok: false, error: err.message || 'ready failed' });
      }
    });

    socket.on('startGame', ({ roomCode, playerId }, ack) => {
      try {
        gameManager.startGame(roomCode, playerId);
        safeAck(ack, { ok: true });
        emitRoomState(io, roomCode);
        // send private hands individually
        broadcastPrivateHands(io, roomCode);
      } catch (err) {
        safeAck(ack, { ok: false, error: err.message || 'start failed' });
      }
    });

    socket.on('drawCard', ({ roomCode, playerId }, ack) => {
      try {
        gameManager.drawCard(roomCode, playerId);
        safeAck(ack, { ok: true });
        emitRoomState(io, roomCode);
        emitPrivateState(io, roomCode, playerId);
      } catch (err) {
        safeAck(ack, { ok: false, error: err.message || 'draw failed' });
      }
    });

    socket.on('playCard', ({ roomCode, playerId, cardId, targetPlayerId }, ack) => {
      try {
        const result = gameManager.playCard(roomCode, playerId, cardId, targetPlayerId);
        safeAck(ack, { ok: true, result });
        emitRoomState(io, roomCode);
        broadcastPrivateHands(io, roomCode);
      } catch (err) {
        safeAck(ack, { ok: false, error: err.message || 'play failed' });
      }
    });

    socket.on('discardCard', ({ roomCode, playerId, cardId }, ack) => {
      try {
        gameManager.discardCard(roomCode, playerId, cardId);
        safeAck(ack, { ok: true });
        emitRoomState(io, roomCode);
        emitPrivateState(io, roomCode, playerId);
      } catch (err) {
        safeAck(ack, { ok: false, error: err.message || 'discard failed' });
      }
    });

    socket.on('endTurn', ({ roomCode, playerId }, ack) => {
      try {
        gameManager.endTurn(roomCode, playerId);
        safeAck(ack, { ok: true });
        emitRoomState(io, roomCode);
      } catch (err) {
        safeAck(ack, { ok: false, error: err.message || 'end turn failed' });
      }
    });

    socket.on('disconnect', () => {
      try {
        const info = gameManager.handleDisconnect(socket.id);
        if (info && info.roomCode) {
          emitRoomState(io, info.roomCode);
        }
      } catch (_) {}
    });
  });
}

function safeAck(ack, payload) {
  if (typeof ack === 'function') {
    ack(payload);
  }
}

function emitRoomState(io, roomCode) {
  const publicState = gameManager.getPublicState(roomCode);
  if (!publicState) return;
  io.to(roomCode).emit('gameState', publicState);
}

function emitPrivateState(io, roomCode, playerId) {
  const privateState = gameManager.getPrivateState(roomCode, playerId);
  if (!privateState) return;
  const socketId = privateState.player.socketId;
  io.to(socketId).emit('yourState', privateState);
}

function broadcastPrivateHands(io, roomCode) {
  const sockets = gameManager.getRoomSocketMapping(roomCode);
  for (const { playerId, socketId } of sockets) {
    const privateState = gameManager.getPrivateState(roomCode, playerId);
    if (privateState) {
      io.to(socketId).emit('yourState', privateState);
    }
  }
}

module.exports = { attachSocketServer };