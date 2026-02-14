import Board from './components/Board.js';
import { HEROES } from './heroes.js';

const gameBoard = new Board();

const heroPoolDiv = document.getElementById('hero-pool');
const board1Div = document.getElementById('board1');
const board2Div = document.getElementById('board2');
const nextPhaseBtn = document.getElementById('next-phase');

let heroPool = HEROES.filter(hero => hero && hero.draftable !== false);
let boards = {
  player1: Array(9).fill(null),
  player2: Array(9).fill(null)
};
let currentPlayer = 'player1';
let picks = { player1: 0, player2: 0 };
const maxPicks = 4; // For intro game

function initGame() {
    const container = document.getElementById('board1'); // or a dedicated container
    const boardElement = gameBoard.render();
    container.appendChild(boardElement);

    setupEventListeners();
    renderHeroPool();
    renderBoard('player1', board1Div);
    renderBoard('player2', board2Div);
}

function setupEventListeners() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        cell.addEventListener('click', handleCellClick);
    });
}

function handleCellClick(event) {
    const cell = event.target;
    const cellIndex = cell.dataset.index;

    if (gameBoard.updateBoard(cellIndex)) {
        if (gameBoard.checkWinCondition()) {
            alert('Player wins!');
            resetGame();
        } else if (gameBoard.isBoardFull()) {
            alert('It\'s a draw!');
            resetGame();
        }
    }
}

function resetGame() {
    gameBoard.resetGame();
    gameBoard.render();
}

function renderHeroPool() {
  heroPoolDiv.innerHTML = '';
  heroPool.forEach((hero, idx) => {
    const btn = document.createElement('button');
    btn.textContent = hero.name;
    btn.onclick = () => pickHero(idx);
    heroPoolDiv.appendChild(btn);
  });
}

function renderBoard(player, boardDiv) {
  boardDiv.innerHTML = '';
  boards[player].forEach((hero, idx) => {
    const cell = document.createElement('div');
    cell.className = 'tile';
    cell.textContent = hero ? hero.name : '';
    cell.onclick = () => placeHero(idx);
    boardDiv.appendChild(cell);
  });
}

function pickHero(heroIdx) {
  if (picks[currentPlayer] >= maxPicks) return;
  const hero = heroPool[heroIdx];
  // Find first empty slot
  const slotIdx = boards[currentPlayer].findIndex(h => h === null);
  if (slotIdx === -1) return;
  boards[currentPlayer][slotIdx] = hero;
  heroPool.splice(heroIdx, 1);
  picks[currentPlayer]++;
  renderHeroPool();
  renderBoard(currentPlayer, currentPlayer === 'player1' ? board1Div : board2Div);
  switchPlayer();
  checkDraftComplete();
}

function placeHero(idx) {
  // Optional: allow repositioning during draft
}

function switchPlayer() {
  currentPlayer = currentPlayer === 'player1' ? 'player2' : 'player1';
}

function checkDraftComplete() {
  if (picks.player1 === maxPicks && picks.player2 === maxPicks) {
    nextPhaseBtn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', initGame);