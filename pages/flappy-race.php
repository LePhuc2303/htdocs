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

<div class="game-container">
        <!-- Header -->
        <div class="game-header">
            <h1 class="game-title">🚁 FLAPPY RACE 🏁</h1>
            <div id="connectionStatus" class="connection-status disconnected">🔴 Đang kết nối...</div>
        </div>

        <!-- Main Menu -->
        <div id="mainMenu">
            <div class="instructions">
                <h4>🎮 Cách chơi</h4>
                <p>
                    🚁 Điều khiển chim bay qua chướng ngại vật<br>
                    🏁 Chạy đến vạch đích và quay lại điểm bắt đầu để thắng<br>
                    ❤️ Mỗi người có 3 mạng, chết thì hồi sinh sau 3 giây<br>
                    🎯 Nhấn SPACE, click chuột, hoặc nút JUMP để nhảy
                </p>
            </div>

            <div class="menu-section">
                <h3>🆕 Tạo phòng mới</h3>
                <button class="game-btn btn-success" onclick="createGame()">Tạo Game</button>
            </div>

            <div class="menu-section">
                <h3>🚪 Vào phòng</h3>
                <input 
                    type="text" 
                    id="gameIdInput" 
                    class="game-input" 
                    placeholder="Nhập mã phòng..."
                    maxlength="10"
                >
                <button class="game-btn btn-primary" onclick="joinGame()">Vào Game</button>
            </div>

            <div class="menu-section">
                <h3>🎲 Vào phòng ngẫu nhiên</h3>
                <button class="game-btn btn-warning" onclick="joinRandomGame()">Tìm Game</button>
            </div>
        </div>

        <!-- Game Section -->
        <div id="gameSection">
            <!-- Game Info -->
            <div class="game-info">
                <div class="game-stats">
                    <div class="stat-item">
                        🎮 Phòng: <strong id="currentGameId">-</strong>
                        <button class="game-btn btn-warning" onclick="copyGameId()" style="padding: 4px 12px; font-size: 12px; margin-left: 8px;">Copy</button>
                    </div>
                    <div class="stat-item">
                        <span id="playerCount">👥 0</span>
                    </div>
                    <div class="stat-item">
                        <span id="gamePhase">⏳ Đang chờ...</span>
                    </div>
                </div>
            </div>

            <!-- Game Controls -->
            <div class="game-controls">
                <div class="control-group">
                    <button id="jumpBtn" class="game-btn btn-primary">🚁 JUMP</button>
                    <button id="resetBtn" class="game-btn btn-warning" onclick="resetGame()" style="display: none;">🔄 Chơi lại</button>
                    <button class="game-btn btn-danger" onclick="leaveGame()">🚪 Rời phòng</button>
                </div>
            </div>

            <!-- Game Canvas -->
            <div class="canvas-container">
                <canvas id="gameCanvas" width="1200" height="600"></canvas>
            </div>

            <!-- Messages -->
            <div class="messages-container">
                <h4>📢 Tin nhắn</h4>
                <div id="gameMessages"></div>
            </div>
        </div>

        <!-- Countdown Overlay -->
        <div id="countdown" style="display: none;"></div>
    </div>

<script src="../assets/js/flappy-race.js"></script>

<?php
include $_SERVER['DOCUMENT_ROOT'].'../include/footer.php';
?>
</body>
</html>