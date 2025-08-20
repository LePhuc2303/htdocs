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
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD'];
        const color = colors[this.players.length - 1] || '#FFD700';
        
        playerInfo.color = color;
        
        // Initialize player state
        const playerState = {
            playerId: playerInfo.playerId,
            x: 50,
            y: this.config.height / 2,
            velocityY: 0,
            color: color,
            score: 0,
            lives: 3,
            phase: 'outbound', // outbound, return, finished
            alive: true,
            effects: {},
            items: [],
            rank: 0
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
        const itemTypes = ['speed', 'shield', 'bomb', 'trap'];
        
        for (let x = 300; x < this.config.raceDistance; x += 200) {
            if (Math.random() < 0.7) { // 70% chance to spawn item
                const itemType = itemTypes[Math.floor(Math.random() * itemTypes.length)];
                this.items.push({
                    id: `item_${Date.now()}_${Math.random()}`,
                    type: itemType,
                    x: x + Math.random() * 100 - 50,
                    y: 100 + Math.random() * 400,
                    collected: false
                });
            }
        }
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
                this.broadcast({
                    type: 'gameMessage',
                    message: `Bắt đầu sau ${seconds}...`
                });
            }
            
            if (this.gameTimer <= 0) {
                this.gamePhase = 'playing';
                this.gameTimer = 0;
                this.broadcast({
                    type: 'gameMessage',
                    message: '🚀 Game bắt đầu! Good luck!'
                });
            }
        }
        
        // Update game timer
        if (this.gamePhase === 'playing') {
            this.gameTimer += deltaTime;
        }
        
        // Update players
        this.updatePlayers(deltaTime);
        
        // Update projectiles
        this.updateProjectiles(deltaTime);
        
        // Update items
        this.updateItems();
        
        // Check game end conditions
        this.checkGameEnd();
        
        // Check for respawn (if all players are dead, allow restart)
        this.checkRespawnCondition();
        
        // Update leaderboard
        this.updateLeaderboard();
        
        // Broadcast state
        this.broadcastGameState();
    }

    updatePlayers(deltaTime) {
        this.playerStates.forEach(player => {
            if (!player.alive) return;
            
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
            
            // Bounds checking
            if (player.y < 0) {
                player.y = 0;
                player.velocityY = 0;
            }
            if (player.y > this.config.height) {
                this.killPlayer(player);
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
        // If game is in finished state (round ended), this is for respawn
        if (this.gamePhase === 'finished') {
            this.playersReady[playerId] = true;
            
            // Broadcast ready update
            this.broadcast({
                type: 'readyUpdate',
                playersReady: this.playersReady
            });
            
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