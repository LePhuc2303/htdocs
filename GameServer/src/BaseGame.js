// src/BaseGame.js - Base class for all games
class BaseGame {
  constructor(gameId, gameType, maxPlayers = 2) {
    this.gameId = gameId;
    this.gameType = gameType;
    this.maxPlayers = maxPlayers;
    this.players = [];
    this.status = 'waiting'; // waiting | playing | finished
    this.createdAt = new Date();
    this.onGameDestroyed = null;
    
    console.log(`🎮 BaseGame ${gameType} ${gameId} initialized`);
  }

  // ===== PLAYER MANAGEMENT =====
  addPlayer(playerId, ws) {
    if (this.players.length >= this.maxPlayers) {
      console.log(`❌ Game ${this.gameId} is full`);
      return null;
    }

    if (this.players.find(p => p.playerId === playerId)) {
      console.log(`⚠️ Player ${playerId} already in game ${this.gameId}`);
      return null;
    }

    const playerInfo = {
      playerId,
      ws,
      joinedAt: new Date()
    };

    this.players.push(playerInfo);
    console.log(`➕ Player ${playerId} joined game ${this.gameId}`);

    // Call game-specific join handler
    const result = this.onPlayerJoined(playerInfo);
    
    return result || { success: true };
  }

  removePlayer(playerId) {
    const playerIndex = this.players.findIndex(p => p.playerId === playerId);
    if (playerIndex === -1) {
      console.log(`⚠️ Player ${playerId} not found in game ${this.gameId}`);
      return;
    }

    this.players.splice(playerIndex, 1);
    console.log(`➖ Player ${playerId} left game ${this.gameId}`);

    // Call game-specific leave handler
    this.onPlayerLeft(playerId);

    // Auto-destroy if empty
    if (this.players.length === 0) {
      setTimeout(() => {
        if (this.players.length === 0) {
          this.destroy();
        }
      }, 30000); // 30 seconds grace period
    }
  }

  // ===== BROADCASTING =====
  broadcast(message) {
    this.players.forEach(player => {
      try {
        if (player.ws && player.ws.readyState === 1) { // WebSocket.OPEN
          player.ws.send(JSON.stringify(message));
        }
      } catch (error) {
        console.error(`❌ Broadcast error to ${player.playerId}:`, error);
      }
    });
  }

  // ===== GAME STATE =====
  getGameState() {
    return {
      type: 'gameState',
      gameId: this.gameId,
      gameType: this.gameType,
      status: this.status,
      playerCount: this.players.length,
      maxPlayers: this.maxPlayers,
      createdAt: this.createdAt
    };
  }

  // ===== ABSTRACT METHODS - TO BE IMPLEMENTED BY SUBCLASSES =====
  onPlayerJoined(playerInfo) {
    // Override in subclasses
    return { success: true };
  }

  onPlayerLeft(playerId) {
    // Override in subclasses
  }

  handleGameAction(playerId, action, data) {
    // Override in subclasses
    return { error: 'Action not implemented' };
  }

  handlePlayerReady(playerId, settings = {}) {
    // Override in subclasses
    return { success: true };
  }

  resetGame() {
    this.status = 'waiting';
    console.log(`🔄 BaseGame ${this.gameId} reset`);
  }

  // ===== SETTINGS =====
  broadcastSettings(settings) {
    this.broadcast({
      type: 'gameSettings',
      settings: settings
    });
  }

  // ===== DESTRUCTION =====
  destroy() {
    console.log(`🗑️ BaseGame ${this.gameId} destroyed`);
    
    // Notify all players
    this.broadcast({
      type: 'gameDestroyed',
      message: 'Game đã kết thúc'
    });

    // Clear all players
    this.players = [];

    // Call destruction callback
    if (this.onGameDestroyed) {
      this.onGameDestroyed();
    }
  }
}

module.exports = BaseGame;