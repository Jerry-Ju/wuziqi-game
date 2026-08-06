export type Player = 'black' | 'white';
export type CellValue = Player | null;
export type Board = CellValue[][];
export type Difficulty = 'easy' | 'normal' | 'hard';

export const BOARD_SIZE = 15;

const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

/* ---------- 基础规则 ---------- */

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => null)
  );
}

export function checkWin(
  board: Board,
  row: number,
  col: number,
  player: CellValue
): [number, number][] | null {
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

export function isBoardFull(board: Board): boolean {
  return board.every(row => row.every(cell => cell !== null));
}

/** 寻找 player 一步成五的落点（没有则返回 null） */
export function findWinningMove(board: Board, player: Player): [number, number] | null {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== null) continue;
      if (evaluatePoint(board, r, c, player) >= FIVE) return [r, c];
    }
  }
  return null;
}

/* ---------- AI 局面评估 ---------- */

const FIVE = 10_000_000;
const LIVE_FOUR = 500_000;
const RUSH_FOUR = 60_000;
const LIVE_THREE = 50_000;
const SLEEP_THREE = 4_000;
const LIVE_TWO = 2_500;
const SLEEP_TWO = 400;
const LIVE_ONE = 80;

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE;
}

/** 连子数 + 开放端数 → 形状分 */
function patternScore(count: number, openEnds: number): number {
  if (count >= 5) return FIVE;
  if (openEnds === 0) return 0;
  switch (count) {
    case 4:
      return openEnds === 2 ? LIVE_FOUR : RUSH_FOUR;
    case 3:
      return openEnds === 2 ? LIVE_THREE : SLEEP_THREE;
    case 2:
      return openEnds === 2 ? LIVE_TWO : SLEEP_TWO;
    default:
      return openEnds === 2 ? LIVE_ONE : 10;
  }
}

/** 假设 player 在 (row,col) 落子，四个方向的形状总分 */
export function evaluatePoint(board: Board, row: number, col: number, player: Player): number {
  let total = 0;

  for (const [dr, dc] of DIRECTIONS) {
    let count = 1;
    let openEnds = 0;

    let r = row + dr;
    let c = col + dc;
    while (inBounds(r, c) && board[r][c] === player) {
      count++;
      r += dr;
      c += dc;
    }
    if (inBounds(r, c) && board[r][c] === null) openEnds++;

    r = row - dr;
    c = col - dc;
    while (inBounds(r, c) && board[r][c] === player) {
      count++;
      r -= dr;
      c -= dc;
    }
    if (inBounds(r, c) && board[r][c] === null) openEnds++;

    total += patternScore(count, openEnds);
  }

  return total;
}

/** 各难度参数：防守权重越低越激进冒进，噪声与失误率越高越容易赢 */
interface DiffParams {
  defenseWeight: number;
  noise: number;
  blunder: number;
  pool: number;
  missBlock: number;
}

const DIFF_PARAMS: Record<Difficulty, DiffParams> = {
  // 简单：防守松散、大幅随机、35% 概率随手棋、30% 概率漏堵你的成五
  easy: { defenseWeight: 0.35, noise: 26000, blunder: 0.35, pool: 12, missBlock: 0.3 },
  // 普通：会堵四但偶尔忽略活三，12% 概率失误
  normal: { defenseWeight: 0.7, noise: 1800, blunder: 0.12, pool: 5, missBlock: 0 },
  // 困难：全力防守 + 两层推演
  hard: { defenseWeight: 1.0, noise: 60, blunder: 0, pool: 12, missBlock: 0 },
};

/** 为 AI 选择最佳落子点 */
export function findBestMove(
  board: Board,
  ai: Player,
  difficulty: Difficulty,
  moveCount: number
): [number, number] | null {
  const human: Player = ai === 'black' ? 'white' : 'black';
  const center = Math.floor(BOARD_SIZE / 2);

  // 空棋盘直接下天元
  if (moveCount === 0) return [center, center];

  const { defenseWeight, noise, blunder, pool, missBlock } = DIFF_PARAMS[difficulty];

  const candidates: { r: number; c: number; attack: number; defense: number; score: number }[] = [];
  let winMove: [number, number] | null = null;
  let blockMove: [number, number] | null = null;

  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] !== null) continue;
      const attack = evaluatePoint(board, r, c, ai);
      const defense = evaluatePoint(board, r, c, human);
      if (attack >= FIVE && !winMove) winMove = [r, c];
      if (defense >= FIVE && !blockMove) blockMove = [r, c];
      candidates.push({
        r,
        c,
        attack,
        defense,
        score: attack + defense * defenseWeight + Math.random() * noise,
      });
    }
  }

  if (candidates.length === 0) return null;

  // 自己能一步成五：任何难度都不会错过
  if (winMove) return winMove;
  // 必须堵的成五点：简单模式有概率「没看见」
  if (blockMove && !(missBlock > 0 && Math.random() < missBlock)) return blockMove;

  candidates.sort((a, b) => b.score - a.score);

  // 困难：对前 12 个候选做两层推演，惩罚给对手留下大棋形的走法
  if (difficulty === 'hard') {
    const top = candidates.slice(0, Math.min(pool, candidates.length));
    let best = top[0];
    let bestFinal = -Infinity;

    for (const cand of top) {
      board[cand.r][cand.c] = ai;
      let oppBest = 0;
      for (let r = 0; r < BOARD_SIZE && oppBest < FIVE; r++) {
        for (let c = 0; c < BOARD_SIZE; c++) {
          if (board[r][c] !== null) continue;
          const s = evaluatePoint(board, r, c, human);
          if (s > oppBest) oppBest = s;
        }
      }
      board[cand.r][cand.c] = null;

      const final = cand.score - oppBest * 0.3;
      if (final > bestFinal) {
        bestFinal = final;
        best = cand;
      }
    }

    return [best.r, best.c];
  }

  // 简单 / 普通：失误时从更宽的池子里随手一放
  if (Math.random() < blunder) {
    const wide = candidates.slice(0, Math.min(pool * 2, candidates.length));
    const pick = wide[Math.floor(Math.random() * wide.length)];
    return [pick.r, pick.c];
  }

  // 正常情况下从前 pool 名里随机挑选，保留一点变化
  const top = candidates.slice(0, Math.min(pool, candidates.length));
  const pick = top[Math.floor(Math.random() * top.length)];
  return [pick.r, pick.c];
}
