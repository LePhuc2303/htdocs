// server.js - Debug version với logs
const WebSocket = require('ws');
const GameFactory = require('./src/GameFactory');
const GameManager = require('./src/GameManager');

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

// Game Manager instance
const gameManager = new GameManager();

// WebSocket Connection Handler
wss.on('connection', (ws) => {
  const playerId = 'player_' + Math.random().toString(36).slice(2, 11);
  
  gameManager.addPlayer(playerId, ws);
  console.log(`✅ Player ${playerId} connected`);

  ws.send(JSON.stringify({ 
    type: 'playerInfo', 
    playerId,
    supportedGames: GameFactory.getSupportedGames()
  }));

  ws.on('message', (message) => {
    let data;
    try { 
      data = JSON.parse(message); 
    } catch { 
      console.log('❌ Invalid JSON from', playerId);
      return ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' })); 
    }

    console.log(`📨 Message from ${playerId}:`, data.type, data.gameType || '', data.gameId || '');

    try {
      gameManager.handleMessage(playerId, data);
    } catch (error) {
      console.error('❌ Error handling message:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Internal server error: ' + error.message }));
    }
  });

  ws.on('close', () => {
    gameManager.removePlayer(playerId);
    console.log(`❌ Player ${playerId} disconnected`);
  });

  ws.on('error', (error) => {
    console.error(`❌ WebSocket error for ${playerId}:`, error);
  });
});

// Server stats
setInterval(() => {
  const stats = gameManager.getStats();
  console.log(`📊 Server Stats:`, stats);
  console.log(`🎮 Active games:`, Array.from(gameManager.games.keys()));
}, 60000);

console.log(`🎮 Multi-Game WebSocket Server running on ws://localhost:${PORT}`);
console.log(`🔦 Supported games: ${GameFactory.getSupportedGames().join(', ')}`);
console.log(`🐛 Debug mode enabled - check console for detailed logs`);

// Handle server errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = { wss, gameManager };