// GameServer/src/games/FlappyRaceGame.js - Flappy Race Server Implementation (VIẾT LẠI HOÀN TOÀN)

const BaseGame = require('../BaseGame');

class FlappyRaceGame extends BaseGame {
    constructor(gameId) {
        super(gameId, 'flappy-race', 8);
        
        console.log(`🎮 Creating FlappyRaceGame with ID: ${gameId}`);
        
        // Game configuration
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
        
        // Game objects
        this.pipes = [];
        this.items = [];
        this.projectiles = [];
        this.playerStates = [];
        this.traps = [];
        
        // Game state
        this.gamePhase = 'waiting'; // waiting, countdown, playing, finished
        this.gameTimer = 0;
        this.leaderboard = [];
        
        // Game settings
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
        
        // Initialize map
        this.generateMap();
        
        console.log(`✅ FlappyRaceGame created successfully - Pipes: ${this.pipes.length}, Items: ${this.items.length}`);
    }
    
    // === PLAYER MANAGEMENT ===
    onPlayerJoined(playerInfo) {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF', '#5F27CD'];
        const color = colors[this.players.length - 1] || '#FFD700';
        
        playerInfo.color = color;
        
        // Initialize player state
        const playerState = {
            playerId: playerInfo.playerId,
            x: 100,
            y: this.config.height / 2,
            velocityY: 0,
            color: color,
            score: 0,
            lives: 3,
            phase: 'outbound', // outbound, return, finished
            alive: true,
            effects: {},
            currentItem: null,
            rank: 0,
            invulnerable: false,
            invulnerabilityTime: 0
        };
        
        this.playerStates.push(playerState);
        
        console.log(`👤 Player ${playerInfo.playerId} joined with color ${color}`);
        
        this.broadcastGameState();
        
        return { 
            color: color, 
            playerIndex: this.players.length - 1 
        };
    }
    
    onPlayerLeft(playerId) {
        console.log(`👋 Player ${playerId} left the game`);
        
        // Remove player state
        this.playerStates = this.playerStates.filter(p => p.playerId !== playerId);
        
        // Reset game if no players left
        if (this.players.length === 0) {
            this.resetGame();
        }
        
        this.broadcastGameState();
    }
    
    // === GAME ACTIONS ===
    handleGameAction(playerId, action, data) {
        const player = this.playerStates.find(p => p.playerId === playerId);
        if (!player) {
            return { error: 'Player not found' };
        }
        
        console.log(`🎮 Game action: ${action} from player ${playerId}`);
        
        switch (action) {
            case 'flap':
                return this.handleFlap(player);
                
            case 'useItem':
                return this.handleUseItem(player, data);
                
            default:
                console.warn(`❓ Unknown action: ${action}`);
                return { error: 'Unknown action' };
        }
    }
    
    handleFlap(player) {
        if (this.gamePhase !== 'playing' || !player.alive) {
            return { error: 'Cannot flap at this time' };
        }
        
        // Check if stunned
        if (player.effects.stunned && player.effects.stunned.timeLeft > 0) {
            return { error: 'Player is stunned' };
        }
        
        // Apply flap
        player.velocityY = this.config.flapStrength;
        
        console.log(`🦅 Player ${player.playerId} flapped`);
        return { success: true };
    }
    
    handleUseItem(player, data) {
        if (this.gamePhase !== 'playing' || !player.alive || !player.currentItem) {
            return { error: 'Cannot use item at this time' };
        }
        
        const itemType = player.currentItem.type;
        console.log(`🎁 Player ${player.playerId} using item: ${itemType}`);
        
        let result = { success: false };
        
        switch (itemType) {
            case 'speed':
                result = this.handleSpeedBoost(player);
                break;
            case 'shield':
                result = this.handleShield(player);
                break;
            case 'bomb':
                result = this.handleBomb(player);
                break;
            case 'trap':
                result = this.handleTrap(player, data);
                break;
            default:
                result = { error: 'Unknown item type' };
        }
        
        // Remove item after use
        if (result.success) {
            player.currentItem = null;
        }
        
        return result;
    }
    
    handleSpeedBoost(player) {
        player.effects.speed = {
            timeLeft: 5000, // 5 seconds
            startTime: Date.now()
        };
        
        this.broadcast({
            type: 'speedBoostActivated',
            playerId: player.playerId,
            duration: 5000
        });
        
        console.log(`⚡ Speed boost activated for player ${player.playerId}`);
        return { success: true };
    }
    
    handleShield(player) {
        player.effects.shield = {
            timeLeft: 3000, // 3 seconds
            startTime: Date.now()
        };
        
        this.broadcast({
            type: 'shieldActivated',
            playerId: player.playerId,
            duration: 3000
        });
        
        console.log(`🛡️ Shield activated for player ${player.playerId}`);
        return { success: true };
    }
    
    handleBomb(player) {
        const bombRange = 150;
        const affectedPlayers = [];
        
        this.playerStates.forEach(otherPlayer => {
            if (otherPlayer.playerId === player.playerId || !otherPlayer.alive) return;
            
            const distance = Math.sqrt(
                Math.pow(otherPlayer.x - player.x, 2) + 
                Math.pow(otherPlayer.y - player.y, 2)
            );
            
            if (distance <= bombRange) {
                // Apply bomb effects
                otherPlayer.velocityY = -15; // Knock up
                otherPlayer.effects.stunned = {
                    timeLeft: 2000, // 2 seconds
                    startTime: Date.now()
                };
                
                affectedPlayers.push(otherPlayer.playerId);
            }
        });
        
        this.broadcast({
            type: 'bombExploded',
            bomberId: player.playerId,
            bomberX: player.x,
            bomberY: player.y,
            affectedPlayers: affectedPlayers,
            range: bombRange
        });
        
        console.log(`💣 Bomb from ${player.playerId} affected ${affectedPlayers.length} players`);
        return { success: true };
    }
    
    handleTrap(player, data) {
        const trapX = data?.targetX || (player.x + 100);
        const trapY = data?.targetY || player.y;
        
        const trap = {
            id: `trap_${Date.now()}_${player.playerId}`,
            x: trapX,
            y: trapY,
            ownerId: player.playerId,
            createdAt: Date.now(),
            duration: 10000, // 10 seconds
            triggered: false
        };
        
        this.traps.push(trap);
        
        this.broadcast({
            type: 'trapPlaced',
            trap: trap,
            placerId: player.playerId
        });
        
        console.log(`🪤 Trap placed by ${player.playerId} at (${trapX}, ${trapY})`);
        return { success: true };
    }
    
    // === READY SYSTEM ===
    handlePlayerReady(playerId, settings) {
        console.log(`✅ Player ${playerId} is ready in game ${this.gameId}`);
        
        // Update settings if provided
        if (settings && this.players.find(p => p.playerId === playerId && p.isHost)) {
            this.gameSettings = { ...this.gameSettings, ...settings };
            console.log('🎛️ Game settings updated:', this.gameSettings);
        }
        
        // If game is finished, this is for respawn
        if (this.gamePhase === 'finished') {
            this.playersReady[playerId] = true;
            
            console.log(`Players ready for respawn: ${Object.keys(this.playersReady).length}/${this.players.length}`);
            
            this.broadcast({
                type: 'readyUpdate',
                playersReady: this.playersReady
            });
            
            // Check if should start new round
            const readyCount = Object.keys(this.playersReady).length;
            const totalPlayers = this.players.length;
            
            if (totalPlayers === 1 || readyCount === totalPlayers) {
                console.log(`🚀 Starting new round - ${readyCount}/${totalPlayers} players ready`);
                setTimeout(() => {
                    this.respawnGame();
                }, 1000);
            }
            
            return { success: true };
        }
        
        // Normal ready for game start
        return super.handlePlayerReady(playerId, settings);
    }
    
    // === GAME LOOP ===
    startGameLoop() {
        if (this.gameLoop) {
            clearInterval(this.gameLoop);
        }
        
        console.log('🔄 Starting game loop...');
        
        this.gamePhase = 'countdown';
        this.gameTimer = 3; // 3 second countdown
        
        this.broadcast({
            type: 'gameStarting',
            countdown: this.gameTimer
        });
        
        this.lastUpdate = Date.now();
        
        this.gameLoop = setInterval(() => {
            this.update();
        }, 16); // ~60 FPS
    }
    
    update() {
        const now = Date.now();
        const deltaTime = (now - this.lastUpdate) / 1000; // Convert to seconds
        this.lastUpdate = now;
        
        switch (this.gamePhase) {
            case 'countdown':
                this.updateCountdown(deltaTime);
                break;
            case 'playing':
                this.updateGameplay(deltaTime);
                break;
            case 'finished':
                // Game finished, waiting for respawn
                break;
        }
        
        // Always broadcast state during active phases
        if (this.gamePhase === 'countdown' || this.gamePhase === 'playing') {
            this.broadcastGameState();
        }
    }
    
    updateCountdown(deltaTime) {
        this.gameTimer -= deltaTime;
        
        if (this.gameTimer <= 0) {
            console.log('🏁 Countdown finished, starting game!');
            this.gamePhase = 'playing';
            this.gameTimer = 0;
            
            // Make all players invulnerable for 2 seconds at start
            this.playerStates.forEach(player => {
                player.invulnerable = true;
                player.invulnerabilityTime = 2000;
            });
            
            this.broadcast({
                type: 'gameStarted',
                message: 'Good luck!'
            });
        }
    }
    
    updateGameplay(deltaTime) {
        this.gameTimer += deltaTime;
        
        // Update players
        this.updatePlayers(deltaTime);
        
        // Update projectiles
        this.updateProjectiles(deltaTime);
        
        // Update items
        this.updateItems(deltaTime);
        
        // Update traps
        this.updateTraps(deltaTime);
        
        // Check game end conditions
        this.checkGameEnd();
        
        // Update leaderboard
        this.updateLeaderboard();
    }
    
    updatePlayers(deltaTime) {
        this.playerStates.forEach(player => {
            if (!player.alive) return;
            
            // Update invulnerability
            if (player.invulnerable) {
                player.invulnerabilityTime -= deltaTime * 1000;
                if (player.invulnerabilityTime <= 0) {
                    player.invulnerable = false;
                    player.invulnerabilityTime = 0;
                }
            }
            
            // Apply gravity
            player.velocityY += this.config.gravity;
            
            // Apply velocity
            player.y += player.velocityY;
            
            // Update effects
            this.updatePlayerEffects(player, deltaTime);
            
            // Move player forward/backward based on phase
            let speed = 100; // Base speed
            if (player.effects.speed && player.effects.speed.timeLeft > 0) {
                speed *= 1.5;
            }
            
            if (player.phase === 'return') {
                player.x -= speed * deltaTime;
            } else if (player.phase === 'outbound') {
                player.x += speed * deltaTime;
            }
            
            // Check phase transitions
            this.checkPhaseTransition(player);
            
            // Check collisions
            this.checkCollisions(player);
            this.checkItemCollision(player);
            this.checkTrapCollisions(player);
        });
    }
    
    updatePlayerEffects(player, deltaTime) {
        Object.keys(player.effects).forEach(effectType => {
            const effect = player.effects[effectType];
            if (effect && effect.timeLeft > 0) {
                effect.timeLeft -= deltaTime * 1000;
                
                if (effect.timeLeft <= 0) {
                    delete player.effects[effectType];
                    console.log(`✨ Effect ${effectType} expired for player ${player.playerId}`);
                }
            }
        });
    }
    
    checkPhaseTransition(player) {
        // Check if reached the end (outbound -> return)
        if (player.phase === 'outbound' && player.x >= this.config.raceDistance) {
            player.phase = 'return';
            player.x = this.config.raceDistance;
            console.log(`🔄 Player ${player.playerId} reached the end, now returning`);
        }
        
        // Check if returned to start (return -> finished)
        if (player.phase === 'return' && player.x <= 0) {
            player.phase = 'finished';
            player.x = 0;
            player.alive = false; // Stop updating
            
            // Assign rank
            const finishedPlayers = this.playerStates.filter(p => p.phase === 'finished').length;
            player.rank = finishedPlayers;
            
            console.log(`🏆 Player ${player.playerId} finished with rank ${player.rank}`);
        }
    }
    
    checkCollisions(player) {
        if (!player.alive || player.invulnerable) return;
        
        // Check pipe collisions
        this.pipes.forEach(pipe => {
            if (this.isPlayerCollidingWithPipe(player, pipe)) {
                this.handlePlayerDeath(player, 'pipe');
            }
        });
        
        // Check boundary collisions
        if (player.y <= 0 || player.y >= this.config.height) {
            this.handlePlayerDeath(player, 'boundary');
        }
    }
    
    isPlayerCollidingWithPipe(player, pipe) {
        const playerLeft = player.x - 15;
        const playerRight = player.x + 15;
        const playerTop = player.y - 15;
        const playerBottom = player.y + 15;
        
        const pipeLeft = pipe.x;
        const pipeRight = pipe.x + this.config.pipeWidth;
        
        // Check if player is horizontally within pipe
        if (playerRight > pipeLeft && playerLeft < pipeRight) {
            // Check if player hits top or bottom pipe
            if (playerTop < pipe.topHeight || playerBottom > pipe.bottomY) {
                return true;
            }
        }
        
        return false;
    }
    
    handlePlayerDeath(player, cause) {
        if (player.effects.shield && player.effects.shield.timeLeft > 0) {
            // Shield absorbs the hit
            delete player.effects.shield;
            console.log(`🛡️ Shield saved player ${player.playerId} from ${cause}`);
            
            this.broadcast({
                type: 'shieldDeflected',
                playerId: player.playerId,
                cause: cause
            });
            return;
        }
        
        player.lives--;
        console.log(`💀 Player ${player.playerId} died from ${cause}. Lives: ${player.lives}`);
        
        if (player.lives <= 0) {
            player.alive = false;
            player.phase = 'gameOver';
            
            this.broadcast({
                type: 'playerDied',
                playerId: player.playerId,
                cause: cause,
                finalScore: player.score
            });
        } else {
            // Respawn with invulnerability
            player.y = this.config.height / 2;
            player.velocityY = 0;
            player.invulnerable = true;
            player.invulnerabilityTime = 2000;
            
            this.broadcast({
                type: 'playerRespawned',
                playerId: player.playerId,
                livesLeft: player.lives
            });
        }
    }
    
    checkItemCollision(player) {
        if (!player.alive) return;
        
        this.items.forEach(item => {
            if (item.collected) return;
            
            const distance = Math.sqrt(
                Math.pow(player.x - item.x, 2) + 
                Math.pow(player.y - item.y, 2)
            );
            
            if (distance < 25) { // Collision threshold
                item.collected = true;
                
                // Replace current item
                player.currentItem = {
                    type: item.type,
                    collectedAt: Date.now()
                };
                
                console.log(`🎁 Player ${player.playerId} collected ${item.type}`);
                
                this.broadcast({
                    type: 'itemCollected',
                    playerId: player.playerId,
                    itemType: item.type,
                    itemId: item.id
                });
            }
        });
    }
    
    checkTrapCollisions(player) {
        if (!player.alive || player.invulnerable) return;
        
        this.traps.forEach(trap => {
            if (trap.triggered || trap.ownerId === player.playerId) return;
            
            const distance = Math.sqrt(
                Math.pow(player.x - trap.x, 2) + 
                Math.pow(player.y - trap.y, 2)
            );
            
            if (distance < 30) { // Trap trigger range
                trap.triggered = true;
                
                // Apply trap effect
                player.effects.stunned = {
                    timeLeft: 3000, // 3 seconds
                    startTime: Date.now()
                };
                
                // Knock player up
                player.velocityY = -10;
                
                console.log(`🪤 Player ${player.playerId} triggered trap from ${trap.ownerId}`);
                
                this.broadcast({
                    type: 'trapTriggered',
                    trapId: trap.id,
                    victimId: player.playerId,
                    ownerId: trap.ownerId
                });
            }
        });
    }
    
    updateProjectiles(deltaTime) {
        this.projectiles = this.projectiles.filter(projectile => {
            projectile.x += projectile.velocityX * deltaTime;
            projectile.y += projectile.velocityY * deltaTime;
            
            // Remove if out of bounds
            return projectile.x >= 0 && projectile.x <= this.config.raceDistance + 200 &&
                   projectile.y >= 0 && projectile.y <= this.config.height;
        });
    }
    
    updateItems(deltaTime) {
        // Remove collected items and old items
        this.items = this.items.filter(item => {
            if (item.collected) return false;
            
            const age = Date.now() - (item.createdAt || 0);
            return age < 30000; // Remove after 30 seconds
        });
    }
    
    updateTraps(deltaTime) {
        const now = Date.now();
        
        // Remove expired traps
        this.traps = this.traps.filter(trap => {
            const age = now - trap.createdAt;
            return age < trap.duration;
        });
    }
    
    checkGameEnd() {
        const alivePlayers = this.playerStates.filter(p => p.alive);
        const finishedPlayers = this.playerStates.filter(p => p.phase === 'finished');
        
        // Game ends when all players are either dead or finished
        if (alivePlayers.length === 0 || finishedPlayers.length === this.players.length) {
            this.endGame();
        }
    }
    
    endGame() {
        console.log('🏁 Game ended!');
        
        this.gamePhase = 'finished';
        
        if (this.gameLoop) {
            clearInterval(this.gameLoop);
            this.gameLoop = null;
        }
        
        // Calculate final rankings
        this.calculateFinalRankings();
        
        this.broadcast({
            type: 'gameEnded',
            finalRankings: this.leaderboard,
            gameTime: Math.floor(this.gameTimer)
        });
    }
    
    calculateFinalRankings() {
        // Sort players by: 1) Finished first, 2) Progress, 3) Score
        this.leaderboard = this.playerStates
            .slice()
            .sort((a, b) => {
                // Finished players rank higher
                if (a.phase === 'finished' && b.phase !== 'finished') return -1;
                if (b.phase === 'finished' && a.phase !== 'finished') return 1;
                
                // If both finished, sort by rank
                if (a.phase === 'finished' && b.phase === 'finished') {
                    return a.rank - b.rank;
                }
                
                // For non-finished players, sort by progress
                const aProgress = a.phase === 'return' ? 
                    this.config.raceDistance + (this.config.raceDistance - a.x) : a.x;
                const bProgress = b.phase === 'return' ? 
                    this.config.raceDistance + (this.config.raceDistance - b.x) : b.x;
                
                return bProgress - aProgress;
            })
            .map((p, index) => ({
                playerId: p.playerId,
                score: p.score,
                rank: index + 1,
                phase: p.phase,
                finalPosition: p.x
            }));
    }
    
    updateLeaderboard() {
        // Real-time leaderboard during game
        this.leaderboard = this.playerStates
            .filter(p => p.alive)
            .slice()
            .sort((a, b) => {
                const aProgress = a.phase === 'return' ? 
                    this.config.raceDistance + (this.config.raceDistance - a.x) : a.x;
                const bProgress = b.phase === 'return' ? 
                    this.config.raceDistance + (this.config.raceDistance - b.x) : b.x;
                
                return bProgress - aProgress;
            })
            .map((p, index) => ({
                playerId: p.playerId,
                score: p.score,
                rank: index + 1
            }));
    }
    
    // === RESPAWN SYSTEM ===
    respawnGame() {
        console.log('🔄 Respawning game...');
        
        // Reset game state
        this.gamePhase = 'waiting';
        this.gameTimer = 0;
        this.playersReady = {};
        
        // Reset all players
        this.playerStates.forEach(player => {
            player.x = 100;
            player.y = this.config.height / 2;
            player.velocityY = 0;
            player.score = 0;
            player.lives = 3;
            player.phase = 'outbound';
            player.alive = true;
            player.effects = {};
            player.currentItem = null;
            player.rank = 0;
            player.invulnerable = false;
            player.invulnerabilityTime = 0;
        });
        
        // Reset game objects
        this.projectiles = [];
        this.traps = [];
        
        // Reset items (mark as not collected)
        this.items.forEach(item => {
            item.collected = false;
        });
        
        // Generate new map if needed
        this.generateMap();
        
        this.broadcast({
            type: 'gameRespawned',
            message: 'New round starting!'
        });
        
        // Auto-start if players are ready
        setTimeout(() => {
            if (this.players.length > 0) {
                this.startGameLoop();
            }
        }, 2000);
    }
    
    // === MAP GENERATION ===
    generateMap() {
        console.log('🗺️ Generating map...');
        
        this.pipes = [];
        this.items = [];
        
        const pipeSpacing = 300;
        const numPipes = Math.floor(this.config.raceDistance / pipeSpacing);
        
        for (let i = 0; i < numPipes; i++) {
            const x = (i + 1) * pipeSpacing;
            const gapY = 150 + Math.random() * (this.config.height - 300);
            
            const pipe = {
                x: x,
                topHeight: gapY - this.config.pipeGap / 2,
                bottomY: gapY + this.config.pipeGap / 2,
                bottomHeight: this.config.height - (gapY + this.config.pipeGap / 2)
            };
            
            this.pipes.push(pipe);
            
            // Add items near pipes
            if (Math.random() < 0.3) { // 30% chance
                const itemTypes = ['speed', 'shield', 'bomb', 'trap'];
                const itemType = itemTypes[Math.floor(Math.random() * itemTypes.length)];
                
                const item = {
                    id: `item_${i}_${Date.now()}`,
                    type: itemType,
                    x: x + 80,
                    y: gapY + (Math.random() - 0.5) * 50,
                    collected: false,
                    createdAt: Date.now()
                };
                
                this.items.push(item);
            }
        }
        
        console.log(`✅ Map generated: ${this.pipes.length} pipes, ${this.items.length} items`);
    }
    
    // === GAME STATE BROADCAST ===
    broadcastGameState() {
        const payload = {
            ...this.getGameState(),
            config: this.config,
            pipes: this.pipes,
            items: this.items,
            projectiles: this.projectiles,
            playerStates: this.playerStates,
            traps: this.traps,
            gamePhase: this.gamePhase,
            gameTimer: Math.floor(this.gameTimer * 100) / 100, // Round to 2 decimals
            leaderboard: this.leaderboard,
            settings: this.gameSettings
        };
        
        this.broadcast(payload);
    }
    
    // === RESET ===
    resetGame() {
        console.log('🔄 Resetting game...');
        
        super.resetGame();
        
        // Stop game loop
        if (this.gameLoop) {
            clearInterval(this.gameLoop);
            this.gameLoop = null;
        }
        
        // Reset game state
        this.gamePhase = 'waiting';
        this.gameTimer = 0;
        this.playerStates = [];
        this.projectiles = [];
        this.traps = [];
        this.leaderboard = [];
        
        // Regenerate map
        this.generateMap();
        
        this.broadcastGameState();
    }
    
    // === SETTINGS BROADCAST ===
    broadcastSettings(settings) {
        this.gameSettings = { ...this.gameSettings, ...settings };
        
        this.broadcast({
            type: 'settingsUpdate',
            settings: this.gameSettings
        });
        
        console.log('⚙️ Settings updated and broadcast:', this.gameSettings);
    }
    
    // === CLEANUP ===
    onGameDestroyed() {
        console.log('🗑️ Cleaning up FlappyRaceGame...');
        
        if (this.gameLoop) {
            clearInterval(this.gameLoop);
            this.gameLoop = null;
        }
        
        super.onGameDestroyed();
    }
}

module.exports = FlappyRaceGame;