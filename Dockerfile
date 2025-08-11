# syntax=docker/dockerfile:1
FROM node:20-alpine AS base
WORKDIR /app

# Install production dependencies
COPY flip-out-2d/package*.json ./flip-out-2d/
RUN cd flip-out-2d && npm ci --omit=dev

# Copy source
COPY flip-out-2d ./flip-out-2d

WORKDIR /app/flip-out-2d
EXPOSE 3000
CMD ["node", "src/server/index.js"]