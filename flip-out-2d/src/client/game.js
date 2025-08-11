import { qs, showScreen, setInviteBar, renderLobby, renderBoard, renderHand, showPopup } from './ui.js';
import { sounds, tryPlay, setMuted, getMuted } from './cards.js';

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
const btnSound = qs('#toggleSound');
const btnTheme = qs('#toggleTheme');
if (btnSound) btnSound.addEventListener('click', toggleSound);
if (btnTheme) btnTheme.addEventListener('click', toggleTheme);

// Socket events
socket.on('gameState', (state) => {
  publicState = state;
  updateUI();
});

socket.on('yourState', (state) => {
  privateState = state;
  updateUI();
});

initPrefs();
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
        launchConfetti();
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

function initPrefs() {
  // Sound state
  const muted = getMuted();
  setMuted(muted);
  const btnSound = qs('#toggleSound');
  if (btnSound) btnSound.classList.toggle('active', !muted);

  // Theme state
  const theme = (localStorage.getItem('flipout-theme') || 'dark');
  applyTheme(theme);
}

function toggleSound() {
  const nextMuted = !getMuted();
  setMuted(nextMuted);
  const btnSound = qs('#toggleSound');
  if (btnSound) btnSound.classList.toggle('active', !nextMuted);
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('flipout-theme', theme); } catch (_) {}
  // Optional: slightly adjust CSS variables for light
  if (theme === 'light') {
    document.documentElement.style.setProperty('--bg', '#f6f7fb');
    document.documentElement.style.setProperty('--bg-elev', '#ffffff');
    document.documentElement.style.setProperty('--text', '#1a194a');
    document.documentElement.style.setProperty('--muted', '#6b6f9c');
    document.documentElement.style.setProperty('--card', '#ffffff');
    document.documentElement.style.setProperty('--border', '#e4e7ff');
  } else {
    document.documentElement.style.removeProperty('--bg');
    document.documentElement.style.removeProperty('--bg-elev');
    document.documentElement.style.removeProperty('--text');
    document.documentElement.style.removeProperty('--muted');
    document.documentElement.style.removeProperty('--card');
    document.documentElement.style.removeProperty('--border');
  }
}

function launchConfetti() {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.inset = '0';
  container.style.pointerEvents = 'none';
  container.style.overflow = 'hidden';
  document.body.appendChild(container);

  const colors = ['#7c5cff', '#ff6ec7', '#55efc4', '#ffd166', '#6cedff'];
  const count = 120;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.style.position = 'absolute';
    p.style.width = '8px';
    p.style.height = '12px';
    p.style.background = colors[Math.floor(Math.random() * colors.length)];
    p.style.left = Math.random() * 100 + 'vw';
    p.style.top = '-20px';
    p.style.opacity = '0.9';
    p.style.transform = `rotate(${Math.random() * 360}deg)`;
    p.style.borderRadius = '2px';
    container.appendChild(p);

    const duration = 2000 + Math.random() * 2000;
    const x = (Math.random() * 2 - 1) * 100;
    p.animate([
      { transform: `translate(0, 0) rotate(0deg)` },
      { transform: `translate(${x}px, ${window.innerHeight + 80}px) rotate(720deg)` }
    ], { duration, easing: 'cubic-bezier(.29,.59,.19,1.01)', fill: 'forwards' });
  }

  setTimeout(() => container.remove(), 4500);
}