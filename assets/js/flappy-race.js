
// DEBUG: Test WebSocket connection
window.testConnection = function () {
    const ws = new WebSocket('ws://127.0.0.1:8080');
    ws.onopen = () => console.log('✅ Connection test OK');
    ws.onerror = (e) => console.error('❌ Connection test failed:', e);
    ws.onmessage = (e) => console.log('📨 Test message:', e.data);

    setTimeout(() => {
        ws.send(JSON.stringify({ type: 'test', message: 'hello' }));
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
        this.isRespawning = false;
        this.deathTime = null;
        this.shouldStayInFullscreen = false;
        this.addFullscreenEventListeners();
        this.init();


        setTimeout(() => {
            this.initializeUI();
        }, 100);
    
    // Thêm styles vào document head

    
    
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



    handleQuickJoinGameList(games) {
        console.log('🎯 Processing game list for quick join:', games);

        if (!games || games.length === 0) {
            this.onQuickJoinFailed('😔 Không có phòng nào đang hoạt động. Hãy tạo phòng mới!');
            return;
        }

        // Lọc các game flappy-race đang chờ người chơi
        const availableFlappyGames = games.filter(game => {
            return game.gameType === 'flappy-race' &&
                game.status !== 'finished' &&
                game.playerCount < game.maxPlayers;
        });

        console.log('🎮 Available Flappy Race games:', availableFlappyGames);

        if (availableFlappyGames.length === 0) {
            // Có game nhưng không phải flappy-race hoặc đã đầy
            const flappyGames = games.filter(g => g.gameType === 'flappy-race');
            if (flappyGames.length > 0) {
                this.onQuickJoinFailed('😔 Các phòng Flappy Race đều đã đầy. Hãy tạo phòng mới!');
            } else {
                this.onQuickJoinFailed('😔 Không có phòng Flappy Race nào. Hãy tạo phòng mới!');
            }
            return;
        }

        // Chọn game ngẫu nhiên từ danh sách available
        const randomGame = availableFlappyGames[Math.floor(Math.random() * availableFlappyGames.length)];

        console.log('🎯 Selected random game:', randomGame);

        this.showInfo(`🎲 Đang vào phòng ${randomGame.gameId} (${randomGame.playerCount}/${randomGame.maxPlayers} người)...`);

        // Gửi join request
        this.ws.send(JSON.stringify({
            type: 'joinGame',
            gameId: randomGame.gameId,
            gameType: 'flappy-race'
        }));
    }


    debugListGames() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log('❌ WebSocket not connected');
            return;
        }

        console.log('🔍 Requesting games list for debugging...');
        this.ws.send(JSON.stringify({
            type: 'listGames'
        }));
    }
    onQuickJoinSuccess(gameId) {
        console.log('✅ Quick join successful to room:', gameId);

        this.isQuickJoinInProgress = false;

        if (this.quickJoinTimeout) {
            clearTimeout(this.quickJoinTimeout);
            this.quickJoinTimeout = null;
        }

        // Reset button
        const quickJoinBtn = document.querySelector('button[onclick="showQuickJoin()"]');
        if (quickJoinBtn && this.originalQuickJoinText) {
            quickJoinBtn.innerHTML = this.originalQuickJoinText;
            quickJoinBtn.disabled = false;
        }

        this.showSuccess(`🎉 Đã tham gia phòng ${gameId} thành công!`);
    }
    onQuickJoinFailed(message) {
        console.log('❌ Quick join failed:', message);

        this.isQuickJoinInProgress = false;

        if (this.quickJoinTimeout) {
            clearTimeout(this.quickJoinTimeout);
            this.quickJoinTimeout = null;
        }

        // Reset button
        const quickJoinBtn = document.querySelector('button[onclick="showQuickJoin()"]');
        if (quickJoinBtn && this.originalQuickJoinText) {
            quickJoinBtn.innerHTML = this.originalQuickJoinText;
            quickJoinBtn.disabled = false;
        }

        this.showError(message);
    }












    showQuickJoinFallback() {
        console.log('🎲 Quick join fallback - creating new game');

        // Nếu không tìm được phòng, tự động tạo phòng mới
        const originalDifficulty = document.getElementById('difficulty')?.value || 'normal';
        const originalPlayerCount = document.getElementById('playerCount')?.value || '4';

        // Set random settings
        if (document.getElementById('difficulty')) {
            const difficulties = ['easy', 'normal', 'hard'];
            document.getElementById('difficulty').value = difficulties[Math.floor(Math.random() * difficulties.length)];
        }

        if (document.getElementById('playerCount')) {
            document.getElementById('playerCount').value = Math.floor(Math.random() * 7) + 2; // 2-8 players
        }

        // Create game with random settings
        this.createGame();

        this.showInfo('🎲 Đã tạo phòng ngẫu nhiên cho bạn!');
    }
    resizeCanvasFullscreenImmediate() {
    if (!this.canvas || !this.ctx) return;
    
    console.log('📏 Resizing canvas for fullscreen immediately');
    
    const fullscreenWidth = window.innerWidth;
    const fullscreenHeight = window.innerHeight;
    
    // Set canvas size
    this.canvas.width = fullscreenWidth;
    this.canvas.height = fullscreenHeight;
    
    // Set canvas styles
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = fullscreenWidth + 'px';
    this.canvas.style.height = fullscreenHeight + 'px';
    this.canvas.style.zIndex = '1000';
    this.canvas.style.backgroundColor = '#87CEEB';
    
    // Calculate scale factor
    this.scale = Math.min(
        fullscreenWidth / this.config.width,
        fullscreenHeight / this.config.height
    );
    
    // Center the game viewport
    const gameWidth = this.config.width * this.scale;
    const gameHeight = this.config.height * this.scale;
    const offsetX = (fullscreenWidth - gameWidth) / 2;
    const offsetY = (fullscreenHeight - gameHeight) / 2;
    
    // Store offset for rendering
    this.fullscreenOffset = { x: offsetX, y: offsetY };
    
    console.log(`✅ Canvas resized immediately: ${fullscreenWidth}x${fullscreenHeight}, scale: ${this.scale}`);
    
    // Force immediate render if we have game state
    if (this.gameState) {
        this.render();
    }
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

                // Nếu đang quick join và gặp lỗi
                if (this.isQuickJoinInProgress) {
                    this.onQuickJoinFailed('❌ ' + data.message);
                    return;
                }

                // Xử lý error bình thường
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

                // ===== QUAN TRỌNG: Setup event listeners =====
                if (!this.eventListenersActive) {
                    console.log('🔧 Setting up event listeners for new game...');
                    this.setupEventListeners();
                }

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
            case 'playerDied':
                console.log('💀 Player died:', data);

                if (data.playerId === this.playerId) {
                    // Set respawn state
                    this.isRespawning = data.livesLeft > 0;
                    this.deathTime = Date.now();
                    this.shouldStayInFullscreen = data.livesLeft > 0;

                    console.log(`💀 I died! Lives left: ${data.livesLeft}, will respawn: ${this.isRespawning}`);

                    if (data.livesLeft > 0) {
                        console.log('🔄 Will respawn in 1 second, staying in fullscreen');
                    } else {
                        console.log('💀 No lives left, will exit to LOBBY after delay');
                        this.shouldStayInFullscreen = false;
                        setTimeout(() => {
                            // ===== SỬA ĐÂY: Về lobby thay vì exit game =====
                            this.forceExitToLobby();
                        }, 3000);
                    }
                }
                break;

            case 'playerRespawned':
                console.log('🔄 Player respawned:', data);

                if (data.playerId === this.playerId) {
                    console.log('✅ I respawned successfully!');
                    this.isRespawning = false;
                    this.deathTime = null;
                    this.shouldStayInFullscreen = true;

                    // Force stay in fullscreen
                    if (!this.isInFullscreenMode()) {
                        console.log('🔧 Re-entering fullscreen after respawn');
                        setTimeout(() => {
                            this.enterFullscreenMode();
                        }, 100);
                    }
                }
                break;

            case 'playerEliminated':
                console.log('💀 Player eliminated:', data);

                if (data.playerId === this.playerId) {
                    console.log('💀 I was eliminated! Returning to lobby...');
                    this.shouldStayInFullscreen = false;
                    this.isRespawning = false;
                    setTimeout(() => {
                        // ===== VỀ LOBBY THAY VÌ THOÁT GAME =====
                        this.returnToLobby();
                    }, 2000);
                }
                break;


            case 'gameJoined':
                console.log('✅ Game joined successfully:', data);

                // Kiểm tra xem có phải quick join không
                if (this.isQuickJoinInProgress) {
                    this.onQuickJoinSuccess(data.gameId);
                }

                this.gameId = data.gameId;
                this.playerColor = data.playerInfo?.color;
                this.isHost = data.playerInfo?.isHost || false;
                this.isSpectator = data.playerInfo?.isSpectator || false;

                if (data.playerInfo?.gameConfig) {
                    this.config = { ...this.config, ...data.playerInfo.gameConfig };
                }

                // QUAN TRỌNG: Hiển thị lobby/setup section
                this.showGameSetupSection();

                // ===== QUAN TRỌNG: Setup event listeners =====
                if (!this.eventListenersActive) {
                    console.log('🔧 Setting up event listeners for joined game...');
                    this.setupEventListeners();
                }

                // Update game info
                this.updateGameInfo();

                break;

            case 'gameList':
                console.log('📋 Received game list:', data.games);

                // Kiểm tra xem có phải từ quick join request không
                if (this.isQuickJoinInProgress) {
                    this.handleQuickJoinGameList(data.games);
                } else {
                    // Xử lý bình thường nếu user request listGames theo cách khác
                    console.log('Available games:', data.games);
                }
                break;
            // Tìm đoạn code này trong file flappy-race.js, trong function handleMessage():

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

            // ========== THÊM CÁC CASE MỚI VÀO ĐÂY ==========

            case 'availableGames':
                console.log('📋 Available games:', data.games);

                if (data.games && data.games.length > 0) {
                    // Tự động join game đầu tiên có sẵn
                    const availableGame = data.games[0];
                    console.log('🎯 Auto joining game:', availableGame.gameId);

                    this.ws.send(JSON.stringify({
                        type: 'joinGame',
                        gameId: availableGame.gameId,
                        gameType: 'flappy-race'
                    }));

                    this.showInfo(`🎲 Đang vào phòng ngẫu nhiên...`);
                } else {
                    this.showError('😔 Không có phòng trống. Hãy tạo phòng mới!');

                    // Reset button state
                    const quickJoinBtn = document.querySelector('button[onclick="showQuickJoin()"]');
                    if (quickJoinBtn) {
                        quickJoinBtn.innerHTML = '🎲 Tham gia ngẫu nhiên';
                        quickJoinBtn.disabled = false;
                    }
                }
                break;

            case 'noAvailableGames':
                console.log('😔 No available games found');
                this.showError('😔 Không có phòng trống. Hãy tạo phòng mới!');

                // Reset button state
                const quickJoinBtn = document.querySelector('button[onclick="showQuickJoin()"]');
                if (quickJoinBtn) {
                    quickJoinBtn.innerHTML = '🎲 Tham gia ngẫu nhiên';
                    quickJoinBtn.disabled = false;
                }
                break;


            case 'roundFinished':
                console.log('🏁 Round finished:', data);
                this.gameState.gamePhase = 'finished';

                // Exit fullscreen để hiển thị UI
                this.exitFullscreenMode();

                // ===== VỀ LOBBY sau 3 giây =====
                setTimeout(() => {
                    this.returnToLobby();
                    this.showSuccess('🏁 Round kết thúc! Sẵn sàng cho round tiếp theo?');
                }, 3000);
                break;
case 'gameEnded':
    console.log('🏁 Game ended received:', data);
    
    // ===== FORCE EXIT FULLSCREEN NGAY LẬP TỨC =====
    this.forceExitFullscreen();
    
    // ===== RESET GAME STATE =====
    this.isRespawning = false;
    this.deathTime = null;
    this.shouldStayInFullscreen = false;
    
    // ===== HIỂN THỊ THÔNG BÁO CHIẾN THẮNG DỰA TRÊN WINNER =====
    if (data.winner) {
        if (data.winner === this.playerId) {
            // ===== NGƯỜI CHƠI HIỆN TẠI THẮNG =====
            console.log('🏆 Current player WON!');
            
            this.showSuccess('🏆🎉 CHÚC MỪNG! BẠN ĐÃ CHIẾN THẮNG! 🎉🏆');
            
            // Hiệu ứng đặc biệt cho winner
            setTimeout(() => {
                this.showSuccess('🎊🎊🎊 VICTORY ROYALE! BẠN LÀ NGƯỜI CHIẾN THẮNG! 🎊🎊🎊');
            }, 1500);
            
            // Thêm hiệu ứng âm thanh nếu có
            setTimeout(() => {
                this.showInfo('🏆 Bạn đã hoàn thành cuộc đua đầu tiên và giành chiến thắng!');
            }, 3000);
            
        } else {
            // ===== NGƯỜI KHÁC THẮNG =====
            console.log(`🏆 Player ${data.winner.slice(-4)} won!`);
            
            this.showInfo(`🏁 Game kết thúc!`);
            
            setTimeout(() => {
                this.showError(`🏆 Người chiến thắng: ${data.winner.slice(-4)}`);
            }, 1000);
            
            setTimeout(() => {
                this.showInfo('🔄 Thử lại lần sau nhé!');
            }, 2500);
        }
    } else {
        // ===== KHÔNG CÓ WINNER - TẤT CẢ ĐỀU CHẾT =====
        console.log('💀 Game ended - no winner');
        
        this.showError('🏁 Game kết thúc!');
        
        setTimeout(() => {
            this.showInfo('💀 Tất cả người chơi đều đã bị loại!');
        }, 1000);
        
        setTimeout(() => {
            this.showInfo('🔄 Chơi lại lần sau nhé!');
        }, 2500);
    }
    
    // ===== HIỂN THỊ BẢNG XẾP HẠNG NẾU CÓ =====
    if (data.rankings && data.rankings.length > 0) {
        console.log('📊 Final Rankings:', data.rankings);
        
        setTimeout(() => {
            this.showRankings(data.rankings);
        }, 4000); // Delay lâu hơn để user thấy thông báo winner
    }
    
    // ===== TỰ ĐỘNG QUAY VỀ LOBBY SAU DELAY =====
    setTimeout(() => {
        console.log('🔄 Returning to lobby after game end...');
        this.returnToLobby();
    }, 10000); // Tăng delay lên 10 giây để user có đủ thời gian xem kết quả
    
    break;


      case 'newRoundStarted':
    console.log('🔄 New round started - entering game mode');
    
    // ===== QUAN TRỌNG: Setup event listeners cho round mới =====
    if (!this.eventListenersActive) {
        console.log('🔧 Setting up event listeners for new round...');
        this.setupEventListeners();
    }
    
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
    
    // ===== QUAN TRỌNG: Setup event listeners cho round mới =====
    if (!this.eventListenersActive) {
        console.log('🔧 Setting up event listeners for new game...');
        this.setupEventListeners();
    }
    
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
    forceExitFullscreen() {
    console.log('🚨 Force exiting fullscreen...');
    
    // Force exit browser fullscreen
    if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    }
    
    // Force cleanup CSS immediately
    this.cleanupFullscreenCSS();
    
    console.log('✅ Force exit fullscreen completed');
}
toggleFullscreen() {
    if (this.isInFullscreenMode()) {
        this.exitFullscreenMode();
    } else {
        this.enterFullscreenModeImmediate();
    }
}
isInFullscreenMode() {
    const browserFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
    );
    
    const cssFullscreen = document.body.classList.contains('game-playing');
    
    return browserFullscreen || cssFullscreen;
}
setupEventListeners() {
    console.log('🔧 Setting up event listeners...');
    
    // Kiểm tra nếu đã setup rồi
    if (this.eventListenersActive) {
        console.log('⚠️ Event listeners already active, skipping setup');
        return;
    }
    
    // Clear existing listeners
    if (this.keyDownHandler) {
        document.removeEventListener('keydown', this.keyDownHandler);
        console.log('🧹 Removed old keydown listener');
    }
    if (this.keyUpHandler) {
        document.removeEventListener('keyup', this.keyUpHandler);
        console.log('🧹 Removed old keyup listener');
    }
    
    // Key event handlers
    this.keyDownHandler = (e) => {
        console.log('🔧 Key pressed:', e.key, e.code, 'Game phase:', this.gameState?.gamePhase);
        
        // ===== ESC KEY - LUÔN LUÔN THOÁT =====
        if (e.key === 'Escape' || e.code === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            console.log('🚪 ESC pressed - FORCE EXIT');
            this.forceExitGame();
            return;
        }
        
        // ===== SPACE KEY - FLAP =====
        if (e.code === 'Space') {
            e.preventDefault();
            console.log('🐦 Space pressed - attempting flap');
            
            // Kiểm tra điều kiện game
            if (this.gameState?.gamePhase === 'playing' && this.gameState?.status === 'playing') {
                console.log('✅ Flap conditions met - sending flap');
                this.flap();
            } else {
                console.log('❌ Flap conditions not met:', {
                    gamePhase: this.gameState?.gamePhase,
                    gameStatus: this.gameState?.status
                });
            }
            return;
        }
        
        // Game controls chỉ khi đang playing
        if (this.gameState?.gamePhase === 'playing' && this.gameState?.status === 'playing') {
            if (e.key >= '1' && e.key <= '4') {
                e.preventDefault();
                this.useItem(parseInt(e.key));
            }
        }
        
        this.keys[e.code] = true;
    };
    
    this.keyUpHandler = (e) => {
        this.keys[e.code] = false;
    };
    
    // Add listeners
    document.addEventListener('keydown', this.keyDownHandler);
    document.addEventListener('keyup', this.keyUpHandler);
    console.log('✅ Added new event listeners');
    
    // Canvas click handler
    if (this.canvas) {
        this.canvas.onclick = (e) => {
            console.log('🖱️ Canvas clicked - attempting flap');
            if (this.gameState?.gamePhase === 'playing' && this.gameState?.status === 'playing') {
                console.log('✅ Click flap conditions met');
                this.flap();
            } else {
                console.log('❌ Click flap conditions not met:', {
                    gamePhase: this.gameState?.gamePhase,
                    gameStatus: this.gameState?.status
                });
            }
        };
        console.log('✅ Added canvas click listener');
    }
    
    this.eventListenersActive = true;
    console.log('✅ Event listeners setup completed - eventListenersActive = true');
}
    
    



    forceExitGame() {
        console.log('🚪 FORCE EXIT GAME - return to lobby');

        // Reset all blocking flags
        this.shouldStayInFullscreen = false;
        this.isRespawning = false;
        this.deathTime = null;

        // Force exit fullscreen
        this.forceExitFullscreen();

        // KIỂM TRA: Nếu có gameId, về lobby thay vì main menu
        if (this.gameId) {
            console.log('🏠 Returning to lobby, keeping game connection');
            setTimeout(() => {
                this.returnToLobby();
                this.showSuccess('🚪 Đã về lobby!');
            }, 100);
        } else {
            // Chỉ về main menu khi thật sự không có game
            console.log('🏠 No active game, returning to main menu');
            setTimeout(() => {
                this.showMainMenu();
                this.showSuccess('🚪 Đã thoát game!');
            }, 100);
        }
    }
returnToLobby() {
    console.log('🏠 Returning to lobby...');
    
    // Reset game state nhưng GIỮ kết nối phòng
    this.gameState = null;
    
    // ===== RESET EVENT LISTENERS FLAG =====
    this.eventListenersActive = false;
    
    // Hiển thị lobby
    this.showGameSetupSection();
    
    // Reset ready button để có thể ready lại
    this.resetReadyButton();
    
    console.log('✅ Returned to lobby successfully');
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
    forceExitToLobby() {
        console.log('🚪 Force exiting to lobby');

        // Reset flags
        this.shouldStayInFullscreen = false;
        this.isRespawning = false;
        this.deathTime = null;

        // Thoát fullscreen
        this.forceExitFullscreen();

        // Reset game state nhưng GIỮ gameId và connection
        this.gameState = null;
        // KHÔNG reset this.gameId, this.playerColor để còn ở trong phòng

        // Về lobby
        setTimeout(() => {
            this.showGameSetupSection();
            this.showError('💀 Bạn đã bị loại khỏi game!');

            // Reset ready button để có thể ready lại
            this.resetReadyButton();
        }, 500);
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
    isInFullscreenMode() {
        return document.body.classList.contains('game-playing') ||
            document.documentElement.classList.contains('game-playing') ||
            document.fullscreenElement !== null ||
            document.webkitFullscreenElement !== null;
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
    
    // Apply fullscreen offset if in fullscreen mode
    if (this.fullscreenOffset) {
        this.ctx.translate(this.fullscreenOffset.x, this.fullscreenOffset.y);
    }
    
    // Check if we have game state to render
    if (!this.gameState) {
        // Show waiting message
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'center';
        
        const centerX = this.fullscreenOffset ? this.config.width * this.scale / 2 : this.canvas.width / 2;
        const centerY = this.fullscreenOffset ? this.config.height * this.scale / 2 : this.canvas.height / 2;
        
        this.ctx.fillText('Đang chờ game...', centerX, centerY);
        this.ctx.restore();
        return;
    }
    
    // Scale for game rendering
    this.ctx.scale(this.scale || 1, this.scale || 1);
    
    // Apply camera transform
    this.ctx.translate(-this.camera.x, -this.camera.y);
    
    // Render game content
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
    showInfo(message) {
        const statusEl = document.getElementById('gameStatus');
        if (statusEl) {
            statusEl.innerHTML = `<div class="info-message">ℹ️ ${message}</div>`;
            setTimeout(() => {
                if (statusEl.innerHTML.includes(message)) {
                    statusEl.innerHTML = 'Đang chờ...';
                }
            }, 5000);
        } else {
            console.log('Info:', message);
        }
    }


    renderFullscreenUI() {
    if (!this.gameState) return;
    
    this.ctx.save();
    
    // Game phase indicator
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    this.ctx.fillRect(this.canvas.width / 2 - 200, 15, 400, 60);
    this.ctx.strokeStyle = '#FFD700';
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(this.canvas.width / 2 - 200, 15, 400, 60);
    
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = 'bold 24px Arial';
    this.ctx.textAlign = 'center';
    
    if (this.gameState.gamePhase === 'countdown') {
        this.ctx.fillStyle = '#FFD700';
        this.ctx.font = 'bold 28px Arial';
        this.ctx.fillText(`🚀 BẮT ĐẦU SAU: ${Math.ceil(this.gameState.gameTimer)}`, this.canvas.width / 2, 50);
    } else {
        this.ctx.fillText(`🎮 Phase: ${this.gameState.gamePhase?.toUpperCase() || 'PLAYING'}`, this.canvas.width / 2, 50);
    }
    
    // Player stats with better phase indication
    const myPlayer = this.getMyPlayer();
    if (myPlayer) {
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(20, 20, 280, 220);
        this.ctx.strokeStyle = '#4ECDC4';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(20, 20, 280, 220);
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('📊 Your Stats:', 30, 45);
        this.ctx.font = '14px Arial';
        this.ctx.fillText(`💰 Score: ${myPlayer.score || 0}`, 30, 65);
        
        // Phase with icons
        const phaseIcon = myPlayer.phase === 'finished' ? '🏁 HOÀN THÀNH!' :
                         myPlayer.phase === 'return' ? '🔄 ĐANG TRỞ VỀ' : '➡️ ĐANG ĐI';
        this.ctx.fillText(`🏃 Phase: ${phaseIcon}`, 30, 85);
        
        // Lives display
        this.ctx.fillText(`❤️ Mạng:`, 30, 105);
        const lives = myPlayer.lives || 0;
        for (let i = 0; i < 3; i++) {
            if (i < lives) {
                this.ctx.fillStyle = '#FF0000';
                this.ctx.fillText('❤️', 90 + i * 25, 105);
            } else {
                this.ctx.fillStyle = '#666666';
                this.ctx.fillText('🖤', 90 + i * 25, 105);
            }
        }
        
        // Progress bar with phase indication
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '12px Arial';
        this.ctx.fillText('Tiến độ:', 30, 135);
        
        const barWidth = 200;
        const barHeight = 20;
        const barX = 30;
        const barY = 145;
        
        // Background
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);
        
        // Progress fill
        let progress = 0;
        let progressColor = '#4ECDC4';
        
        if (myPlayer.phase === 'finished') {
            progress = 1;
            progressColor = '#FFD700'; // Gold for finished
        } else if (myPlayer.phase === 'return') {
            progress = 0.5 + (0.5 * (this.config.raceDistance - myPlayer.x) / this.config.raceDistance);
            progressColor = '#FF6B6B'; // Red for return
        } else {
            progress = Math.min(0.5, myPlayer.x / this.config.raceDistance);
            progressColor = '#4ECDC4'; // Blue for outbound
        }
        
        this.ctx.fillStyle = progressColor;
        this.ctx.fillRect(barX, barY, barWidth * progress, barHeight);
        
        // Progress text
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 10px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${Math.round(progress * 100)}%`, barX + barWidth / 2, barY + 14);
        
        // Status display
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'left';
        
        if (!myPlayer.alive) {
            if (this.isRespawning && myPlayer.lives > 0) {
                const elapsed = this.deathTime ? (Date.now() - this.deathTime) / 1000 : 0;
                const remaining = Math.max(0, 1 - elapsed);
                this.ctx.fillStyle = '#FFD700';
                this.ctx.fillText(`🔄 Hồi sinh sau: ${remaining.toFixed(1)}s`, 30, 185);
            } else {
                this.ctx.fillStyle = '#FF6B6B';
                this.ctx.fillText('💀 Đã chết', 30, 185);
            }
        } else if (myPlayer.invulnerable) {
            this.ctx.fillStyle = '#4ECDC4';
            this.ctx.fillText('🛡️ Bất tử', 30, 185);
        } else {
            this.ctx.fillStyle = '#4ECDC4';
            this.ctx.fillText('✅ Sống', 30, 185);
        }
        
        // Rank display if finished
        if (myPlayer.rank > 0) {
            this.ctx.fillStyle = '#FFD700';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.fillText(`🏆 Hạng: ${myPlayer.rank}`, 30, 210);
        }
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
        // ===== BỎ HẾT CÁC ĐƯỜNG SỌCE RACE TRACK =====

        // Start line (có thể giữ lại để biết điểm bắt đầu)
        this.ctx.strokeStyle = '#FF6B6B';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([10, 10]);
        this.ctx.beginPath();
        this.ctx.moveTo(100, 0);
        this.ctx.lineTo(100, this.config.height);
        this.ctx.stroke();

        // Finish line (có thể giữ lại để biết điểm kết thúc)
        this.ctx.strokeStyle = '#4ECDC4';
        this.ctx.beginPath();
        this.ctx.moveTo(this.config.raceDistance, 0);
        this.ctx.lineTo(this.config.raceDistance, this.config.height);
        this.ctx.stroke();

        // ===== BỎ HOÀN TOÀN CÁC ĐƯỜNG PATH SỌCE =====
        // Đã comment out tất cả code vẽ đường sọc:

        /*
        // ===== ĐƯỜNG DẪN CHO 2 PATH - ĐÃ BỎ =====
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
        */

        this.ctx.setLineDash([]);
    }



    showRankings(rankings) {
    console.log('📊 Displaying final rankings...');
    
    if (!rankings || rankings.length === 0) {
        this.showInfo('📊 Không có bảng xếp hạng');
        return;
    }
    
    // ===== TẠO HTML CHO BẢNG XẾP HẠNG =====
    let rankingHTML = '<div class="final-rankings">';
    rankingHTML += '<h3>🏆 BXH CUỐI GAME 🏆</h3>';
    
    rankings.forEach((player, index) => {
        const rank = index + 1;
        let rankIcon = '';
        let rankClass = '';
        
        // Icon và class cho từng hạng
        if (rank === 1) {
            rankIcon = '🥇';
            rankClass = 'gold';
        } else if (rank === 2) {
            rankIcon = '🥈';
            rankClass = 'silver';
        } else if (rank === 3) {
            rankIcon = '🥉';
            rankClass = 'bronze';
        } else {
            rankIcon = `#${rank}`;
            rankClass = 'normal';
        }
        
        // Highlight current player
        const isCurrentPlayer = player.playerId === this.playerId;
        const playerClass = isCurrentPlayer ? 'current-player' : '';
        
        rankingHTML += `
            <div class="ranking-item ${rankClass} ${playerClass}">
                <span class="rank">${rankIcon}</span>
                <span class="player-name">${player.playerId.slice(-4)}</span>
                <span class="score">${player.score || 0} điểm</span>
                <span class="phase">${this.getPhaseText(player.phase)}</span>
            </div>
        `;
    });
    
    rankingHTML += '</div>';
    
    // ===== HIỂN THỊ BẢNG XẾP HẠNG =====
    this.showCustomMessage(rankingHTML, 'rankings', 8000);
}




getPhaseText(phase) {
    const phaseMap = {
        'finished': '✅ Hoàn thành',
        'return': '🔄 Đang về',
        'outbound': '➡️ Đang đi',
        'dead': '💀 Đã chết'
    };
    return phaseMap[phase] || '❓ Không rõ';
}

showCustomMessage(htmlContent, className = 'custom-message', duration = 5000) {
    // Xóa message cũ nếu có
    const oldMessage = document.querySelector(`.${className}`);
    if (oldMessage) {
        oldMessage.remove();
    }
    
    // Tạo message mới
    const messageDiv = document.createElement('div');
    messageDiv.className = `game-overlay ${className}`;
    messageDiv.innerHTML = htmlContent;
    
    // Style cho message
    messageDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 20px;
        border-radius: 15px;
        border: 2px solid #FFD700;
        box-shadow: 0 0 20px rgba(255, 215, 0, 0.5);
        z-index: 10000;
        max-width: 400px;
        text-align: center;
        font-family: Arial, sans-serif;
    `;
    
    document.body.appendChild(messageDiv);
    
    // Tự động xóa sau duration
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, duration);
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
    this.ctx.fillRect(10, startY, 250, 140);
    
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = 'bold 14px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('Your Stats:', 20, startY + 20);
    
    this.ctx.font = '12px Arial';
    this.ctx.fillText(`Score: ${player.score || 0}`, 20, startY + 40);
    
    // ===== HIỂN THỊ PHASE VỚI ICON =====
    const phaseInfo = {
        'outbound': { text: '➡️ ĐANG ĐI', color: '#4ECDC4' },
        'return': { text: '⬅️ ĐANG VỀ', color: '#FF6B6B' },
        'finished': { text: '🏁 HOÀN THÀNH', color: '#FFD700' }
    };
    
    const currentPhaseInfo = phaseInfo[player.phase] || { text: '❓ UNKNOWN', color: '#FFFFFF' };
    this.ctx.fillStyle = currentPhaseInfo.color;
    this.ctx.fillText(`Phase: ${currentPhaseInfo.text}`, 20, startY + 60);
    
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillText(`Lives: ${player.lives || 3}`, 20, startY + 80);
    
    if (player.rank > 0) {
        this.ctx.fillStyle = '#FFD700';
        this.ctx.fillText(`Final Rank: ${player.rank}`, 20, startY + 100);
    }
    
    // ===== PROGRESS BAR WITH PHASE INDICATION =====
    const barWidth = 200;
    const barHeight = 15;
    const barX = 20;
    const barY = startY + 110;
    
    // Background
    this.ctx.fillStyle = '#333';
    this.ctx.fillRect(barX, barY, barWidth, barHeight);
    
    // Progress calculation
    let progress = 0;
    let progressColor = '#4ECDC4';
    
    if (player.phase === 'finished') {
        progress = 1;
        progressColor = '#FFD700'; // Gold for finished
    } else if (player.phase === 'return') {
        // Return phase: 50% + progress back to start
        const returnProgress = Math.max(0, (this.config.raceDistance - player.x) / this.config.raceDistance);
        progress = 0.5 + (0.5 * returnProgress);
        progressColor = '#FF6B6B'; // Red for return
    } else {
        // Outbound phase: 0-50%
        progress = Math.min(0.5, player.x / this.config.raceDistance);
        progressColor = '#4ECDC4'; // Blue for outbound
    }
    
    // Progress fill
    this.ctx.fillStyle = progressColor;
    this.ctx.fillRect(barX, barY, barWidth * progress, barHeight);
    
    // Progress text
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = 'bold 10px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`${Math.round(progress * 100)}%`, barX + barWidth / 2, barY + 11);
    
    // Reset text align
    this.ctx.textAlign = 'left';
}
// triggerGameEnd(winnerId) {
//     console.log('🏆 Triggering game end with winner:', winnerId);
    
//     this.gamePhase = 'finished';
//     this.status = 'finished';
//     this.stopGameLoop();
    
//     // Calculate final rankings
//     this.calculateFinalRankings();
    
//     // Clear all respawn timers
//     this.playerStates.forEach(player => {
//         if (player.respawnTimer) {
//             clearTimeout(player.respawnTimer);
//             player.respawnTimer = null;
//         }
//     });
    
//     // Broadcast game ended với winner
//     this.broadcast({
//         type: 'gameEnded',
//         winner: winnerId,
//         rankings: this.leaderboard,
//         message: `🏆 ${winnerId.slice(-4)} chiến thắng!`
//     });
    
//     this.broadcastGameState();
    
//     // Auto reset after 10 seconds
//     setTimeout(() => {
//         console.log('🔄 Auto resetting game after 10 seconds');
//         this.resetGame();
//     }, 10000);
// }




calculateFinalRankings() {
    console.log('📊 Calculating final rankings...');
    
    // Sắp xếp players theo priority:
    // 1. Finished players (theo rank - người về trước rank thấp hơn)
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
                playerId: p.playerId,
                score: p.score,
                rank: p.rank || 0,
                phase: p.phase,
                finalProgress: progress,
                priority: priority,
                alive: p.alive
            };
        })
        .sort((a, b) => {
            // Sort by priority first
            if (a.priority !== b.priority) {
                return a.priority - b.priority;
            }
            
            // Within same priority, sort by criteria
            if (a.priority === 1) {
                // Finished players: by rank (lower rank = better)
                return a.rank - b.rank;
            } else {
                // Others: by progress (higher progress = better)
                return b.finalProgress - a.finalProgress;
            }
        });
    
    // Update leaderboard with final rankings
    this.leaderboard = rankedPlayers.map((p, index) => ({
        playerId: p.playerId,
        score: p.score,
        rank: index + 1,
        phase: p.phase,
        progress: p.finalProgress
    }));
    
    console.log('📊 Final rankings:', this.leaderboard);
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
    console.log('🐦 Flap function called');
    
    if (!this.gameId) {
        console.log('❌ No gameId for flap');
        return;
    }
    
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        console.log('❌ WebSocket not ready for flap');
        return;
    }
    
    console.log('📤 Sending flap action to server');
    this.ws.send(JSON.stringify({
        type: 'gameAction',
        gameId: this.gameId,
        action: 'flap'
    }));
}
forceSetupEventListeners() {
    console.log('🔧 Force setting up event listeners...');
    this.eventListenersActive = false;
    this.setupEventListeners();
    console.log('✅ Force setup completed');
}
debugEventListeners() {
    console.log('=== EVENT LISTENERS DEBUG ===');
    console.log('eventListenersActive:', this.eventListenersActive);
    console.log('keyDownHandler exists:', !!this.keyDownHandler);
    console.log('keyUpHandler exists:', !!this.keyUpHandler);
    console.log('Canvas onclick exists:', !!this.canvas?.onclick);
    console.log('Game phase:', this.gameState?.gamePhase);
    console.log('Game status:', this.gameState?.status);
    console.log('Game ID:', this.gameId);
    console.log('WebSocket ready:', this.ws?.readyState === WebSocket.OPEN);
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

    forceStayInFullscreen() {
        this.shouldStayInFullscreen = true;

        if (!this.isInFullscreenMode()) {
            setTimeout(() => {
                this.enterFullscreenMode();
            }, 100);
        }
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
        console.log('🎲 Quick join clicked - requesting available games list');

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.showError('❌ Chưa kết nối được server!');
            return;
        }

        // Hiển thị loading state
        const quickJoinBtn = document.querySelector('button[onclick="showQuickJoin()"]');
        if (quickJoinBtn) {
            this.originalQuickJoinText = quickJoinBtn.innerHTML;
            quickJoinBtn.innerHTML = '⏳ Đang tìm phòng...';
            quickJoinBtn.disabled = true;
        }

        this.showInfo('🔍 Đang lấy danh sách phòng từ server...');

        // Gửi request lấy danh sách game hiện tại (SỬ DỤNG API CÓ SẴN)
        this.ws.send(JSON.stringify({
            type: 'listGames'
        }));

        // Set flag để biết đây là quick join request
        this.isQuickJoinInProgress = true;

        // Timeout 10 giây cho request
        this.quickJoinTimeout = setTimeout(() => {
            if (this.isQuickJoinInProgress) {
                this.onQuickJoinFailed('⏰ Timeout khi lấy danh sách phòng');
            }
        }, 10000);
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

        if (!this.gameId) {
            console.log('⚠️ No active game to leave');
            this.showError('❌ Bạn chưa tham gia phòng nào!');
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

        // 2. Force thoát fullscreen
        this.forceExitFullscreen();

        // 3. Reset TOÀN BỘ trạng thái (bao gồm gameId)
        this.resetGameState();

        // 4. VỀ MAIN MENU (không phải lobby)
        this.showMainMenu();

        // 5. Hiển thị thông báo
        this.showSuccess('🚪 Đã rời phòng thành công!');
    }

    returnToMainMenuCompletely() {
        console.log('🏠 Returning to main menu completely...');

        // Hiển thị main menu
        const mainMenu = document.getElementById('mainMenu');
        const gameSetup = document.getElementById('gameSetup');
        const gameSection = document.getElementById('gameSection');

        // Force hiển thị main menu
        if (mainMenu) {
            mainMenu.style.display = 'block';
            mainMenu.classList.remove('hidden');
        }

        // ẨN hoàn toàn game setup (lobby)
        if (gameSetup) {
            gameSetup.style.display = 'none';
            gameSetup.classList.add('hidden');
        }

        // ẨN hoàn toàn game section
        if (gameSection) {
            gameSection.style.display = 'none';
            gameSection.classList.add('hidden');
        }

        // Clear tất cả game UI
        this.clearAllGameUI();

        // Reset input field
        const gameIdInput = document.getElementById('gameIdInput');
        if (gameIdInput) {
            gameIdInput.value = '';
        }
    }
    clearAllGameUI() {
        console.log('🧹 Clearing all game UI...');

        // Remove exit button
        const exitBtn = document.querySelector('.exit-fullscreen-btn');
        if (exitBtn) {
            exitBtn.remove();
        }

        // Clear game messages
        const gameMessages = document.querySelectorAll('.game-message, .countdown-overlay, .race-result');
        gameMessages.forEach(el => el.remove());

        // Reset page classes
        document.body.classList.remove('game-playing');
        document.documentElement.classList.remove('game-playing');

        // Reset page styles
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
    }

    resetGameState(keepGameConnection = false) {
        console.log('🔄 Resetting game state...', keepGameConnection ? '(keeping connection)' : '(full reset)');

        if (keepGameConnection) {
            // Chỉ reset game state, GIỮ kết nối phòng
            this.gameState = null;
            // GIỮ: gameId, playerColor, isHost
        } else {
            // Reset toàn bộ
            this.gameId = null;
            this.playerColor = null;
            this.gameState = null;
            this.isHost = false;
            this.isSpectator = false;
        }

        // Reset các flag khác
        this.eventListenersActive = false;
        this.shouldStayInFullscreen = false;
        this.isRespawning = false;
        this.deathTime = null;

        // Reset canvas camera
        if (this.camera) {
            this.camera.x = 0;
            this.camera.y = 0;
        }

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

        // ===== QUAN TRỌNG: ẨN gameSection để KHÔNG render canvas =====
        if (gameSection) {
            gameSection.style.display = 'none';
            gameSection.classList.add('hidden');
        }

        // Clear game-specific UI elements
        this.clearGameUI();

        console.log('✅ Main menu displayed, game section hidden');
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
        console.log('🧹 Clearing game UI...');

        // Remove exit button
        const exitBtn = document.querySelector('.exit-fullscreen-btn');
        if (exitBtn) {
            exitBtn.remove();
        }

        // Clear game messages
        const gameMessages = document.querySelectorAll('.game-message, .countdown-overlay, .race-result');
        gameMessages.forEach(el => el.remove());

        // Reset page classes
        document.body.classList.remove('game-playing');
        document.documentElement.classList.remove('game-playing');

        // Reset page styles
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';

        // Reset header if hidden
        const header = document.querySelector('nav, .navbar');
        if (header) {
            header.style.display = '';
        }
    }

    // UI management
    showMainMenu() {
        console.log('🏠 Showing main menu...');

        const mainMenu = document.getElementById('mainMenu');
        const gameSetup = document.getElementById('gameSetup');
        const gameSection = document.getElementById('gameSection');

        // Hiển thị main menu
        if (mainMenu) {
            mainMenu.style.display = 'block';
            mainMenu.classList.remove('hidden');
        }

        // Ẩn tất cả phần game
        if (gameSetup) {
            gameSetup.style.display = 'none';
            gameSetup.classList.add('hidden');
        }

        if (gameSection) {
            gameSection.style.display = 'none';
            gameSection.classList.add('hidden');
        }

        // Reset input field
        const gameIdInput = document.getElementById('joinGameId');
        if (gameIdInput) {
            gameIdInput.value = '';
        }

        // Clear game UI
        this.clearGameUI();

        console.log('✅ Main menu displayed');
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

        // ===== QUAN TRỌNG: Setup event listeners =====
        if (!this.eventListenersActive) {
            console.log('🔧 Setting up event listeners for lobby...');
            this.setupEventListeners();
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
    
    // Hide/show UI ngay lập tức
    if (mainMenu) mainMenu.classList.add('hidden');
    if (gameSetup) gameSetup.classList.add('hidden');
    if (gameSection) gameSection.classList.remove('hidden');
    
    // Đảm bảo event listeners hoạt động
    if (!this.eventListenersActive) {
        console.log('🔧 Event listeners not active, setting up...');
        this.setupEventListeners();
    }
    
    // Vào REAL fullscreen ngay lập tức
    this.enterFullscreenModeImmediate();
}

    enterFullscreenModeImmediate() {
    console.log('🚀 Entering fullscreen mode immediately');
    
    // Add fullscreen class to body NGAY LẬP TỨC
    document.body.classList.add('game-playing');
    document.documentElement.classList.add('game-playing');
    
    // Hide header/navbar
    const header = document.querySelector('nav, .navbar');
    if (header) {
        header.style.display = 'none';
    }
    
    // Prevent scrolling
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    
    // Add exit fullscreen button
    this.addExitFullscreenButton();
    
    // Force canvas visibility NGAY LẬP TỨC
    if (this.canvas) {
        this.canvas.style.display = 'block';
        this.canvas.style.visibility = 'visible';
    }
    
    // ===== KHÔNG CÓ DELAY - RESIZE NGAY =====
    this.resizeCanvasFullscreenImmediate();
        this.requestBrowserFullscreen().then(() => {
        console.log('✅ Browser fullscreen activated');
        this.setupFullscreenCSS();
    }).catch((error) => {
        console.log('⚠️ Browser fullscreen failed, using CSS fallback:', error);
        this.setupFullscreenCSS();
    });
    console.log('✅ Fullscreen mode entered immediately');
}
requestBrowserFullscreen() {
    return new Promise((resolve, reject) => {
        const element = document.documentElement; // Fullscreen cả trang
        
        if (element.requestFullscreen) {
            element.requestFullscreen().then(resolve).catch(reject);
        } else if (element.webkitRequestFullscreen) {
            element.webkitRequestFullscreen();
            resolve();
        } else if (element.mozRequestFullScreen) {
            element.mozRequestFullScreen();
            resolve();
        } else if (element.msRequestFullscreen) {
            element.msRequestFullscreen();
            resolve();
        } else {
            reject(new Error('Fullscreen not supported'));
        }
    });
}
setupFullscreenCSS() {
    console.log('🎨 Setting up fullscreen CSS');
    
    // Add fullscreen class to body
    document.body.classList.add('game-playing');
    document.documentElement.classList.add('game-playing');
    
    // Hide header/navbar
    const header = document.querySelector('nav, .navbar');
    if (header) {
        header.style.display = 'none';
    }
    
    // Prevent scrolling
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    
    // Add exit fullscreen button
    this.addExitFullscreenButton();
    
    // Setup canvas for fullscreen
    this.setupCanvasFullscreen();
}
    // CŨNG THAY THẾ FUNCTION exitFullscreenMode BẰNG CÁI NÀY:
setupCanvasFullscreen() {
    if (!this.canvas) return;
    
    console.log('🖼️ Setting up canvas for fullscreen');
    
    // Force canvas visibility
    this.canvas.style.display = 'block';
    this.canvas.style.visibility = 'visible';
    
    // Set canvas to fullscreen
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    
    // Fullscreen canvas styles
    this.canvas.style.position = 'fixed';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100vw';
    this.canvas.style.height = '100vh';
    this.canvas.style.zIndex = '9998';
    this.canvas.style.backgroundColor = '#87CEEB';
    
    // Calculate scale factor
    const gameAspectRatio = this.config.width / this.config.height;
    const screenAspectRatio = window.innerWidth / window.innerHeight;
    
    if (screenAspectRatio > gameAspectRatio) {
        // Screen is wider than game - fit to height
        this.scale = window.innerHeight / this.config.height;
    } else {
        // Screen is taller than game - fit to width
        this.scale = window.innerWidth / this.config.width;
    }
    
    // Center game viewport
    const gameWidth = this.config.width * this.scale;
    const gameHeight = this.config.height * this.scale;
    this.fullscreenOffset = {
        x: (window.innerWidth - gameWidth) / 2,
        y: (window.innerHeight - gameHeight) / 2
    };
    
    console.log(`✅ Canvas fullscreen setup: ${window.innerWidth}x${window.innerHeight}, scale: ${this.scale}`);
    
    // Force immediate render
    if (this.gameState) {
        this.render();
    }
}
  


exitFullscreenMode() {
    // ===== NGĂN THOÁT NẾU ĐANG RESPAWN =====
    if (this.shouldStayInFullscreen || this.isRespawning) {
        console.log('🚫 Blocked exit fullscreen - player respawning');
        return;
    }
    
    console.log('🚪 Exiting fullscreen mode');
    
    // ===== EXIT BROWSER FULLSCREEN =====
    if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    }
    
    // Cleanup CSS
    this.cleanupFullscreenCSS();
}
cleanupFullscreenCSS() {
    console.log('🧹 Cleaning up fullscreen CSS');
    
    // Remove fullscreen classes
    document.body.classList.remove('game-playing');
    document.documentElement.classList.remove('game-playing');
    
    // Reset page styles
    document.body.style.overflow = '';
    document.documentElement.style.overflow = '';
    
    // Show header
    const header = document.querySelector('nav, .navbar');
    if (header) {
        header.style.display = '';
    }
    
    // Remove exit button
    const exitBtn = document.querySelector('.exit-fullscreen-btn');
    if (exitBtn) {
        exitBtn.remove();
    }
    
    // Reset canvas to lobby size
    this.resizeCanvasToLobby();
}
addFullscreenEventListeners() {
    // Listen for fullscreen changes (user presses ESC)
    document.addEventListener('fullscreenchange', this.handleFullscreenChange.bind(this));
    document.addEventListener('webkitfullscreenchange', this.handleFullscreenChange.bind(this));
    document.addEventListener('mozfullscreenchange', this.handleFullscreenChange.bind(this));
    document.addEventListener('MSFullscreenChange', this.handleFullscreenChange.bind(this));
}
handleFullscreenChange() {
    const isFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
    );
    
    console.log('🔄 Fullscreen change detected:', isFullscreen);
    
    if (!isFullscreen && document.body.classList.contains('game-playing')) {
        // User exited fullscreen (probably with ESC key)
        console.log('🚪 User exited fullscreen - cleaning up');
        this.cleanupFullscreenCSS();
    }
}
resizeCanvasToLobby() {
    if (!this.canvas || !this.ctx) return;
    
    console.log('📏 Resizing canvas back to lobby size');
    
    // Get container size
    const container = this.canvas.parentElement;
    if (!container) return;
    
    const containerWidth = container.clientWidth - 40; // Account for padding
    const aspectRatio = this.config.width / this.config.height;
    
    // Calculate lobby size
    const lobbyWidth = Math.min(containerWidth, 1200);
    const lobbyHeight = lobbyWidth / aspectRatio;
    
    // Ensure minimum height on mobile
    const finalWidth = lobbyHeight < 250 ? 250 * aspectRatio : lobbyWidth;
    const finalHeight = lobbyHeight < 250 ? 250 : lobbyHeight;
    
    // Set canvas size
    this.canvas.width = finalWidth;
    this.canvas.height = finalHeight;
    
    // Reset canvas styles
    this.canvas.style.position = 'relative';
    this.canvas.style.top = 'auto';
    this.canvas.style.left = 'auto';
    this.canvas.style.width = finalWidth + 'px';
    this.canvas.style.height = finalHeight + 'px';
    this.canvas.style.zIndex = 'auto';
    
    // Calculate scale factor for lobby
    this.scale = finalWidth / this.config.width;
    
    // Reset fullscreen offset
    this.fullscreenOffset = { x: 0, y: 0 };
    
    console.log(`✅ Canvas resized to lobby: ${finalWidth}x${finalHeight}, scale: ${this.scale}`);
    
    // Force immediate render
    if (this.gameState) {
        this.render();
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
    
    console.log('✅ Exit button added with real fullscreen support');
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

showSuccess(message, duration = 3000) {
    const statusEl = document.getElementById('gameStatus');
    if (statusEl) {
        statusEl.innerHTML = `<div class="success-message" style="animation: pulse 2s infinite;">✅ ${message}</div>`;
        
        // Only auto-clear if not a winner message
        if (!message.includes('chiến thắng') && !message.includes('VICTORY')) {
            setTimeout(() => {
                if (statusEl.innerHTML.includes(message)) {
                    statusEl.innerHTML = 'Đang chờ...';
                }
            }, duration);
        }
    } else {
        console.log('SUCCESS:', message);
    }
}

        showRankings(rankings) {
        console.log('📊 Showing rankings...');
        
        let rankingText = '📊 Bảng xếp hạng cuối game:\n\n';
        
        rankings.forEach((player, index) => {
            const isMe = player.playerId === this.playerId;
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            const playerName = isMe ? 'BẠN' : player.playerId.slice(-4);
            const phaseIcon = player.phase === 'finished' ? '🏁' : 
                             player.phase === 'return' ? '🔄' : '➡️';
            
            rankingText += `${medal} ${playerName} ${phaseIcon} - ${player.score} điểm\n`;
        });
        
        // Show in a nice overlay
        this.showInfo(rankingText);
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
    if (window.flappyGame) {
        window.flappyGame.showQuickJoin();
    } else {
        console.error('❌ Game instance not found');
        alert('Game chưa được khởi tạo!');
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