
<?php session_start(); 
include $_SERVER['DOCUMENT_ROOT'].'../db.php';
?>


<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Cờ Caro Online 20x20</title>
  <link rel="stylesheet" href="../assets/bootstrap/css/bootstrap.min.css">
  <link rel="stylesheet" href="../assets/css/style.css">


</head>
<body>
<?php 
include $_SERVER['DOCUMENT_ROOT'].'./include/header.php';
?>

<div class="container my-4 caro-container">
    <h1 class="caro-title text-center mb-4">🎮 Cờ Caro Online</h1>

    <!-- Trạng thái kết nối -->
    <div id="connectionStatus" class="caro-connection-status disconnected text-center">
        🔌 Đang kết nối...
    </div>

    <!-- Menu chính -->
    <div id="mainMenu" class="caro-main-menu">
        <div class="caro-menu-content">
            <!-- Tạo phòng online -->
            <button class="caro-btn caro-btn-primary" onclick="createGame()">🆕 Tạo phòng online</button>

            <!-- Vào phòng -->
            <div class="caro-join-section">
                <input type="text" id="gameIdInput" class="caro-input" placeholder="Nhập mã phòng" maxlength="20">
                <button class="caro-btn caro-btn-success" onclick="joinGame()">🚪 Vào phòng</button>
            </div>
        </div>
    </div>

    <!-- Thông tin game -->
    <div id="gameSection" class="caro-game-section hidden">
        
        <!-- Mã phòng và trạng thái -->
        <div class="caro-game-header">
            <div class="caro-room-info">
                <strong>Mã phòng: <span id="currentGameId">-</span></strong>
                <button class="caro-btn caro-btn-copy btn-sm" onclick="copyGameId()">📋 Copy</button>
            </div>
            <div id="gameStatus" class="caro-game-status">
                Đang chờ người chơi khác...
            </div>
        </div>

        <!-- Layout chính của game -->
        <div class="caro-game-layout">
            
            <!-- Thông tin người chơi -->
            <div class="caro-players-section">
                <div id="player1" class="caro-player">
                    <div class="caro-player-avatar">
                        <div class="caro-avatar-circle player1-color">👤</div>
                    </div>
                    <div class="caro-player-info">
                        <div class="caro-player-name">
                            <span id="player1Name">Người chơi 1</span>
                        </div>
                        <div class="caro-player-symbol">❌</div>
                    </div>
                </div>
                
                <div class="caro-vs-divider">VS</div>
                
                <div id="player2" class="caro-player">
                    <div class="caro-player-avatar">
                        <div class="caro-avatar-circle player2-color">👤</div>
                    </div>
                    <div class="caro-player-info">
                        <div class="caro-player-name">
                            <span id="player2Name">Người chơi 2</span>
                        </div>
                        <div class="caro-player-symbol">⭕</div>
                    </div>
                </div>
            </div>

            <!-- Bàn cờ -->
            <div class="caro-board-container">
                <div id="gameBoard" class="caro-board"></div>
            </div>

            <!-- Điều khiển game -->
            <div class="caro-controls-section">
                <button id="newGameBtn" class="caro-btn caro-btn-warning" onclick="resetGame()">🔄 Ván mới</button>
                <button class="caro-btn caro-btn-danger" onclick="leaveGame()">🚪 Rời phòng</button>
            </div>
            
        </div>
    </div>
</div>





<script src="../assets/js/caro.js"></script>

<?php

include $_SERVER['DOCUMENT_ROOT'].'../include/footer.php';
?>
</body>
</html>













