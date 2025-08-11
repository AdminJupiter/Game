# Flip Out! - 2D Multiplayer Mood Swing Card Game

Quick start

- Install: `npm install`
- Run dev: `npm run dev`
- Open: http://localhost:3000

Features

- Create/Join by invite code or link `/i/ABC123`
- Lobby with ready checks
- Real-time play via Socket.io
- Turn flow: Draw → Play or Discard → End turn
- Win by collecting all 5 moods
- Swing cards: Steal, Swap, Block (basic effects)

Notes

- Assets live under `public/cards` and `public/sounds`. Add `flip.mp3`, `play.mp3`, and `win.mp3` for audio.
- This build uses native ES modules in the browser and no bundler for fast iteration.
- Server stores games in memory. Swap to Redis/Mongo for persistence later.