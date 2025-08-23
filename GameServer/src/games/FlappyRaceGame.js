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
            const topGapStart = topPathCenter - pathGap / 2 + heightVariation;
            const topGapEnd = topPathCenter + pathGap / 2 + heightVariation;

            // Đoạn 2: Từ sau đường đi trên xuống đến đường đi dưới  
            const bottomGapStart = bottomPathCenter - pathGap / 2 + heightVariation;
            const bottomGapEnd = bottomPathCenter + pathGap / 2 + heightVariation;

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
    calculateFinalRankings() {
        console.log('📊 Calculating final rankings...');

        // Sắp xếp players theo priority:
        // 1. Finished players (theo rank)
        // 2. Return phase players (theo tiến độ gần về đích)
        // 3. Outbound phase players (theo tiến độ xa nhất)
        // 4. Dead players (theo tiến độ trước khi chết)

        const rankedPlayers = this.playerStates
            .map(p => {
                let progress = 0;
                let priority = 4; // Default: lowest priority

                if (p.phase === 'finished') {
                    progress = 2 * this.config.raceDistance; // Full trip
                    priority = 1; // Highest priority
                } else if (p.phase === 'return') {
                    progress = this.config.raceDistance + (this.config.raceDistance - p.x);
                    priority = 2;
                } else if (p.phase === 'outbound') {
                    progress = p.x;
                    priority = p.alive ? 3 : 4;
                }

                return {
                    ...p,
                    finalProgress: progress,
                    priority: priority
                };
            })
            .sort((a, b) => {
                // Sort by priority first
                if (a.priority !== b.priority) {
                    return a.priority - b.priority;
                }

                // Within same priority, sort by progress
                if (a.priority === 1) {
                    // Finished players: by rank (lower is better)
                    return a.rank - b.rank;
                } else {
                    // Others: by progress (higher is better)
                    return b.finalProgress - a.finalProgress;
                }
            });

        // Update leaderboard
        this.leaderboard = rankedPlayers.map((p, index) => ({
            playerId: p.playerId,
            score: p.score,
            rank: index + 1,
            phase: p.phase,
            progress: p.finalProgress
        }));

        console.log('📊 Final rankings:', this.leaderboard);
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
        this.gameTimer = 3;
        this.lastCountdown = 3;

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

    // ===== CẬP NHẬT COUNTDOWN =====
    if (this.gamePhase === 'countdown') {
        this.gameTimer -= deltaTime;

        const seconds = Math.ceil(this.gameTimer);
        if (seconds !== this.lastCountdown && seconds > 0) {
            this.lastCountdown = seconds;
            this.broadcast({
                type: 'gameMessage',
                message: `Bắt đầu sau ${seconds}...`
            });
            this.broadcastGameState();
        }

        if (this.gameTimer <= 0) {
            this.gamePhase = 'playing';
            this.gameTimer = 0;
            this.broadcast({
                type: 'gameMessage',
                message: '🚀 Game bắt đầu! Good luck!'
            });
            this.broadcastGameState();
        }
    }

    // ===== CẬP NHẬT GAME PLAYING - LUÔN CHẠY! =====
    if (this.gamePhase === 'playing') {
        // ❌ XÓA TẤT CẢ các hàm có thể gây delay hoặc return
        // ✅ CHỈ GIỮ LẠI logic cập nhật game state
        
        this.updatePlayers(deltaTime);      
        this.updateProjectiles(deltaTime);  
        this.updateItems();                 
        this.handleAutoRespawn();  // Tự động respawn, không chờ
        this.checkRealGameEnd();    // Chỉ end khi thật sự cần
        this.updateLeaderboard();
        this.broadcastGameState();
    }
}
handleAutoRespawn() {
    this.playerStates.forEach(player => {
        // Tự động respawn sau 3 giây nếu chết và còn mạng
        if (!player.alive && player.lives > 0 && !player.respawnTimer) {
            console.log(`⏰ Setting auto-respawn for ${player.playerId}`);
            
            player.respawnTimer = setTimeout(() => {
                // Kiểm tra lại điều kiện trước khi respawn
                const currentPlayer = this.playerStates.find(p => p.playerId === player.playerId);
                if (currentPlayer && !currentPlayer.alive && currentPlayer.lives > 0) {
                    this.executeAutoRespawn(currentPlayer);
                }
                currentPlayer.respawnTimer = null;
            }, 3000); // 3 giây tự động respawn
        }
    });
}


executeAutoRespawn(player) {
    console.log(`🔄 Auto-respawning player: ${player.playerId}`);

    // Tính vị trí spawn
    const spawnPositions = this.calculatePlayerSpawnPositions();
    const playerIndex = this.playerStates.findIndex(p => p.playerId === player.playerId);
    const spawnPos = spawnPositions[playerIndex] || { x: 50, y: this.config.height / 2 };

    // Reset player state
    player.alive = true;
    player.x = spawnPos.x;
    player.y = spawnPos.y;
    player.velocityY = 0;
    player.phase = 'outbound'; // Về lại phase đầu
    player.invulnerable = true; // 3 giây bất tử
    player.invulnerableTime = 3.0;
    player.canCollideWithPlayers = false;

    // Broadcast respawn
    this.broadcast({
        type: 'playerRespawned',
        playerId: player.playerId,
        position: { x: player.x, y: player.y },
        livesLeft: player.lives
    });

    this.broadcast({
        type: 'gameMessage',
        message: `🔄 ${player.playerId.slice(-4)} đã hồi sinh! 3 giây bất tử!`
    });

    console.log(`✅ Player ${player.playerId} auto-respawned with ${player.lives} lives`);
}

checkRealGameEnd() {
    const playersWithLives = this.playerStates.filter(p => p.lives > 0);
    const alivePlayers = this.playerStates.filter(p => p.alive);
    
    // CHỈ kết thúc game khi TẤT CẢ người chơi đều hết mạng
    if (playersWithLives.length === 0) {
        console.log('💀 All players eliminated - ending game');
        this.triggerGameEnd(null);
        return;
    }

    // Kiểm tra winner nếu chỉ còn 1 người có thể thắng
    const finishedPlayers = this.playerStates.filter(p => p.phase === 'finished');
    if (finishedPlayers.length > 0) {
        // Sắp xếp theo rank để tìm winner
        const winner = finishedPlayers.reduce((best, current) => 
            current.rank < best.rank ? current : best
        );
        if (winner && winner.rank === 1) {
            console.log('🏆 Winner found:', winner.playerId);
            this.triggerGameEnd(winner.playerId);
        }
    }
}


handleRespawning() {
    this.playerStates.forEach(player => {
        // Nếu player chết và còn mạng, tự động respawn sau 3 giây
        if (!player.alive && player.lives > 0 && !player.respawnTimer) {
            player.respawnTimer = setTimeout(() => {
                this.respawnPlayer(player.playerId);
                player.respawnTimer = null;
            }, 3000); // 3 giây respawn tự động
        }
    });
}


    shouldContinueGame() {
        const alivePlayers = this.playerStates.filter(p => p.alive);
        const playersWithLives = this.playerStates.filter(p => p.lives > 0);

        // Game tiếp tục nếu:
        // 1. Còn người sống, HOẶC
        // 2. Còn người có mạng (đang chờ respawn)
        return alivePlayers.length > 0 || playersWithLives.length > 0;
    }
    respawnPlayer(playerId) {
    const player = this.playerStates.find(p => p.playerId === playerId);
    if (!player || player.alive || player.lives <= 0) return;

    console.log(`🔄 Respawning player: ${playerId}`);

    // Reset player state
    player.alive = true;
    player.x = Math.random() * (this.gameWidth - 100) + 50; // Random spawn position
    player.y = this.gameHeight / 2;
    player.velocityY = 0;
    player.invulnerable = true; // 3 giây bất tử
    player.lastUpdate = Date.now();

    // Broadcast respawn message
    this.broadcast({
        type: 'gameMessage',
        message: `🔄 ${playerId.slice(-4)} đã hồi sinh! 3 giây bất tử!`
    });

    // Tắt bất tử sau 3 giây
    setTimeout(() => {
        if (player.alive) {
            player.invulnerable = false;
            console.log(`🛡️ Invulnerability ended for ${playerId}`);
        }
    }, 3000);
}



    forceRespawnPlayer(playerId) {
        console.log(`🔧 Force respawn requested for ${playerId}`);
        const player = this.playerStates.find(p => p.playerId === playerId);

        if (!player) {
            console.log(`❌ Player ${playerId} not found for force respawn`);
            return;
        }

        if (player.lives <= 0) {
            player.lives = 1;
            console.log(`🔧 Reset lives for ${playerId} to allow respawn`);
        }

        this.respawnPlayer(playerId);
    }
    respawnAllPlayers() {
        const spawnPositions = this.calculatePlayerSpawnPositions();

        this.playerStates.forEach((player, index) => {
            const spawnPos = spawnPositions[index] || { x: 50, y: this.config.height / 2 };

            player.x = spawnPos.x;
            player.y = spawnPos.y;
            player.velocityY = 0;
            player.alive = true;
            player.phase = 'outbound';
            player.effects = {};
            player.items = [];

            // ===== ĐẢM BẢO MỖI PLAYER CÓ 3 MẠNG =====
            if (!player.lives || player.lives <= 0) {
                player.lives = 3;
            }

            // Bất tử 3 giây khi bắt đầu round
            player.invulnerable = true;
            player.invulnerableTime = 3.0;
            player.canCollideWithPlayers = false;
        });
    }
    updatePlayers(deltaTime) {
    this.playerStates.forEach(player => {
        // ===== LUÔN CẬP NHẬT THỜI GIAN BẤT TỬ (cho cả sống và chết) =====
        if (player.invulnerable && player.invulnerableTime > 0) {
            player.invulnerableTime -= deltaTime;
            if (player.invulnerableTime <= 0) {
                player.invulnerable = false;
                player.canCollideWithPlayers = true;
                console.log(`Player ${player.playerId} is no longer invulnerable`);
            }
        }

        // ===== CHỈ XỬ LÝ PHYSICS CHO NGƯỜI SỐNG =====
        if (!player.alive) return; // ✅ CHUYỂN DÒNG NÀY XUỐNG ĐÂY

        // CHỈ APPLY PHYSICS KHI GAME ĐANG PLAYING
        if (this.gamePhase === 'playing') {
            // ===== QUAN TRỌNG: PHYSICS - GRAVITY =====
            player.velocityY += this.config.gravity;

            // Apply velocity to Y position
            player.y += player.velocityY;

            // Apply effects
            this.updatePlayerEffects(player, deltaTime);

            // ===== QUAN TRỌNG: MOVEMENT BASED ON PHASE =====
            let speed = 100; // base speed
            if (player.effects.speed && player.effects.speed.timeLeft > 0) {
                speed *= 1.5;
            }

            if (player.phase === 'outbound') {
                // OUTBOUND: Bay về phía trước (tăng x)
                player.x += speed * deltaTime;
            } else if (player.phase === 'return') {
                // RETURN: Bay về phía sau (giảm x)
                player.x -= speed * deltaTime;
            }
            // FINISHED: Không di chuyển nữa

            // ===== CHECK BOUNDS =====
            this.checkPlayerBounds(player);

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
        if (!player.effects) return;

        // Update effect timers
        Object.keys(player.effects).forEach(effectType => {
            const effect = player.effects[effectType];
            if (effect.timeLeft > 0) {
                effect.timeLeft -= deltaTime;
                if (effect.timeLeft <= 0) {
                    delete player.effects[effectType];
                    console.log(`Effect ${effectType} expired for player ${player.playerId}`);
                }
            }
        });
    }


    checkPhaseTransition(player) {
        // Outbound to return transition
        if (player.phase === 'outbound' && player.x >= this.config.raceDistance) {
            player.phase = 'return';
            player.score += 500; // Bonus for reaching endpoint
            console.log(`Player ${player.playerId} reached endpoint, returning`);
        }

        // Return to finished transition
        if (player.phase === 'return' && player.x <= 50) {
            player.phase = 'finished';
            player.score += 1000; // Bonus for finishing

            // Assign rank based on finish order
            const finishedCount = this.playerStates.filter(p => p.phase === 'finished').length;
            player.rank = finishedCount;

            console.log(`🏆 Player ${player.playerId} finished! Rank: ${player.rank}`);

            this.broadcast({
                type: 'playerFinished',
                playerId: player.playerId,
                rank: player.rank
            });

            // Check if this is the winner (first to finish)
            if (player.rank === 1) {
                this.triggerGameEnd(player.playerId);
            }
        }
    }

    checkPlayerBounds(player) {
        // ===== VA CHẠM VỚI RANH GIỚI TRÊN/DƯỚI - LUÔN CHẾT =====
        if (player.y <= 0 || player.y >= this.config.height - 30) {
            console.log(`💥 Player ${player.playerId} hit boundary (y: ${player.y}) - killing player`);
            this.killPlayer(player, 'boundary');
            return; // Thoát ngay sau khi chết
        }

        // Prevent going too far right in outbound phase
        if (player.phase === 'outbound' && player.x > this.config.raceDistance + 100) {
            player.x = this.config.raceDistance + 100;
            player.phase = 'return';
            console.log(`⚠️ ${player.playerId} forced into return phase due to bounds`);
        }

        // Prevent going too far left in return phase
        if (player.phase === 'return' && player.x < 0) {
            player.x = 50;
            player.phase = 'finished';
            console.log(`⚠️ ${player.playerId} forced into finished phase due to bounds`);
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
                    console.log(`💥 Player ${player.playerId} hit pipe - killing player`);
                    this.killPlayer(player, 'pipe'); // SỬA: Gọi killPlayer thay vì chỉ log
                    return;
                }
            }
        });

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
    isColliding(player, pipe) {
        const playerLeft = player.x - 15;
        const playerRight = player.x + 15;
        const playerTop = player.y - 15;
        const playerBottom = player.y + 15;

        const pipeLeft = pipe.x - pipe.width / 2;
        const pipeRight = pipe.x + pipe.width / 2;

        // Check if player is horizontally aligned with pipe
        if (playerRight > pipeLeft && playerLeft < pipeRight) {
            // Check collision with top or bottom pipe
            if (playerTop < pipe.topHeight || playerBottom > pipe.bottomY) {
                return true;
            }
        }

        return false;
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
        return;
    }

    if (!player.alive) {
        console.log(`⚠️ Player ${player.playerId} already dead, skipping kill`);
        return;
    }

    console.log(`💀 Killing player ${player.playerId}, reason: ${reason}, lives before: ${player.lives}`);

    // Set player as dead
    player.alive = false;
    player.velocityY = 0;
    player.invulnerable = false;
    player.canCollideWithPlayers = false;
    player.deathTime = Date.now();

    // Decrease lives
    player.lives = Math.max(0, player.lives - 1);

    console.log(`💀 Player ${player.playerId} died, lives left: ${player.lives}`);

    // Broadcast death
    this.broadcast({
        type: 'playerDied',
        playerId: player.playerId,
        reason: reason,
        livesLeft: player.lives,
        position: { x: player.x, y: player.y }
    });

    // Broadcast messages
    this.broadcast({
        type: 'gameMessage',
        message: `💀 ${player.playerId.slice(-4)} đã chết! Còn ${player.lives} mạng`
    });

    if (player.lives <= 0) {
        this.broadcast({
            type: 'gameMessage', 
            message: `💀 ${player.playerId.slice(-4)} đã bị loại khỏi game!`
        });
    }

    // ❌ QUAN TRỌNG: KHÔNG gọi checkGameEnd() hoặc dừng game ở đây!
    this.updateLeaderboard();
}
    executeRespawn(player) {
        console.log(`🔄 Executing respawn for ${player.playerId}`);

        // Calculate spawn position
        const spawnPositions = this.calculatePlayerSpawnPositions();
        const playerIndex = this.playerStates.findIndex(p => p.playerId === player.playerId);
        const spawnPos = spawnPositions[playerIndex] || { x: 50, y: this.config.height / 2 };

        // Reset player state
        player.x = spawnPos.x;
        player.y = spawnPos.y;
        player.velocityY = 0;
        player.alive = true;
        player.phase = 'outbound';
        player.invulnerable = true;
        player.invulnerableTime = 1.0;
        player.canCollideWithPlayers = false;

        // Clear respawn timer
        if (player.respawnTimer) {
            clearTimeout(player.respawnTimer);
            player.respawnTimer = null;
        }

        console.log(`✅ Player ${player.playerId} respawned at (${player.x}, ${player.y})`);

        // Broadcast respawn
        this.broadcast({
            type: 'playerRespawned',
            playerId: player.playerId,
            position: { x: player.x, y: player.y },
            livesLeft: player.lives
        });
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

}

    calculatePlayerSpawnPositions() {
        const totalPlayers = this.playerStates.length;
        const startY = this.config.height / 2; // Điểm giữa màn hình
        const spacing = 60; // Khoảng cách giữa các con chim

        // Nếu chỉ có 1 người chơi, đặt ở giữa
        if (totalPlayers === 1) {
            return [{ x: 50, y: startY }];
        }

        // ===== CĂNG GIỮA TẤT CẢ CÁC CON CHIM =====
        const totalHeight = (totalPlayers - 1) * spacing;
        const firstBirdY = startY - (totalHeight / 2);

        return this.playerStates.map((_, index) => ({
            x: 50, // Vị trí X cố định tại xuất phát
            y: Math.max(50, Math.min(this.config.height - 50, firstBirdY + (index * spacing))) // Đảm bảo trong bounds
        }));
    }

checkGameEnd() {
    const alivePlayers = this.playerStates.filter(p => p.alive);
    const playersWithLives = this.playerStates.filter(p => p.lives > 0);
    const deadPlayersWithLives = this.playerStates.filter(p => !p.alive && p.lives > 0);

    console.log(`🔍 Game End Check:`, {
        total: this.playerStates.length,
        alive: alivePlayers.length,
        withLives: playersWithLives.length,
        deadWithLives: deadPlayersWithLives.length,
        currentPhase: this.gamePhase
    });

    // ❌ QUAN TRỌNG: CHỈ LOG, KHÔNG BAO GIỜ RETURN! Game phải tiếp tục!
    if (deadPlayersWithLives.length > 0) {
        console.log(`⏳ ${deadPlayersWithLives.length} players waiting to respawn - GAME CONTINUES!`);
        // ❌ XÓA: return; - Game PHẢI tiếp tục!
    }

    // Logic end game thật sự được xử lý trong checkRealGameEnd()
    // Hàm này chỉ để log và tương thích với code cũ
}




    
    triggerGameEnd(winnerId) {
        console.log('🏆 Triggering game end with winner:', winnerId);

        // ===== ĐÁNH DẤU GAME ĐÃ KẾT THÚC =====
        this.gamePhase = 'finished';
        this.status = 'finished';
        this.stopGameLoop();

        // Calculate final rankings
        this.calculateFinalRankings();

        // Clear all respawn timers
        this.playerStates.forEach(player => {
            if (player.respawnTimer) {
                clearTimeout(player.respawnTimer);
                player.respawnTimer = null;
                console.log(`🧹 Cleared respawn timer for ${player.playerId}`);
            }
        });

        // ===== BROADCAST GAME ENDED VỚI THÔNG TIN CHI TIẾT =====
        this.broadcast({
            type: 'gameEnded',
            winner: winnerId,
            rankings: this.leaderboard,
            message: winnerId ?
                `🏆 ${winnerId.slice(-4)} chiến thắng toàn game!` :
                '🏁 Game kết thúc - không có người chiến thắng!'
        });

        // ===== BROADCAST GAME STATE MỚI =====
        this.broadcastGameState();

        // ===== AUTO RESET GAME SAU 10 GIÂY =====
        setTimeout(() => {
            console.log('🔄 Auto resetting game after 10 seconds');
            this.resetGame();
        }, 10000);
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
        console.log('🏁 Ending game completely...');

        // ===== CLEAR TẤT CẢ RESPAWN TIMERS =====
        this.playerStates.forEach(player => {
            if (player.respawnTimer) {
                clearTimeout(player.respawnTimer);
                player.respawnTimer = null;
                console.log(`🧹 Cleared respawn timer for ${player.playerId}`);
            }
        });

        this.gamePhase = 'finished';
        this.status = 'finished';
        this.stopGameLoop();

        // Calculate final rankings
        this.calculateFinalRankings();

        // ===== TÌM WINNER DỰA TRÊN RANK =====
        const finishedPlayers = this.playerStates.filter(p => p.phase === 'finished');
        let gameWinner = null;

        if (finishedPlayers.length > 0) {
            // Winner is the player with rank = 1
            gameWinner = finishedPlayers.find(p => p.rank === 1);

            if (!gameWinner) {
                // Fallback: first to finish (lowest rank)
                gameWinner = finishedPlayers.reduce((best, current) =>
                    current.rank < best.rank ? current : best
                );
            }
        }

        console.log(`🎯 Final winner determined: ${gameWinner?.playerId || 'None'}`);

        // ===== BROADCAST FINAL RESULTS =====
        this.broadcast({
            type: 'gameEnded',
            winner: gameWinner ? gameWinner.playerId : null,
            rankings: this.leaderboard,
            message: gameWinner ?
                `🏆 ${gameWinner.playerId.slice(-4)} chiến thắng toàn game!` :
                '🏁 Game kết thúc - tất cả người chơi đã bị loại!'
        });

        this.broadcastGameState();

        // Auto reset sau 8 giây
        setTimeout(() => {
            console.log('🔄 Auto resetting after game end');
            this.resetGame();
        }, 8000);
    }
    handleGameAction(playerId, action, data) {
        const player = this.playerStates.find(p => p.playerId === playerId);
        if (!player) return { error: 'Player not found' };

        switch (action) {
            case 'flap':
                if (player.alive && this.gamePhase === 'playing') {
                    player.velocityY = this.config.flapStrength || -8;
                    console.log(`🐦 Player ${playerId} flapped`);
                }
                break;

            case 'useItem':
                if (player.alive && data.itemType && player.items.includes(data.itemType)) {
                    this.useItem(player, data.itemType, data.targetX, data.targetY);
                }
                break;

            default:
                return { error: 'Unknown action' };
        }

        return { success: true };
    }

    handleFlap(player) {
        if (this.gamePhase !== 'playing') return { error: 'Game not in playing state' };

        player.velocityY = this.config.flapStrength;
        player.score += 10; // Small score for flapping

        return { success: true };
    }

    useItem(player, itemType, targetX, targetY) {
        // Remove item from inventory
        const itemIndex = player.items.indexOf(itemType);
        if (itemIndex !== -1) {
            player.items.splice(itemIndex, 1);
        }

        switch (itemType) {
            case 'speed':
                player.effects.speed = { timeLeft: 3.0 };
                break;

            case 'shield':
                player.effects.shield = { timeLeft: 5.0 };
                break;

            case 'bomb':
                // Create explosion projectile
                this.projectiles.push({
                    x: targetX || player.x + 50,
                    y: targetY || player.y,
                    vx: 200,
                    vy: 0,
                    type: 'bomb',
                    playerId: player.playerId,
                    timeLeft: 2.0,
                    hit: false
                });
                break;

            case 'trap':
                // Create trap at target location
                this.items.push({
                    x: targetX || player.x + 100,
                    y: targetY || player.y,
                    type: 'trap_deployed',
                    collected: false,
                    playerId: player.playerId
                });
                break;
        }

        console.log(`🎮 Player ${player.playerId} used item: ${itemType}`);
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
        console.log('🔄 Resetting game...');

        // Reset ready status
        this.playersReady = {};
        this.status = 'setup';
        this.gamePhase = 'waiting';
        this.gameSettings = {};

        // Reset players position và stats
        this.playerStates.forEach((player, index) => {
            const totalPlayers = this.playerStates.length;
            const startY = this.config.height / 2;
            const spacing = 60;

            // Căn giữa tất cả các con chim
            const totalHeight = (totalPlayers - 1) * spacing;
            const firstBirdY = startY - (totalHeight / 2);

            player.x = 50;
            player.y = firstBirdY + (index * spacing);
            player.velocityY = 0;
            player.score = 0;
            player.lives = 3;
            player.phase = 'outbound';
            player.alive = true;
            player.effects = {};
            player.items = [];
            player.rank = 0; // ===== RESET RANK =====

            // Clear respawn timer
            if (player.respawnTimer) {
                clearTimeout(player.respawnTimer);
                player.respawnTimer = null;
            }
        });

        // Reset leaderboard
        this.leaderboard = [];

        this.stopGameLoop();
        this.broadcastGameState();

        console.log('✅ Game reset completed');
    }
    startNewRound() {
        console.log('🔄 Starting new round...');

        // Reset game phase
        this.gamePhase = 'countdown';
        this.gameTimer = 3; // 10 second countdown
        this.lastCountdown = 3;

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