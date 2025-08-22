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
            pipeGap: 120,
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
    console.log(`✅ Player ${playerInfo.playerId} joined flappy race game`);
    
    // Kiểm tra xem player đã tồn tại chưa
    const existingPlayerIndex = this.playerStates.findIndex(p => p.playerId === playerInfo.playerId);
    
    if (existingPlayerIndex === -1) {
        // Player mới - thêm vào
        const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF'];
        const playerIndex = this.playerStates.length;
        
        this.playerStates.push({
            playerId: playerInfo.playerId,
            x: 50,
            y: this.config.height / 2,
            velocityY: 0,
            score: 0,
            lives: 3,
            phase: 'outbound',
            alive: true,
            effects: {},
            items: [],
            rank: 0,
            color: colors[playerIndex % colors.length],
            invulnerable: true,
            invulnerableTime: 3.0,
            canCollideWithPlayers: false
        });
        
        console.log(`Added new player. Total players: ${this.playerStates.length}`);
    } else {
        console.log(`Player already exists at index ${existingPlayerIndex}`);
    }
    
    // Broadcast updated game state
    this.broadcastGameState();
    
    return {
        isHost: this.players.length === 1,
        gameConfig: this.config,
        color: this.playerStates[this.playerStates.length - 1]?.color || '#FFD700'
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
    
    // ===== TĂNG KHOẢNG CÁCH GIỮA CÁC ỐNG =====
    // 225px thay vì 150px (gấp rưỡi)
    for (let x = 300; x < this.config.raceDistance; x += 225) {
        
        // ===== MỞ RỘNG ĐƯỜNG BAY =====
        const topPathCenter = this.config.height * 0.3;    // 30% chiều cao cho đường trên
        const bottomPathCenter = this.config.height * 0.7; // 70% chiều cao cho đường dưới
        const pathGap = 160; // TĂNG TỪNG 80px LÊN 160px (GẤP ĐÔI)
        
        // Tạo variation dựa trên map type (giảm để không quá khó)
        let heightVariation = 0;
        switch (mapType) {
            case 'jungle':
                heightVariation = Math.sin(x * 0.008) * 15; // Giảm variation
                break;
            case 'city':
                heightVariation = (x % 400) * 0.08; // Giảm variation
                break;
            case 'space':
                heightVariation = (Math.random() - 0.5) * 25; // Giảm variation
                break;
            default: // classic
                heightVariation = (Math.random() - 0.5) * 20; // Giảm variation
        }
        
        // ===== TÍNH TOÁN 3 ĐOẠN ỐNG VỚI KHOẢNG CÁCH LỚN HƠN =====
        // Đoạn 1: Từ top xuống đến đường đi trên
        const topGapStart = topPathCenter - pathGap/2 + heightVariation;
        const topGapEnd = topPathCenter + pathGap/2 + heightVariation;
        
        // Đoạn 2: Từ sau đường đi trên xuống đến đường đi dưới  
        const bottomGapStart = bottomPathCenter - pathGap/2 + heightVariation;
        const bottomGapEnd = bottomPathCenter + pathGap/2 + heightVariation;
        
        // ===== TĂNG KHOẢNG CÁCH TỐI THIỂU GIỮA 2 GAP =====
        const minSpacing = 100; // Tăng từ 60px lên 100px
        const adjustedBottomGapStart = Math.max(bottomGapStart, topGapEnd + minSpacing);
        const adjustedBottomGapEnd = adjustedBottomGapStart + pathGap;
        
        // ===== TẠO 3 PHẦN ỐNG VỚI AN TOÀN HƠN =====
        const pipe = {
            x: x,
            // Phần 1: Ống trên cùng (từ 0 đến top gap)
            topHeight: Math.max(30, topGapStart), // Tăng min height
            
            // Phần 2: Ống giữa (giữa 2 gap)
            middleY: topGapEnd,
            middleHeight: Math.max(30, adjustedBottomGapStart - topGapEnd), // Tăng min height
            
            // Phần 3: Ống dưới cùng (từ bottom gap đến cuối)
            bottomY: adjustedBottomGapEnd,
            bottomHeight: Math.max(30, this.config.height - adjustedBottomGapEnd), // Tăng min height
            
            // Lưu thông tin về 2 gaps để kiểm tra collision
            topGapStart: topGapStart,
            topGapEnd: topGapEnd,
            bottomGapStart: adjustedBottomGapStart,
            bottomGapEnd: adjustedBottomGapEnd
        };
        
        this.pipes.push(pipe);
    }
    
    console.log(`Generated ${this.pipes.length} pipes with wider paths (160px gaps, 225px spacing) for map: ${mapType}`);
}

generateItems() {
    this.items = [];
    const itemTypes = ['speed', 'shield', 'bomb', 'trap'];
    
    // Tăng khoảng cách tương ứng với pipes
    for (let x = 400; x < this.config.raceDistance; x += 300) {
        if (Math.random() < 0.6) { // Giảm tỷ lệ xuống 60% vì khoảng cách tăng
            const itemType = itemTypes[Math.floor(Math.random() * itemTypes.length)];
            
            // ===== ĐẶT ITEMS Ở 2 ĐƯỜNG ĐI VỚI VARIATION LỚN HƠN =====
            const isTopPath = Math.random() < 0.5;
            const pathY = isTopPath ? this.config.height * 0.3 : this.config.height * 0.7;
            const yVariation = (Math.random() - 0.5) * 60; // Tăng variation
            
            this.items.push({
                id: `item_${Date.now()}_${Math.random()}`,
                type: itemType,
                x: x + Math.random() * 150 - 75, // Tăng random range
                y: Math.max(50, Math.min(this.config.height - 50, pathY + yVariation)),
                collected: false
            });
        }
    }
}

   startGame() {
    console.log('🎮 Starting game...');
    
    // Chuyển sang playing status
    this.status = 'playing';
    this.gamePhase = 'countdown';
    this.gameTimer = 10;
    this.lastCountdown = 10;
    
    // ===== SETUP PLAYERS CHO ROUND ĐẦU =====
    this.playerStates.forEach((player, index) => {
        const totalPlayers = this.playerStates.length;
        const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF'];
        
        // CHIA THÀNH 2 ĐƯỜNG: TRÊN VÀ DƯỚI
        const isTopPath = index % 2 === 0;
        const pathCenter = isTopPath ? this.config.height * 0.3 : this.config.height * 0.7;
        
        const playersInPath = Math.ceil(totalPlayers / 2);
        const indexInPath = Math.floor(index / 2);
        const spacing = 50;
        
        const totalHeight = (playersInPath - 1) * spacing;
        const firstBirdY = pathCenter - (totalHeight / 2);
        
        player.x = 50;
        player.y = firstBirdY + (indexInPath * spacing);
        player.velocityY = 0;
        player.score = 0; // Reset score cho game mới
        player.lives = 3;
        player.phase = 'outbound';
        player.alive = true;
        player.effects = {};
        player.items = [];
        player.rank = 0;
        player.color = colors[index % colors.length];
        
        // ===== THÊM HỆ THỐNG BẤT TỬ 3 GIÂY =====
        player.invulnerable = true;
        player.invulnerableTime = 3.0;
        player.canCollideWithPlayers = false;
    });
    
    // Generate map và items
    this.generateMap(this.gameSettings.mapType || 'classic');
    if (this.gameSettings.itemsEnabled) {
        this.generateItems();
    }
    
    // Start game loop
    this.startGameLoop();
    
    this.broadcast({
        type: 'gameMessage',
        message: `⏰ Game bắt đầu sau ${this.gameTimer} giây! 3 giây đầu bất tử!`
    });
    
    // Notify clients game started
    this.broadcast({
        type: 'gameStarted'
    });
    
    this.broadcastGameState();
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
            // ===== CẬP NHẬT THỜI GIAN BẤT TỬ =====
            if (player.invulnerable && player.invulnerableTime > 0) {
                player.invulnerableTime -= deltaTime;
                if (player.invulnerableTime <= 0) {
                    player.invulnerable = false;
                    player.canCollideWithPlayers = true; // Bật va chạm với players
                    console.log(`Player ${player.playerId} is no longer invulnerable`);
                }
            }
            
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
            
            // ===== COLLISION DETECTION =====
            this.checkCollisions(player);
            
            // ===== KIỂM TRA VA CHẠM GIỮA CÁC CHIM =====
            if (player.canCollideWithPlayers) {
                this.checkPlayerCollisions(player);
            }
        }
    });
}
checkPlayerCollisions(currentPlayer) {
    if (!currentPlayer.alive || currentPlayer.invulnerable) return;
    
    this.playerStates.forEach(otherPlayer => {
        if (otherPlayer.playerId === currentPlayer.playerId) return; // Không tự va chạm
        if (!otherPlayer.alive || otherPlayer.invulnerable) return; // Bỏ qua player chết hoặc bất tử
        
        // Tính khoảng cách giữa 2 chim
        const dx = currentPlayer.x - otherPlayer.x;
        const dy = currentPlayer.y - otherPlayer.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Nếu khoảng cách < 25 pixels thì va chạm
        if (distance < 25) {
            console.log(`Player collision: ${currentPlayer.playerId} vs ${otherPlayer.playerId}`);
            
            // Cả 2 chim đều chết
            this.killPlayer(currentPlayer, 'player_collision');
            this.killPlayer(otherPlayer, 'player_collision');
            
            // Broadcast thông báo va chạm
            this.broadcast({
                type: 'gameMessage',
                message: `💥 ${currentPlayer.playerId.slice(-3)} và ${otherPlayer.playerId.slice(-3)} va chạm!`
            });
            
            return; // Thoát khỏi vòng lặp
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
    // ===== VA CHẠM VỚI ỐNG 3 PHẦN - LUÔN CHẾT =====
    this.pipes.forEach(pipe => {
        if (player.x + 15 > pipe.x && player.x - 15 < pipe.x + 60) {
            const playerTop = player.y - 15;
            const playerBottom = player.y + 15;
            
            // Kiểm tra va chạm với 3 phần ống
            const hitTopPipe = playerTop < pipe.topHeight;
            const hitMiddlePipe = (playerBottom > pipe.middleY && playerTop < pipe.middleY + pipe.middleHeight);
            const hitBottomPipe = playerBottom > pipe.bottomY;
            
            if (hitTopPipe || hitMiddlePipe || hitBottomPipe) {
                console.log(`Player ${player.playerId} hit pipe - invulnerable: ${player.invulnerable}`);
                this.killPlayer(player, 'pipe'); // Ống luôn giết, kể cả khi bất tử
                return;
            }
        }
    });
    
    // Boundary collisions - cũng luôn chết
    if (player.y <= 0 || player.y >= this.config.height) {
        this.killPlayer(player, 'boundary');
        return;
    }
    
    // ===== VA CHẠM VỚI ITEMS - CHỈ KHI KHÔNG BẤT TỬ =====
    if (!player.invulnerable) {
        this.items.forEach(item => {
            if (!item.collected && 
                Math.abs(player.x - item.x) < 20 && 
                Math.abs(player.y - item.y) < 20) {
                
                item.collected = true;
                this.handleItemCollection(player, item);
            }
        });
    }
    
    // ===== VA CHẠM VỚI PROJECTILES - CHỈ KHI KHÔNG BẤT TỬ =====
    if (!player.invulnerable) {
        this.projectiles.forEach(proj => {
            if (proj.playerId !== player.playerId && 
                Math.abs(player.x - proj.x) < 15 && 
                Math.abs(player.y - proj.y) < 15) {
                
                proj.active = false;
                this.killPlayer(player, 'projectile');
            }
        });
    }
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

    killPlayer(player, reason = 'pipe') {
    if (player.invulnerable && reason === 'player_collision') {
        return; // Không chết nếu đang bất tử và va chạm với player
    }
    
    player.alive = false;
    player.velocityY = 0;
    player.invulnerable = false; // Mất bất tử khi chết
    player.canCollideWithPlayers = false;
    
    // Giảm mạng
    player.lives--;
    
    console.log(`Player ${player.playerId} killed by ${reason}, lives left: ${player.lives}`);
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

   
calculatePlayerSpawnPositions() {
    const totalPlayers = this.playerStates.length;
    const startY = this.config.height / 2; // Điểm giữa màn hình
    const spacing = 60; // Khoảng cách giữa các con chim
    
    // Nếu chỉ có 1 người chơi, đặt ở giữa
    if (totalPlayers === 1) {
        return [{ x: 50, y: startY }];
    }
    
    // Căn giữa tất cả các con chim
    const totalHeight = (totalPlayers - 1) * spacing;
    const firstBirdY = startY - (totalHeight / 2);
    
    return this.playerStates.map((_, index) => ({
        x: 50,
        y: firstBirdY + (index * spacing)
    }));
}

    checkGameEnd() {
    const alivePlayers = this.playerStates.filter(p => p.alive);
    const finishedPlayers = this.playerStates.filter(p => p.phase === 'finished');
    
    // End conditions based on game mode
    switch (this.gameSettings.mode) {
        case 'classic':
            if (finishedPlayers.length > 0 || alivePlayers.length === 0) {
                this.endRound(); // Đổi từ endGame sang endRound
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
            if (alivePlayers.length === 0) {
                this.endRound();
            }
            break;
    }
}

    endRound() {
    console.log('🏁 Round finished, preparing for next round...');
    
    this.gamePhase = 'finished';
    // QUAN TRỌNG: Không đổi this.status - giữ nguyên 'playing' để cho phép restart
    this.stopGameLoop();
    
    // Determine round winner
    let roundWinner = null;
    if (this.leaderboard.length > 0) {
        roundWinner = this.leaderboard[0].playerId;
    }
    
    // Clear ready status để chuẩn bị cho round mới
    this.playersReady = {};
    
    this.broadcast({
        type: 'gameMessage',
        message: roundWinner ? 
            `🏆 Người chơi ${roundWinner.slice(-3)} thắng round này!` : 
            '🏁 Round kết thúc!'
    });
    
    // Hiển thị nút sẵn sàng cho round mới
    this.broadcast({
        type: 'roundFinished',
        winner: roundWinner,
        leaderboard: this.leaderboard
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
                return this.handleUseItem(player, data.itemType);
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
    console.log('Resetting game...');
    
    // Reset ready status
    this.playersReady = {};
    this.status = 'setup';
    this.gameSettings = {};
    
    // ===== RESET VỊ TRÍ PLAYERS THÀNH HÀNG =====
    this.playerStates.forEach((player, index) => {
        const totalPlayers = this.playerStates.length;
        const startY = this.config.height / 2;
        const spacing = 60;
        
        // Căn giữa tất cả các con chim
        const totalHeight = (totalPlayers - 1) * spacing;
        const firstBirdY = startY - (totalHeight / 2);
        
        player.x = 50;
        player.y = firstBirdY + (index * spacing); // Xếp hàng
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
    this.broadcastGameState();
}
startNewRound() {
    console.log('🔄 Starting new round...');
    
    // Reset game phase
    this.gamePhase = 'countdown';
    this.gameTimer = 10; // 10 second countdown
    this.lastCountdown = 10;
    
    // ===== RESET VỊ TRÍ PLAYERS CHO ROUND MỚI =====
    this.playerStates.forEach((player, index) => {
        const totalPlayers = this.playerStates.length;
        
        // CHIA THÀNH 2 ĐƯỜNG
        const isTopPath = index % 2 === 0;
        const pathCenter = isTopPath ? this.config.height * 0.3 : this.config.height * 0.7;
        
        const playersInPath = Math.ceil(totalPlayers / 2);
        const indexInPath = Math.floor(index / 2);
        const spacing = 50;
        
        const totalHeight = (playersInPath - 1) * spacing;
        const firstBirdY = pathCenter - (totalHeight / 2);
        
        player.x = 50;
        player.y = firstBirdY + (indexInPath * spacing);
        player.velocityY = 0;
        player.lives = 3;
        player.phase = 'outbound';
        player.alive = true;
        player.effects = {};
        player.items = [];
        player.rank = 0;
        // GIỮ NGUYÊN SCORE TÍCH LŨY QUA CÁC ROUND
        
        // Reset bất tử
        player.invulnerable = true;
        player.invulnerableTime = 3.0;
        player.canCollideWithPlayers = false;
    });
    
    // Clear ready status cho round mới
    this.playersReady = {};
    
    // Regenerate map
    this.generateMap(this.gameSettings.mapType || 'classic');
    
    // Regenerate items
    if (this.gameSettings.itemsEnabled) {
        this.generateItems();
    }
    
    // Clear projectiles
    this.projectiles = [];
    
    // Start game loop
    this.startGameLoop();
    
    this.broadcast({
        type: 'gameMessage',
        message: `🔄 Round mới bắt đầu! Tất cả hãy chuẩn bị!`
    });
    
    // Notify clients that new round started
    this.broadcast({
        type: 'newRoundStarted'
    });
    
    this.broadcastGameState();
}

    // Override handlePlayerReady to support respawn
handlePlayerReady(playerId, settings) {
    console.log(`🎯 Player ${playerId} ready - gamePhase: ${this.gamePhase}, status: ${this.status}`);
    
    this.playersReady[playerId] = true;
    
    // Lưu settings nếu có
    if (settings && !this.gameSettings[playerId]) {
        this.gameSettings[playerId] = settings;
    }
    
    console.log(`Ready status: ${Object.keys(this.playersReady).length}/${this.players.length}`);
    
    // Broadcast ready update
    this.broadcast({
        type: 'readyUpdate',
        playersReady: this.playersReady
    });
    
    // ===== LOGIC KHỞI ĐỘNG GAME =====
    const readyCount = Object.keys(this.playersReady).length;
    const totalPlayers = this.players.length;
    
    // Nếu tất cả đã ready
    if (readyCount === totalPlayers && totalPlayers > 0) {
        console.log('🚀 All players ready!');
        
        if (this.gamePhase === 'finished') {
            // Đang ở cuối round → start round mới
            console.log('Starting new round...');
            setTimeout(() => {
                this.startNewRound();
            }, 1000);
        } else {
            // Đang ở setup → start game lần đầu
            console.log('Starting first game...');
            setTimeout(() => {
                this.startGame();
            }, 1000);
        }
    }
    
    return { success: true };
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