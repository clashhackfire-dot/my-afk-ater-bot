const mineflayer = require('mineflayer');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const MC_HOST = process.env.MC_HOST || 'localhost';
const MC_PORT = parseInt(process.env.MC_PORT) || 25565;
const USERNAME = process.env.BOT_USERNAME || 'DashboardBot';
const AUTH = process.env.BOT_AUTH || 'offline'; // 'microsoft' for premium

let bot = null;
let isConnected = false;

// Serve static dashboard (we'll add HTML/JS)
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.io for real-time
io.on('connection', (socket) => {
  console.log('Dashboard client connected');
  socket.emit('status', { connected: isConnected });

  socket.on('sendCommand', (cmd) => {
    if (bot && isConnected) {
      bot.chat(cmd);
    }
  });

  socket.on('reconnectBot', startBot);
});

// Start the bot
function startBot() {
  if (bot) bot.quit();

  bot = mineflayer.createBot({
    host: MC_HOST,
    port: MC_PORT,
    username: USERNAME,
    auth: AUTH,
    version: false // auto-detect
  });

  bot.on('spawn', () => {
    console.log('Bot spawned!');
    isConnected = true;
    io.emit('status', { connected: true, position: bot.entity.position });
    bot.chat('Hello! Dashboard bot online.');
  });

  bot.on('chat', (username, message) => {
    if (username !== bot.username) {
      io.emit('chat', { username, message });
    }
  });

  bot.on('kicked', (reason) => {
    console.log('Kicked:', reason);
    isConnected = false;
    io.emit('status', { connected: false });
    setTimeout(startBot, 5000); // auto-reconnect
  });

  bot.on('end', () => {
    isConnected = false;
    io.emit('status', { connected: false });
    setTimeout(startBot, 10000);
  });

  // Basic events
  bot.on('health', () => {
    io.emit('stats', {
      health: bot.health,
      food: bot.food,
      position: bot.entity?.position
    });
  });
}

startBot(); // Start immediately

server.listen(PORT, () => {
  console.log(`Dashboard running on http://localhost:${PORT}`);
});
