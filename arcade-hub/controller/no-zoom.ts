// Телефон не масштабируется (§10): частые нажатия на главную кнопку на iOS и Android включали
// «двойной тап — увеличить», а щипок увеличивал экран так, что вернуть было нечем.
// Запрещаем оба жеста; если экран всё же увеличен — возвращаем масштаб 1.
import { DOUBLE_TAP_GUARD_MS } from '../shared/config';

const VIEWPORT = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
/** Тот же масштаб другой записью: смена content заставляет браузер заново применить maximum-scale. */
const VIEWPORT_NUDGE = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
const ZOOMED = 1.01;

export function lockZoom(): void {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'viewport';
    document.head.append(meta);
  }
  meta.content = VIEWPORT;
  const viewport = meta;

  // Щипок: iOS шлёт gesture*, остальные — касание двумя пальцами.
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
  }
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1) e.preventDefault();
    },
    { passive: false },
  );
  // Двойной тап: второе касание вскоре после первого не масштабирует. На экране управления (джойстик,
  // кнопки, прицел) — всегда; в меню и настройках кнопки нажимаются по click, его не трогаем.
  let lastEnd = 0;
  document.addEventListener(
    'touchend',
    (e) => {
      const now = performance.now();
      const fast = now - lastEnd < DOUBLE_TAP_GUARD_MS;
      lastEnd = now;
      const onControls = e.target instanceof Element && e.target.closest('.pad, .aim') !== null;
      if (fast && onControls) e.preventDefault();
    },
    { passive: false },
  );
  document.addEventListener('dblclick', (e) => e.preventDefault());

  // Если масштаб всё же сменился — вернуть 1.
  window.visualViewport?.addEventListener('resize', () => {
    if ((window.visualViewport?.scale ?? 1) <= ZOOMED) return;
    viewport.content = VIEWPORT_NUDGE;
    requestAnimationFrame(() => (viewport.content = VIEWPORT));
  });
}
