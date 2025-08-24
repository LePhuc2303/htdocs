// src/games/FlappyRaceGame.js
const BaseGame = require('../BaseGame');

class FlappyRaceGame extends BaseGame {
  constructor(gameId) {
    super(gameId, 'flappy-race', 6); // Tối đa 6 người chơi
    
    // Game configuration
  this.config = {
    width: 1400,
    height: 700,
    gravity: 0.3,
    jumpPower: -6,
    speed: 2,
    turnAroundDistance: 5000, // TĂNG từ 1000 lên 5000px
    startLine: 50
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
    lives: 10,
    distance: 0,
    finished: false,
    rank: 0,
    respawnTimer: null,
    invulnerable: false,
    invulnerableTime: 0,
    turnedAround: false,  // THÊM: Đã quay đầu chưa
    direction: 1          // THÊM: 1 = đi tới, -1 = đi về
  };

  this.playerStates.push(playerState);
  
  // Set room owner if not set
  if (!this.roomOwner) {
    this.roomOwner = playerInfo.playerId;
  }
  
  // Broadcast player joined message
  this.broadcast({
    type: 'gameMessage',
    message: `🎮 ${playerInfo.playerId.slice(-4)} đã tham gia!`
  });

  // Broadcast full game state (bao gồm players list và ready info)
  this.broadcastGameState();

  // Start countdown if enough players - CHỈ check khi có đủ 2 player
  if (this.playerStates.length >= 1 && this.gamePhase === 'waiting') {
    // Không tự động start, chờ tất cả ready
  }
  
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

  // Jump immediately - no additional validation
  player.velocityY = this.config.jumpPower;
  
  // Broadcast immediately (không chờ game loop)
  this.broadcastGameState();
  
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
  this.countdownTime = 5;
  
  // Generate obstacles
  this.generateObstacles();
  
  // QUAN TRỌNG: Reset players về start position với direction = 1
  this.playerStates.forEach(player => {
    player.x = this.config.startLine; // 50
    player.y = this.config.height / 2; // 300
    player.velocityY = 0;
    player.alive = true;
    player.distance = 0;
    player.finished = false;
    player.rank = 0;
    player.turnedAround = false;
    player.direction = 1; // QUAN TRỌNG: Đảm bảo direction = 1
    
    console.log(`Reset player ${player.playerId.slice(-4)} to position: x=${player.x}, y=${player.y}, direction=${player.direction}`);
  });
  
  console.log(`⏱️ Starting countdown for game ${this.gameId}`);
  
  this.broadcast({
    type: 'gameMessage',
    message: '⏱️ Game bắt đầu sau 5 giây!'
  });
  
  this.startGameLoop();
}

  startGame() {
  this.gamePhase = 'playing';
  
  // Không cần reset players nữa vì đã làm trong countdown
  // Không cần generate obstacles nữa vì đã làm trong countdown
  
  // Clear ready states
  this.playersReady = {};
  
  this.broadcast({
    type: 'gameMessage',
    message: '🚀 GO! Chạy về đích!'
  });

  this.broadcast({
    type: 'gameStarted'
  });
  
  console.log(`🎮 FlappyRace game ${this.gameId} started`);
}
  // ===== GAME LOOP =====
startGameLoop() {
  if (this.gameLoop) return;
  
  this.lastUpdateTime = Date.now();
  this.gameLoop = setInterval(() => {
    this.update();
  }, 1000 / 120); // TĂNG từ 60 lên 120 FPS
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
      // KHÔNG update game logic trong countdown, chỉ đếm ngược
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
    
    const oldX = player.x; // Save old position
    
    // Update invulnerability
    if (player.invulnerable) {
      player.invulnerableTime -= deltaTime * 1000;
      if (player.invulnerableTime <= 0) {
        player.invulnerable = false;
      }
    }
    
    // Apply gravity
    player.velocityY += this.config.gravity;
    player.y += player.velocityY;
    
    // QUAN TRỌNG: Move theo direction
    player.x += this.config.speed * player.direction;
    player.distance = Math.abs(player.x - this.config.startLine);
    
    // DEBUG LOG - chỉ log khi x thay đổi
    if (Math.abs(player.x - oldX) > 0.1) {
      console.log(`Player ${player.playerId.slice(-4)} moved: ${oldX.toFixed(0)} -> ${player.x.toFixed(0)} (direction: ${player.direction})`);
    }
    
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
    
    // THAY ĐỔI: Check race progress thay vì finish line
    this.checkRaceProgress(player);
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
  
  // Không broadcast message ngay để tránh spam
  
  // Set respawn timer ngắn hơn và độc lập
  if (player.lives > 0) {
    player.respawnTimer = setTimeout(() => {
      this.respawnPlayer(player);
    }, 1500); // Giảm từ 3000ms xuống 1500ms
  } else {
    // Player bị loại hoàn toàn
    this.broadcast({
      type: 'gameMessage',
      message: `☠️ ${player.playerId.slice(-4)} đã bị loại!`
    });
    
    // Kiểm tra kết thúc game mà không làm delay các player khác
    setImmediate(() => {
      this.checkGameEnd();
    });
  }
}

respawnPlayer(player) {
  if (player.alive || player.lives <= 0) return;
  
  // Respawn tại vị trí phù hợp với phase hiện tại
  player.alive = true;
  if (player.turnedAround) {
    // Nếu đã quay đầu, respawn ở 1 vị trí giữa turn point và start
    const turnPoint = this.config.turnAroundDistance + this.config.startLine;
    const startPoint = this.config.startLine;
    player.x = (turnPoint + startPoint) / 2; // Giữa 2 điểm
  } else {
    // Chưa quay đầu, respawn ở start
    player.x = this.config.startLine;
  }
  
  player.y = this.config.height / 2;
  player.velocityY = 0;
  player.invulnerable = true;
  player.invulnerableTime = 2000;
  player.respawnTimer = null;
  
  console.log(`🔄 Player ${player.playerId} respawned at ${player.x}`);
}
  handleRespawning() {
    // This is handled by setTimeout, nothing to do here
  }

  // ===== FINISH LINE =====
// Thay thế checkFinishLine bằng method này
checkRaceProgress(player) {
  if (player.finished || !player.alive) return;
  
  const turnAroundPoint = this.config.turnAroundDistance + this.config.startLine;
  const startLine = this.config.startLine;
  
  if (!player.turnedAround) {
    // Phase 1: Chưa đến điểm quay đầu
    if (player.x >= turnAroundPoint) {
      player.turnedAround = true;
      player.direction = -1; // Bắt đầu bay ngược lại
      
      this.broadcast({
        type: 'gameMessage',
        message: `🔄 ${player.playerId.slice(-4)} đã quay đầu!`
      });
      
      console.log(`Player ${player.playerId} turned around at ${player.x}`);
    }
  } else {
    // Phase 2: Đã quay đầu, bay về start line
    if (player.x <= startLine) {
      this.playerWins(player);
    }
  }
}

playerWins(player) {
  player.finished = true;
  
  // Calculate rank
  const finishedPlayers = this.playerStates.filter(p => p.finished);
  player.rank = finishedPlayers.length;
  
  console.log(`🏁 Player ${player.playerId} finished with rank ${player.rank}`);
  
  this.broadcast({
    type: 'gameMessage',
    message: `🏆 ${player.playerId.slice(-4)} về đích hạng ${player.rank}!`
  });
  
  // Check if game should end
  this.checkGameEnd();
}
// Thêm method này vào class FlappyRaceGame
handlePlayerReady(playerId, settings = {}) {
  if (!this.players.find(p => p.playerId === playerId)) {
    return { error: 'Player không tồn tại trong phòng' };
  }

  // Toggle ready state
  if (this.playersReady[playerId]) {
    delete this.playersReady[playerId];
  } else {
    this.playersReady[playerId] = true;
  }
  
  console.log(`Player ${playerId} ready state:`, !!this.playersReady[playerId]);

  // QUAN TRỌNG: Broadcast cả gameState và playersReady
  this.broadcastGameState(); // Gửi full game state trước
  
  // Sau đó gửi thông tin ready
  this.broadcast({
    type: 'playersReady',
    playersReady: this.playersReady,
    roomOwner: this.roomOwner,
    totalPlayers: this.players.length,
    players: this.players.map(p => ({ playerId: p.playerId })) // Thêm thông tin players
  });

  // Check if all players ready
  const readyCount = Object.keys(this.playersReady).length;
  if (readyCount === this.players.length && readyCount >= 1) {
    console.log('All players ready, starting countdown...');
    setTimeout(() => {
      this.startCountdown();
    }, 1000);
  }

  return { success: true };
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
  
  const startX = this.config.startLine + 200;
  const endX = this.config.turnAroundDistance + this.config.startLine - 200;
  const obstacleSpacing = 300;
  
  for (let x = startX; x < endX; x += obstacleSpacing) {
    // MỖI OBSTACLE CÓ 2 KHE: 1 RỘNG + 1 VỪA (không có hẹp)
    const bigGapSize = 200;   // Khe rộng (dễ đi)
    const smallGapSize = 140; // Khe vừa (không quá hẹp)
    
    // Random xem khe nào ở trên, khe nào ở dưới
    const bigGapOnTop = Math.random() > 0.5;
    
    let topGapStart, topGapEnd, bottomGapStart, bottomGapEnd;
    
    if (bigGapOnTop) {
      // Khe rộng ở trên, khe vừa ở dưới
      topGapStart = 50 + Math.random() * 30; // Random 50-80
      topGapEnd = topGapStart + bigGapSize;  // +200
      
      // Khoảng cách giữa 2 khe
      const middleWallSize = 80 + Math.random() * 40; // 80-120px
      
      bottomGapStart = topGapEnd + middleWallSize;
      bottomGapEnd = bottomGapStart + smallGapSize;
      
      // Đảm bảo không vượt quá canvas
      if (bottomGapEnd > this.config.height - 50) {
        bottomGapEnd = this.config.height - 50;
        bottomGapStart = bottomGapEnd - smallGapSize;
      }
      
    } else {
      // Khe vừa ở trên, khe rộng ở dưới
      topGapStart = 50 + Math.random() * 30;
      topGapEnd = topGapStart + smallGapSize; // +140
      
      const middleWallSize = 80 + Math.random() * 40;
      
      bottomGapStart = topGapEnd + middleWallSize;
      bottomGapEnd = bottomGapStart + bigGapSize; // +200
      
      // Đảm bảo không vượt quá canvas
      if (bottomGapEnd > this.config.height - 50) {
        bottomGapEnd = this.config.height - 50;
        bottomGapStart = bottomGapEnd - bigGapSize;
        
        // Điều chỉnh lại gap trên nếu cần
        if (bottomGapStart < topGapEnd + 60) {
          topGapEnd = bottomGapStart - 60;
          topGapStart = topGapEnd - smallGapSize;
        }
      }
    }
    
    // Tạo obstacles
    // Top obstacle
    if (topGapStart > 20) {
      this.obstacles.push({
        x: x,
        y: 0,
        width: 40,
        height: topGapStart,
        difficulty: 'normal'
      });
    }
    
    // Middle obstacle (giữa 2 khe)
    if (bottomGapStart > topGapEnd) {
      this.obstacles.push({
        x: x,
        y: topGapEnd,
        width: 40,
        height: bottomGapStart - topGapEnd,
        difficulty: 'normal'
      });
    }
    
    // Bottom obstacle
    if (bottomGapEnd < this.config.height - 20) {
      this.obstacles.push({
        x: x,
        y: bottomGapEnd,
        width: 40,
        height: this.config.height - bottomGapEnd,
        difficulty: 'normal'
      });
    }
    
    console.log(`Obstacle at ${x}: Top gap ${topGapStart}-${topGapEnd} (${topGapEnd-topGapStart}px), Bottom gap ${bottomGapStart}-${bottomGapEnd} (${bottomGapEnd-bottomGapStart}px)`);
  }
  
  console.log(`🚧 Generated ${this.obstacles.length} balanced obstacles (1 big + 1 medium gap each)`);
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
  // Đảm bảo luôn có players data
  const playersData = this.playerStates.map(p => ({
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
  }));

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
    players: playersData, // Đảm bảo luôn gửi players
    obstacles: this.obstacles,
    powerups: this.powerups || [], // Đảm bảo luôn có array
    playersReady: this.playersReady,
    roomOwner: this.roomOwner
  };
  
  console.log(`Broadcasting game state - Phase: ${this.gamePhase}, Players: ${playersData.length}, Obstacles: ${this.obstacles.length}`); // Debug log
  
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
// ===== CLEANUP TIMERS =====
clearPlayerTimer(playerId) {
  const player = this.playerStates.find(p => p.playerId === playerId);
  if (player && player.respawnTimer) {
    clearTimeout(player.respawnTimer);
    player.respawnTimer = null;
  }
}




}

module.exports = FlappyRaceGame;