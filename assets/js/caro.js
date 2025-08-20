// === CẤU HÌNH WS_URL: đổi theo nơi chạy Node.js ===
const WS_URL = 'ws://localhost:8080';
const BOARD_SIZE = 20;

let ws = null;
let gameState = {
    playerId: null,
    gameId: null,
    playerSymbol: null,
    board: Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill('')),
    currentPlayer: 'X',
    status: 'waiting', // waiting | playing | finished
    players: [],
    winner: null
};

// --- WebSocket ---
function connectWebSocket() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => updateConnectionStatus('connected');
    ws.onclose = () => {
        updateConnectionStatus('disconnected');
        // có thể tự reconnect nếu muốn
        setTimeout(connectWebSocket, 3000);
    };
    ws.onerror = () => updateConnectionStatus('disconnected');

    ws.onmessage = (ev) => {
        let data;
        try { data = JSON.parse(ev.data); } catch { return; }
        handleServerMessage(data);
    };
}

function updateConnectionStatus(status) {
    const el = document.getElementById('connectionStatus');
    el.className = `caro-connection-status ${status} text-center`;
    el.textContent = status === 'connected' ? '🟢 Đã kết nối' : '🔴 Mất kết nối';
}

function send(msg) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return alert('Chưa kết nối WebSocket!');
    ws.send(JSON.stringify(msg));
}

// --- Xử lý tin nhắn server ---
function handleServerMessage(data) {
    switch (data.type) {
        case 'playerInfo':
            gameState.playerId = data.playerId;
            break;
        case 'gameCreated':
        case 'gameJoined':
            gameState.gameId = data.gameId;
            gameState.playerSymbol = data.playerInfo.symbol;
            showGameSection();
            break;
        case 'gameState':
            gameState.board = data.board;
            gameState.currentPlayer = data.currentPlayer;
            gameState.status = data.status;
            gameState.players = data.players || [];
            gameState.winner = data.winner ?? null;
            render();
            break;
        case 'error':
            alert('Lỗi: ' + data.message);
            break;
    }
}

// --- Game controls ---
function createGame() { 
    send({ type: 'createGame' }); 
}

function joinGame() {
    const id = document.getElementById('gameIdInput').value.trim();
    if (!id) return alert('Nhập mã phòng!');
    send({ type: 'joinGame', gameId: id });
}

function resetGame() {
    send({ type: 'resetGame', gameId: gameState.gameId });
}

function leaveGame() {
    // Reset UI
    document.getElementById('gameSection').classList.add('hidden');
    document.getElementById('mainMenu').style.display = 'block';
    
    // Clear game ID input
    document.getElementById('gameIdInput').value = '';
    
    // Reset game state
    gameState = {
        playerId: null,
        gameId: null,
        playerSymbol: null,
        board: Array(BOARD_SIZE).fill().map(() => Array(BOARD_SIZE).fill('')),
        currentPlayer: 'X',
        status: 'waiting',
        players: [],
        winner: null
    };
}

// --- Hiển thị bàn cờ ---
function showGameSection() {
    document.getElementById('mainMenu').style.display = 'none';
    document.getElementById('gameSection').classList.remove('hidden');
    document.getElementById('currentGameId').textContent = gameState.gameId;
    buildBoard();
    render();
}

function copyGameId() {
    if (!gameState.gameId) return;
    navigator.clipboard.writeText(gameState.gameId);
    alert('Đã copy: ' + gameState.gameId);
}

function buildBoard() {
    const boardEl = document.getElementById('gameBoard');
    boardEl.innerHTML = '';
    boardEl.className = 'caro-board';
    
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const btn = document.createElement('button');
            btn.className = 'cell';
            btn.dataset.r = r; 
            btn.dataset.c = c;
            btn.onclick = () => makeMove(r, c);
            boardEl.appendChild(btn);
        }
    }
}

// --- Khi người chơi click ---
function makeMove(r, c) {
    if (gameState.status !== 'playing') return alert('Game chưa bắt đầu!');
    if (gameState.currentPlayer !== gameState.playerSymbol) return alert('Chưa đến lượt bạn!');
    if (gameState.board[r][c]) return;

    // Chỉ chế độ online
    send({ type: 'makeMove', gameId: gameState.gameId, row: r, col: c });
}

// --- Kiểm tra thắng ---
function checkWinner(r, c, sym) {
    const dirs = [
        [0, 1], [1, 0], [1, 1], [1, -1]
    ];
    for (let [dr, dc] of dirs) {
        let count = 1;
        for (let d = 1; d <= 4; d++) {
            const nr = r + dr*d, nc = c + dc*d;
            if (nr<0 || nr>=BOARD_SIZE || nc<0 || nc>=BOARD_SIZE) break;
            if (gameState.board[nr][nc] === sym) count++; else break;
        }
        for (let d = 1; d <= 4; d++) {
            const nr = r - dr*d, nc = c - dc*d;
            if (nr<0 || nr>=BOARD_SIZE || nc<0 || nc>=BOARD_SIZE) break;
            if (gameState.board[nr][nc] === sym) count++; else break;
        }
        if (count >= 5) return true;
    }
    return false;
}

function isBoardFull() {
    return gameState.board.every(row => row.every(cell => cell !== ''));
}

// --- Render UI ---
function render() {
    // Update board cells
    for (let r = 0; r < BOARD_SIZE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
            const btn = document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
            if (!btn) continue;
            
            const v = gameState.board[r][c];
            btn.textContent = v ? (v === 'X' ? '❌' : '⭕') : '';
            btn.className = 'cell' + (v ? ` ${v.toLowerCase()}` : '');
            
            const shouldDisable = !!v || gameState.status !== 'playing' || 
                (gameState.currentPlayer !== gameState.playerSymbol);
            btn.disabled = shouldDisable;
        }
    }

    // Cập nhật thông tin người chơi
    const p1 = document.getElementById('player1');
    const p2 = document.getElementById('player2');
    
    // Reset classes
    p1.className = 'caro-player'; 
    p2.className = 'caro-player';

    const px = gameState.players.find(p => p.symbol === 'X');
    const po = gameState.players.find(p => p.symbol === 'O');
    
    // Update player names
    document.getElementById('player1Name').textContent = px ? (px.playerId === gameState.playerId ? 'Bạn' : 'Đối thủ') : 'Chờ...';
    document.getElementById('player2Name').textContent = po ? (po.playerId === gameState.playerId ? 'Bạn' : 'Đối thủ') : 'Chờ...';
    
    // Add classes for current player and user
    if (px && px.playerId === gameState.playerId) p1.classList.add('you');
    if (po && po.playerId === gameState.playerId) p2.classList.add('you');

    if (gameState.status === 'playing') {
        (gameState.currentPlayer === 'X' ? p1 : p2).classList.add('active');
    }

    // Cập nhật trạng thái game
    const st = document.getElementById('gameStatus');
    st.className = 'caro-game-status';
    
    if (gameState.status === 'waiting') {
        st.textContent = '⏳ Đang chờ người chơi khác...';
        st.style.background = 'linear-gradient(135deg, #6b7280, #4b5563)';
    } else if (gameState.status === 'playing') {
        if (gameState.currentPlayer === gameState.playerSymbol) {
            st.textContent = '🎯 Lượt của bạn!';
            st.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        } else {
            st.textContent = '⏳ Chờ đối thủ...';
            st.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
        }
    } else if (gameState.status === 'finished') {
        if (gameState.winner === 'draw') {
            st.textContent = '🤝 Hòa!';
            st.style.background = 'linear-gradient(135deg, #6b7280, #4b5563)';
        } else {
            if (gameState.winner === gameState.playerSymbol) {
                st.textContent = '🎉 Bạn thắng!';
                st.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                // Add winner animation
                (gameState.winner === 'X' ? p1 : p2).classList.add('winner');
            } else {
                st.textContent = '😢 Bạn thua!';
                st.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
            }
        }
    }
}

// --- Khởi tạo ---
window.onload = function() {
    connectWebSocket();
};