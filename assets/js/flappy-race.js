// DEBUG: Test WebSocket connection
window.testConnection = function() {
    const ws = new WebSocket('ws://127.0.0.1:8080');
    ws.onopen = () => console.log('✅ Connection test OK');
    ws.onerror = (e) => console.error('❌ Connection test failed:', e);
    ws.onmessage = (e) => console.log('📨 Test message:', e.data);
    
    setTimeout(() => {
        ws.send(JSON.stringify({type: 'test', message: 'hello'}));
    }, 1000);
};

// assets/js/flappy-race.js - Flappy Race Online Client (FIXED SYNTAX)
class FlappyRaceClient {
    constructor() {
        this.ws = null;
        this.gameId = null;
        this.playerId = null;
        this.playerColor = null;
        this.gameState = null;
        this.canvas = null;
        this.ctx = null;
        this.camera = { x: 0, y: 0 };
        this.keys = {};
        this.renderingStarted = false;
        
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
        
        // Assets and animations
        this.particles = [];
        this.animations = [];
        
        this.init();
    }

    init() {
        this.setupCanvas();
        this.connectWebSocket();
        this.setupEventListeners();
        this.setupGameModeSelection();
        this.startRenderLoop();
    }

    setupGameModeSelection() {
        // Setup game mode cards
        document.querySelectorAll('.game-mode-card').forEach(card => {
            card.addEventListener('click', () => {
                // Remove selected class from all cards
                document.querySelectorAll('.game-mode-card').forEach(c => {
                    c.classList.remove('selected');
                });
                
                // Add selected class to clicked card
                card.classList.add('selected');
                
                // Update selected mode
                const mode = card.dataset.mode;
                this.gameSettings.mode = mode;
                
                // Show selected mode
                const selectedModeDiv = document.getElementById('selectedMode');
                const selectedModeNameSpan = document.getElementById('selectedModeName');
                
                if (selectedModeDiv && selectedModeNameSpan) {
                    selectedModeDiv.style.display = 'block';
                    selectedModeNameSpan.textContent = card.querySelector('h5').textContent;
                }
                
                // Update max players based on mode
                this.updateMaxPlayersForMode(mode);
            });
        });
        
        // Setup room settings
        const maxPlayersEl = document.getElementById('maxPlayers');
        const difficultyEl = document.getElementById('difficulty');
        const mapTypeEl = document.getElementById('mapType');
        const itemsEnabledEl = document.getElementById('itemsEnabled');
        
        if (maxPlayersEl) {
            maxPlayersEl.addEventListener('change', (e) => {
                this.gameSettings.maxPlayers = parseInt(e.target.value);
            });
        }
        
        if (difficultyEl) {
            difficultyEl.addEventListener('change', (e) => {
                this.gameSettings.difficulty = e.target.value;
            });
        }
        
        if (mapTypeEl) {
            mapTypeEl.addEventListener('change', (e) => {
                this.gameSettings.mapType = e.target.value;
            });
        }
        
        if (itemsEnabledEl) {
            itemsEnabledEl.addEventListener('change', (e) => {
                this.gameSettings.itemsEnabled = e.target.value === 'true';
            });
        }
    }

    updateMaxPlayersForMode(mode) {
        const maxPlayersSelect = document.getElementById('maxPlayers');
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

    setupCanvas() {
        this.canvas = document.getElementById('flappyCanvas');
        if (!this.canvas) {
            console.error('Canvas element not found');
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        
        window.addEventListener('resize', () => this.resizeCanvas());
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
        
        const containerWidth = container.clientWidth - 40; // Account for padding
        const aspectRatio = this.config.width / this.config.height;
        
        this.canvas.width = Math.min(containerWidth, 1200);
        this.canvas.height = this.canvas.width / aspectRatio;
        
        // Ensure minimum height on mobile
        if (this.canvas.height < 250) {
            this.canvas.height = 250;
            this.canvas.width = 250 * aspectRatio;
        }
        
        // Scale factor for rendering
        this.scale = this.canvas.width / this.config.width;
        
        // Redraw if we have a game state
        if (this.gameState) {
            this.render();
        }
    }

    resizeCanvasFullscreen() {
        if (!this.canvas) return;
        
        // Set canvas to full screen dimensions
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Update canvas style
        this.canvas.style.width = '100vw';
        this.canvas.style.height = '100vh';
        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.zIndex = '9998';
        
        // Scale factor to maintain game proportions
        const gameAspectRatio = this.config.width / this.config.height;
        const screenAspectRatio = window.innerWidth / window.innerHeight;
        
        if (screenAspectRatio > gameAspectRatio) {
            // Screen is wider than game - fit to height
            this.scale = window.innerHeight / this.config.height;
        } else {
            // Screen is taller than game - fit to width
            this.scale = window.innerWidth / this.config.width;
        }
        
        console.log('Canvas resized to fullscreen:', this.canvas.width, 'x', this.canvas.height, 'Scale:', this.scale);
    }

    connectWebSocket() {
    console.log('🔌 Connecting to WebSocket server...');
    
    // Đóng connection cũ nếu có
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
        console.log('❌ WebSocket disconnected. Code:', event.code, 'Reason:', event.reason);
        this.updateConnectionStatus('disconnected', '🔴 Mất kết nối - Đang thử kết nối lại...');
        
        // Auto reconnect sau 3 giây
        setTimeout(() => {
            console.log('🔄 Attempting to reconnect...');
            this.connectWebSocket();
        }, 3000);
    };

    this.ws.onerror = (error) => {
        console.error('⚠️ WebSocket error:', error);
        this.updateConnectionStatus('error', '⚠️ Lỗi kết nối - Kiểm tra server có đang chạy không');
        this.handleConnectionError('Không thể kết nối tới server game');
    };
}

    updateConnectionStatus(status, message) {
        const statusEl = document.getElementById('connectionStatus');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = `connection-status ${status} alert text-center`;
        }
    }

    handleMessage(data) {
    console.log('📨 Received message:', data);
    
    switch (data.type) {
        case 'error':
            console.error('❌ Server error:', data.message);
            
            // Xử lý các loại lỗi cụ thể
            if (data.message.includes('Game không tồn tại')) {
                this.showError('Phòng không tồn tại hoặc đã đóng. Vui lòng kiểm tra lại mã phòng.');
                // Reset về màn hình chính
                this.showMainMenu();
            } else if (data.message.includes('đầy')) {
                this.showError('Phòng đã đầy người chơi');
            } else {
                this.showError(data.message);
            }
            break;
            
        case 'playerInfo':
            this.playerId = data.playerId;
            console.log('👤 Player ID assigned:', this.playerId);
            break;

        case 'gameCreated':
            console.log('✅ Game created successfully:', data);
            this.gameId = data.gameId;
            this.playerColor = data.playerInfo?.color;
            if (data.playerInfo?.gameConfig) {
                this.config = { ...this.config, ...data.playerInfo.gameConfig };
            }
            this.showGameSetupSection();
            break;

        case 'gameJoined':
            console.log('✅ Game joined successfully:', data);
            this.gameId = data.gameId;
            this.playerColor = data.playerInfo?.color;
            if (data.playerInfo?.gameConfig) {
                this.config = { ...this.config, ...data.playerInfo.gameConfig };
            }
            this.showGameSetupSection();
            break;

// THAY THẾ CASE 'gameState' TRONG handleMessage BẰNG:

case 'gameState':
    console.log('📊 Game state update:', data);
    this.gameState = data;
    
    // Special handling for countdown phase
    if (data.gamePhase === 'countdown') {
        const seconds = Math.ceil(data.gameTimer);
        console.log(`⏰ Countdown: ${seconds} seconds`);
        
        // Nếu đang trong fullscreen thì update countdown overlay
        if (document.body.classList.contains('game-playing')) {
            this.updateCountdownOverlay(seconds);
        } else {
            // Nếu chưa fullscreen thì hiện countdown
            this.showCountdownOverlay(seconds);
        }
    } else if (data.gamePhase === 'playing') {
        console.log('🚀 Game started - hiding countdown');
        this.hideCountdownOverlay();
    }
    
    this.updateUI();
    break;

        default:
            console.log('🤔 Unknown message type:', data.type);
    }
}

    // THAY THẾ FUNCTION setupEventListeners CŨ BẰNG CÁI NÀY:

setupEventListeners() {  // ← ĐỔI TÊN TỪ setupEventListenersFixed
    // Remove old event listeners first
    if (this.keyDownHandler) {
        document.removeEventListener('keydown', this.keyDownHandler);
    }
    if (this.keyUpHandler) {
        document.removeEventListener('keyup', this.keyUpHandler);
    }
    
    // Create bound handlers
    this.keyDownHandler = (e) => {
        this.keys[e.code] = true;
        
        // Flap controls
        if (e.code === 'Space' || e.code === 'ArrowUp') {
            e.preventDefault();
            if (this.gameState?.gamePhase === 'playing') {
                this.flap();
            }
        }
        
        // Item usage - only during playing
        if (this.gameState?.gamePhase === 'playing') {
            if (e.code === 'Digit1') this.useItem('speed');
            if (e.code === 'Digit2') this.useItem('shield');
            if (e.code === 'Digit3') this.useItem('bomb');
            if (e.code === 'Digit4') this.useItem('trap');
        }
        
        // EXIT FULLSCREEN - FIX THIS
        if (e.code === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            console.log('ESC pressed - exiting fullscreen');
            
            if (document.body.classList.contains('game-playing')) {
                this.exitFullscreenMode();
            }
        }
    };
    
    this.keyUpHandler = (e) => {
        this.keys[e.code] = false;
    };
    
    // Add new event listeners
    document.addEventListener('keydown', this.keyDownHandler);
    document.addEventListener('keyup', this.keyUpHandler);
    
    // Touch controls for mobile
    if (this.canvas) {
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.gameState?.gamePhase === 'playing') {
                this.flap();
            }
        }, { passive: false });

        this.canvas.addEventListener('click', (e) => {
            e.preventDefault();
            if (this.gameState?.gamePhase === 'playing') {
                this.flap();
            }
        });
    }
    
    // Handle window resize
    window.addEventListener('resize', () => {
        this.resizeCanvas();
    });
}

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
            console.warn('Canvas or context not available for rendering');
            return;
        }
        
        this.ctx.save();
        
        // Clear canvas with sky blue background
        this.ctx.fillStyle = '#87CEEB';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Check if we have game state to render
        if (!this.gameState) {
            // Show waiting message
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 24px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Đang chờ game...', this.canvas.width / 2, this.canvas.height / 2);
            this.ctx.restore();
            return;
        }
        
        // Scale for game rendering
        this.ctx.scale(this.scale || 1, this.scale || 1);
        
        // Apply camera transform
        this.ctx.translate(-this.camera.x, -this.camera.y);
        
        // Render background elements
        this.renderBackground();
        this.renderRaceTrack();
        this.renderPipes();
        this.renderItems();
        this.renderProjectiles();
        this.renderPlayers();
        this.renderParticles();
        
        // Reset transform for UI
        this.ctx.restore();
        
        // Render UI overlays (not affected by camera/scale)
        if (document.body.classList.contains('game-playing')) {
            this.renderFullscreenUI();
        } else {
            this.renderUI();
        }
    }

    renderFullscreenUI() {
        if (!this.gameState) return;
        
        this.ctx.save();
        
        // Game phase indicator (top center)
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(this.canvas.width / 2 - 150, 20, 300, 50);
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 20px Arial';
        this.ctx.textAlign = 'center';
        
        // Show countdown timer or game phase
        if (this.gameState.gamePhase === 'countdown') {
            this.ctx.fillStyle = '#FFD700';
            this.ctx.font = 'bold 32px Arial';
            this.ctx.fillText(`BẮT ĐẦU SAU: ${Math.ceil(this.gameState.gameTimer)}`, this.canvas.width / 2, 50);
        } else {
            this.ctx.fillText(`Phase: ${this.gameState.gamePhase?.toUpperCase() || 'PLAYING'}`, this.canvas.width / 2, 50);
        }
        
        // Player stats (top left)
        const myPlayer = this.getMyPlayer();
        if (myPlayer) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.fillRect(20, 20, 200, 140);
            
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.textAlign = 'left';
            this.ctx.fillText('Your Stats:', 30, 45);
            this.ctx.font = '14px Arial';
            this.ctx.fillText(`Score: ${myPlayer.score || 0}`, 30, 65);
            this.ctx.fillText(`Phase: ${myPlayer.phase || 'outbound'}`, 30, 85);
            this.ctx.fillText(`Lives: ${myPlayer.lives || 3}`, 30, 105);
            
            // Show alive/dead status
            if (!myPlayer.alive) {
                this.ctx.fillStyle = '#FF4444';
                this.ctx.font = 'bold 14px Arial';
                this.ctx.fillText('💀 DEAD', 30, 125);
                this.ctx.fillStyle = '#FFFF00';
                this.ctx.font = '12px Arial';
                this.ctx.fillText('Wait for respawn...', 30, 145);
            } else if (myPlayer.rank > 0) {
                this.ctx.fillStyle = '#FFD700';
                this.ctx.fillText(`Rank: ${myPlayer.rank}`, 30, 125);
            }
        }
        
        // Leaderboard (top right)
        if (this.gameState.leaderboard && this.gameState.leaderboard.length > 0) {
            const boardWidth = 200;
            const boardHeight = Math.min(this.gameState.leaderboard.length * 25 + 50, 200);
            
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            this.ctx.fillRect(this.canvas.width - boardWidth - 20, 20, boardWidth, boardHeight);
            
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Leaderboard', this.canvas.width - boardWidth / 2 - 20, 45);
            
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'left';
            this.gameState.leaderboard.slice(0, 6).forEach((entry, index) => {
                const y = 65 + index * 20;
                const isMe = entry.playerId === this.playerId;
                this.ctx.fillStyle = isMe ? '#FFD700' : '#FFFFFF';
                this.ctx.fillText(`${index + 1}. P${entry.playerId.slice(-2)}: ${entry.score}`, this.canvas.width - boardWidth + 10, y);
            });
        }
        
        // Instructions (bottom center)
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(this.canvas.width / 2 - 250, this.canvas.height - 80, 500, 60);
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('SPACE/Click: Flap  |  1-4: Use Items  |  ESC: Exit Fullscreen', this.canvas.width / 2, this.canvas.height - 50);
        
        // Show respawn message if round finished
        if (this.gameState.gamePhase === 'finished') {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
            this.ctx.fillRect(this.canvas.width / 2 - 200, this.canvas.height / 2 - 50, 400, 100);
            
            this.ctx.fillStyle = '#FFD700';
            this.ctx.font = 'bold 24px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('🏁 ROUND KẾT THÚC!', this.canvas.width / 2, this.canvas.height / 2 - 10);
            
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = '16px Arial';
            this.ctx.fillText('Nhấn ESC để về lobby hoặc chờ respawn', this.canvas.width / 2, this.canvas.height / 2 + 20);
        }
        
        this.ctx.restore();
    }

    renderBackground() {
        // Render clouds and background elements
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        for (let i = 0; i < 10; i++) {
            const x = i * 300 + (Date.now() * 0.01) % 300;
            const y = 50 + Math.sin(i) * 30;
            this.renderCloud(x, y);
        }
    }

    renderCloud(x, y) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, 20, 0, Math.PI * 2);
        this.ctx.arc(x + 15, y, 25, 0, Math.PI * 2);
        this.ctx.arc(x + 30, y, 20, 0, Math.PI * 2);
        this.ctx.fill();
    }

    renderRaceTrack() {
        // Start line
        this.ctx.strokeStyle = '#FF6B6B';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([10, 10]);
        this.ctx.beginPath();
        this.ctx.moveTo(100, 0);
        this.ctx.lineTo(100, this.config.height);
        this.ctx.stroke();
        
        // Finish line
        this.ctx.strokeStyle = '#4ECDC4';
        this.ctx.beginPath();
        this.ctx.moveTo(this.config.raceDistance, 0);
        this.ctx.lineTo(this.config.raceDistance, this.config.height);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]);
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
            this.renderItem(item);
        });
    }

    renderItem(item) {
        const x = item.x;
        const y = item.y;
        const pulse = Math.sin(Date.now() * 0.01) * 0.1 + 1;
        
        this.ctx.save();
        this.ctx.translate(x, y);
        this.ctx.scale(pulse, pulse);
        
        switch (item.type) {
            case 'speed':
                this.ctx.fillStyle = '#FFD700';
                this.ctx.beginPath();
                this.ctx.moveTo(-10, 0);
                this.ctx.lineTo(10, -5);
                this.ctx.lineTo(10, 5);
                this.ctx.closePath();
                this.ctx.fill();
                break;
                
            case 'shield':
                this.ctx.fillStyle = '#4169E1';
                this.ctx.beginPath();
                this.ctx.arc(0, 0, 12, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.strokeStyle = '#FFFFFF';
                this.ctx.lineWidth = 2;
                this.ctx.stroke();
                break;
                
            case 'bomb':
                this.ctx.fillStyle = '#FF4500';
                this.ctx.beginPath();
                this.ctx.arc(0, 0, 10, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.fillRect(-2, -8, 4, 4);
                break;
                
            case 'trap':
                this.ctx.fillStyle = '#8B4513';
                this.ctx.fillRect(-8, -8, 16, 16);
                this.ctx.fillStyle = '#FFD700';
                this.ctx.fillRect(-6, -6, 12, 12);
                break;
        }
        
        this.ctx.restore();
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
            for (let i = 0; i < 3; i++) {
                this.ctx.beginPath();
                this.ctx.moveTo(-20 - i * 5, -5 + i * 2);
                this.ctx.lineTo(-10 - i * 5, -5 + i * 2);
                this.ctx.stroke();
            }
        }
        
        // Player body (bird)
        this.ctx.fillStyle = player.color || '#FFD700';
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        
        // Body
        this.ctx.beginPath();
        this.ctx.ellipse(0, 0, 15, 12, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Wing
        const wingFlap = Math.sin(Date.now() * 0.02) * 0.3;
        this.ctx.fillStyle = this.lightenColor(player.color || '#FFD700', 20);
        this.ctx.beginPath();
        this.ctx.ellipse(-5, wingFlap, 8, 6, wingFlap, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        
        // Eye
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.beginPath();
        this.ctx.arc(5, -3, 4, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.fillStyle = '#000';
        this.ctx.beginPath();
        this.ctx.arc(6, -3, 2, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Beak
        this.ctx.fillStyle = '#FFA500';
        this.ctx.beginPath();
        this.ctx.moveTo(12, -1);
        this.ctx.lineTo(20, 0);
        this.ctx.lineTo(12, 1);
        this.ctx.closePath();
        this.ctx.fill();
        
        // Player name
        this.ctx.fillStyle = '#000';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(isMe ? 'YOU' : `P${player.playerId.slice(-3)}`, 0, -25);
        
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

    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.alpha -= 0.02;
            particle.size *= 0.99;
            
            if (particle.alpha <= 0 || particle.size <= 0.5) {
                this.particles.splice(i, 1);
            }
        }
    }

    updateAnimations() {
        // Update any animations here
    }

    addParticle(x, y, color, count = 5) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: x + (Math.random() - 0.5) * 20,
                y: y + (Math.random() - 0.5) * 20,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                size: 2 + Math.random() * 4,
                alpha: 1,
                color: color
            });
        }
    }

    // Helper functions
    getMyPlayer() {
        if (!this.gameState?.playerStates) return null;
        return this.gameState.playerStates.find(p => p.playerId === this.playerId);
    }

    getItemColor(itemType) {
        const colors = {
            speed: '#FFD700',
            shield: '#4169E1',
            bomb: '#FF4500',
            trap: '#8B4513'
        };
        return colors[itemType] || '#666';
    }

    getItemIcon(itemType) {
        const icons = {
            speed: '⚡',
            shield: '🛡',
            bomb: '💣',
            trap: '🕳'
        };
        return icons[itemType] || '?';
    }

    lightenColor(color, percent) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }

    // Game actions
    flap() {
        // Only allow flapping when game is actually playing
        if (!this.gameId || this.gameState?.status !== 'playing' || this.gameState?.gamePhase !== 'playing') {
            console.log('Flapping disabled - not in playing phase');
            return;
        }
        
        // Check if player is alive
        const myPlayer = this.getMyPlayer();
        if (!myPlayer || !myPlayer.alive) {
            console.log('Flapping disabled - player is dead');
            return;
        }
        
        this.ws.send(JSON.stringify({
            type: 'gameAction',
            gameId: this.gameId,
            action: 'flap'
        }));
        
        // Add flap particles for immediate feedback
        if (myPlayer) {
            this.addParticle(myPlayer.x || 0, myPlayer.y || 0, myPlayer.color || '#FFD700', 3);
        }
    }

    useItem(itemType) {
        if (!this.gameId || this.gameState?.status !== 'playing') return;
        
        this.ws.send(JSON.stringify({
            type: 'gameAction',
            gameId: this.gameId,
            action: 'useItem',
            data: { itemType }
        }));
    }
forceRespawnPlayer() {
    if (!this.gameState || !this.gameId) return;
    
    this.ws.send(JSON.stringify({
        type: 'gameAction',
        gameId: this.gameId,
        action: 'forceRespawn'
    }));
}
    // UI event handlers
    createGame() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.showError('Chưa kết nối được server. Vui lòng refresh trang!');
            return;
        }

        // Validate game settings
        if (!this.gameSettings.mode) {
            this.showError('Vui lòng chọn chế độ chơi');
            return;
        }

        console.log('🚀 Creating game with settings:', this.gameSettings);

        this.ws.send(JSON.stringify({
            type: 'createGame',
            gameType: 'flappy-race',
            settings: this.gameSettings
        }));
    }

joinGame() {
    const gameIdInput = document.getElementById('gameIdInput');
    if (!gameIdInput) return;
    
    const gameId = gameIdInput.value.trim();
    if (!gameId) {
        this.showError('Vui lòng nhập mã phòng');
        return;
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.showError('Chưa kết nối được server. Đang thử kết nối lại...');
        this.connectWebSocket();
        return;
    }

    console.log('🎮 Trying to join game:', gameId);

    this.ws.send(JSON.stringify({
        type: 'joinGame',
        gameId: gameId,
        gameType: 'flappy-race' // Thêm gameType để server biết
    }));
}
handleConnectionError(message) {
    console.error('Connection error:', message);
    this.showError(message);
    
    // Thử kết nối lại
    setTimeout(() => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log('🔄 Auto-reconnecting...');
            this.connectWebSocket();
        }
    }, 2000);
}


    showQuickJoin() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.showError('Chưa kết nối được server');
            return;
        }

        this.ws.send(JSON.stringify({
            type: 'quickJoin',
            gameType: 'flappy-race'
        }));
    }

    playerReady() {
        if (!this.gameId) {
            this.showError('Chưa vào phòng');
            return;
        }

        this.ws.send(JSON.stringify({
            type: 'ready',
            gameId: this.gameId
        }));

        const readyBtn = document.getElementById('readyBtn');
        const readyStatus = document.getElementById('readyStatus');
        
        if (readyBtn) readyBtn.disabled = true;
        if (readyStatus) {
            readyStatus.innerHTML = '<span class="ready-status">✅ Đã sẵn sàng</span>';
        }
    }

    pauseGame() {
        if (!this.gameId) return;

        this.ws.send(JSON.stringify({
            type: 'gameAction',
            gameId: this.gameId,
            action: 'pause'
        }));
    }

    resetGame() {
        if (!this.gameId) return;

        if (confirm('🔄 Bạn có chắc chắn muốn bắt đầu ván mới không?')) {
            // Exit fullscreen
            this.exitFullscreenMode();
            
            this.ws.send(JSON.stringify({
                type: 'resetGame',
                gameId: this.gameId
            }));
        }
    }

    leaveGame() {
        if (!this.gameId) return;

        if (confirm('🚪 Bạn có chắc chắn muốn rời phòng không?')) {
            this.ws.send(JSON.stringify({
                type: 'leaveGame',
                gameId: this.gameId
            }));

            // Exit fullscreen if in game
            this.exitFullscreenMode();

            // Reset client state
            this.gameId = null;
            this.playerColor = null;
            this.gameState = null;

            // Show main menu
            this.showMainMenu();

            this.showSuccess('Đã rời phòng thành công!');
        }
    }

    // UI management
showMainMenu() {
    const mainMenu = document.getElementById('mainMenu');
    const gameSection = document.getElementById('gameSection');
    
    if (mainMenu) mainMenu.style.display = 'block';
    if (gameSection) gameSection.style.display = 'none';
    
    // Reset game state
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

    updateUI() {
        if (!this.gameState) return;

        // Update game info
        this.updateGameInfo();
        this.updateLeaderboard();
        this.updatePlayerInventory();
        this.updatePlayerStatus();

        switch (this.gameState.status) {
            case 'setup':
                this.showGameSetupSection();
                break;
            case 'playing':
                this.showGamePlaying();
                break;
            case 'finished':
                this.showGameResult();
                break;
        }
    }

// THAY THẾ FUNCTION showGamePlaying BẰNG CÁI NÀY:

showGamePlaying() {
    console.log('🎮 Showing game playing mode');
    
    const gameSetup = document.getElementById('gameSetup');
    const gameSection = document.getElementById('gameSection');
    
    if (gameSetup) gameSetup.classList.add('hidden');
    if (gameSection) gameSection.classList.remove('hidden');
    
    // VÀO FULLSCREEN NGAY LẬP TỨC - không quan tâm game phase
    console.log('🖥️ Entering fullscreen immediately...');
    setTimeout(() => {
        this.enterFullscreenMode();
        this.resizeCanvas();
        
        // Hiển thị countdown nếu đang trong phase countdown
        if (this.gameState?.gamePhase === 'countdown') {
            console.log('⏰ Starting countdown display...');
            this.showCountdownOverlay(Math.ceil(this.gameState.gameTimer));
        }
    }, 200); // Vào fullscreen nhanh hơn
}

    enterFullscreenMode() {
        console.log('Entering fullscreen mode');
        
        // Add fullscreen class to body
        document.body.classList.add('game-playing');
        
        // Hide header/navbar
        const header = document.querySelector('nav, .navbar');
        if (header) {
            header.style.display = 'none';
        }
        
        // Add exit fullscreen button
        this.addExitFullscreenButton();
        
        // Prevent scrolling
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        
        // Force canvas visibility
        if (this.canvas) {
            this.canvas.style.display = 'block';
            this.canvas.style.visibility = 'visible';
        }
        
        // Resize canvas for fullscreen
        setTimeout(() => {
            this.resizeCanvasFullscreen();
        }, 100);
    }

    // CŨNG THAY THẾ FUNCTION exitFullscreenMode BẰNG CÁI NÀY:

exitFullscreenMode() {  // ← ĐỔI TÊN TỪ exitFullscreenModeFixed
    console.log('🚪 Exiting fullscreen mode...');
    
    // Force remove fullscreen class
    document.body.classList.remove('game-playing');
    
    // Show navbar/header again with force
    const navbar = document.querySelector('.navbar, nav, header');
    if (navbar) {
        navbar.style.display = 'block';
        navbar.style.visibility = 'visible';
    }
    
    // Remove exit button
    const exitBtn = document.querySelector('.exit-fullscreen-btn');
    if (exitBtn) {
        exitBtn.remove();
    }
    
    // Restore scrolling
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    
    // Reset canvas styles completely
    if (this.canvas) {
        this.canvas.style.position = 'relative';
        this.canvas.style.top = 'auto';
        this.canvas.style.left = 'auto';
        this.canvas.style.zIndex = 'auto';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '400px';
        this.canvas.style.maxWidth = '800px';
    }
    
    // Force show game section or setup
    if (this.gameState?.gamePhase === 'finished' || this.gameState?.status === 'finished') {
        this.showRespawnSection();
    } else {
        const gameSetup = document.getElementById('gameSetup');
        const gameSection = document.getElementById('gameSection');
        
        if (gameSetup) gameSetup.classList.remove('hidden');
        if (gameSection) gameSection.classList.add('hidden');
    }
    
    // Resize canvas back to normal
    setTimeout(() => {
        this.resizeCanvas();
    }, 100);
    
    console.log('✅ Fullscreen mode exited successfully');
}

    addExitFullscreenButton() {  // ← ĐỔI TÊN TỪ addExitFullscreenButtonFixed
    // Remove existing button
    const existingBtn = document.querySelector('.exit-fullscreen-btn');
    if (existingBtn) {
        existingBtn.remove();
    }
    
    // Create better exit button
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
    
    // Multiple ways to exit
    exitBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.exitFullscreenMode();
    };
    
    exitBtn.onmousedown = (e) => {
        e.preventDefault();
        e.stopPropagation();
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

    showGameResult() {
        // Don't exit fullscreen immediately for round end
        if (this.gameState.status === 'finished') {
            // Game completely finished
            this.exitFullscreenMode();
            this.showSuccess('🏁 Game hoàn toàn kết thúc!');
        } else {
            // Round finished, show respawn option but keep in fullscreen until user ready
            this.showSuccess('🏆 Round kết thúc! Nhấn ESC để về lobby hoặc chờ respawn...');
        }
    }

    handleRespawnStarted() {
        console.log('Respawn started - going back to game');
        
        // Go directly back to fullscreen game mode
        const gameSetup = document.getElementById('gameSetup');
        const gameSection = document.getElementById('gameSection');
        
        if (gameSetup) gameSetup.classList.add('hidden');
        if (gameSection) gameSection.classList.remove('hidden');
        
        // Enter fullscreen for new round
        setTimeout(() => {
            this.enterFullscreenMode();
            this.resizeCanvas();
        }, 500);
    }

    showRespawnButton() {
        console.log('Showing respawn button');
        
        // Exit fullscreen to show respawn UI
        this.exitFullscreenMode();
        
        // Show game section with respawn button
        const gameSetup = document.getElementById('gameSetup');
        const gameSection = document.getElementById('gameSection');
        
        if (gameSetup) gameSetup.classList.add('hidden');
        if (gameSection) gameSection.classList.remove('hidden');
        
        // Enable and show ready button for respawn
        const readyBtn = document.getElementById('readyBtn');
        const readyStatus = document.getElementById('readyStatus');
        
        if (readyBtn) {
            readyBtn.disabled = false;
            readyBtn.textContent = '🔄 Sẵn sàng chiến đấu lại!';
            readyBtn.className = 'btn btn-warning btn-lg px-5'; // Change color for respawn
            readyBtn.style.display = 'inline-block'; // Make sure it's visible
        }
        
        if (readyStatus) {
            readyStatus.innerHTML = '<span class="not-ready-status">Chưa sẵn sàng cho round mới</span>';
        }
        
        // Show respawn section in game setup area
        this.showRespawnSection();
    }

    showRespawnSection() {
        const gameSetup = document.getElementById('gameSetup');
        if (!gameSetup) return;
        
        gameSetup.classList.remove('hidden');
        
        // Update the lobby title
        const lobbyTitle = gameSetup.querySelector('.card-header h4');
        if (lobbyTitle) {
            lobbyTitle.textContent = '🔄 Round Kết Thúc - Sẵn Sàng Tiếp Tục?';
        }
    }

    resetReadyButton() {
        console.log('Resetting ready button');
        
        const readyBtn = document.getElementById('readyBtn');
        const readyStatus = document.getElementById('readyStatus');
        
        if (readyBtn) {
            readyBtn.disabled = false;
            readyBtn.textContent = '✅ Sẵn sàng chiến đấu!';
            readyBtn.className = 'btn btn-success btn-lg px-5'; // Back to original color
        }
        
        if (readyStatus) {
            readyStatus.innerHTML = '<span class="not-ready-status">Chưa sẵn sàng</span>';
        }
        
        // Reset lobby title
        const gameSetup = document.getElementById('gameSetup');
        if (gameSetup) {
            const lobbyTitle = gameSetup.querySelector('.card-header h4');
            if (lobbyTitle) {
                lobbyTitle.textContent = '🎮 Lobby Game';
            }
        }
    }

    updateGameInfo() {
        if (!this.gameState) return;
        
        // Update game info display
        if (this.gameState.settings) {
            const settings = this.gameState.settings;
            
            const currentGameMode = document.getElementById('currentGameMode');
            const currentMap = document.getElementById('currentMap');
            const currentDifficulty = document.getElementById('currentDifficulty');
            
            if (currentGameMode) currentGameMode.textContent = this.getModeName(settings.mode);
            if (currentMap) currentMap.textContent = this.getMapName(settings.mapType);
            if (currentDifficulty) currentDifficulty.textContent = this.getDifficultyName(settings.difficulty);
        }
        
        // Update players list
        this.updatePlayersList();
    }

    updatePlayersList() {
        const playersListEl = document.getElementById('playersList');
        if (!playersListEl || !this.gameState.players) return;
        
        playersListEl.innerHTML = '';
        
        this.gameState.players.forEach((player, index) => {
            const playerItem = document.createElement('div');
            playerItem.className = 'player-item';
            
            const isMe = player.playerId === this.playerId;
            const readyStatus = this.gameState.playersReady && this.gameState.playersReady[player.playerId] ? '✅' : '⏳';
            
            playerItem.innerHTML = `
                <div class="player-name">${isMe ? '👤 Bạn' : `🎮 Player ${index + 1}`}</div>
                <div class="player-status ms-auto">${readyStatus}</div>
            `;
            
            if (isMe) {
                playerItem.style.background = 'rgba(0, 123, 255, 0.3)';
            }
            
            playersListEl.appendChild(playerItem);
        });
    }

    updateLeaderboard() {
        const leaderboardEl = document.getElementById('leaderboard');
        if (!leaderboardEl || !this.gameState.leaderboard) return;
        
        leaderboardEl.innerHTML = '';
        
        this.gameState.leaderboard.forEach((entry, index) => {
            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            
            if (entry.playerId === this.playerId) {
                item.classList.add('me');
            }
            
            item.innerHTML = `
                <span>${index + 1}. P${entry.playerId.slice(-2)}</span>
                <span>${entry.score}</span>
            `;
            
            leaderboardEl.appendChild(item);
        });
    }

    updatePlayerInventory() {
        const inventoryEl = document.getElementById('playerInventory');
        if (!inventoryEl) return;
        
        const myPlayer = this.getMyPlayer();
        if (!myPlayer || !myPlayer.items || myPlayer.items.length === 0) {
            inventoryEl.innerHTML = '<div class="text-muted small">Không có items</div>';
            return;
        }
        
        inventoryEl.innerHTML = '';
        
        myPlayer.items.forEach((item, index) => {
            const itemEl = document.createElement('div');
            itemEl.className = 'inventory-item';
            itemEl.innerHTML = `
                ${this.getItemIcon(item)}
                <div class="hotkey">${index + 1}</div>
            `;
            inventoryEl.appendChild(itemEl);
        });
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

    getModeName(mode) {
        const modes = {
            'classic': 'Classic Race',
            'battle': 'Battle Royale',
            'time': 'Time Trial',
            'endless': 'Endless Mode'
        };
        return modes[mode] || mode;
    }

    getMapName(mapType) {
        const maps = {
            'classic': 'Classic',
            'jungle': 'Jungle',
            'city': 'City',
            'space': 'Space'
        };
        return maps[mapType] || mapType;
    }

    getDifficultyName(difficulty) {
        const difficulties = {
            'easy': 'Dễ',
            'normal': 'Bình thường',
            'hard': 'Khó',
            'extreme': 'Cực khó'
        };
        return difficulties[difficulty] || difficulty;
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
    }

    showSuccess(message) {
        const statusEl = document.getElementById('gameStatus');
        if (statusEl) {
            statusEl.innerHTML = `<div class="success-message">✅ ${message}</div>`;
        } else {
            console.log(message);
        }
    }
}

// Global functions for HTML onclick events
let flappyGame;

function createGame() {
    if (flappyGame) {
        flappyGame.createGame();
    }
}

function joinGame() {
    if (flappyGame) {
        flappyGame.joinGame();
    }
}

function showQuickJoin() {
    if (flappyGame) {
        flappyGame.showQuickJoin();
    }
}

function playerReady() {
    if (flappyGame) {
        flappyGame.playerReady();
    }
}

function copyGameId() {
    if (flappyGame) {
        flappyGame.copyGameId();
    }
}
// Thêm vào file flappy-race.js hoặc file JS tương ứng

// Copy Game ID với validation


// Copy từ setup section
function copyGameIdFromSetup() {
    copyGameId();
}

// Cải thiện join game function
function joinGame() {
    const gameIdInput = document.getElementById('gameIdInput');
    if (!gameIdInput) {
        console.error('Không tìm thấy input field');
        return;
    }
    
    // Trim và clean input
    const gameId = gameIdInput.value.trim().toLowerCase();
    console.log('🎮 Attempting to join game:', gameId);
    
    if (!gameId) {
        alert('⚠️ Vui lòng nhập mã phòng!');
        gameIdInput.focus();
        return;
    }
    
    // Validate format (optional)
    if (!gameId.includes('flappy-race_')) {
        if (confirm('🤔 Mã phòng có vẻ không đúng định dạng. Bạn có chắc muốn tiếp tục?')) {
            // Continue
        } else {
            return;
        }
    }
    
    // Check WebSocket connection
    if (!window.game || !window.game.ws || window.game.ws.readyState !== WebSocket.OPEN) {
        alert('❌ Chưa kết nối được server. Đang thử kết nối lại...');
        
        // Try to reconnect
        if (window.game && window.game.connectWebSocket) {
            window.game.connectWebSocket();
        }
        return;
    }
    
    // Send join request
    try {
        window.game.ws.send(JSON.stringify({
            type: 'joinGame',
            gameId: gameId,
            gameType: 'flappy-race'
        }));
        
        console.log('📤 Join request sent for game:', gameId);
        
        // Show loading state
        const joinBtn = document.querySelector('button[onclick="joinGame()"]');
        if (joinBtn) {
            const originalText = joinBtn.innerHTML;
            joinBtn.innerHTML = '⏳ Đang vào phòng...';
            joinBtn.disabled = true;
            
            // Reset button after 5 seconds if no response
            setTimeout(() => {
                if (joinBtn.disabled) {
                    joinBtn.innerHTML = originalText;
                    joinBtn.disabled = false;
                }
            }, 5000);
        }
        
    } catch (error) {
        console.error('❌ Error sending join request:', error);
        alert('❌ Lỗi khi gửi yêu cầu vào phòng');
    }
}

// Debug function để check available games
function checkAvailableGames() {
    if (!window.game || !window.game.ws || window.game.ws.readyState !== WebSocket.OPEN) {
        console.log('❌ WebSocket not connected');
        return;
    }
    
    window.game.ws.send(JSON.stringify({
        type: 'listGames',
        gameType: 'flappy-race'
    }));
    
    console.log('📤 Requested list of available games');
}
function pauseGame() {
    if (flappyGame) {
        flappyGame.pauseGame();
    }
}

function resetGame() {
    if (flappyGame) {
        flappyGame.resetGame();
    }
}

function leaveGame() {
    if (flappyGame) {
        flappyGame.leaveGame();
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing Flappy Race Game...');
    flappyGame = new FlappyRaceClient();
});

// ===== FIX FOR FLAPPY RACE CONNECTION ISSUES =====

// 1. Fix global variable initialization - thêm vào cuối file flappy-race.js
window.flappyGame = null;

// 2. Fix the DOMContentLoaded event
document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing Flappy Race Game...');
    window.flappyGame = new FlappyRaceClient();
    
    // Make it globally accessible
    window.game = window.flappyGame;
});

// 3. Fix the joinGame function - thay thế function joinGame() cũ
function joinGame() {
    const gameIdInput = document.getElementById('gameIdInput');
    if (!gameIdInput) {
        console.error('Không tìm thấy input field');
        return;
    }
    
    // Trim và clean input
    const gameId = gameIdInput.value.trim().toLowerCase();
    console.log('🎮 Attempting to join game:', gameId);
    
    if (!gameId) {
        alert('⚠️ Vui lòng nhập mã phòng!');
        gameIdInput.focus();
        return;
    }
    
    // Validate format - BỎ VALIDATION NGHIÊM NGẶT
    if (!gameId.includes('flappy-race') && !gameId.includes('6430')) {
        if (!confirm('🤔 Mã phòng có vẻ không đúng định dạng. Bạn có chắc muốn tiếp tục?')) {
            return;
        }
    }
    
    // Check WebSocket connection - FIX ĐÚNG BIẾN
    if (!window.flappyGame || !window.flappyGame.ws || window.flappyGame.ws.readyState !== WebSocket.OPEN) {
        alert('❌ Chưa kết nối được server. Đang thử kết nối lại...');
        
        // Try to reconnect
        if (window.flappyGame && window.flappyGame.connectWebSocket) {
            window.flappyGame.connectWebSocket();
        }
        return;
    }
    
    // Send join request - ĐÚNG SYNTAX
    try {
        window.flappyGame.ws.send(JSON.stringify({
            type: 'joinGame',
            gameId: gameId,
            gameType: 'flappy-race'
        }));
        
        console.log('📤 Join request sent for game:', gameId);
        
        // Show loading state
        const joinBtn = document.querySelector('button[onclick="joinGame()"]');
        if (joinBtn) {
            const originalText = joinBtn.innerHTML;
            joinBtn.innerHTML = '⏳ Đang vào phòng...';
            joinBtn.disabled = true;
            
            // Reset button after 5 seconds if no response
            setTimeout(() => {
                if (joinBtn.disabled) {
                    joinBtn.innerHTML = originalText;
                    joinBtn.disabled = false;
                }
            }, 5000);
        }
        
    } catch (error) {
        console.error('❌ Error sending join request:', error);
        alert('❌ Lỗi khi gửi yêu cầu vào phòng');
    }
}

// 4. Fix other global functions
function createGame() {
    if (window.flappyGame) {
        window.flappyGame.createGame();
    } else {
        alert('Game chưa được khởi tạo!');
    }
}

function showQuickJoin() {
    if (window.flappyGame) {
        window.flappyGame.showQuickJoin();
    }
}

function playerReady() {
    if (window.flappyGame) {
        window.flappyGame.playerReady();
    }
}

function copyGameId() {
    if (window.flappyGame) {
        window.flappyGame.copyGameId();
    }
}

function pauseGame() {
    if (window.flappyGame) {
        window.flappyGame.pauseGame();
    }
}

function resetGame() {
    if (window.flappyGame) {
        window.flappyGame.resetGame();
    }
}

function leaveGame() {
    if (window.flappyGame) {
        window.flappyGame.leaveGame();
    }
}

// 5. Debug functions
function debugConnection() {
    console.log('=== FLAPPY RACE DEBUG ===');
    console.log('flappyGame instance:', window.flappyGame);
    console.log('WebSocket state:', window.flappyGame?.ws?.readyState);
    console.log('Connected:', window.flappyGame?.ws?.readyState === WebSocket.OPEN);
    console.log('Game ID:', window.flappyGame?.gameId);
    console.log('Player ID:', window.flappyGame?.playerId);
}

function listAvailableGames() {
    if (!window.flappyGame || !window.flappyGame.ws) {
        console.log('❌ No connection');
        return;
    }
    
    window.flappyGame.ws.send(JSON.stringify({
        type: 'listGames',
        gameType: 'flappy-race'
    }));
    
    console.log('📤 Requested list of available games');
}

// 6. Test connection with better error handling
function testGameConnection() {
    console.log('🔧 Testing game connection...');
    
    // Check if instance exists
    if (!window.flappyGame) {
        console.error('❌ flappyGame instance not found');
        return false;
    }
    
    // Check WebSocket
    const ws = window.flappyGame.ws;
    if (!ws) {
        console.error('❌ WebSocket not initialized');
        return false;
    }
    
    // Check connection state
    const states = {
        0: 'CONNECTING',
        1: 'OPEN',
        2: 'CLOSING', 
        3: 'CLOSED'
    };
    
    console.log(`📡 WebSocket state: ${states[ws.readyState]} (${ws.readyState})`);
    
    if (ws.readyState === WebSocket.OPEN) {
        console.log('✅ Connection is ready!');
        return true;
    } else {
        console.log('❌ Connection not ready');
        return false;
    }
}

// 7. Auto-reconnect function  
function forceReconnect() {
    console.log('🔄 Force reconnecting...');
    
    if (window.flappyGame) {
        if (window.flappyGame.ws) {
            window.flappyGame.ws.close();
        }
        window.flappyGame.connectWebSocket();
    }
}

console.log('🔧 Flappy Race fixes loaded! Use debugConnection() to check status.');



// THAY THẾ showCountdownOverlay BẰNG PHIÊN BẢN CẢI THIỆN:

showCountdownOverlay(seconds) {
    console.log(`🎯 Showing countdown overlay: ${seconds}s`);
    
    // Remove existing overlay
    const existingOverlay = document.querySelector('.countdown-overlay');
    if (existingOverlay) {
        existingOverlay.remove();
    }
    
    // Create countdown overlay
    const overlay = document.createElement('div');
    overlay.className = 'countdown-overlay';
    overlay.innerHTML = `
        <div class="countdown-content">
            <h1 class="countdown-number">${seconds}</h1>
            <p class="countdown-text">🚀 Game bắt đầu sau...</p>
            <p class="countdown-instruction">Nhấn SPACE hoặc click để bay lên</p>
            <div class="countdown-progress">
                <div class="countdown-bar" style="animation: countdown ${seconds}s linear forwards;"></div>
            </div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Add countdown styles if not exists
    if (!document.querySelector('#countdown-styles')) {
        const styles = document.createElement('style');
        styles.id = 'countdown-styles';
        styles.textContent = `
            .countdown-overlay {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                background: rgba(0, 0, 0, 0.85) !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                z-index: 10002 !important;
                backdrop-filter: blur(15px) !important;
            }
            
            .countdown-content {
                text-align: center;
                color: white;
                animation: pulse 0.8s ease-in-out infinite alternate;
            }
            
            .countdown-number {
                font-size: 150px !important;
                font-weight: bold !important;
                margin: 0 !important;
                text-shadow: 0 0 50px #FFD700, 0 0 100px #FFD700 !important;
                color: #FFD700 !important;
                line-height: 1 !important;
                font-family: 'Arial Black', Arial, sans-serif !important;
            }
            
            .countdown-text {
                font-size: 28px !important;
                margin: 30px 0 10px 0 !important;
                color: #FFFFFF !important;
                font-weight: bold !important;
            }
            
            .countdown-instruction {
                font-size: 18px !important;
                margin: 10px 0 30px 0 !important;
                color: #CCCCCC !important;
                opacity: 0.8;
            }
            
            .countdown-progress {
                width: 400px !important;
                height: 10px !important;
                background: rgba(255, 255, 255, 0.2) !important;
                border-radius: 5px !important;
                overflow: hidden !important;
                margin: 0 auto !important;
                border: 2px solid rgba(255, 215, 0, 0.3) !important;
            }
            
            .countdown-bar {
                height: 100% !important;
                background: linear-gradient(90deg, #FFD700, #FF6B6B, #4ECDC4) !important;
                width: 100% !important;
                border-radius: 3px !important;
                transition: width 1s linear !important;
            }
            
            @keyframes countdown {
                from { width: 100%; }
                to { width: 0%; }
            }
            
            @keyframes pulse {
                from { transform: scale(1); }
                to { transform: scale(1.02); }
            }
            
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;
        document.head.appendChild(styles);
    }
}

// THÊM FUNCTION MỚI VÀO CLASS FlappyRaceClient:

updateCountdownOverlay(seconds) {
    const existingOverlay = document.querySelector('.countdown-overlay');
    if (existingOverlay) {
        // Chỉ update số, không tạo lại overlay
        const numberElement = existingOverlay.querySelector('.countdown-number');
        const progressBar = existingOverlay.querySelector('.countdown-bar');
        
        if (numberElement) {
            numberElement.textContent = seconds;
            numberElement.style.animation = 'none';
            // Trigger reflow để restart animation
            numberElement.offsetHeight;
            numberElement.style.animation = 'pulse 0.8s ease-in-out infinite alternate';
        }
        
        if (progressBar) {
            progressBar.style.animation = `countdown ${seconds}s linear forwards`;
        }
    } else {
        // Nếu chưa có overlay thì tạo mới
        this.showCountdownOverlay(seconds);
    }
}



function hideCountdownOverlay() {
    const overlay = document.querySelector('.countdown-overlay');
    if (overlay) {
        overlay.style.animation = 'fadeOut 0.5s ease-out forwards';
        setTimeout(() => overlay.remove(), 500);
    }
}

// DEBUG FUNCTIONS - for troubleshooting
function debugGameState() {
    console.log('=== GAME STATE DEBUG ===');
    console.log('Game Phase:', window.flappyGame?.gameState?.gamePhase);
    console.log('Game Status:', window.flappyGame?.gameState?.status);
    console.log('Game Timer:', window.flappyGame?.gameState?.gameTimer);
    console.log('My Player:', window.flappyGame?.getMyPlayer?.());
    console.log('All Players:', window.flappyGame?.gameState?.players);
}

function forceExitFullscreen() {
    console.log('🔧 Force exiting fullscreen...');
    document.body.classList.remove('game-playing');
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    
    const exitBtn = document.querySelector('.exit-fullscreen-btn');
    if (exitBtn) exitBtn.remove();
    
    const navbar = document.querySelector('.navbar, nav');
    if (navbar) navbar.style.display = 'block';
    
    console.log('✅ Force exit completed');
}

console.log('🔧 Debug functions loaded! Use debugGameState() and forceExitFullscreen() in console.');
// 10. APPLY FIXES
console.log('🔧 Flappy Race Gameplay Fixes loaded!');
console.log('📝 To apply fixes:');
console.log('1. Replace handleMessage case "gameState" with fixed version');
console.log('2. Replace setupEventListeners with setupEventListenersFixed');
console.log('3. Replace exitFullscreenMode with exitFullscreenModeFixed');
console.log('4. Replace addExitFullscreenButton with addExitFullscreenButtonFixed');
console.log('');
console.log('🎮 Debug commands:');
console.log('- debugGameState() - Check current game state');
console.log('- forceExitFullscreen() - Force exit if stuck');
console.log('- forceRespawnPlayer() - Force respawn if stuck');