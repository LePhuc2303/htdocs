// src/games/CaroGame.js - Caro Game Implementation
const BaseGame = require('../BaseGame');

class CaroGame extends BaseGame {
  constructor(gameId) {
    super(gameId, 'caro', 2);
    this.BOARD_SIZE = 20;
    this.WIN_CONSECUTIVE = 5;
    this.board = Array(this.BOARD_SIZE).fill().map(() => Array(this.BOARD_SIZE).fill(''));
    this.currentPlayer = 'X';
    this.winner = null;
  }

  onPlayerJoined(playerInfo) {
    const symbol = this.players.length === 1 ? 'X' : 'O';
    playerInfo.symbol = symbol;

    if (this.players.length === 2) {
      this.status = 'playing';
      this.broadcastGameState();
    }

    return { symbol, playerIndex: this.players.length - 1 };
  }

  onPlayerLeft(playerId) {
    this.status = 'waiting';
    this.broadcastGameState();
  }

  handleGameAction(playerId, action, data) {
    switch (action) {
      case 'makeMove':
        return this.makeMove(playerId, data.row, data.col);
      default:
        return { error: 'Unknown action' };
    }
  }

  makeMove(playerId, row, col) {
    if (this.status !== 'playing') return { error: 'Game chưa bắt đầu hoặc đã kết thúc' };
    
    const player = this.players.find(p => p.playerId === playerId);
    if (!player) return { error: 'Người chơi không tồn tại' };
    if (player.symbol !== this.currentPlayer) return { error: 'Không phải lượt của bạn' };
    if (!this.inBoard(row, col)) return { error: 'Nước đi ngoài bàn cờ' };
    if (this.board[row][col] !== '') return { error: 'Ô này đã được đánh' };

    this.board[row][col] = this.currentPlayer;

    if (this.checkWin(row, col)) {
      this.status = 'finished';
      this.winner = this.currentPlayer;
    } else if (this.isBoardFull()) {
      this.status = 'finished';
      this.winner = 'draw';
    } else {
      this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
    }

    this.broadcastGameState();
    return { success: true };
  }

  inBoard(r, c) {
    return r >= 0 && r < this.BOARD_SIZE && c >= 0 && c < this.BOARD_SIZE;
  }

  checkWin(row, col) {
    const symbol = this.board[row][col];
    const dirs = [[0, 1], [1, 0], [1, 1], [1, -1]];
    
    for (const [dx, dy] of dirs) {
      let count = 1;
      
      for (let i = 1; i < this.WIN_CONSECUTIVE; i++) {
        const r = row + dx * i, c = col + dy * i;
        if (!this.inBoard(r, c) || this.board[r][c] !== symbol) break;
        count++;
      }
      
      for (let i = 1; i < this.WIN_CONSECUTIVE; i++) {
        const r = row - dx * i, c = col - dy * i;
        if (!this.inBoard(r, c) || this.board[r][c] !== symbol) break;
        count++;
      }

      if (count >= this.WIN_CONSECUTIVE) return true;
    }
    return false;
  }

  isBoardFull() {
    return this.board.every(row => row.every(cell => cell !== ''));
  }

  resetGame() {
    super.resetGame();
    this.board = Array(this.BOARD_SIZE).fill().map(() => Array(this.BOARD_SIZE).fill(''));
    this.currentPlayer = 'X';
    this.status = this.players.length === 2 ? 'playing' : 'waiting';
    this.winner = null;
    this.broadcastGameState();
  }

  broadcastGameState() {
    const payload = {
      ...this.getGameState(),
      board: this.board,
      currentPlayer: this.currentPlayer,
      winner: this.winner,
      players: this.players.map(p => ({ playerId: p.playerId, symbol: p.symbol }))
    };
    this.broadcast(payload);
  }
}

module.exports = CaroGame;