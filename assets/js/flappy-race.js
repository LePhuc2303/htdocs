// assets/js/flappy-race.js
const WS_URL = 'ws://localhost:8080';

class FlappyRaceClient {
constructor() {
  this.ws = null;
  this.playerId = 'player_' + Math.random().toString(36).substr(2, 9);
  this.gameState = {
    gameId: null,
    players: [],
    myPlayer: null,
    gamePhase: 'waiting' // THÊM default phase
  };
  
  this.canvas = null;
  this.ctx = null;
  this.cameraX = 0;
  
  this.connectWebSocket();
  this.setupCanvas();
  this.setupControls();
  this.startRenderLoop();
}

    init() {
        this.setupCanvas();
        this.setupControls();
        this.connectWebSocket();
        this.startRenderLoop();
    }

    // ===== CANVAS SETUP =====
setupCanvas() {
  this.canvas = document.getElementById('gameCanvas');
  if (!this.canvas) {
    console.error('Canvas element not found!');
    return;
  }
  
  this.ctx = this.canvas.getContext('2d');
  if (!this.ctx) {
    console.error('Canvas context not available!');
    return;
  }
  
  console.log('Canvas setup complete:', {
    width: this.canvas.width,
    height: this.canvas.height,
    context: !!this.ctx
  });
  
  // Test draw để kiểm tra canvas hoạt động
  this.ctx.fillStyle = '#FF0000';
  this.ctx.fillRect(10, 10, 50, 50);
  console.log('Test red square drawn');
}

   setupControls() {
  let spacePressed = false; // Tránh spam space
  
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      
      // Chỉ xử lý khi space chưa được nhấn (tránh key repeat)
      if (!spacePressed) {
        spacePressed = true;
        this.jump();
      }
    }
  });
  
  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      spacePressed = false;
    }
  });
  
  // Mouse/touch controls
  this.canvas.addEventListener('click', (e) => {
    e.preventDefault();
    this.jump();
  });
  
  this.canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    this.jump();
  });
  
  // Jump button
  const jumpBtn = document.getElementById('jumpBtn');
  if (jumpBtn) {
    jumpBtn.addEventListener('click', () => {
      this.jump();
    });
  }
// THÊM: Ctrl và chuột phải để sử dụng items
  document.addEventListener('keydown', (e) => {
    if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
      e.preventDefault();
      this.showItemMenu();
    }
    
    // Phím tắt số để dùng items
    const keyNum = parseInt(e.key);
    if (keyNum >= 1 && keyNum <= 4) {
      const itemTypes = ['trap', 'bomb', 'lightning', 'armor'];
      const itemType = itemTypes[keyNum - 1];
      this.useItemQuick(itemType);
    }
  });
  
  this.canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    this.showItemMenu();
  });




}

    // ===== WEBSOCKET =====
    connectWebSocket() {
        this.ws = new WebSocket(WS_URL);

        this.ws.onopen = () => {
            console.log('🔌 Connected to server');
            this.updateConnectionStatus('connected');
        };

        this.ws.onclose = () => {
            console.log('🔌 Disconnected from server');
            this.updateConnectionStatus('disconnected');

            // Auto-reconnect
            setTimeout(() => {
                this.connectWebSocket();
            }, 3000);
        };

        this.ws.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
            this.updateConnectionStatus('error');
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleServerMessage(data);
            } catch (error) {
                console.error('❌ Invalid JSON from server:', error);
            }
        };
    }

    updateConnectionStatus(status) {
        const statusEl = document.getElementById('connectionStatus');
        statusEl.className = `connection-status ${status}`;

        switch (status) {
            case 'connected':
                statusEl.textContent = '🟢 Đã kết nối';
                break;
            case 'disconnected':
                statusEl.textContent = '🔴 Mất kết nối';
                break;
            case 'error':
                statusEl.textContent = '⚠️ Lỗi kết nối';
                break;
        }
    }

    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.warn('⚠️ WebSocket not ready');
        }
    }

    // ===== SERVER MESSAGES =====
  handleServerMessage(data) {
  switch (data.type) {
    case 'gameCreated':
      this.gameState.gameId = data.gameId;
      this.gameState.players = [];
      // LƯU player ID từ response nếu có
      if (data.playerInfo && data.playerInfo.playerId) {
        this.playerId = data.playerInfo.playerId;
      }
      this.showGameSection();
      this.showMessage('🎮 Phòng đã được tạo!');
      document.getElementById('currentGameId').textContent = data.gameId;
      break;

    case 'gameJoined':
      this.gameState.gameId = data.gameId;
      this.gameState.players = [];
      // LƯU player ID từ response nếu có
      if (data.playerInfo && data.playerInfo.playerId) {
        this.playerId = data.playerInfo.playerId;
      }
      this.showGameSection();
      this.showMessage('🎮 Đã vào phòng!');
      document.getElementById('currentGameId').textContent = data.gameId;
      break;

    case 'gameState':
      // Update game state
      this.gameState = { ...this.gameState, ...data };
      
      // QUAN TRỌNG: Tìm myPlayer bằng cách khác nếu ID không khớp
      if (this.gameState.players && this.gameState.players.length > 0) {
        // Thử tìm theo ID trước
        this.gameState.myPlayer = this.gameState.players.find(p => p.playerId === this.playerId);
        
        // Nếu không tìm thấy, lấy player đầu tiên (fallback)
        if (!this.gameState.myPlayer && this.gameState.players.length > 0) {
          this.gameState.myPlayer = this.gameState.players[0];
          console.warn('Using first player as myPlayer:', this.gameState.myPlayer.playerId);
        }
        
        // Debug logs
        console.log('My stored ID:', this.playerId);
        console.log('Available players:', this.gameState.players.map(p => p.playerId));
        console.log('Found myPlayer:', this.gameState.myPlayer ? 'YES' : 'NO');
        
        if (this.gameState.myPlayer) {
          console.log('MyPlayer position:', this.gameState.myPlayer.x, this.gameState.myPlayer.y);
        }
      }
      
      this.updateGameUI();
      
      // Update players list if needed
      if (this.gameState.gamePhase === 'waiting' && this.gameState.players && this.gameState.players.length > 0) {
        this.updatePlayersList(
          this.gameState.players, 
          this.gameState.roomOwner || data.roomOwner, 
          this.gameState.playersReady || data.playersReady || {}
        );
      }
      break;

    case 'playersReady':
      // Cập nhật thông tin ready mà KHÔNG làm mất players list
      this.gameState.playersReady = data.playersReady;
      this.gameState.roomOwner = data.roomOwner;
      
      // Sử dụng players từ data nếu có, không thì dùng state hiện tại
      const playersToShow = data.players || this.gameState.players;
      
      if (playersToShow && playersToShow.length > 0) {
        this.updatePlayersList(playersToShow, data.roomOwner, data.playersReady);
      }
      break;

    case 'gameStarted':
      this.hidePlayerManagement();
      break;

    case 'kicked':
      this.showError(data.message);
      this.showMainMenu();
      this.gameState.gameId = null;
      break;

    case 'gameMessage':
      this.showMessage(data.message);
      break;

    case 'gameEnd':
      this.gameState.gamePhase = 'finished';
      if (data.winner === this.playerId) {
        this.showMessage('🏆 BẠN ĐÃ THẮNG!');
      } else if (data.winner) {
        this.showMessage(`🏁 ${data.winner.slice(-4)} đã thắng!`);
      } else {
        this.showMessage('💀 Tất cả đều bị loại!');
      }
      
      // Show reset button
      document.getElementById('resetBtn').style.display = 'block';
      break;

    case 'error':
      this.showError(data.message);
      break;

    case 'gameList':
      // Handle game list response cho joinRandomGame
      const availableGames = data.games.filter(game => 
        game.gameType === 'flappy-race' && 
        game.playerCount < game.maxPlayers &&
        game.status === 'waiting'
      );
      
      if (availableGames.length > 0) {
        const randomGame = availableGames[Math.floor(Math.random() * availableGames.length)];
        this.send({
          type: 'joinGame',
          gameId: randomGame.gameId
        });
        this.showMessage(`🎲 Đang vào phòng ngẫu nhiên: ${randomGame.gameId}`);
      } else {
        this.createGame();
        this.showMessage('🆕 Không có phòng trống, tạo phòng mới!');
      }
      break;

    default:
      console.log('Unknown message type:', data.type, data);
  }
}
updateCamera() {
  if (!this.gameState.myPlayer) {
    this.cameraX = 0;
    return;
  }
  
  const player = this.gameState.myPlayer;
  
  if (typeof player.x !== 'number') {
    this.cameraX = 0;
    return;
  }
  
  // DEAD ZONE cho canvas 1400px
  const deadZoneWidth = 500; // TĂNG từ 400 cho canvas rộng hơn
  const screenCenter = 700; // 1400 / 2
  const deadZoneLeft = this.cameraX + screenCenter - (deadZoneWidth / 2);
  const deadZoneRight = this.cameraX + screenCenter + (deadZoneWidth / 2);
  
  // Camera logic không đổi
  if (player.x < deadZoneLeft) {
    this.cameraX = player.x - screenCenter + (deadZoneWidth / 2);
  } else if (player.x > deadZoneRight) {
    this.cameraX = player.x - screenCenter - (deadZoneWidth / 2);
  }
  
  // Clamp camera bounds
  const maxX = 5200;
  this.cameraX = Math.max(0, Math.min(maxX, this.cameraX));
}
    onGameJoined(data) {
        this.gameState.gameId = data.gameId;
        this.gameState.config = data.playerInfo.gameConfig;

        console.log(`🎮 Joined game: ${data.gameId}`);

        this.showGameSection();
        this.showMessage('🎮 Đã tham gia game! Chờ người chơi khác...');

        document.getElementById('currentGameId').textContent = data.gameId;
    }

    updateGameState(data) {
        this.gameState.gamePhase = data.gamePhase;
        this.gameState.players = data.players || [];
        this.gameState.obstacles = data.obstacles || [];
        this.gameState.countdownTime = data.countdownTime;

        // Find my player
        this.gameState.myPlayer = this.gameState.players.find(p =>
            p.playerId === this.gameState.playerId
        );

        // Handle countdown display
        this.updateCountdownDisplay();

        // Update UI
        this.updateGameUI();
    }

    updateCountdownDisplay() {
        const countdownEl = document.getElementById('countdown');
        const countdownMessageEl = document.getElementById('countdownMessage');
        const countdownTimerEl = document.getElementById('countdownTimer');

        if (this.gameState.gamePhase === 'countdown' && this.gameState.countdownTime > 0) {
            const timeLeft = Math.ceil(this.gameState.countdownTime);

            // Show countdown overlay with full screen message
            countdownMessageEl.style.display = 'flex';

            // Update timer in message
            if (countdownTimerEl) {
                countdownTimerEl.textContent = timeLeft;

                // Change color based on time
                if (timeLeft <= 1) {
                    countdownTimerEl.style.color = '#FF4444'; // Red
                    countdownTimerEl.style.textShadow = '4px 4px 8px rgba(255, 68, 68, 0.8)';
                } else if (timeLeft <= 2) {
                    countdownTimerEl.style.color = '#FFA500'; // Orange
                    countdownTimerEl.style.textShadow = '4px 4px 8px rgba(255, 165, 0, 0.8)';
                } else {
                    countdownTimerEl.style.color = '#FFD700'; // Gold
                    countdownTimerEl.style.textShadow = '4px 4px 8px rgba(255, 215, 0, 0.8)';
                }
            }

            // Show simple countdown number
            countdownEl.style.display = 'block';
            countdownEl.textContent = timeLeft;
            countdownEl.className = 'countdown-display pulse-animation';

            // Change color for main countdown too
            if (timeLeft <= 1) {
                countdownEl.style.color = '#FF4444';
                countdownEl.style.textShadow = '4px 4px 8px rgba(255, 68, 68, 0.8)';
            } else if (timeLeft <= 2) {
                countdownEl.style.color = '#FFA500';
                countdownEl.style.textShadow = '4px 4px 8px rgba(255, 165, 0, 0.8)';
            } else {
                countdownEl.style.color = '#FFD700';
                countdownEl.style.textShadow = '4px 4px 8px rgba(255, 215, 0, 0.8)';
            }

            // Play countdown sound effect (if you want to add audio)
            // this.playCountdownSound(timeLeft);

        } else {
            // Hide both countdown displays
            countdownEl.style.display = 'none';
            countdownMessageEl.style.display = 'none';
        }
    }

    // Optional: Add sound effects
    playCountdownSound(timeLeft) {
        // You can implement audio here if desired
        try {
            const audio = new Audio();
            if (timeLeft === 1) {
                // Different sound for final countdown
                console.log('🔊 Final countdown beep!');
            } else {
                // Regular countdown beep
                console.log(`🔊 Countdown beep: ${timeLeft}`);
            }
        } catch (error) {
            // Audio not supported or failed
        }
    }

    showCountdownNotification() {
        // Show toast notification
        this.showMessage('🎮 CHUẨN BỊ! Game sẽ bắt đầu!', 'success');

        // You could also trigger other UI effects here
        const canvas = document.getElementById('gameCanvas');
        if (canvas) {
            canvas.style.border = '3px solid #FFD700';
            canvas.style.boxShadow = '0 0 20px rgba(255, 215, 0, 0.5)';
        }
    }

    hideCountdownNotification() {
        // Reset canvas border
        const canvas = document.getElementById('gameCanvas');
        if (canvas) {
            canvas.style.border = '3px solid #FFD700';
            canvas.style.boxShadow = 'none';
        }
    }

    onGameEnd(data) {
        if (data.winner === this.gameState.playerId) {
            this.showMessage('🏆 CHÚC MỪNG! BẠN ĐÃ THẮNG!');
        } else if (data.winner) {
            this.showMessage(`🏁 ${data.winner.slice(-4)} đã thắng!`);
        } else {
            this.showMessage('💀 Tất cả đều bị loại!');
        }

        // Show reset button
        document.getElementById('resetBtn').style.display = 'block';
    }

    // ===== GAME ACTIONS =====
    createGame() {
        this.send({
            type: 'createGame',
            gameType: 'flappy-race'
        });
    }

    joinGame() {
        const gameId = document.getElementById('gameIdInput').value.trim();
        if (!gameId) {
            this.showError('Nhập mã phòng!');
            return;
        }

        this.send({
            type: 'joinGame',
            gameId: gameId
        });
    }

    joinRandomGame() {
        // Request list of games first
        this.send({ type: 'listGames' });

        // Handle game list response
        const originalHandler = this.handleServerMessage.bind(this);
        this.handleServerMessage = (data) => {
            if (data.type === 'gameList') {
                const availableGames = data.games.filter(game =>
                    game.gameType === 'flappy-race' &&
                    game.playerCount < game.maxPlayers &&
                    game.status === 'waiting'
                );

                if (availableGames.length > 0) {
                    // Join random available game
                    const randomGame = availableGames[Math.floor(Math.random() * availableGames.length)];
                    this.send({
                        type: 'joinGame',
                        gameId: randomGame.gameId
                    });
                    this.showMessage(`🎲 Đang vào phòng ngẫu nhiên: ${randomGame.gameId}`);
                } else {
                    // Create new game if no available games
                    this.createGame();
                    this.showMessage('🆕 Không có phòng trống, tạo phòng mới!');
                }

                // Restore original handler
                this.handleServerMessage = originalHandler;
            } else {
                originalHandler(data);
            }
        };
    }

jump() {
     const jumpTime = Date.now();
  console.log('Jump at:', jumpTime);
   if (!this.gameState.gameId || this.gameState.gamePhase !== 'playing') {
    console.log('Jump blocked - wrong phase');
    return;
  }
  
  if (!this.gameState.myPlayer || !this.gameState.myPlayer.alive) {
    console.log('Jump blocked - player not alive');
    return;
  }
  
  // Visual feedback ngay lập tức
  const player = this.gameState.myPlayer;
  if (player && player.alive) {
    player.velocityY = -8;
    
    // Thêm jump effect
    this.showJumpEffect(player.x, player.y);
  }
  
  // Send to server
  this.send({
    type: 'gameAction',
    gameId: this.gameState.gameId,
    action: 'jump'
  });
   
  console.log('Jump sent to server at:', Date.now() - jumpTime, 'ms');
}

// Thêm method hiệu ứng jump
showJumpEffect(x, y) {
  // Tạo particles hoặc animation đơn giản
  this.jumpEffectTime = Date.now();
  this.jumpEffectPos = { x, y };
}

resetGame() {
  console.log(`🔄 Resetting FlappyRace game ${this.gameId}`);
  
  this.stopGameLoop();
  
  // Reset game state
  this.gamePhase = 'waiting';
  this.countdownTime = 5;
  
  // Clear all timers
  this.playerStates.forEach(player => {
    if (player.respawnTimer) {
      clearTimeout(player.respawnTimer);
      player.respawnTimer = null;
    }
  });
  
  // Reset player states
  this.playerStates.forEach(player => {
    player.x = this.config.startLine;
    player.y = this.config.height / 2;
    player.velocityY = 0;
    player.alive = true;
    player.lives = 10; // RESET về 10 mạng
    player.distance = 0;
    player.finished = false;
    player.rank = 0;
    player.invulnerable = false;
    player.invulnerableTime = 0;
    player.turnedAround = false;
    player.direction = 1;
  });
  
  // Clear obstacles
  this.obstacles = [];
  this.powerups = [];
  
  this.broadcast({
    type: 'gameMessage',
    message: '🔄 Game đã được reset!'
  });
  
  this.broadcastGameState();
}

    leaveGame() {
        this.send({
            type: 'leaveGame',
            gameId: this.gameState.gameId
        });

        this.showMainMenu();
        this.gameState.gameId = null;
    }

    // ===== UI MANAGEMENT =====
    showMainMenu() {
        document.getElementById('mainMenu').style.display = 'block';
        document.getElementById('gameSection').style.display = 'none';
        document.getElementById('gameIdInput').value = '';
    }

showGameSection() {
  document.getElementById('mainMenu').style.display = 'none';
  document.getElementById('gameSection').style.display = 'block';
  
  // Always show player management initially
  const playerMgmt = document.getElementById('playerManagement');
  if (playerMgmt) {
    playerMgmt.style.display = 'block';
  }
  
  // Update current game ID display
  if (this.gameState.gameId) {
    document.getElementById('currentGameId').textContent = this.gameState.gameId;
  }
}
hidePlayerManagement() {
  const playerMgmt = document.getElementById('playerManagement');
  if (playerMgmt) {
    playerMgmt.style.display = 'none';
  }
}

showPlayerManagement() {
  const playerMgmt = document.getElementById('playerManagement');
  if (playerMgmt) {
    playerMgmt.style.display = 'block';
  }
}
   updateGameUI() {
  const playerCountEl = document.getElementById('playerCount');
  const gamePhaseEl = document.getElementById('gamePhase');
  
  if (playerCountEl) {
    playerCountEl.textContent = `👥 ${this.gameState.players.length}`;
  }
  
  if (gamePhaseEl) {
    switch (this.gameState.gamePhase) {
      case 'waiting':
        gamePhaseEl.textContent = '⏳ Đang chờ người chơi...';
        gamePhaseEl.className = 'game-phase waiting';
        break;
      case 'countdown':
        gamePhaseEl.textContent = `🚀 Đang chơi!`; // Không hiển thị countdown ở đây
        gamePhaseEl.className = 'game-phase countdown';
        break;
      case 'playing':
        gamePhaseEl.textContent = '🏃 Đang chơi!';
        gamePhaseEl.className = 'game-phase playing';
        break;
      case 'finished':
        gamePhaseEl.textContent = '🏁 Kết thúc!';
        gamePhaseEl.className = 'game-phase finished';
        break;
    }
  }
  
  // Ẩn player management khi không phải waiting
  if (this.gameState.gamePhase === 'waiting') {
    this.showPlayerManagement();
  } else {
    this.hidePlayerManagement();
  }
}



    copyGameId() {
        if (!this.gameState.gameId) return;

        navigator.clipboard.writeText(this.gameState.gameId).then(() => {
            this.showMessage('📋 Đã copy mã phòng!');
        }).catch(() => {
            this.showError('❌ Không thể copy mã phòng');
        });
    }

    // ===== MESSAGES =====
    showMessage(text, type = 'info') {
        const messageEl = document.getElementById('gameMessages');
        if (messageEl) {
            const div = document.createElement('div');
            div.className = `message ${type}`;
            div.textContent = text;
            messageEl.appendChild(div);
            messageEl.scrollTop = messageEl.scrollHeight;

            // Remove old messages
            while (messageEl.children.length > 10) {
                messageEl.removeChild(messageEl.firstChild);
            }
        }
        console.log('📢', text);
    }

    showError(text) {
        const messageEl = document.getElementById('gameMessages');
        if (messageEl) {
            const div = document.createElement('div');
            div.className = 'message error';
            div.textContent = text;
            messageEl.appendChild(div);
            messageEl.scrollTop = messageEl.scrollHeight;
        }
        console.error('❌', text);
    }

    // ===== RENDERING =====
startRenderLoop() {
  // Clear any existing animation frame
  if (this.renderLoop) {
    cancelAnimationFrame(this.renderLoop);
  }
  
  const render = () => {
    try {
      this.render();
    } catch (error) {
      console.error('Render error:', error);
    }
    this.renderLoop = requestAnimationFrame(render);
  };
  
  render(); // Start immediately
  console.log('Render loop started'); // Debug log
}   

render() {
  if (!this.gameState) {
    console.log('No gameState');
    return;
  }
  
  if (!this.canvas || !this.ctx) {
    console.log('No canvas or context');
    return;
  }
  
  const gamePhase = this.gameState.gamePhase || 'waiting'; // Default to 'waiting'
  console.log('Rendering phase:', gamePhase);
  
  // Clear canvas
  this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  
  if (gamePhase === 'waiting') {
    console.log('Drawing waiting screen');
    this.drawWaitingScreen();
    return;
  }
  
  if (['countdown', 'playing', 'finished'].includes(gamePhase)) {
    this.updateCamera();
    
    // DEBUG: Log camera transform
    console.log('Applying camera transform:', -this.cameraX);
    
    this.ctx.save();
    this.ctx.translate(-this.cameraX, 0);
    
    // Draw a test rectangle to see camera effect
    this.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
    this.ctx.fillRect(0, 0, 100, 100); // Red square at world origin
    
    this.drawBackground();
    this.drawObstacles();
    this.drawPowerups();
    this.drawPlayers();
    this.drawRaceMarkers();
    
    this.ctx.restore();
    
    // Draw UI
    this.drawGameUI();
    this.drawCountdownOverlay();
    
    console.log('Render complete');
  } else {
    console.log('Unknown or invalid game phase:', gamePhase);
    // Fallback - vẽ waiting screen
    this.drawWaitingScreen();
  }
}

//new

// Hiển thị menu items
showItemMenu() {
  if (!this.gameState.myPlayer || !this.gameState.myPlayer.alive) return;
  if (this.gameState.gamePhase !== 'playing') return;
  
  const playerItems = this.gameState.playerItems[this.gameState.myPlayer.playerId] || [];
  
  if (playerItems.length === 0) {
    this.showMessage('Không có item nào!');
    return;
  }
  
  // Xóa menu cũ nếu có
  const oldMenu = document.querySelector('.item-menu');
  if (oldMenu) oldMenu.remove();
  
  // Tạo menu
  const menu = document.createElement('div');
  menu.className = 'item-menu';
  menu.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.9);
    border: 2px solid #FFD700;
    border-radius: 10px;
    padding: 20px;
    z-index: 10000;
    color: white;
    text-align: center;
  `;
  
  menu.innerHTML = '<h4>Chọn item sử dụng:</h4>';
  
  const itemNames = {
    'trap': '🪤 Bẫy (1)',
    'bomb': '💣 Bom (2)', 
    'lightning': '⚡ Sét (3)',
    'armor': '🛡️ Áo giáp (4)'
  };
  
  // Đếm số lượng mỗi loại item
  const itemCounts = {};
  playerItems.forEach(item => {
    itemCounts[item.type] = (itemCounts[item.type] || 0) + 1;
  });
  
  Object.entries(itemCounts).forEach(([type, count]) => {
    const btn = document.createElement('button');
    btn.textContent = `${itemNames[type]} x${count}`;
    btn.style.cssText = `
      display: block;
      width: 100%;
      margin: 5px 0;
      padding: 10px;
      background: #FFD700;
      border: none;
      border-radius: 5px;
      cursor: pointer;
      font-size: 16px;
    `;
    
    btn.onclick = () => {
      this.useItem(type);
      document.body.removeChild(menu);
    };
    
    menu.appendChild(btn);
  });
  
  // Nút đóng
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Đóng (ESC)';
  closeBtn.style.cssText = `
    margin-top: 10px;
    padding: 5px 10px;
    background: #666;
    color: white;
    border: none;
    border-radius: 5px;
    cursor: pointer;
  `;
  closeBtn.onclick = () => document.body.removeChild(menu);
  
  menu.appendChild(closeBtn);
  document.body.appendChild(menu);
  
  // Tự động đóng sau 5 giây
  setTimeout(() => {
    if (document.body.contains(menu)) {
      document.body.removeChild(menu);
    }
  }, 5000);
}

// Sử dụng item nhanh bằng phím số
useItemQuick(itemType) {
  if (!this.gameState.myPlayer || !this.gameState.myPlayer.alive) return;
  if (this.gameState.gamePhase !== 'playing') return;
  
  const playerItems = this.gameState.playerItems[this.gameState.myPlayer.playerId] || [];
  const hasItem = playerItems.find(item => item.type === itemType);
  
  if (hasItem) {
    this.useItem(itemType);
  } else {
    this.showMessage('Không có item này!');
  }
}

// Sử dụng item
useItem(itemType) {
  this.send({
    type: 'useItem',
    gameId: this.gameState.gameId,
    itemType: itemType
  });
}

// Vẽ items
drawItems() {
  if (!this.gameState.items) {
    console.log('❌ No items in gameState');
    return;
  }
  
  console.log(`🎨 Drawing ${this.gameState.items.length} items`);
  
  this.gameState.items.forEach((item, index) => {
    if (item.collected) return;
    
    console.log(`Drawing item ${index}: ${item.type} at (${item.x}, ${item.y})`);
    
    this.ctx.save();
    
    // Hiệu ứng lấp lánh
    const time = Date.now() * 0.005;
    const glow = Math.sin(time) * 0.3 + 0.7;
    
    this.ctx.globalAlpha = glow;
    
    // Vẽ background cho item
    this.ctx.fillStyle = 'rgba(255, 215, 0, 0.5)';
    this.ctx.fillRect(item.x - 12, item.y - 12, 24, 24);
    
    // Border
    this.ctx.strokeStyle = '#FFD700';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(item.x - 12, item.y - 12, 24, 24);
    
    // Vẽ icon theo type
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '20px Arial';
    this.ctx.textAlign = 'center';
    
    switch (item.type) {
      case 'trap':
        this.ctx.fillText('🪤', item.x, item.y + 7);
        break;
      case 'bomb':
        this.ctx.fillText('💣', item.x, item.y + 7);
        break;
      case 'lightning':
        this.ctx.fillText('⚡', item.x, item.y + 7);
        break;
      case 'armor':
        this.ctx.fillText('🛡️', item.x, item.y + 7);
        break;
      default:
        this.ctx.fillText('❓', item.x, item.y + 7);
    }
    
    this.ctx.restore();
  });
}

// Vẽ active effects
drawActiveEffects() {
  if (!this.gameState.activeEffects) return;
  
  console.log(`⚡ Drawing ${this.gameState.activeEffects.length} active effects`);
  
  this.gameState.activeEffects.forEach(effect => {
    this.ctx.save();
    
    switch (effect.type) {
      case 'trap':
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
        this.ctx.fillRect(effect.x - 20, effect.y - 20, 40, 40);
        this.ctx.strokeStyle = '#FF0000';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(effect.x - 20, effect.y - 20, 40, 40);
        
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 24px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('🪤', effect.x, effect.y + 8);
        break;
        
      case 'bomb':
        const bombTime = Date.now() - effect.createdAt;
        const bombProgress = bombTime / effect.duration;
        const bombRadius = (effect.radius || 100) * bombProgress;
        
        this.ctx.fillStyle = `rgba(255, 165, 0, ${0.5 * (1 - bombProgress)})`;
        this.ctx.beginPath();
        this.ctx.arc(effect.x, effect.y, bombRadius, 0, Math.PI * 2);
        this.ctx.fill();
        break;
        
      case 'lightning':
        this.ctx.strokeStyle = '#FFD700';
        this.ctx.lineWidth = 6;
        this.ctx.beginPath();
        this.ctx.moveTo(effect.fromX, effect.fromY);
        this.ctx.lineTo(effect.toX, effect.toY);
        this.ctx.stroke();
        break;
    }
    
    this.ctx.restore();
  });
}

// Vẽ inventory của player
drawPlayerInventory() {
  if (!this.gameState.myPlayer || !this.gameState.playerItems) return;
  
  const playerItems = this.gameState.playerItems[this.gameState.myPlayer.playerId] || [];
  
  if (playerItems.length === 0) return;
  
  // Vẽ inventory ở góc phải trên
  const startX = this.canvas.width - 200;
  const startY = 20;
  
  this.ctx.save();
  
  // Background
  this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  this.ctx.fillRect(startX - 10, startY - 10, 180, 80);
  
  this.ctx.strokeStyle = '#FFD700';
  this.ctx.lineWidth = 2;
  this.ctx.strokeRect(startX - 10, startY - 10, 180, 80);
  
  // Title
  this.ctx.fillStyle = '#FFD700';
  this.ctx.font = 'bold 14px Arial';
  this.ctx.textAlign = 'left';
  this.ctx.fillText('Items:', startX, startY + 15);
  
  // Items count
  const itemCounts = {};
  playerItems.forEach(item => {
    itemCounts[item.type] = (itemCounts[item.type] || 0) + 1;
  });
  
  const itemIcons = {
    'trap': '🪤',
    'bomb': '💣',
    'lightning': '⚡',
    'armor': '🛡️'
  };
  
  let y = startY + 35;
  Object.entries(itemCounts).forEach(([type, count]) => {
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '12px Arial';
    this.ctx.fillText(`${itemIcons[type]} x${count}`, startX, y);
    y += 15;
  });
  
  this.ctx.restore();
}

















drawPowerups() {
  if (!this.gameState.powerups || this.gameState.powerups.length === 0) return;
  
  // Tạm thời chưa implement powerups
  // this.ctx.fillStyle = '#FFD700';
  // this.gameState.powerups.forEach(powerup => {
  //   this.ctx.fillRect(powerup.x, powerup.y, powerup.width, powerup.height);
  // });
}
drawBackground() {
  // Fill toàn bộ canvas 1400x700
  const gradient = this.ctx.createLinearGradient(0, 0, 0, 700); // Chiều cao 700
  gradient.addColorStop(0, '#87CEEB'); // Sky blue
  gradient.addColorStop(0.7, '#98FB98'); // Light green  
  gradient.addColorStop(1, '#90EE90'); // Green
  
  this.ctx.fillStyle = gradient;
  this.ctx.fillRect(-this.cameraX, 0, 1400 * 3, 700); // Canvas size 1400x700
  
  // Draw ground line ở đáy
  this.ctx.fillStyle = '#228B22';
  this.ctx.fillRect(-this.cameraX, 690, 1400 * 3, 10); // Y = 690 cho canvas 700px
  
  // Draw clouds
  this.drawClouds();
}

drawClouds() {
  const clouds = [
    { x: 200, y: 100 }, { x: 500, y: 80 }, { x: 800, y: 120 },
    { x: 1200, y: 90 }, { x: 1600, y: 110 }, { x: 2000, y: 70 },
    { x: 2400, y: 130 }, { x: 2800, y: 85 }, { x: 3200, y: 105 }
  ];
  
  this.ctx.fillStyle = '#FFFFFF';
  clouds.forEach(cloud => {
    // Vẽ cloud với ellipse
    this.ctx.beginPath();
    this.ctx.ellipse(cloud.x, cloud.y, 60, 35, 0, 0, Math.PI * 2); // Tăng size cloud
    this.ctx.fill();
    
    this.ctx.beginPath();
    this.ctx.ellipse(cloud.x - 30, cloud.y, 40, 25, 0, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.beginPath();
    this.ctx.ellipse(cloud.x + 30, cloud.y, 40, 25, 0, 0, Math.PI * 2);
    this.ctx.fill();
  });
}

    drawClouds() {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';

        for (let i = 0; i < 5; i++) {
            const x = (i * 300 + Date.now() * 0.02) % (this.canvas.width + 100);
            const y = 50 + i * 30;

            this.drawCloud(x, y);
        }
    }

    drawCloud(x, y) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, 20, 0, Math.PI * 2);
        this.ctx.arc(x + 25, y, 30, 0, Math.PI * 2);
        this.ctx.arc(x + 50, y, 25, 0, Math.PI * 2);
        this.ctx.fill();
    }

    
    drawObstacles() {
  if (!this.gameState.obstacles) {
    return;
  }
  
  // Group obstacles by x position
  const obstaclesByX = {};
  this.gameState.obstacles.forEach(obstacle => {
    if (!obstaclesByX[obstacle.x]) {
      obstaclesByX[obstacle.x] = [];
    }
    obstaclesByX[obstacle.x].push(obstacle);
  });
  
  // Draw obstacles
  this.gameState.obstacles.forEach(obstacle => {
    this.ctx.fillStyle = '#8B4513';
    this.ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    
    this.ctx.strokeStyle = '#2F1B14';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
  });
  
  // Draw gap indicators
  Object.keys(obstaclesByX).forEach(x => {
    const xPos = parseInt(x);
    const obstacles = obstaclesByX[x].sort((a, b) => a.y - b.y);
    
    let gapStart = 0;
    obstacles.forEach(obstacle => {
      if (obstacle.y > gapStart + 10) {
        const gapSize = obstacle.y - gapStart;
        const gapCenter = gapStart + gapSize / 2;
        
        // Color based on gap size
        if (gapSize >= 200) {
          this.ctx.fillStyle = '#00FF00'; // Green = easy
          this.ctx.fillText('✓ BIG', xPos + 20, gapCenter);
        } else if (gapSize >= 160) {
          this.ctx.fillStyle = '#FFAA00'; // Orange = ok
          this.ctx.fillText('✓ OK', xPos + 20, gapCenter);
        } else {
          this.ctx.fillStyle = '#FF0000'; // Red = too small
          this.ctx.fillText('❌ TOO SMALL', xPos + 20, gapCenter);
        }
        
        this.ctx.font = '10px Arial';
        this.ctx.textAlign = 'center';
      }
      gapStart = obstacle.y + obstacle.height;
    });
    
    // Final gap
    if (gapStart < this.gameState.config.height - 10) {
      const gapSize = this.gameState.config.height - gapStart;
      const gapCenter = gapStart + gapSize / 2;
      
      if (gapSize >= 200) {
        this.ctx.fillStyle = '#00FF00';
        this.ctx.fillText('✓ BIG', xPos + 20, gapCenter);
      } else if (gapSize >= 160) {
        this.ctx.fillStyle = '#FFAA00';
        this.ctx.fillText('✓ OK', xPos + 20, gapCenter);
      } else {
        this.ctx.fillStyle = '#FF0000';
        this.ctx.fillText('❌ TOO SMALL', xPos + 20, gapCenter);
      }
    }
  });
}
draw() {
  const gamePhase = this.gameState.gamePhase;
  
  // Clear canvas
  this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  
  if (gamePhase === 'waiting') {
    console.log('Drawing waiting screen');
    this.drawWaitingScreen();
    return;
  }
  
  if (['countdown', 'playing', 'finished'].includes(gamePhase)) {
    this.updateCamera();
    
    this.ctx.save();
    this.ctx.translate(-this.cameraX, 0);
    
    // Draw a test rectangle to see camera effect
    this.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
    this.ctx.fillRect(0, 0, 100, 100);
    
    this.drawBackground();
    this.drawObstacles();
    
    // DEBUG: Draw items với logs
    console.log(`🎁 Drawing ${this.gameState.items?.length || 0} items`);
    if (this.gameState.items && this.gameState.items.length > 0) {
      this.drawItems();
    }
    
    // DEBUG: Draw effects
    if (this.gameState.activeEffects && this.gameState.activeEffects.length > 0) {
      console.log(`⚡ Drawing ${this.gameState.activeEffects.length} effects`);
      this.drawActiveEffects();
    }
    
    this.drawPowerups();
    this.drawPlayers();
    this.drawRaceMarkers();
    
    this.ctx.restore();
    
    // Draw UI
    this.drawGameUI();
    this.drawCountdownOverlay();
    
    // DEBUG: Draw inventory nếu có items
    if (this.gameState.playerItems && this.gameState.myPlayer) {
      const playerItems = this.gameState.playerItems[this.gameState.myPlayer.playerId];
      if (playerItems && playerItems.length > 0) {
        console.log(`🎒 Player has ${playerItems.length} items`);
        this.drawPlayerInventory();
      }
    }
    
    console.log('Render complete');
  } else {
    console.log('Unknown or invalid game phase:', gamePhase);
    this.drawWaitingScreen();
  }
}





drawRaceMarkers() {
  if (!this.gameState.config) return;
  
  const startLine = this.gameState.config.startLine || 50;
  const turnAroundX = (this.gameState.config.turnAroundDistance || 5000) + startLine;
  
  // Draw start line (finish line)
  this.ctx.strokeStyle = '#00FF00';
  this.ctx.lineWidth = 4;
  this.ctx.setLineDash([]);
  this.ctx.beginPath();
  this.ctx.moveTo(startLine, 0);
  this.ctx.lineTo(startLine, this.gameState.config.height);
  this.ctx.stroke();
  
  // Start/Finish area
  this.ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
  this.ctx.fillRect(startLine - 20, 0, 40, this.gameState.config.height);
  
  // Draw turn around point
  this.ctx.strokeStyle = '#FF0000';
  this.ctx.lineWidth = 3;
  this.ctx.setLineDash([10, 10]);
  this.ctx.beginPath();
  this.ctx.moveTo(turnAroundX, 0);
  this.ctx.lineTo(turnAroundX, this.gameState.config.height);
  this.ctx.stroke();
  this.ctx.setLineDash([]);
  
  // Turn around area
  this.ctx.fillStyle = 'rgba(255, 0, 0, 0.1)';
  this.ctx.fillRect(turnAroundX, 0, 100, this.gameState.config.height);
  
  // Labels
  this.ctx.fillStyle = '#00FF00';
  this.ctx.font = 'bold 16px Arial';
  this.ctx.textAlign = 'center';
  this.ctx.fillText('START/FINISH', startLine, 25);
  
  this.ctx.fillStyle = '#FF0000';
  this.ctx.fillText('TURN AROUND', turnAroundX + 50, 25);
}
drawCountdownOverlay() {
  if (this.gameState.gamePhase !== 'countdown' || this.gameState.countdownTime <= 0) return;
  
  // Vẽ countdown overlay ở giữa màn hình (không bị ảnh hưởng camera)
  const centerX = this.canvas.width / 2;
  const centerY = this.canvas.height / 2;
  
  // Background overlay
  this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  this.ctx.fillRect(centerX - 120, centerY - 100, 240, 200);
  
  // Border
  this.ctx.strokeStyle = '#FFD700';
  this.ctx.lineWidth = 4;
  this.ctx.strokeRect(centerX - 120, centerY - 100, 240, 200);
  
  // Countdown number
  this.ctx.fillStyle = '#FFD700';
  this.ctx.font = 'bold 80px Arial';
  this.ctx.textAlign = 'center';
  this.ctx.fillText(
    Math.ceil(this.gameState.countdownTime).toString(),
    centerX,
    centerY + 20
  );
  
  // Label text
  this.ctx.fillStyle = '#FFFFFF';
  this.ctx.font = 'bold 20px Arial';
  this.ctx.fillText('GET READY!', centerX, centerY - 50);
  this.ctx.fillText('RACE STARTING...', centerX, centerY + 70);
}
  drawPlayers() {
  if (!this.gameState.players || this.gameState.players.length === 0) {
    console.log('No players to draw');
    return;
  }
  
  this.gameState.players.forEach(player => {
    const isMe = player.playerId === this.playerId;
    const isAlive = player.alive;
    
    // Vẽ chim
    this.ctx.save();
    this.ctx.translate(player.x, player.y);

        // Thêm jump effect cho player của mình
    if (isMe && this.jumpEffectTime && (Date.now() - this.jumpEffectTime < 200)) {
      this.ctx.strokeStyle = '#FFD700';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 20, 0, Math.PI * 2);
      this.ctx.stroke();
    }
    
    // Thân chim
    this.ctx.fillStyle = isAlive ? (isMe ? '#FFD700' : '#32CD32') : '#808080';
    if (player.invulnerable && isAlive) {
      this.ctx.fillStyle = '#FF69B4';
    }
    
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 15, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Viền chim
    this.ctx.strokeStyle = isMe ? '#FFA500' : '#333333';
    this.ctx.lineWidth = isMe ? 3 : 1;
    this.ctx.stroke();
    
    // Cánh chim
    this.ctx.fillStyle = isAlive ? '#228B22' : '#666666';
    this.ctx.beginPath();
    this.ctx.ellipse(-8, -5, 8, 4, 0, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Mắt chim
    this.ctx.fillStyle = '#000000';
    this.ctx.beginPath();
    this.ctx.arc(5, -5, 2, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.restore();
    
    // Tên người chơi
    this.ctx.fillStyle = '#000000';
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(
      player.playerId.slice(-4),
      player.x,
      player.y - 25
    );
    
    // Lives indicator - SỬA để hiển thị với số lớn
    if (player.lives < 10) {
      this.ctx.fillStyle = player.lives <= 3 ? '#FF0000' : '#FFA500'; // Đỏ khi <= 3, cam khi 4-9
      this.ctx.font = 'bold 10px Arial';
      this.ctx.fillText(
        `❤️ ${player.lives}`,
        player.x,
        player.y + 30
      );
    }
    
    // Direction indicator (hiển thị hướng bay)
    if (player.turnedAround) {
      this.ctx.fillStyle = '#00FF00';
      this.ctx.font = 'bold 12px Arial';
      this.ctx.fillText(
        '←', // Mũi tên về
        player.x + 20,
        player.y
      );
    }
  });
}

  drawGameUI() {
  if (!this.gameState.myPlayer) {
    // Vẽ thông tin cơ bản khi chưa có player
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(10, 10, 200, 60);
    
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '14px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.fillText('Waiting for player...', 20, 30);
    this.ctx.fillText(`Camera X: ${Math.floor(this.cameraX || 0)}`, 20, 50);
    return;
  }
  
  // Player stats
  this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  this.ctx.fillRect(10, 10, 250, 120);
  
  this.ctx.fillStyle = '#FFFFFF';
  this.ctx.font = '14px Arial';
  this.ctx.textAlign = 'left';
  
  const player = this.gameState.myPlayer;
  this.ctx.fillText(`Lives: ${player.lives || 0}`, 20, 30);
  this.ctx.fillText(`Distance: ${Math.floor(player.distance || 0)}`, 20, 50);
  this.ctx.fillText(`Player X: ${Math.floor(player.x || 0)}`, 20, 70);
  this.ctx.fillText(`Camera X: ${Math.floor(this.cameraX || 0)}`, 20, 90);
  
  if (player.finished) {
    this.ctx.fillText(`Rank: #${player.rank}`, 20, 110);
  }
  
  if (!player.alive) {
    this.ctx.fillStyle = '#FF6B6B';
    this.ctx.fillText('💀 DEAD - Respawning...', 20, 110);
  } else if (player.invulnerable) {
    this.ctx.fillStyle = '#FF69B4';
    this.ctx.fillText('🛡️ INVULNERABLE', 20, 110);
  }
}
    // ===== PLAYER MANAGEMENT =====
  updatePlayersList(players, roomOwner, playersReady) {
  const playersList = document.getElementById('playersList');
  if (!playersList) {
    console.error('playersList element not found');
    return;
  }
  
  if (!players || players.length === 0) {
    console.warn('No players to display:', players);
    playersList.innerHTML = '<div style="text-align: center; padding: 20px;">Không có người chơi nào</div>';
    return;
  }
  
  console.log('Updating players list:', {
    players: players,
    roomOwner: roomOwner,
    playersReady: playersReady,
    myId: this.playerId
  });
  
  playersList.innerHTML = '';
  
  players.forEach(player => {
    const playerItem = document.createElement('div');
    playerItem.className = 'player-item';
    
    const isOwner = player.playerId === roomOwner;
    const isReady = playersReady && playersReady[player.playerId];
    const isMe = player.playerId === this.playerId;
    const amIOwner = roomOwner === this.playerId;
    
    if (isOwner) playerItem.classList.add('room-owner');
    if (isReady) playerItem.classList.add('ready');
    
    playerItem.innerHTML = `
      <div class="player-info">
        <div class="player-name">
          👤 ${player.playerId.slice(-4)}${isMe ? ' (Bạn)' : ''}
        </div>
        <div class="player-badges">
          ${isOwner ? '<span class="player-badge badge-owner">👑 Chủ phòng</span>' : ''}
          ${isReady ? '<span class="player-badge badge-ready">✅ Sẵn sàng</span>' : '<span class="player-badge badge-not-ready">⏳ Chờ</span>'}
        </div>
      </div>
      <div class="player-actions">
        ${(amIOwner && !isMe) ? 
          `<button class="kick-btn" onclick="window.kickPlayer('${player.playerId}')">🚫 Kick</button>` : 
          ''}
      </div>
    `;
    
    playersList.appendChild(playerItem);
  });
  
  // Update ready button state
  this.updateReadyButton(playersReady);
}

    updateReadyButton(playersReady) {
  const readyBtn = document.getElementById('readyBtn');
  const readyStatus = document.getElementById('readyStatus');
  
  if (!readyBtn || !readyStatus) return;
  
  const isReady = playersReady && playersReady[this.playerId];
  
  if (isReady) {
    readyBtn.textContent = '❌ Hủy sẵn sàng';
    readyBtn.className = 'game-btn btn-warning';
    readyStatus.textContent = 'Đã sẵn sàng';
    readyStatus.className = 'ready-status ready';
  } else {
    readyBtn.textContent = '✅ Sẵn sàng';
    readyBtn.className = 'game-btn btn-success';
    readyStatus.textContent = 'Chưa sẵn sàng';
    readyStatus.className = 'ready-status waiting';
  }
  
  // Show total ready count
  if (playersReady) {
    const readyCount = Object.keys(playersReady).length;
    const totalPlayers = this.gameState.players.length;
    readyStatus.textContent += ` (${readyCount}/${totalPlayers})`;
    
    // THÊM: Thông báo có thể bắt đầu với 1 người
    if (totalPlayers === 1 && readyCount === 1) {
      readyStatus.textContent += ' - Bắt đầu ngay!';
    }
  }
}

toggleReady() {
  console.log('Toggle ready clicked'); // Debug log
  
  if (!this.gameState.gameId) {
    this.showError('Chưa vào phòng');
    return;
  }
  
  this.send({
    type: 'ready',
    gameId: this.gameState.gameId
  });
}

    kickPlayer(targetPlayerId) {
        if (confirm(`Bạn có muốn kick người chơi ${targetPlayerId.slice(-4)}?`)) {
            this.send({
                type: 'kickPlayer',
                gameId: this.gameState.gameId,
                targetPlayerId: targetPlayerId
            });
        }
    }
    drawWaitingScreen() {
        // Center text
        this.ctx.fillStyle = '#333333';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(
            'FLAPPY RACE',
            this.canvas.width / 2,
            this.canvas.height / 2 - 50
        );

        this.ctx.font = '24px Arial';
        this.ctx.fillText(
            'Chờ người chơi khác...',
            this.canvas.width / 2,
            this.canvas.height / 2 + 20
        );

        this.ctx.font = '18px Arial';
        this.ctx.fillText(
            `Người chơi: ${this.gameState.players.length}`,
            this.canvas.width / 2,
            this.canvas.height / 2 + 50
        );
    }
    
}
// Expose functions for HTML - ĐẶT Ở CUỐI FILE
window.toggleReady = function() {
  if (window.game) {
    window.game.toggleReady();
  }
};

window.kickPlayer = function(targetPlayerId) {
  if (window.game) {
    window.game.kickPlayer(targetPlayerId);
  }
};

// Đảm bảo game được gán vào window
let game;
window.addEventListener('DOMContentLoaded', () => {
  game = new FlappyRaceClient();
  window.game = game; // Expose game to window
});
// Initialize game when page loads


// Expose functions for HTML buttons
window.createGame = () => game.createGame();
window.joinGame = () => game.joinGame();
window.joinRandomGame = () => game.joinRandomGame();
window.resetGame = () => game.resetGame();
window.leaveGame = () => game.leaveGame();
window.copyGameId = () => game.copyGameId();
// Expose functions for HTML buttons
window.createGame = () => game.createGame();
window.joinGame = () => game.joinGame();
window.joinRandomGame = () => game.joinRandomGame();
window.resetGame = () => game.resetGame();
window.leaveGame = () => game.leaveGame();
window.copyGameId = () => game.copyGameId();
window.toggleReady = () => game.toggleReady();
window.kickPlayer = (targetPlayerId) => game.kickPlayer(targetPlayerId);

// Kiểm tra gameState có đủ dữ liệu không
console.log('GameState:', window.game.gameState);
console.log('Players:', window.game.gameState.players);
console.log('Obstacles:', window.game.gameState.obstacles);
console.log('Game Phase:', window.game.gameState.gamePhase);