

let boardElements = []; // Stores DOM elements of tiles
let boardState = []; // Stores logical state of tiles {isMine, isRevealed, isFlagged, adjacentMines}
let rows = 0;
let columns = 0;
let minesCount = 0;
let minesLocation = []; // "r-c" strings

let tilesClicked = 0;
let flagsPlaced = 0;
let gameOver = false;
let isFirstClick = true;
let timerInterval;
let secondsPassed = 0;

let currentDifficultySettings = null;

// Game elements
const boardDiv = document.getElementById("board");
const minesCountDisplay = document.getElementById("mines-count");
const timerDisplay = document.getElementById("timer");
const restartButton = document.getElementById("restart-button");
const difficultySelectorDiv = document.getElementById("difficulty-selector");
const gameAreaDiv = document.getElementById("game-area");
const modalDiv = document.getElementById("modal");
const modalTitle = document.getElementById("modal-title");
const modalMessage = document.getElementById("modal-message");
const modalPlayAgainButton = document.getElementById("modal-play-again");
const changeDifficultyButton = document.getElementById("change-difficulty-button");

const SMILEY_HAPPY = "🙂";
const SMILEY_SCARED = "😮";
const SMILEY_WON = "😎";
const SMILEY_LOST = "😵";

const DIFFICULTIES = {
    EASY: { name: 'Easy', width: 9, height: 9, numMines: 10 },
    MEDIUM: { name: 'Medium', width: 16, height: 16, numMines: 40 },
    HARD: { name: 'Hard', width: 30, height: 16, numMines: 99 },
};

window.onload = function() {
    setupDifficultyButtons();
    restartButton.addEventListener("click", () => {
        if (currentDifficultySettings) {
            resetGame(currentDifficultySettings);
        } else {
            handleChangeDifficulty(); // Go to difficulty selection if no game active
        }
    });
    modalPlayAgainButton.addEventListener("click", () => {
        hideModal();
        if (currentDifficultySettings) {
            resetGame(currentDifficultySettings);
        }
    });
    changeDifficultyButton.addEventListener("click", handleChangeDifficulty);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    boardDiv.addEventListener('contextmenu', e => e.preventDefault());
};

function setupDifficultyButtons() {
    Object.keys(DIFFICULTIES).forEach(key => {
        const button = difficultySelectorDiv.querySelector(`[data-difficulty="${key}"]`);
        button.addEventListener("click", () => selectDifficulty(DIFFICULTIES[key]));
    });
}

function selectDifficulty(difficulty) {
    currentDifficultySettings = difficulty;
    difficultySelectorDiv.style.display = "none";
    gameAreaDiv.style.display = "block";
    resetGame(difficulty);
}

function handleChangeDifficulty() {
    stopTimer();
    gameAreaDiv.style.display = "none";
    difficultySelectorDiv.style.display = "block";
    restartButton.innerText = SMILEY_HAPPY;
    timerDisplay.innerText = "000";
    minesCountDisplay.innerText = currentDifficultySettings ? String(currentDifficultySettings.numMines).padStart(3, "0") : "000";
    hideModal();
    clearAllPreviews();
    currentDifficultySettings = null;
    isFirstClick = true;
    gameOver = false;
    boardState = []; // Clear board state
    boardElements = []; // Clear board elements
    boardDiv.innerHTML = ""; // Clear board visually
}


function resetGame(difficulty) {
    rows = difficulty.height;
    columns = difficulty.width;
    minesCount = difficulty.numMines;
    currentDifficultySettings = difficulty;
    
    gameOver = false;
    isFirstClick = true;
    tilesClicked = 0;
    flagsPlaced = 0;
    secondsPassed = 0;
    minesLocation = [];
    boardElements = [];
    boardState = [];

    stopTimer();
    updateTimerDisplay();
    updateMinesCountDisplay();
    restartButton.innerText = SMILEY_HAPPY;
    hideModal();
    clearAllPreviews();

    initializeBoardState();
    createBoardDOM();
}

function initializeBoardState() {
    boardState = Array.from({ length: rows }, (_, r) =>
        Array.from({ length: columns }, (_, c) => ({
            r,
            c,
            isMine: false,
            isRevealed: false,
            isFlagged: false,
            adjacentMines: 0,
        }))
    );
}

function placeMines(safeR, safeC) {
    let minesToPlace = minesCount;
    const safeZone = new Set();
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            safeZone.add(`${safeR + dr}-${safeC + dc}`);
        }
    }

    while (minesToPlace > 0) {
        let r = Math.floor(Math.random() * rows);
        let c = Math.floor(Math.random() * columns);
        let id = `${r}-${c}`;

        if (!boardState[r][c].isMine && !safeZone.has(id)) {
            boardState[r][c].isMine = true;
            minesLocation.push(id);
            minesToPlace--;
        }
    }

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < columns; c++) {
            if (!boardState[r][c].isMine) {
                boardState[r][c].adjacentMines = countAdjacentMines(r, c);
            }
        }
    }
}

function countAdjacentMines(r, c) {
    let count = 0;
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (isValid(nr, nc) && boardState[nr][nc].isMine) {
                count++;
            }
        }
    }
    return count;
}

function createBoardDOM() {
    boardDiv.innerHTML = "";
    boardDiv.style.gridTemplateColumns = `repeat(${columns}, 30px)`;
    boardDiv.style.gridTemplateRows = `repeat(${rows}, 30px)`;
    boardElements = [];

    for (let r = 0; r < rows; r++) {
        let rowElements = [];
        for (let c = 0; c < columns; c++) {
            let tile = document.createElement("div");
            tile.classList.add("tile", "tile-hidden");
            tile.dataset.r = r;
            tile.dataset.c = c;
            
            tile.addEventListener("click", () => handleCellClick(r, c));
            tile.addEventListener("contextmenu", (e) => handleCellRightClick(e, r, c));
            tile.addEventListener("mousedown", (e) => handleCellMouseDown(e, r, c));

            boardDiv.append(tile);
            rowElements.push(tile);
        }
        boardElements.push(rowElements);
    }
}

function handleCellMouseDown(event, r, c) {
    if (gameOver || event.button !== 0) return; // Only left click affects preview

    const cellState = boardState[r][c];

    if (cellState.isRevealed && cellState.adjacentMines > 0) {
        // Mousedown on a number: show preview on eligible neighbors
        restartButton.innerText = SMILEY_SCARED;
        const neighbors = getNeighbors(r, c);
        neighbors.forEach(n_coord => {
            if (!boardState[n_coord.r][n_coord.c].isRevealed && !boardState[n_coord.r][n_coord.c].isFlagged) {
                boardElements[n_coord.r][n_coord.c].classList.add('preview');
            }
        });
    } else if (!cellState.isRevealed && !cellState.isFlagged) {
        // Mousedown on a hidden, unflagged cell
        restartButton.innerText = SMILEY_SCARED;
        boardElements[r][c].classList.add('preview');
    }
}

function handleGlobalMouseUp() {
    if (restartButton.innerText === SMILEY_SCARED && !gameOver) {
        restartButton.innerText = SMILEY_HAPPY;
    }
    clearAllPreviews();
}

function handleCellClick(r, c) {
    if (gameOver) return;

    const cellState = boardState[r][c];
    // Previews are cleared on global mouse up.

    if (cellState.isRevealed && cellState.adjacentMines > 0) {
        // Click on a revealed number: try to chord.
        const neighbors = getNeighbors(r, c);
        let adjacentFlags = 0;
        neighbors.forEach(n => {
            if (boardState[n.r][n.c].isFlagged) {
                adjacentFlags++;
            }
        });

        if (adjacentFlags === cellState.adjacentMines) {
            chord(r, c); // Perform chording action
        }
        // If flags don't match, nothing happens on click of a number.
    } else if (!cellState.isRevealed && !cellState.isFlagged) {
        // Click on a hidden, unflagged cell.
        boardElements[r][c].classList.remove('preview'); // Ensure preview is removed if this cell itself was clicked

        if (isFirstClick) {
            placeMines(r, c);
            isFirstClick = false;
            startTimer();
        }

        if (cellState.isMine) {
            revealCell(r, c); 
            boardElements[r][c].classList.add('mine-hit');
            endGame(false);
            return;
        }
        revealCellRecursive(r, c);

        if (checkWinCondition()) {
            endGame(true);
        }
    }
    
    if (!gameOver && ![SMILEY_WON, SMILEY_LOST].includes(restartButton.innerText) ) {
         restartButton.innerText = SMILEY_HAPPY;
    }
}


function handleCellRightClick(event, r, c) {
    event.preventDefault(); 
    if (gameOver || boardState[r][c].isRevealed) {
        return;
    }
    
    boardState[r][c].isFlagged = !boardState[r][c].isFlagged;
    if (boardState[r][c].isFlagged) {
        boardElements[r][c].innerText = "🚩";
        boardElements[r][c].classList.remove('preview'); // Cannot preview a flagged cell
        flagsPlaced++;
    } else {
        boardElements[r][c].innerText = "";
        flagsPlaced--;
    }
    updateMinesCountDisplay();
}

function revealCell(r, c) {
    // Returns 1 if a non-mine cell was newly revealed, 0 otherwise.
    if (!isValid(r,c) || boardState[r][c].isRevealed || boardState[r][c].isFlagged) return 0;

    boardState[r][c].isRevealed = true;
    
    const tileElement = boardElements[r][c];
    tileElement.classList.remove("tile-hidden", "preview"); 
    tileElement.classList.add("tile-revealed");
    tileElement.innerText = ""; 

    if (boardState[r][c].isMine) {
        tileElement.innerText = "💣";
        return 0; 
    }
    
    tilesClicked++; 

    if (boardState[r][c].adjacentMines > 0) {
        tileElement.innerText = boardState[r][c].adjacentMines;
        tileElement.classList.add(`x${boardState[r][c].adjacentMines}`);
    }
    return 1; 
}


function revealCellRecursive(r, c) {
    if (!isValid(r, c) || boardState[r][c].isRevealed || boardState[r][c].isFlagged || boardState[r][c].isMine) {
        return;
    }

    const cellRevealedResult = revealCell(r,c);
    
    if (cellRevealedResult === 1 && boardState[r][c].adjacentMines === 0) { 
        getNeighbors(r,c).forEach(n => revealCellRecursive(n.r, n.c));
    }
}

function chord(r, c) {
    if (gameOver || !boardState[r][c].isRevealed || boardState[r][c].adjacentMines === 0) return;

    const neighbors = getNeighbors(r, c);
    let hitMineInChord = false;

    for (const n of neighbors) {
        const neighborState = boardState[n.r][n.c];
        if (!neighborState.isRevealed && !neighborState.isFlagged) {
            if (neighborState.isMine) {
                hitMineInChord = true;
                revealCell(n.r, n.c); 
                boardElements[n.r][n.c].classList.add('mine-hit');
                break; 
            } else {
                revealCellRecursive(n.r, n.c);
            }
        }
    }

    if (hitMineInChord) {
        endGame(false); 
    } else {
        if (checkWinCondition()) { 
            endGame(true);
        }
    }
     if (!gameOver && ![SMILEY_WON, SMILEY_LOST].includes(restartButton.innerText) ) {
         restartButton.innerText = SMILEY_HAPPY;
    }
}

function getNeighbors(r,c) {
    const neighbors = [];
    for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if (isValid(nr, nc)) {
                neighbors.push({r: nr, c: nc});
            }
        }
    }
    return neighbors;
}

function isValid(r, c) {
    return r >= 0 && r < rows && c >= 0 && c < columns;
}

function checkWinCondition() {
    const totalNonMineCells = (rows * columns) - minesCount;
    return tilesClicked === totalNonMineCells && !gameOver;
}

function endGame(isWin) {
    if (gameOver) return; 
    gameOver = true;
    stopTimer();
    revealAllMines(isWin); 
    clearAllPreviews(); 

    if (isWin) {
        restartButton.innerText = SMILEY_WON;
        // showModal("You Win!", "Congratulations, you cleared all mines!"); // Removed modal
        minesCountDisplay.innerText = String(0).padStart(3, "0"); 
    } else {
        restartButton.innerText = SMILEY_LOST;
        // showModal("Game Over!", "Boom! You hit a mine."); // Removed modal
    }
}

function revealAllMines(isWin) {
    for (let r_idx = 0; r_idx < rows; r_idx++) {
        for (let c_idx = 0; c_idx < columns; c_idx++) {
            const cellState = boardState[r_idx][c_idx];
            const tileElement = boardElements[r_idx][c_idx];
            tileElement.classList.remove('preview'); 
            
            if (cellState.isRevealed && cellState.isMine && tileElement.classList.contains('mine-hit')) {
                 tileElement.innerText = "💣"; 
            } else if (cellState.isMine) {
                tileElement.classList.remove("tile-hidden");
                tileElement.classList.add("tile-revealed");
                if (isWin) { 
                    tileElement.innerText = cellState.isFlagged ? "🚩" : "💣"; 
                } else { 
                    tileElement.innerText = cellState.isFlagged ? "🚩" : "💣";
                }
            } else if (cellState.isFlagged && !cellState.isMine) { 
                if (!isWin) { 
                    tileElement.innerText = "❌";
                    tileElement.classList.remove("tile-hidden");
                    tileElement.classList.add("tile-revealed");
                }
            }
        }
    }
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    updateTimerDisplay(); 
    timerInterval = setInterval(() => {
        if (!gameOver) { 
            secondsPassed++;
            updateTimerDisplay();
        }
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}

function updateTimerDisplay() {
    const displayTime = Math.min(secondsPassed, 999);
    timerDisplay.innerText = String(displayTime).padStart(3, "0");
}

function updateMinesCountDisplay() {
    const remaining = minesCount - flagsPlaced;
    let displayMines = Math.max(remaining, -99); 
    displayMines = Math.min(displayMines, 999); 

    if (displayMines < 0) {
        minesCountDisplay.innerText = `-${String(Math.abs(displayMines)).padStart(2,"0")}`;
    } else {
        minesCountDisplay.innerText = String(displayMines).padStart(3, "0");
    }
}

function showModal(title, message) {
    modalTitle.innerText = title;
    modalMessage.innerText = message;
    modalDiv.style.display = "flex";
}

function hideModal() {
    modalDiv.style.display = "none";
}

function clearAllPreviews() {
    document.querySelectorAll('#board .tile.preview').forEach(tile => {
        tile.classList.remove('preview');
    });
}