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
          // Setup main menu button overrides
        setTimeout(() => {
            this.setupMainMenuButtons();
        }, 1000);
         this.setupFullscreenListeners();
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
        console.log('🎮 Showing game playing mode - GamePhase:', this.gameState?.gamePhase);
        
        const gameSetup = document.getElementById('gameSetup');
        const gameSection = document.getElementById('gameSection');
        const mainMenu = document.getElementById('mainMenu');
        
        if (mainMenu) mainMenu.classList.add('hidden');
        if (gameSetup) gameSetup.classList.add('hidden');
        if (gameSection) gameSection.classList.remove('hidden');
        
        // Add CSS first
        this.addFullscreenCSS();
        
        // Enter fullscreen
        setTimeout(() => {
            this.enterFullscreenMode();
        }, 300);
    }
    
    async enterFullscreenMode() {
        console.log('🖥️ Entering REAL fullscreen mode');
        
        try {
            // Request REAL browser fullscreen
            const element = document.documentElement; // Hoặc this.canvas
            
            if (element.requestFullscreen) {
                await element.requestFullscreen();
            } else if (element.webkitRequestFullscreen) {
                await element.webkitRequestFullscreen();
            } else if (element.msRequestFullscreen) {
                await element.msRequestFullscreen();
            } else if (element.mozRequestFullScreen) {
                await element.mozRequestFullScreen();
            }
            
            console.log('✅ Browser fullscreen activated');
            
        } catch (error) {
            console.warn('❌ Could not enter browser fullscreen:', error);
            // Fallback to CSS fullscreen
            this.enterCSSFullscreen();
            return;
        }
        
        // Setup game for fullscreen after successful browser fullscreen
        setTimeout(() => {
            this.setupGameFullscreen();
        }, 100);
    }

    setupGameFullscreen() {
        console.log('🎮 Setting up game for fullscreen');
        
        // Add fullscreen class
        document.body.classList.add('game-playing');
        
        const flappyPage = document.querySelector('.flappy-race-page');
        if (flappyPage) {
            flappyPage.classList.add('game-playing');
        }
        
        // Hide UI elements
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
        
        // Setup canvas for fullscreen
        this.setupCanvasFullscreen();
        
        // Add exit button
        this.addExitFullscreenButton();
        
        console.log('✅ Game setup for fullscreen complete');
    }
setupCanvasFullscreen() {
        if (!this.canvas) return;
        
        console.log('🎨 Setting up canvas for fullscreen');
        
        // Get actual screen dimensions
        const screenWidth = screen.width;
        const screenHeight = screen.height;
        
        console.log(`Full screen dimensions: ${screenWidth}x${screenHeight}`);
        
        // Set canvas to full screen size
        this.canvas.width = screenWidth;
        this.canvas.height = screenHeight;
        
        // Update config
        this.config.width = screenWidth;
        this.config.height = screenHeight;
        this.scale = 1;
        
        // Style canvas to fill screen
        this.canvas.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            z-index: 9999 !important;
            background: #87CEEB !important;
            cursor: crosshair !important;
        `;
        
        console.log(`✅ Canvas set to ${this.canvas.width}x${this.canvas.height}`);
    }
 enterCSSFullscreen() {
        console.log('🖥️ Using CSS fullscreen (fallback)');
        
        // Add fullscreen class
        document.body.classList.add('game-playing');
        
        const flappyPage = document.querySelector('.flappy-race-page');
        if (flappyPage) {
            flappyPage.classList.add('game-playing');
        }
        
        // Hide browser UI with CSS
        document.body.style.cssText = `
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            width: 100vw !important;
            height: 100vh !important;
        `;
        
        // Hide elements
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
        
        // Setup canvas
        this.setupCanvasFullscreen();
        this.addExitFullscreenButton();
    }









    addFullscreenCSS() {
        const cssId = 'fullscreen-canvas-fix';
        
        // Remove existing CSS if any
        const existingCSS = document.getElementById(cssId);
        if (existingCSS) {
            existingCSS.remove();
        }
        
        // Add CSS to force fullscreen
        const style = document.createElement('style');
        style.id = cssId;
        style.textContent = `
            /* Force fullscreen for game */
            body.game-playing {
                margin: 0 !important;
                padding: 0 !important;
                overflow: hidden !important;
                width: 100vw !important;
                height: 100vh !important;
            }
            
            .flappy-race-page.game-playing {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                margin: 0 !important;
                padding: 0 !important;
            }
            
            .flappy-race-page.game-playing #gameSection {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                margin: 0 !important;
                padding: 0 !important;
                z-index: 9998 !important;
            }
            
            .flappy-race-page.game-playing #flappyCanvas,
            .flappy-race-page.game-playing .flappy-canvas {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                margin: 0 !important;
                padding: 0 !important;
                border: none !important;
                z-index: 9999 !important;
                display: block !important;
            }
        `;
        
        document.head.appendChild(style);
        console.log('✅ Fullscreen CSS added');
    }
    resizeCanvasForFullscreen() {
        if (!this.canvas) return;
        
        console.log('📐 Resizing canvas for FULL screen...');
        
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        
        console.log(`Screen dimensions: ${screenWidth}x${screenHeight}`);
        
        // Set canvas size to EXACTLY screen size
        this.canvas.width = screenWidth;
        this.canvas.height = screenHeight;
        
        // Update config to match screen
        this.config.width = screenWidth;
        this.config.height = screenHeight;
        
        // Reset scale to 1 (no scaling in fullscreen)
        this.scale = 1;
        
        console.log(`✅ Canvas resized to: ${this.canvas.width}x${this.canvas.height}`);
        console.log(`Config updated to: ${this.config.width}x${this.config.height}`);
    }
   
    
    async exitFullscreenMode() {
        console.log('🚪 Exiting fullscreen mode');
        
        // Exit browser fullscreen first
        try {
            if (document.fullscreenElement || 
                document.webkitFullscreenElement || 
                document.msFullscreenElement || 
                document.mozFullScreenElement) {
                
                if (document.exitFullscreen) {
                    await document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    await document.webkitExitFullscreen();
                } else if (document.msExitFullscreen) {
                    await document.msExitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    await document.mozCancelFullScreen();
                }
                
                console.log('✅ Browser fullscreen exited');
            }
        } catch (error) {
            console.warn('❌ Error exiting browser fullscreen:', error);
        }
        
        // Clean up game fullscreen setup
        this.cleanupGameFullscreen();
        
        // Show full page with lobby
        setTimeout(() => {
            this.showFullPageWithLobby();
            this.resetReadyStatusForNewRound();
            this.resizeCanvas();
            this.showSuccess('🏠 Đã về trang chủ đầy đủ. Game room vẫn hoạt động!');
        }, 100);
    }

cleanupGameFullscreen() {
        console.log('🧹 Cleaning up fullscreen setup');
        
        // Remove fullscreen classes
        document.body.classList.remove('game-playing');
        
        const flappyPage = document.querySelector('.flappy-race-page');
        if (flappyPage) {
            flappyPage.classList.remove('game-playing');
        }
        
        // Reset body styles
        document.body.style.cssText = '';
        
        // Show UI elements
        const elementsToShow = [
            '#mainMenu', '#gameSetup', '#gameSection',
            '.game-header', '.game-hud', '.game-controls-bottom'
        ];
        
        elementsToShow.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                element.style.display = '';
                element.classList.remove('hidden');
            }
        });
        
        // Reset canvas styles
        if (this.canvas) {
            this.canvas.style.cssText = '';
        }
        
        // Remove exit button
        const exitBtn = document.querySelector('.exit-fullscreen-btn');
        if (exitBtn) {
            exitBtn.remove();
        }
        
        console.log('✅ Fullscreen cleanup complete');
    }
    
    setupFullscreenListeners() {
        // Listen for fullscreen changes
        const fullscreenEvents = [
            'fullscreenchange',
            'webkitfullscreenchange', 
            'mozfullscreenchange',
            'msfullscreenchange'
        ];
        
        fullscreenEvents.forEach(event => {
            document.addEventListener(event, () => {
                const isFullscreen = !!(
                    document.fullscreenElement || 
                    document.webkitFullscreenElement || 
                    document.msFullscreenElement || 
                    document.mozFullScreenElement
                );
                
                console.log('📺 Fullscreen state changed:', isFullscreen);
                
                if (isFullscreen) {
                    // Entered fullscreen
                    setTimeout(() => {
                        this.setupGameFullscreen();
                    }, 100);
                } else {
                    // Exited fullscreen (by ESC or other means)
                    if (document.body.classList.contains('game-playing')) {
                        this.cleanupGameFullscreen();
                        setTimeout(() => {
                            this.showFullPageWithLobby();
                            this.resetReadyStatusForNewRound();
                            this.resizeCanvas();
                        }, 100);
                    }
                }
            });
        });
        
        console.log('✅ Fullscreen listeners setup');
    }
showFullPageWithLobby() {
        console.log('🏠 Showing full page with lobby');
        
        const mainMenu = document.getElementById('mainMenu');
        const gameSetup = document.getElementById('gameSetup');
        const gameSection = document.getElementById('gameSection');
        
        // HIỂN THỊ TẤT CẢ: main menu + lobby + game section
        if (mainMenu) {
            mainMenu.style.display = 'block';
            mainMenu.classList.remove('hidden');
            console.log('✅ Main menu shown');
        }
        
        if (gameSetup) {
            gameSetup.style.display = 'block';
            gameSetup.classList.remove('hidden');
            console.log('✅ Game setup (lobby) shown');
        }
        
        if (gameSection) {
            gameSection.style.display = 'block';
            gameSection.classList.remove('hidden');
            console.log('✅ Game section shown');
        }
        
        // Update game ID trong lobby
        if (this.gameId) {
            const setupGameId = document.getElementById('setupGameId');
            const currentGameId = document.getElementById('currentGameId');
            
            if (setupGameId) setupGameId.textContent = this.gameId;
            if (currentGameId) currentGameId.textContent = this.gameId;
        }
        
        // Highlight lobby để user chú ý
        this.highlightLobbySection();
        
        console.log('✅ Full page with all sections displayed');
    }
highlightLobbySection() {
        const lobbyCard = document.querySelector('#gameSetup .card');
        if (lobbyCard) {
            // Add glow effect
            lobbyCard.style.transition = 'all 0.5s ease';
            lobbyCard.style.border = '3px solid #28a745';
            lobbyCard.style.boxShadow = '0 0 20px rgba(40, 167, 69, 0.6)';
            lobbyCard.style.transform = 'scale(1.02)';
            
            // Remove after 4 seconds
            setTimeout(() => {
                if (lobbyCard.style.border) {
                    lobbyCard.style.transition = 'all 0.5s ease';
                    lobbyCard.style.border = '';
                    lobbyCard.style.boxShadow = '';
                    lobbyCard.style.transform = '';
                }
            }, 4000);
            
            console.log('✨ Lobby section highlighted');
        }
    }
   testFullscreenCSS() {
        // Debug function
        console.log('=== FULLSCREEN CSS DEBUG ===');
        console.log('Body has game-playing:', document.body.classList.contains('game-playing'));
        console.log('Page has game-playing:', document.querySelector('.flappy-race-page')?.classList.contains('game-playing'));
        
        const canvas = document.getElementById('flappyCanvas');
        if (canvas) {
            const styles = window.getComputedStyle(canvas);
            console.log('Canvas computed styles:');
            console.log('- position:', styles.position);
            console.log('- top:', styles.top);
            console.log('- left:', styles.left);
            console.log('- width:', styles.width);
            console.log('- height:', styles.height);
            console.log('- z-index:', styles.zIndex);
        }
    }
    
    emergencyFullscreen() {
        console.log('🚨 Emergency fullscreen activation');
        
        // Force add classes
        document.body.classList.add('game-playing');
        const flappyPage = document.querySelector('.flappy-race-page');
        if (flappyPage) {
            flappyPage.classList.add('game-playing');
        }
        
        // Hide navbar
        const nav = document.querySelector('nav, .navbar');
        if (nav) nav.style.display = 'none';
        
        // Add exit button
        this.addExitFullscreenButton();
        
        // Simple canvas resize
        const canvas = document.getElementById('flappyCanvas');
        if (canvas) {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        
        console.log('✅ Emergency fullscreen applied');
    }
    showMainPageWithLobby() {
        console.log('🏠 Showing main page with active lobby');
        
        const mainMenu = document.getElementById('mainMenu');
        const gameSetup = document.getElementById('gameSetup');
        const gameSection = document.getElementById('gameSection');
        
        // HIỂN THỊ CẢ MAIN MENU VÀ GAME SETUP (LOBBY)
        if (mainMenu) {
            mainMenu.style.display = 'block';
            mainMenu.classList.remove('hidden');
        }
        if (gameSetup) {
            gameSetup.style.display = 'block'; // Vẫn hiển thị lobby
            gameSetup.classList.remove('hidden');
        }
        if (gameSection) {
            gameSection.style.display = 'none';
            gameSection.classList.add('hidden');
        }
        
        // Update game ID displays trong lobby
        if (this.gameId) {
            const setupGameId = document.getElementById('setupGameId');
            const currentGameId = document.getElementById('currentGameId');
            
            if (setupGameId) setupGameId.textContent = this.gameId;
            if (currentGameId) currentGameId.textContent = this.gameId;
        }
        
        // Scroll xuống lobby section để user thấy
        setTimeout(() => {
            const lobbySection = document.getElementById('gameSetup');
            if (lobbySection) {
                lobbySection.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
            }
        }, 500);
        
        console.log('✅ Main page with lobby displayed');
    }


    


   resetReadyStatusForNewRound() {
        console.log('🔄 Resetting ready status for new round');
        
        // Reset ready button
        const readyBtn = document.getElementById('readyBtn');
        if (readyBtn) {
            readyBtn.disabled = false;
            readyBtn.textContent = '✅ Sẵn sàng chiến đấu!';
            readyBtn.className = 'btn btn-success btn-lg px-5';
            readyBtn.style.display = 'inline-block';
        }
        
        // Reset ready status display
        const readyStatus = document.getElementById('readyStatus');
        if (readyStatus) {
            readyStatus.innerHTML = '<span class="not-ready-status">Chưa sẵn sàng cho round mới</span>';
        }
        
        // Update lobby title
        const lobbyTitle = document.querySelector('#gameSetup .card-header h4');
        if (lobbyTitle) {
            lobbyTitle.textContent = '🎮 Lobby Game - Sẵn Sàng Round Mới?';
        }
        
        // Clear game timer
        const timerEl = document.getElementById('gameTimer');
        if (timerEl) {
            timerEl.textContent = '00:00';
        }
    }
    
    ensureFullPageVisibility() {
        // Remove any height constraints
        const body = document.body;
        const html = document.documentElement;
        
        body.style.height = '';
        body.style.maxHeight = '';
        html.style.height = '';
        html.style.maxHeight = '';
        
        // Ensure all main containers are visible
        const containers = [
            '.flappy-race-page',
            '#mainMenu', 
            '#gameSetup', 
            '#gameSection'
        ];
        
        containers.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                element.style.display = '';
                element.style.height = '';
                element.style.maxHeight = '';
                element.style.overflow = '';
            }
        });
        
        console.log('✅ Full page visibility ensured');
    }

addLeaveRoomButton() {
        // Kiểm tra xem đã có nút chưa
        const existingBtn = document.getElementById('leaveRoomBtn');
        if (existingBtn) return;
        
        // Tìm container để thêm nút
        const buttonContainer = document.querySelector('#gameSetup .text-center');
        if (!buttonContainer) return;
        
        // Tạo nút rời phòng
        const leaveBtn = document.createElement('button');
        leaveBtn.id = 'leaveRoomBtn';
        leaveBtn.className = 'btn btn-outline-danger btn-sm ms-3';
        leaveBtn.innerHTML = '🚪 Rời phòng';
        
        leaveBtn.onclick = () => {
            if (confirm('🚪 Bạn có chắc muốn rời phòng và về trang chủ không?')) {
                this.leaveGameCompletely();
            }
        };
        
        // Thêm nút vào sau nút ready
        buttonContainer.appendChild(leaveBtn);
        
        console.log('✅ Added leave room button to lobby');
    }
        leaveGameCompletely() {
        console.log('🚪 Leaving game completely and returning to main menu');
        
        // Send leave game message
        if (this.gameId && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'leaveGame',
                gameId: this.gameId
            }));
        }
        
        // Reset game state
        this.gameId = null;
        this.playerColor = null;
        this.gameState = null;
        this.playersReady = {};
        
        // Show main menu (trang chọn chế độ chơi)
        this.showMainMenu();
        
        this.showSuccess('🏠 Đã rời phòng và về trang chủ!');
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
        exitBtn.innerHTML = '✖️ ESC - Thoát Fullscreen';
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
        
        console.log('✅ Exit fullscreen button added');
    }
    
showMainMenu() {
        console.log('🏠 Showing main menu (game mode selection)');
        
        const mainMenu = document.getElementById('mainMenu');
        const gameSetup = document.getElementById('gameSetup');
        const gameSection = document.getElementById('gameSection');
        
        // Show main menu, hide others
        if (mainMenu) {
            mainMenu.style.display = 'block';
            mainMenu.classList.remove('hidden');
        }
        if (gameSetup) {
            gameSetup.style.display = 'none';
            gameSetup.classList.add('hidden');
        }
        if (gameSection) {
            gameSection.style.display = 'none';
            gameSection.classList.add('hidden');
        }
        
        // Reset game state
        this.gameId = null;
        this.playerId = null;
        this.playerColor = null;
        this.gameState = null;
        
        // Clear input fields
        const gameIdInput = document.getElementById('gameIdInput');
        if (gameIdInput) {
            gameIdInput.value = '';
        }
        
        // Reset ready button if exists
        const readyBtn = document.getElementById('readyBtn');
        if (readyBtn) {
            readyBtn.disabled = false;
            readyBtn.textContent = '✅ Sẵn sàng chiến đấu!';
            readyBtn.className = 'btn btn-success btn-lg px-5';
        }
        
        // Show success message
        this.showSuccess('🏠 Đã về trang chủ. Chọn chế độ chơi mới!');
        
        console.log('✅ Main menu displayed');
    }
    
    showGameSetupSection() {
        // Nếu đang ở main page với lobby, không thay đổi gì
        const mainMenu = document.getElementById('mainMenu');
        if (mainMenu && !mainMenu.classList.contains('hidden')) {
            console.log('Already showing main page with lobby, no change needed');
            return;
        }
        
        // Nếu không, hiển thị bình thường
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
    
    setupMainMenuButtons() {
        // Override nút "Tạo phòng ngay"
        const createBtn = document.querySelector('button[onclick="createGame()"]');
        if (createBtn) {
            createBtn.onclick = (e) => {
                e.preventDefault();
                this.createNewGame();
            };
        }
        
        // Override nút "Vào phòng" 
        const joinBtn = document.querySelector('button[onclick="joinGame()"]');
        if (joinBtn) {
            joinBtn.onclick = (e) => {
                e.preventDefault();
                this.joinNewGame();
            };
        }
    }


        joinNewGame() {
        // Confirm nếu đang trong game
        if (this.gameId) {
            if (!confirm('🎮 Bạn đang trong phòng game. Vào phòng mới sẽ rời phòng hiện tại. Tiếp tục?')) {
                return;
            }
            
            // Leave current game
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'leaveGame',
                    gameId: this.gameId
                }));
            }
        }
        
        // Proceed with joining new game
        this.joinGame();
    }

    createNewGame() {
        // Confirm nếu đang trong game
        if (this.gameId) {
            if (!confirm('🎮 Bạn đang trong phòng game. Tạo phòng mới sẽ rời phòng hiện tại. Tiếp tục?')) {
                return;
            }
            
            // Leave current game
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({
                    type: 'leaveGame',
                    gameId: this.gameId
                }));
            }
        }
        
        // Proceed with creating new game
        this.createGame();
    }
    showGameResult() {
        if (this.gameState.status === 'finished') {
            // Game hoàn toàn kết thúc - về lobby
            this.exitFullscreenMode();
            this.showSuccess('🏁 Game kết thúc! Sẵn sàng cho round mới?');
        } else {
            // Round kết thúc - về lobby
            this.exitFullscreenMode();
            this.showSuccess('🏆 Round kết thúc! Nhấn "Sẵn sàng" để chơi tiếp!');
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
    
    addLeaveGameButton() {
        // Tìm container để thêm nút
        const lobbyContainer = document.querySelector('#gameSetup .card-body');
        if (!lobbyContainer) return;
        
        // Kiểm tra xem đã có nút chưa
        const existingBtn = document.getElementById('leaveGameBtn');
        if (existingBtn) return;
        
        // Tạo nút rời phòng
        const leaveBtn = document.createElement('button');
        leaveBtn.id = 'leaveGameBtn';
        leaveBtn.className = 'btn btn-outline-danger btn-sm mt-3';
        leaveBtn.innerHTML = '🚪 Rời phòng';
        leaveBtn.style.cssText = 'margin-left: 10px;';
        
        leaveBtn.onclick = () => {
            if (confirm('🚪 Bạn có chắc muốn rời phòng không?')) {
                this.leaveGameCompletely();
            }
        };
        
        // Thêm vào sau nút ready
        const readyBtn = document.getElementById('readyBtn');
        if (readyBtn && readyBtn.parentNode) {
            readyBtn.parentNode.appendChild(leaveBtn);
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
                    this.exitFullscreenMode(); // Về lobby ngay lập tức
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
        
        // Use scale = 1 for fullscreen (no scaling)
        const scale = document.body.classList.contains('game-playing') ? 1 : this.scale;
        
        if (scale !== 1) {
            this.ctx.scale(scale, scale);
        }
        
        this.ctx.translate(-this.camera.x, -this.camera.y);
        
        // Render game objects
        this.renderBackground();
        this.renderPipes();
        this.renderItems();
        this.renderPlayers();
        this.renderProjectiles();
        this.renderParticles();
        
        this.ctx.restore();
        
        // Render UI on top (always unscaled)
        this.renderUI();
    }
        debugCanvasSize() {
        console.log('=== CANVAS SIZE DEBUG ===');
        console.log('Window size:', window.innerWidth, 'x', window.innerHeight);
        console.log('Canvas size:', this.canvas?.width, 'x', this.canvas?.height);
        console.log('Config size:', this.config.width, 'x', this.config.height);
        console.log('Canvas CSS size:', this.canvas?.style.width, 'x', this.canvas?.style.height);
        console.log('Is fullscreen:', document.body.classList.contains('game-playing'));
        console.log('Scale:', this.scale);
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

        // QUAN TRỌNG: Cập nhật danh sách người chơi
        this.updatePlayersList();
    }

updatePlayersList() {
        const playersListEl = document.getElementById('playersList');
        if (!playersListEl || !this.gameState.players) return;

        playersListEl.innerHTML = '';

        this.gameState.players.forEach((player, index) => {
            const playerItem = document.createElement('div');
            playerItem.className = 'player-item d-flex align-items-center p-2 mb-2';
            playerItem.style.cssText = `
                background: rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                border: 1px solid rgba(255, 255, 255, 0.2);
            `;

            const isMe = player.playerId === this.playerId;
            const readyStatus = this.gameState.playersReady && this.gameState.playersReady[player.playerId] ? '✅ Sẵn sàng' : '⏳ Chờ...';

            playerItem.innerHTML = `
                <div class="player-color me-2" style="
                    width: 20px; 
                    height: 20px; 
                    border-radius: 50%; 
                    background-color: ${player.color || '#FFD700'};
                    border: 2px solid #fff;
                "></div>
                <div class="player-name flex-grow-1" style="color: #fff; font-weight: bold;">
                    ${isMe ? '👤 Bạn' : `🎮 Player ${index + 1}`}
                </div>
                <div class="player-status" style="color: #fff; font-size: 12px;">
                    ${readyStatus}
                </div>
            `;

            if (isMe) {
                playerItem.style.background = 'rgba(0, 123, 255, 0.3)';
                playerItem.style.borderColor = '#007bff';
            }

            playersListEl.appendChild(playerItem);
        });

        console.log(`👥 Updated players list: ${this.gameState.players.length} players`);
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