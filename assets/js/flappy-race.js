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


         setTimeout(() => {
        this.initializeUI();
    }, 100);
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
    console.log('📨 Received message:', data.type, data);

    switch (data.type) {
        case 'error':
            console.error('❌ Server error:', data.message);
            if (data.message.includes('không tồn tại')) {
                this.showError('❌ Mã phòng không hợp lệ! Vui lòng kiểm tra lại mã phòng.');
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
    this.isHost = data.playerInfo?.isHost || true;
    this.isSpectator = false;
    
    if (data.playerInfo?.gameConfig) {
        this.config = { ...this.config, ...data.playerInfo.gameConfig };
    }
    
    // QUAN TRỌNG: Hiển thị lobby/setup section
    this.showGameSetupSection();
    
    // Update game info
    this.updateGameInfo();
    
    break;
case 'playerLeft':
    console.log('👋 Player left:', data);
    
    // Cập nhật game state nếu có
    if (this.gameState && data.playerId) {
        // Remove player from players list
        this.gameState.players = this.gameState.players.filter(p => p.playerId !== data.playerId);
        
        // Remove from ready list
        if (this.gameState.playersReady) {
            delete this.gameState.playersReady[data.playerId];
        }
        
        // Update UI
        this.updatePlayersList();
        this.updateReadyStatus(this.gameState.playersReady || {});
    }
    
    // Hiển thị thông báo
    if (data.playerId !== this.playerId) {
        this.showInfo(`👋 Người chơi ${data.playerId.slice(-4)} đã rời phòng`);
    }
    break;
 case 'gameJoined':
    console.log('✅ Game joined successfully:', data);
    this.gameId = data.gameId;
    this.playerColor = data.playerInfo?.color;
    this.isHost = data.playerInfo?.isHost || false;
    this.isSpectator = data.playerInfo?.isSpectator || false;
    
    if (data.playerInfo?.gameConfig) {
        this.config = { ...this.config, ...data.playerInfo.gameConfig };
    }
    
    // QUAN TRỌNG: Hiển thị lobby/setup section
    this.showGameSetupSection();
    
    // Update game info
    this.updateGameInfo();
    
    break;
case 'roundFinished':
    console.log('🏁 Round finished:', data);
    this.gameState.gamePhase = 'finished';
    
    // Exit fullscreen để hiển thị UI
    this.exitFullscreenMode();
    
    // Hiển thị kết quả và nút sẵn sàng
    this.showRoundResult(data);
    break;

case 'newRoundStarted':
    console.log('🔄 New round started - entering game mode');
    
    // Reset UI và vào fullscreen
    this.resetReadyButton();
    this.showGamePlaying();
    break;

case 'readyUpdate':
    console.log('✅ Ready status update:', data.playersReady);
    
    if (this.gameState) {
        this.gameState.playersReady = data.playersReady;
    }
    
    this.updateReadyStatus(data.playersReady);
    this.updatePlayersList();
    break;
     
case 'gameStarted':
    console.log('🎮 Game started - entering fullscreen');
    this.showGamePlaying();
    break;

case 'gameState':
    console.log('📊 Game state update:', data);
    this.gameState = data;
    
    // DEBUG: Log players và ready status
    console.log('Players:', data.players);
    console.log('PlayerStates:', data.playerStates);
    console.log('PlayersReady:', data.playersReady);
    
    // Đảm bảo event listeners hoạt động
    if (!this.eventListenersActive) {
        console.log('🔧 Re-setting up event listeners...');
        this.setupEventListeners();
        this.eventListenersActive = true;
    }
    
    // Update UI
    this.updateUI();
    break;
        // ===== THÊM CASE MỚI ĐỂ XỬ LÝ READY UPDATE =====
        case 'readyUpdate':
            console.log('✅ Ready status update:', data.playersReady);
            
            // Cập nhật trạng thái ready trong gameState
            if (this.gameState) {
                this.gameState.playersReady = data.playersReady;
            }
            
            // Gọi hàm cập nhật UI
            this.updateReadyStatus(data.playersReady);
            this.updatePlayersList();
            break;

        case 'gameMessage':
            console.log('💬 Game message:', data.message);
            this.showSuccess(data.message);
            break;

        default:
            console.log('❓ Unknown message type:', data.type);
    }
}

    // THAY THẾ FUNCTION setupEventListeners CŨ BẰNG CÁI NÀY:

setupEventListeners() {
    // Key event handlers với force exit
    this.keyDownHandler = (e) => {
        console.log('🔧 Key pressed:', e.key, e.code);
        
        // FORCE EXIT - ESC key luôn luôn thoát
        if (e.key === 'Escape' || e.code === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            console.log('🚪 ESC pressed - Force exiting...');
            this.forceExitGame();
            return;
        }
        
        // Game controls chỉ khi đang playing
        if (this.gameState?.gamePhase === 'playing' && this.gameState?.status === 'playing') {
            if (e.code === 'Space') {
                e.preventDefault();
                this.flap();
            } else if (e.key >= '1' && e.key <= '4') {
                e.preventDefault();
                this.useItem(parseInt(e.key) - 1);
            }
        }
    };

    this.keyUpHandler = (e) => {
        // Không cần xử lý keyup cho exit
    };

    // Remove existing listeners
    document.removeEventListener('keydown', this.keyDownHandler);
    document.removeEventListener('keyup', this.keyUpHandler);
    
    // Add new listeners
    document.addEventListener('keydown', this.keyDownHandler);
    document.addEventListener('keyup', this.keyUpHandler);
    
    // Touch controls for mobile
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
    
    // Handle window resize
    window.addEventListener('resize', () => {
        this.resizeCanvas();
    });
    
    // THÊM LISTENER CHO WINDOW BLUR (khi user chuyển tab/window)
    window.addEventListener('blur', () => {
        console.log('🔄 Window lost focus - pausing if needed');
    });
    
    console.log('✅ Event listeners set up with force exit capability');
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

forceExitGame() {
    console.log('🚨 FORCE EXITING GAME...');
    
    try {
        // 1. Exit fullscreen mode immediately
        this.exitFullscreenMode();
        
        // 2. Send leave game message if connected
        if (this.ws && this.ws.readyState === WebSocket.OPEN && this.gameId) {
            console.log('📤 Sending leave game message...');
            this.ws.send(JSON.stringify({
                type: 'leaveGame',
                gameId: this.gameId
            }));
        }
        
        // 3. Reset all game state
        this.gameId = null;
        this.playerColor = null;
        this.gameState = null;
        this.playerId = null;
        
        // 4. Force show main menu
        this.showMainMenu();
        
        // 5. Show success message
        this.showSuccess('🚪 Đã thoát game thành công!');
        
        console.log('✅ Force exit completed successfully');
        
    } catch (error) {
        console.error('❌ Error during force exit:', error);
        // Fallback - reload page if all else fails
        if (confirm('Có lỗi khi thoát game. Bạn có muốn reload trang?')) {
            window.location.reload();
        }
    }
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
    
    // ===== COUNTDOWN/PHASE INDICATOR (TOP CENTER) - ĐÃ CHỈNH ĐẸP HỞN =====
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    this.ctx.fillRect(this.canvas.width / 2 - 200, 15, 400, 60);
    
    // Viền đẹp cho countdown box
    this.ctx.strokeStyle = '#FFD700';
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(this.canvas.width / 2 - 200, 15, 400, 60);
    
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = 'bold 24px Arial';
    this.ctx.textAlign = 'center';
    
    // Show countdown timer or game phase
    if (this.gameState.gamePhase === 'countdown') {
        this.ctx.fillStyle = '#FFD700';
        this.ctx.font = 'bold 28px Arial';
        this.ctx.fillText(`🚀 BẮT ĐẦU SAU: ${Math.ceil(this.gameState.gameTimer)}`, this.canvas.width / 2, 50);
    } else {
        this.ctx.fillText(`🎮 Phase: ${this.gameState.gamePhase?.toUpperCase() || 'PLAYING'}`, this.canvas.width / 2, 50);
    }
    
    // ===== PLAYER STATS (TOP LEFT) =====
    const myPlayer = this.getMyPlayer();
    if (myPlayer) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(20, 20, 200, 140);
        
        // Viền cho stats box
        this.ctx.strokeStyle = '#4ECDC4';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(20, 20, 200, 140);
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('📊 Your Stats:', 30, 45);
        this.ctx.font = '14px Arial';
        this.ctx.fillText(`💰 Score: ${myPlayer.score || 0}`, 30, 65);
        this.ctx.fillText(`🏃 Phase: ${myPlayer.phase || 'outbound'}`, 30, 85);
        this.ctx.fillText(`❤️ Lives: ${myPlayer.lives || 3}`, 30, 105);
        
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
            this.ctx.fillText(`🏆 Rank: ${myPlayer.rank}`, 30, 125);
        }
    }
    
    // ===== LEADERBOARD (TOP RIGHT) - DI CHUYỂN XUỐNG DƯỚI NÚT THOÁT =====
    if (this.gameState.leaderboard && this.gameState.leaderboard.length > 0) {
        const boardWidth = 200;
        const boardHeight = Math.min(this.gameState.leaderboard.length * 25 + 50, 200);
        
        // DI CHUYỂN XUỐNG DƯỚI NÚT THOÁT (NÚT THOÁT Ở Y=20, CAO 50PX)
        const leaderboardY = 90; // Thay vì 20, đặt ở 90 để tránh che nút thoát
        
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        this.ctx.fillRect(this.canvas.width - boardWidth - 20, leaderboardY, boardWidth, boardHeight);
        
        // Viền đẹp cho leaderboard
        this.ctx.strokeStyle = '#FF6B6B';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(this.canvas.width - boardWidth - 20, leaderboardY, boardWidth, boardHeight);
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('🏆 Leaderboard', this.canvas.width - boardWidth / 2 - 20, leaderboardY + 25);
        
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'left';
        this.gameState.leaderboard.slice(0, 6).forEach((entry, index) => {
            const y = leaderboardY + 45 + index * 20;
            const isMe = entry.playerId === this.playerId;
            this.ctx.fillStyle = isMe ? '#FFD700' : '#FFFFFF';
            
            // Hiển thị thông tin đầy đủ
            this.ctx.fillText(`${index + 1}. P${entry.playerId.slice(-2)} - ${entry.score || 0}`, 
                             this.canvas.width - boardWidth + 10, y);
        });
    }
    
    // ===== INSTRUCTIONS (BOTTOM CENTER) =====
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    this.ctx.fillRect(this.canvas.width / 2 - 300, this.canvas.height - 80, 600, 60);
    
    // Viền cho instructions
    this.ctx.strokeStyle = '#9B59B6';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(this.canvas.width / 2 - 300, this.canvas.height - 80, 600, 60);
    
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = 'bold 14px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('🎮 SPACE/Click: Flap  |  1-4: Use Items  |  ESC: Exit Fullscreen', this.canvas.width / 2, this.canvas.height - 50);
    
    // ===== RESPAWN MESSAGE (CHỈ KHI ROUND FINISHED) =====
    if (this.gameState.gamePhase === 'finished') {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        this.ctx.fillRect(this.canvas.width / 2 - 200, this.canvas.height / 2 - 50, 400, 100);
        
        // Viền cho respawn message
        this.ctx.strokeStyle = '#E74C3C';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(this.canvas.width / 2 - 200, this.canvas.height / 2 - 50, 400, 100);
        
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
    
    // ===== ĐƯỜNG DẪN CHO 2 PATH - MỜ HƠN ĐỂ KHÔNG CHÓI MẮT =====
    this.ctx.setLineDash([10, 15]);
    this.ctx.lineWidth = 1;
    
    // Đường path trên (mờ hơn)
    this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.3)';
    this.ctx.beginPath();
    this.ctx.moveTo(100, this.config.height * 0.3);
    this.ctx.lineTo(this.config.raceDistance, this.config.height * 0.3);
    this.ctx.stroke();
    
    // Đường path dưới (mờ hơn)
    this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
    this.ctx.beginPath();
    this.ctx.moveTo(100, this.config.height * 0.7);
    this.ctx.lineTo(this.config.raceDistance, this.config.height * 0.7);
    this.ctx.stroke();
    
    this.ctx.setLineDash([]);
}
showRoundResult(data) {
    console.log('📊 Showing round result');
    
    // Hiển thị game setup để có nút sẵn sàng
    const mainMenu = document.getElementById('mainMenu');
    const gameSetup = document.getElementById('gameSetup');
    const gameSection = document.getElementById('gameSection');
    
    if (mainMenu) mainMenu.classList.add('hidden');
    if (gameSetup) gameSetup.classList.remove('hidden');
    if (gameSection) gameSection.classList.remove('hidden');
    
    // Đảm bảo canvas vẫn hiển thị
    this.ensureCanvasVisible();
    
    // Cập nhật title
    const lobbyTitle = document.querySelector('#gameSetup .card-header h4');
    if (lobbyTitle) {
        if (data.winner) {
            lobbyTitle.textContent = `🏆 P${data.winner.slice(-2)} thắng round! Sẵn sàng round mới?`;
        } else {
            lobbyTitle.textContent = '🏁 Round kết thúc! Sẵn sàng round mới?';
        }
    }
    
    // Enable nút sẵn sàng
    const readyBtn = document.getElementById('readyBtn');
    if (readyBtn) {
        readyBtn.disabled = false;
        readyBtn.textContent = '🔄 Sẵn sàng round mới!';
        readyBtn.className = 'btn btn-success btn-lg px-5';
        readyBtn.style.display = 'inline-block';
    }
    
    // Reset ready status
    const readyStatus = document.getElementById('readyStatus');
    if (readyStatus) {
        readyStatus.innerHTML = '<span class="not-ready-status">⏳ Chờ tất cả người chơi sẵn sàng...</span>';
    }
    
    // Hiển thị thông báo
    this.showSuccess(data.winner ? 
        `🏆 Player ${data.winner.slice(-2)} thắng round này!` : 
        '🏁 Round kết thúc! Sẵn sàng cho round mới?');
}
renderPipes() {
    if (!this.gameState.pipes) return;
    
    this.ctx.fillStyle = '#228B22';
    this.ctx.strokeStyle = '#006400';
    this.ctx.lineWidth = 2;
    
    this.gameState.pipes.forEach((pipe) => {
        // ===== VẼ 3 PHẦN ỐNG SẠCH SẼ =====
        
        // 1. Ống trên cùng
        if (pipe.topHeight > 0) {
            this.ctx.fillRect(pipe.x, 0, 60, pipe.topHeight);
            this.ctx.strokeRect(pipe.x, 0, 60, pipe.topHeight);
            
            // Thêm cap cho ống trên
            this.ctx.fillRect(pipe.x - 5, pipe.topHeight - 10, 70, 10);
            this.ctx.strokeRect(pipe.x - 5, pipe.topHeight - 10, 70, 10);
        }
        
        // 2. Ống giữa (giữa 2 khoảng trống)
        if (pipe.middleHeight > 0) {
            this.ctx.fillRect(pipe.x, pipe.middleY, 60, pipe.middleHeight);
            this.ctx.strokeRect(pipe.x, pipe.middleY, 60, pipe.middleHeight);
            
            // Thêm cap trên và dưới cho ống giữa
            this.ctx.fillRect(pipe.x - 5, pipe.middleY - 5, 70, 10);
            this.ctx.strokeRect(pipe.x - 5, pipe.middleY - 5, 70, 10);
            
            this.ctx.fillRect(pipe.x - 5, pipe.middleY + pipe.middleHeight - 5, 70, 10);
            this.ctx.strokeRect(pipe.x - 5, pipe.middleY + pipe.middleHeight - 5, 70, 10);
        }
        
        // 3. Ống dưới cùng
        if (pipe.bottomHeight > 0) {
            this.ctx.fillRect(pipe.x, pipe.bottomY, 60, pipe.bottomHeight);
            this.ctx.strokeRect(pipe.x, pipe.bottomY, 60, pipe.bottomHeight);
            
            // Thêm cap cho ống dưới
            this.ctx.fillRect(pipe.x - 5, pipe.bottomY, 70, 10);
            this.ctx.strokeRect(pipe.x - 5, pipe.bottomY, 70, 10);
        }
        
        // ===== BỎ PHẦN HIỂN THỊ SỐ DEBUG =====
        // Không còn hiển thị số 1, 2 nữa
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

    // ===== THAY THẾ HÀM renderPlayer(player) TRONG assets/js/flappy-race.js =====
renderPlayer(player) {
    const x = player.x;
    const y = player.y;
    const isMe = player.playerId === this.playerId;
    
    this.ctx.save();
    this.ctx.translate(x, y);
    
    // ===== HIỂN THỊ TRẠNG THÁI BẤT TỬ =====
    if (player.invulnerable) {
        // Nhấp nháy effect cho bất tử
        const blinkRate = Math.sin(Date.now() * 0.01) > 0;
        if (!blinkRate) {
            this.ctx.globalAlpha = 0.5;
        }
        
        // Vòng tròn bảo vệ
        this.ctx.strokeStyle = '#00FF00';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 30, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        // Countdown timer
        if (player.invulnerableTime > 0) {
            this.ctx.fillStyle = '#00FF00';
            this.ctx.font = 'bold 10px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`${Math.ceil(player.invulnerableTime)}s`, 0, -35);
        }
    }
    
    // Glow effect cho player của mình
    if (isMe) {
        this.ctx.shadowColor = player.color || '#FFD700';
        this.ctx.shadowBlur = 15;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 0;
    }
    
    // Dead players
    if (!player.alive) {
        this.ctx.globalAlpha = 0.5;
        if (Math.random() < 0.1) {
            this.addParticle(x, y, '#FF0000', 20);
        }
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
    
    // Speed effect trail
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
    
    // Wing animation
    const wingFlap = Math.sin(Date.now() * 0.02 + (player.playerId ? player.playerId.charCodeAt(0) : 0)) * 0.3;
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
    this.ctx.fillStyle = isMe ? '#FFD700' : '#FFF';
    this.ctx.font = isMe ? 'bold 12px Arial' : '12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 2;
    const playerName = isMe ? 'YOU' : `P${player.playerId ? player.playerId.slice(-2) : '??'}`;
    this.ctx.strokeText(playerName, 0, -25);
    this.ctx.fillText(playerName, 0, -25);
    
    // Score
    this.ctx.fillStyle = '#FFD700';
    this.ctx.font = 'bold 10px Arial';
    this.ctx.strokeStyle = '#000';
    this.ctx.lineWidth = 1;
    this.ctx.strokeText(player.score || 0, 0, 35);
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
}

// ===== THÊM HÀM HELPER lightenColor NÁT CHƯA CÓ =====
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
    // KHÔNG CHO PHÉP FLAP TRONG COUNTDOWN
    if (!this.gameId || this.gameState?.status !== 'playing') {
        console.log('Flapping disabled - game not playing. Status:', this.gameState?.status);
        return;
    }
    
    if (this.gameState?.gamePhase === 'countdown') {
        console.log('Flapping disabled - countdown phase');
        return;
    }
    
    if (this.gameState?.gamePhase !== 'playing') {
        console.log('Flapping disabled - not in playing phase. Current phase:', this.gameState?.gamePhase);
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



// showCountdownOverlay(seconds) {
//     console.log('Showing countdown:', seconds);
    
//     // Remove existing overlay
//     const existingOverlay = document.getElementById('countdown-overlay');
//     if (existingOverlay) {
//         existingOverlay.remove();
//     }
    
//     // Create countdown overlay - KHÔNG ĐEN NỀN
//     const overlay = document.createElement('div');
//     overlay.id = 'countdown-overlay';
//     overlay.style.cssText = `
//         position: fixed;
//         top: 0;
//         left: 0;
//         width: 100vw;
//         height: 100vh;
//         background: transparent;
//         display: flex;
//         align-items: center;
//         justify-content: center;
//         z-index: 10000;
//         pointer-events: none;
//     `;
    
//     // Create countdown content with semi-transparent background
//     const content = document.createElement('div');
//     content.style.cssText = `
//         text-align: center;
//         color: #FFD700;
//         font-size: 120px;
//         font-weight: bold;
//         text-shadow: 0 0 20px #FFD700, 0 0 40px #FFD700, 0 0 60px #FFD700;
//         background: rgba(0, 0, 0, 0.3);
//         padding: 40px 60px;
//         border-radius: 20px;
//         border: 3px solid rgba(255, 215, 0, 0.5);
//         backdrop-filter: blur(5px);
//         animation: pulse 0.8s ease-in-out infinite alternate;
//     `;
    
//     content.innerHTML = `
//         <div style="font-size: 150px; margin-bottom: 10px;">${seconds}</div>
//         <div style="font-size: 24px; color: white; margin-bottom: 10px;">🚀 Game bắt đầu sau...</div>
//         <div style="font-size: 16px; color: #CCCCCC;">Nhấn SPACE hoặc click để bay lên</div>
//     `;
    
//     overlay.appendChild(content);
//     document.body.appendChild(overlay);
//         setTimeout(() => {
//         const stillExists = document.getElementById('countdown-overlay');
//         if (stillExists) {
//             console.log('🔧 Fallback: Force hiding countdown after 12s');
//             this.hideCountdownOverlay();
//         }
//     }, 12000);
//     // Add CSS animation if not exists
//     if (!document.querySelector('#countdown-pulse-style')) {
//         const style = document.createElement('style');
//         style.id = 'countdown-pulse-style';
//         style.textContent = `
//             @keyframes pulse {
//                 from { transform: scale(1); }
//                 to { transform: scale(1.05); }
//             }
//         `;
//         document.head.appendChild(style);
//     }
// }
// updateCountdownOverlay(seconds) {
//     console.log('🔄 Updating countdown to:', seconds);
    
//     const overlay = document.getElementById('countdown-overlay');
//     if (overlay) {
//         const content = overlay.querySelector('div');
//         if (content) {
//             content.innerHTML = `
//                 <div style="font-size: 150px; margin-bottom: 10px;">${seconds}</div>
//                 <div style="font-size: 24px; color: white; margin-bottom: 10px;">🚀 Game bắt đầu sau...</div>
//                 <div style="font-size: 16px; color: #CCCCCC;">Nhấn SPACE hoặc click để bay lên</div>
//             `;
            
//             // Nếu countdown = 0 thì ẩn luôn
//             if (seconds <= 0) {
//                 console.log('⏰ Countdown reached 0, hiding overlay');
//                 this.hideCountdownOverlay();
//             }
//         }
//     } else {
//         console.log('⚠️ No overlay found to update, creating new one');
//         this.showCountdownOverlay(seconds);
//     }
// }


// hideCountdownOverlay() {
//     console.log('🎯 Hiding countdown overlay');
    
//     const overlay = document.getElementById('countdown-overlay');
//     if (overlay) {
//         console.log('✅ Found countdown overlay, removing...');
        
//         // Add fade out animation
//         overlay.style.transition = 'opacity 0.5s ease-out';
//         overlay.style.opacity = '0';
        
//         // Remove after animation
//         setTimeout(() => {
//             if (overlay && overlay.parentNode) {
//                 overlay.remove();
//                 console.log('✅ Countdown overlay removed');
//             }
//         }, 500);
//     } else {
//         console.log('⚠️ No countdown overlay found to hide');
//     }
// }








ensureLobbyVisible() {
    console.log('📋 Ensuring lobby is visible...');
    
    const gameSetup = document.getElementById('gameSetup');
    const gameSection = document.getElementById('gameSection');
    
    // Hiển thị lobby
    if (gameSetup) {
        gameSetup.style.display = 'block';
        gameSetup.classList.remove('hidden');
    }
    
    // Hiển thị game section cho canvas và UI
    if (gameSection) {
        gameSection.style.display = 'block';
        gameSection.classList.remove('hidden');
    }
    
    // Hiển thị lobby elements
    this.showLobbyElements();
    
    console.log('✅ Lobby visibility ensured');
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
    console.log('🆕 Creating new game...');
    
    // Đảm bảo canvas hiển thị trước khi tạo game
    this.ensureCanvasVisible();
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
            type: 'createGame',
            gameType: 'flappy-race'
        }));
    } else {
        this.showError('❌ Chưa kết nối tới server!');
    }
}

joinGame() {
    const gameIdInput = document.getElementById('joinGameId');
    const gameId = gameIdInput ? gameIdInput.value.trim() : '';
    
    if (!gameId) {
        this.showError('❌ Vui lòng nhập mã phòng!');
        return;
    }
    
    console.log('🚪 Joining game:', gameId);
    
    // Đảm bảo canvas hiển thị trước khi join
    this.ensureCanvasVisible();
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
            type: 'joinGame',
            gameId: gameId
        }));
    } else {
        this.showError('❌ Chưa kết nối tới server!');
    }
}
initializeUI() {
    console.log('🔧 Initializing UI...');
    
    // Đảm bảo canvas hiển thị ngay từ đầu
    this.ensureCanvasVisible();
    
    // Set up event listeners
    this.setupEventListeners();
    
    console.log('✅ UI initialized');
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
    console.log('🎯 Player ready clicked');
    
    if (!this.gameId) {
        this.showError('Chưa vào phòng');
        return;
    }

    // Gửi message ready lên server
    this.ws.send(JSON.stringify({
        type: 'ready',
        gameId: this.gameId
    }));

    // Cập nhật UI ngay lập tức (optimistic update)
    const readyBtn = document.getElementById('readyBtn');
    const readyStatus = document.getElementById('readyStatus');
    
    if (readyBtn) {
        readyBtn.disabled = true;
        readyBtn.textContent = '✅ Đã sẵn sàng';
        readyBtn.className = 'btn btn-secondary btn-lg px-5';
    }
    
    if (readyStatus) {
        readyStatus.innerHTML = '<span class="ready-status">✅ Bạn đã sẵn sàng - Chờ người khác...</span>';
    }

    this.showSuccess('✅ Đã báo sẵn sàng!');
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
    console.log('🚪 Leave game button clicked');
    
    // KIỂM TRA XEM CÓ ĐANG TRONG GAME KHÔNG
    if (!this.gameId) {
        console.log('⚠️ No active game to leave');
        this.showError('❌ Bạn chưa tham gia phòng nào!');
        
        // Đảm bảo canvas vẫn hiển thị đúng
        this.ensureCanvasVisible();
        return;
    }

    console.log('🚪 Leaving game:', this.gameId);

    // 1. Gửi message rời phòng lên server
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        console.log('📤 Sending leave game message to server...');
        this.ws.send(JSON.stringify({
            type: 'leaveGame',
            gameId: this.gameId
        }));
    }

    // 2. Reset toàn bộ trạng thái game
    this.resetGameState();

    // 3. Hiển thị main menu với canvas
    this.showMainMenuWithCanvas();

    // 4. Hiển thị thông báo
    this.showSuccess('🚪 Đã rời phòng thành công!');
}


resetGameState() {
    console.log('🔄 Resetting game state...');
    
    // Reset tất cả biến trạng thái NHƯNG GIỮ playerID cho connection
    this.gameId = null;
    this.playerColor = null;
    this.gameState = null;
    // KHÔNG reset this.playerId vì cần cho connection
    this.isHost = false;
    this.isSpectator = false;
    this.eventListenersActive = false;
    
    // Reset canvas camera
    if (this.camera) {
        this.camera.x = 0;
        this.camera.y = 0;
    }
    
    // Reset ready button
    this.resetReadyButton();
    
    // Đảm bảo thoát fullscreen
    this.exitFullscreenMode();
    
    console.log('✅ Game state reset completed');
}


showMainMenuWithCanvas() {
    console.log('🏠 Showing main menu with canvas...');
    
    // Hiển thị main menu
    const mainMenu = document.getElementById('mainMenu');
    const gameSetup = document.getElementById('gameSetup');
    const gameSection = document.getElementById('gameSection');
    
    // Force hiển thị main menu
    if (mainMenu) {
        mainMenu.style.display = 'block';
        mainMenu.classList.remove('hidden');
    }
    
    // ẨN game setup (lobby)
    if (gameSetup) {
        gameSetup.style.display = 'none';
        gameSetup.classList.add('hidden');
    }
    
    // HIỂN THỊ gameSection để có canvas, nhưng ẩn HUD
    if (gameSection) {
        gameSection.style.display = 'block';
        gameSection.classList.remove('hidden');
        
        // Ẩn game HUD nhưng giữ canvas
        this.hideGameHUDOnly();
    }
    
    // Đảm bảo canvas được hiển thị và reset
    this.ensureCanvasVisible();
    
    // Clear game-specific UI elements
    this.clearGameUI();
}
hideGameHUDOnly() {
    console.log('👁️ Hiding only game HUD elements, keeping lobby...');
    
    // Chỉ ẩn các phần UI của game, KHÔNG ẩn lobby
    const gameHudElements = [
        '.game-header',     // Header game khi đang chơi
        '.game-hud'         // HUD game khi đang chơi
    ];
    
    gameHudElements.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
            element.style.display = 'none';
        }
    });
    
    // Đảm bảo canvas container vẫn hiển thị
    const canvasContainer = document.querySelector('.flappy-canvas-container');
    if (canvasContainer) {
        canvasContainer.style.display = 'block';
        canvasContainer.style.visibility = 'visible';
    }
}
hideGameUIElements() {
    console.log('👁️ Hiding game UI elements while keeping canvas...');
    
    // Ẩn các phần UI game nhưng giữ canvas
    const elementsToHide = [
        '.game-header',
        '.game-hud',
        '#gameControls',
        '.game-status-section'
    ];
    
    elementsToHide.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
            element.style.display = 'none';
        }
    });
    
    // Đảm bảo canvas container vẫn hiển thị
    const canvasContainer = document.querySelector('.flappy-canvas-container');
    if (canvasContainer) {
        canvasContainer.style.display = 'block';
    }
}
ensureCanvasVisible() {
    console.log('🖼️ Ensuring canvas is visible...');
    
    // Đảm bảo gameSection được hiển thị
    const gameSection = document.getElementById('gameSection');
    if (gameSection) {
        gameSection.style.display = 'block';
        gameSection.classList.remove('hidden');
    }
    
    // Đảm bảo canvas container được hiển thị
    const canvasContainer = document.querySelector('.flappy-canvas-container');
    if (canvasContainer) {
        canvasContainer.style.display = 'block';
        canvasContainer.style.visibility = 'visible';
    }
    
    if (this.canvas) {
        // Reset canvas styles
        this.canvas.style.display = 'block';
        this.canvas.style.visibility = 'visible';
        this.canvas.style.position = 'relative';
        this.canvas.style.top = 'auto';
        this.canvas.style.left = 'auto';
        this.canvas.style.zIndex = 'auto';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '400px';
        this.canvas.style.maxWidth = '800px';
        this.canvas.style.cursor = 'default';
        
        // Resize canvas
        this.resizeCanvas();
        
        // Clear canvas và vẽ lại background trống
        if (this.ctx) {
            this.ctx.fillStyle = '#87CEEB';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Vẽ text chờ game
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = 'bold 24px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('🎮 Chọn chế độ chơi ở trên', this.canvas.width / 2, this.canvas.height / 2);
        }
    }
    
    console.log('✅ Canvas visibility ensured');
}

clearGameUI() {
    console.log('🧹 Clearing game UI elements...');
    
    // Clear leaderboard DATA, không ẩn element
    const leaderboard = document.getElementById('leaderboard');
    if (leaderboard) {
        leaderboard.innerHTML = '<div class="text-muted small">Chưa có dữ liệu xếp hạng</div>';
    }
    
    // Clear players list DATA, không ẩn element  
    const playersList = document.getElementById('playersList');
    if (playersList) {
        playersList.innerHTML = '';
    }
    
    // Clear inventory DATA, không ẩn element
    const inventory = document.getElementById('playerInventory');
    if (inventory) {
        inventory.innerHTML = '<div class="text-muted small">Không có items</div>';
    }
    
    // Reset game info displays
    const gameId = document.getElementById('currentGameId');
    if (gameId) gameId.textContent = '-';
    
    const setupGameId = document.getElementById('setupGameId');
    if (setupGameId) setupGameId.textContent = '-';
    
    const gameStatus = document.getElementById('gameStatus');
    if (gameStatus) gameStatus.textContent = 'Chưa vào phòng';
    
    // Clear any countdown overlays
    const countdownOverlay = document.querySelector('.countdown-overlay');
    if (countdownOverlay) {
        countdownOverlay.remove();
    }
    
    console.log('✅ Game UI data cleared');
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
    console.log('🎮 Showing game setup section (lobby)...');
    
    const mainMenu = document.getElementById('mainMenu');
    const gameSetup = document.getElementById('gameSetup');
    const gameSection = document.getElementById('gameSection');
    
    // Ẩn main menu
    if (mainMenu) {
        mainMenu.style.display = 'none';
        mainMenu.classList.add('hidden');
    }
    
    // HIỂN THỊ game setup (lobby)
    if (gameSetup) {
        gameSetup.style.display = 'block';
        gameSetup.classList.remove('hidden');
    }
    
    // HIỂN THỊ game section cho canvas
    if (gameSection) {
        gameSection.style.display = 'block';
        gameSection.classList.remove('hidden');
        
        // Hiển thị các phần cần thiết của game section
        this.showLobbyElements();
    }
    
    // Cập nhật game ID displays
    if (this.gameId) {
        const setupGameId = document.getElementById('setupGameId');
        const currentGameId = document.getElementById('currentGameId');
        
        if (setupGameId) setupGameId.textContent = this.gameId;
        if (currentGameId) currentGameId.textContent = this.gameId;
    }
    
    // Đảm bảo canvas hiển thị với trạng thái chờ
    this.ensureCanvasVisible();
    
    console.log('✅ Game setup section (lobby) displayed');
}
showLobbyElements() {
    console.log('📋 Showing lobby elements...');
    
    // Hiển thị canvas container
    const canvasContainer = document.querySelector('.flappy-canvas-container');
    if (canvasContainer) {
        canvasContainer.style.display = 'block';
        canvasContainer.style.visibility = 'visible';
    }
    
    // Hiển thị các sidebar elements cần thiết cho lobby
    const lobbyElements = [
        '#leaderboard',
        '.leaderboard-mini',
        '#playerInventory', 
        '.inventory-display'
    ];
    
    lobbyElements.forEach(selector => {
        const element = document.querySelector(selector);
        if (element && element.closest('.card')) {
            element.closest('.card').style.display = 'block';
        }
    });
    
    // Ẩn game HUD elements
    const gameElements = [
        '.game-header',
        '.game-hud'
    ];
    
    gameElements.forEach(selector => {
        const element = document.querySelector(selector);
        if (element) {
            element.style.display = 'none';
        }
    });
}
updateUI() {
    if (!this.gameState) {
        console.log('⚠️ No game state to update UI');
        return;
    }

    console.log('🔄 Updating UI, status:', this.gameState.status, 'phase:', this.gameState.gamePhase);

    // Update game info
    this.updateGameInfo();
    
    // LUÔN update players list và leaderboard
    this.updatePlayersList();
    
    if (this.gameState.leaderboard) {
        this.updateLeaderboard();
    }
    
    this.updatePlayerInventory();
    this.updatePlayerStatus();

    // Handle game states
    switch (this.gameState.status) {
        case 'setup':
            this.showGameSetupSection();
            break;
        case 'playing':
            if (this.gameState.gamePhase === 'countdown' || this.gameState.gamePhase === 'playing') {
                // Nếu chưa trong fullscreen thì vào fullscreen
                if (!document.body.classList.contains('game-playing')) {
                    this.showGamePlaying();
                }
            } else if (this.gameState.gamePhase === 'finished') {
                // Round finished - exit fullscreen to show ready UI
                if (document.body.classList.contains('game-playing')) {
                    this.exitFullscreenMode();
                    this.showRoundResult({
                        winner: this.gameState.leaderboard?.[0]?.playerId,
                        leaderboard: this.gameState.leaderboard
                    });
                }
            }
            break;
        case 'finished':
            this.showGameResult();
            break;
    }
}

// THAY THẾ FUNCTION showGamePlaying BẰNG CÁI NÀY:

showGamePlaying() {
    console.log('🎮 Showing game playing mode - new round');
    
    const mainMenu = document.getElementById('mainMenu');
    const gameSetup = document.getElementById('gameSetup');
    const gameSection = document.getElementById('gameSection');
    
    if (mainMenu) mainMenu.classList.add('hidden');
    if (gameSetup) gameSetup.classList.add('hidden');
    if (gameSection) gameSection.classList.remove('hidden');
    
    // Vào fullscreen cho round mới
    setTimeout(() => {
        this.enterFullscreenMode();
        this.resizeCanvas();
    }, 200);
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

exitFullscreenMode() {
    console.log('🚪 Exiting fullscreen mode...');
    
    try {
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
            this.canvas.style.cursor = 'default';
        }
        
        // Force show appropriate section
        const mainMenu = document.getElementById('mainMenu');
        const gameSetup = document.getElementById('gameSetup');
        const gameSection = document.getElementById('gameSection');
        
        if (mainMenu) mainMenu.style.display = 'block';
        if (gameSetup) gameSetup.classList.add('hidden');
        if (gameSection) gameSection.classList.add('hidden');
        
        // Resize canvas back to normal
        setTimeout(() => {
            this.resizeCanvas();
        }, 100);
        
        console.log('✅ Fullscreen mode exited successfully');
        
    } catch (error) {
        console.error('❌ Error exiting fullscreen:', error);
    }
}

   addExitFullscreenButton() {
    // Remove existing button
    const existingBtn = document.querySelector('.exit-fullscreen-btn');
    if (existingBtn) {
        existingBtn.remove();
    }
    
    // Create exit button với multiple exit methods
    const exitBtn = document.createElement('button');
    exitBtn.className = 'exit-fullscreen-btn';
    exitBtn.innerHTML = '❌ ESC: Thoát';
    exitBtn.style.cssText = `
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        z-index: 99999 !important;
        background: rgba(231, 76, 60, 0.95) !important;
        color: white !important;
        border: 2px solid #fff !important;
        padding: 12px 20px !important;
        border-radius: 30px !important;
        cursor: pointer !important;
        font-weight: bold !important;
        font-size: 14px !important;
        backdrop-filter: blur(10px) !important;
        box-shadow: 0 4px 20px rgba(231, 76, 60, 0.4) !important;
        transition: all 0.3s ease !important;
        font-family: Arial, sans-serif !important;
        pointer-events: all !important;
    `;
    
    // MULTIPLE EXIT METHODS
    exitBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('🖱️ Exit button clicked');
        this.forceExitGame();
    };
    
    exitBtn.onmousedown = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };
    
    exitBtn.ontouchstart = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('👆 Exit button touched');
        this.forceExitGame();
    };
    
    // Double-click for emergency exit
    exitBtn.ondblclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('🚨 Double-click emergency exit');
        this.forceExitGame();
    };
    
    exitBtn.onmouseover = () => {
        exitBtn.style.background = 'rgba(231, 76, 60, 1) !important';
        exitBtn.style.transform = 'scale(1.05) !important';
        exitBtn.innerHTML = '🚨 CLICK: Thoát';
    };
    
    exitBtn.onmouseout = () => {
        exitBtn.style.background = 'rgba(231, 76, 60, 0.95) !important';
        exitBtn.style.transform = 'scale(1) !important';
        exitBtn.innerHTML = '❌ ESC: Thoát';
    };
    
    document.body.appendChild(exitBtn);
    
    console.log('✅ Exit button added with multiple exit methods');
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
    console.log('🔄 Resetting ready button for new round');
    
    const readyBtn = document.getElementById('readyBtn');
    const readyStatus = document.getElementById('readyStatus');
    
    if (readyBtn) {
        readyBtn.disabled = false;
        readyBtn.textContent = '✅ Sẵn sàng chiến đấu!';
        readyBtn.className = 'btn btn-success btn-lg px-5';
    }
    
    if (readyStatus) {
        readyStatus.innerHTML = '<span class="not-ready-status">⏳ Chưa sẵn sàng</span>';
    }
    
    // Reset lobby title về bình thường
    const lobbyTitle = document.querySelector('#gameSetup .card-header h4');
    if (lobbyTitle) {
        lobbyTitle.textContent = '🎮 Lobby Game';
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
    if (!playersListEl) {
        console.log('❌ Players list element not found');
        return;
    }
    
    console.log('🔄 Updating players list');
    
    // Sử dụng players hoặc playerStates
    const playersData = this.gameState.players || this.gameState.playerStates || [];
    console.log('Players data:', playersData);
    
    if (playersData.length === 0) {
        playersListEl.innerHTML = '<div class="text-muted small">Chưa có người chơi</div>';
        return;
    }
    
    playersListEl.innerHTML = '';
    
    playersData.forEach((player, index) => {
        const playerItem = document.createElement('div');
        playerItem.className = 'player-item d-flex justify-content-between align-items-center p-2 mb-2 rounded';
        
        const isMe = player.playerId === this.playerId;
        const isReady = this.gameState.playersReady && this.gameState.playersReady[player.playerId];
        
        // Màu nền khác nhau cho player đã ready
        if (isReady) {
            playerItem.style.background = 'rgba(40, 167, 69, 0.2)';
        } else {
            playerItem.style.background = 'rgba(108, 117, 125, 0.2)';
        }
        
        if (isMe) {
            playerItem.style.border = '2px solid #007bff';
        }
        
        // Hiển thị tên và score nếu có
        const playerName = isMe ? '👤 Bạn' : `🎮 Player ${index + 1}`;
        const playerScore = player.score ? ` (${player.score} điểm)` : '';
        
        playerItem.innerHTML = `
            <div class="player-info">
                <div class="player-name">
                    ${playerName}${playerScore}
                </div>
                <small class="text-muted">ID: ${player.playerId.slice(-4)}</small>
            </div>
            <div class="player-status">
                ${isReady ? 
                    '<span class="badge bg-success">✅ Sẵn sàng</span>' : 
                    '<span class="badge bg-secondary">⏳ Chờ...</span>'
                }
            </div>
        `;
        
        playersListEl.appendChild(playerItem);
    });
    
    console.log(`✅ Updated players list with ${playersData.length} players`);
}

updateLeaderboard() {
    const leaderboardEl = document.getElementById('leaderboard');
    if (!leaderboardEl) {
        console.log('❌ Leaderboard element not found with ID: leaderboard');
        return;
    }
    
    // Fallback: Tạo leaderboard từ playerStates nếu không có leaderboard data
    let leaderboardData = this.gameState.leaderboard;
    if (!leaderboardData && this.gameState.playerStates) {
        console.log('📊 Creating leaderboard from playerStates');
        leaderboardData = this.gameState.playerStates
            .filter(p => p.alive || p.phase === 'finished')
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .map(p => ({ playerId: p.playerId, score: p.score || 0 }));
    }
    
    if (!leaderboardData || leaderboardData.length === 0) {
        leaderboardEl.innerHTML = '<div class="text-muted small">Chưa có dữ liệu xếp hạng</div>';
        return;
    }
    
    console.log('📊 Updating leaderboard with', leaderboardData.length, 'entries');
    
    leaderboardEl.innerHTML = '';
    
    leaderboardData.forEach((entry, index) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        
        if (entry.playerId === this.playerId) {
            item.classList.add('me');
        }
        
        // ===== DÒNG ĐÃ SỬA - HIỂN THỊ ĐẦY ĐỦ THÔNG TIN =====
        item.innerHTML = `
            <span>${index + 1}. P${entry.playerId.slice(-2)}</span>
            <span>${entry.score || 0}</span>
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
    console.log('🔄 Updating ready status:', playersReady);
    
    const readyCount = Object.keys(playersReady || {}).length;
    const totalPlayers = this.gameState?.players?.length || 0;
    
    const statusEl = document.getElementById('readyStatus');
    if (statusEl) {
        if (readyCount === 0) {
            statusEl.innerHTML = '<span class="not-ready-status">⏳ Chờ người chơi sẵn sàng...</span>';
        } else if (readyCount < totalPlayers) {
            statusEl.innerHTML = `<span class="ready-status">⏳ ${readyCount}/${totalPlayers} người chơi sẵn sàng cho round mới...</span>`;
        } else {
            statusEl.innerHTML = '<span class="ready-status">🎮 Tất cả đã sẵn sàng! Bắt đầu round mới...</span>';
        }
    }
    
    // Cập nhật nút ready của bản thân
    const readyBtn = document.getElementById('readyBtn');
    if (readyBtn && this.playerId && playersReady[this.playerId]) {
        readyBtn.disabled = true;
        readyBtn.textContent = '✅ Đã sẵn sàng';
        readyBtn.className = 'btn btn-secondary btn-lg px-5';
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
    // if (!gameId.includes('flappy-race_')) {
    //     if (confirm('🤔 Mã phòng có vẻ không đúng định dạng. Bạn có chắc muốn tiếp tục?')) {
    //         // Continue
    //     } else {
    //         return;
    //     }
    // }
    
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
    // if (!gameId.includes('flappy-race') && !gameId.includes('6430')) {
    //     if (!confirm('🤔 Mã phòng có vẻ không đúng định dạng. Bạn có chắc muốn tiếp tục?')) {
    //         return;
    //     }
    // }
    
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
window.debugExitIssue = () => {
    console.log('=== EXIT DEBUG INFO ===');
    console.log('Game instance:', window.flappyGame);
    console.log('Game state:', window.flappyGame?.gameState);
    console.log('Body classes:', document.body.className);
    console.log('Exit button:', document.querySelector('.exit-fullscreen-btn'));
    console.log('Event listeners active:', window.flappyGame?.eventListenersActive);
};
window.emergencyExitGame = () => {
    console.log('🚨 EMERGENCY EXIT FROM CONSOLE');
    if (window.flappyGame) {
        window.flappyGame.forceExitGame();
    } else {
        document.body.classList.remove('game-playing');
        document.body.style.overflow = 'auto';
        window.location.reload();
    }
};
window.debugReadyState = () => {
    console.log('=== READY STATE DEBUG ===');
    console.log('Game ID:', window.flappyGame?.gameId);
    console.log('Player ID:', window.flappyGame?.playerId);
    console.log('Game State:', window.flappyGame?.gameState);
    console.log('Players Ready:', window.flappyGame?.gameState?.playersReady);
    console.log('Players List:', window.flappyGame?.gameState?.players);
    
    const readyBtn = document.getElementById('readyBtn');
    const readyStatus = document.getElementById('readyStatus');
    const playersList = document.getElementById('playersList');
    
    console.log('Ready Button:', readyBtn ? { disabled: readyBtn.disabled, text: readyBtn.textContent } : 'Not found');
    console.log('Ready Status:', readyStatus ? readyStatus.innerHTML : 'Not found');
    console.log('Players List HTML:', playersList ? playersList.innerHTML : 'Not found');
};

window.debugLeaveRoom = () => {
    console.log('=== LEAVE ROOM DEBUG ===');
    console.log('Game ID:', window.flappyGame?.gameId);
    console.log('Player ID:', window.flappyGame?.playerId);
    console.log('Game State:', window.flappyGame?.gameState);
    console.log('Canvas visible:', window.flappyGame?.canvas?.style.display);
    console.log('Main menu display:', document.getElementById('mainMenu')?.style.display);
    console.log('Game setup display:', document.getElementById('gameSetup')?.style.display);
    console.log('Game section display:', document.getElementById('gameSection')?.style.display);
};

window.forceShowCanvas = () => {
    console.log('🔧 Force showing canvas...');
    if (window.flappyGame) {
        window.flappyGame.ensureCanvasVisible();
        window.flappyGame.showMainMenuWithCanvas();
    }
};
window.debugGameState = () => {
    console.log('=== GAME STATE DEBUG ===');
    console.log('Has Game ID:', window.flappyGame?.hasActiveGame());
    console.log('Is In Game:', window.flappyGame?.isInGame());
    console.log('Game ID:', window.flappyGame?.gameId);
    console.log('Game State:', window.flappyGame?.gameState);
    console.log('Canvas Display:', window.flappyGame?.canvas?.style.display);
    console.log('GameSection Display:', document.getElementById('gameSection')?.style.display);
    console.log('MainMenu Display:', document.getElementById('mainMenu')?.style.display);
};

window.forceFixCanvas = () => {
    console.log('🔧 Force fixing canvas...');
    if (window.flappyGame) {
        window.flappyGame.ensureCanvasVisible();
        window.flappyGame.showMainMenuWithCanvas();
        console.log('✅ Canvas force fixed');
    }
};

window.resetToMainMenu = () => {
    console.log('🔄 Resetting to main menu...');
    if (window.flappyGame) {
        window.flappyGame.resetGameState();
        window.flappyGame.showMainMenuWithCanvas();
        console.log('✅ Reset to main menu completed');
    }
};
window.debugLobbyDisplay = () => {
    console.log('=== LOBBY DISPLAY DEBUG ===');
    console.log('Game ID:', window.flappyGame?.gameId);
    console.log('Is Host:', window.flappyGame?.isHost);
    console.log('MainMenu display:', document.getElementById('mainMenu')?.style.display);
    console.log('GameSetup display:', document.getElementById('gameSetup')?.style.display);
    console.log('GameSection display:', document.getElementById('gameSection')?.style.display);
    console.log('Canvas display:', window.flappyGame?.canvas?.style.display);
    
    const lobbyElements = ['#playersList', '#leaderboard', '#currentGameId', '#setupGameId'];
    lobbyElements.forEach(selector => {
        const el = document.querySelector(selector);
        console.log(`${selector}:`, el ? 'exists' : 'missing', el?.style.display);
    });
};

window.forceShowLobby = () => {
    console.log('🔧 Force showing lobby...');
    if (window.flappyGame) {
        window.flappyGame.ensureLobbyVisible();
        window.flappyGame.updateGameInfo();
        console.log('✅ Lobby force shown');
    }
};

console.log('🔧 Lobby display fixes loaded!');
console.log('💡 Debug commands:');
console.log('- debugLobbyDisplay() - Check lobby display state');
console.log('- forceShowLobby() - Force show lobby elements');
console.log('🔧 Leave room safety fixes loaded!');
console.log('💡 Debug commands:');
console.log('- debugGameState() - Check current state');
console.log('- forceFixCanvas() - Force fix canvas display');
console.log('- resetToMainMenu() - Reset to main menu safely');
console.log('🔧 Exit game fixes loaded!');
console.log('💡 If stuck, run: emergencyExitGame() in console');
console.log('🔍 Debug with: debugExitIssue()');
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