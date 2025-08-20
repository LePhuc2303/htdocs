// src/games/XiangqiGame.js - Xiangqi (Cờ Tướng) Game Implementation
const BaseGame = require('../BaseGame');

class XiangqiGame extends BaseGame {
  constructor(gameId) {
    super(gameId, 'xiangqi', 2);
    this.initializeBoard();
    this.currentPlayer = 'red'; // red đi trước
    this.winner = null;
    this.gameHistory = [];
    this.currentSettings = null;
  }

  applyGameSettings() {
    const settingsArray = Object.values(this.gameSettings);
    if (settingsArray.length > 0) {
      const settings = settingsArray[0];
      
      if (settings.colorSelection && settings.firstPlayer) {
        this.assignColorsAndTurn(settings);
      }
      
      if (settings.handicap && settings.handicap.length > 0) {
        this.applyHandicap(settings.handicap);
      }
    }
  }

  assignColorsAndTurn(settings) {
    if (settings.colorSelection === 'random') {
      const colors = ['red', 'black'];
      const shuffled = colors.sort(() => Math.random() - 0.5);
      this.players[0].color = shuffled[0];
      this.players[1].color = shuffled[1];
    } else if (settings.colorSelection === 'red') {
      this.players[0].color = 'red';
      this.players[1].color = 'black';
    } else if (settings.colorSelection === 'black') {
      this.players[0].color = 'black';
      this.players[1].color = 'red';
    }

    if (settings.firstPlayer === 'random') {
      this.currentPlayer = Math.random() < 0.5 ? 'red' : 'black';
    } else {
      this.currentPlayer = settings.firstPlayer;
    }
  }

  applyHandicap(handicapPieces) {
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 9; col++) {
        const piece = this.board[row][col];
        if (piece) {
          const pieceType = piece.split('_')[1];
          if (handicapPieces.includes(pieceType)) {
            this.board[row][col] = null;
            break;
          }
        }
      }
    }
  }

  initializeBoard() {
    // Khởi tạo bàn cờ 9x10 - Layout chuẩn cờ tướng
    this.board = Array(10).fill().map(() => Array(9).fill(null));
    
    // Quân đen ở trên (hàng 0, 2, 3) - Black pieces on top
    this.board[0] = ['b_車', 'b_馬', 'b_象', 'b_士', 'b_將', 'b_士', 'b_象', 'b_馬', 'b_車'];
    this.board[2] = [null, 'b_炮', null, null, null, null, null, 'b_炮', null];
    this.board[3] = ['b_兵', null, 'b_兵', null, 'b_兵', null, 'b_兵', null, 'b_兵'];
    
    // Quân đỏ ở dưới (hàng 6, 7, 9) - Red pieces on bottom
    this.board[6] = ['r_兵', null, 'r_兵', null, 'r_兵', null, 'r_兵', null, 'r_兵'];
    this.board[7] = [null, 'r_炮', null, null, null, null, null, 'r_炮', null];
    this.board[9] = ['r_車', 'r_馬', 'r_象', 'r_士', 'r_將', 'r_士', 'r_象', 'r_馬', 'r_車'];
  }

  onPlayerJoined(playerInfo) {
    const color = this.players.length === 1 ? 'red' : 'black';
    playerInfo.color = color;
    playerInfo.isHost = playerInfo.playerId === this.hostId;

    if (this.players.length === 2) {
      this.status = 'setup';
      this.broadcastGameState();
    }

    if (this.currentSettings) {
      setTimeout(() => {
        this.broadcastSettings(this.currentSettings);
      }, 100);
    }

    return { 
      color, 
      playerIndex: this.players.length - 1,
      isHost: playerInfo.isHost
    };
  }

  onPlayerLeft(playerId) {
    this.status = 'waiting';
    this.playersReady = {};
    this.broadcastGameState();
  }

  handleGameAction(playerId, action, data) {
    switch (action) {
      case 'makeMove':
        return this.makeMove(playerId, data.fromRow, data.fromCol, data.toRow, data.toCol);
      case 'getValidMoves':
        return this.getValidMoves(data.row, data.col);
      case 'surrender':
        return this.handleSurrender(playerId);
      default:
        return { error: 'Unknown action' };
    }
  }

  handleSurrender(playerId) {
    if (this.status !== 'playing') return { error: 'Game chưa bắt đầu hoặc đã kết thúc' };
    
    const player = this.players.find(p => p.playerId === playerId);
    if (!player) return { error: 'Người chơi không tồn tại' };
    
    const winnerColor = player.color === 'red' ? 'black' : 'red';
    
    this.status = 'finished';
    this.winner = winnerColor;
    
    this.broadcastGameState();
    
    this.broadcast({
      type: 'gameMessage',
      message: `${player.color === 'red' ? 'Đỏ' : 'Đen'} đã đầu hàng!`
    });
    
    return { success: true };
  }

  makeMove(playerId, fromRow, fromCol, toRow, toCol) {
    if (this.status !== 'playing') return { error: 'Game chưa bắt đầu hoặc đã kết thúc' };
    
    const player = this.players.find(p => p.playerId === playerId);
    if (!player) return { error: 'Người chơi không tồn tại' };
    if (player.color !== this.currentPlayer) return { error: 'Không phải lượt của bạn' };

    if (!this.isValidMove(fromRow, fromCol, toRow, toCol, player.color)) {
      return { error: 'Nước đi không hợp lệ' };
    }

    // Thực hiện nước đi
    const piece = this.board[fromRow][fromCol];
    const capturedPiece = this.board[toRow][toCol];
    
    this.board[fromRow][fromCol] = null;
    this.board[toRow][toCol] = piece;

    // Lưu lịch sử
    this.gameHistory.push({
      from: [fromRow, fromCol],
      to: [toRow, toCol],
      piece,
      captured: capturedPiece,
      player: this.currentPlayer
    });

    // Kiểm tra thắng thua
    if (this.isCheckmate(this.currentPlayer === 'red' ? 'black' : 'red')) {
      this.status = 'finished';
      this.winner = this.currentPlayer;
    } else {
      this.currentPlayer = this.currentPlayer === 'red' ? 'black' : 'red';
    }

    this.broadcastGameState();
    return { success: true };
  }

  isValidMove(fromRow, fromCol, toRow, toCol, playerColor) {
    if (!this.inBounds(fromRow, fromCol) || !this.inBounds(toRow, toCol)) return false;
    
    const piece = this.board[fromRow][fromCol];
    if (!piece) return false;
    
    const pieceColor = piece.startsWith('r_') ? 'red' : 'black';
    if (pieceColor !== playerColor) return false;
    
    const targetPiece = this.board[toRow][toCol];
    if (targetPiece) {
      const targetColor = targetPiece.startsWith('r_') ? 'red' : 'black';
      if (targetColor === pieceColor) return false;
    }

    const pieceType = piece.split('_')[1];
    return this.isValidPieceMove(pieceType, fromRow, fromCol, toRow, toCol, playerColor);
  }

  isValidPieceMove(pieceType, fromRow, fromCol, toRow, toCol, color) {
    switch (pieceType) {
      case '將': // Tướng
        return this.isValidGeneralMove(fromRow, fromCol, toRow, toCol, color);
      case '士': // Sĩ
        return this.isValidAdvisorMove(fromRow, fromCol, toRow, toCol, color);
      case '象': // Tượng
        return this.isValidElephantMove(fromRow, fromCol, toRow, toCol, color);
      case '馬': // Mã
        return this.isValidHorseMove(fromRow, fromCol, toRow, toCol);
      case '車': // Xe
        return this.isValidChariotMove(fromRow, fromCol, toRow, toCol);
      case '炮': // Pháo
        return this.isValidCannonMove(fromRow, fromCol, toRow, toCol);
      case '兵': // Tốt
        return this.isValidSoldierMove(fromRow, fromCol, toRow, toCol, color);
      default:
        return false;
    }
  }

  isValidGeneralMove(fromRow, fromCol, toRow, toCol, color) {
    const rowDiff = Math.abs(toRow - fromRow);
    const colDiff = Math.abs(toCol - fromCol);
    
    // Chỉ di chuyển 1 ô theo chiều dọc hoặc ngang
    if ((rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1)) {
      // Kiểm tra trong cung - Fixed palace boundaries
      if (color === 'black') {
        return toRow >= 0 && toRow <= 2 && toCol >= 3 && toCol <= 5;
      } else {
        return toRow >= 7 && toRow <= 9 && toCol >= 3 && toCol <= 5;
      }
    }
    
    // Flying general rule - generals face each other
    if (colDiff === 0 && fromCol >= 3 && fromCol <= 5) {
      const targetPiece = this.board[toRow][toCol];
      if (targetPiece && targetPiece.split('_')[1] === '將') {
        return this.isPathClear(fromRow, fromCol, toRow, toCol);
      }
    }
    
    return false;
  }

  isValidAdvisorMove(fromRow, fromCol, toRow, toCol, color) {
    const rowDiff = Math.abs(toRow - fromRow);
    const colDiff = Math.abs(toCol - fromCol);
    
    // Di chuyển chéo 1 ô
    if (rowDiff === 1 && colDiff === 1) {
      if (color === 'black') {
        return toRow >= 0 && toRow <= 2 && toCol >= 3 && toCol <= 5;
      } else {
        return toRow >= 7 && toRow <= 9 && toCol >= 3 && toCol <= 5;
      }
    }
    return false;
  }

  isValidElephantMove(fromRow, fromCol, toRow, toCol, color) {
    const rowDiff = toRow - fromRow;
    const colDiff = toCol - fromCol;
    
    // Di chuyển chéo 2 ô
    if (Math.abs(rowDiff) === 2 && Math.abs(colDiff) === 2) {
      // Kiểm tra không bị chặn
      const blockRow = fromRow + rowDiff / 2;
      const blockCol = fromCol + colDiff / 2;
      if (this.board[blockRow][blockCol]) return false;
      
      // Không qua sông
      if (color === 'black') {
        return toRow <= 4;
      } else {
        return toRow >= 5;
      }
    }
    return false;
  }

  isValidHorseMove(fromRow, fromCol, toRow, toCol) {
    const rowDiff = Math.abs(toRow - fromRow);
    const colDiff = Math.abs(toCol - fromCol);
    
    if ((rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2)) {
      // Kiểm tra bị chặn chân
      let blockRow, blockCol;
      if (rowDiff === 2) {
        blockRow = fromRow + (toRow > fromRow ? 1 : -1);
        blockCol = fromCol;
      } else {
        blockRow = fromRow;
        blockCol = fromCol + (toCol > fromCol ? 1 : -1);
      }
      return !this.board[blockRow][blockCol];
    }
    return false;
  }

  isValidChariotMove(fromRow, fromCol, toRow, toCol) {
    // Di chuyển thẳng hàng hoặc cột
    if (fromRow === toRow || fromCol === toCol) {
      return this.isPathClear(fromRow, fromCol, toRow, toCol);
    }
    return false;
  }

  isValidCannonMove(fromRow, fromCol, toRow, toCol) {
    if (fromRow === toRow || fromCol === toCol) {
      const piecesBetween = this.countPiecesBetween(fromRow, fromCol, toRow, toCol);
      const targetPiece = this.board[toRow][toCol];
      
      if (targetPiece) {
        // Ăn quân: phải có đúng 1 quân chắn
        return piecesBetween === 1;
      } else {
        // Di chuyển: không có quân chắn
        return piecesBetween === 0;
      }
    }
    return false;
  }

  isValidSoldierMove(fromRow, fromCol, toRow, toCol, color) {
    const rowDiff = toRow - fromRow;
    const colDiff = Math.abs(toCol - fromCol);
    
    if (color === 'black') {
      // Tốt đen đi xuống
      if (fromRow <= 4) {
        // Chưa qua sông: chỉ đi thẳng
        return rowDiff === 1 && colDiff === 0;
      } else {
        // Đã qua sông: đi thẳng hoặc ngang
        return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
      }
    } else {
      // Tốt đỏ đi lên
      if (fromRow >= 5) {
        // Chưa qua sông
        return rowDiff === -1 && colDiff === 0;
      } else {
        // Đã qua sông
        return (rowDiff === -1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1);
      }
    }
  }

  isPathClear(fromRow, fromCol, toRow, toCol) {
    const rowStep = fromRow === toRow ? 0 : (toRow > fromRow ? 1 : -1);
    const colStep = fromCol === toCol ? 0 : (toCol > fromCol ? 1 : -1);
    
    let currentRow = fromRow + rowStep;
    let currentCol = fromCol + colStep;
    
    while (currentRow !== toRow || currentCol !== toCol) {
      if (this.board[currentRow][currentCol]) return false;
      currentRow += rowStep;
      currentCol += colStep;
    }
    return true;
  }

  countPiecesBetween(fromRow, fromCol, toRow, toCol) {
    const rowStep = fromRow === toRow ? 0 : (toRow > fromRow ? 1 : -1);
    const colStep = fromCol === toCol ? 0 : (toCol > fromCol ? 1 : -1);
    
    let count = 0;
    let currentRow = fromRow + rowStep;
    let currentCol = fromCol + colStep;
    
    while (currentRow !== toRow || currentCol !== toCol) {
      if (this.board[currentRow][currentCol]) count++;
      currentRow += rowStep;
      currentCol += colStep;
    }
    return count;
  }

  inBounds(row, col) {
    return row >= 0 && row < 10 && col >= 0 && col < 9;
  }

  findGeneral(color) {
    const generalPiece = color === 'red' ? 'r_將' : 'b_將';
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 9; col++) {
        if (this.board[row][col] === generalPiece) {
          return [row, col];
        }
      }
    }
    return null;
  }

  isInCheck(color) {
    const generalPos = this.findGeneral(color);
    if (!generalPos) return false;
    
    const [generalRow, generalCol] = generalPos;
    const opponentColor = color === 'red' ? 'black' : 'red';
    
    // Kiểm tra tất cả quân của đối phương có thể ăn tướng không
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 9; col++) {
        const piece = this.board[row][col];
        if (piece) {
          const pieceColor = piece.startsWith('r_') ? 'red' : 'black';
          if (pieceColor === opponentColor) {
            if (this.isValidMove(row, col, generalRow, generalCol, opponentColor)) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  isCheckmate(color) {
    if (!this.isInCheck(color)) return false;
    
    // Thử tất cả nước đi có thể của màu này
    for (let fromRow = 0; fromRow < 10; fromRow++) {
      for (let fromCol = 0; fromCol < 9; fromCol++) {
        const piece = this.board[fromRow][fromCol];
        if (piece) {
          const pieceColor = piece.startsWith('r_') ? 'red' : 'black';
          if (pieceColor === color) {
            // Thử tất cả nước đi có thể của quân này
            for (let toRow = 0; toRow < 10; toRow++) {
              for (let toCol = 0; toCol < 9; toCol++) {
                if (this.isValidMove(fromRow, fromCol, toRow, toCol, color)) {
                  // Mô phỏng nước đi
                  const originalPiece = this.board[toRow][toCol];
                  this.board[toRow][toCol] = piece;
                  this.board[fromRow][fromCol] = null;
                  
                  const stillInCheck = this.isInCheck(color);
                  
                  // Hoàn tác
                  this.board[fromRow][fromCol] = piece;
                  this.board[toRow][toCol] = originalPiece;
                  
                  if (!stillInCheck) return false; // Có nước đi thoát chiếu
                }
              }
            }
          }
        }
      }
    }
    return true; // Không có nước đi nào thoát được chiếu
  }

  broadcastSettings(settings) {
    this.currentSettings = settings;
    
    this.broadcast({
      type: 'settingsUpdate',
      settings: settings
    });
  }

  resetGame() {
    super.resetGame();
    this.initializeBoard();
    this.currentPlayer = 'red';
    this.status = this.players.length === 2 ? 'setup' : 'waiting';
    this.winner = null;
    this.gameHistory = [];
    this.broadcastGameState();
  }

  broadcastGameState() {
    const payload = {
      ...this.getGameState(),
      board: this.board,
      currentPlayer: this.currentPlayer,
      winner: this.winner,
      players: this.players.map(p => ({ 
        playerId: p.playerId, 
        color: p.color,
        isHost: p.isHost
      })),
      spectators: (this.spectators || []).map(s => ({
        playerId: s.playerId
      })),
      hostId: this.hostId,
      isInCheck: {
        red: this.isInCheck('red'),
        black: this.isInCheck('black')
      }
    };
    this.broadcast(payload);
  }

  getValidMoves(row, col) {
    const piece = this.board[row][col];
    if (!piece) return [];
    
    const pieceColor = piece.startsWith('r_') ? 'red' : 'black';
    const validMoves = [];
    
    // Check all possible destinations
    for (let toRow = 0; toRow < 10; toRow++) {
      for (let toCol = 0; toCol < 9; toCol++) {
        if (this.isValidMove(row, col, toRow, toCol, pieceColor)) {
          validMoves.push({ row: toRow, col: toCol });
        }
      }
    }
    
    return validMoves;
  }
}

module.exports = XiangqiGame;