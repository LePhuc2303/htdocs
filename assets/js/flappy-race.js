// assets/js/flappy-race.js - Flappy Race Client (VIẾT LẠI HOÀN TOÀN)

class FlappyRaceClient {
    constructor() {
        console.log('🎮 Initializing Flappy Race Client...');
        
        // Core properties
        this.ws = null;
        this.gameId = null;
        this.playerId = null;
        this.playerColor = null;
        this.gameState = null;
        
        // Canvas properties
        this.canvas = null;
        this.ctx = null;
        this.camera = { x: 0, y: 0 };
        this.scale = 1;
        
        // Input handling
        this.keys = {};
        this.keyDownHandler = null;
        this.keyUpHandler = null;
        
        // Game config
        this.config = {
            width: 1200,
            height: 600,
            raceDistance: 2000
        };
        
        // Game settings
        this.gameSettings = {
            mode: 'classic',
            maxPlayers: 4,
            difficulty: 'normal',
            mapType: 'classic',
            itemsEnabled: true
        };
        
        // Rendering
        this.renderingStarted = false;
        this.particles = [];
        this.animations = [];
        
        this.init();
    }
    
    init() {
        console.log('🔧 Initializing game components...');
        this.setupCanvas();
        this.connectWebSocket();
        this.setupEventListeners();
        this.setupGameModeSelection();
        this.startRenderLoop();
    }
    
    // === CANVAS SETUP ===
    setupCanvas() {
        this.canvas = document.getElementById('flappyCanvas');
        if (!this.canvas) {
            console.error('❌ Canvas element not found');
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        
        window.addEventListener('resize', () => this.resizeCanvas());
        console.log('✅ Canvas setup complete');
    }
    
    resizeCanvas() {
        if (!this.canvas || !this.ctx) return;
        
        // Check if in fullscreen mode
        if (document.body.classList.contains('game-playing')) {
            this.resizeCanvasFullscreen();
            return;
        }
        
        // Normal mode - responsive canvas
        const container = this.canvas.parentElement;
        if (!container) return;
        
        const containerWidth = container.clientWidth - 40;
        const aspectRatio = this.config.width / this.config.height;
        
        this.canvas.width = Math.min(containerWidth, 1200);
        this.canvas.height = this.canvas.width / aspectRatio;
        
        if (this.canvas.height < 250) {
            this.canvas.height = 250;
            this.canvas.width = 250 * aspectRatio;
        }
        
        this.scale = this.canvas.width / this.config.width;
        
        if (this.gameState) {
            this.render();
        }
    }
    
    resizeCanvasFullscreen() {
        if (!this.canvas) return;
        
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        
        this.config.width = width;
        this.config.height = height;
        
        console.log(`📐 Canvas resized to fullscreen: ${width}x${height}`);
    }
    
    // === WEBSOCKET CONNECTION ===
    connectWebSocket() {
        console.log('🔌 Connecting to WebSocket server...');
        
        if (this.ws) {
            this.ws.close();
        }
        
        this.ws = new WebSocket('ws://localhost:8080');
        
        this.ws.onopen = () => {
            console.log('✅ WebSocket connected successfully');
            this.updateConnectionStatus('connected', '🟢 Đã kết nối');
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (e) {
                console.error('❌ Error parsing message:', e);
            }
        };
        
        this.ws.onclose = (event) => {
            console.log('❌ WebSocket disconnected. Code:', event.code);
            this.updateConnectionStatus('disconnected', '🔴 Mất kết nối');
            
            setTimeout(() => {
                console.log('🔄 Attempting to reconnect...');
                this.connectWebSocket();
            }, 3000);
        };
        
        this.ws.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
            this.updateConnectionStatus('error', '⚠️ Lỗi kết nối');
        };
    }
    
    // === MESSAGE HANDLING ===
    handleMessage(data) {
        switch (data.type) {
            case 'playerInfo':
                this.playerId = data.playerId;
                console.log('🆔 Player ID assigned:', this.playerId);
                break;
                
            case 'gameCreated':
                this.gameId = data.gameId;
                this.playerColor = data.playerInfo?.color;
                document.getElementById('currentGameId').textContent = this.gameId;
                document.getElementById('setupGameId').textContent = this.gameId;
                this.showGameSetupSection();
                this.showSuccess('✅ Tạo phòng thành công!');
                break;
                
            case 'gameJoined':
                this.gameId = data.gameId;
                this.playerColor = data.playerInfo?.color;
                document.getElementById('currentGameId').textContent = this.gameId;
                document.getElementById('setupGameId').textContent = this.gameId;
                this.showGameSetupSection();
                this.showSuccess('✅ Vào phòng thành công!');
                break;
                
            case 'gameState':
                this.gameState = data;
                this.updateUI();
                break;
                
            case 'readyUpdate':
                this.updateReadyStatus(data.playersReady);
                break;
                
            case 'error':
                this.showError(data.message);
                break;
                
            default:
                console.log('📨 Unhandled message type:', data.type);
        }
    }
    
    // === UI MANAGEMENT ===
    updateUI() {
        if (!this.gameState) return;
        
        this.updateGameInfo();
        this.updateLeaderboard();
        this.updatePlayerInventory();
        this.updatePlayerStatus();
        
        console.log('📱 UpdateUI - Status:', this.gameState.status, 'GamePhase:', this.gameState.gamePhase);
        
        switch (this.gameState.status) {
            case 'setup':
                this.showGameSetupSection();
                break;
            case 'playing':
                // ===== KEY FIX: FORCE FULLSCREEN CHO TẤT CẢ PHASES =====
                if (this.gameState.gamePhase === 'countdown' || 
                    this.gameState.gamePhase === 'playing') {
                    this.showGamePlaying();
                }
                break;
            case 'finished':
                this.showGameResult();
                break;
        }
    }
    
    // === FULLSCREEN METHODS (KEY FIX) ===
    showGamePlaying() {
        console.log('🎮 [FIXED] Showing game playing mode - GamePhase:', this.gameState?.gamePhase);
        
        const gameSetup = document.getElementById('gameSetup');
        const gameSection = document.getElementById('gameSection');
        
        if (gameSetup) gameSetup.classList.add('hidden');
        if (gameSection) gameSection.classList.remove('hidden');
        
        // Force enter fullscreen with multiple attempts
        setTimeout(() => {
            console.log('🖥️ Entering fullscreen mode...');
            this.enterFullscreenMode();
            this.resizeCanvas();
        }, 100);
        
        // Backup attempt
        setTimeout(() => {
            if (!document.body.classList.contains('game-playing')) {
                console.log('🔧 Backup fullscreen attempt...');
                this.enterFullscreenMode();
            }
        }, 500);
    }
    
    enterFullscreenMode() {
        console.log('🖥️ [FIXED] Entering fullscreen mode');
        
        // Add fullscreen class to body
        document.body.classList.add('game-playing');
        
        // Add fullscreen class to page
        const flappyPage = document.querySelector('.flappy-race-page');
        if (flappyPage) {
            flappyPage.classList.add('game-playing');
        }
        
        // Hide header/navbar
        const header = document.querySelector('nav, .navbar');
        if (header) {
            header.style.display = 'none';
        }
        
        // Hide other UI elements
        const elementsToHide = [
            '#mainMenu', '#gameSetup', '.game-header', 
            '.game-hud', '.game-controls-bottom'
        ];
        
        elementsToHide.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                element.style.display = 'none';
            }
        });
        
        // Add exit fullscreen button
        this.addExitFullscreenButton();
        
        // Prevent scrolling
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        
        // Force canvas visibility and fullscreen styles
        if (this.canvas) {
            this.canvas.style.display = 'block';
            this.canvas.style.visibility = 'visible';
            this.canvas.style.position = 'fixed';
            this.canvas.style.top = '0';
            this.canvas.style.left = '0';
            this.canvas.style.zIndex = '9999';
        }
        
        // Force game section to fullscreen
        const gameSection = document.getElementById('gameSection');
        if (gameSection) {
            gameSection.style.position = 'fixed';
            gameSection.style.top = '0';
            gameSection.style.left = '0';
            gameSection.style.width = '100vw';
            gameSection.style.height = '100vh';
            gameSection.style.zIndex = '9998';
            gameSection.style.display = 'block';
        }
        
        // Resize canvas for fullscreen
        setTimeout(() => {
            this.resizeCanvasFullscreen();
        }, 100);
        
        console.log('✅ Fullscreen mode activated');
    }
    
    exitFullscreenMode() {
        console.log('🚪 Exiting fullscreen mode');
        
        // Remove fullscreen class
        document.body.classList.remove('game-playing');
        
        const flappyPage = document.querySelector('.flappy-race-page');
        if (flappyPage) {
            flappyPage.classList.remove('game-playing');
        }
        
        // Show navbar/header again
        const navbar = document.querySelector('.navbar, nav');
        if (navbar) {
            navbar.style.display = '';
        }
        
        // Show UI elements
        const elementsToShow = [
            '.game-hud', '.game-controls-bottom'
        ];
        
        elementsToShow.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                element.style.display = '';
            }
        });
        
        // Remove exit button
        const exitBtn = document.querySelector('.exit-fullscreen-btn');
        if (exitBtn) {
            exitBtn.remove();
        }
        
        // Restore scrolling
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
        
        // Reset canvas styles
        if (this.canvas) {
            this.canvas.style.position = '';
            this.canvas.style.top = '';
            this.canvas.style.left = '';
            this.canvas.style.zIndex = '';
        }
        
        // Reset game section styles
        const gameSection = document.getElementById('gameSection');
        if (gameSection) {
            gameSection.style.position = '';
            gameSection.style.top = '';
            gameSection.style.left = '';
            gameSection.style.width = '';
            gameSection.style.height = '';
            gameSection.style.zIndex = '';
        }
        
        // Resize canvas back to normal
        this.resizeCanvas();
    }
    
    addExitFullscreenButton() {
        // Remove existing button
        const existingBtn = document.querySelector('.exit-fullscreen-btn');
        if (existingBtn) {
            existingBtn.remove();
        }
        
        // Create exit button
        const exitBtn = document.createElement('button');
        exitBtn.className = 'exit-fullscreen-btn';
        exitBtn.innerHTML = '✖️ ESC - Thoát';
        exitBtn.style.cssText = `
            position: fixed !important;
            top: 20px !important;
            right: 20px !important;
            z-index: 10001 !important;
            background: rgba(220, 53, 69, 0.95) !important;
            color: white !important;
            border: 2px solid rgba(255, 255, 255, 0.3) !important;
            padding: 12px 20px !important;
            border-radius: 30px !important;
            cursor: pointer !important;
            font-weight: bold !important;
            backdrop-filter: blur(10px) !important;
            box-shadow: 0 4px 15px rgba(220, 53, 69, 0.4) !important;
            transition: all 0.3s ease !important;
            font-size: 14px !important;
            user-select: none !important;
        `;
        
        exitBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.exitFullscreenMode();
        };
        
        document.body.appendChild(exitBtn);
        
        // Hover effect
        exitBtn.addEventListener('mouseenter', () => {
            exitBtn.style.background = 'rgba(220, 53, 69, 1) !important';
            exitBtn.style.transform = 'scale(1.05) !important';
        });
        
        exitBtn.addEventListener('mouseleave', () => {
            exitBtn.style.background = 'rgba(220, 53, 69, 0.95) !important';
            exitBtn.style.transform = 'scale(1) !important';
        });
    }
    
    showMainMenu() {
        const mainMenu = document.getElementById('mainMenu');
        const gameSection = document.getElementById('gameSection');
        
        if (mainMenu) mainMenu.style.display = 'block';
        if (gameSection) gameSection.style.display = 'none';
        
        this.gameId = null;
        this.playerId = null;
        this.playerColor = null;
    }
    
    showGameSetupSection() {
        const mainMenu = document.getElementById('mainMenu');
        const gameSetup = document.getElementById('gameSetup');
        const gameSection = document.getElementById('gameSection');
        
        if (mainMenu) mainMenu.classList.add('hidden');
        if (gameSetup) gameSetup.classList.remove('hidden');
        if (gameSection) gameSection.classList.add('hidden');
        
        if (this.gameId) {
            const setupGameId = document.getElementById('setupGameId');
            const currentGameId = document.getElementById('currentGameId');
            
            if (setupGameId) setupGameId.textContent = this.gameId;
            if (currentGameId) currentGameId.textContent = this.gameId;
        }
    }
    
    showGameResult() {
        if (this.gameState.status === 'finished') {
            this.exitFullscreenMode();
            this.showSuccess('🏁 Game kết thúc!');
        } else {
            this.showSuccess('🏆 Round kết thúc! Nhấn ESC để về lobby hoặc chờ respawn...');
        }
    }
    
    // === GAME ACTIONS ===
    createGame() {
        const selectedMode = document.querySelector('.game-mode-card.selected');
        if (!selectedMode) {
            this.showError('Vui lòng chọn chế độ game!');
            return;
        }
        
        const mode = selectedMode.dataset.mode;
        const maxPlayers = parseInt(document.getElementById('maxPlayersSelect')?.value) || 4;
        const difficulty = document.getElementById('difficultySelect')?.value || 'normal';
        const mapType = document.getElementById('mapTypeSelect')?.value || 'classic';
        const itemsEnabled = document.getElementById('itemsEnabledCheck')?.checked !== false;
        
        this.gameSettings = {
            mode,
            maxPlayers,
            difficulty,
            mapType,
            itemsEnabled
        };
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'createGame',
                gameType: 'flappy-race',
                settings: this.gameSettings
            }));
        } else {
            this.showError('Chưa kết nối được server!');
        }
    }
    
    joinGame() {
        const gameIdInput = document.getElementById('gameIdInput');
        if (!gameIdInput) {
            this.showError('Không tìm thấy input field');
            return;
        }
        
        const gameId = gameIdInput.value.trim();
        if (!gameId) {
            this.showError('Vui lòng nhập mã phòng!');
            gameIdInput.focus();
            return;
        }
        
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'joinGame',
                gameId: gameId,
                gameType: 'flappy-race'
            }));
        } else {
            this.showError('Chưa kết nối được server!');
        }
    }
    
    playerReady() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'ready',
                gameId: this.gameId,
                settings: this.gameSettings
            }));
            
            const readyBtn = document.getElementById('readyBtn');
            if (readyBtn) {
                readyBtn.disabled = true;
                readyBtn.textContent = '⏳ Đang chờ...';
                readyBtn.className = 'btn btn-secondary btn-lg px-5';
            }
        }
    }
    
    leaveGame() {
        if (this.gameId && confirm('🚪 Bạn có chắc chắn muốn rời phòng không?')) {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'leaveGame',
                    gameId: this.gameId
                }));
                
                this.exitFullscreenMode();
                this.gameId = null;
                this.playerColor = null;
                this.gameState = null;
                this.showMainMenu();
                this.showSuccess('Đã rời phòng thành công!');
            }
        }
    }
    
    // === INPUT HANDLING ===
    setupEventListeners() {
        // Clean up existing listeners
        if (this.keyDownHandler) {
            document.removeEventListener('keydown', this.keyDownHandler);
        }
        if (this.keyUpHandler) {
            document.removeEventListener('keyup', this.keyUpHandler);
        }
        
        this.keyDownHandler = (e) => {
            this.keys[e.code] = true;
            
            // Flap controls
            if (e.code === 'Space' || e.code === 'ArrowUp') {
                e.preventDefault();
                if (this.gameState?.gamePhase === 'playing' && this.gameState?.status === 'playing') {
                    this.flap();
                }
            }
            
            // Use item
            if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
                e.preventDefault();
                if (this.gameState?.gamePhase === 'playing' && this.gameState?.status === 'playing') {
                    this.useCurrentItem();
                }
            }
            
            // Exit fullscreen
            if (e.code === 'Escape') {
                e.preventDefault();
                if (document.body.classList.contains('game-playing')) {
                    this.exitFullscreenMode();
                }
            }
            
            // Toggle fullscreen
            if (e.code === 'F11' || (e.code === 'KeyF' && e.ctrlKey)) {
                e.preventDefault();
                if (document.body.classList.contains('game-playing')) {
                    this.exitFullscreenMode();
                } else if (this.gameState?.status === 'playing') {
                    this.enterFullscreenMode();
                }
            }
        };
        
        this.keyUpHandler = (e) => {
            this.keys[e.code] = false;
        };
        
        document.addEventListener('keydown', this.keyDownHandler);
        document.addEventListener('keyup', this.keyUpHandler);
        
        // Touch controls
        if (this.canvas) {
            this.canvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (this.gameState?.gamePhase === 'playing' && this.gameState?.status === 'playing') {
                    this.flap();
                }
            }, { passive: false });
            
            this.canvas.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.gameState?.gamePhase === 'playing' && this.gameState?.status === 'playing') {
                    this.flap();
                }
            });
        }
        
        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });
    }
    
    flap() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'gameAction',
                gameId: this.gameId,
                action: 'flap'
            }));
        }
    }
    
    useCurrentItem() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'gameAction',
                gameId: this.gameId,
                action: 'useItem'
            }));
        }
    }
    
    // === GAME MODE SELECTION ===
    setupGameModeSelection() {
        document.querySelectorAll('.game-mode-card').forEach(card => {
            card.addEventListener('click', () => {
                document.querySelectorAll('.game-mode-card').forEach(c => {
                    c.classList.remove('selected');
                });
                card.classList.add('selected');
                
                const mode = card.dataset.mode;
                this.updateMaxPlayersOptions(mode);
            });
        });
        
        // Set default selection
        const defaultCard = document.querySelector('.game-mode-card[data-mode="classic"]');
        if (defaultCard) {
            defaultCard.click();
        }
    }
    
    updateMaxPlayersOptions(mode) {
        const maxPlayersSelect = document.getElementById('maxPlayersSelect');
        if (!maxPlayersSelect) return;
        
        maxPlayersSelect.innerHTML = '';
        
        let options = [];
        switch (mode) {
            case 'classic':
                options = [2, 4, 6, 8];
                break;
            case 'battle':
                options = [4, 6, 8];
                break;
            case 'time':
                options = [1, 2, 4, 6, 8];
                break;
            case 'endless':
                options = [1, 2, 3, 4];
                break;
            default:
                options = [2, 4, 6, 8];
        }
        
        options.forEach(num => {
            const option = document.createElement('option');
            option.value = num;
            option.textContent = `${num} người`;
            if (num === 4) option.selected = true;
            maxPlayersSelect.appendChild(option);
        });
    }
    
    // === RENDERING ===
    startRenderLoop() {
        if (this.renderingStarted) return;
        this.renderingStarted = true;
        
        const render = () => {
            this.update();
            this.render();
            requestAnimationFrame(render);
        };
        render();
    }
    
    update() {
        if (!this.gameState) return;
        
        // Update camera to follow player
        const myPlayer = this.getMyPlayer();
        if (myPlayer) {
            this.camera.x = myPlayer.x - this.config.width / 2;
            this.camera.x = Math.max(0, Math.min(this.camera.x, this.config.raceDistance));
        }
        
        // Update particles and animations
        this.updateParticles();
        this.updateAnimations();
    }
    
    render() {
        if (!this.ctx || !this.canvas) {
            return;
        }
        
        this.ctx.save();
        
        // Clear canvas with sky blue background
        this.ctx.fillStyle = '#87CEEB';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (!this.gameState) {
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 24px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Đang chờ game...', this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.restore();
            return;
        }
        
        this.ctx.scale(this.scale || 1, this.scale || 1);
        this.ctx.translate(-this.camera.x, -this.camera.y);
        
        // Render game objects
        this.renderBackground();
        this.renderPipes();
        this.renderItems();
        this.renderPlayers();
        this.renderProjectiles();
        this.renderParticles();
        
        this.ctx.restore();
        
        // Render UI on top
        this.renderUI();
    }
    
    renderBackground() {
        // Simple background
        this.ctx.fillStyle = '#87CEEB';
        this.ctx.fillRect(this.camera.x, 0, this.canvas.width, this.config.height);
    }
    
    renderPipes() {
        if (!this.gameState.pipes) return;
        
        this.ctx.fillStyle = '#228B22';
        this.ctx.strokeStyle = '#006400';
        this.ctx.lineWidth = 2;
        
        this.gameState.pipes.forEach(pipe => {
            // Top pipe
            this.ctx.fillRect(pipe.x, 0, 60, pipe.topHeight);
            this.ctx.strokeRect(pipe.x, 0, 60, pipe.topHeight);
            
            // Bottom pipe
            this.ctx.fillRect(pipe.x, pipe.bottomY, 60, pipe.bottomHeight);
            this.ctx.strokeRect(pipe.x, pipe.bottomY, 60, pipe.bottomHeight);
        });
    }
    
    renderItems() {
        if (!this.gameState.items) return;
        
        this.gameState.items.forEach(item => {
            if (item.collected) return;
            
            this.ctx.save();
            this.ctx.translate(item.x, item.y);
            
            switch (item.type) {
                case 'speed':
                    this.ctx.fillStyle = '#FFD700';
                    this.ctx.fillRect(-8, -8, 16, 16);
                    this.ctx.fillStyle = '#FFA500';
                    this.ctx.fillRect(-6, -6, 12, 12);
                    break;
                case 'shield':
                    this.ctx.fillStyle = '#4169E1';
                    this.ctx.fillRect(-8, -8, 16, 16);
                    this.ctx.fillStyle = '#6495ED';
                    this.ctx.fillRect(-6, -6, 12, 12);
                    break;
                case 'bomb':
                    this.ctx.fillStyle = '#FF4500';
                    this.ctx.fillRect(-8, -8, 16, 16);
                    this.ctx.fillStyle = '#FF6347';
                    this.ctx.fillRect(-4, -4, 8, 8);
                    break;
                case 'trap':
                    this.ctx.fillStyle = '#8B4513';
                    this.ctx.fillRect(-8, -8, 16, 16);
                    this.ctx.fillStyle = '#FFD700';
                    this.ctx.fillRect(-6, -6, 12, 12);
                    break;
            }
            
            this.ctx.restore();
        });
    }
    
    renderPlayers() {
        if (!this.gameState.playerStates) return;
        
        this.gameState.playerStates.forEach(player => {
            this.renderPlayer(player);
        });
    }
    
    renderPlayer(player) {
        const x = player.x;
        const y = player.y;
        const isMe = player.playerId === this.playerId;
        
        this.ctx.save();
        this.ctx.translate(x, y);
        
        // Player glow effect if it's me
        if (isMe) {
            this.ctx.shadowColor = player.color || '#FFD700';
            this.ctx.shadowBlur = 20;
        }
        
        // Shield effect
        if (player.effects && player.effects.shield) {
            this.ctx.strokeStyle = '#4169E1';
            this.ctx.lineWidth = 3;
            this.ctx.setLineDash([5, 5]);
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 25, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }
        
        // Speed effect
        if (player.effects && player.effects.speed) {
            this.ctx.strokeStyle = '#FFD700';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([3, 3]);
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 30, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }
        
        // Player body
        this.ctx.fillStyle = player.color || '#FFD700';
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 15, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Player outline
        this.ctx.strokeStyle = isMe ? '#FFFFFF' : '#000000';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Player name
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 1;
        this.ctx.font = 'bold 10px Arial';
        this.ctx.textAlign = 'center';
        const name = isMe ? 'YOU' : `P${player.playerId.slice(-3)}`;
        this.ctx.strokeText(name, 0, -25);
        this.ctx.fillText(name, 0, -25);
        
        // Score
        this.ctx.fillStyle = '#FFD700';
        this.ctx.font = 'bold 10px Arial';
        this.ctx.fillText(player.score || 0, 0, 35);
        
        // Phase indicator
        if (player.phase === 'return') {
            this.ctx.fillStyle = '#4ECDC4';
            this.ctx.font = 'bold 8px Arial';
            this.ctx.fillText('RETURN', 0, 45);
        } else if (player.phase === 'finished') {
            this.ctx.fillStyle = '#FF6B6B';
            this.ctx.font = 'bold 8px Arial';
            this.ctx.fillText(`RANK ${player.rank}`, 0, 45);
        }
        
        this.ctx.restore();
        
        // Death effect
        if (!player.alive) {
            this.addParticle(x, y, '#FF0000', 20);
        }
    }
    
    renderProjectiles() {
        if (!this.gameState.projectiles) return;
        
        this.gameState.projectiles.forEach(proj => {
            this.ctx.fillStyle = '#FF4500';
            this.ctx.beginPath();
            this.ctx.arc(proj.x, proj.y, 8, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Add trail effect
            this.ctx.strokeStyle = '#FF6B6B';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.moveTo(proj.x - proj.velocityX * 2, proj.y);
            this.ctx.lineTo(proj.x, proj.y);
            this.ctx.stroke();
        });
    }
    
    renderParticles() {
        this.particles.forEach((particle, index) => {
            this.ctx.save();
            this.ctx.globalAlpha = particle.alpha;
            this.ctx.fillStyle = particle.color;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });
    }
    
    renderUI() {
        if (!this.gameState) return;
        
        this.ctx.save();
        
        // Game phase indicator
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(10, 10, 200, 40);
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Phase: ${this.gameState.gamePhase?.toUpperCase() || 'WAITING'}`, 20, 35);
        
        // My player stats
        const myPlayer = this.getMyPlayer();
        if (myPlayer) {
            this.renderPlayerStats(myPlayer);
        }
        
        this.ctx.restore();
    }
    
    renderPlayerStats(player) {
        const startY = 60;
        
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(10, startY, 200, 120);
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('Your Stats:', 20, startY + 20);
        
        this.ctx.font = '12px Arial';
        this.ctx.fillText(`Score: ${player.score || 0}`, 20, startY + 40);
        this.ctx.fillText(`Phase: ${player.phase || 'outbound'}`, 20, startY + 55);
        this.ctx.fillText(`Lives: ${player.lives || 3}`, 20, startY + 70);
        
        if (player.rank > 0) {
            this.ctx.fillStyle = '#FFD700';
            this.ctx.fillText(`Final Rank: ${player.rank}`, 20, startY + 85);
        }
        
        // Progress bar
        const progress = Math.min(1, (player.x || 0) / this.config.raceDistance);
        const barWidth = 160;
        const barHeight = 10;
        const barX = 20;
        const barY = startY + 95;
        
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);
        this.ctx.fillStyle = player.phase === 'return' ? '#4ECDC4' : '#FFD700';
        this.ctx.fillRect(barX, barY, barWidth * progress, barHeight);
    }
    
    // === HELPER METHODS ===
    getMyPlayer() {
        return this.gameState?.playerStates?.find(p => p.playerId === this.playerId);
    }
    
    addParticle(x, y, color, size) {
        this.particles.push({
            x: x,
            y: y,
            color: color,
            size: size,
            alpha: 1,
            velocityX: (Math.random() - 0.5) * 4,
            velocityY: (Math.random() - 0.5) * 4
        });
    }
    
    updateParticles() {
        this.particles = this.particles.filter(particle => {
            particle.x += particle.velocityX;
            particle.y += particle.velocityY;
            particle.alpha -= 0.02;
            particle.size *= 0.98;
            return particle.alpha > 0;
        });
    }
    
    updateAnimations() {
        this.animations = this.animations.filter(anim => {
            anim.time += 16; // Assume 60fps
            return anim.time < anim.duration;
        });
    }
    
    updateGameInfo() {
        if (!this.gameState) return;
        
        const modeEl = document.getElementById('currentMode');
        const playersEl = document.getElementById('currentPlayers');
        const timerEl = document.getElementById('gameTimer');
        
        if (modeEl) modeEl.textContent = this.getModeName(this.gameState.settings?.mode);
        if (playersEl) playersEl.textContent = `${this.gameState.players?.length || 0}/${this.gameState.settings?.maxPlayers || 8}`;
        if (timerEl) timerEl.textContent = this.formatTime(this.gameState.gameTimer);
    }
    
    updateLeaderboard() {
        const leaderboardEl = document.getElementById('leaderboard');
        if (!leaderboardEl || !this.gameState.leaderboard) return;
        
        leaderboardEl.innerHTML = '';
        
        this.gameState.leaderboard.slice(0, 5).forEach((entry, index) => {
            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            item.innerHTML = `
                <span class="rank">${index + 1}</span>
                <span class="player">P${entry.playerId.slice(-2)}</span>
                <span>${entry.score}</span>
            `;
            leaderboardEl.appendChild(item);
        });
    }
    
    updatePlayerInventory() {
        const inventoryEl = document.getElementById('playerInventory');
        if (!inventoryEl) return;
        
        const myPlayer = this.getMyPlayer();
        if (!myPlayer || !myPlayer.currentItem) {
            inventoryEl.innerHTML = '<div class="text-muted small">Không có items</div>';
            return;
        }
        
        inventoryEl.innerHTML = '';
        
        const itemEl = document.createElement('div');
        itemEl.className = 'inventory-item';
        itemEl.innerHTML = `
            ${this.getItemIcon(myPlayer.currentItem.type)}
            <div class="hotkey">CTRL</div>
        `;
        inventoryEl.appendChild(itemEl);
    }
    
    updatePlayerStatus() {
        const myPlayer = this.getMyPlayer();
        if (!myPlayer) return;
        
        const livesEl = document.getElementById('playerLives');
        const scoreEl = document.getElementById('playerScore');
        
        if (livesEl) livesEl.textContent = myPlayer.lives || 3;
        if (scoreEl) scoreEl.textContent = myPlayer.score || 0;
    }
    
    updateReadyStatus(playersReady) {
        const readyCount = Object.keys(playersReady).length;
        const totalPlayers = this.gameState?.players?.length || 0;
        
        const statusEl = document.getElementById('readyStatus');
        if (statusEl) {
            if (readyCount < totalPlayers) {
                statusEl.innerHTML = `<span class="ready-status">⏳ ${readyCount}/${totalPlayers} người chơi sẵn sàng...</span>`;
            } else {
                statusEl.innerHTML = '<span class="ready-status">🎮 Bắt đầu game!</span>';
            }
        }
    }
    
    updateConnectionStatus(status, message) {
        const statusEl = document.getElementById('connectionStatus');
        if (statusEl) {
            statusEl.className = `connection-status ${status}`;
            statusEl.textContent = message;
        }
    }
    
    getModeName(mode) {
        const modes = {
            'classic': 'Classic Race',
            'battle': 'Battle Royale',
            'time': 'Time Trial',
            'endless': 'Endless Mode'
        };
        return modes[mode] || mode;
    }
    
    getItemIcon(itemType) {
        const icons = {
            'speed': '⚡',
            'shield': '🛡️',
            'bomb': '💣',
            'trap': '🪤'
        };
        return icons[itemType] || '❓';
    }
    
    formatTime(seconds) {
        if (!seconds) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    copyGameId() {
        if (this.gameId) {
            navigator.clipboard.writeText(this.gameId).then(() => {
                this.showSuccess('Đã copy mã phòng!');
            }).catch(() => {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = this.gameId;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                this.showSuccess('Đã copy mã phòng!');
            });
        }
    }
    
    showError(message) {
        const statusEl = document.getElementById('gameStatus');
        if (statusEl) {
            statusEl.innerHTML = `<div class="error-message">❌ ${message}</div>`;
            setTimeout(() => {
                statusEl.innerHTML = 'Đang chờ...';
            }, 3000);
        } else {
            alert(message);
        }
        console.error('Game Error:', message);
    }
    
    showSuccess(message) {
        const statusEl = document.getElementById('gameStatus');
        if (statusEl) {
            statusEl.innerHTML = `<div class="success-message">✅ ${message}</div>`;
            setTimeout(() => {
                if (statusEl.innerHTML.includes(message)) {
                    statusEl.innerHTML = 'Đang chờ...';
                }
            }, 3000);
        }
        console.log('Game Success:', message);
    }
}

// === GLOBAL FUNCTIONS FOR HTML ===
let flappyGame;

function createGame() {
    if (flappyGame) {
        flappyGame.createGame();
    } else {
        console.error('Game not initialized');
    }
}

function joinGame() {
    if (flappyGame) {
        flappyGame.joinGame();
    } else {
        console.error('Game not initialized');
    }
}

function playerReady() {
    if (flappyGame) {
        flappyGame.playerReady();
    } else {
        console.error('Game not initialized');
    }
}

function copyGameId() {
    if (flappyGame) {
        flappyGame.copyGameId();
    } else {
        console.error('Game not initialized');
    }
}

function copyGameIdFromSetup() {
    copyGameId();
}

function leaveGame() {
    if (flappyGame) {
        flappyGame.leaveGame();
    } else {
        console.error('Game not initialized');
    }
}

// === DEBUG FUNCTIONS ===
function debugGameState() {
    console.log('=== GAME STATE DEBUG ===');
    console.log('Game Instance:', flappyGame);
    console.log('WebSocket State:', flappyGame?.ws?.readyState);
    console.log('Game ID:', flappyGame?.gameId);
    console.log('Player ID:', flappyGame?.playerId);
    console.log('Game State:', flappyGame?.gameState);
    console.log('Fullscreen Active:', document.body.classList.contains('game-playing'));
}

function forceFullscreen() {
    console.log('🔧 Force triggering fullscreen...');
    if (flappyGame) {
        flappyGame.enterFullscreenMode();
    } else {
        console.error('Game not initialized');
    }
}

function forceExitFullscreen() {
    console.log('🔧 Force exiting fullscreen...');
    if (flappyGame) {
        flappyGame.exitFullscreenMode();
    } else {
        document.body.classList.remove('game-playing');
        const flappyPage = document.querySelector('.flappy-race-page');
        if (flappyPage) flappyPage.classList.remove('game-playing');
    }
}

// === INITIALIZATION ===
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎮 Initializing Flappy Race Game...');
    
    try {
        flappyGame = new FlappyRaceClient();
        
        // Make globally accessible
        window.flappyGame = flappyGame;
        window.game = flappyGame;
        
        console.log('✅ Flappy Race Game initialized successfully');
        console.log('🔧 Debug commands available: debugGameState(), forceFullscreen(), forceExitFullscreen()');
        
    } catch (error) {
        console.error('❌ Failed to initialize Flappy Race Game:', error);
    }
});

// === CONNECTION TEST ===
window.testConnection = function() {
    const ws = new WebSocket('ws://localhost:8080');
    ws.onopen = () => console.log('✅ Connection test OK');
    ws.onerror = (e) => console.error('❌ Connection test failed:', e);
    ws.onmessage = (e) => console.log('📨 Test message:', e.data);
    
    setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'test', message: 'hello' }));
        }
    }, 1000);
};

console.log('🎮 Flappy Race Client loaded successfully!');