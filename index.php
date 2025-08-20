<?php session_start(); ?>
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>🎮 Game Online</title>
  <link rel="stylesheet" href="./assets/bootstrap/css/bootstrap.min.css">
  <link rel="stylesheet" href="./assets/css/style.css">
</head>
<body>
<?php include './include/header.php'; ?>

<div class="container my-5">
  <h1 class="text-center mb-4">🎯 Chọn game bạn muốn chơi</h1>
  <div class="row g-4">

    <!-- Game Caro -->
    <div class="col-md-4 col-sm-6">
      <div class="card h-100">
        <img src="./assets/images/caro.jpg" class="card-img-top" alt="Cờ Caro">
        <div class="card-body text-center">
          <h5 class="card-title">Cờ Caro</h5>
          <p class="card-text">20×20, thắng 5 quân liên tiếp</p>
          <a href="./pages/caro.php" class="btn btn-primary">Chơi ngay</a>
        </div>
      </div>
    </div>

    <!-- Game Cờ tướng -->
    <div class="col-md-4 col-sm-6">
      <div class="card h-100">
        <img src="./assets/images/cotuong.jpg" class="card-img-top" alt="Cờ tướng">
        <div class="card-body text-center">
          <h5 class="card-title">Cờ Tướng</h5>
          <p class="card-text">Cờ tướng Việt Nam online</p>
          <a href="./pages/co-tuong.php" class="btn btn-primary">Chơi ngay</a>
        </div>
      </div>
    </div>

    <!-- Game Flappy Race - NEW! -->
    <div class="col-md-4 col-sm-6">
      <div class="card h-100 border-warning">
        <div class="position-relative">
          <img src="./assets/images/flappy-race.jpg" class="card-img-top" alt="Flappy Race">
          <span class="position-absolute top-0 start-0 badge bg-warning text-dark">NEW!</span>
        </div>
        <div class="card-body text-center">
          <h5 class="card-title">🐦 Flappy Race</h5>
          <p class="card-text">Đua chim với nhiều người chơi, vật phẩm và combat!</p>
          <a href="./pages/flappy-race.php" class="btn btn-warning">Chơi ngay</a>
        </div>
      </div>
    </div>

    <!-- Game Cờ vua -->
    <div class="col-md-4 col-sm-6">
      <div class="card h-100">
        <img src="./assets/images/chess.jpg" class="card-img-top" alt="Cờ vua">
        <div class="card-body text-center">
          <h5 class="card-title">Cờ vua</h5>
          <p class="card-text">Thi đấu trí tuệ 2 người</p>
          <a href="#" class="btn btn-secondary disabled">Sắp ra mắt</a>
        </div>
      </div>
    </div>

    <!-- Game Tic Tac Toe -->
    <div class="col-md-4 col-sm-6">
      <div class="card h-100">
        <img src="./assets/images/tictactoe.jpg" class="card-img-top" alt="Tic Tac Toe">
        <div class="card-body text-center">
          <h5 class="card-title">Tic Tac Toe</h5>
          <p class="card-text">X-O cổ điển 3×3</p>
          <a href="#" class="btn btn-secondary disabled">Sắp ra mắt</a>
        </div>
      </div>
    </div>

    <!-- Game Xếp hình -->
    <div class="col-md-4 col-sm-6">
      <div class="card h-100">
        <img src="./assets/images/puzzle.jpg" class="card-img-top" alt="Xếp hình">
        <div class="card-body text-center">
          <h5 class="card-title">Xếp hình</h5>
          <p class="card-text">Giải trí nhẹ nhàng</p>
          <a href="#" class="btn btn-secondary disabled">Sắp ra mắt</a>
        </div>
      </div>
    </div>

  </div>

  <!-- Featured Game Section -->
  <div class="row mt-5">
    <div class="col-12">
      <div class="card bg-gradient" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
        <div class="card-body text-white text-center py-5">
          <h2 class="card-title mb-3">🚀 Game Mới: Flappy Race Online!</h2>
          <p class="card-text lead mb-4">
            Trải nghiệm hoàn toàn mới với Flappy Bird multiplayer! Đua với tối đa 8 người chơi, 
            sử dụng vật phẩm chiến thuật, và trở thành người đầu tiên hoàn thành cuộc đua!
          </p>
          <div class="row justify-content-center">
            <div class="col-md-8">
              <div class="row text-center">
                <div class="col-md-3 col-6 mb-3">
                  <div class="feature-item">
                    <div class="fs-1">🏁</div>
                    <small>Đua 2 chặng</small>
                  </div>
                </div>
                <div class="col-md-3 col-6 mb-3">
                  <div class="feature-item">
                    <div class="fs-1">⚡</div>
                    <small>Vật phẩm</small>
                  </div>
                </div>
                <div class="col-md-3 col-6 mb-3">
                  <div class="feature-item">
                    <div class="fs-1">👥</div>
                    <small>Tối đa 8 người</small>
                  </div>
                </div>
                <div class="col-md-3 col-6 mb-3">
                  <div class="feature-item">
                    <div class="fs-1">💣</div>
                    <small>Combat PvP</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <a href="./pages/flappy-race.php" class="btn btn-warning btn-lg mt-3">
            🎮 Chơi Flappy Race Ngay!
          </a>
        </div>
      </div>
    </div>
  </div>
</div>

<?php include './include/footer.php'; ?>
<script src="./assets/bootstrap/js/bootstrap.bundle.min.js"></script>

<style>
.feature-item {
  padding: 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(5px);
  transition: transform 0.3s ease;
}

.feature-item:hover {
  transform: translateY(-5px);
}

.card.border-warning {
  border-width: 3px !important;
  box-shadow: 0 0 20px rgba(255, 193, 7, 0.3);
}

.badge {
  font-size: 0.7em;
  padding: 0.4em 0.6em;
  margin: 0.5em;
}

@media (max-width: 768px) {
  .feature-item {
    padding: 5px;
  }
  
  .feature-item .fs-1 {
    font-size: 1.5rem !important;
  }
  
  .card-body.py-5 {
    padding-top: 2rem !important;
    padding-bottom: 2rem !important;
  }
}
</style>
</body>
</html>