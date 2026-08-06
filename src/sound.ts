/** 基于 Web Audio API 的轻量音效引擎 —— 纯代码合成，无需音频文件 */

let ctx: AudioContext | null = null;
let muted = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  return ctx;
}

/** 在首次用户交互时调用，解锁音频上下文 */
export function unlockAudio() {
  getCtx();
}

export function setMuted(m: boolean) {
  muted = m;
}

/** 单个音：包络 + 可选滑音 */
function tone(
  freq: number,
  duration: number,
  type: OscillatorType,
  volume: number,
  when = 0,
  slideTo?: number
) {
  const c = getCtx();
  if (!c || muted) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

/** 落子声：短促噪声「嗒」+ 低频「咚」，黑棋音更低沉 */
export function playPlace(isBlack: boolean) {
  const c = getCtx();
  if (!c || muted) return;

  // 高频噪声 click
  const len = Math.floor(c.sampleRate * 0.035);
  const buffer = c.createBuffer(1, len, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 1600;
  const ng = c.createGain();
  ng.gain.value = 0.3;
  src.connect(filter);
  filter.connect(ng);
  ng.connect(c.destination);
  src.start();

  // 低频 thud
  tone(isBlack ? 185 : 235, 0.1, 'sine', 0.5, 0, isBlack ? 110 : 145);
}

/** 胜利：上行琶音 + 高音点缀 */
export function playWin(delay = 0) {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
    tone(f, 0.2, 'triangle', 0.26, delay + i * 0.11)
  );
  tone(1567.98, 0.35, 'sine', 0.12, delay + 0.44);
}

/** 失败：下行三音 */
export function playLose(delay = 0) {
  [392, 311.13, 261.63].forEach((f, i) => tone(f, 0.24, 'triangle', 0.24, delay + i * 0.15));
}

/** 平局：中性双音 */
export function playDraw(delay = 0) {
  tone(440, 0.16, 'triangle', 0.24, delay);
  tone(440, 0.22, 'triangle', 0.24, delay + 0.18);
}

/** 按钮轻点 */
export function playClick() {
  tone(900, 0.05, 'sine', 0.12);
}

/** 悔棋：下滑短音 */
export function playUndo() {
  tone(520, 0.09, 'sine', 0.18, 0, 320);
}
