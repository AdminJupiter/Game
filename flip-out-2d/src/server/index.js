const path = require('path');
const express = require('express');
const http = require('http');
const { attachSocketServer } = require('./sockets');

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);

// Serve static assets
const publicDir = path.join(__dirname, '../../public');
const clientDir = path.join(__dirname, '../../src/client');
app.use(express.static(publicDir));
app.use('/src/client', express.static(clientDir));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

// Invite links route just serves index.html; client reads code from URL
app.get(['/i/:code', '/join/:code'], (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

attachSocketServer(server);

server.listen(PORT, () => {
  console.log(`Flip Out! server listening on http://localhost:${PORT}`);
});