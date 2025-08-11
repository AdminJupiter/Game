const { gameManager } = require('../../server/game');

function createRoomWithPlayers(num) {
  const creator = gameManager.createRoom('Alice', 'sock1');
  const roomCode = creator.roomCode;
  for (let i = 0; i < num - 1; i++) {
    gameManager.joinRoom(roomCode, `P${i + 2}`, `sock${i + 2}`);
  }
  // ready everyone
  const state = gameManager.getPublicState(roomCode);
  for (const p of state.players) {
    gameManager.toggleReady(roomCode, p.id);
  }
  return roomCode;
}

describe('GameManager', () => {
  test('startGame deals 5 cards to each player', () => {
    const roomCode = createRoomWithPlayers(2);
    const stateBefore = gameManager.getPublicState(roomCode);
    const firstId = stateBefore.players[0].id;
    gameManager.startGame(roomCode, firstId);
    const state = gameManager.getPublicState(roomCode);
    expect(state.started).toBe(true);
    for (const p of state.players) {
      expect(p.handCount).toBe(5);
    }
  });

  test('turn order advances on discard', () => {
    const roomCode = createRoomWithPlayers(2);
    const state0 = gameManager.getPublicState(roomCode);
    const firstId = state0.players[0].id;
    gameManager.startGame(roomCode, firstId);

    const startState = gameManager.getPublicState(roomCode);
    const current = startState.currentTurnPlayerId;

    const priv = gameManager.getPrivateState(roomCode, current);
    const card = priv.hand[0];
    gameManager.discardCard(roomCode, current, card.id);

    const nextState = gameManager.getPublicState(roomCode);
    expect(nextState.currentTurnPlayerId).not.toBe(current);
  });

  test('playing mood card adds to collection and can win', () => {
    const roomCode = createRoomWithPlayers(2);
    const state0 = gameManager.getPublicState(roomCode);
    const firstId = state0.players[0].id;
    gameManager.startGame(roomCode, firstId);

    // Force-collect all moods for current player by directly manipulating for test
    const st = gameManager.getPublicState(roomCode);
    const current = st.currentTurnPlayerId;
    const moods = st.moods;
    const priv = gameManager.getPrivateState(roomCode, current);

    // Replace hand with mood cards for each mood
    priv.hand.length = 0;
    for (const m of moods) {
      priv.hand.push({ id: `m-${m}-test`, type: 'mood', mood: m });
    }

    // Play each mood card on the current player's turns, cycling as needed
    for (const m of moods) {
      // advance turns until it's this player's turn
      let ps = gameManager.getPublicState(roomCode);
      while (ps.currentTurnPlayerId !== current) {
        gameManager.endTurn(roomCode, ps.currentTurnPlayerId);
        ps = gameManager.getPublicState(roomCode);
      }
      gameManager.playCard(roomCode, current, `m-${m}-test`);
    }

    const end = gameManager.getPublicState(roomCode);
    expect(end.winnerId).toBe(current);
  });
});