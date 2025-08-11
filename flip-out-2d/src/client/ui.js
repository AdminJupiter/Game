export const qs = (sel) => document.querySelector(sel);
export const qsa = (sel) => Array.from(document.querySelectorAll(sel));

export function showScreen(id) {
  qsa('.screen').forEach((el) => el.classList.add('hidden'));
  qs(`#${id}`).classList.remove('hidden');
}

export function setInviteBar(code) {
  const bar = qs('#inviteBar');
  const codeEl = qs('#inviteCode');
  if (code) {
    codeEl.textContent = code;
    bar.classList.remove('hidden');
  } else {
    bar.classList.add('hidden');
  }
}

export function renderLobby(state) {
  const list = qs('#players');
  list.innerHTML = '';
  state.players.forEach((p) => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = `${p.name}${!p.connected ? ' (reconnecting...)' : ''}`;
    const status = document.createElement('span');
    status.textContent = p.ready ? 'ready' : 'not ready';
    status.className = p.ready ? 'ready' : '';
    li.appendChild(name);
    li.appendChild(status);
    list.appendChild(li);
  });
  const btnStart = qs('#btnStart');
  const allReady = state.players.length >= 2 && state.players.every((p) => p.ready);
  btnStart.disabled = !allReady;
}

export function renderBoard(state) {
  // HUD
  qs('#turnIndicator').textContent = state.currentTurnPlayerId
    ? `Turn: ${state.players.find((p) => p.id === state.currentTurnPlayerId)?.name || ''}`
    : '';
  qs('#deckInfo').textContent = `Deck: ${state.deckCount}`;
  // Discard visual
  const discard = qs('#discardPile');
  discard.textContent = state.discardTop ? cardLabel(state.discardTop) : 'Discard pile';

  // Players area
  const area = qs('#playersArea');
  area.innerHTML = '';
  state.players.forEach((p) => {
    const panel = document.createElement('div');
    panel.className = 'playerPanel';
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = `${p.name} ${p.shield ? '🛡️' : ''}`;
    const coll = document.createElement('div');
    coll.className = 'collection';
    p.collection.forEach((m) => {
      const tag = document.createElement('div');
      tag.className = `mood ${m}`;
      tag.textContent = m;
      coll.appendChild(tag);
    });
    const handCount = document.createElement('div');
    handCount.className = 'muted';
    handCount.textContent = `Hand: ${p.handCount}`;
    panel.appendChild(name);
    panel.appendChild(coll);
    panel.appendChild(handCount);
    area.appendChild(panel);
  });
}

export function renderHand(privateState, { onPlay, onDiscard, onTargetSelect, canAct }) {
  const hand = qs('#handArea');
  hand.innerHTML = '';
  (privateState.hand || []).forEach((card) => {
    const el = document.createElement('div');
    el.className = `card ${card.type}`;
    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = cardLabel(card);

    const actions = document.createElement('div');
    actions.className = 'row play';

    const playBtn = document.createElement('button');
    playBtn.textContent = 'Play';
    playBtn.disabled = !canAct;
    playBtn.addEventListener('click', async () => {
      if (card.type === 'swing') {
        const targetId = await onTargetSelect();
        if (!targetId) return;
        onPlay(card, targetId);
      } else {
        onPlay(card);
      }
    });

    const discardBtn = document.createElement('button');
    discardBtn.textContent = 'Discard';
    discardBtn.disabled = !canAct;
    discardBtn.addEventListener('click', () => onDiscard(card));

    actions.appendChild(playBtn);
    actions.appendChild(discardBtn);
    el.appendChild(label);
    el.appendChild(actions);
    hand.appendChild(el);
  });
}

export function cardLabel(card) {
  if (card.type === 'mood') return `Mood: ${card.mood}`;
  if (card.type === 'swing') return `Swing: ${card.effect}`;
  return 'Card';
}

export function showPopup(html) {
  const popup = qs('#popup');
  popup.innerHTML = `<div class="modal">${html}</div>`;
  popup.classList.remove('hidden');
  setTimeout(() => popup.classList.add('hidden'), 2500);
}