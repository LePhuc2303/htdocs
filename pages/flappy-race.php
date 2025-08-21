<?php session_start(); 
include $_SERVER['DOCUMENT_ROOT'].'../db.php';
?>

<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>🏁 Flappy Race Online</title>
  <link rel="stylesheet" href="../assets/bootstrap/css/bootstrap.min.css">
  <!-- <link rel="stylesheet" href="../assets/css/style.css"> -->
  <link rel="stylesheet" href="../assets/css/flappy-race.css">
</head>

<body class="flappy-race-page">
<?php 
include $_SERVER['DOCUMENT_ROOT'].'./include/header.php';
?>

<div class="container my-4 game-container">
    <h1 class="text-center mb-4">🐦 Flappy Race Online</h1>

    <!-- Trạng thái kết nối -->
    <div id="connectionStatus" class="connection-status disconnected alert alert-secondary text-center">
        🔌 Đang kết nối...
    </div>

    <!-- Menu chính -->
    <div id="mainMenu" class="game-controls card p-4 mb-4">
        <!-- Header -->
        <div class="text-center mb-4">
            <h3 class="mb-3">🏁 Chọn chế độ chơi</h3>
            <p class="text-muted mb-0">Chọn chế độ game phù hợp với bạn!</p>
        </div>

        <!-- Game Modes -->
        <div class="row g-3 mb-4">
            <!-- Classic Race -->
            <div class="col-md-3">
                <div class="game-mode-card" data-mode="classic">
                    <div class="mode-icon">🏁</div>
                    <h5>Classic Race</h5>
                    <p>Đua cổ điển: Đi → Về → Thắng!</p>
                    <div class="mode-stats">
                        <span class="badge bg-primary">2-8 người</span>
                        <span class="badge bg-success">5-10 phút</span>
                    </div>
                </div>
            </div>

            <!-- Battle Royale -->
            <div class="col-md-3">
                <div class="game-mode-card" data-mode="battle">
                    <div class="mode-icon">⚔️</div>
                    <h5>Battle Royale</h5>
                    <p>Sinh tồn cuối cùng với items và combat!</p>
                    <div class="mode-stats">
                        <span class="badge bg-danger">4-8 người</span>
                        <span class="badge bg-warning">3-8 phút</span>
                    </div>
                </div>
            </div>

            <!-- Time Trial -->
            <div class="col-md-3">
                <div class="game-mode-card" data-mode="time">
                    <div class="mode-icon">⏱️</div>
                    <h5>Time Trial</h5>
                    <p>Đua với thời gian, ai nhanh nhất?</p>
                    <div class="mode-stats">
                        <span class="badge bg-info">1-8 người</span>
                        <span class="badge bg-secondary">2-5 phút</span>
                    </div>
                </div>
            </div>

            <!-- Endless -->
            <div class="col-md-3">
                <div class="game-mode-card" data-mode="endless">
                    <div class="mode-icon">♾️</div>
                    <h5>Endless Mode</h5>
                    <p>Bay xa nhất có thể, thu thập điểm!</p>
                    <div class="mode-stats">
                        <span class="badge bg-purple">1-4 người</span>
                        <span class="badge bg-dark">Không giới hạn</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Selected Mode Display -->
        <div id="selectedMode" class="alert alert-info text-center mb-4" style="display: none;">
            <strong>Đã chọn:</strong> <span id="selectedModeName">-</span>
        </div>

        <!-- Room Creation -->
        <div class="row">
            <!-- Create Room -->
            <div class="col-lg-6">
                <div class="card bg-primary text-white">
                    <div class="card-body text-center">
                        <h5 class="card-title">🆕 Tạo phòng mới</h5>
                        
                        <!-- Room Settings -->
                        <div class="room-settings mb-3">
                            <div class="row g-2">
                                <div class="col-6">
                                    <label class="form-label small">Số người chơi</label>
                                    <select id="maxPlayers" class="form-select form-select-sm">
                                        <option value="2">2 người</option>
                                        <option value="4" selected>4 người</option>
                                        <option value="6">6 người</option>
                                        <option value="8">8 người</option>
                                    </select>
                                </div>
                                <div class="col-6">
                                    <label class="form-label small">Độ khó</label>
                                    <select id="difficulty" class="form-select form-select-sm">
                                        <option value="easy">Dễ</option>
                                        <option value="normal" selected>Bình thường</option>
                                        <option value="hard">Khó</option>
                                        <option value="extreme">Cực khó</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div class="row g-2 mt-2">
                                <div class="col-6">
                                    <label class="form-label small">Map</label>
                                    <select id="mapType" class="form-select form-select-sm">
                                        <option value="classic">Classic</option>
                                        <option value="jungle">Jungle</option>
                                        <option value="city">City</option>
                                        <option value="space">Space</option>
                                    </select>
                                </div>
                                <div class="col-6">
                                    <label class="form-label small">Items</label>
                                    <select id="itemsEnabled" class="form-select form-select-sm">
                                        <option value="true" selected>Có items</option>
                                        <option value="false">Không items</option>
                                        <option value="chaos">Chaos mode</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <button class="btn btn-light btn-lg w-100" onclick="createGame()">
                            🚀 Tạo phòng ngay
                        </button>
                    </div>
                </div>
            </div>

            <!-- Join Room -->
            <div class="col-lg-6">
                <div class="card bg-success text-white">
                    <div class="card-body text-center">
                        <h5 class="card-title">🚪 Vào phòng có sẵn</h5>
                        
                        <div class="mb-3">
                            <label class="form-label">Mã phòng</label>
                            <input type="text" id="gameIdInput" class="form-control form-control-lg text-center" 
                                   placeholder="Nhập mã phòng..." maxlength="20" 
                                   style="font-family: 'Courier New', monospace; font-weight: bold;">
                        </div>

                        <button class="btn btn-light btn-lg w-100 mb-3" onclick="joinGame()">
                            ✨ Vào phòng
                        </button>

                        <div class="text-center">
                            <small class="opacity-75">Hoặc</small>
                        </div>

                        <button class="btn btn-outline-light mt-2" onclick="showQuickJoin()">
                            🎲 Tham gia ngẫu nhiên
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Quick Tips -->
        <div class="mt-4">
            <button class="btn btn-outline-info w-100" type="button" data-bs-toggle="collapse" data-bs-target="#gameGuide">
                📖 Hướng dẫn chơi & Tips
            </button>
            <div class="collapse mt-3" id="gameGuide">
                <div class="card">
                    <div class="card-body">
                        <div class="row">
                            <div class="col-md-6">
                                <h6>🎮 Điều khiển cơ bản:</h6>
                                <ul class="list-unstyled">
                                    <li>• <kbd>SPACE</kbd> hoặc <kbd>Click</kbd> - Đập cánh bay lên</li>
                                    <li>• <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd><kbd>4</kbd> - Sử dụng items</li>
                                    <li>• <kbd>ESC</kbd> - Tạm dừng game</li>
                                </ul>
                            </div>
                            <div class="col-md-6">
                                <h6>🛠️ Items & Power-ups:</h6>
                                <ul class="list-unstyled">
                                    <li>• <span style="color:#FFD700">⚡ Tăng tốc</span> - Bay nhanh hơn</li>
                                    <li>• <span style="color:#4169E1">🛡 Khiên</span> - Miễn nhiễm va chạm</li>
                                    <li>• <span style="color:#FF4500">💣 Bom</span> - Ném vào đối thủ</li>
                                    <li>• <span style="color:#8B4513">🕳 Bẫy</span> - Đặt bẫy trên đường bay</li>
                                </ul>
                            </div>
                        </div>
                        <div class="row mt-3">
                            <div class="col-md-6">
                                <h6>🏆 Chiến thuật thắng:</h6>
                                <ul class="list-unstyled small">
                                    <li>• Thu thập items sớm</li>
                                    <li>• Sử dụng bom để làm chậm đối thủ</li>
                                    <li>• Giữ khiên cho những đoạn khó</li>
                                    <li>• Bay sát mặt đất để tránh projectiles</li>
                                </ul>
                            </div>
                            <div class="col-md-6">
                                <h6>🎯 Mục tiêu các chế độ:</h6>
                                <ul class="list-unstyled small">
                                    <li>• <strong>Classic:</strong> Về đích đầu tiên</li>
                                    <li>• <strong>Battle:</strong> Sống sót cuối cùng</li>
                                    <li>• <strong>Time Trial:</strong> Thời gian nhanh nhất</li>
                                    <li>• <strong>Endless:</strong> Bay xa nhất</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Game Setup Section -->
    <div id="gameSetup" class="hidden">
        <div class="card">
            <div class="card-header text-center bg-primary text-white">
                <h4 class="mb-0">🎮 Lobby Game</h4>
            </div>
            <div class="card-body">
                <!-- Game Info -->
                <div class="row mb-4">
                    <div class="col-md-6">
                        <div class="game-info-card">
                            <h6>📋 Thông tin phòng</h6>
                            <p><strong>Mã phòng:</strong> <span id="setupGameId" class="text-primary fw-bold">-</span> 
                               <button class="btn btn-outline-primary btn-sm ms-2" onclick="copyGameId()">📋</button></p>
                            <p><strong>Chế độ:</strong> <span id="currentGameMode">Classic Race</span></p>
                            <p><strong>Map:</strong> <span id="currentMap">Classic</span></p>
                            <p><strong>Độ khó:</strong> <span id="currentDifficulty">Bình thường</span></p>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="players-waiting">
                            <h6>👥 Người chơi đang chờ</h6>
                            <div id="playersList" class="players-list">
                                <!-- Players will be populated here -->
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Ready Section -->
                <div class="text-center">
                    <button id="readyBtn" class="btn btn-success btn-lg px-5" onclick="playerReady()">
                        ✅ Sẵn sàng chiến đấu!
                    </button>
                    <div id="readyStatus" class="mt-3">
                        <span class="not-ready-status">Chưa sẵn sàng</span>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Game Section -->
    <div id="gameSection" class="hidden">
        <!-- Game Header (only shown in non-fullscreen) -->
        <div class="game-header mb-3">
            <div class="row align-items-center">
                <div class="col-md-4">
                    <div class="game-id-display">
                        <strong>Phòng: <span id="currentGameId">-</span></strong>
                        <button class="btn btn-outline-secondary btn-sm ms-2" onclick="copyGameId()">📋</button>
                    </div>
                </div>
                <div class="col-md-4">
                    <div id="gameStatus" class="game-status-center text-center">
                        Đang chờ...
                    </div>
                </div>
                <div class="col-md-4 text-end">
                    <div class="game-timer">
                        <span id="gameTimer">00:00</span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Canvas game -->
        <div class="flappy-canvas-container">
            <canvas id="flappyCanvas" class="flappy-canvas"></canvas>
        </div>

        <!-- Game HUD (only shown in non-fullscreen) -->
        <div class="game-hud mt-3">
            <div class="row g-3">
                <div class="col-lg-3">
                    <div class="card">
                        <div class="card-body">
                            <h6 class="card-title">📊 Bảng xếp hạng</h6>
                            <div id="leaderboard" class="leaderboard-mini">
                                <!-- Leaderboard content -->
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-6">
                    <div class="card">
                        <div class="card-body">
                            <h6 class="card-title">🎯 Điều khiển & Trạng thái</h6>
                            <div class="row">
                                <div class="col-6">
                                    <div class="controls-display">
                                        <div><kbd>SPACE</kbd> Đập cánh</div>
                                        <div><kbd>1-4</kbd> Dùng items</div>
                                    </div>
                                </div>
                                <div class="col-6">
                                    <div id="playerStatus" class="player-status">
                                        <div>❤️ <span id="playerLives">3</span></div>
                                        <div>⭐ <span id="playerScore">0</span></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-3">
                    <div class="card">
                        <div class="card-body">
                            <h6 class="card-title">🎒 Items</h6>
                            <div id="playerInventory" class="inventory-display">
                                <!-- Player inventory -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Game Controls (only shown in non-fullscreen) -->
        <div class="game-controls-bottom text-center mt-4">
            <button class="btn btn-warning me-2" onclick="resetGame()">🔄 Chơi lại</button>
            <button class="btn btn-secondary me-2" onclick="pauseGame()">⏸️ Tạm dừng</button>
            <button class="btn btn-danger" onclick="leaveGame()">🚪 Rời phòng</button>
        </div>
    </div>
</div>

<script src="../assets/js/flappy-race.js"></script>

<?php
include $_SERVER['DOCUMENT_ROOT'].'../include/footer.php';
?>
</body>
</html>