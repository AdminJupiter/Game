const { randomUUID } = require('crypto');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function generateRoomCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return code;
}
const generateId = (prefix) => `${prefix}-${randomUUID()}`;

const MOODS = ['Joy', 'Anger', 'Sadness', 'Fear', 'Disgust'];
const SWING_EFFECTS = ['Steal', 'Swap', 'Block'];

function createDeck() {
  const deck = [];
  // 40 mood cards (8 of each mood)
  for (const mood of MOODS) {
    for (let i = 0; i < 8; i++) {
      deck.push({ id: generateId(`m-${mood}`), type: 'mood', mood });
    }
  }
  // 20 swing cards: simple distribution
  for (let i = 0; i < 7; i++) deck.push({ id: generateId('s-steal'), type: 'swing', effect: 'Steal' });
  for (let i = 0; i < 7; i++) deck.push({ id: generateId('s-swap'), type: 'swing', effect: 'Swap' });
  for (let i = 0; i < 6; i++) deck.push({ id: generateId('s-block'), type: 'swing', effect: 'Block' });
  return shuffle(deck);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

class GameManager {
  constructor() {
    this.rooms = new Map();
    this.socketIdToRoom = new Map();
  }

  createRoom(playerName, socketId) {
    const roomCode = generateRoomCode();
    if (this.rooms.has(roomCode)) {
      // extremely unlikely; regenerate
      return this.createRoom(playerName, socketId);
    }
    const player = this._createPlayer(playerName, socketId);
    const room = {
      code: roomCode,
      players: new Map([[player.id, player]]),
      createdAt: Date.now(),
      ready: new Set(),
      started: false,
      deck: [],
      discard: [],
      turnOrder: [player.id],
      currentTurnIndex: 0,
    };
    this.rooms.set(roomCode, room);
    this.socketIdToRoom.set(socketId, { roomCode, playerId: player.id });
    return { roomCode, player };
  }

  joinRoom(roomCode, playerName, socketId) {
    roomCode = this._normalizeRoomCode(roomCode);
    const room = this._getRoomOrThrow(roomCode);
    if (room.started) throw new Error('Game already started');
    if (room.players.size >= 6) throw new Error('Room full');
    const player = this._createPlayer(playerName, socketId);
    room.players.set(player.id, player);
    room.turnOrder.push(player.id);
    this.socketIdToRoom.set(socketId, { roomCode, playerId: player.id });
    return { player };
  }

  reconnect(roomCode, playerId, newSocketId) {
    roomCode = this._normalizeRoomCode(roomCode);
    const room = this._getRoomOrThrow(roomCode);
    const player = room.players.get(playerId);
    if (!player) throw new Error('Unknown player');
    player.socketId = newSocketId;
    this.socketIdToRoom.set(newSocketId, { roomCode, playerId });
  }

  toggleReady(roomCode, playerId) {
    const room = this._getRoomOrThrow(roomCode);
    if (!room.players.has(playerId)) throw new Error('Not in room');
    if (room.ready.has(playerId)) room.ready.delete(playerId);
    else room.ready.add(playerId);
  }

  startGame(roomCode, playerId) {
    const room = this._getRoomOrThrow(roomCode);
    if (room.started) throw new Error('Already started');
    if (!room.players.has(playerId)) throw new Error('Not in room');
    if (room.players.size < 2) throw new Error('Need at least 2 players');
    if (room.ready.size !== room.players.size) throw new Error('All players must be ready');

    room.deck = createDeck();
    room.discard = [];
    room.started = true;
    room.currentTurnIndex = 0;

    // deal 5 cards to each player
    for (const p of room.players.values()) {
      p.hand = [];
      p.collection = new Set();
      p.shield = false; // from Block card
    }
    for (let r = 0; r < 5; r++) {
      for (const p of room.players.values()) {
        const card = room.deck.pop();
        if (card) p.hand.push(card);
      }
    }
  }

  drawCard(roomCode, playerId) {
    const room = this._getRoomOrThrow(roomCode);
    this._ensureTurn(room, playerId);
    const player = room.players.get(playerId);
    const card = room.deck.pop();
    if (!card) throw new Error('Deck is empty');
    player.hand.push(card);
  }

  playCard(roomCode, playerId, cardId, maybeTargetPlayerId) {
    const room = this._getRoomOrThrow(roomCode);
    this._ensureTurn(room, playerId);
    const player = room.players.get(playerId);
    const idx = player.hand.findIndex((c) => c.id === cardId);
    if (idx === -1) throw new Error('Card not found in hand');
    const [card] = player.hand.splice(idx, 1);

    if (card.type === 'mood') {
      player.collection.add(card.mood);
      // mood cards stay in collection, not in discard
      const winnerId = this._checkWin(room);
      if (winnerId) {
        room.winnerId = winnerId;
        room.endedAt = Date.now();
      }
      this._endTurn(room);
      return { action: 'collect', mood: card.mood, winnerId: room.winnerId || null };
    }

    if (card.type === 'swing') {
      let actionResult = { action: 'swing', effect: card.effect };
      if (card.effect === 'Block') {
        player.shield = true;
        room.discard.push(card);
      } else if (card.effect === 'Steal') {
        const targetId = this._requireTarget(room, playerId, maybeTargetPlayerId);
        const target = room.players.get(targetId);
        if (target.shield) {
          target.shield = false; // block consumed
        } else {
          const moods = Array.from(target.collection);
          if (moods.length > 0) {
            const mood = moods[Math.floor(Math.random() * moods.length)];
            target.collection.delete(mood);
            player.collection.add(mood);
            actionResult.steal = { from: targetId, mood };
          }
        }
        room.discard.push(card);
      } else if (card.effect === 'Swap') {
        const targetId = this._requireTarget(room, playerId, maybeTargetPlayerId);
        const target = room.players.get(targetId);
        if (target.shield) {
          target.shield = false; // block consumed
        } else {
          const myMoods = Array.from(player.collection);
          const theirMoods = Array.from(target.collection);
          if (myMoods.length > 0 && theirMoods.length > 0) {
            const myMood = myMoods[Math.floor(Math.random() * myMoods.length)];
            const theirMood = theirMoods[Math.floor(Math.random() * theirMoods.length)];
            player.collection.delete(myMood);
            target.collection.delete(theirMood);
            player.collection.add(theirMood);
            target.collection.add(myMood);
            actionResult.swap = { with: targetId, give: myMood, take: theirMood };
          }
        }
        room.discard.push(card);
      }
      const winnerId = this._checkWin(room);
      if (winnerId) {
        room.winnerId = winnerId;
        room.endedAt = Date.now();
      }
      this._endTurn(room);
      return actionResult;
    }

    throw new Error('Unknown card type');
  }

  discardCard(roomCode, playerId, cardId) {
    const room = this._getRoomOrThrow(roomCode);
    this._ensureTurn(room, playerId);
    const player = room.players.get(playerId);
    const idx = player.hand.findIndex((c) => c.id === cardId);
    if (idx === -1) throw new Error('Card not found in hand');
    const [card] = player.hand.splice(idx, 1);
    room.discard.push(card);
    this._endTurn(room);
  }

  endTurn(roomCode, playerId) {
    const room = this._getRoomOrThrow(roomCode);
    this._ensureTurn(room, playerId);
    this._endTurn(room);
  }

  handleDisconnect(socketId) {
    const mapping = this.socketIdToRoom.get(socketId);
    if (!mapping) return null;
    const { roomCode, playerId } = mapping;
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    const player = room.players.get(playerId);
    if (player && player.socketId === socketId) {
      player.socketId = null;
    }
    this.socketIdToRoom.delete(socketId);
    return { roomCode, playerId };
  }

  getPublicState(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    const players = [];
    for (const p of room.players.values()) {
      players.push({
        id: p.id,
        name: p.name,
        ready: this._isReady(room, p.id),
        collection: Array.from(p.collection || []),
        handCount: (p.hand || []).length,
        shield: !!p.shield,
        connected: !!p.socketId,
      });
    }
    return {
      roomCode: room.code,
      started: room.started,
      players,
      currentTurnPlayerId: room.started ? room.turnOrder[room.currentTurnIndex] : null,
      deckCount: room.deck.length,
      discardTop: room.discard.length ? room.discard[room.discard.length - 1] : null,
      winnerId: room.winnerId || null,
      moods: MOODS,
      swingEffects: SWING_EFFECTS,
    };
  }

  getPrivateState(roomCode, playerId) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;
    const player = room.players.get(playerId);
    if (!player) return null;
    return {
      roomCode: room.code,
      player: {
        id: player.id,
        name: player.name,
        socketId: player.socketId,
      },
      hand: player.hand || [],
    };
  }

  getRoomSocketMapping(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return [];
    const out = [];
    for (const [playerId, p] of room.players.entries()) {
      if (p.socketId) out.push({ playerId, socketId: p.socketId });
    }
    return out;
  }

  // Helpers
  _createPlayer(name, socketId) {
    const id = `p_${randomUUID()}`;
    const safeName = this._sanitizeName(name);
    return { id, name: safeName, socketId, hand: [], collection: new Set(), shield: false };
  }

  _getRoomOrThrow(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) throw new Error('Room not found');
    return room;
  }

  _sanitizeName(name) {
    const n = (typeof name === 'string' ? name : 'Player').trim();
    if (!n) return 'Player';
    return n.slice(0, 16);
  }

  _normalizeRoomCode(code) {
    return (code || '').toString().toUpperCase();
  }

  _isReady(room, playerId) {
    return room.ready && room.ready.has(playerId);
  }

  _ensureTurn(room, playerId) {
    if (!room.started) throw new Error('Game not started');
    const currentId = room.turnOrder[room.currentTurnIndex];
    if (currentId !== playerId) throw new Error('Not your turn');
  }

  _endTurn(room) {
    if (room.winnerId) return; // game ended
    room.currentTurnIndex = (room.currentTurnIndex + 1) % room.turnOrder.length;
  }

  _requireTarget(room, playerId, targetId) {
    if (!targetId) throw new Error('Target player required');
    if (targetId === playerId) throw new Error('Cannot target yourself');
    if (!room.players.has(targetId)) throw new Error('Invalid target');
    return targetId;
  }

  _checkWin(room) {
    for (const [pid, p] of room.players.entries()) {
      if ((p.collection || new Set()).size >= MOODS.length) return pid;
    }
    return null;
  }
}

const gameManager = new GameManager();

module.exports = { gameManager, MOODS, SWING_EFFECTS };