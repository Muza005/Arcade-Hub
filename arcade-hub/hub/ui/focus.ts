// Единый менеджер фокуса хаба (ARCADE_HUB_SPEC §8).
// Клавиатура, мышь и (позже) телефон ведущего ведут к одному фокусу. В каждый момент выделен ровно один элемент.
//
// Область фокуса — открытое модальное окно, а если его нет — видимый экран с атрибутом data-focus-scope.
// Во время матча области нет, и менеджер клавиши не трогает: они принадлежат игре.
import type { UiSounds } from '../audio';
import { pickNext, type Direction } from './spatial';

/** Событие «назад» (Esc / Backspace), которое получает текущая область. */
export const BACK_EVENT = 'hub:back';

const FOCUSABLE = 'button:not([disabled]), [data-focusable]';

const DIRECTIONS: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
};

const BACK_KEYS = new Set(['Escape', 'Backspace']);
const SELECT_KEYS = new Set(['Enter', 'Space']);
const FULLSCREEN_KEY = 'KeyF';

function currentScope(): HTMLElement | null {
  return (
    document.querySelector<HTMLDialogElement>('dialog[open]') ??
    document.querySelector<HTMLElement>('[data-focus-scope]:not([hidden])')
  );
}

function focusables(scope: HTMLElement): HTMLElement[] {
  return [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => el.getClientRects().length > 0 && el.closest('dialog:not([open])') === null,
  );
}

/** Главное действие экрана: [autofocus], затем [data-default-focus], затем первый элемент. */
function defaultFocus(scope: HTMLElement): HTMLElement | undefined {
  const all = focusables(scope);
  return (
    all.find((el) => el.hasAttribute('autofocus')) ?? all.find((el) => el.hasAttribute('data-default-focus')) ?? all[0]
  );
}

function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen().catch(() => undefined);
}

export interface FocusManager {
  /** Сдвинуть фокус (стрелки, WASD, джойстик ведущего). */
  move(dir: Direction): void;
  /** Нажать выбранный элемент (Enter, главная кнопка ведущего). */
  select(): void;
  /** «Назад» (Esc, Backspace, пауза ведущего в меню). */
  back(): void;
  dispose(): void;
}

export function createFocusManager(sounds: UiSounds): FocusManager {
  let tabbing = false;

  const moveTo = (el: HTMLElement): void => {
    if (el === document.activeElement) return;
    el.focus();
    sounds.play('click');
  };

  const activeIn = (scope: HTMLElement): HTMLElement | null =>
    document.activeElement instanceof HTMLElement && scope.contains(document.activeElement)
      ? document.activeElement
      : null;

  const move = (dir: Direction): void => {
    const scope = currentScope();
    if (!scope) return;
    const active = activeIn(scope);
    if (!active) {
      const target = defaultFocus(scope);
      if (target) moveTo(target);
      return;
    }
    const candidates = focusables(scope).filter((el) => el !== active);
    const next = pickNext(
      active.getBoundingClientRect(),
      candidates.map((el) => el.getBoundingClientRect()),
      dir,
    );
    const target = candidates[next];
    if (target) moveTo(target);
  };

  const select = (): void => {
    const scope = currentScope();
    if (!scope) return;
    const active = activeIn(scope);
    if (active) active.click();
    else {
      const target = defaultFocus(scope);
      if (target) moveTo(target);
    }
  };

  const back = (): void => {
    currentScope()?.dispatchEvent(new CustomEvent(BACK_EVENT));
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey) return;
    const scope = currentScope();
    if (!scope) return;
    const active = activeIn(scope);

    if (e.code === 'Tab') {
      tabbing = true;
      return;
    }
    if (e.code === FULLSCREEN_KEY) {
      e.preventDefault();
      toggleFullscreen();
      return;
    }
    if (BACK_KEYS.has(e.code)) {
      e.preventDefault();
      back();
      return;
    }
    if (SELECT_KEYS.has(e.code)) {
      // Кнопки нажимаются сами (родное поведение); без фокуса — сначала встаём на главное действие.
      if (!active) {
        e.preventDefault();
        const target = defaultFocus(scope);
        if (target) moveTo(target);
      }
      return;
    }

    const dir = DIRECTIONS[e.code];
    if (!dir) return;
    e.preventDefault();
    move(dir);
  };

  const onFocusIn = (): void => {
    if (!tabbing) return;
    tabbing = false;
    sounds.play('click');
  };

  // Мышь переносит фокус наведением — но только когда она действительно двигалась,
  // а не когда под неподвижным курсором проехала прокрученная сетка.
  const onPointerMove = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse' || (e.movementX === 0 && e.movementY === 0)) return;
    const scope = currentScope();
    const target = e.target instanceof Element ? e.target.closest<HTMLElement>(FOCUSABLE) : null;
    if (scope && target && scope.contains(target)) moveTo(target);
  };

  // Клик по пустому месту не снимает фокус: выделен всегда ровно один элемент.
  const onMouseDown = (e: MouseEvent): void => {
    const scope = currentScope();
    if (!scope || !(e.target instanceof Element)) return;
    if (!e.target.closest(FOCUSABLE)) e.preventDefault();
  };

  const onClick = (e: MouseEvent): void => {
    const button = e.target instanceof Element ? e.target.closest<HTMLElement>('button') : null;
    if (!button || !currentScope()?.contains(button)) return;
    sounds.play(button.dataset.sound === 'open' ? 'open' : 'select');
  };

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('focusin', onFocusIn);
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('click', onClick, true);

  return {
    move,
    select,
    back,
    dispose() {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('click', onClick, true);
    },
  };
}
