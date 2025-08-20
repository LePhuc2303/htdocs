// src/BaseGame.js - Base class cho tất cả games
const WebSocket = require('ws');

class BaseGame {
  constructor(gameId, gameType, maxPlayers = 2) {
    this.gameId = gameId;
    this.gameType = gameType;
    this.maxPlayers = maxPlayers;
    this.players = [];
    this.status = 'waiting'; // waiting | setup | playing | finished
    this.createdAt = new Date();
    this.playersReady = {}; // playerId -> readyStatus
    this.gameSettings = {}; // Lưu cài đặt game
  }

  addPlayer(playerId, ws) {
    if (this.players.length >= this.maxPlayers) return false;
    
    const playerInfo = {
      playerId,
      ws,
      joinedAt: new Date()
    };
    
    this.players.push(playerInfo);
    
    // Chuyển sang setup mode khi có đủ người chơi cho xiangqi
    if (this.gameType === 'xiangqi' && this.players.length === 2) {
      this.status = 'setup';
    }

    return this.onPlayerJoined(playerInfo);
  }

  removePlayer(playerId) {
    this.players = this.players.filter(p => p.playerId !== playerId);
    delete this.playersReady[playerId];

    if (this.players.length === 0) {
      this.onGameDestroyed();
    } else {
      this.onPlayerLeft(playerId);
    }
  }

  handlePlayerReady(playerId, settings) {
    this.playersReady[playerId] = true;
    
    // Lưu settings của player
    if (!this.gameSettings[playerId]) {
      this.gameSettings[playerId] = settings;
    }

    // Broadcast ready update
    this.broadcast({
      type: 'readyUpdate',
      playersReady: this.playersReady
    });

    // Kiểm tra nếu tất cả players đã ready
    if (Object.keys(this.playersReady).length === this.players.length) {
      this.startGame();
    }

    return { success: true };
  }

  startGame() {
    // Áp dụng game settings
    this.applyGameSettings();
    
    this.status = 'playing';
    this.broadcastGameState();
  }

  applyGameSettings() {
    // Override trong subclass nếu cần
  }

  broadcast(message) {
    this.players.forEach(p => {
      if (p.ws.readyState === WebSocket.OPEN) {
        p.ws.send(JSON.stringify(message));
      }
    });
  }

  sendToPlayer(playerId, message) {
    const player = this.players.find(p => p.playerId === playerId);
    if (player && player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify(message));
    }
  }

  resetGame() {
    // Reset ready status
    this.playersReady = {};
    if (this.gameType === 'xiangqi') {
      this.status = 'setup';
    } else {
      this.status = 'waiting';
    }
    this.gameSettings = {};
  }

  getGameState() {
    return {
      type: 'gameState',
      gameId: this.gameId,
      gameType: this.gameType,
      status: this.status,
      players: this.players.map(p => ({ playerId: p.playerId })),
      playersReady: this.playersReady
    };
  }

  // Abstract methods - phải implement trong subclass
  onPlayerJoined(playerInfo) {
    throw new Error('onPlayerJoined must be implemented');
  }

  onPlayerLeft(playerId) {
    // Optional override
  }

  onGameDestroyed() {
    // Optional override
  }

  handleGameAction(playerId, action, data) {
    throw new Error('handleGameAction must be implemented');
  }

  broadcastGameState() {
    throw new Error('broadcastGameState must be implemented');
  }
}

module.exports = BaseGame;