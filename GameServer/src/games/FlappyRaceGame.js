// src/games/FlappyRaceGame.js
const BaseGame = require('../BaseGame');

class FlappyRaceGame extends BaseGame {
  constructor(gameId) {
    super(gameId, 'flappy-race', 6); // Tối đa 6 người chơi
    
    // Game configuration
    this.config = {
      width: 1200,
      height: 600,
      gravity: 0.5,
      jumpPower: -8,
      speed: 3,
      finishDistance: 1000
    };

    // Game state
    this.gamePhase = 'waiting'; // waiting -> countdown -> playing -> finished
    this.countdownTime = 3;
    
    // Player states
    this.playerStates = [];
    
    // Game objects
    this.obstacles = [];
    this.powerups = [];
    
    // Game loop
    this.gameLoop = null;
    this.lastUpdateTime = Date.now();
    
    console.log(`🎮 FlappyRace game ${gameId} created`);
  }

  // ===== PLAYER MANAGEMENT =====
  onPlayerJoined(playerInfo) {
    const playerState = {
      playerId: playerInfo.playerId,
      x: 50,
      y: this.config.height / 2,
      velocityY: 0,
      alive: true,
      lives: 3,
      distance: 0,
      finished: false,
      rank: 0,
      respawnTimer: null,
      invulnerable: false,
      invulnerableTime: 0
    };

    this.playerStates.push(playerState);
    
    // Broadcast player joined
    this.broadcast({
      type: 'gameMessage',
      message: `🎮 ${playerInfo.playerId.slice(-4)} đã tham gia!`
    });

    // Start countdown if enough players
    if (this.playerStates.length >= 2 && this.gamePhase === 'waiting') {
      this.startCountdown();
    }

    this.broadcastGameState();
    
    return { 
      playerIndex: this.playerStates.length - 1,
      gameConfig: this.config
    };
  }

  onPlayerLeft(playerId) {
    const playerIndex = this.playerStates.findIndex(p => p.playerId === playerId);
    if (playerIndex >= 0) {
      const player = this.playerStates[playerIndex];
      
      // Clear respawn timer
      if (player.respawnTimer) {
        clearTimeout(player.respawnTimer);
      }
      
      this.playerStates.splice(playerIndex, 1);
      
      this.broadcast({
        type: 'gameMessage',
        message: `👋 ${playerId.slice(-4)} đã rời game!`
      });
      
      // Check if game should end
      if (this.playerStates.length === 0) {
        this.resetGame();
      } else if (this.gamePhase === 'playing') {
        this.checkGameEnd();
      }
    }
    
    this.broadcastGameState();
  }

  // ===== GAME ACTIONS =====
  handleGameAction(playerId, action, data) {
    switch (action) {
      case 'jump':
        return this.playerJump(playerId);
      case 'ready':
        return this.playerReady(playerId);
      default:
        return { error: 'Unknown action' };
    }
  }

  playerJump(playerId) {
    if (this.gamePhase !== 'playing') {
      return { error: 'Game chưa bắt đầu!' };
    }

    const player = this.playerStates.find(p => p.playerId === playerId);
    if (!player || !player.alive) {
      return { error: 'Không thể nhảy!' };
    }

    // Jump
    player.velocityY = this.config.jumpPower;
    
    return { success: true };
  }

  playerReady(playerId) {
    // This can be used for ready system if needed
    return { success: true };
  }

  // ===== GAME FLOW =====
  startCountdown() {
    if (this.gamePhase !== 'waiting') return;
    
    this.gamePhase = 'countdown';
    this.countdownTime = 3;
    
    console.log(`⏱️ Starting countdown for game ${this.gameId}`);
    
    this.broadcast({
      type: 'gameMessage',
      message: '⏱️ Game bắt đầu sau 3 giây!'
    });
    
    this.startGameLoop();
  }

  startGame() {
    this.gamePhase = 'playing';
    
    // Reset all players to start position
    this.playerStates.forEach(player => {
      player.x = 50;
      player.y = this.config.height / 2;
      player.velocityY = 0;
      player.alive = true;
      player.distance = 0;
      player.finished = false;
      player.rank = 0;
    });
    
    // Generate obstacles
    this.generateObstacles();
    
    this.broadcast({
      type: 'gameMessage',
      message: '🚀 GO! Chạy về đích!'
    });
    
    console.log(`🎮 FlappyRace game ${this.gameId} started`);
  }

  // ===== GAME LOOP =====
  startGameLoop() {
    if (this.gameLoop) return;
    
    this.lastUpdateTime = Date.now();
    this.gameLoop = setInterval(() => {
      this.update();
    }, 1000 / 60); // 60 FPS
  }

  stopGameLoop() {
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }
  }

  update() {
    const currentTime = Date.now();
    const deltaTime = (currentTime - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = currentTime;

    try {
      if (this.gamePhase === 'countdown') {
        this.updateCountdown(deltaTime);
      } else if (this.gamePhase === 'playing') {
        this.updateGame(deltaTime);
      }
      
      this.broadcastGameState();
    } catch (error) {
      console.error(`❌ Game update error:`, error);
    }
  }

  updateCountdown(deltaTime) {
    this.countdownTime -= deltaTime;
    
    if (this.countdownTime <= 0) {
      this.startGame();
    }
  }

  updateGame(deltaTime) {
    // Update players
    this.updatePlayers(deltaTime);
    
    // Handle respawning
    this.handleRespawning();
    
    // Check game end
    this.checkGameEnd();
  }

  updatePlayers(deltaTime) {
    this.playerStates.forEach(player => {
      if (!player.alive) return;
      
      // Update invulnerability
      if (player.invulnerable) {
        player.invulnerableTime -= deltaTime;
        if (player.invulnerableTime <= 0) {
          player.invulnerable = false;
        }
      }
      
      // Apply gravity
      player.velocityY += this.config.gravity;
      player.y += player.velocityY;
      
      // Move forward automatically
      player.x += this.config.speed;
      player.distance = Math.max(0, player.x - 50);
      
      // Check bounds
      if (player.y < 0) {
        player.y = 0;
        player.velocityY = 0;
      } else if (player.y > this.config.height - 30) {
        // Hit ground = die
        if (!player.invulnerable) {
          this.killPlayer(player);
        }
      }
      
      // Check obstacles collision
      if (!player.invulnerable) {
        this.checkObstacleCollision(player);
      }
      
      // Check if reached finish line
      this.checkFinishLine(player);
    });
  }

  // ===== COLLISION & DEATH =====
  checkObstacleCollision(player) {
    // Simple collision with obstacles
    this.obstacles.forEach(obstacle => {
      if (this.isColliding(player, obstacle)) {
        this.killPlayer(player);
      }
    });
  }

  isColliding(player, obstacle) {
    // Simple rectangle collision
    const playerBounds = {
      x: player.x,
      y: player.y,
      width: 30,
      height: 30
    };
    
    return (
      playerBounds.x < obstacle.x + obstacle.width &&
      playerBounds.x + playerBounds.width > obstacle.x &&
      playerBounds.y < obstacle.y + obstacle.height &&
      playerBounds.y + playerBounds.height > obstacle.y
    );
  }

  killPlayer(player) {
    if (!player.alive) return;
    
    player.alive = false;
    player.lives--;
    
    console.log(`💀 Player ${player.playerId} died. Lives left: ${player.lives}`);
    
    this.broadcast({
      type: 'gameMessage',
      message: `💀 ${player.playerId.slice(-4)} đã chết! Còn ${player.lives} mạng`
    });
    
    // Set respawn timer if has lives
    if (player.lives > 0) {
      player.respawnTimer = setTimeout(() => {
        this.respawnPlayer(player);
      }, 3000);
    } else {
      this.broadcast({
        type: 'gameMessage',
        message: `☠️ ${player.playerId.slice(-4)} đã bị loại!`
      });
    }
  }

  respawnPlayer(player) {
    if (player.alive || player.lives <= 0) return;
    
    // Respawn at start
    player.alive = true;
    player.x = 50;
    player.y = this.config.height / 2;
    player.velocityY = 0;
    player.invulnerable = true;
    player.invulnerableTime = 3;
    player.respawnTimer = null;
    
    console.log(`🔄 Player ${player.playerId} respawned`);
    
    this.broadcast({
      type: 'gameMessage',
      message: `🔄 ${player.playerId.slice(-4)} đã hồi sinh! (3s bất tử)`
    });
  }

  handleRespawning() {
    // This is handled by setTimeout, nothing to do here
  }

  // ===== FINISH LINE =====
  checkFinishLine(player) {
    if (player.finished || !player.alive) return;
    
    // Check if player reached finish and came back to start
    if (player.distance >= this.config.finishDistance) {
      // Player reached finish, now they need to come back
      if (player.x <= 50 && player.distance >= this.config.finishDistance) {
        this.playerFinished(player);
      }
    }
  }

  playerFinished(player) {
    player.finished = true;
    
    // Calculate rank
    const finishedPlayers = this.playerStates.filter(p => p.finished);
    player.rank = finishedPlayers.length;
    
    console.log(`🏁 Player ${player.playerId} finished with rank ${player.rank}`);
    
    this.broadcast({
      type: 'gameMessage',
      message: `🏁 ${player.playerId.slice(-4)} về đích! Hạng ${player.rank}`
    });
    
    // Check if game should end
    this.checkGameEnd();
  }

  // ===== GAME END =====
  checkGameEnd() {
    const alivePlayers = this.playerStates.filter(p => p.alive || p.lives > 0);
    const finishedPlayers = this.playerStates.filter(p => p.finished);
    
    // Game ends if someone finished or all players eliminated
    if (finishedPlayers.length > 0 || alivePlayers.length === 0) {
      this.endGame();
    }
  }

  endGame() {
    if (this.gamePhase === 'finished') return;
    
    this.gamePhase = 'finished';
    this.stopGameLoop();
    
    // Clear all respawn timers
    this.playerStates.forEach(player => {
      if (player.respawnTimer) {
        clearTimeout(player.respawnTimer);
        player.respawnTimer = null;
      }
    });
    
    // Determine winner
    const finishedPlayers = this.playerStates.filter(p => p.finished);
    const winner = finishedPlayers.length > 0 ? 
      finishedPlayers.find(p => p.rank === 1) : null;
    
    if (winner) {
      this.broadcast({
        type: 'gameEnd',
        winner: winner.playerId,
        message: `🏆 ${winner.playerId.slice(-4)} chiến thắng!`
      });
    } else {
      this.broadcast({
        type: 'gameEnd',
        winner: null,
        message: '💀 Tất cả đều bị loại!'
      });
    }
    
    console.log(`🏁 FlappyRace game ${this.gameId} ended`);
  }

  // ===== OBSTACLES =====
  generateObstacles() {
    this.obstacles = [];
    
    // Generate obstacles along the path
    for (let x = 200; x < this.config.finishDistance + 200; x += 150) {
      // Random gap position
      const gapY = Math.random() * (this.config.height - 150) + 50;
      const gapSize = 120;
      
      // Top obstacle
      this.obstacles.push({
        x: x,
        y: 0,
        width: 30,
        height: gapY
      });
      
      // Bottom obstacle
      this.obstacles.push({
        x: x,
        y: gapY + gapSize,
        width: 30,
        height: this.config.height - (gapY + gapSize)
      });
    }
    
    console.log(`🚧 Generated ${this.obstacles.length} obstacles`);
  }

  // ===== RESET GAME =====
  resetGame() {
    console.log(`🔄 Resetting FlappyRace game ${this.gameId}`);
    
    this.stopGameLoop();
    
    // Reset game state
    this.gamePhase = 'waiting';
    this.countdownTime = 3;
    
    // Clear all timers
    this.playerStates.forEach(player => {
      if (player.respawnTimer) {
        clearTimeout(player.respawnTimer);
        player.respawnTimer = null;
      }
    });
    
    // Reset player states
    this.playerStates.forEach(player => {
      player.x = 50;
      player.y = this.config.height / 2;
      player.velocityY = 0;
      player.alive = true;
      player.lives = 3;
      player.distance = 0;
      player.finished = false;
      player.rank = 0;
      player.invulnerable = false;
      player.invulnerableTime = 0;
    });
    
    // Clear obstacles
    this.obstacles = [];
    this.powerups = [];
    
    this.broadcast({
      type: 'gameMessage',
      message: '🔄 Game đã được reset!'
    });
    
    this.broadcastGameState();
  }

  // ===== BROADCAST =====
  broadcastGameState() {
    const gameState = {
      type: 'gameState',
      gameId: this.gameId,
      gameType: this.gameType,
      status: this.status,
      gamePhase: this.gamePhase,
      countdownTime: Math.max(0, Math.ceil(this.countdownTime)),
      playerCount: this.playerStates.length,
      maxPlayers: this.maxPlayers,
      config: this.config,
      players: this.playerStates.map(p => ({
        playerId: p.playerId,
        x: p.x,
        y: p.y,
        velocityY: p.velocityY,
        alive: p.alive,
        lives: p.lives,
        distance: p.distance,
        finished: p.finished,
        rank: p.rank,
        invulnerable: p.invulnerable
      })),
      obstacles: this.obstacles,
      powerups: this.powerups
    };
    
    this.broadcast(gameState);
  }

  // ===== CLEANUP =====
  destroy() {
    console.log(`🗑️ Destroying FlappyRace game ${this.gameId}`);
    
    this.stopGameLoop();
    
    // Clear all timers
    this.playerStates.forEach(player => {
      if (player.respawnTimer) {
        clearTimeout(player.respawnTimer);
      }
    });
    
    super.destroy();
  }
}

module.exports = FlappyRaceGame;