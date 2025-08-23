// assets/js/flappy-race.js
const WS_URL = 'ws://localhost:8080';

class FlappyRaceClient {
  constructor() {
    this.ws = null;
    this.gameState = {
      playerId: null,
      gameId: null,
      gamePhase: 'waiting',
      config: null,
      players: [],
      obstacles: [],
      myPlayer: null
    };
    
    this.canvas = null;
    this.ctx = null;
    this.keys = {};
    
    this.init();
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
    this.ctx = this.canvas.getContext('2d');
    
    // Set canvas size
    this.canvas.width = 1200;
    this.canvas.height = 600;
    
    console.log('🎨 Canvas setup complete');
  }

  setupControls() {
    // Keyboard controls
    document.addEventListener('keydown', (e) => {
      this.keys[e.key] = true;
      
      if (e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault();
        this.jump();
      }
    });
    
    document.addEventListener('keyup', (e) => {
      this.keys[e.key] = false;
    });
    
    // Mouse/touch controls
    this.canvas.addEventListener('click', () => {
      this.jump();
    });
    
    // Button controls
    document.getElementById('jumpBtn').addEventListener('click', () => {
      this.jump();
    });
    
    console.log('🎮 Controls setup complete');
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
      case 'playerInfo':
        this.gameState.playerId = data.playerId;
        console.log(`👤 Player ID: ${data.playerId}`);
        break;
        
      case 'gameCreated':
      case 'gameJoined':
        this.onGameJoined(data);
        break;
        
      case 'gameState':
        this.updateGameState(data);
        break;
        
      case 'gameMessage':
        this.showMessage(data.message);
        break;

      case 'countdownStart':
        this.showMessage(data.message);
        this.showCountdownNotification();
        break;
        
      case 'countdownTick':
        this.showMessage(`⏱️ ${data.timeLeft}...`);
        break;
        
      case 'gameStart':
        this.showMessage(data.message);
        this.hideCountdownNotification();
        break;
        
      case 'gameEnd':
        this.onGameEnd(data);
        break;
        
      case 'error':
        this.showError(data.message);
        break;
        
      default:
        console.log('📨 Unknown message type:', data.type);
    }
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
    if (this.gameState.gamePhase !== 'playing') return;
    
    this.send({
      type: 'gameAction',
      gameId: this.gameState.gameId,
      action: 'jump'
    });
  }

  resetGame() {
    this.send({
      type: 'resetGame',
      gameId: this.gameState.gameId
    });
    
    document.getElementById('resetBtn').style.display = 'none';
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
          gamePhaseEl.textContent = '⏱️ Chuẩn bị bắt đầu!';
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
    const render = () => {
      this.render();
      requestAnimationFrame(render);
    };
    render();
  }

  render() {
    if (!this.ctx) return;
    
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Draw background
    this.drawBackground();
    
    if (this.gameState.gamePhase === 'playing' || this.gameState.gamePhase === 'finished') {
      // Draw obstacles
      this.drawObstacles();
      
      // Draw finish line
      this.drawFinishLine();
      
      // Draw players
      this.drawPlayers();
      
      // Draw UI
      this.drawGameUI();
    } else {
      // Draw waiting screen
      this.drawWaitingScreen();
    }
  }

  drawBackground() {
    // Sky gradient
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    gradient.addColorStop(0, '#87CEEB');
    gradient.addColorStop(1, '#98FB98');
    
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Clouds
    this.drawClouds();
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
    this.ctx.fillStyle = '#8B4513';
    
    this.gameState.obstacles.forEach(obstacle => {
      this.ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
      
      // Add border
      this.ctx.strokeStyle = '#654321';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    });
  }

  drawFinishLine() {
    if (!this.gameState.config) return;
    
    const finishX = this.gameState.config.finishDistance + 50;
    
    // Draw finish line
    this.ctx.strokeStyle = '#FF6B6B';
    this.ctx.lineWidth = 5;
    this.ctx.setLineDash([10, 10]);
    this.ctx.beginPath();
    this.ctx.moveTo(finishX, 0);
    this.ctx.lineTo(finishX, this.canvas.height);
    this.ctx.stroke();
    this.ctx.setLineDash([]);
    
    // Draw start line
    this.ctx.strokeStyle = '#4ECDC4';
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(50, 0);
    this.ctx.lineTo(50, this.canvas.height);
    this.ctx.stroke();
  }

  drawPlayers() {
    this.gameState.players.forEach((player, index) => {
      const isMe = player.playerId === this.gameState.playerId;
      
      // Player color
      let color = `hsl(${index * 60}, 70%, 50%)`;
      if (isMe) color = '#FFD700';
      if (!player.alive) color = '#666666';
      if (player.invulnerable) color = '#FF69B4';
      
      // Draw player
      this.ctx.fillStyle = color;
      this.ctx.fillRect(player.x - 15, player.y - 15, 30, 30);
      
      // Add border
      this.ctx.strokeStyle = isMe ? '#FFA500' : '#333333';
      this.ctx.lineWidth = isMe ? 3 : 1;
      this.ctx.strokeRect(player.x - 15, player.y - 15, 30, 30);
      
      // Player name
      this.ctx.fillStyle = '#000000';
      this.ctx.font = '12px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(
        player.playerId.slice(-4),
        player.x,
        player.y - 20
      );
      
      // Lives indicator
      if (player.lives < 3) {
        this.ctx.fillStyle = '#FF0000';
        this.ctx.font = 'bold 10px Arial';
        this.ctx.fillText(
          `❤️ ${player.lives}`,
          player.x,
          player.y + 30
        );
      }
      
      // Rank indicator
      if (player.finished && player.rank > 0) {
        this.ctx.fillStyle = '#FFD700';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.fillText(
          `#${player.rank}`,
          player.x,
          player.y + 45
        );
      }
    });
  }

  drawGameUI() {
    if (!this.gameState.myPlayer) return;
    
    // Player stats
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(10, 10, 200, 100);
    
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '14px Arial';
    this.ctx.textAlign = 'left';
    
    const player = this.gameState.myPlayer;
    this.ctx.fillText(`Lives: ${player.lives}`, 20, 30);
    this.ctx.fillText(`Distance: ${Math.floor(player.distance)}`, 20, 50);
    
    if (player.finished) {
      this.ctx.fillText(`Rank: #${player.rank}`, 20, 70);
    }
    
    if (!player.alive) {
      this.ctx.fillStyle = '#FF6B6B';
      this.ctx.fillText('💀 DEAD - Respawning...', 20, 90);
    } else if (player.invulnerable) {
      this.ctx.fillStyle = '#FF69B4';
      this.ctx.fillText('🛡️ INVULNERABLE', 20, 90);
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

// Initialize game when page loads
let game;
window.addEventListener('DOMContentLoaded', () => {
  game = new FlappyRaceClient();
});

// Expose functions for HTML buttons
window.createGame = () => game.createGame();
window.joinGame = () => game.joinGame();
window.joinRandomGame = () => game.joinRandomGame();
window.resetGame = () => game.resetGame();
window.leaveGame = () => game.leaveGame();
window.copyGameId = () => game.copyGameId();