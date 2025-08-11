import { qs, showScreen, setInviteBar, renderLobby, renderBoard, renderHand, showPopup } from './ui.js';
import { sounds, tryPlay } from './cards.js';

const socket = io();

let roomCode = null;
let playerId = null;
let publicState = null;
let privateState = { hand: [] };

const STORAGE_KEY = 'flipout-identity';

function saveIdentity() {
  if (roomCode && playerId) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ roomCode, playerId }));
  }
}
function loadIdentity() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch (_) {
    return null;
  }
}

// UI bindings
qs('#btnCreate').addEventListener('click', onCreateGame);
qs('#btnJoin').addEventListener('click', onJoinGame);
qs('#btnReady').addEventListener('click', onToggleReady);
qs('#btnStart').addEventListener('click', onStartGame);
qs('#btnDraw').addEventListener('click', onDraw);
qs('#btnEndTurn').addEventListener('click', onEndTurn);
qs('#copyInvite').addEventListener('click', copyInvite);

// Socket events
socket.on('gameState', (state) => {
  publicState = state;
  updateUI();
});

socket.on('yourState', (state) => {
  privateState = state;
  updateUI();
});

initFromUrl();

async function onCreateGame() {
  const playerName = qs('#playerName').value.trim() || 'Player';
  socket.emit('createGame', { playerName }, (res) => {
    if (!res?.ok) return alert(res?.error || 'Failed to create');
    roomCode = res.roomCode;
    playerId = res.playerId;
    saveIdentity();
    setInviteBar(roomCode);
    showScreen('screen-lobby');
  });
}

async function onJoinGame() {
  const code = normalizeCode(qs('#joinCode').value || getCodeFromPath());
  const playerName = qs('#playerName').value.trim() || 'Player';
  if (!code) return alert('Enter a code');
  socket.emit('joinGame', { roomCode: code, playerName }, (res) => {
    if (!res?.ok) return alert(res?.error || 'Failed to join');
    roomCode = res.roomCode;
    playerId = res.playerId;
    saveIdentity();
    setInviteBar(roomCode);
    showScreen('screen-lobby');
  });
}

function onToggleReady() {
  if (!roomCode || !playerId) return;
  socket.emit('toggleReady', { roomCode, playerId });
}

function onStartGame() {
  if (!roomCode || !playerId) return;
  socket.emit('startGame', { roomCode, playerId });
}

function onDraw() {
  if (!roomCode || !playerId) return;
  socket.emit('drawCard', { roomCode, playerId }, (res) => {
    if (!res?.ok) alert(res?.error || 'Draw failed');
    else tryPlay(sounds.flip);
  });
}

function onEndTurn() {
  if (!roomCode || !playerId) return;
  socket.emit('endTurn', { roomCode, playerId });
}

function updateUI() {
  // invite bar
  setInviteBar(roomCode);

  if (!publicState || !roomCode) {
    showScreen('screen-home');
    return;
  }

  if (!publicState.started) {
    showScreen('screen-lobby');
    renderLobby(publicState);
  } else {
    showScreen('screen-game');
    renderBoard(publicState);

    const canAct = publicState.currentTurnPlayerId === playerId && !publicState.winnerId;
    renderHand(privateState, {
      canAct,
      onPlay: (card, targetId) => playCard(card, targetId),
      onDiscard: (card) => discardCard(card),
      onTargetSelect: () => selectTarget(),
    });

    if (publicState.winnerId) {
      const winner = publicState.players.find((p) => p.id === publicState.winnerId);
      if (winner) {
        showPopup(`<h2>🎉 ${winner.name} FLIPPED OUT!</h2>`);
        tryPlay(sounds.win);
      }
    }
  }
}

function playCard(card, targetPlayerId) {
  socket.emit('playCard', { roomCode, playerId, cardId: card.id, targetPlayerId }, (res) => {
    if (!res?.ok) alert(res?.error || 'Play failed');
    else tryPlay(sounds.play);
  });
}

function discardCard(card) {
  socket.emit('discardCard', { roomCode, playerId, cardId: card.id }, (res) => {
    if (!res?.ok) alert(res?.error || 'Discard failed');
  });
}

function selectTarget() {
  return new Promise((resolve) => {
    const others = (publicState?.players || []).filter((p) => p.id !== playerId);
    if (others.length === 0) return resolve(null);
    const container = document.createElement('div');
    container.innerHTML = `<div class="modal"><h3>Select a target</h3></div>`;
    const modal = container.firstChild;
    others.forEach((p) => {
      const b = document.createElement('button');
      b.textContent = p.name;
      b.addEventListener('click', () => {
        document.getElementById('popup').classList.add('hidden');
        resolve(p.id);
      });
      modal.appendChild(b);
    });
    const popup = document.getElementById('popup');
    popup.innerHTML = '';
    popup.appendChild(modal);
    popup.classList.remove('hidden');
  });
}

function normalizeCode(s) {
  return (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
}

function getCodeFromPath() {
  const parts = location.pathname.split('/').filter(Boolean);
  if (parts[0] === 'i' || parts[0] === 'join') return normalizeCode(parts[1] || '');
  return '';
}

function copyInvite() {
  const link = `${location.origin}/i/${roomCode}`;
  navigator.clipboard.writeText(link);
  showPopup('<div>Link copied!</div>');
}

function initFromUrl() {
  const code = getCodeFromPath();
  if (code) {
    qs('#joinCode').value = code;
  }
  const stored = loadIdentity();
  if (stored?.roomCode && stored?.playerId) {
    roomCode = stored.roomCode;
    playerId = stored.playerId;
    socket.emit('reconnectPlayer', { roomCode, playerId }, (res) => {
      if (!res?.ok) {
        // clear invalid
        localStorage.removeItem(STORAGE_KEY);
        roomCode = null;
        playerId = null;
      }
    });
  }
}