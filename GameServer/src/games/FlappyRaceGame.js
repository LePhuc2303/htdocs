// src/games/FlappyRaceGame.js - Flappy Race Server Implementation
const BaseGame = require('../BaseGame');

class FlappyRaceGame extends BaseGame {
    constructor(gameId) {
        super(gameId, 'flappy-race', 8); // Max 8 players
        
        // Game config
        this.config = {
            width: 1200,
            height: 600,
            raceDistance: 2000,
            gravity: 0.5,
            flapStrength: -8,
            pipeGap: 180,
            pipeWidth: 60,
            itemSpawnRate: 0.02
        };
        
        // Game state
        this.pipes = [];
        this.items = [];
        this.projectiles = [];
        this.playerStates = [];
        this.gamePhase = 'waiting'; // waiting, countdown, playing, finished
        this.gameTimer = 0;
        this.leaderboard = [];
        
        // Game settings (from room creation)
        this.gameSettings = {
            mode: 'classic',
            maxPlayers: 4,
            difficulty: 'normal',
            mapType: 'classic',
            itemsEnabled: true
        };
        
        // Game loop
        this.gameLoop = null;
        this.lastUpdate = Date.now();
    }

    onPlayerJoined(playerInfo) {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD'];
        const color = colors[this.players.length - 1] || '#FFD700';
        
        playerInfo.color = color;
        
        // Initialize player state
const playerState = {
    playerId: playerInfo.playerId,
    x: 50, // Start further from pipes
    y: this.config.height / 2, // Middle of screen
    velocityY: 0,
    color: color,
    score: 0,
    lives: 3,
    phase: 'outbound',
    alive: true, // Make sure starts alive
    effects: {},
    items: [],
    rank: 0,
    invulnerable: true, // Add 3 second invulnerability at start
    invulnerabilityTime: 3000
};
        
        this.playerStates.push(playerState);
        
        // Start game if enough players and all ready
        if (this.players.length >= 2 && this.status === 'playing') {
            this.startGameLoop();
        }
        
        this.broadcastGameState();
        
        return { 
            color, 
            playerIndex: this.players.length - 1,
            gameConfig: this.config 
        };
    }

    onPlayerLeft(playerId) {
        this.playerStates = this.playerStates.filter(p => p.playerId !== playerId);
        
        // Reset ready status when player leaves
        delete this.playersReady[playerId];
        
        if (this.players.length === 0) {
            this.stopGameLoop();
            this.status = 'waiting';
            this.gamePhase = 'waiting';
        }
        
        this.broadcastGameState();
    }

    applyGameSettings() {
        const settingsArray = Object.values(this.gameSettings);
        if (settingsArray.length > 0) {
            const settings = settingsArray[0];
            this.gameSettings = { ...this.gameSettings, ...settings };
            
            // Apply difficulty settings
            this.applyDifficulty(this.gameSettings.difficulty);
            
            // Apply map settings
            this.generateMap(this.gameSettings.mapType);
            
            // Set max players
            if (settings.maxPlayers) {
                this.maxPlayers = settings.maxPlayers;
            }
        }
    }

    applyDifficulty(difficulty) {
        switch (difficulty) {
            case 'easy':
                this.config.gravity = 0.3;
                this.config.pipeGap = 150;
                this.config.flapStrength = -10;
                break;
            case 'normal':
                this.config.gravity = 0.5;
                this.config.pipeGap = 120;
                this.config.flapStrength = -8;
                break;
            case 'hard':
                this.config.gravity = 0.7;
                this.config.pipeGap = 100;
                this.config.flapStrength = -7;
                break;
            case 'extreme':
                this.config.gravity = 0.9;
                this.config.pipeGap = 80;
                this.config.flapStrength = -6;
                break;
        }
    }

    generateMap(mapType) {
        this.pipes = [];
        
        // Generate pipes based on map type
        for (let x = 200; x < this.config.raceDistance; x += 150) {
            let pipeHeight;
            
            switch (mapType) {
                case 'jungle':
                    pipeHeight = 100 + Math.sin(x * 0.01) * 50;
                    break;
                case 'city':
                    pipeHeight = 80 + (x % 300) * 0.3;
                    break;
                case 'space':
                    pipeHeight = 120 + Math.random() * 100;
                    break;
                default: // classic
                    pipeHeight = 80 + Math.random() * 120;
            }
            
            this.pipes.push({
                x: x,
                topHeight: pipeHeight,
                bottomY: pipeHeight + this.config.pipeGap,
                bottomHeight: this.config.height - (pipeHeight + this.config.pipeGap)
            });
        }
        
        // Generate items if enabled
        if (this.gameSettings.itemsEnabled) {
            this.generateItems();
        }
    }

generateItems() {
    this.items = [];
    
    // TẠO 2 ITEMS CHO MỖI ỐNG
    this.pipes.forEach((pipe, index) => {
        const gapCenter = pipe.topHeight + (pipe.gap / 2);
        const gapQuarter = pipe.gap / 4;
        
        // Item 1: Phía trên khoảng trống
        const item1X = pipe.x + (pipe.width / 2);
        const item1Y = gapCenter - gapQuarter;
        
        // Item 2: Phía dưới khoảng trống  
        const item2X = pipe.x + (pipe.width / 2);
        const item2Y = gapCenter + gapQuarter;
        
        const itemTypes = ['speed', 'shield', 'bomb', 'trap'];
        
        // Tạo item 1
        this.items.push({
            id: `item_pipe_${index}_1`,
            type: itemTypes[Math.floor(Math.random() * itemTypes.length)],
            x: item1X,
            y: item1Y,
            collected: false,
            size: 25,
            isBox: true
        });
        
        // Tạo item 2
        this.items.push({
            id: `item_pipe_${index}_2`, 
            type: itemTypes[Math.floor(Math.random() * itemTypes.length)],
            x: item2X,
            y: item2Y,
            collected: false,
            size: 25,
            isBox: true
        });
    });
    
    console.log(`Generated ${this.items.length} items for ${this.pipes.length} pipes (2 items per pipe)`);
}

    startGame() {
        // Don't reset ready status here - we need it to check if all players are ready
        
        super.startGame();
        this.gamePhase = 'countdown';
        this.gameTimer = 10; // 10 second countdown as requested
        this.lastCountdown = 10; // Initialize countdown tracker
        
        // Reset all players
        this.playerStates.forEach(player => {
            player.x = 50;
            player.y = this.config.height / 2;
            player.velocityY = 0;
            player.score = 0;
            player.lives = 3;
            player.phase = 'outbound';
            player.alive = true;
            player.effects = {};
            player.items = [];
            player.rank = 0;
        });
        
        this.startGameLoop();
        
        // Broadcast countdown start
        this.broadcast({
            type: 'gameMessage',
            message: `⏰ Game bắt đầu sau ${this.gameTimer} giây! Tất cả hãy chuẩn bị!`
        });
    }

    startGameLoop() {
        if (this.gameLoop) return;
        
        this.lastUpdate = Date.now();
        this.gameLoop = setInterval(() => {
            this.updateGame();
        }, 1000 / 60); // 60 FPS
    }

    stopGameLoop() {
        if (this.gameLoop) {
            clearInterval(this.gameLoop);
            this.gameLoop = null;
        }
    }

    updateGame() {
    const now = Date.now();
    const deltaTime = (now - this.lastUpdate) / 1000;
    this.lastUpdate = now;
    
    // Update countdown
    if (this.gamePhase === 'countdown') {
        this.gameTimer -= deltaTime;
        
        // Broadcast countdown updates
        const seconds = Math.ceil(this.gameTimer);
        if (seconds !== this.lastCountdown && seconds > 0) {
            this.lastCountdown = seconds;
            
            // GỬI CẢ MESSAGE VÀ GAME STATE
            this.broadcast({
                type: 'gameMessage',
                message: `Bắt đầu sau ${seconds}...`
            });
            
            // QUAN TRỌNG: Broadcast gameState để client update countdown
            this.broadcastGameState();
        }
        
        if (this.gameTimer <= 0) {
            this.gamePhase = 'playing';
            this.gameTimer = 0;
            this.broadcast({
                type: 'gameMessage',
                message: '🚀 Game bắt đầu! Good luck!'
            });
            // Broadcast game state khi chuyển sang playing
            this.broadcastGameState();
        }
    }
    
    // Rest of function...
    
    // CHỈ BROADCAST GAME STATE KHI CẦN THIẾT
    if (this.gamePhase === 'playing') {
        // Update players
        this.updatePlayers(deltaTime);
        
        // Update projectiles
        this.updateProjectiles(deltaTime);
        
        // Update items
        this.updateItems();
        
        // Check game end conditions
        this.checkGameEnd();
        
        // Check for respawn
        this.checkRespawnCondition();
        
        // Update leaderboard
        this.updateLeaderboard();
        
        // Broadcast state (mỗi frame khi playing)
        this.broadcastGameState();
    }
}

  updatePlayers(deltaTime) {
    this.playerStates.forEach(player => {
        if (!player.alive) return;
        
        // CHỈ APPLY PHYSICS KHI GAME ĐANG PLAYING
        if (this.gamePhase === 'playing') {
            // Apply gravity
            player.velocityY += this.config.gravity;
            
            // Apply velocity
            player.y += player.velocityY;
            
            // Apply effects
            this.updatePlayerEffects(player, deltaTime);
            
            // Move forward automatically
            let speed = 100; // base speed
            if (player.effects.speed && player.effects.speed.timeLeft > 0) {
                speed *= 1.5;
            }
            player.x += speed * deltaTime;
            
            // Check phase transition
            this.checkPhaseTransition(player);
            
            // Collision detection
            this.checkCollisions(player);
            
            // THÊM NHỮNG DÒNG NÀY:
            this.checkItemCollision(player);
            this.checkTrapCollisions(player);
        }
    });
}

    updatePlayerEffects(player, deltaTime) {
        Object.keys(player.effects).forEach(effectType => {
            const effect = player.effects[effectType];
            if (effect && effect.timeLeft > 0) {
                effect.timeLeft -= deltaTime;
                if (effect.timeLeft <= 0) {
                    delete player.effects[effectType];
                }
            }
        });
    }

    checkPhaseTransition(player) {
        if (player.phase === 'outbound' && player.x >= this.config.raceDistance) {
            player.phase = 'return';
            player.score += 1000; // Bonus for reaching end
        }
        
        if (player.phase === 'return' && player.x <= 50) {
            player.phase = 'finished';
            player.score += 2000; // Bonus for finishing
            
            // Assign rank
            const finishedPlayers = this.playerStates.filter(p => p.phase === 'finished');
            player.rank = finishedPlayers.length;
        }
    }

    checkCollisions(player) {
        // Pipe collisions
        if (!player.effects.shield || player.effects.shield.timeLeft <= 0) {
            this.pipes.forEach(pipe => {
                if (player.x + 15 > pipe.x && player.x - 15 < pipe.x + this.config.pipeWidth) {
                    if (player.y - 15 < pipe.topHeight || player.y + 15 > pipe.bottomY) {
                        this.damagePlayer(player);
                    }
                }
            });
        }
        
        // Item collisions
        this.items.forEach(item => {
            if (!item.collected && this.distance(player, item) < 30) {
                this.collectItem(player, item);
            }
        });
        
        // Projectile collisions
        this.projectiles.forEach(projectile => {
            if (projectile.sourcePlayerId !== player.playerId && 
                this.distance(player, projectile) < 20) {
                this.damagePlayer(player);
                projectile.active = false;
            }
        });
    }

    distance(obj1, obj2) {
        const dx = obj1.x - obj2.x;
        const dy = obj1.y - obj2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    collectItem(player, item) {
        item.collected = true;
        player.items.push(item.type);
        player.score += 100;
        
        // Limit items
        if (player.items.length > 4) {
            player.items.shift();
        }
    }

    damagePlayer(player) {
        if (player.effects.shield && player.effects.shield.timeLeft > 0) {
            return; // Shield protects
        }
        
        player.lives--;
        player.score = Math.max(0, player.score - 200);
        
        if (player.lives <= 0) {
            this.killPlayer(player);
        }
    }

    killPlayer(player) {
        player.alive = false;
        player.velocityY = 0;
    }

    updateProjectiles(deltaTime) {
        this.projectiles = this.projectiles.filter(projectile => {
            if (!projectile.active) return false;
            
            projectile.x += projectile.velocityX * deltaTime;
            projectile.y += projectile.velocityY * deltaTime;
            
            // Remove if out of bounds
            if (projectile.x < 0 || projectile.x > this.config.raceDistance + 200 ||
                projectile.y < 0 || projectile.y > this.config.height) {
                return false;
            }
            
            return true;
        });
    }

    updateItems() {
        // Clean up collected items
        this.items = this.items.filter(item => !item.collected);
    }

    updateLeaderboard() {
        this.leaderboard = this.playerStates
            .filter(p => p.alive || p.phase === 'finished')
            .sort((a, b) => {
                // Finished players first
                if (a.phase === 'finished' && b.phase !== 'finished') return -1;
                if (b.phase === 'finished' && a.phase !== 'finished') return 1;
                
                // Then by rank (if finished)
                if (a.phase === 'finished' && b.phase === 'finished') {
                    return a.rank - b.rank;
                }
                
                // Then by progress
                const aProgress = a.phase === 'return' ? 
                    this.config.raceDistance + (this.config.raceDistance - a.x) : a.x;
                const bProgress = b.phase === 'return' ? 
                    this.config.raceDistance + (this.config.raceDistance - b.x) : b.x;
                
                return bProgress - aProgress;
            })
            .map(p => ({
                playerId: p.playerId,
                score: p.score,
                rank: p.rank
            }));
    }

    checkRespawnCondition() {
        // Check if we need to show respawn option
        if (this.gamePhase === 'playing' || this.gamePhase === 'finished') {
            const alivePlayers = this.playerStates.filter(p => p.alive);
            const deadPlayers = this.playerStates.filter(p => !p.alive);
            
            // If there are dead players, allow them to trigger respawn
            if (deadPlayers.length > 0) {
                // Check if all players are ready for restart
                const allPlayersReady = this.players.every(player => 
                    this.playersReady[player.playerId] === true
                );
                
                // Auto-start if no players in room or all ready
                if (this.players.length === 0 || allPlayersReady) {
                    this.respawnGame();
                }
            }
        }
    }

// THÊM VÀO CLASS FlappyRaceGame trong file GameServer/src/games/FlappyRaceGame.js

checkItemCollision(player) {
    this.items.forEach(item => {
        if (item.collected) return;
        
        // COLLISION DETECTION
        const playerLeft = player.x - 10;
        const playerRight = player.x + 30;
        const playerTop = player.y - 10;
        const playerBottom = player.y + 30;
        
        const itemLeft = item.x - (item.size / 2);
        const itemRight = item.x + (item.size / 2);
        const itemTop = item.y - (item.size / 2);
        const itemBottom = item.y + (item.size / 2);
        
        if (playerRight > itemLeft && 
            playerLeft < itemRight && 
            playerBottom > itemTop && 
            playerTop < itemBottom) {
            
            // Thu thập item
            item.collected = true;
            
            // CHỈ GIỮ 1 ITEM - Thay thế item cũ
            player.currentItem = {
                type: item.type,
                collectedAt: Date.now()
            };
            
            console.log(`Player ${player.playerId} collected ${item.type} (replaced previous item)`);
            
            // Broadcast item collected
            this.broadcast({
                type: 'itemCollected',
                playerId: player.playerId,
                itemType: item.type,
                itemId: item.id
            });
        }
    });
}



// THÊM VÀO CLASS FlappyRaceGame trong file GameServer/src/games/FlappyRaceGame.js

handleBombAction(player) {
    const bombRange = 150; // Tầm 3cm trên màn hình
    const affectedPlayers = [];
    
    this.playerStates.forEach(otherPlayer => {
        if (otherPlayer.playerId === player.playerId) return;
        if (!otherPlayer.alive) return;
        
        // Tính khoảng cách
        const distance = Math.sqrt(
            Math.pow(otherPlayer.x - player.x, 2) + 
            Math.pow(otherPlayer.y - player.y, 2)
        );
        
        if (distance <= bombRange) {
            // Áp dụng hiệu ứng bomb
            otherPlayer.velocityY = -15; // Đẩy lên mạnh
            otherPlayer.effects.stunned = {
                timeLeft: 2000, // Choáng 2 giây
                startTime: Date.now()
            };
            
            affectedPlayers.push(otherPlayer.playerId);
        }
    });
    
    // Broadcast bomb effect
    this.broadcast({
        type: 'bombExploded',
        bomberId: player.playerId,
        bomberX: player.x,
        bomberY: player.y,
        affectedPlayers: affectedPlayers,
        range: bombRange
    });
    
    console.log(`Bomb from ${player.playerId} affected ${affectedPlayers.length} players`);
}

// THÊM VÀO CLASS FlappyRaceGame

handleShieldAction(player) {
    player.effects.shield = {
        timeLeft: 3000, // 3 giây
        startTime: Date.now()
    };
    
    this.broadcast({
        type: 'shieldActivated',
        playerId: player.playerId,
        duration: 3000
    });
    
    console.log(`Player ${player.playerId} activated shield for 3 seconds`);
}

// THÊM VÀO CLASS FlappyRaceGame

handleTrapAction(player, data) {
    // Đặt bẫy ở vị trí chỉ định hoặc vị trí hiện tại
    const trapX = data.targetX || player.x + 100; // Phía trước player
    const trapY = data.targetY || player.y;
    
    const trap = {
        id: `trap_${Date.now()}_${player.playerId}`,
        x: trapX,
        y: trapY,
        ownerId: player.playerId,
        createdAt: Date.now(),
        duration: 10000, // Tồn tại 10 giây
        triggered: false
    };
    
    if (!this.traps) this.traps = []; // Khởi tạo nếu chưa có
    this.traps.push(trap);
    
    this.broadcast({
        type: 'trapPlaced',
        trap: trap,
        placerId: player.playerId
    });
    
    console.log(`Player ${player.playerId} placed trap at ${trapX}, ${trapY}`);
}

checkTrapCollisions(player) {
    if (!this.traps) return;
    
    this.traps.forEach(trap => {
        if (trap.triggered || trap.ownerId === player.playerId) return;
        
        const distance = Math.sqrt(
            Math.pow(player.x - trap.x, 2) + 
            Math.pow(player.y - trap.y, 2)
        );
        
        if (distance <= 30) { // Kích hoạt bẫy
            trap.triggered = true;
            
            // Hiệu ứng bẫy
            player.effects.trapped = {
                timeLeft: 2000, // Bị mắc kẹt 2 giây
                startTime: Date.now()
            };
            player.velocityY = 0; // Dừng lại
            
            this.broadcast({
                type: 'trapTriggered',
                trapId: trap.id,
                victimId: player.playerId,
                placerId: trap.ownerId
            });
        }
    });
}








    respawnGame() {
        console.log('Respawning game...');
        
        // Reset game state
        this.gamePhase = 'countdown';
        this.gameTimer = 10; // 10 second countdown
        this.lastCountdown = 10; // Reset countdown tracker
        this.status = 'playing';
        
        // Reset all players
        this.playerStates.forEach(player => {
            player.x = 50;
            player.y = this.config.height / 2;
            player.velocityY = 0;
            player.lives = 3;
            player.phase = 'outbound';
            player.alive = true;
            player.effects = {};
            player.items = [];
            player.rank = 0;
            // Keep score from previous round
        });
        
        // Clear ready status for next round
        this.playersReady = {};
        
        // Regenerate map items
        if (this.gameSettings.itemsEnabled) {
            this.generateItems();
        }
        
        // Restart game loop if not running
        if (!this.gameLoop) {
            this.startGameLoop();
        }
        
        this.broadcast({
            type: 'gameMessage',
            message: `🔄 Ván mới! Chuẩn bị trong ${this.gameTimer} giây!`
        });
        
        // Reset ready buttons on client and go back to game
        this.broadcast({
            type: 'respawnStarted'
        });
    }

    checkGameEnd() {
        const alivePlayers = this.playerStates.filter(p => p.alive);
        const finishedPlayers = this.playerStates.filter(p => p.phase === 'finished');
        
        // End conditions based on game mode
        switch (this.gameSettings.mode) {
            case 'classic':
                if (finishedPlayers.length > 0 || alivePlayers.length === 0) {
                    this.endRound(); // Change to endRound instead of endGame
                }
                break;
                
            case 'battle':
                if (alivePlayers.length <= 1) {
                    this.endRound();
                }
                break;
                
            case 'time':
                if (this.gameTimer >= 300) { // 5 minutes
                    this.endRound();
                }
                break;
                
            case 'endless':
                // Endless mode doesn't end automatically
                if (alivePlayers.length === 0) {
                    this.endRound();
                }
                break;
        }
    }

    endRound() {
        this.gamePhase = 'finished';
        // Don't change status to 'finished' - keep it as 'playing' to allow respawn
        
        // Determine round winner
        let roundWinner = null;
        if (this.leaderboard.length > 0) {
            roundWinner = this.leaderboard[0].playerId;
        }
        
        this.broadcast({
            type: 'gameMessage',
            message: roundWinner ? 
                `🏆 Người chơi ${roundWinner.slice(-3)} thắng round này!` : 
                '🏁 Round kết thúc!'
        });
        
        // Show respawn ready button
        this.broadcast({
            type: 'showRespawn'
        });
        
        this.broadcastGameState();
    }

    endGame() {
        this.gamePhase = 'finished';
        this.status = 'finished';
        this.stopGameLoop();
        
        // Determine final winner
        if (this.leaderboard.length > 0) {
            this.winner = this.leaderboard[0].playerId;
        }
        
        this.broadcastGameState();
    }

handleGameAction(playerId, action, data) {
    const player = this.playerStates.find(p => p.playerId === playerId);
    if (!player || !player.alive) return { error: 'Player not found or dead' };

    switch (action) {
        case 'flap':
            return this.handleFlap(player);
            
        case 'useItem':
    // CHỈ KIỂM TRA currentItem THAY VÌ items array
    if (player.currentItem) {
        const itemType = player.currentItem.type;
        
        // Sử dụng item
        switch (itemType) {
            case 'speed':
                player.effects.speed = { 
                    timeLeft: 5000,
                    startTime: Date.now()
                };
                this.broadcast({
                    type: 'speedActivated',
                    playerId: player.playerId,
                    duration: 5000
                });
                break;
                
            case 'shield':
                this.handleShieldAction(player);
                break;
                
            case 'bomb':
                this.handleBombAction(player);
                break;
                
            case 'trap':
                this.handleTrapAction(player, data);
                break;
        }
        
        // XÓA ITEM SAU KHI DÙNG
        const usedItemType = player.currentItem.type;
        player.currentItem = null;
        
        this.broadcast({
            type: 'itemUsed',
            playerId: player.playerId,
            itemType: usedItemType
        });
        
        return { success: true, itemUsed: usedItemType };
    } else {
        return { error: 'No item to use' };
    }
            return { error: 'No items in inventory' };
            
        case 'pause':
            return this.handlePause();
            
        default:
            return { error: 'Unknown action' };
    }
}

    handleFlap(player) {
        if (this.gamePhase !== 'playing') return { error: 'Game not in playing state' };
        
        player.velocityY = this.config.flapStrength;
        player.score += 10; // Small score for flapping
        
        return { success: true };
    }

    handleUseItem(player, itemType) {
        const itemIndex = player.items.indexOf(itemType);
        if (itemIndex === -1) return { error: 'Item not found' };
        
        // Remove item from inventory
        player.items.splice(itemIndex, 1);
        
        switch (itemType) {
            case 'speed':
                player.effects.speed = { timeLeft: 5 };
                break;
                
            case 'shield':
                player.effects.shield = { timeLeft: 8 };
                break;
                
            case 'bomb':
                this.createProjectile(player, 'bomb');
                break;
                
            case 'trap':
                this.createTrap(player);
                break;
        }
        
        return { success: true };
    }

    createProjectile(player, type) {
        this.projectiles.push({
            id: `proj_${Date.now()}_${Math.random()}`,
            type: type,
            x: player.x + 20,
            y: player.y,
            velocityX: 200,
            velocityY: 0,
            sourcePlayerId: player.playerId,
            active: true
        });
    }

    createTrap(player) {
        this.items.push({
            id: `trap_${Date.now()}_${Math.random()}`,
            type: 'trap_active',
            x: player.x + 50,
            y: player.y,
            collected: false,
            sourcePlayerId: player.playerId
        });
    }

    handlePause() {
        // Toggle pause state
        if (this.gamePhase === 'playing') {
            this.gamePhase = 'paused';
            this.stopGameLoop();
        } else if (this.gamePhase === 'paused') {
            this.gamePhase = 'playing';
            this.startGameLoop();
        }
        
        return { success: true };
    }

    resetGame() {
        super.resetGame();
        
        // Reset game state
        this.pipes = [];
        this.items = [];
        this.projectiles = [];
        this.gamePhase = 'waiting';
        this.gameTimer = 0;
        this.leaderboard = [];
        this.playersReady = {}; // Reset ready status
        
        // Reset players
        this.playerStates.forEach(player => {
            player.x = 50;
            player.y = this.config.height / 2;
            player.velocityY = 0;
            player.score = 0;
            player.lives = 3;
            player.phase = 'outbound';
            player.alive = true;
            player.effects = {};
            player.items = [];
            player.rank = 0;
        });
        
        this.stopGameLoop();
        this.status = 'setup'; // Back to setup mode
        this.broadcastGameState();
    }

    // Override handlePlayerReady to support respawn
 handlePlayerReady(playerId, settings) {
    console.log(`Player ${playerId} ready for game ${this.gameId}`);
    
    // If game is in finished state (round ended), this is for respawn
    if (this.gamePhase === 'finished') {
        this.playersReady[playerId] = true;
        
        console.log(`Players ready: ${Object.keys(this.playersReady).length}/${this.players.length}`);
        
        // Broadcast ready update
        this.broadcast({
            type: 'readyUpdate',
            playersReady: this.playersReady
        });
        
        // AUTO-START nếu chỉ có 1 người HOẶC tất cả đã ready
        const readyCount = Object.keys(this.playersReady).length;
        const totalPlayers = this.players.length;
        
        if (totalPlayers === 1 || readyCount === totalPlayers) {
            console.log(`🚀 Starting new round - ${readyCount}/${totalPlayers} players ready`);
            setTimeout(() => {
                this.respawnGame();
            }, 1000); // Delay 1s để người chơi thấy
        }
        
        return { success: true };
    }
    
    // Otherwise, use parent implementation for initial ready
    return super.handlePlayerReady(playerId, settings);
}

    broadcastGameState() {
        const payload = {
            ...this.getGameState(),
            config: this.config,
            pipes: this.pipes,
            items: this.items,
            projectiles: this.projectiles,
            playerStates: this.playerStates,
            gamePhase: this.gamePhase,
            gameTimer: Math.floor(this.gameTimer),
            leaderboard: this.leaderboard,
            settings: this.gameSettings
        };
        
        this.broadcast(payload);
    }
}

module.exports = FlappyRaceGame;