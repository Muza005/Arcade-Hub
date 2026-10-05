// Игровой цикл: фиксированный шаг с аккумулятором, отрисовка отдельно с интерполяцией.
import { FIXED_STEP_HZ, MAX_FRAME_S } from '../shared/config';

export interface LoopHandlers {
  /** Шаг симуляции. dt всегда один и тот же — это основа детерминизма. */
  update(dtS: number, tick: number): void;
  /** Отрисовка. alpha ∈ [0, 1) — доля пути от прошлого шага к текущему. */
  render(alpha: number): void;
}

/** Источник кадров. По умолчанию — requestAnimationFrame: во вкладке в фоне он молчит. */
export interface FrameScheduler {
  request(cb: (nowMs: number) => void): number;
  cancel(handle: number): void;
}

const MS_PER_S = 1000;

const rafScheduler: FrameScheduler = {
  request: (cb) => requestAnimationFrame(cb),
  cancel: (handle) => cancelAnimationFrame(handle),
};

export class FixedLoop {
  readonly stepS: number;
  private accumulatorS = 0;
  private lastMs: number | null = null;
  private handle: number | null = null;
  private tickCount = 0;
  private halted = false;

  constructor(
    private readonly handlers: LoopHandlers,
    private readonly scheduler: FrameScheduler = rafScheduler,
    hz: number = FIXED_STEP_HZ,
  ) {
    this.stepS = 1 / hz;
  }

  get running(): boolean {
    return this.handle !== null;
  }

  get tick(): number {
    return this.tickCount;
  }

  start(): void {
    if (this.running) return;
    this.lastMs = null;
    this.accumulatorS = 0;
    this.halted = false;
    this.handle = this.scheduler.request(this.frame);
  }

  /** Останавливает цикл. Если вызвано из update, оставшиеся шаги и отрисовка этого кадра не выполняются. */
  stop(): void {
    this.halted = true;
    if (this.handle !== null) this.scheduler.cancel(this.handle);
    this.handle = null;
  }

  /** Один кадр: досчитать накопившиеся шаги и отрисовать. Публичный для тестов. */
  advance(nowMs: number): void {
    if (this.lastMs !== null) {
      const frameS = Math.min((nowMs - this.lastMs) / MS_PER_S, MAX_FRAME_S);
      this.accumulatorS += Math.max(frameS, 0);
    }
    this.lastMs = nowMs;

    while (this.accumulatorS >= this.stepS) {
      this.handlers.update(this.stepS, this.tickCount);
      this.tickCount++;
      this.accumulatorS -= this.stepS;
      if (this.halted) return;
    }
    this.handlers.render(this.accumulatorS / this.stepS);
  }

  private readonly frame = (nowMs: number): void => {
    this.advance(nowMs);
    if (this.handle !== null) this.handle = this.scheduler.request(this.frame);
  };
}
