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
    this.playersReady = {}; // Theo dõi trạng thái ready
this.roomOwner = null; // Chủ phòng
    
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
  
  // Remove from ready list
  delete this.playersReady[playerId];
  
  // Transfer ownership if needed
  if (this.roomOwner === playerId && this.players.length > 0) {
    this.roomOwner = this.players[0].playerId;
    this.broadcast({
      type: 'gameMessage',
      message: `${this.players[0].playerId.slice(-4)} trở thành chủ phòng mới`
    });
  }

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
// ===== READY SYSTEM =====
handlePlayerReady(playerId, settings = {}) {
  if (!this.players.find(p => p.playerId === playerId)) {
    return { error: 'Player không tồn tại trong phòng' };
  }

  this.playersReady[playerId] = true;
  
  // Set room owner
  if (!this.roomOwner) {
    this.roomOwner = playerId;
  }

  this.broadcast({
    type: 'playersReady',
    playersReady: this.playersReady,
    roomOwner: this.roomOwner,
    totalPlayers: this.players.length
  });

  // Check if all players ready
  const readyCount = Object.keys(this.playersReady).length;
  if (readyCount === this.players.length && readyCount >= 2) {
    setTimeout(() => {
      this.startGame();
    }, 1000);
  }

  return { success: true };
}

kickPlayer(kickerId, targetPlayerId) {
  if (kickerId !== this.roomOwner) {
    return { error: 'Chỉ chủ phòng mới có thể kick người chơi' };
  }

  const targetPlayer = this.players.find(p => p.playerId === targetPlayerId);
  if (!targetPlayer) {
    return { error: 'Người chơi không tồn tại' };
  }

  if (targetPlayerId === this.roomOwner) {
    return { error: 'Không thể kick chủ phòng' };
  }

  // Send kick message to target player
  try {
    targetPlayer.ws.send(JSON.stringify({
      type: 'kicked',
      message: 'Bạn đã bị kick khỏi phòng'
    }));
  } catch (error) {
    console.error('Error sending kick message:', error);
  }

  // Remove player
  this.removePlayer(targetPlayerId);
  
  this.broadcast({
    type: 'gameMessage',
    message: `${targetPlayerId.slice(-4)} đã bị kick khỏi phòng`
  });

  return { success: true };
}

getPlayersList() {
  return this.players.map(p => ({
    playerId: p.playerId,
    isReady: !!this.playersReady[p.playerId],
    isRoomOwner: p.playerId === this.roomOwner
  }));
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