// Xiangqi Game Client



class XiangqiGame {
    constructor() {
        this.ws = null;
        this.gameId = null;
        this.playerId = null;
        this.playerColor = null;
        this.gameState = null;
        this.selectedPiece = null;
        this.validMoves = [];

        // Timer variables
        this.moveTimer = null;
        this.totalTimers = {
            player1: 15 * 60, // 15 minutes in seconds
            player2: 15 * 60
        };
        this.moveTimeLeft = 20;
        this.currentPlayerTimer = null;

        // Game settings
        this.gameSettings = {
            colorSelection: 'random',
            firstPlayer: 'random'
        };

        // Host status
        this.isHost = false;

        this.canvas = null;
        this.ctx = null;

        this.init();
    }

    init() {
        this.initCanvas();
        this.connectWebSocket();
        this.setupEventListeners();
    }

    initCanvas() {
        this.canvas = document.getElementById('xiangqiCanvas');
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
            this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
            this.drawBoard();
        }
    }

    setupEventListeners() {
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.clearSelection();
            }
        });

        // Setup color selection buttons
        document.getElementById('colorSelection').addEventListener('click', (e) => {
            if (e.target.dataset.color) {
                this.selectColor(e.target.dataset.color, e.target);
            }
        });

        // Setup first player selection buttons
        document.getElementById('firstPlayerSelection').addEventListener('click', (e) => {
            if (e.target.dataset.first) {
                this.selectFirstPlayer(e.target.dataset.first, e.target);
            }
        });
    }

    connectWebSocket() {
        this.ws = new WebSocket('ws://localhost:8080');

        this.ws.onopen = () => {
            this.updateConnectionStatus('connected', '✅ Đã kết nối');
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };

        this.ws.onclose = () => {
            this.updateConnectionStatus('disconnected', '❌ Mất kết nối');
            this.stopTimers();
        };

        this.ws.onerror = () => {
            this.updateConnectionStatus('error', '⚠️ Lỗi kết nối');
        };
    }

    updateConnectionStatus(status, message) {
        const statusEl = document.getElementById('connectionStatus');
        statusEl.textContent = message;
        statusEl.className = `connection-status ${status} alert alert-${status === 'connected' ? 'success' : 'danger'} text-center`;
    }

    handleMessage(data) {
        console.log('Received message:', data);

        switch (data.type) {
            case 'playerInfo':
                this.playerId = data.playerId;
                break;

            case 'gameCreated':
                this.gameId = data.gameId;
                this.playerColor = data.playerInfo?.color;
                this.isHost = data.playerInfo?.isHost || true;
                this.isSpectator = false;

                document.getElementById('currentGameId').textContent = this.gameId;
                document.getElementById('setupGameId').textContent = this.gameId;

                this.showSetupSection();
                break;

            case 'gameJoined':
                this.gameId = data.gameId;
                this.playerColor = data.playerInfo?.color;
                this.isHost = data.playerInfo?.isHost || false;
                this.isSpectator = data.playerInfo?.isSpectator || false;

                document.getElementById('currentGameId').textContent = this.gameId;
                document.getElementById('setupGameId').textContent = this.gameId;

                if (this.isSpectator) {
                    this.showSpectatorMode();
                } else {
                    this.showSetupSection();
                }
                break;

            case 'gameState':
                this.gameState = data;
                this.updateUI();

                // QUAN TRỌNG: Kiểm tra status game sau mỗi nước đi
                if (this.gameState.status === 'playing') {
                    setTimeout(() => {
                        this.checkGameStatus();
                    }, 100);
                }
                break;

            case 'readyUpdate':
                this.updateReadyStatus(data.playersReady);
                break;

            case 'settingsUpdate':
                console.log('Received settings update:', data.settings);
                if (data.settings) {
                    this.gameSettings = data.settings;
                    this.updateGuestSettingsDisplay(data.settings);
                }
                break;

            case 'error':
                this.showError(data.message);
                break;

            case 'gameMessage':
                this.showSuccess(data.message);
                break;
        }
    }

showError(message) {
    const statusEl = document.getElementById('gameStatus');
    const originalContent = statusEl.innerHTML;
    
    statusEl.innerHTML = `
        <div class="error-message" style="background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 15px; border-radius: 12px; font-weight: bold; animation: shake 0.5s ease-in-out;">
            ❌ ${message}
        </div>
    `;
    
    setTimeout(() => {
        statusEl.innerHTML = originalContent;
    }, 3000);
}

showSuccess(message) {
    const statusEl = document.getElementById('gameStatus');
    const originalContent = statusEl.innerHTML;
    
    statusEl.innerHTML = `
        <div class="success-message" style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 15px; border-radius: 12px; font-weight: bold; animation: fadeInUp 0.5s ease-out;">
            ✅ ${message}
        </div>
    `;
    
    setTimeout(() => {
        statusEl.innerHTML = originalContent;
    }, 3000);
}

    // Game flow methods
    createGame() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.showError('Chưa kết nối được server');
            return;
        }

        this.ws.send(JSON.stringify({
            type: 'createGame',
            gameType: 'xiangqi'
        }));
    }

    joinGame() {
        const gameId = document.getElementById('gameIdInput').value.trim();
        if (!gameId) {
            this.showError('Vui lòng nhập mã phòng');
            return;
        }

        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            this.showError('Chưa kết nối được server');
            return;
        }

        this.ws.send(JSON.stringify({
            type: 'joinGame',
            gameId: gameId
        }));
    }

    selectColor(color, buttonElement) {
        if (!this.isHost) return; // Chỉ host mới được chọn

        this.gameSettings.colorSelection = color;

        // Update UI
        document.querySelectorAll('#colorSelection .btn').forEach(btn => {
            btn.classList.remove('active');
        });
        buttonElement.classList.add('active');

        // Broadcast settings to other players
        this.broadcastSettings();
    }

    selectFirstPlayer(player, buttonElement) {
        if (!this.isHost) return; // Chỉ host mới được chọn

        this.gameSettings.firstPlayer = player;

        // Update UI
        document.querySelectorAll('#firstPlayerSelection .btn').forEach(btn => {
            btn.classList.remove('active');
        });
        buttonElement.classList.add('active');

        // Broadcast settings to other players
        this.broadcastSettings();
    }

    broadcastSettings() {
        console.log('Broadcasting settings:', this.gameSettings);
        // Gửi settings cho server để broadcast cho players khác
        this.ws.send(JSON.stringify({
            type: 'broadcastSettings',
            gameId: this.gameId,
            settings: this.gameSettings
        }));
    }

    updateGuestSettingsDisplay(settings) {
        // Cập nhật hiển thị settings cho guest và spectator
        const colorMap = {
            'red': 'Đỏ',
            'black': 'Đen',
            'random': 'Ngẫu nhiên'
        };

        const firstMap = {
            'red': 'Đỏ đi trước',
            'black': 'Đen đi trước',
            'random': 'Ngẫu nhiên'
        };

        const colorEl = document.getElementById('displayColorChoice');
        const firstEl = document.getElementById('displayFirstPlayer');

        if (colorEl) {
            colorEl.textContent = colorMap[settings.colorSelection] || 'Ngẫu nhiên';
            console.log('Updated color display:', colorMap[settings.colorSelection]);
        }
        if (firstEl) {
            firstEl.textContent = firstMap[settings.firstPlayer] || 'Ngẫu nhiên';
            console.log('Updated first player display:', firstMap[settings.firstPlayer]);
        }

        // Cập nhật cho spectator nếu có
        const statusEl = document.getElementById('gameStatus');
        if (this.isSpectator && statusEl) {
            statusEl.innerHTML = `
                👁️ Bạn đang xem trận đấu<br>
                <small>🎨 ${colorMap[settings.colorSelection]} | 🎯 ${firstMap[settings.firstPlayer]}</small>
            `;
        }
    }

    playerReady() {
        if (!this.gameId) {
            this.showError('Chưa vào phòng');
            return;
        }

        // Chỉ gửi settings nếu là host
        const dataToSend = {
            type: 'ready',
            gameId: this.gameId
        };

        if (this.isHost) {
            dataToSend.settings = this.gameSettings;
        }

        this.ws.send(JSON.stringify(dataToSend));

        document.getElementById('readyBtn').disabled = true;
        document.getElementById('readyStatus').innerHTML = '<span class="ready-status">✅ Đã sẵn sàng</span>';
    }

    updateReadyStatus(playersReady) {
        const readyCount = Object.keys(playersReady).length;
        const statusEl = document.getElementById('readyStatus');

        if (readyCount === 1) {
            statusEl.innerHTML = '<span class="ready-status">✅ Chờ đối thủ sẵn sàng...</span>';
        } else if (readyCount === 2) {
            statusEl.innerHTML = '<span class="ready-status">🎮 Bắt đầu game!</span>';
            setTimeout(() => {
                this.showSuccess('Game đã bắt đầu!');
            }, 1000);
        }
    }

    // UI update methods
    updateUI() {
        if (!this.gameState) return;

        console.log('Updating UI, game status:', this.gameState.status);

        switch (this.gameState.status) {
            case 'setup':
                this.showSetupSection();
                break;
            case 'playing':
                this.showGameSection();
                this.updatePlayerInfo();
                this.drawBoard();
                this.startTimers();
                break;
            case 'finished':
                this.showGameResult();
                this.stopTimers();
                break;
        }
    }

    showSpectatorMode() {
        document.getElementById('mainMenu').classList.add('hidden');
        document.getElementById('gameSetup').classList.add('hidden');
        document.getElementById('gameSection').classList.remove('hidden');

        // Hiển thị thông báo spectator
        const statusEl = document.getElementById('gameStatus');
        statusEl.innerHTML = '👁️ Bạn đang xem trận đấu';
        statusEl.style.background = 'rgba(108, 117, 125, 0.3)';

        // Ẩn các button điều khiển
        document.getElementById('newGameBtn').style.display = 'none';
    }

    showSetupSection() {
        document.getElementById('mainMenu').classList.add('hidden');
        document.getElementById('gameSetup').classList.remove('hidden');
        document.getElementById('gameSection').classList.add('hidden');

        // Hiển thị giao diện phù hợp
        if (this.isHost) {
            document.getElementById('hostSettings').classList.remove('hidden');
            document.getElementById('guestSettings').classList.add('hidden');
        } else {
            document.getElementById('hostSettings').classList.add('hidden');
            document.getElementById('guestSettings').classList.remove('hidden');
        }
    }

    showGameSection() {
        document.getElementById('mainMenu').classList.add('hidden');
        document.getElementById('gameSetup').classList.add('hidden');
        document.getElementById('gameSection').classList.remove('hidden');

        // Hiển thị/ẩn button đầu hàng cho spectator
        const surrenderBtn = document.getElementById('surrenderBtn');
        const newGameBtn = document.getElementById('newGameBtn');

        if (this.isSpectator) {
            surrenderBtn.style.display = 'none';
            newGameBtn.style.display = 'none';
        } else {
            surrenderBtn.style.display = 'inline-block';
            newGameBtn.style.display = 'inline-block';
        }
    }

showGameResult() {
    const winner = this.gameState.winner;
    const reason = this.gameState.endReason || '';
    const statusEl = document.getElementById('gameStatus');

    let resultHTML = '';
    
    if (winner === 'draw') {
        resultHTML = `
            <div style="background: linear-gradient(135deg, #6b7280, #4b5563); padding: 20px; border-radius: 15px; color: white; text-align: center; animation: fadeInUp 0.5s ease-out;">
                <div style="font-size: 2em; margin-bottom: 10px;">🤝</div>
                <div style="font-size: 1.2em; font-weight: bold; margin-bottom: 5px;">Hòa!</div>
                <div style="font-size: 0.9em; opacity: 0.8;">${reason}</div>
            </div>
        `;
    } else if (winner === this.playerColor) {
        resultHTML = `
            <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 20px; border-radius: 15px; color: white; text-align: center; animation: celebrate 2s infinite;">
                <div style="font-size: 2em; margin-bottom: 10px;">🎉</div>
                <div style="font-size: 1.2em; font-weight: bold; margin-bottom: 5px;">Bạn thắng!</div>
                <div style="font-size: 0.9em; opacity: 0.8;">${reason}</div>
            </div>
        `;
    } else {
        resultHTML = `
            <div style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 20px; border-radius: 15px; color: white; text-align: center; animation: fadeInUp 0.5s ease-out;">
                <div style="font-size: 2em; margin-bottom: 10px;">😔</div>
                <div style="font-size: 1.2em; font-weight: bold; margin-bottom: 5px;">Bạn thua!</div>
                <div style="font-size: 0.9em; opacity: 0.8;">${reason}</div>
            </div>
        `;
    }
    
    statusEl.innerHTML = resultHTML;
    this.stopTimers();
}

updatePlayerInfo() {
    if (!this.gameState.players) return;

    const players = this.gameState.players;
    const isMyTurn = this.gameState.currentPlayer === this.playerColor;

    players.forEach((player, index) => {
        const playerCard = document.getElementById(`player${index + 1}Card`);
        const isCurrentPlayer = player.color === this.gameState.currentPlayer;
        const isMe = player.playerId === this.playerId;

        // Update player name and color
        const playerName = document.getElementById(`player${index + 1}Name`);
        const playerColor = playerCard.querySelector('.player-color');
        const statusIndicator = document.getElementById(`player${index + 1}Status`);

        if (playerName) {
            playerName.textContent = isMe ? 'Bạn' : (player.name || 'Đối thủ');
        }

        if (playerColor) {
            playerColor.innerHTML = player.color === 'red' ? 
                '🔴 Quân Đỏ' : '⚫ Quân Đen';
        }

        // Update status indicator
        if (statusIndicator) {
            if (isCurrentPlayer) {
                statusIndicator.textContent = isMe ? 'Lượt của bạn!' : 'Đang suy nghĩ...';
                statusIndicator.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            } else {
                statusIndicator.textContent = 'Chờ...';
                statusIndicator.style.background = 'linear-gradient(135deg, #6b7280, #4b5563)';
            }
        }

        // Update card appearance
        playerCard.classList.toggle('active-turn', isCurrentPlayer);
        playerCard.classList.toggle('you', isMe);

        // Update avatar glow effect
        const avatar = playerCard.querySelector('.avatar-circle');
        if (avatar) {
            avatar.style.transform = isCurrentPlayer ? 'scale(1.1)' : 'scale(1)';
            avatar.style.boxShadow = isCurrentPlayer ? 
                '0 6px 20px rgba(245, 158, 11, 0.4)' : 
                '0 4px 12px rgba(0, 0, 0, 0.1)';
        }
    });

    // Update game status
    this.updateGameStatus(isMyTurn);
}

updateGameStatus(isMyTurn) {
    const statusEl = document.getElementById('gameStatus');
    if (!statusEl) return;

    // Kiểm tra chiếu
    const myColor = this.playerColor;
    const isInCheck = this.gameState.isInCheck && this.gameState.isInCheck[myColor];

    if (isInCheck) {
        // Đang bị chiếu - cảnh báo khẩn cấp
        statusEl.innerHTML = `
            <div style="background: linear-gradient(135deg, #ef4444, #dc2626); padding: 15px; border-radius: 12px; color: white; font-weight: bold; animation: pulse-danger 1s infinite;">
                ⚠️ BẠN ĐANG BỊ CHIẾU! Phải bảo vệ Tướng!
            </div>
        `;
    } else if (isMyTurn) {
        statusEl.innerHTML = `
            <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 15px; border-radius: 12px; color: white; font-weight: bold;">
                🎯 Lượt của bạn! Hãy di chuyển quân cờ
            </div>
        `;
    } else {
        statusEl.innerHTML = `
            <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 15px; border-radius: 12px; color: white; font-weight: bold;">
                ⏳ Chờ đối thủ đi... Hãy kiên nhẫn
            </div>
        `;
    }
}

    // Timer methods
    startTimers() {
        this.stopTimers(); // Clear existing timers
        this.resetMoveTimer();

        // Start move timer
        this.moveTimer = setInterval(() => {
            this.moveTimeLeft--;
            this.updateMoveTimerDisplay();

            if (this.moveTimeLeft <= 0) {
                this.handleMoveTimeout();
            }
        }, 1000);

        // Start total timer for current player
        this.startCurrentPlayerTimer();
    }

    startCurrentPlayerTimer() {
        if (this.currentPlayerTimer) {
            clearInterval(this.currentPlayerTimer);
        }

        this.currentPlayerTimer = setInterval(() => {
            const currentPlayerIndex = this.getCurrentPlayerIndex();
            const timerKey = `player${currentPlayerIndex + 1}`;

            if (this.totalTimers[timerKey] > 0) {
                this.totalTimers[timerKey]--;
                this.updateTotalTimerDisplay();

                if (this.totalTimers[timerKey] <= 0) {
                    this.handleTotalTimeout();
                }
            }
        }, 1000);
    }

    stopTimers() {
        if (this.moveTimer) {
            clearInterval(this.moveTimer);
            this.moveTimer = null;
        }
        if (this.currentPlayerTimer) {
            clearInterval(this.currentPlayerTimer);
            this.currentPlayerTimer = null;
        }
    }

    resetMoveTimer() {
        this.moveTimeLeft = 20;
        this.updateMoveTimerDisplay();
    }

updateMoveTimerDisplay() {
    const currentPlayerIndex = this.getCurrentPlayerIndex();
    const timerEl = document.getElementById(`player${currentPlayerIndex + 1}MoveTimer`);

    if (timerEl) {
        timerEl.textContent = `${this.moveTimeLeft}s`;
        timerEl.className = 'timer-move';

        // Thêm hiệu ứng cảnh báo
        if (this.moveTimeLeft <= 5) {
            timerEl.classList.add('danger');
            timerEl.style.color = '#ef4444';
            timerEl.style.animation = 'pulse-danger 0.5s infinite';
        } else if (this.moveTimeLeft <= 10) {
            timerEl.classList.add('warning');
            timerEl.style.color = '#f59e0b';
            timerEl.style.animation = 'pulse-warning 1s infinite';
        } else {
            timerEl.style.color = '#10b981';
            timerEl.style.animation = 'none';
        }
    }

    // Update cho player không phải lượt hiện tại
    const otherPlayerIndex = currentPlayerIndex === 0 ? 1 : 0;
    const otherTimerEl = document.getElementById(`player${otherPlayerIndex + 1}MoveTimer`);
    if (otherTimerEl) {
        otherTimerEl.textContent = '---';
        otherTimerEl.style.color = '#6b7280';
        otherTimerEl.style.animation = 'none';
    }
}

    updateTotalTimerDisplay() {
        ['player1', 'player2'].forEach((key, index) => {
            const minutes = Math.floor(this.totalTimers[key] / 60);
            const seconds = this.totalTimers[key] % 60;
            const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;

            const timerEl = document.getElementById(`${key}TotalTimer`);
            if (timerEl) {
                timerEl.textContent = timeString;

                // Add warning styles for low time
                if (this.totalTimers[key] <= 60) {
                    timerEl.style.color = '#f44336';
                } else if (this.totalTimers[key] <= 300) {
                    timerEl.style.color = '#FF9800';
                } else {
                    timerEl.style.color = '#e0e0e0';
                }
            }
        });
    }

    getCurrentPlayerIndex() {
        if (!this.gameState?.players) return 0;
        return this.gameState.players.findIndex(p => p.color === this.gameState.currentPlayer);
    }

    handleMoveTimeout() {
        this.showError('Hết thời gian! Tự động bỏ lượt.');
        this.resetMoveTimer();
        // In a real implementation, you might want to auto-pass the turn
    }

    handleTotalTimeout() {
        this.showError('Hết thời gian tổng! Game kết thúc.');
        this.stopTimers();
    }

    // Board drawing methods
    
    



    drawBoard() {
    if (!this.ctx) return;

    const ctx = this.ctx;
    const canvas = this.canvas;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Determine board orientation based on player color
    const isRedPlayer = this.playerColor === 'red' || this.isSpectator;

    // CÁC THÔNG SỐ MỚI - PHÓNG TO VÀ CĂN GIỮA
    const CELL_SIZE = 50;
    const BOARD_WIDTH = CELL_SIZE * 8;
    const BOARD_HEIGHT = CELL_SIZE * 9;

    // Tính toán để căn giữa bàn cờ
    const ORIGIN_X = (canvas.width - BOARD_WIDTH) / 2;
    const ORIGIN_Y = (canvas.height - BOARD_HEIGHT) / 2;

    // Board background với gradient đẹp hơn
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#f4e8d0');
    gradient.addColorStop(0.5, '#faf0e6');
    gradient.addColorStop(1, '#f4e8d0');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Vẽ viền bàn cờ
    ctx.strokeStyle = '#8b4513';
    ctx.lineWidth = 4;
    ctx.strokeRect(ORIGIN_X - 5, ORIGIN_Y - 5, BOARD_WIDTH + 10, BOARD_HEIGHT + 10);

    // Draw grid lines với màu đẹp hơn
    ctx.strokeStyle = '#5d4037';
    ctx.lineWidth = 2;

    // Vertical lines (9 columns)
    for (let i = 0; i < 9; i++) {
        const x = ORIGIN_X + i * CELL_SIZE;
        ctx.beginPath();
        ctx.moveTo(x, ORIGIN_Y);
        ctx.lineTo(x, ORIGIN_Y + BOARD_HEIGHT);
        ctx.stroke();
    }

    // Horizontal lines (10 rows)
    for (let i = 0; i <= 9; i++) {
        const y = ORIGIN_Y + i * CELL_SIZE;
        ctx.beginPath();
        ctx.moveTo(ORIGIN_X, y);
        ctx.lineTo(ORIGIN_X + BOARD_WIDTH, y);
        ctx.stroke();
    }

    // Draw river với thiết kế đẹp hơn
    const riverY = ORIGIN_Y + 4 * CELL_SIZE;
    
    // River background
    const riverGradient = ctx.createLinearGradient(0, riverY, 0, riverY + CELL_SIZE);
    riverGradient.addColorStop(0, 'rgba(3, 218, 164, 0.2)');
    riverGradient.addColorStop(0.5, 'rgba(3, 218, 164, 0.4)');
    riverGradient.addColorStop(1, 'rgba(3, 218, 164, 0.2)');
    ctx.fillStyle = riverGradient;
    ctx.fillRect(ORIGIN_X, riverY, BOARD_WIDTH, CELL_SIZE);

    // River border
    ctx.strokeStyle = '#03daa4';
    ctx.lineWidth = 2;
    ctx.strokeRect(ORIGIN_X, riverY, BOARD_WIDTH, CELL_SIZE);

    // Draw river text với font đẹp hơn
    ctx.fillStyle = '#8b4513';
    ctx.font = 'bold 24px "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
    ctx.shadowBlur = 2;
    
    ctx.fillText('楚河', ORIGIN_X + 2 * CELL_SIZE, riverY + CELL_SIZE / 2 + 8);
    ctx.fillText('漢界', ORIGIN_X + 6 * CELL_SIZE, riverY + CELL_SIZE / 2 + 8);
    
    // Reset shadow
    ctx.shadowColor = 'transparent';

    // Draw palace boundaries với thiết kế nổi bật hơn
    this.drawPalace(ctx, ORIGIN_X + 3 * CELL_SIZE, ORIGIN_Y, 'black'); // Black palace (top)
    this.drawPalace(ctx, ORIGIN_X + 3 * CELL_SIZE, ORIGIN_Y + 7 * CELL_SIZE, 'red'); // Red palace (bottom)

    // Lưu các thông số để dùng cho các function khác
    this.CELL_SIZE = CELL_SIZE;
    this.ORIGIN_X = ORIGIN_X;
    this.ORIGIN_Y = ORIGIN_Y;

    // Draw pieces with proper orientation
    if (this.gameState?.board) {
        this.drawPieces(isRedPlayer);
    }

    // Draw selected piece highlight
    if (this.selectedPiece) {
        const displayPos = this.getBoardPosition(this.selectedPiece.col, this.selectedPiece.row, isRedPlayer);
        this.highlightSquare(displayPos.col, displayPos.row, '#FFD700', 4);
    }

    // Draw valid moves
    this.validMoves.forEach(move => {
        const displayPos = this.getBoardPosition(move.col, move.row, isRedPlayer);
        this.highlightSquare(displayPos.col, displayPos.row, '#4CAF50', 3);
    });
}


    getBoardPosition(col, row, isRedPlayer) {
        if (isRedPlayer) {
            // Red player view: bàn cờ bình thường
            return { col, row };
        } else {
            // Black player view: xoay bàn cờ 180 độ
            return {
                col: 8 - col,
                row: 9 - row
            };
        }
    }
drawPalace(ctx, x, y, color) {
    const CELL_SIZE = this.CELL_SIZE || 50;
    
    // Palace background
    const palaceGradient = ctx.createRadialGradient(
        x + CELL_SIZE, y + CELL_SIZE, 0,
        x + CELL_SIZE, y + CELL_SIZE, CELL_SIZE * 1.5
    );
    
    if (color === 'red') {
        palaceGradient.addColorStop(0, 'rgba(220, 38, 38, 0.1)');
        palaceGradient.addColorStop(1, 'rgba(220, 38, 38, 0.05)');
    } else {
        palaceGradient.addColorStop(0, 'rgba(55, 65, 81, 0.1)');
        palaceGradient.addColorStop(1, 'rgba(55, 65, 81, 0.05)');
    }
    
    ctx.fillStyle = palaceGradient;
    ctx.fillRect(x, y, 2 * CELL_SIZE, 2 * CELL_SIZE);

    // Palace lines
    ctx.strokeStyle = color === 'red' ? '#dc2626' : '#374151';
    ctx.lineWidth = 3;

    // 2 đường chéo
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 2 * CELL_SIZE, y + 2 * CELL_SIZE);
    ctx.moveTo(x + 2 * CELL_SIZE, y);
    ctx.lineTo(x, y + 2 * CELL_SIZE);
    ctx.stroke();
}

drawPieces(isRedPlayer = true) {
    const board = this.gameState.board;

    for (let row = 0; row < 10; row++) {
        for (let col = 0; col < 9; col++) {
            const piece = board[row][col];
            if (piece) {
                const displayPos = this.getBoardPosition(col, row, isRedPlayer);
                this.drawPiece(displayPos.col, displayPos.row, piece);
            }
        }
    }
}



drawPiece(col, row, piece) {
    const CELL_SIZE = this.CELL_SIZE || 50;
    const ORIGIN_X = this.ORIGIN_X || 10;
    const ORIGIN_Y = this.ORIGIN_Y || 5;

    const x = ORIGIN_X + col * CELL_SIZE;
    const y = ORIGIN_Y + row * CELL_SIZE;
    const radius = 22; // Tăng từ 20 lên 22

    const isRed = piece.startsWith('r_');
    const pieceType = piece.split('_')[1];

    // Piece shadow - đẹp hơn
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    this.ctx.beginPath();
    this.ctx.arc(x + 2, y + 3, radius, 0, 2 * Math.PI);
    this.ctx.fill();

    // Piece background với gradient
    const pieceGradient = this.ctx.createRadialGradient(
        x - 5, y - 5, 0,
        x, y, radius
    );
    
    if (isRed) {
        pieceGradient.addColorStop(0, '#ffffff');
        pieceGradient.addColorStop(0.7, '#fef7f7');
        pieceGradient.addColorStop(1, '#fee2e2');
    } else {
        pieceGradient.addColorStop(0, '#ffffff');
        pieceGradient.addColorStop(0.7, '#f9fafb');
        pieceGradient.addColorStop(1, '#f3f4f6');
    }
    
    this.ctx.fillStyle = pieceGradient;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
    this.ctx.fill();

    // Piece border - thick và đẹp
    this.ctx.strokeStyle = isRed ? '#dc2626' : '#1f2937';
    this.ctx.lineWidth = 3;
    this.ctx.stroke();

    // Inner circle for depth
    this.ctx.strokeStyle = isRed ? '#fca5a5' : '#9ca3af';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius - 4, 0, 2 * Math.PI);
    this.ctx.stroke();

    // Text shadow
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    this.ctx.font = 'bold 24px "Times New Roman", serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(pieceType, x + 1, y + 1);

    // Piece text - bold và clear
    this.ctx.fillStyle = isRed ? '#dc2626' : '#1f2937';
    this.ctx.font = 'bold 24px "Times New Roman", serif';
    this.ctx.fillText(pieceType, x, y);
}





highlightSquare(col, row, color, lineWidth = 3) {
    const CELL_SIZE = this.CELL_SIZE || 50;
    const ORIGIN_X = this.ORIGIN_X || 10;
    const ORIGIN_Y = this.ORIGIN_Y || 5;

    const x = ORIGIN_X + col * CELL_SIZE;
    const y = ORIGIN_Y + row * CELL_SIZE;
    const size = 40; // Tăng từ 38 lên 40

    // Highlight background
    this.ctx.fillStyle = color + '20'; // Add transparency
    this.ctx.fillRect(x - size / 2, y - size / 2, size, size);

    // Highlight border
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.strokeRect(x - size / 2, y - size / 2, size, size);

    // Corner highlights for better visual
    const cornerSize = 8;
    this.ctx.lineWidth = lineWidth + 1;
    
    // Top-left corner
    this.ctx.beginPath();
    this.ctx.moveTo(x - size / 2, y - size / 2 + cornerSize);
    this.ctx.lineTo(x - size / 2, y - size / 2);
    this.ctx.lineTo(x - size / 2 + cornerSize, y - size / 2);
    this.ctx.stroke();
    
    // Top-right corner
    this.ctx.beginPath();
    this.ctx.moveTo(x + size / 2 - cornerSize, y - size / 2);
    this.ctx.lineTo(x + size / 2, y - size / 2);
    this.ctx.lineTo(x + size / 2, y - size / 2 + cornerSize);
    this.ctx.stroke();
    
    // Bottom-left corner
    this.ctx.beginPath();
    this.ctx.moveTo(x - size / 2, y + size / 2 - cornerSize);
    this.ctx.lineTo(x - size / 2, y + size / 2);
    this.ctx.lineTo(x - size / 2 + cornerSize, y + size / 2);
    this.ctx.stroke();
    
    // Bottom-right corner
    this.ctx.beginPath();
    this.ctx.moveTo(x + size / 2 - cornerSize, y + size / 2);
    this.ctx.lineTo(x + size / 2, y + size / 2);
    this.ctx.lineTo(x + size / 2, y + size / 2 - cornerSize);
    this.ctx.stroke();
}

    // Game interaction methods
    handleCanvasClick(event) {
        if (this.gameState?.status !== 'playing') return;
        if (this.isSpectator) return;
        if (this.gameState.currentPlayer !== this.playerColor) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        const CELL_SIZE = this.CELL_SIZE || 50;
        const ORIGIN_X = this.ORIGIN_X || 10;
        const ORIGIN_Y = this.ORIGIN_Y || 5;

        // Convert to display coordinates với kích thước mới
        const displayCol = Math.round((x - ORIGIN_X) / CELL_SIZE);
        const displayRow = Math.round((y - ORIGIN_Y) / CELL_SIZE);

        if (displayCol < 0 || displayCol > 8 || displayRow < 0 || displayRow > 9) return;

        // Convert display coordinates to actual board coordinates
        let col, row;
        if (this.playerColor === 'red' || this.isSpectator) {
            col = displayCol;
            row = displayRow;
        } else {
            col = 8 - displayCol;
            row = 9 - displayRow;
        }

        const piece = this.gameState.board[row][col];

        if (this.selectedPiece) {
            if (this.isValidMove(col, row)) {
                this.makeMove(this.selectedPiece.col, this.selectedPiece.row, col, row);
            } else if (piece && this.isPieceOwnedByPlayer(piece)) {
                this.selectPiece(col, row);
            } else {
                this.clearSelection();
            }
        } else if (piece && this.isPieceOwnedByPlayer(piece)) {
            this.selectPiece(col, row);
        }

        this.drawBoard();
    }

    selectPiece(col, row) {
        this.selectedPiece = { col, row };
        // Chỉ lấy các nước đi hợp lệ (không để tướng bị chiếu)
        this.validMoves = this.getFilteredLegalMoves(col, row);
    }

    clearSelection() {
        this.selectedPiece = null;
        this.validMoves = [];
        this.drawBoard();
    }

    isPieceOwnedByPlayer(piece) {
        const isRed = piece.startsWith('r_');
        return (isRed && this.playerColor === 'red') || (!isRed && this.playerColor === 'black');
    }

    isValidMove(col, row) {
        return this.validMoves.some(move => move.col === col && move.row === row);
    }

    // ===== Move generation (chuẩn luật cơ bản) =====
    getValidMovesForPiece(col, row) {
        const piece = this.gameState.board[row][col];
        if (!piece) return [];
        const isRed = piece.startsWith('r_');
        const type = piece.split('_')[1];

        // Đồng bộ hoá nhiều biến thể chữ
        const map = {
            ROOK: new Set(['車', '车']),
            KNIGHT: new Set(['馬', '马']),
            ELEPHANT: new Set(['象', '相']),
            ADVISOR: new Set(['士', '仕']),
            GENERAL: new Set(['將', '帅', '帥']),
            CANNON: new Set(['炮', '砲']),
            SOLDIER: new Set(['兵', '卒'])
        };

        if (map.ROOK.has(type)) return this.rookMoves(col, row, isRed);
        if (map.CANNON.has(type)) return this.cannonMoves(col, row, isRed);
        if (map.KNIGHT.has(type)) return this.knightMoves(col, row, isRed);
        if (map.ELEPHANT.has(type)) return this.elephantMoves(col, row, isRed);
        if (map.ADVISOR.has(type)) return this.advisorMoves(col, row, isRed);
        if (map.GENERAL.has(type)) return this.generalMoves(col, row, isRed);
        if (map.SOLDIER.has(type)) return this.soldierMoves(col, row, isRed);
        return [];
    }

    // ---- Helpers chung ----
    inBounds(c, r) { return c >= 0 && c <= 8 && r >= 0 && r <= 9; }
    isEmpty(c, r) { return this.inBounds(c, r) && !this.gameState.board[r][c]; }
    isEnemy(c, r, isRed) {
        if (!this.inBounds(c, r)) return false;
        const t = this.gameState.board[r][c];
        return t && (t.startsWith('r_') !== isRed);
    }

    // ---- Xe (Rook) ----
    rookMoves(col, row, isRed) {
        const moves = [];
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dx, dy] of dirs) {
            let c = col + dx, r = row + dy;
            while (this.inBounds(c, r)) {
                if (this.isEmpty(c, r)) {
                    moves.push({ col: c, row: r });
                } else {
                    if (this.isEnemy(c, r, isRed)) moves.push({ col: c, row: r });
                    break; // chặn lại
                }
                c += dx; r += dy;
            }
        }
        return moves;
    }

    // ---- Pháo (Cannon) ----
    cannonMoves(col, row, isRed) {
        const moves = [];
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

        for (const [dx, dy] of dirs) {
            // 1) di chuyển KHÔNG ăn: giống Xe nhưng không được nhảy
            let c = col + dx, r = row + dy;
            while (this.inBounds(c, r) && this.isEmpty(c, r)) {
                moves.push({ col: c, row: r });
                c += dx; r += dy;
            }

            // 2) ăn: phải có đúng 1 quân chắn rồi mới tới 1 quân địch
            // tìm 1 "màn chắn"
            while (this.inBounds(c, r) && this.isEmpty(c, r)) { c += dx; r += dy; }
            if (!this.inBounds(c, r)) continue; // hết bàn, không có màn
            // đã gặp 1 quân chắn ở (c,r), tiếp tục đi thêm tới khi gặp quân tiếp theo
            c += dx; r += dy;
            while (this.inBounds(c, r) && this.isEmpty(c, r)) { c += dx; r += dy; }
            if (this.inBounds(c, r) && this.isEnemy(c, r, isRed)) {
                moves.push({ col: c, row: r });
            }
        }
        return moves;
    }

    // ---- Mã (Knight) – có chặn chân ----
    knightMoves(col, row, isRed) {
        const moves = [];
        const steps = [
            { block: [0, -1], to: [-1, -2] }, { block: [0, -1], to: [1, -2] },
            { block: [1, 0], to: [2, -1] }, { block: [1, 0], to: [2, 1] },
            { block: [0, 1], to: [1, 2] }, { block: [0, 1], to: [-1, 2] },
            { block: [-1, 0], to: [-2, 1] }, { block: [-1, 0], to: [-2, -1] },
        ];
        for (const s of steps) {
            const bc = col + s.block[0], br = row + s.block[1];
            if (!this.isEmpty(bc, br)) continue; // bị chặn chân
            const c = col + s.to[0], r = row + s.to[1];
            if (!this.inBounds(c, r)) continue;
            if (this.isEmpty(c, r) || this.isEnemy(c, r, isRed)) moves.push({ col: c, row: r });
        }
        return moves;
    }

    // ---- Tượng (Elephant) – đi 2 chéo, không qua sông, có chặn mắt ----
    elephantMoves(col, row, isRed) {
        const moves = [];
        const steps = [[2, 2], [2, -2], [-2, 2], [-2, -2]];
        for (const [dx, dy] of steps) {
            const eyeC = col + dx / 2, eyeR = row + dy / 2;
            const c = col + dx, r = row + dy;
            if (!this.inBounds(c, r)) continue;
            // không qua sông
            if (isRed && r <= 4) continue;
            if (!isRed && r >= 5) continue;
            // chặn mắt
            if (!this.isEmpty(eyeC, eyeR)) continue;
            if (this.isEmpty(c, r) || this.isEnemy(c, r, isRed)) moves.push({ col: c, row: r });
        }
        return moves;
    }

    // ---- Sĩ (Advisor) – 1 chéo trong cung ----
    advisorMoves(col, row, isRed) {
        const moves = [];
        const steps = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
        for (const [dx, dy] of steps) {
            const c = col + dx, r = row + dy;
            if (!this.inBounds(c, r)) continue;
            if (!this.insidePalace(c, r, isRed)) continue;
            if (this.isEmpty(c, r) || this.isEnemy(c, r, isRed)) moves.push({ col: c, row: r });
        }
        return moves;
    }

    // ---- Tướng (General) – 4 hướng trong cung ----
    generalMoves(col, row, isRed) {
        const moves = [];
        const steps = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const [dx, dy] of steps) {
            const c = col + dx, r = row + dy;
            if (!this.inBounds(c, r)) continue;
            if (!this.insidePalace(c, r, isRed)) continue;
            if (this.isEmpty(c, r) || this.isEnemy(c, r, isRed)) moves.push({ col: c, row: r });
        }
        // (Không bật "tướng đối mặt" ở đây để giữ đơn giản; nếu muốn có thể bổ sung sau)
        return moves;
    }

    // ---- Binh/Tốt (Soldier) ----
    soldierMoves(col, row, isRed) {
        const moves = [];
        // hướng tiến: đỏ đi lên (r-1), đen đi xuống (r+1)
        const forward = isRed ? -1 : 1;

        const fC = col, fR = row + forward;
        if (this.inBounds(fC, fR) && (this.isEmpty(fC, fR) || this.isEnemy(fC, fR, isRed))) {
            moves.push({ col: fC, row: fR });
        }

        // Sau khi qua sông mới được đi ngang
        const crossed = isRed ? (row <= 4) : (row >= 5);
        if (crossed) {
            for (const dc of [-1, 1]) {
                const c = col + dc, r = row;
                if (this.inBounds(c, r) && (this.isEmpty(c, r) || this.isEnemy(c, r, isRed))) {
                    moves.push({ col: c, row: r });
                }
            }
        }
        return moves;
    }

    // Điểm (c,r) có nằm trong cung của bên tương ứng không?
    insidePalace(c, r, isRed) {
        const inCols = (c >= 3 && c <= 5);
        if (isRed) {
            return inCols && (r >= 7 && r <= 9);
        } else {
            return inCols && (r >= 0 && r <= 2);
        }
    }

    // ===== PHẦN LOGIC CỜ TƯỚNG - KIỂM TRA CHIẾU, CHIẾU BÍ, ĐỐI MẶT TƯỚNG =====
    
    // Tìm vị trí Tướng của một bên
    findGeneral(isRed) {
        const board = this.gameState.board;
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 9; col++) {
                const piece = board[row][col];
                if (!piece) continue;

                const pieceIsRed = piece.startsWith('r_');
                const pieceType = piece.split('_')[1];

                // Kiểm tra các ký tự tướng
                if (pieceIsRed === isRed &&
                    (pieceType === '將' || pieceType === '帅' || pieceType === '帥')) {
                    return { row, col };
                }
            }
        }
        return null; // Tướng bị ăn
    }

    // Kiểm tra hai tướng có đối mặt không
    isGeneralsFacing() {
        const redGeneral = this.findGeneral(true);
        const blackGeneral = this.findGeneral(false);

        if (!redGeneral || !blackGeneral) return false;

        // Hai tướng phải cùng cột
        if (redGeneral.col !== blackGeneral.col) return false;

        // Kiểm tra có quân nào ở giữa không
        const minRow = Math.min(redGeneral.row, blackGeneral.row);
        const maxRow = Math.max(redGeneral.row, blackGeneral.row);

        for (let row = minRow + 1; row < maxRow; row++) {
            if (this.gameState.board[row][redGeneral.col]) {
                return false; // Có quân ở giữa
            }
        }

        return true; // Hai tướng đối mặt
    }

    // Kiểm tra một bên có đang bị chiếu không
    isInCheck(isRed) {
        const general = this.findGeneral(isRed);
        if (!general) return false; // Không có tướng = đã thua

        // Kiểm tra tất cả quân địch có thể ăn tướng không
        const board = this.gameState.board;
        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 9; col++) {
                const piece = board[row][col];
                if (!piece) continue;

                const pieceIsRed = piece.startsWith('r_');
                if (pieceIsRed === isRed) continue; // Quân mình

                // Kiểm tra xem quân này có thể ăn tướng không
                const moves = this.getValidMovesForPiece(col, row);
                if (moves.some(m => m.row === general.row && m.col === general.col)) {
                    return true;
                }
            }
        }

        return false;
    }

    // Kiểm tra một nước đi có hợp lệ không (không để tướng bị chiếu)
    isMoveLegal(fromCol, fromRow, toCol, toRow, isRed) {
        // Lưu trạng thái hiện tại
        const originalPiece = this.gameState.board[fromRow][fromCol];
        const capturedPiece = this.gameState.board[toRow][toCol];

        // Thực hiện nước đi tạm thời
        this.gameState.board[toRow][toCol] = originalPiece;
        this.gameState.board[fromRow][fromCol] = null;

        // Kiểm tra sau nước đi:
        // 1. Tướng mình có bị chiếu không?
        const stillInCheck = this.isInCheck(isRed);

        // 2. Hai tướng có đối mặt không?
        const generalsFacing = this.isGeneralsFacing();

        // Hoàn tác nước đi
        this.gameState.board[fromRow][fromCol] = originalPiece;
        this.gameState.board[toRow][toCol] = capturedPiece;

        // Nước đi hợp lệ nếu: không bị chiếu VÀ không đối mặt tướng
        return !stillInCheck && !generalsFacing;
    }

    // Lọc chỉ các nước đi hợp lệ (không để tướng bị chiếu)
    getFilteredLegalMoves(col, row) {
        const piece = this.gameState.board[row][col];
        if (!piece) return [];

        const isRed = piece.startsWith('r_');
        const rawMoves = this.getValidMovesForPiece(col, row);

        // Lọc bỏ các nước đi không hợp lệ
        return rawMoves.filter(move =>
            this.isMoveLegal(col, row, move.col, move.row, isRed)
        );
    }

    // Kiểm tra có còn nước đi hợp lệ không
    hasLegalMoves(isRed) {
        const board = this.gameState.board;

        for (let row = 0; row < 10; row++) {
            for (let col = 0; col < 9; col++) {
                const piece = board[row][col];
                if (!piece) continue;

                const pieceIsRed = piece.startsWith('r_');
                if (pieceIsRed !== isRed) continue; // Không phải quân mình

                const legalMoves = this.getFilteredLegalMoves(col, row);
                if (legalMoves.length > 0) {
                    return true; // Còn ít nhất 1 nước đi hợp lệ
                }
            }
        }

        return false; // Không còn nước đi hợp lệ
    }

    // Kiểm tra trạng thái game
    checkGameStatus() {
        if (!this.gameState || this.gameState.status !== 'playing') return;

        const currentIsRed = this.gameState.currentPlayer === 'red';

        // 1. Kiểm tra tướng còn không
        const currentGeneral = this.findGeneral(currentIsRed);
        const opponentGeneral = this.findGeneral(!currentIsRed);

        if (!currentGeneral) {
            // Tướng bên hiện tại bị ăn -> thua
            this.endGame(currentIsRed ? 'black' : 'red', 'Tướng bị ăn');
            return;
        }

        if (!opponentGeneral) {
            // Tướng đối phương bị ăn -> thắng
            this.endGame(currentIsRed ? 'red' : 'black', 'Tướng đối phương bị ăn');
            return;
        }

        // 2. Kiểm tra chiếu
        const inCheck = this.isInCheck(currentIsRed);

        // 3. Kiểm tra còn nước đi hợp lệ không
        const hasLegalMove = this.hasLegalMoves(currentIsRed);

        if (inCheck && !hasLegalMove) {
            // CHIẾU BÍ - thua
            this.endGame(currentIsRed ? 'black' : 'red', 'Chiếu bí');
        } else if (!inCheck && !hasLegalMove) {
            // HẾT NƯỚC ĐI (Stalemate) - hòa
            this.endGame('draw', 'Hết nước đi - Hòa');
        }

        // Cập nhật trạng thái chiếu cho UI
        if (!this.gameState.isInCheck) {
            this.gameState.isInCheck = {};
        }
        this.gameState.isInCheck[currentIsRed ? 'red' : 'black'] = inCheck;
    }

    // Kết thúc game
    endGame(winner, reason) {
        this.gameState.status = 'finished';
        this.gameState.winner = winner;
        this.gameState.endReason = reason;

        // Gửi lên server
        this.ws.send(JSON.stringify({
            type: 'gameAction',
            gameId: this.gameId,
            action: 'endGame',
            data: {
                winner: winner,
                reason: reason
            }
        }));

        this.showGameResult();
        this.stopTimers();
    }

    makeMove(fromCol, fromRow, toCol, toRow) {
        console.log(`Making move: from (${fromCol}, ${fromRow}) to (${toCol}, ${toRow})`);

        // Kiểm tra nước đi có hợp lệ không
        const piece = this.gameState.board[fromRow][fromCol];
        if (!piece) return;

        const isRed = piece.startsWith('r_');
        if (!this.isMoveLegal(fromCol, fromRow, toCol, toRow, isRed)) {
            this.showError('Nước đi không hợp lệ! Tướng đang bị chiếu hoặc sẽ bị chiếu.');
            this.clearSelection();
            return;
        }

        this.ws.send(JSON.stringify({
            type: 'gameAction',
            gameId: this.gameId,
            action: 'makeMove',
            data: {
                fromRow: fromRow,
                fromCol: fromCol,
                toRow: toRow,
                toCol: toCol
            }
        }));

        // Clear selection after move
        this.clearSelection();

        // Reset move timer
        this.resetMoveTimer();
    }

    // Utility methods
    copyGameId() {
        if (this.gameId) {
            this.copyToClipboard(this.gameId);
        }
    }

    copyGameIdFromSetup() {
        if (this.gameId) {
            this.copyToClipboard(this.gameId);
        }
    }

    copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            this.showSuccess('Đã copy mã phòng!');
        }).catch(() => {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showSuccess('Đã copy mã phòng!');
        });
    }

    // Confirmation dialogs and new actions
    surrenderGame() {
        if (!this.gameId || this.isSpectator) return;

        if (confirm('🏳️ Bạn có chắc chắn muốn đầu hàng không?')) {
            this.ws.send(JSON.stringify({
                type: 'gameAction',
                gameId: this.gameId,
                action: 'surrender'
            }));
        }
    }

    resetGame() {
        if (!this.gameId) return;

        if (this.isSpectator) {
            this.showError('Khán giả không thể reset game');
            return;
        }

        if (confirm('🔄 Bạn có chắc chắn muốn bắt đầu ván mới không?')) {
            this.ws.send(JSON.stringify({
                type: 'resetGame',
                gameId: this.gameId
            }));
        }
    }

    leaveGame() {
        if (!this.gameId) return;

        const confirmMessage = this.isSpectator ?
            '🚪 Bạn có chắc chắn muốn rời khỏi việc xem trận đấu không?' :
            '🚪 Bạn có chắc chắn muốn rời phòng không? Trận đấu sẽ kết thúc.';

        if (confirm(confirmMessage)) {
            this.ws.send(JSON.stringify({
                type: 'leaveGame',
                gameId: this.gameId
            }));

            // Reset client state
            this.gameId = null;
            this.playerColor = null;
            this.gameState = null;
            this.isHost = false;
            this.isSpectator = false;
            this.clearSelection();
            this.stopTimers();

            // Show main menu
            document.getElementById('mainMenu').classList.remove('hidden');
            document.getElementById('gameSetup').classList.add('hidden');
            document.getElementById('gameSection').classList.add('hidden');

            // Clear input
            document.getElementById('gameIdInput').value = '';

            this.showSuccess('Đã rời phòng thành công!');
        }
    }

} // KẾT THÚC CLASS XiangqiGame

// Global functions for HTML onclick events
let game;

function createGame() {
    if (game) {
        game.createGame();
    }
}

function joinGame() {
    if (game) {
        game.joinGame();
    }
}

function playerReady() {
    if (game) {
        game.playerReady();
    }
}

function copyGameIdFromSetup() {
    if (game) {
        game.copyGameIdFromSetup();
    }
}

function copyGameId() {
    if (game) {
        game.copyGameId();
    }
}

function surrenderGame() {
    if (game) {
        game.surrenderGame();
    }
}

function resetGame() {
    if (game) {
        game.resetGame();
    }
}

function leaveGame() {
    if (game) {
        game.leaveGame();
    }
}

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    game = new XiangqiGame();
});