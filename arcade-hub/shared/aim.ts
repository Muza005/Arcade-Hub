// Раскладка «прицел» (ARCADE_HUB_SPEC §10 «Особые раскладки»): разбор выстрела с телефона для игры.
import { AIM_STEPS } from './config';
import type { AimShot, GamePayload } from './protocol';

const unit = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : null);

/** Выстрел из `g` телефона (`{ aim: AimShot }`) или null, если это не он или он битый. */
export function parseAimShot(payload: GamePayload): AimShot | null {
  const raw = payload.aim;
  if (typeof raw !== 'object' || raw === null) return null;
  const s = raw as Record<string, unknown>;
  const x = unit(s.x);
  const y = unit(s.y);
  const dx = typeof s.dx === 'number' && Number.isFinite(s.dx) ? s.dx : null;
  const dy = typeof s.dy === 'number' && Number.isFinite(s.dy) ? s.dy : null;
  const len = dx !== null && dy !== null ? Math.hypot(dx, dy) : 0;
  const step = typeof s.step === 'number' ? Math.round(s.step) : 0;
  if (typeof s.card !== 'string' || x === null || y === null || dx === null || dy === null || len === 0) return null;
  if (step < 1 || step > AIM_STEPS) return null;
  return { card: s.card, x, y, dx: dx / len, dy: dy / len, step };
}
