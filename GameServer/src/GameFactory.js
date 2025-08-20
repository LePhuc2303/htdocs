// src/GameFactory.js - With Debug Logging
const CaroGame = require('./games/CaroGame');
const XiangqiGame = require('./games/XiangqiGame');

// Try to import FlappyRaceGame
let FlappyRaceGame;
try {
  FlappyRaceGame = require('./games/FlappyRaceGame');
  console.log('✅ FlappyRaceGame loaded successfully');
} catch (error) {
  console.error('❌ Failed to load FlappyRaceGame:', error.message);
  console.log('⚠️ Flappy Race will not be available');
}

class GameFactory {
  static createGame(gameType, gameId) {
    console.log(`🏭 GameFactory creating: ${gameType} with ID: ${gameId}`);
    
    switch (gameType) {
      case 'caro':
        console.log('📦 Creating CaroGame');
        return new CaroGame(gameId);
        
      case 'xiangqi':
        console.log('📦 Creating XiangqiGame');
        return new XiangqiGame(gameId);
        
      case 'flappy-race':
        if (!FlappyRaceGame) {
          console.error('❌ FlappyRaceGame not available');
          throw new Error('FlappyRaceGame is not available. Please check if the file exists.');
        }
        console.log('📦 Creating FlappyRaceGame');
        return new FlappyRaceGame(gameId);
        
      default:
        console.error(`❌ Unknown game type: ${gameType}`);
        throw new Error(`Unknown game type: ${gameType}`);
    }
  }

  static getSupportedGames() {
    const games = ['caro', 'xiangqi'];
    if (FlappyRaceGame) {
      games.push('flappy-race');
    }
    
    console.log(`🎮 Supported games: ${games.join(', ')}`);
    return games;
  }

  // Check if a game type is supported
  static isGameTypeSupported(gameType) {
    return this.getSupportedGames().includes(gameType);
  }

  // Register new game type
  static registerGame(gameType, gameClass) {
    console.log(`📝 Registering new game type: ${gameType}`);
    // Future implementation for dynamic game registration
  }
}

// Log supported games on startup
console.log('🎮 GameFactory initialized');
console.log('📋 Available games:', GameFactory.getSupportedGames());

module.exports = GameFactory;