// src/GameManager.js - Debug version
const GameFactory = require('./GameFactory');

class GameManager {
  constructor() {
    this.games = new Map();   // gameId -> GameInstance
    this.players = new Map(); // playerId -> { ws, currentGameId, gameType }
  }

  addPlayer(playerId, ws) {
    this.players.set(playerId, { 
      ws, 
      currentGameId: null, 
      gameType: null,
      connectedAt: new Date()
    });
    console.log(`➕ Added player ${playerId}, total players: ${this.players.size}`);
  }

  removePlayer(playerId) {
    const playerData = this.players.get(playerId);
    if (playerData && playerData.currentGameId) {
      const game = this.games.get(playerData.currentGameId);
      if (game) {
        console.log(`🚪 Removing player ${playerId} from game ${playerData.currentGameId}`);
        game.removePlayer(playerId);
      }
    }
    this.players.delete(playerId);
    console.log(`➖ Removed player ${playerId}, total players: ${this.players.size}`);
  }

  createGame(gameType) {
    console.log(`🎮 Creating game of type: ${gameType}`);
    
    if (!GameFactory.getSupportedGames().includes(gameType)) {
      const supportedGames = GameFactory.getSupportedGames();
      console.log(`❌ Game type '${gameType}' not supported. Supported: ${supportedGames.join(', ')}`);
      throw new Error(`Game type '${gameType}' not supported. Supported: ${supportedGames.join(', ')}`);
    }

   const gameId = Math.floor(Math.random() * 9000 + 1000).toString();
    console.log(`🆕 Generated gameId: ${gameId}`);
    
    try {
      const game = GameFactory.createGame(gameType, gameId);
      console.log(`✅ Game created successfully: ${gameId}`);
      
      // Setup game callbacks
      game.onGameDestroyed = () => {
        console.log(`🗑️ Game ${gameId} destroyed`);
        this.games.delete(gameId);
      };

      this.games.set(gameId, game);
      console.log(`📊 Total games: ${this.games.size}`);
      
      return game;
    } catch (error) {
      console.error(`❌ Failed to create game ${gameId}:`, error);
      throw error;
    }
  }

  getGame(gameId) {
    const game = this.games.get(gameId);
    if (game) {
      console.log(`✅ Found game: ${gameId}`);
    } else {
      console.log(`❌ Game not found: ${gameId}. Available games: ${Array.from(this.games.keys()).join(', ')}`);
    }
    return game;
  }

  getGameList() {
    return Array.from(this.games.values()).map(game => ({
      gameId: game.gameId,
      gameType: game.gameType,
      status: game.status,
      playerCount: game.players.length,
      maxPlayers: game.maxPlayers,
      createdAt: game.createdAt
    }));
  }

  getStats() {
    const stats = {
      totalGames: this.games.size,
      totalPlayers: this.players.size,
      gamesByType: {}
    };
    
    this.games.forEach(game => {
      stats.gamesByType[game.gameType] = (stats.gamesByType[game.gameType] || 0) + 1;
    });
    
    return stats;
  }

  handleMessage(playerId, data) {
    const playerData = this.players.get(playerId);
    if (!playerData) {
      console.log(`❌ Player data not found for: ${playerId}`);
      return;
    }

    const ws = playerData.ws;
    console.log(`📝 Handling message type: ${data.type} from player: ${playerId}`);

    switch (data.type) {
      case 'createGame': {
        try {
          const gameType = data.gameType || 'caro';
          console.log(`🆕 Creating game - Type: ${gameType}, Player: ${playerId}`);
          
          const game = this.createGame(gameType);
          
          const joinResult = game.addPlayer(playerId, ws);
          console.log(`✅ Player ${playerId} joined game ${game.gameId}`, joinResult);
          
          // Update player data
          playerData.currentGameId = game.gameId;
          playerData.gameType = gameType;
          
          ws.send(JSON.stringify({ 
            type: 'gameCreated', 
            gameId: game.gameId, 
            gameType,
            playerInfo: joinResult 
          }));
        } catch (error) {
          console.error(`❌ Error creating game:`, error);
          ws.send(JSON.stringify({ type: 'error', message: error.message }));
        }
        break;
      }

      case 'joinGame': {
        const gameId = data.gameId;
        console.log(`🚪 Player ${playerId} trying to join game: ${gameId}`);
        
        const game = this.getGame(gameId);
        if (!game) {
          console.log(`❌ Game ${gameId} not found for player ${playerId}`);
          return ws.send(JSON.stringify({ 
            type: 'error', 
            message: `Game không tồn tại. Available games: ${Array.from(this.games.keys()).join(', ')}` 
          }));
        }
        
        const joinResult = game.addPlayer(playerId, ws);
        if (!joinResult) {
          console.log(`❌ Failed to join game ${gameId} - game full`);
          return ws.send(JSON.stringify({ type: 'error', message: 'Game đã đầy' }));
        }
        
        // Update player data
        playerData.currentGameId = gameId;
        playerData.gameType = game.gameType;
        
        console.log(`✅ Player ${playerId} successfully joined game ${gameId}`);
        ws.send(JSON.stringify({ 
          type: 'gameJoined', 
          gameId: gameId,
          gameType: game.gameType,
          playerInfo: joinResult 
        }));
        break;
      }

      case 'ready': {
        const gameId = data.gameId;
        console.log(`✅ Player ${playerId} ready in game: ${gameId}`);
        
        const game = this.getGame(gameId);
        if (!game) {
          return ws.send(JSON.stringify({ type: 'error', message: 'Game không tồn tại' }));
        }
        
        const result = game.handlePlayerReady(playerId, data.settings || {});
        if (result && result.error) {
          console.log(`❌ Ready error:`, result.error);
          ws.send(JSON.stringify({ type: 'error', message: result.error }));
        }
        break;
      }

      case 'broadcastSettings': {
        const gameId = data.gameId;
        console.log(`⚙️ Broadcasting settings for game: ${gameId}`);
        
        const game = this.getGame(gameId);
        if (!game) {
          return ws.send(JSON.stringify({ type: 'error', message: 'Game không tồn tại' }));
        }
        
        // Store settings in game
        game.currentSettings = data.settings;
        
        // Broadcast settings to all players and spectators
        if (game.broadcastSettings) {
          game.broadcastSettings(data.settings);
        }
        break;
      }

      case 'gameAction': {
        const gameId = data.gameId;
        console.log(`🎮 Game action: ${data.action} in game: ${gameId}`);
        
        const game = this.getGame(gameId);
        if (!game) {
          return ws.send(JSON.stringify({ type: 'error', message: 'Game không tồn tại' }));
        }
        
        const result = game.handleGameAction(playerId, data.action, data.data);
        if (result && result.error) {
          console.log(`❌ Game action error:`, result.error);
          ws.send(JSON.stringify({ type: 'error', message: result.error }));
        }
        break;
      }

      case 'resetGame': {
        const gameId = data.gameId;
        console.log(`🔄 Resetting game: ${gameId}`);
        
        const game = this.getGame(gameId);
        if (game) {
          game.resetGame();
        }
        break;
      }

      case 'leaveGame': {
        const gameId = data.gameId;
        console.log(`🚪 Player ${playerId} leaving game: ${gameId}`);
        
        const game = this.getGame(gameId);
        if (game) {
          game.removePlayer(playerId);
        }
        
        // Clear player data
        playerData.currentGameId = null;
        playerData.gameType = null;
        break;
      }

      case 'listGames': {
        console.log(`📋 Listing games for player: ${playerId}`);
        const gameList = this.getGameList();
        ws.send(JSON.stringify({ type: 'gameList', games: gameList }));
        break;
      }

      // Backward compatibility cho Caro
      case 'makeMove': {
        const gameId = data.gameId;
        console.log(`♟️ Make move in game: ${gameId}`);
        
        const game = this.getGame(gameId);
        if (!game) {
          return ws.send(JSON.stringify({ type: 'error', message: 'Game không tồn tại' }));
        }
        
        const result = game.handleGameAction(playerId, 'makeMove', { 
          row: Number(data.row), 
          col: Number(data.col) 
        });
        if (result && result.error) {
          console.log(`❌ Move error:`, result.error);
          ws.send(JSON.stringify({ type: 'error', message: result.error }));
        }
        break;
      }

      default:
        console.log(`❓ Unknown message type: ${data.type}`);
        ws.send(JSON.stringify({ type: 'error', message: 'Unknown message type: ' + data.type }));
    }
  }
}

module.exports = GameManager;