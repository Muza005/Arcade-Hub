// Гироскоп (§10): три чувствительности, мёртвая зона ±3°, low-pass s = s + K·(raw − s), калибровка, инверсия.
import { TILT_DEADZONE_DEG, TILT_FULL_DEG, TILT_LOWPASS_K } from '../shared/config';

interface Angles {
  x: number;
  y: number;
}

type OrientationCtor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

/** iOS 13+ требует разрешение по нажатию; остальные — сразу. */
export async function requestGyroPermission(): Promise<boolean> {
  const ctor = (window as { DeviceOrientationEvent?: OrientationCtor }).DeviceOrientationEvent;
  if (!ctor) return false;
  if (typeof ctor.requestPermission !== 'function') return true;
  try {
    return (await ctor.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

/** Наклон в осях экрана с учётом поворота телефона. */
function screenAngles(beta: number, gamma: number): Angles {
  const angle = screen.orientation?.angle ?? 0;
  switch (angle) {
    case 90:
      return { x: beta, y: -gamma };
    case 270:
    case -90:
      return { x: -beta, y: gamma };
    default:
      return { x: gamma, y: beta };
  }
}

/** Отклонение в градусах → ось [-1, 1] с мёртвой зоной. */
export function tiltAxis(deltaDeg: number, fullDeg: number): number {
  const magnitude = Math.max(0, Math.abs(deltaDeg) - TILT_DEADZONE_DEG) / (fullDeg - TILT_DEADZONE_DEG);
  return Math.sign(deltaDeg) * Math.min(1, magnitude);
}

export interface Gyro {
  /** Появилось ли хоть одно настоящее событие датчика. */
  readonly available: boolean;
  start(): void;
  stop(): void;
  /** Нейтраль — следующее положение телефона. */
  calibrate(): void;
  configure(options: { fullDeg: number; invertX: boolean; invertY: boolean }): void;
}

export function createGyro(onTilt: (x: number, y: number) => void, onAvailable: () => void): Gyro {
  let smooth: Angles | null = null;
  let neutral: Angles | null = null;
  let available = false;
  let fullDeg: number = TILT_FULL_DEG.mid;
  let invertX = false;
  let invertY = false;

  const onOrientation = (e: DeviceOrientationEvent): void => {
    if (e.beta === null || e.gamma === null) return;
    if (!available) {
      available = true;
      onAvailable();
    }
    const raw = screenAngles(e.beta, e.gamma);
    smooth = smooth
      ? { x: smooth.x + TILT_LOWPASS_K * (raw.x - smooth.x), y: smooth.y + TILT_LOWPASS_K * (raw.y - smooth.y) }
      : raw;
    neutral ??= { ...smooth };
    const x = tiltAxis(smooth.x - neutral.x, fullDeg);
    const y = tiltAxis(smooth.y - neutral.y, fullDeg);
    onTilt(invertX ? -x : x, invertY ? -y : y);
  };
  // При повороте экрана оси меняются — нейтраль берём заново.
  const onRotate = (): void => {
    smooth = null;
    neutral = null;
  };

  return {
    get available() {
      return available;
    },
    start() {
      window.addEventListener('deviceorientation', onOrientation);
      screen.orientation?.addEventListener('change', onRotate);
    },
    stop() {
      window.removeEventListener('deviceorientation', onOrientation);
      screen.orientation?.removeEventListener('change', onRotate);
    },
    calibrate() {
      neutral = null;
    },
    configure(options) {
      ({ fullDeg, invertX, invertY } = options);
    },
  };
}
