// src/games/FlappyRaceGame.js
const BaseGame = require('../BaseGame');

class FlappyRaceGame extends BaseGame {
  constructor(gameId) {
    super(gameId, 'flappy-race', 10); // Tối đa 6 người chơi
    
    // Game configuration
  this.config = {
    width: 1400,
    height: 700,
    gravity: 0.3,
    jumpPower: -6,
    speed: 2,
    turnAroundDistance: 8000, // TĂNG từ 1000 lên 5000px
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


    this.items = []; // Danh sách items trong game
  this.activeEffects = []; // Hiệu ứng đang hoạt động (bẫy, bom, sét)
  this.playerItems = {}; // Items mà player đang cầm

   setTimeout(() => {
    this.forceCreateTestItems();
  }, 2000);
  }



  forceCreateTestItems() {
  console.log('🔥 FORCE CREATING TEST ITEMS...');
  
  this.items = [
    {
      id: 'test_item_1',
      type: 'trap',
      x: 300,
      y: 200,
      collected: false,
      width: 20,
      height: 20
    },
    {
      id: 'test_item_2',
      type: 'bomb',
      x: 500,
      y: 300,
      collected: false,
      width: 20,
      height: 20
    },
    {
      id: 'test_item_3',
      type: 'lightning',
      x: 700,
      y: 150,
      collected: false,
      width: 20,
      height: 20
    },
    {
      id: 'test_item_4',
      type: 'armor',
      x: 900,
      y: 400,
      collected: false,
      width: 20,
      height: 20
    }
  ];
  
  console.log(`🔥 FORCE CREATED ${this.items.length} TEST ITEMS:`, this.items);
  
  // Broadcast ngay lập tức
  this.broadcastGameState();
}
generateItems() {
  this.items = [];
  
  // Tạo item ở mỗi obstacle gap
  const obstacleGroups = this.groupObstaclesByX();
  
  Object.keys(obstacleGroups).forEach(xPos => {
    const x = parseInt(xPos);
    const obstacles = obstacleGroups[x];
    
    // Tìm gap giữa các obstacles
    const gaps = this.findGaps(obstacles);
    
    gaps.forEach(gap => {
      if (gap.size > 60) { // Chỉ tạo item ở gap đủ rộng
        // Random 1 trong 4 loại item
        const itemTypes = ['trap', 'bomb', 'lightning', 'armor'];
        const randomType = itemTypes[Math.floor(Math.random() * itemTypes.length)];
        
        this.items.push({
          id: `item_${x}_${gap.center}`,
          type: randomType,
          x: x + 20, // Ở giữa obstacle
          y: gap.center,
          collected: false,
          width: 20,
          height: 20
        });
      }
    });
  });
  
  console.log(`🎁 Generated ${this.items.length} items`);
}
groupObstaclesByX() {
  const groups = {};
  this.obstacles.forEach(obstacle => {
    if (!groups[obstacle.x]) {
      groups[obstacle.x] = [];
    }
    groups[obstacle.x].push(obstacle);
  });
  return groups;
}
findGaps(obstacles) {
    
  if (obstacles.length === 0) return [];
  
  // Sắp xếp obstacles theo y
  obstacles.sort((a, b) => a.y - b.y);
  
  const gaps = [];
  for (let i = 0; i < obstacles.length - 1; i++) {
    const currentObstacle = obstacles[i];
    const nextObstacle = obstacles[i + 1];
    
    const gapStart = currentObstacle.y + currentObstacle.height;
    const gapEnd = nextObstacle.y;
    const gapSize = gapEnd - gapStart;
    
    if (gapSize > 0) {
      gaps.push({
        start: gapStart,
        end: gapEnd,
        center: gapStart + (gapSize / 2),
        size: gapSize
      });
    }
  }
  
  return gaps;
}
checkItemCollision(player) {
  if (!player.alive) return;
  
  this.items.forEach(item => {
    if (!item.collected && this.isCollidingWithItem(player, item)) {
      this.collectItem(player, item);
    }
  });
}
isCollidingWithItem(player, item) {
  const playerBounds = {
    x: player.x - 15,
    y: player.y - 15,
    width: 30,
    height: 30
  };
  
  return (
    playerBounds.x < item.x + item.width &&
    playerBounds.x + playerBounds.width > item.x &&
    playerBounds.y < item.y + item.height &&
    playerBounds.y + playerBounds.height > item.y
  );
}
collectItem(player, item) {
  item.collected = true;
  
  // Thêm item vào inventory của player
  if (!this.playerItems[player.playerId]) {
    this.playerItems[player.playerId] = [];
  }
  
  this.playerItems[player.playerId].push({
    type: item.type,
    id: item.id,
    collectedAt: Date.now()
  });
  
  const itemNames = {
    'trap': '🪤 Bẫy',
    'bomb': '💣 Bom',
    'lightning': '⚡ Sét',
    'armor': '🛡️ Áo giáp'
  };
  
  this.broadcast({
    type: 'gameMessage',
    message: `${player.playerId.slice(-4)} nhặt được ${itemNames[item.type]}!`
  });
  
  console.log(`Player ${player.playerId} collected ${item.type}`);
}
handlePlayerUseItem(playerId, itemType) {
  const player = this.playerStates.find(p => p.playerId === playerId);
  if (!player || !player.alive) return;
  
  const playerItems = this.playerItems[playerId] || [];
  const itemIndex = playerItems.findIndex(item => item.type === itemType);
  
  if (itemIndex === -1) {
    return { error: 'Không có item này' };
  }
  
  // Xóa item khỏi inventory
  playerItems.splice(itemIndex, 1);
  
  // Sử dụng item
  switch (itemType) {
    case 'trap':
      this.useTrap(player);
      break;
    case 'bomb':
      this.useBomb(player);
      break;
    case 'lightning':
      this.useLightning(player);
      break;
    case 'armor':
      this.useArmor(player);
      break;
  }
  
  return { success: true };
}
useTrap(player) {
  const trap = {
    id: `trap_${Date.now()}`,
    type: 'trap',
    x: player.x + (player.direction * 100), // Đặt phía trước player
    y: player.y,
    width: 40,
    height: 40,
    createdAt: Date.now(),
    duration: 30000, // 30 giây
    ownerId: player.playerId
  };
  
  this.activeEffects.push(trap);
  
  this.broadcast({
    type: 'gameMessage',
    message: `${player.playerId.slice(-4)} đặt bẫy!`
  });
  
  // Tự động xóa bẫy sau 30 giây
  setTimeout(() => {
    this.removeEffect(trap.id);
  }, trap.duration);
}
useBomb(player) {
  const bombRadius = 500;
  let killedCount = 0;
  
  this.playerStates.forEach(targetPlayer => {
    if (targetPlayer.playerId === player.playerId || !targetPlayer.alive) return;
    
    const distance = Math.sqrt(
      Math.pow(targetPlayer.x - player.x, 2) + 
      Math.pow(targetPlayer.y - player.y, 2)
    );
    
    if (distance <= bombRadius && !targetPlayer.invulnerable) {
      this.killPlayer(targetPlayer);
      killedCount++;
    }
  });
  
  // Hiệu ứng bom
  const bomb = {
    id: `bomb_${Date.now()}`,
    type: 'bomb',
    x: player.x,
    y: player.y,
    radius: bombRadius,
    createdAt: Date.now(),
    duration: 1000 // 1 giây hiệu ứng
  };
  
  this.activeEffects.push(bomb);
  
  this.broadcast({
    type: 'gameMessage',
    message: `💥 ${player.playerId.slice(-4)} nổ bom! ${killedCount} người chết!`
  });
  
  // Xóa hiệu ứng bom
  setTimeout(() => {
    this.removeEffect(bomb.id);
  }, bomb.duration);
}
useLightning(player) {
  // Tìm chim bay phía trước gần nhất
  let targetPlayer = null;
  let minDistance = Infinity;
  
  this.playerStates.forEach(otherPlayer => {
    if (otherPlayer.playerId === player.playerId || !otherPlayer.alive) return;
    
    // Chỉ tính những chim ở phía trước theo hướng di chuyển
    const isInFront = (player.direction === 1 && otherPlayer.x > player.x) ||
                     (player.direction === -1 && otherPlayer.x < player.x);
    
    if (isInFront) {
      const distance = Math.abs(otherPlayer.x - player.x);
      if (distance < minDistance) {
        minDistance = distance;
        targetPlayer = otherPlayer;
      }
    }
  });
  
  if (targetPlayer && !targetPlayer.invulnerable) {
    // Hiệu ứng sét
    const lightning = {
      id: `lightning_${Date.now()}`,
      type: 'lightning',
      fromX: player.x,
      fromY: player.y,
      toX: targetPlayer.x,
      toY: targetPlayer.y,
      createdAt: Date.now(),
      duration: 500
    };
    
    this.activeEffects.push(lightning);
    this.killPlayer(targetPlayer);
    
    this.broadcast({
      type: 'gameMessage',
      message: `⚡ ${player.playerId.slice(-4)} giáng sét cho ${targetPlayer.playerId.slice(-4)}!`
    });
    
    // Xóa hiệu ứng sét
    setTimeout(() => {
      this.removeEffect(lightning.id);
    }, lightning.duration);
  } else {
    this.broadcast({
      type: 'gameMessage',
      message: `⚡ ${player.playerId.slice(-4)} giáng sét nhưng không trúng ai!`
    });
  }
}

// THÊM: Sử dụng áo giáp
useArmor(player) {
  player.invulnerable = true;
  player.invulnerableTime = 3000; // 3 giây
  
  this.broadcast({
    type: 'gameMessage',
    message: `🛡️ ${player.playerId.slice(-4)} bất tử trong 3 giây!`
  });
  
  // Tự động tắt áo giáp
  setTimeout(() => {
    if (player.invulnerable && player.invulnerableTime === 3000) {
      player.invulnerable = false;
      player.invulnerableTime = 0;
    }
  }, 3000);
}
removeEffect(effectId) {
  const index = this.activeEffects.findIndex(effect => effect.id === effectId);
  if (index !== -1) {
    this.activeEffects.splice(index, 1);
  }
}


// THÊM: Check collision với bẫy
checkTrapCollision(player) {
  this.activeEffects.forEach(effect => {
    if (effect.type === 'trap' && effect.ownerId !== player.playerId) {
      if (this.isCollidingWithTrap(player, effect)) {
        if (!player.invulnerable) {
          this.killPlayer(player);
          this.broadcast({
            type: 'gameMessage',
            message: `🪤 ${player.playerId.slice(-4)} bị bẫy!`
          });
        }
        // Xóa bẫy sau khi kích hoạt
        this.removeEffect(effect.id);
      }
    }
  });
}
// THÊM: Check collision với bẫy
isCollidingWithTrap(player, trap) {
  const playerBounds = {
    x: player.x - 15,
    y: player.y - 15,
    width: 30,
    height: 30
  };
  
  return (
    playerBounds.x < trap.x + trap.width &&
    playerBounds.x + playerBounds.width > trap.x &&
    playerBounds.y < trap.y + trap.height &&
    playerBounds.y + playerBounds.height > trap.y
  );
}
// THÊM: Check collision giữa players
checkPlayerCollision() {
  for (let i = 0; i < this.playerStates.length; i++) {
    for (let j = i + 1; j < this.playerStates.length; j++) {
      const player1 = this.playerStates[i];
      const player2 = this.playerStates[j];
      
      if (!player1.alive || !player2.alive) continue;
      if (player1.invulnerable || player2.invulnerable) continue;
      
      const distance = Math.sqrt(
        Math.pow(player1.x - player2.x, 2) + 
        Math.pow(player1.y - player2.y, 2)
      );
      
      // Nếu 2 chim va chạm (khoảng cách < 25px)
      if (distance < 25) {
        this.killPlayer(player1);
        this.killPlayer(player2);
        
        this.broadcast({
          type: 'gameMessage',
          message: `💥 ${player1.playerId.slice(-4)} và ${player2.playerId.slice(-4)} đâm nhau!`
        });
      }
    }
  }
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
  
  console.log(`⏰ STARTING COUNTDOWN - DEBUG MODE`);
  
  this.gamePhase = 'countdown';
  this.countdownTime = 3;
  
  // Reset players
  this.playerStates.forEach(player => {
    player.x = this.config.startLine;
    player.y = this.config.height / 2;
    player.velocityY = 0;
    player.alive = true;
    player.distance = 0;
    player.finished = false;
    player.rank = 0;
    player.turnedAround = false;
    player.direction = 1;
  });
  
  // Generate obstacles
  console.log('🧱 GENERATING OBSTACLES...');
  this.generateObstacles();
  console.log(`🧱 Generated ${this.obstacles.length} obstacles`);
  
  // 🔥 FORCE DEBUG ITEMS
  console.log('🎁 CALLING generateItems()...');
  this.generateItems();
  console.log(`🎁 After generateItems(): ${this.items.length} items`);
  
  // If no items generated, create test items
  if (this.items.length === 0) {
    console.log('❌ No items generated, creating test items...');
    this.forceCreateTestItems();
  }
  
  this.broadcast({
    type: 'gameMessage',
    message: '🏁 Trận đấu sắp bắt đầu!'
  });
  
  this.broadcast({
    type: 'countdownStarted',
    countdown: Math.ceil(this.countdownTime)
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
    
    // ADD: Check item collision
    this.checkItemCollision(player);
    
    // Check trap collision
    this.checkTrapCollision(player);
    
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

// SỬA: Respawn về vị trí bắt đầu
respawnPlayer(player) {
  if (player.alive || player.lives <= 0) return;
  
  // LUÔN respawn về điểm bắt đầu
  player.alive = true;
  player.x = this.config.startLine; // Luôn về start
  player.y = this.config.height / 2;
  player.velocityY = 0;
  player.invulnerable = true;
  player.invulnerableTime = 2000;
  player.respawnTimer = null;
  
  // Reset trạng thái quay đầu khi chết
  player.turnedAround = false;
  player.direction = 1;
  
  console.log(`🔄 Player ${player.playerId} respawned at start`);
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
    const smallGapSize = 120; // Khe vừa (không quá hẹp)
    
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
  if (this.players.size === 0) return;
  
  this.broadcast({
    type: 'gameState',
    gamePhase: this.gamePhase,
    countdownTime: this.gamePhase === 'countdown' ? Math.ceil(this.countdownTime) : null,
    players: this.playerStates,
    obstacles: this.obstacles,
    items: this.items,
    activeEffects: this.activeEffects,
    playerItems: this.playerItems,
    config: this.config
  });
}
// Complete setupControls method with all features
setupControls() {
  let spacePressed = false; // Tránh spam space
  
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      
      // Chỉ xử lý khi space chưa được nhấn (tránh key repeat)
      if (!spacePressed) {
        spacePressed = true;
        this.jump();
      }
    }
    
    // THÊM: Ctrl và chuột phải để sử dụng items
    if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
      e.preventDefault();
      this.showItemMenu();
    }
    
    // Phím số để sử dụng item nhanh
    if (e.code === 'Digit1') {
      e.preventDefault();
      this.useItemQuick('trap');
    }
    if (e.code === 'Digit2') {
      e.preventDefault();
      this.useItemQuick('bomb');
    }
    if (e.code === 'Digit3') {
      e.preventDefault();
      this.useItemQuick('lightning');
    }
    if (e.code === 'Digit4') {
      e.preventDefault();
      this.useItemQuick('armor');
    }
    
    // ESC để đóng menu item
    if (e.code === 'Escape') {
      const menu = document.querySelector('.item-menu');
      if (menu && document.body.contains(menu)) {
        document.body.removeChild(menu);
      }
    }
  });
  
  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      spacePressed = false;
    }
  });
  
  // Mouse/touch controls
  this.canvas.addEventListener('click', (e) => {
    e.preventDefault();
    this.jump();
  });
  
  // Chuột phải để mở item menu
  this.canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    this.showItemMenu();
  });
  
  this.canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    this.jump();
  });
  
  // THIẾU: Jump button - QUAN TRỌNG!
  const jumpBtn = document.getElementById('jumpBtn');
  if (jumpBtn) {
    jumpBtn.addEventListener('click', () => {
      this.jump();
    });
  }
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