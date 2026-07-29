import { useState, useCallback } from 'react';

type CellValue = 'black' | 'white' | null;
type Board = CellValue[][];

const BOARD_SIZE = 15;
const CELL_SIZE = 36;
const PADDING = 24;

function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null)
  );
}

const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

function checkWin(board: Board, row: number, col: number, player: CellValue): [number, number][] | null {
  if (!player) return null;

  for (const [dr, dc] of DIRECTIONS) {
    const line: [number, number][] = [[row, col]];

    for (let i = 1; i < 5; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
      if (board[r][c] !== player) break;
      line.push([r, c]);
    }

    for (let i = 1; i < 5; i++) {
      const r = row - dr * i;
      const c = col - dc * i;
      if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) break;
      if (board[r][c] !== player) break;
      line.push([r, c]);
    }

    if (line.length >= 5) return line;
  }

  return null;
}

function isBoardFull(board: Board): boolean {
  return board.every(row => row.every(cell => cell !== null));
}

export default function App() {
  const [board, setBoard] = useState<Board>(createEmptyBoard);
  const [currentPlayer, setCurrentPlayer] = useState<'black' | 'white'>('black');
  const [winner, setWinner] = useState<'black' | 'white' | 'draw' | null>(null);
  const [winningLine, setWinningLine] = useState<[number, number][] | null>(null);
  const [lastMove, setLastMove] = useState<[number, number] | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [hoverCell, setHoverCell] = useState<[number, number] | null>(null);

  const boardPixelSize = CELL_SIZE * (BOARD_SIZE - 1) + PADDING * 2;

  const handleClick = useCallback((row: number, col: number) => {
    if (winner || board[row][col] !== null) return;

    const newBoard = board.map(r => [...r]);
    newBoard[row][col] = currentPlayer;
    setBoard(newBoard);
    setLastMove([row, col]);
    setMoveCount(prev => prev + 1);

    const line = checkWin(newBoard, row, col, currentPlayer);
    if (line) {
      setWinner(currentPlayer);
      setWinningLine(line);
    } else if (isBoardFull(newBoard)) {
      setWinner('draw');
    } else {
      setCurrentPlayer(currentPlayer === 'black' ? 'white' : 'black');
    }
  }, [board, currentPlayer, winner]);

  const resetGame = useCallback(() => {
    setBoard(createEmptyBoard());
    setCurrentPlayer('black');
    setWinner(null);
    setWinningLine(null);
    setLastMove(null);
    setMoveCount(0);
    setHoverCell(null);
  }, []);

  const isWinningCell = (row: number, col: number) => {
    if (!winningLine) return false;
    return winningLine.some(([r, c]) => r === row && c === col);
  };

  const isLastMove = (row: number, col: number) => {
    if (!lastMove) return false;
    return lastMove[0] === row && lastMove[1] === col;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-pink-100 flex flex-col items-center justify-center p-4 select-none">
      {/* 标题 */}
      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold text-rose-800 tracking-wider mb-1" style={{ fontFamily: 'serif' }}>
          五 子 棋
        </h1>
        <p className="text-rose-500 text-sm tracking-widest">GOMOKU</p>
      </div>

      {/* 状态面板 */}
      <div className="flex items-center gap-6 mb-5 flex-wrap justify-center">
        <div className="flex items-center gap-3 bg-white/70 backdrop-blur-sm rounded-xl px-5 py-3 shadow-md border border-pink-200">
          <div className={`w-7 h-7 rounded-full shadow-inner border-2 ${
            currentPlayer === 'black'
              ? 'bg-gradient-to-br from-gray-700 to-black border-gray-600'
              : 'bg-gradient-to-br from-white to-gray-200 border-gray-300'
          } ${!winner ? 'ring-2 ring-pink-400 ring-offset-2' : ''}`}>
          </div>
          <div className="text-sm">
            <div className="font-semibold text-rose-900">
              {winner
                ? winner === 'draw'
                  ? '平局！'
                  : `${winner === 'black' ? '黑棋' : '白棋'} 获胜！`
                : `${currentPlayer === 'black' ? '黑棋' : '白棋'} 落子`}
            </div>
            <div className="text-rose-500 text-xs">第 {moveCount + (winner ? 0 : 1)} 手</div>
          </div>
        </div>

        <button
          onClick={resetGame}
          className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white px-5 py-3 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 font-medium text-sm tracking-wider"
        >
          <i className="fas fa-redo-alt mr-2"></i>
          重新开始
        </button>
      </div>

      {/* 棋盘 */}
      <div
        className="relative rounded-lg shadow-2xl"
        style={{
          width: boardPixelSize,
          height: boardPixelSize,
          background: 'linear-gradient(145deg, #f5c6d0, #e8a4b5, #d98fa3)',
          boxShadow: '0 10px 40px rgba(180, 80, 120, 0.35), inset 0 1px 2px rgba(255,255,255,0.3)',
        }}
      >
        <svg
          className="absolute inset-0"
          width={boardPixelSize}
          height={boardPixelSize}
        >
          {Array.from({ length: BOARD_SIZE }, (_, i) => (
            <g key={`lines-${i}`}>
              <line
                x1={PADDING}
                y1={PADDING + i * CELL_SIZE}
                x2={PADDING + (BOARD_SIZE - 1) * CELL_SIZE}
                y2={PADDING + i * CELL_SIZE}
                stroke="#8b4563"
                strokeWidth={i === 0 || i === BOARD_SIZE - 1 ? 1.5 : 0.8}
              />
              <line
                x1={PADDING + i * CELL_SIZE}
                y1={PADDING}
                x2={PADDING + i * CELL_SIZE}
                y2={PADDING + (BOARD_SIZE - 1) * CELL_SIZE}
                stroke="#8b4563"
                strokeWidth={i === 0 || i === BOARD_SIZE - 1 ? 1.5 : 0.8}
              />
            </g>
          ))}

          {[
            [3, 3], [3, 7], [3, 11],
            [7, 3], [7, 7], [7, 11],
            [11, 3], [11, 7], [11, 11],
          ].map(([r, c]) => (
            <circle
              key={`star-${r}-${c}`}
              cx={PADDING + c * CELL_SIZE}
              cy={PADDING + r * CELL_SIZE}
              r={3.5}
              fill="#8b4563"
            />
          ))}

          {Array.from({ length: BOARD_SIZE }, (_, i) => (
            <g key={`label-${i}`}>
              <text
                x={PADDING + i * CELL_SIZE}
                y={PADDING - 10}
                textAnchor="middle"
                fontSize="10"
                fill="#8b4563"
                fontFamily="monospace"
              >
                {String.fromCharCode(65 + i)}
              </text>
              <text
                x={PADDING - 12}
                y={PADDING + i * CELL_SIZE + 4}
                textAnchor="middle"
                fontSize="10"
                fill="#8b4563"
                fontFamily="monospace"
              >
                {BOARD_SIZE - i}
              </text>
            </g>
          ))}
        </svg>

        {/* 悬停提示 */}
        {hoverCell && !winner && board[hoverCell[0]][hoverCell[1]] === null && (
          <div
            className="absolute pointer-events-none rounded-full opacity-30"
            style={{
              width: CELL_SIZE * 0.85,
              height: CELL_SIZE * 0.85,
              left: PADDING + hoverCell[1] * CELL_SIZE - (CELL_SIZE * 0.85) / 2,
              top: PADDING + hoverCell[0] * CELL_SIZE - (CELL_SIZE * 0.85) / 2,
              background: currentPlayer === 'black'
                ? 'radial-gradient(circle at 35% 35%, #666, #000)'
                : 'radial-gradient(circle at 35% 35%, #fff, #ccc)',
            }}
          />
        )}

        {/* 棋子 */}
        {board.map((row, r) =>
          row.map((cell, c) =>
            cell ? (
              <div
                key={`piece-${r}-${c}`}
                className={`absolute rounded-full transition-all duration-200 ${
                  isWinningCell(r, c) ? 'animate-pulse z-20' : 'z-10'
                }`}
                style={{
                  width: CELL_SIZE * 0.88,
                  height: CELL_SIZE * 0.88,
                  left: PADDING + c * CELL_SIZE - (CELL_SIZE * 0.88) / 2,
                  top: PADDING + r * CELL_SIZE - (CELL_SIZE * 0.88) / 2,
                  background: cell === 'black'
                    ? 'radial-gradient(circle at 35% 35%, #555, #111 60%, #000)'
                    : 'radial-gradient(circle at 35% 35%, #fff, #eee 50%, #ccc)',
                  boxShadow: cell === 'black'
                    ? '2px 3px 6px rgba(0,0,0,0.5), inset -1px -1px 2px rgba(255,255,255,0.1)'
                    : '2px 3px 6px rgba(0,0,0,0.3), inset -1px -1px 2px rgba(0,0,0,0.05)',
                  ...(isWinningCell(r, c) ? {
                    boxShadow: '0 0 12px 4px rgba(255, 105, 180, 0.8), 2px 3px 6px rgba(0,0,0,0.4)',
                  } : {}),
                }}
              >
                {isLastMove(r, c) && !winner && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{
                        background: cell === 'black'
                          ? 'rgba(255,255,255,0.6)'
                          : 'rgba(220,50,80,0.7)',
                      }}
                    />
                  </div>
                )}
              </div>
            ) : null
          )
        )}

        {/* 点击层 */}
        {!winner && (
          <div className="absolute inset-0 z-30">
            {board.map((row, r) =>
              row.map((_, c) => (
                <div
                  key={`click-${r}-${c}`}
                  className="absolute cursor-pointer"
                  style={{
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    left: PADDING + c * CELL_SIZE - CELL_SIZE / 2,
                    top: PADDING + r * CELL_SIZE - CELL_SIZE / 2,
                  }}
                  onClick={() => handleClick(r, c)}
                  onMouseEnter={() => setHoverCell([r, c])}
                  onMouseLeave={() => setHoverCell(null)}
                />
              ))
            )}
          </div>
        )}

        {/* 胜利遮罩 */}
        {winner && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-[2px] rounded-lg">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl px-8 py-6 shadow-2xl text-center border border-pink-200 animate-bounce-in">
              {winner === 'draw' ? (
                <>
                  <div className="text-5xl mb-3">🤝</div>
                  <div className="text-2xl font-bold text-rose-900 mb-1">平局！</div>
                  <div className="text-rose-500 text-sm">棋逢对手，势均力敌</div>
                </>
              ) : (
                <>
                  <div className="text-5xl mb-3">🏆</div>
                  <div className="text-2xl font-bold text-rose-900 mb-1">
                    {winner === 'black' ? '黑棋' : '白棋'} 获胜！
                  </div>
                  <div className="text-rose-500 text-sm">
                    共 {moveCount} 手
                  </div>
                </>
              )}
              <button
                onClick={resetGame}
                className="mt-4 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white px-6 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 active:scale-95 font-medium text-sm"
              >
                再来一局
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 底部信息 */}
      <div className="mt-6 text-center">
        <div className="flex items-center justify-center gap-4 text-xs text-rose-400">
          <span>⚫ 黑棋先行</span>
          <span>·</span>
          <span>五子连珠获胜</span>
          <span>·</span>
          <span>点击棋盘落子</span>
        </div>
      </div>
    </div>
  );
}
