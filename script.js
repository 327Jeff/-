/* Configuration */
const DIFFICULTY = {
    easy: { rows: 9, cols: 9, mines: 10 },
    medium: { rows: 16, cols: 16, mines: 40 },
    hard: { rows: 16, cols: 30, mines: 99 }
};

/* State */
let currentConfig = DIFFICULTY.easy;
let grid = []; // 2D array of cell objects
let gameActive = false;
let mineCount = 0;
let timeElapsed = 0;
let timerInterval;
let historyStack = []; // For King Crimson Undo
let firstClick = true;

/* DOM Elements */
const boardElement = document.getElementById('game-board');
const timerElement = document.getElementById('timer');
const mineCountElement = document.getElementById('mine-count');
const resetBtn = document.getElementById('reset-btn');
const backMenuBtn = document.getElementById('back-menu-btn');
const undoContainer = document.getElementById('undo-container');
const undoBtn = document.getElementById('undo-btn');
const punchOverlay = document.getElementById('punch-overlay');
const timeEraseOverlay = document.getElementById('time-erase-overlay');
const startScreen = document.getElementById('start-screen');
const gameContainer = document.getElementById('game-container');
const winScreen = document.getElementById('win-screen');
const winRetryBtn = document.getElementById('win-retry-btn');
const winMenuBtn = document.getElementById('win-menu-btn');
const menuBtns = document.querySelectorAll('.menu-btn');

/* Logic */

function startGame(difficulty) {
    currentConfig = DIFFICULTY[difficulty];

    // Transition UI
    startScreen.classList.add('hidden-up');
    gameContainer.classList.remove('hidden');
    winScreen.classList.add('hidden'); // Ensure hidden

    initGame();
}

function initGame() {
    // Clear State
    gameActive = true;
    firstClick = true;
    timeElapsed = 0;
    historyStack = [];
    grid = [];

    // UI Reset
    clearInterval(timerInterval);
    timerElement.textContent = '000';
    updateMineCount(currentConfig.mines);
    undoContainer.classList.add('hidden');
    winScreen.classList.add('hidden'); // Ensure hidden
    boardElement.innerHTML = '';

    // Set Grid CSS
    boardElement.style.gridTemplateColumns = `repeat(${currentConfig.cols}, 30px)`;
    boardElement.style.gridTemplateRows = `repeat(${currentConfig.rows}, 30px)`;

    // Create Cells
    for (let r = 0; r < currentConfig.rows; r++) {
        const row = [];
        for (let c = 0; c < currentConfig.cols; c++) {
            const cellData = {
                r, c,
                isMine: false,
                isRevealed: false,
                isFlagged: false,
                neighborMines: 0
            };
            row.push(cellData);

            const cellDiv = document.createElement('div');
            cellDiv.classList.add('cell');
            cellDiv.dataset.r = r;
            cellDiv.dataset.c = c;

            // Event Listeners
            cellDiv.addEventListener('click', () => handleLeftClick(r, c));
            cellDiv.addEventListener('contextmenu', (e) => handleRightClick(e, r, c));

            boardElement.appendChild(cellDiv);
            cellData.element = cellDiv; // Store ref
        }
        grid.push(row);
    }
}

/* Core Logic */
function saveState() {
    // Deep copy grid state (excluding DOM elements)
    const stateSnapshot = grid.map(row => row.map(cell => ({
        isMine: cell.isMine,
        isRevealed: cell.isRevealed,
        isFlagged: cell.isFlagged,
        neighborMines: cell.neighborMines
    })));

    historyStack.push({
        grid: stateSnapshot,
        mineCount,
        firstClick
    });

    // Limit stack size if needed, but 50 actions is plenty
    if (historyStack.length > 50) historyStack.shift();
}

function handleLeftClick(r, c) {
    if (!gameActive) return;
    const cell = grid[r][c];
    if (cell.isRevealed || cell.isFlagged) return;

    if (firstClick) {
        startTimer();
        placeMines(r, c);
        // Only First Click logic needed here.
    }

    saveState(); // Save before action

    if (firstClick) firstClick = false;

    if (cell.isMine) {
        triggerGameOver(cell);
    } else {
        revealCell(r, c);
        checkWin();
    }
}

function handleRightClick(e, r, c) {
    e.preventDefault();
    if (!gameActive) return;
    const cell = grid[r][c];
    if (cell.isRevealed) return;

    if (firstClick) {
        startTimer();
        firstClick = false;
    }

    saveState();

    cell.isFlagged = !cell.isFlagged;
    cell.element.classList.toggle('flag');
    cell.element.textContent = cell.isFlagged ? '🚩' : '';

    updateMineCount(mineCount + (cell.isFlagged ? -1 : 1));
}

function placeMines(safeR, safeC) {
    let minesPlaced = 0;
    while (minesPlaced < currentConfig.mines) {
        const r = Math.floor(Math.random() * currentConfig.rows);
        const c = Math.floor(Math.random() * currentConfig.cols);

        // Ensure safe zone around first click (3x3 area)
        if (Math.abs(r - safeR) <= 1 && Math.abs(c - safeC) <= 1) continue;

        if (!grid[r][c].isMine) {
            grid[r][c].isMine = true;
            minesPlaced++;
        }
    }

    // Calculate numbers
    for (let r = 0; r < currentConfig.rows; r++) {
        for (let c = 0; c < currentConfig.cols; c++) {
            if (!grid[r][c].isMine) {
                grid[r][c].neighborMines = countNeighbors(r, c);
            }
        }
    }
}

function countNeighbors(r, c) {
    let count = 0;
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            const nr = r + i;
            const nc = c + j;
            if (nr >= 0 && nr < currentConfig.rows && nc >= 0 && nc < currentConfig.cols) {
                if (grid[nr][nc].isMine) count++;
            }
        }
    }
    return count;
}

function revealCell(r, c) {
    const cell = grid[r][c];
    if (cell.isRevealed || cell.isFlagged) return;

    cell.isRevealed = true;
    cell.element.classList.add('revealed');

    if (cell.neighborMines > 0) {
        cell.element.textContent = cell.neighborMines;
        cell.element.dataset.num = cell.neighborMines;
    } else {
        // Flood fill
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const nr = r + i;
                const nc = c + j;
                if (nr >= 0 && nr < currentConfig.rows && nc >= 0 && nc < currentConfig.cols) {
                    revealCell(nr, nc);
                }
            }
        }
    }
}

/* Game Flow & Effects */
function triggerGameOver(triggerCell) {
    gameActive = false;
    clearInterval(timerInterval);

    // Reveal Mine
    triggerCell.element.style.backgroundColor = 'red';

    // Punch Effect
    punchOverlay.classList.remove('hidden');
    punchOverlay.classList.add('punch-active');
    document.body.classList.add('shake-screen');

    setTimeout(() => {
        punchOverlay.classList.remove('punch-active');
        punchOverlay.classList.add('hidden');
        document.body.classList.remove('shake-screen');

        // Show all mines
        grid.forEach(row => row.forEach(cell => {
            if (cell.isMine) {
                cell.element.classList.add('mine');
                cell.element.textContent = '💣';
            }
        }));

        // Show Undo Button
        undoContainer.classList.remove('hidden');
    }, 1000);
}

function handleUndo() {
    if (historyStack.length === 0) return;

    // Time Erase Effect
    timeEraseOverlay.classList.remove('hidden');
    timeEraseOverlay.classList.add('erase-active');

    setTimeout(() => {
        const lastState = historyStack.pop();

        // Restore meta
        mineCount = lastState.mineCount;
        firstClick = lastState.firstClick;
        updateMineCount(mineCount);

        // Restore Grid
        for (let r = 0; r < currentConfig.rows; r++) {
            for (let c = 0; c < currentConfig.cols; c++) {
                const saved = lastState.grid[r][c];
                const cell = grid[r][c];

                cell.isMine = saved.isMine;
                cell.isRevealed = saved.isRevealed;
                cell.isFlagged = saved.isFlagged;
                cell.neighborMines = saved.neighborMines;

                cell.element.className = 'cell';
                cell.element.textContent = '';
                delete cell.element.dataset.num;

                if (cell.isRevealed) {
                    cell.element.classList.add('revealed');
                    if (cell.neighborMines > 0) {
                        cell.element.textContent = cell.neighborMines;
                        cell.element.dataset.num = cell.neighborMines;
                    }
                }
                if (cell.isFlagged) {
                    cell.element.classList.add('flag');
                    cell.element.textContent = '🚩';
                }
            }
        }

        gameActive = true;
        if (!firstClick) {
            startTimer();
        } else {
            clearInterval(timerInterval);
            timeElapsed = 0;
            timerElement.textContent = '000';
        }

        undoContainer.classList.add('hidden');
        winScreen.classList.add('hidden');

    }, 500);

    setTimeout(() => {
        timeEraseOverlay.classList.remove('erase-active');
        timeEraseOverlay.classList.add('hidden');
    }, 1000);
}

function checkWin() {
    let unrevealedSafeCells = 0;
    grid.forEach(row => row.forEach(cell => {
        if (!cell.isMine && !cell.isRevealed) unrevealedSafeCells++;
    }));

    if (unrevealedSafeCells === 0) {
        gameActive = false;
        clearInterval(timerInterval);
        // Show Win Screen
        setTimeout(() => {
            winScreen.classList.remove('hidden');
        }, 500);
    }
}

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeElapsed++;
        timerElement.textContent = timeElapsed.toString().padStart(3, '0');
    }, 1000);
}

function updateMineCount(count) {
    mineCount = count;
    mineCountElement.textContent = count.toString().padStart(3, '0');
}

function backToMenu() {
    gameActive = false;
    clearInterval(timerInterval);
    gameContainer.classList.add('hidden');
    startScreen.classList.remove('hidden-up');
    winScreen.classList.add('hidden');
}

/* Event Listeners */
resetBtn.addEventListener('click', () => initGame());
backMenuBtn.addEventListener('click', backToMenu);
undoBtn.addEventListener('click', handleUndo);

if (winRetryBtn) {
    winRetryBtn.addEventListener('click', () => {
        winScreen.classList.add('hidden');
        initGame();
    });
}

if (winMenuBtn) {
    winMenuBtn.addEventListener('click', () => {
        backToMenu();
    });
}

menuBtns.forEach(btn => {
    // Check if it's a difficulty button (has data attribute)
    if (btn.dataset.diff) {
        btn.addEventListener('click', (e) => {
            const difficulty = e.target.dataset.diff;
            startGame(difficulty);
        });
    }
});
