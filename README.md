# Flip Out! Game Monorepo

This repository contains the Flip Out! 2D multiplayer card game implementation under `flip-out-2d/`.

## Quick start

- Install: `cd flip-out-2d && npm install`
- Run dev: `npm run dev`
- Open: `http://localhost:3000`

## Testing & Linting

- Run tests: `cd flip-out-2d && npm test`
- Lint: `npm run lint`
- Format code: `npm run format`

## Docker

- Build image: `docker build -t flip-out .`
- Run: `docker run -p 3000:3000 --env PORT=3000 flip-out`

## CI

GitHub Actions workflow under `.github/workflows/ci.yml` runs lint and tests on Node 18 and 20.

## Project

See `flip-out-2d/README.md` for feature overview and notes.