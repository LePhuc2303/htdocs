
<?php session_start(); 
include $_SERVER['DOCUMENT_ROOT'].'../db.php';
?>


<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Cờ Tướng Online</title>
  <link rel="stylesheet" href="../assets/bootstrap/css/bootstrap.min.css">
  <link rel="stylesheet" href="../assets/css/style.css">


</head>
<body>
<?php 
include $_SERVER['DOCUMENT_ROOT'].'./include/header.php';
?>




 <div class="container my-4 game-container">
        <h1 class="text-center mb-4">🐉 Cờ Tướng Online</h1>

        <!-- Trạng thái kết nối -->
        <div id="connectionStatus" class="connection-status disconnected alert alert-secondary text-center">
            🔌 Đang kết nối...
        </div>

        <!-- Menu chính -->
        <div id="mainMenu" class="game-controls card p-3 mb-4">
            <div class="d-flex flex-column gap-2 justify-content-center">
                <!-- Tạo phòng online -->
                <button class="btn btn-primary" onclick="createGame()">🆕 Tạo phòng online</button>

                <!-- Vào phòng -->
                <div class="game-id-section input-group mt-2">
                    <input type="text" id="gameIdInput" class="form-control" placeholder="Nhập mã phòng" maxlength="20">
                    <button class="btn btn-success" onclick="joinGame()">🚪 Vào phòng</button>
                </div>
            </div>
        </div>

        <!-- Game Setup Section -->
        <div id="gameSetup" class="hidden">
            <!-- Mã phòng hiển thị ngay khi tạo/vào phòng -->
            <div class="game-id-section text-center mb-3">
                <strong>🎮 Mã phòng: <span id="setupGameId" class="text-warning">-</span></strong>
                <button class="btn btn-outline-secondary btn-sm ms-2" onclick="copyGameIdFromSetup()">📋 Copy</button>
            </div>
            
            <!-- Thiết lập chỉ cho chủ phòng -->
            <div id="hostSettings" class="game-setup-container hidden">
                <h3>⚙️ Thiết lập ván đấu (Chủ phòng)</h3>
                
                <div class="setup-section">
                    <label>Chọn màu quân cờ:</label>
                    <div class="btn-group" role="group" id="colorSelection">
                        <button type="button" class="btn btn-outline-light" data-color="red">🔴 Đỏ</button>
                        <button type="button" class="btn btn-outline-light active" data-color="random">🎲 Ngẫu nhiên</button>
                        <button type="button" class="btn btn-outline-light" data-color="black">⚫ Đen</button>
                    </div>
                </div>

                <div class="setup-section">
                    <label>Ai đi trước:</label>
                    <div class="btn-group" role="group" id="firstPlayerSelection">
                        <button type="button" class="btn btn-outline-light" data-first="red">🔴 Đỏ đi trước</button>
                        <button type="button" class="btn btn-outline-light active" data-first="random">🎲 Ngẫu nhiên</button>
                        <button type="button" class="btn btn-outline-light" data-first="black">⚫ Đen đi trước</button>
                    </div>
                </div>
            </div>

            <!-- Hiển thị thiết lập cho người chơi -->
            <div id="guestSettings" class="game-setup-container hidden">
                <h3>⚙️ Thiết lập ván đấu</h3>
                <div class="alert alert-info">
                    <strong>Chờ chủ phòng thiết lập...</strong>
                    <div id="currentSettings" class="mt-2">
                        <div>🎨 Màu quân: <span id="displayColorChoice">Ngẫu nhiên</span></div>
                        <div>🎯 Đi trước: <span id="displayFirstPlayer">Ngẫu nhiên</span></div>
                    </div>
                </div>
            </div>

            <!-- Phần sẵn sàng cho cả 2 -->
            <div class="ready-section">
                <button id="readyBtn" class="btn btn-success btn-lg" onclick="playerReady()">✅ Sẵn sàng</button>
                <div id="readyStatus" class="mt-2">
                    <span class="not-ready-status">Chưa sẵn sàng</span>
                </div>
            </div>
        </div>

        <!-- Thông tin game -->
        <div id="gameSection" class="hidden">
            <!-- Mã phòng -->
            <div class="game-id-section text-center">
                <strong>Mã phòng: <span id="currentGameId">-</span></strong>
                <button class="btn btn-outline-secondary btn-sm ms-2" onclick="copyGameId()">📋 Copy</button>
            </div>

            <!-- Thông tin người chơi -->
            <div class="players-info">
                <div id="player1Card" class="player-card">
                    <div class="player-name">👤 <span id="player1Name">Người chơi 1</span></div>
                    <div class="player-color">🔴 Quân Đỏ</div>
                    <div class="timer-display">
                        <div id="player1MoveTimer" class="timer-move">20s</div>
                        <div id="player1TotalTimer" class="timer-total">15:00</div>
                    </div>
                </div>
                <div id="player2Card" class="player-card">
                    <div class="player-name">👤 <span id="player2Name">Người chơi 2</span></div>
                    <div class="player-color">⚫ Quân Đen</div>
                    <div class="timer-display">
                        <div id="player2MoveTimer" class="timer-move">20s</div>
                        <div id="player2TotalTimer" class="timer-total">15:00</div>
                    </div>
                </div>
            </div>

            <!-- Trạng thái game -->
            <div id="gameStatus" class="game-status">
                Đang chờ người chơi khác...
            </div>

            <!-- Bàn cờ -->
            <div class="xiangqi-board-container">
                <canvas id="xiangqiCanvas" width="450" height="520"></canvas>
            </div>

            <!-- Điều khiển game -->
            <div class="game-controls d-flex justify-content-center gap-2">
                <button id="surrenderBtn" class="btn btn-secondary" onclick="surrenderGame()">🏳️ Đầu hàng</button>
                <button id="newGameBtn" class="btn btn-warning" onclick="resetGame()">🔄 Ván mới</button>
                <button class="btn btn-danger" onclick="leaveGame()">🚪 Rời phòng</button>
            </div>
        </div>
    </div>




<script src="../assets/js/cotuong.js"></script>

<?php

include $_SERVER['DOCUMENT_ROOT'].'../include/footer.php';
?>
</body>
</html>













