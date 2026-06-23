const mineflayer = require('mineflayer');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

const botConfig = {
  host: process.env.MC_HOST || 'localhost',
  port: parseInt(process.env.MC_PORT) || 25565,
  username: process.env.BOT_USERNAME || 'DashboardBot',
  auth: process.env.BOT_AUTH || 'offline',
  version: false,
  keepAlive: true,
  checkTimeoutInterval: 30000
};

let bot = null;
let isConnected = false;

app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function createBot() {
  if (bot) {
    try { bot.quit(); } catch (e) {}
    bot = null;
  }

  console.log('Creating new bot...');
  bot = mineflayer.createBot(botConfig);

  bot.on('spawn', () => {
    console.log(`✅ Bot ${bot.username} spawned!`);
    isConnected = true;
    io.emit('status', { connected: true, username: bot.username });
    bot.chat('✅ Bot online via Render dashboard!');
  });

  bot.on('chat', (username, message) => {
    if (username !== bot.username) io.emit('chat', { username, message });
  });

  bot.on('kicked', (reason) => {
    console.log('Kicked:', reason);
    isConnected = false;
    io.emit('status', { connected: false });
    setTimeout(createBot, 10000);
  });

  bot.on('end', (reason) => {
    console.log('Disconnected:', reason);
    isConnected = false;
    io.emit('status', { connected: false });
    setTimeout(createBot, 15000);
  });

  bot.on('error', (err) => {
    console.error('Error:', err.message);
    io.emit('status', { connected: false, error: err.message });
  });
}

io.on('connection', (socket) => {
  socket.emit('status', { connected: isConnected });

  socket.on('sendCommand', (cmd) => {
    if (bot && isConnected) bot.chat(cmd);
  });

  socket.on('reconnectBot', createBot);
});

createBot(); // Start bot

server.listen(PORT, () => {
  console.log(`Dashboard running on port ${PORT}`);
});
