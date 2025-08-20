<!-- Header Menu -->
<nav class="navbar navbar-expand-lg navbar-dark bg-dark mb-4">
  <div class="container">
    <a class="navbar-brand fw-bold" href="../index.php">🎮 Game Online</a>
    <button class="navbar-toggler" type="button" id="mobileMenuBtn">
      <span class="navbar-toggler-icon"></span>
    </button>

    <!-- Menu Desktop -->
    <div class="collapse navbar-collapse" id="navbarGame">
      <ul class="navbar-nav ms-auto menu">
        <li class="nav-item"><a class="nav-link active" href="../index.php">Trang chủ</a></li>
        <li class="nav-item dropdown">
          <a class="nav-link dropdown-toggle" href="#" id="gameDropdown">Chọn game</a>
          <ul class="dropdown-menu" aria-labelledby="gameDropdown">
            <li><a class="dropdown-item" href="caro.php">🎯 Cờ Caro 20x20</a></li>
            <li><a class="dropdown-item" href="co-tuong.php">🐉 Cờ Tướng</a></li>
            <li><a class="dropdown-item" href="flappy-race.php">🏁 Flappy Race</a></li>
            <li><hr class="dropdown-divider"></li>
            <li><a class="dropdown-item" href="#">🎮 Xếp gạch (Sắp có)</a></li>
            <li><a class="dropdown-item" href="#">🔫 Bắn súng (Sắp có)</a></li>
            <li><a class="dropdown-item" href="#">🏎️ Đua xe (Sắp có)</a></li>
          </ul>
        </li>
        <li class="nav-item"><a class="nav-link" href="#">💎 Nạp VIP</a></li>
        <li class="nav-item"><a class="nav-link" href="#">🏆 Bảng xếp hạng</a></li>
      </ul>
    </div>
  </div>
</nav>

<!-- Fullscreen Mobile Menu -->
<div id="mobileMenuOverlay">
  <button id="closeMobileMenu">&times;</button>
  <ul class="mobile-menu">
    <li><a href="../index.php">Trang chủ</a></li>
    <li class="dropdown">
      <a href="#" class="dropdown-toggle">Chọn game</a>
      <ul class="dropdown-submenu">
        <li><a href="caro.php">🎯 Cờ Caro 20x20</a></li>
        <li><a href="co-tuong.php">🐉 Cờ Tướng</a></li>
        <li><a href="flappy-race.php">🏁 Flappy Race</a></li>
        <li><a href="#">🎮 Xếp gạch (Sắp có)</a></li>
        <li><a href="#">🔫 Bắn súng (Sắp có)</a></li>
        <li><a href="#">🏎️ Đua xe (Sắp có)</a></li>
      </ul>
    </li>
    <li><a href="#">💎 Nạp VIP</a></li>
    <li><a href="#">🏆 Bảng xếp hạng</a></li>
  </ul>
</div>

<style>
  /* Mobile overlay */
  #mobileMenuOverlay {
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background: rgba(0,0,0,0.95);
    color: white;
    z-index: 1050;
    display: none;
    flex-direction: column;
    justify-content: center;
    align-items: center;
  }
  #mobileMenuOverlay ul.mobile-menu {
    list-style: none;
    padding: 0;
    text-align: center;
  }
  #mobileMenuOverlay ul.mobile-menu li {
    margin: 20px 0;
    position: relative;
  }
  #mobileMenuOverlay ul.mobile-menu li a {
    color: white;
    font-size: 1.5rem;
    text-decoration: none;
    cursor: pointer;
  }
  #mobileMenuOverlay ul.mobile-menu li a:hover { text-decoration: underline; }
  .dropdown-submenu {
    display: none;
    list-style: none;
    padding-left: 0;
    margin-top: 10px;
  }
  #closeMobileMenu {
    position: absolute;
    top: 20px; right: 20px;
    font-size: 2rem;
    background: none; border: none;
    color: white;
    cursor: pointer;
  }

  /* Slide effect for desktop dropdown */
  .dropdown-menu {
    display: none;
    transition: max-height 0.3s ease, opacity 0.3s ease;
    overflow: hidden;
    max-height: 0;
    opacity: 0;
  }
  .dropdown-menu.show {
    display: block;
    max-height: 500px;
    opacity: 1;
  }

  /* Desktop ≥992px */
  @media(min-width: 992px){
    #mobileMenuOverlay { display: none !important; }
    #navbarGame { display: flex !important; }
  }
</style>

<script>
document.addEventListener('DOMContentLoaded', function() {
  // ===== Mobile Menu =====
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileMenuOverlay = document.getElementById('mobileMenuOverlay');
  const closeBtn = document.getElementById('closeMobileMenu');

  if (mobileMenuBtn && mobileMenuOverlay && closeBtn) {
    mobileMenuBtn.addEventListener('click', ()=> mobileMenuOverlay.style.display = 'flex');
    closeBtn.addEventListener('click', ()=> mobileMenuOverlay.style.display = 'none');

    const dropdownToggles = document.querySelectorAll('.mobile-menu .dropdown-toggle');
    dropdownToggles.forEach(toggle => {
      toggle.addEventListener('click', function(e){
        e.preventDefault();
        const submenu = this.nextElementSibling;
        if (submenu) {
          submenu.style.display = (submenu.style.display === 'block') ? 'none' : 'block';
        }
      });
    });
  }

  // ===== Desktop Dropdown =====
  const dropdowns = document.querySelectorAll('.navbar .dropdown');

  dropdowns.forEach(drop => {
    const toggle = drop.querySelector('.dropdown-toggle');
    const menu = drop.querySelector('.dropdown-menu');

    if (toggle && menu) {
      toggle.addEventListener('click', function(e){
        if(window.innerWidth >= 992){
          e.preventDefault();
          e.stopPropagation();

          // Toggle menu
          if(menu.classList.contains('show')){
            menu.classList.remove('show');
          } else {
            // Đóng tất cả dropdown khác trước
            document.querySelectorAll('.navbar .dropdown-menu.show').forEach(m=> m.classList.remove('show'));
            menu.classList.add('show');
          }
        }
      });
    }
  });

  // Click ngoài đóng dropdown desktop
  document.addEventListener('click', function(){
    if(window.innerWidth >= 992){
      document.querySelectorAll('.navbar .dropdown-menu.show').forEach(m=> m.classList.remove('show'));
    }
  });

  // Resize: đóng dropdown khi chuyển sang mobile
  window.addEventListener('resize', function(){
    if(window.innerWidth < 992){
      document.querySelectorAll('.navbar .dropdown-menu.show').forEach(m=> m.classList.remove('show'));
    }
  });
});
</script>