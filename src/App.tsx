import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  BOARD_SIZE,
  createEmptyBoard,
  checkWin,
  isBoardFull,
  findBestMove,
  findWinningMove,
  evaluatePoint,
} from './gomokuAI';
import type { Board, Difficulty, Player } from './gomokuAI';
import {
  unlockAudio,
  setMuted as setSoundMuted,
  playPlace,
  playWin,
  playLose,
  playDraw,
  playClick,
  playUndo,
} from './sound';

type Result = 'black' | 'white' | 'draw' | null;
type Mode = 'pvp' | 'pve' | 'practice';
type EvalTone = 'great' | 'good' | 'ok' | 'bad' | 'danger';

const CELL_SIZE = 36;
const PADDING = 24;

const EVAL_STYLE: Record<EvalTone, { bg: string; icon: string }> = {
  great: { bg: 'bg-amber-500/95', icon: 'fa-star' },
  good: { bg: 'bg-emerald-500/95', icon: 'fa-check' },
  ok: { bg: 'bg-slate-500/90', icon: 'fa-minus' },
  bad: { bg: 'bg-rose-500/95', icon: 'fa-xmark' },
  danger: { bg: 'bg-red-600/95', icon: 'fa-triangle-exclamation' },
};

const CONFETTI_COLORS = ['#f472b6', '#fb7185', '#fbbf24', '#f9a8d4', '#fda4af', '#fcd34d', '#ffffff', '#e879f9'];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/* ---------- 胜利彩带 ---------- */
function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 44 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        duration: 2.6 + Math.random() * 1.8,
        size: 6 + Math.random() * 6,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        round: Math.random() > 0.55,
        drift: (Math.random() - 0.5) * 180,
      })),
    []
  );

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[70]">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 1.7,
            background: p.color,
            borderRadius: p.round ? '50%' : 2,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            ['--drift' as string]: `${p.drift}px`,
          }}
        />
      ))}
    </div>
  );
}

/* ---------- 棋子视觉 ---------- */
function Stone({ color, size, className = '' }: { color: Player; size: number; className?: string }) {
  return (
    <div
      className={`rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background:
          color === 'black'
            ? 'radial-gradient(circle at 35% 32%, #6b6b6b, #1a1a1a 58%, #000)'
            : 'radial-gradient(circle at 35% 32%, #ffffff, #f1f1f1 52%, #c9c9c9)',
        boxShadow:
          color === 'black'
            ? '0 6px 14px rgba(0,0,0,0.45), inset -2px -2px 4px rgba(255,255,255,0.08)'
            : '0 6px 14px rgba(190,60,110,0.35), inset -2px -2px 4px rgba(0,0,0,0.06)',
      }}
    />
  );
}

/* ---------- 皇冠 SVG ---------- */
function Crown({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.78} viewBox="0 0 40 31" fill="none" className="drop-shadow-md">
      <path
        d="M4 25 L2 8 L12 16 L20 3 L28 16 L38 8 L36 25 Z"
        fill="url(#crownGold)"
        stroke="#b45309"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <rect x="4" y="25" width="32" height="4.5" rx="2" fill="#f59e0b" stroke="#b45309" strokeWidth="1.2" />
      <circle cx="20" cy="19" r="2.6" fill="#fb7185" stroke="#b45309" strokeWidth="1" />
      <circle cx="11" cy="21" r="1.7" fill="#fda4af" />
      <circle cx="29" cy="21" r="1.7" fill="#fda4af" />
      <defs>
        <linearGradient id="crownGold" x1="2" y1="3" x2="38" y2="26">
          <stop stopColor="#fde68a" />
          <stop offset="0.5" stopColor="#fbbf24" />
          <stop offset="1" stopColor="#f59e0b" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/* ---------- 玩家卡片：清晰指示当前回合 ---------- */
function PlayerCard({
  color,
  name,
  sub,
  state,
  thinking,
  turnLabel,
}: {
  color: Player;
  name: string;
  sub: string;
  state: 'active' | 'idle' | 'won' | 'lost' | 'draw';
  thinking?: boolean;
  turnLabel?: string;
}) {
  const active = state === 'active';
  return (
    <div
      className={`relative flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all duration-300 min-w-[158px] ${
        active
          ? 'bg-white border-pink-400 shadow-lg shadow-pink-200/70 scale-[1.04]'
          : state === 'won'
            ? 'bg-white border-amber-300 shadow-md'
            : 'bg-white/55 border-pink-100 opacity-65'
      }`}
    >
      {/* 回合徽章 */}
      {active && turnLabel && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[10px] px-2.5 py-0.5 rounded-full shadow-md font-bold tracking-widest animate-rise-in">
          {turnLabel}
        </div>
      )}
      <div className={active ? 'animate-ring-pulse rounded-full' : 'rounded-full'}>
        <Stone color={color} size={36} />
      </div>
      <div className="text-left">
        <div
          className={`font-bold text-sm leading-tight ${
            active || state === 'won' ? 'text-rose-900' : 'text-rose-600'
          }`}
        >
          {name}
          <span className="ml-1.5 text-[10px] font-medium text-rose-400">{sub}</span>
        </div>
        <div
          className={`text-[11px] mt-1 flex items-center gap-1.5 ${
            active ? 'text-pink-500 font-semibold' : 'text-rose-400'
          }`}
        >
          {state === 'won' ? (
            <>
              <i className="fas fa-crown text-amber-500" />
              获胜！
            </>
          ) : state === 'lost' ? (
            '惜败'
          ) : state === 'draw' ? (
            '平局'
          ) : thinking ? (
            <>
              思考中
              <ThinkingDots />
            </>
          ) : active ? (
            <>
              落子中
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inline-flex w-full h-full rounded-full bg-pink-400 opacity-75 animate-ping" />
                <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-pink-500" />
              </span>
            </>
          ) : (
            '等待中'
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- 思考中圆点 ---------- */
function ThinkingDots() {
  return (
    <span className="inline-flex items-center gap-[3px] ml-1.5 align-middle">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1 h-1 rounded-full bg-rose-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}

export default function App() {
  const [board, setBoard] = useState<Board>(createEmptyBoard);
  const [currentPlayer, setCurrentPlayer] = useState<Player>('black');
  const [winner, setWinner] = useState<Result>(null);
  const [winningLine, setWinningLine] = useState<[number, number][] | null>(null);
  const [lastMove, setLastMove] = useState<[number, number] | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [hoverCell, setHoverCell] = useState<[number, number] | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [history, setHistory] = useState<{ r: number; c: number; player: Player }[]>([]);

  // 练习模式：提示 / 每手评价 / 统计
  const [hint, setHint] = useState<[number, number] | null>(null);
  const [evaluation, setEvaluation] = useState<{ text: string; tone: EvalTone } | null>(null);
  const [practiceStats, setPracticeStats] = useState({ hints: 0, great: 0, bad: 0 });
  const evalTimer = useRef<number | null>(null);

  const showEvaluation = useCallback((text: string, tone: EvalTone) => {
    if (evalTimer.current) window.clearTimeout(evalTimer.current);
    setEvaluation({ text, tone });
    evalTimer.current = window.setTimeout(() => setEvaluation(null), 1700);
  }, []);

  // 模式设置
  const [mode, setMode] = useState<Mode>('pvp');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [humanFirst, setHumanFirst] = useState(true);

  // 计时
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const modalTimer = useRef<number | null>(null);
  const aiTimer = useRef<number | null>(null);

  // 最新状态快照：AI 定时器回调执行前校验，
  // 防止切模式 / 重开后旧定时器用过期闭包污染棋局
  const liveRef = useRef({ mode, winner, currentPlayer, board });
  useEffect(() => {
    liveRef.current = { mode, winner, currentPlayer, board };
  });

  // 音效开关（持久化）
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem('gomoku-muted') === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    setSoundMuted(muted);
    try {
      localStorage.setItem('gomoku-muted', muted ? '1' : '0');
    } catch {
      /* 忽略存储异常 */
    }
  }, [muted]);

  // 首次交互时解锁音频上下文
  useEffect(() => {
    const unlock = () => unlockAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, []);

  // 练习模式固定由玩家执黑先行
  const humanColor: Player = mode === 'practice' ? 'black' : humanFirst ? 'black' : 'white';
  const aiColor: Player = humanColor === 'black' ? 'white' : 'black';
  const isAiMode = mode === 'pve' || mode === 'practice';
  const aiThinking = isAiMode && !winner && currentPlayer === aiColor;
  const humanTurn = mode === 'pvp' || currentPlayer === humanColor;

  const boardPixelSize = CELL_SIZE * (BOARD_SIZE - 1) + PADDING * 2;

  useEffect(() => {
    if (!startTime || winner) return;
    const t = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - startTime) / 1000)),
      500
    );
    return () => window.clearInterval(t);
  }, [startTime, winner]);

  const finishGame = useCallback(
    (result: Result, line: [number, number][] | null) => {
      setWinner(result);
      setWinningLine(line);
      if (startTime) setElapsed(Math.floor((Date.now() - startTime) / 1000));
      // 终局音效（稍延迟，让落子声先落地）
      if (result === 'draw') playDraw(0.3);
      else if (mode === 'pve' && result !== humanColor) playLose(0.3);
      else playWin(0.3);
      // 先让玩家看到连珠发光，再弹出结算窗
      modalTimer.current = window.setTimeout(() => setShowResult(true), 750);
    },
    [startTime, mode, humanColor]
  );

  const handleClick = useCallback(
    (row: number, col: number) => {
      if (winner || board[row][col] !== null) return;

      if (!startTime) {
        setStartTime(Date.now());
      }

      const newBoard = board.map(r => [...r]);
      newBoard[row][col] = currentPlayer;
      setBoard(newBoard);
      setLastMove([row, col]);
      setMoveCount(prev => prev + 1);
      setHistory(prev => [...prev, { r: row, c: col, player: currentPlayer }]);

      playPlace(currentPlayer === 'black');

      const line = checkWin(newBoard, row, col, currentPlayer);
      if (line) {
        finishGame(currentPlayer, line);
      } else if (isBoardFull(newBoard)) {
        finishGame('draw', null);
      } else {
        setCurrentPlayer(currentPlayer === 'black' ? 'white' : 'black');
      }
    },
    [board, currentPlayer, winner, startTime, finishGame]
  );

  // 人类玩家点击（人机模式下电脑回合禁止点击）
  const humanClick = useCallback(
    (row: number, col: number) => {
      if ((mode === 'pve' || mode === 'practice') && currentPlayer !== humanColor) return;
      handleClick(row, col);
    },
    [mode, currentPlayer, humanColor, handleClick]
  );

  // 电脑自动落子（对战与练习模式通用）
  useEffect(() => {
    if (!isAiMode || winner || currentPlayer !== aiColor) return;
    aiTimer.current = window.setTimeout(() => {
      aiTimer.current = null;
      // 620ms 内若发生切模式 / 重新开始 / 悔棋，状态引用已变化 → 作废本手
      const s = liveRef.current;
      const stillAiMode = s.mode === 'pve' || s.mode === 'practice';
      if (!stillAiMode || s.winner || s.currentPlayer !== aiColor || s.board !== board) {
        return;
      }
      const move = findBestMove(board, aiColor, difficulty, moveCount);
      if (move) handleClick(move[0], move[1]);
    }, 620);
    return () => {
      if (aiTimer.current) window.clearTimeout(aiTimer.current);
      aiTimer.current = null;
    };
  }, [isAiMode, winner, currentPlayer, aiColor, board, difficulty, moveCount, handleClick]);

  const resetGame = useCallback(() => {
    playClick();
    if (modalTimer.current) window.clearTimeout(modalTimer.current);
    if (aiTimer.current) window.clearTimeout(aiTimer.current);
    aiTimer.current = null;
    setBoard(createEmptyBoard());
    setCurrentPlayer('black');
    setWinner(null);
    setWinningLine(null);
    setLastMove(null);
    setMoveCount(0);
    setHoverCell(null);
    setShowResult(false);
    setStartTime(null);
    setElapsed(0);
    setHistory([]);
  }, []);

  // 悔棋：人机模式下一次撤回「电脑 + 自己」两手
  const canUndo = history.length > 0 && !winner && humanTurn;

  const undoMove = useCallback(() => {
    if (winner || history.length === 0) return;
    if ((mode === 'pve' || mode === 'practice') && currentPlayer !== humanColor) return;
    playUndo();
    setHint(null);

    const newHistory = [...history];
    if (mode === 'pve') {
      let removedHuman = false;
      while (newHistory.length > 0 && !removedHuman) {
        const m = newHistory.pop()!;
        if (m.player === humanColor) removedHuman = true;
      }
    } else {
      newHistory.pop();
    }

    const newBoard = createEmptyBoard();
    newHistory.forEach(m => {
      newBoard[m.r][m.c] = m.player;
    });

    setBoard(newBoard);
    setHistory(newHistory);
    setMoveCount(newHistory.length);
    setCurrentPlayer(newHistory.length % 2 === 0 ? 'black' : 'white');
    const last = newHistory[newHistory.length - 1];
    setLastMove(last ? [last.r, last.c] : null);
    setHoverCell(null);
    if (newHistory.length === 0) {
      setStartTime(null);
      setElapsed(0);
    }
  }, [winner, history, mode, currentPlayer, humanColor]);

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    setMode(m);
    resetGame();
  };

  const toggleFirst = () => {
    playClick();
    setHumanFirst(v => !v);
    resetGame();
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setSoundMuted(next);
    if (!next) playClick();
  };

  const isWinningCell = (row: number, col: number) => {
    if (!winningLine) return false;
    return winningLine.some(([r, c]) => r === row && c === col);
  };

  const isLastMove = (row: number, col: number) => {
    if (!lastMove) return false;
    return lastMove[0] === row && lastMove[1] === col;
  };

  // 玩家卡片文案与状态
  const nameOf = (p: Player) =>
    mode === 'pve' ? (p === humanColor ? '你' : '电脑') : p === 'black' ? '黑棋' : '白棋';

  const subOf = (p: Player) =>
    mode === 'pve' ? (p === 'black' ? '执黑' : '执白') : p === 'black' ? '先行' : '后行';

  const turnLabelOf = (p: Player) =>
    mode === 'pve' ? (p === humanColor ? '你的回合' : '电脑回合') : `${p === 'black' ? '黑棋' : '白棋'}回合`;

  const cardState = (p: Player): 'active' | 'idle' | 'won' | 'lost' | 'draw' => {
    if (winner === 'draw') return 'draw';
    if (winner === p) return 'won';
    if (winner) return 'lost';
    return currentPlayer === p ? 'active' : 'idle';
  };

  const humanWon = winner !== null && winner !== 'draw' && winner === humanColor;

  const modalTitle =
    winner === 'draw' ? '平局' : mode === 'pve' ? (humanWon ? '你赢了' : '电脑获胜') : `${winner === 'black' ? '黑棋' : '白棋'}获胜`;

  const modalLabel = winner === 'draw' ? 'DRAW' : mode === 'pve' ? (humanWon ? 'VICTORY' : 'DEFEAT') : 'VICTORY';

  const modalSubtitle =
    winner === 'draw'
      ? '棋逢对手，势均力敌'
      : mode === 'pve'
        ? humanWon
          ? <>五子连珠 · 第 <span className="font-bold text-rose-600 tabular-nums">{moveCount}</span> 手制胜</>
          : '电脑技高一筹，再战一局！'
        : <>五子连珠 · 第 <span className="font-bold text-rose-600 tabular-nums">{moveCount}</span> 手制胜</>;

  // 玩家获胜（或平局）才撒彩带，电脑获胜不庆祝
  const celebrate = winner !== null && (winner === 'draw' || mode === 'pvp' || humanWon);

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-pink-100 flex flex-col items-center justify-center p-4 select-none">
      {/* 标题 */}
      <div className="text-center mb-5">
        <h1 className="font-display text-4xl font-black text-rose-900 tracking-[0.3em] mb-1" style={{ marginLeft: '0.3em' }}>
          五子棋
        </h1>
        <p className="text-rose-400 text-xs tracking-[0.5em]" style={{ marginLeft: '0.5em' }}>GOMOKU</p>
      </div>

      {/* 模式设置 */}
      <div className="flex flex-col items-center gap-2.5 mb-4">
        <div className="flex bg-white/75 border border-pink-200 rounded-full p-1 shadow-sm">
          <button
            onClick={() => switchMode('pvp')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              mode === 'pvp'
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md'
                : 'text-rose-500 hover:text-rose-700'
            }`}
          >
            <i className="fas fa-user-friends mr-1.5" />
            双人对战
          </button>
          <button
            onClick={() => switchMode('pve')}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              mode === 'pve'
                ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md'
                : 'text-rose-500 hover:text-rose-700'
            }`}
          >
            <i className="fas fa-robot mr-1.5" />
            人机对战
          </button>
        </div>

        {mode === 'pve' && (
          <div className="flex items-center gap-2.5 flex-wrap justify-center animate-rise-in">
            <div className="flex items-center bg-white/75 border border-pink-200 rounded-full p-1 shadow-sm">
              {(['easy', 'normal', 'hard'] as Difficulty[]).map(d => (
                <button
                  key={d}
                  onClick={() => {
                    setDifficulty(d);
                    playClick();
                  }}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                    difficulty === d
                      ? 'bg-rose-100 text-rose-700 shadow-sm'
                      : 'text-rose-400 hover:text-rose-600'
                  }`}
                >
                  {d === 'easy' ? '简单' : d === 'normal' ? '普通' : '困难'}
                </button>
              ))}
            </div>
            <button
              onClick={toggleFirst}
              className="flex items-center bg-white/75 hover:bg-white border border-pink-200 rounded-full px-4 py-1.5 text-xs font-medium text-rose-500 hover:text-rose-700 shadow-sm hover:shadow transition-all duration-200 active:scale-95"
              title="点击切换先后手"
            >
              <i className="fas fa-exchange-alt mr-1.5" />
              {humanFirst ? '我先手 · 执黑' : '电脑先手 · 执黑'}
            </button>
            <p className="w-full text-center text-[11px] text-rose-400 -mt-0.5">
              {difficulty === 'easy'
                ? '简单：电脑常常看走眼，轻松取胜'
                : difficulty === 'normal'
                  ? '普通：攻守均衡，偶尔露出破绽'
                  : '困难：电脑会推演两步，慎之又慎'}
            </p>
          </div>
        )}
      </div>

      {/* 对战双方（回合指示） */}
      <div className="flex items-center gap-3 mb-4 flex-wrap justify-center pt-2.5">
        <PlayerCard
          color="black"
          name={nameOf('black')}
          sub={subOf('black')}
          state={cardState('black')}
          thinking={aiThinking && aiColor === 'black'}
          turnLabel={cardState('black') === 'active' ? turnLabelOf('black') : undefined}
        />
        <div className="flex flex-col items-center px-1 min-w-[92px]">
          <div className="font-display text-xl font-black text-rose-300 leading-none">VS</div>
          <div className="text-[11px] text-rose-400 tabular-nums mt-1.5">
            第 {moveCount + (winner ? 0 : 1)} 手 · {formatTime(elapsed)}
          </div>
        </div>
        <PlayerCard
          color="white"
          name={nameOf('white')}
          sub={subOf('white')}
          state={cardState('white')}
          thinking={aiThinking && aiColor === 'white'}
          turnLabel={cardState('white') === 'active' ? turnLabelOf('white') : undefined}
        />
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={undoMove}
          disabled={!canUndo}
          className={`px-5 py-3 rounded-xl text-sm font-medium tracking-wider transition-all duration-200 border ${
            canUndo
              ? 'bg-white/85 hover:bg-white text-rose-600 border-pink-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:scale-95'
              : 'bg-white/40 text-rose-300 border-pink-100 cursor-not-allowed'
          }`}
        >
          <i className="fas fa-undo mr-2" />
          悔棋
        </button>

        <button
          onClick={resetGame}
          className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white px-5 py-3 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 active:scale-95 font-medium text-sm tracking-wider"
        >
          <i className="fas fa-redo-alt mr-2" />
          重新开始
        </button>

        <button
          onClick={toggleMute}
          className="px-4 py-3 rounded-xl border bg-white/85 hover:bg-white text-rose-500 hover:text-rose-700 border-pink-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 active:scale-95"
          title={muted ? '开启音效' : '关闭音效'}
          aria-label={muted ? '开启音效' : '关闭音效'}
        >
          <i className={`fas ${muted ? 'fa-volume-mute' : 'fa-volume-up'} text-base`} />
        </button>
      </div>

      {/* 棋盘 */}
      <div
        className="rounded-2xl p-2.5 animate-rise-in"
        style={{
          background: 'linear-gradient(145deg, #c2678a, #a34e73 55%, #8f3f61)',
          boxShadow:
            '0 22px 55px -10px rgba(140, 50, 90, 0.5), inset 0 1px 1px rgba(255,255,255,0.3), inset 0 -2px 5px rgba(60,10,35,0.35)',
        }}
      >
        <div
          className="relative rounded-lg overflow-hidden"
          style={{
            width: boardPixelSize,
            height: boardPixelSize,
            background: `repeating-linear-gradient(93deg, rgba(255,255,255,0.05) 0 2px, transparent 2px 8px), repeating-linear-gradient(3deg, rgba(150,55,95,0.05) 0 3px, transparent 3px 11px), radial-gradient(ellipse at 28% 22%, rgba(255,255,255,0.3), transparent 55%), linear-gradient(145deg, #f5c6d0, #e8a4b5, #d98fa3)`,
            boxShadow:
              'inset 0 2px 10px rgba(120,40,70,0.28), inset 0 0 2px rgba(255,255,255,0.4)',
          }}
        >
        <svg className="absolute inset-0" width={boardPixelSize} height={boardPixelSize}>
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

          {/* 悬停十字准线 */}
          {hoverCell && !winner && humanTurn && board[hoverCell[0]][hoverCell[1]] === null && (
            <g pointerEvents="none" opacity={0.45}>
              <line
                x1={PADDING}
                y1={PADDING + hoverCell[0] * CELL_SIZE}
                x2={PADDING + (BOARD_SIZE - 1) * CELL_SIZE}
                y2={PADDING + hoverCell[0] * CELL_SIZE}
                stroke="#ffffff"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
              <line
                x1={PADDING + hoverCell[1] * CELL_SIZE}
                y1={PADDING}
                x2={PADDING + hoverCell[1] * CELL_SIZE}
                y2={PADDING + (BOARD_SIZE - 1) * CELL_SIZE}
                stroke="#ffffff"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            </g>
          )}
        </svg>

        {/* 悬停提示 */}
        {hoverCell && !winner && humanTurn && board[hoverCell[0]][hoverCell[1]] === null && (
          <div
            className="absolute pointer-events-none rounded-full opacity-30"
            style={{
              width: CELL_SIZE * 0.85,
              height: CELL_SIZE * 0.85,
              left: PADDING + hoverCell[1] * CELL_SIZE - (CELL_SIZE * 0.85) / 2,
              top: PADDING + hoverCell[0] * CELL_SIZE - (CELL_SIZE * 0.85) / 2,
              background:
                currentPlayer === 'black'
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
                className={`absolute rounded-full ${
                  isWinningCell(r, c) ? 'animate-pulse z-20' : 'z-10'
                }`}
                style={{
                  width: CELL_SIZE * 0.88,
                  height: CELL_SIZE * 0.88,
                  left: PADDING + c * CELL_SIZE - (CELL_SIZE * 0.88) / 2,
                  top: PADDING + r * CELL_SIZE - (CELL_SIZE * 0.88) / 2,
                  ...(isWinningCell(r, c)
                    ? { boxShadow: '0 0 12px 4px rgba(255, 105, 180, 0.8)' }
                    : {}),
                }}
              >
                {/* 内层：棋子本体 + 落子动画 */}
                <div
                  className="w-full h-full rounded-full animate-stone-drop"
                  style={{
                    background:
                      cell === 'black'
                        ? 'radial-gradient(circle at 35% 35%, #555, #111 60%, #000)'
                        : 'radial-gradient(circle at 35% 35%, #fff, #eee 50%, #ccc)',
                    boxShadow:
                      cell === 'black'
                        ? '2px 3px 6px rgba(0,0,0,0.5), inset -1px -1px 2px rgba(255,255,255,0.1)'
                        : '2px 3px 6px rgba(0,0,0,0.3), inset -1px -1px 2px rgba(0,0,0,0.05)',
                  }}
                >
                  {isLastMove(r, c) && !winner && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{
                          background: cell === 'black' ? 'rgba(255,255,255,0.6)' : 'rgba(220,50,80,0.7)',
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : null
          )
        )}

        {/* 连珠光线：获胜时沿五子绘制金色光线 */}
        {winningLine &&
          (() => {
            const sorted = [...winningLine].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
            const [r1, c1] = sorted[0];
            const [r2, c2] = sorted[sorted.length - 1];
            const x1 = PADDING + c1 * CELL_SIZE;
            const y1 = PADDING + r1 * CELL_SIZE;
            const x2 = PADDING + c2 * CELL_SIZE;
            const y2 = PADDING + r2 * CELL_SIZE;
            return (
              <svg
                className="absolute inset-0 z-20 pointer-events-none"
                width={boardPixelSize}
                height={boardPixelSize}
              >
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="rgba(251, 113, 133, 0.45)"
                  strokeWidth={11}
                  strokeLinecap="round"
                  pathLength={1}
                  strokeDasharray="1"
                  className="animate-draw-line"
                />
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="#fde047"
                  strokeWidth={4}
                  strokeLinecap="round"
                  pathLength={1}
                  strokeDasharray="1"
                  className="animate-draw-line"
                />
              </svg>
            );
          })()}

        {/* 点击层（仅人类回合可用） */}
        {!winner && humanTurn && (
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
                  onClick={() => humanClick(r, c)}
                  onMouseEnter={() => setHoverCell([r, c])}
                  onMouseLeave={() => setHoverCell(null)}
                />
              ))
            )}
          </div>
        )}

        {/* 电脑思考提示浮标 */}
        {aiThinking && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-rose-900/80 text-white text-xs px-4 py-1.5 rounded-full shadow-lg animate-rise-in pointer-events-none">
            <i className="fas fa-robot mr-1.5" />
            电脑思考中
            <ThinkingDots />
          </div>
        )}
        </div>
      </div>

      {/* 底部信息 / 复盘操作条 */}
      {winner && !showResult ? (
        <div className="mt-6 flex items-center gap-3 animate-rise-in">
          <button
            onClick={resetGame}
            className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white px-6 py-2.5 rounded-full shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 active:scale-95 font-medium text-sm"
          >
            <i className="fas fa-redo-alt mr-2" />
            再来一局
          </button>
          <button
            onClick={() => {
              setShowResult(true);
              playClick();
            }}
            className="bg-white/85 hover:bg-white text-rose-600 px-6 py-2.5 rounded-full shadow-md border border-pink-200 hover:-translate-y-0.5 transition-all duration-200 active:scale-95 font-medium text-sm"
          >
            <i className="fas fa-trophy mr-2" />
            查看结算
          </button>
        </div>
      ) : (
        <div className="mt-6 text-center">
          <div className="flex items-center justify-center gap-4 text-xs text-rose-400">
            <span>⚫ 黑棋先行</span>
            <span>·</span>
            <span>五子连珠获胜</span>
            <span>·</span>
            <span>{mode === 'pve' ? '点击棋盘与电脑对弈' : '点击棋盘落子'}</span>
          </div>
        </div>
      )}

      {/* ============ 结算弹窗 ============ */}
      {winner && showResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* 遮罩：点击可关闭去复盘 */}
          <div
            className="absolute inset-0 bg-rose-950/45 animate-fade-in"
            onClick={() => {
              setShowResult(false);
              playClick();
            }}
          />

          {celebrate && <Confetti />}

          {/* 弹窗卡片 */}
          <div
            className="relative w-[340px] max-w-full bg-white rounded-2xl overflow-hidden animate-modal-pop border border-pink-100"
            style={{
              boxShadow:
                '0 30px 70px -12px rgba(150, 40, 90, 0.5), 0 0 0 6px rgba(255,255,255,0.35)',
            }}
            role="dialog"
            aria-modal="true"
          >
            {/* 顶部装饰带 + 流光 */}
            <div
              className={`relative h-2.5 overflow-hidden ${
                mode === 'pve' && !humanWon && winner !== 'draw'
                  ? 'bg-gradient-to-r from-slate-400 via-slate-300 to-slate-400'
                  : 'bg-gradient-to-r from-pink-400 via-rose-400 to-pink-400'
              }`}
            >
              <div className="absolute inset-y-0 w-1/3 bg-white/60 animate-shine-sweep" />
            </div>

            <div className="px-8 pt-7 pb-7 text-center">
              {winner === 'draw' ? (
                <>
                  {/* 平局：双棋并立 */}
                  <div className="flex items-end justify-center mb-5 animate-rise-in" style={{ animationDelay: '0.1s' }}>
                    <div className="animate-float-y" style={{ animationDelay: '0.2s' }}>
                      <Stone color="black" size={52} className="-mr-2 relative z-10" />
                    </div>
                    <div className="animate-float-y">
                      <Stone color="white" size={52} />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* 获胜方棋子 + 皇冠 */}
                  <div className="relative inline-flex flex-col items-center mb-5 animate-rise-in" style={{ animationDelay: '0.1s' }}>
                    <div className="animate-float-y flex flex-col items-center">
                      <div className="-mb-1.5 relative z-10">
                        <Crown size={38} />
                      </div>
                      <div className={humanWon || mode === 'pvp' ? 'animate-ring-pulse rounded-full' : 'rounded-full'}>
                        <Stone color={winner as Player} size={64} />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <p className="text-[11px] font-bold tracking-[0.4em] text-rose-400 mb-1.5 animate-rise-in" style={{ animationDelay: '0.16s', marginLeft: '0.4em' }}>
                {modalLabel}
              </p>
              <h2 className="font-display text-4xl font-black text-rose-950 mb-2 animate-rise-in" style={{ animationDelay: '0.22s' }}>
                {modalTitle}
              </h2>
              <p className="text-sm text-rose-500 animate-rise-in" style={{ animationDelay: '0.28s' }}>
                {modalSubtitle}
              </p>

              {/* 数据统计 */}
              <div
                className="mt-5 mb-6 grid grid-cols-2 divide-x divide-pink-100 bg-pink-50/70 rounded-xl py-3.5 border border-pink-100 animate-rise-in"
                style={{ animationDelay: '0.34s' }}
              >
                <div>
                  <div className="text-xl font-black text-rose-900 tabular-nums leading-none">{formatTime(elapsed)}</div>
                  <div className="text-[11px] text-rose-400 mt-1.5 tracking-widest">对局用时</div>
                </div>
                <div>
                  <div className="text-xl font-black text-rose-900 tabular-nums leading-none">{moveCount}</div>
                  <div className="text-[11px] text-rose-400 mt-1.5 tracking-widest">总手数</div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="animate-rise-in" style={{ animationDelay: '0.4s' }}>
                <button
                  onClick={resetGame}
                  className="w-full bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white py-3 rounded-xl shadow-lg shadow-pink-300/50 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.97] font-bold text-sm tracking-[0.2em]"
                >
                  <i className="fas fa-redo-alt mr-2" />
                  {mode === 'pve' && !humanWon && winner !== 'draw' ? '再战一局' : '再来一局'}
                </button>
                <button
                  onClick={() => {
                    setShowResult(false);
                    playClick();
                  }}
                  className="mt-2.5 w-full text-rose-500 hover:text-rose-700 hover:bg-pink-50 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm"
                >
                  <i className="fas fa-chess-board mr-2" />
                  查看棋盘复盘
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
