// Особая раскладка «прицел» (ARCADE_HUB_SPEC §10 «Особые раскладки»): слева карточки снарядов,
// справа рамка поля в пропорциях большого экрана. Снаряд запускают, натягивая линию в любом месте
// правой области: влетает с края поля (линия, продлённая назад от якоря) и летит по линии.
// Только DOM и SVG; ничего не движется само — только в ответ на касание (и счёт кулдауна на карточке).
import {
  AIM_CANCEL_CM,
  AIM_CARD_HEIGHT_K,
  AIM_CARD_MIN_PX,
  AIM_FRAME_MIN_HEIGHT,
  AIM_STEP_COLORS,
  AIM_STEP_THRESHOLDS,
  AIM_TICK_MS,
  CSS_PX_PER_CM,
  VIBRATE_AIM_READY_MS,
  VIBRATE_AIM_SHOT_MS,
  VIBRATE_TAP_MS,
} from '../shared/config';
import { t } from '../shared/i18n';
import type { AimLayout, AimShot } from '../shared/protocol';
import { button, el } from './ui';

const SVG_NS = 'http://www.w3.org/2000/svg';
const MS_PER_S = 1000;
const GAP_PX = 16;
const START_COLOR = AIM_STEP_COLORS[0];

export interface AimCallbacks {
  shot(shot: AimShot): void;
  pause(): void;
  settings(): void;
  vibrate(ms: number): void;
}

export interface AimView {
  layout: AimLayout;
  /** Соотношение сторон поля большого экрана. */
  aspect: number;
  leader: boolean;
  paused: boolean;
}

export interface Aim {
  readonly el: HTMLElement;
  setView(view: AimView): void;
  /** Отпустить натягивание (открыли настройки, свернули вкладку). */
  release(): void;
}

interface CardState {
  id: string;
  node: HTMLButtonElement;
  secs: HTMLElement;
  readyAt: number;
  cooldownS: number;
  ready: boolean;
}

const svg = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string> = {}): SVGElementTagNameMap[K] => {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};

/** Ступень силы по длине линии в долях диагонали рамки: 1…4. */
export function aimStep(length: number, diagonal: number): number {
  const k = diagonal > 0 ? length / diagonal : 0;
  const i = AIM_STEP_THRESHOLDS.findIndex((edge) => k < edge);
  return (i === -1 ? AIM_STEP_THRESHOLDS.length : i) + 1;
}

/** Точка входа: прямая через якорь по направлению пересекает рамку — берём первую точку внутри.
 *  Доли рамки 0…1; прямая мимо рамки — null. */
export function aimEntry(
  ax: number,
  ay: number,
  dx: number,
  dy: number,
  w: number,
  h: number,
): { x: number; y: number } | null {
  let tMin = -Infinity;
  let tMax = Infinity;
  for (const [p, d, size] of [
    [ax, dx, w],
    [ay, dy, h],
  ] as const) {
    if (d === 0) {
      if (p < 0 || p > size) return null;
      continue;
    }
    const t0 = (0 - p) / d;
    const t1 = (size - p) / d;
    tMin = Math.max(tMin, Math.min(t0, t1));
    tMax = Math.min(tMax, Math.max(t0, t1));
  }
  if (tMin > tMax) return null;
  const clamp = (v: number): number => Math.min(1, Math.max(0, v));
  return { x: clamp((ax + dx * tMin) / w), y: clamp((ay + dy * tMin) / h) };
}

export function createAim(cb: AimCallbacks): Aim {
  const root = el('div', 'aim');
  const pauseBtn = button('pad__pause', undefined, t('ctrl.pause'));
  const settingsBtn = button('pad__settings', undefined, t('ctrl.settings'));
  const top = el('div', 'aim__top');
  top.append(pauseBtn, settingsBtn);
  const cardsCol = el('div', 'aim__cards');
  const area = el('div', 'aim__area');
  const frame = el('div', 'aim__frame');
  const diag = svg('svg', { class: 'aim__diag', preserveAspectRatio: 'none', viewBox: '0 0 100 100' });
  diag.append(svg('line', { x1: '0', y1: '0', x2: '100', y2: '100' }), svg('line', { x1: '100', y1: '0', x2: '0', y2: '100' }));
  frame.append(diag);
  const overlay = svg('svg', { class: 'aim__overlay' });
  const grad = svg('linearGradient', { id: 'aim-grad', gradientUnits: 'userSpaceOnUse' });
  const stopA = svg('stop', { offset: '0', 'stop-color': START_COLOR });
  const stopB = svg('stop', { offset: '1', 'stop-color': START_COLOR });
  grad.append(stopA, stopB);
  const defs = svg('defs');
  defs.append(grad);
  const line = svg('line', { class: 'aim__line', stroke: 'url(#aim-grad)' });
  const anchorRing = svg('circle', { class: 'aim__anchor', r: '22' });
  const fingerRing = svg('circle', { class: 'aim__finger', r: '14' });
  const shotRing = svg('circle', { class: 'aim__shot', r: '26' });
  overlay.append(defs, line, anchorRing, fingerRing, shotRing);
  area.append(frame, overlay);
  const body = el('div', 'aim__body');
  body.append(cardsCol, area);
  const hint = el('p', 'aim__hint');
  root.append(top, body, hint);

  let view: AimView | null = null;
  let cards: CardState[] = [];
  let selected = '';
  let pointer: number | null = null;
  let anchor = { x: 0, y: 0 };
  let finger = { x: 0, y: 0 };

  const selectedCard = (): CardState | undefined => cards.find((c) => c.id === selected);
  const leftS = (c: CardState): number => Math.max(0, (c.readyAt - performance.now()) / MS_PER_S);

  const setAim = (on: boolean): void => {
    for (const node of [line, anchorRing, fingerRing]) node.style.display = on ? '' : 'none';
  };
  setAim(false);

  /** Раскладка: карточки — не меньше 96 точек и трети высоты; рамка — как можно крупнее,
   *  не меньше 60 % высоты: сначала сужается колонка карточек. */
  const layoutFrame = (): void => {
    if (!view) return;
    const bodyRect = body.getBoundingClientRect();
    const count = Math.max(1, cards.length);
    let side = Math.max(AIM_CARD_MIN_PX, innerHeight * AIM_CARD_HEIGHT_K);
    side = Math.min(side, (bodyRect.height - GAP_PX * (count - 1)) / count);
    const wanted = innerHeight * AIM_FRAME_MIN_HEIGHT * view.aspect;
    if (bodyRect.width - side - GAP_PX < wanted) side = Math.max(AIM_CARD_MIN_PX, bodyRect.width - GAP_PX - wanted);
    root.style.setProperty('--card', `${Math.floor(side)}px`);
    const areaRect = area.getBoundingClientRect();
    const w = Math.min(areaRect.width, areaRect.height * view.aspect);
    const h = w / view.aspect;
    frame.style.width = `${w}px`;
    frame.style.height = `${h}px`;
    frame.style.left = `${(areaRect.width - w) / 2}px`;
    frame.style.top = `${(areaRect.height - h) / 2}px`;
  };

  const renderCards = (): void => {
    const now = performance.now();
    for (const c of cards) {
      const left = Math.max(0, (c.readyAt - now) / MS_PER_S);
      const ready = left <= 0;
      if (ready && !c.ready) {
        // Готовность: вспышка рамки и щелчок.
        c.node.classList.remove('is-ready-flash');
        void c.node.offsetWidth;
        c.node.classList.add('is-ready-flash');
        cb.vibrate(VIBRATE_AIM_READY_MS);
      }
      c.ready = ready;
      c.node.classList.toggle('is-cooling', !ready);
      c.node.classList.toggle('is-selected', c.id === selected);
      c.node.style.setProperty('--left', String(ready || c.cooldownS <= 0 ? 0 : Math.min(1, left / c.cooldownS)));
      c.secs.textContent = ready ? '' : String(Math.ceil(left));
    }
    const sel = selectedCard();
    const waiting = sel !== undefined && !sel.ready;
    area.classList.toggle('is-muted', waiting || (view?.paused ?? false));
    hint.textContent = waiting ? t('ctrl.aim.wait', { s: Math.ceil(leftS(sel)) }) : t('ctrl.aim.hint');
  };
  setInterval(() => {
    if (!root.hidden && cards.some((c) => !c.ready)) renderCards();
  }, AIM_TICK_MS);

  const localPoint = (e: PointerEvent): { x: number; y: number } => {
    const r = area.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const drawLine = (): void => {
    const f = frame.getBoundingClientRect();
    const length = Math.hypot(finger.x - anchor.x, finger.y - anchor.y);
    const color = AIM_STEP_COLORS[aimStep(length, Math.hypot(f.width, f.height)) - 1] ?? START_COLOR;
    for (const [node, p] of [
      [anchorRing, anchor],
      [fingerRing, finger],
    ] as const) {
      node.setAttribute('cx', String(p.x));
      node.setAttribute('cy', String(p.y));
    }
    line.setAttribute('x1', String(anchor.x));
    line.setAttribute('y1', String(anchor.y));
    line.setAttribute('x2', String(finger.x));
    line.setAttribute('y2', String(finger.y));
    grad.setAttribute('x1', String(anchor.x));
    grad.setAttribute('y1', String(anchor.y));
    grad.setAttribute('x2', String(finger.x));
    grad.setAttribute('y2', String(finger.y));
    stopB.setAttribute('stop-color', color);
  };

  const release = (): void => {
    pointer = null;
    setAim(false);
  };

  area.addEventListener('pointerdown', (e) => {
    const sel = selectedCard();
    if (pointer !== null || !view || view.paused || !sel || !sel.ready) return;
    pointer = e.pointerId;
    area.setPointerCapture(e.pointerId);
    anchor = localPoint(e);
    finger = anchor;
    setAim(true);
    drawLine();
  });
  area.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointer) return;
    finger = localPoint(e);
    drawLine();
  });
  area.addEventListener('pointerup', (e) => {
    if (e.pointerId !== pointer) return;
    finger = localPoint(e);
    release();
    const sel = selectedCard();
    const length = Math.hypot(finger.x - anchor.x, finger.y - anchor.y);
    // Короткая линия или тап — отмена: снаряд не уходит, кулдаун не тратится.
    if (!sel || !sel.ready || length < AIM_CANCEL_CM * CSS_PX_PER_CM) return;
    const f = frame.getBoundingClientRect();
    const a = area.getBoundingClientRect();
    const dx = (finger.x - anchor.x) / length;
    const dy = (finger.y - anchor.y) / length;
    const entry = aimEntry(anchor.x - (f.left - a.left), anchor.y - (f.top - a.top), dx, dy, f.width, f.height);
    if (!entry) return;
    cb.shot({ card: sel.id, x: entry.x, y: entry.y, dx, dy, step: aimStep(length, Math.hypot(f.width, f.height)) });
    cb.vibrate(VIBRATE_AIM_SHOT_MS);
    // Жёлтое кольцо на месте якоря, гаснет за долю секунды. Кулдаун — до ответа экрана.
    shotRing.setAttribute('cx', String(anchor.x));
    shotRing.setAttribute('cy', String(anchor.y));
    shotRing.classList.remove('is-on');
    void shotRing.getBoundingClientRect();
    shotRing.classList.add('is-on');
    sel.readyAt = performance.now() + sel.cooldownS * MS_PER_S;
    renderCards();
  });
  area.addEventListener('pointercancel', (e) => {
    if (e.pointerId === pointer) release();
  });

  pauseBtn.addEventListener('click', () => cb.pause());
  settingsBtn.addEventListener('click', () => cb.settings());
  addEventListener('resize', layoutFrame);

  return {
    el: root,
    setView(next) {
      const ids = next.layout.cards.map((c) => c.id).join();
      if (ids !== cards.map((c) => c.id).join()) {
        cards = next.layout.cards.map((c) => {
          const node = button('aim-card', undefined, c.id);
          const icon = el('span', 'aim-card__icon');
          icon.innerHTML = c.icon;
          const secs = el('span', 'aim-card__secs');
          node.append(icon, secs);
          node.addEventListener('click', () => {
            selected = c.id;
            cb.vibrate(VIBRATE_TAP_MS);
            renderCards();
          });
          return { id: c.id, node, secs, readyAt: 0, cooldownS: c.cooldownS, ready: true };
        });
        cardsCol.replaceChildren(...cards.map((c) => c.node));
        if (!cards.some((c) => c.id === selected)) selected = cards[0]?.id ?? '';
      }
      const now = performance.now();
      for (const c of next.layout.cards) {
        const state = cards.find((s) => s.id === c.id);
        if (!state) continue;
        state.cooldownS = c.cooldownS;
        state.readyAt = now + c.readyInS * MS_PER_S;
        // Экран сказал «готово» раньше, чем досчитал телефон, — без повторной вспышки.
        if (c.readyInS <= 0) state.ready = true;
      }
      view = next;
      pauseBtn.classList.toggle('is-empty', !next.leader);
      root.classList.toggle('aim--paused', next.paused);
      if (next.paused) release();
      layoutFrame();
      renderCards();
    },
    release,
  };
}
