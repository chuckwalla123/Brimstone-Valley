class Board {
    constructor(size) {
        this.size = size;
        this.board = this.initializeBoard();
    }

    initializeBoard() {
        return Array.from({ length: this.size }, () => Array(this.size).fill(null));
    }

    render() {
        const boardElement = document.createElement('div');
        boardElement.className = 'board';

        this.board.forEach((row, rowIndex) => {
            const rowElement = document.createElement('div');
            rowElement.className = 'board-row';

            row.forEach((cell, colIndex) => {
                const cellElement = document.createElement('div');
                cellElement.className = 'board-cell';
                cellElement.dataset.row = rowIndex;
                cellElement.dataset.col = colIndex;
                cellElement.textContent = cell || '';

                cellElement.addEventListener('click', () => this.updateBoard(rowIndex, colIndex));
                rowElement.appendChild(cellElement);
            });

            boardElement.appendChild(rowElement);
        });

        return boardElement;
    }

    updateBoard(row, col) {
        if (!this.board[row][col]) {
            this.board[row][col] = 'X'; // Example: Player X's turn
            this.render(); // Re-render the board after the update
        }
    }

    resetBoard() {
        this.board = this.initializeBoard();
        this.render();
    }
}

export default Board;