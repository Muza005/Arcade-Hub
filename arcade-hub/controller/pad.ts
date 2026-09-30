// Экран контроллера (§10): пауза, настройки, плашка с ником, управление и главная кнопка.
// Никакого другого текста. Анимации — только transform и opacity.
import { clampUnit } from '../engine/input';
import { JOYSTICK_DEADZONE, JOYSTICK_FULL } from '../shared/config';
import { t } from '../shared/i18n';
import type { ControlMode, MainButtonState } from '../shared/protocol';
import type { Sensitivity } from './prefs';
import { button, el } from './ui';

export interface PadCallbacks {
  /** Оси управления (джойстик или стрелки) изменились. Гироскоп шлёт свои оси сам. */
  axes(x: number, y: number): void;
  button(pressed: boolean): void;
  pause(): void;
  settings(): void;
  recalibrate(): void;
}

export interface PadView {
  mode: ControlMode;
  sensitivity: Sensitivity;
  mainButton: boolean;
  leader: boolean;
  /** Гость в меню: джойстик и кнопка приглушены, место паузы пустое. */
  muted: boolean;
  /** Пауза у всех: кнопки гаснут до серого. */
  paused: boolean;
}

export interface Pad {
  readonly el: HTMLElement;
  /** Сюда main.ts кладёт карточку паузы для гостей. */
  readonly notice: HTMLElement;
  setView(view: PadView): void;
  setProfile(nick: string, color: string): void;
  setMainButton(state: MainButtonState | undefined): void;
  setTilt(x: number, y: number): void;
  /** Отпустить всё управление (например, при открытии настроек). */
  release(): void;
}

export function createPad(cb: PadCallbacks): Pad {
  const root = el('div', 'pad');

  // Верх: пауза · плашка · настройки
  const pauseBtn = button('pad__pause', undefined, t('ctrl.pause'));
  const plate = el('div', 'plate');
  const plateAvatar = el('span', 'plate__avatar');
  const plateNick = el('span', 'plate__nick');
  plate.append(plateAvatar, plateNick);
  const settingsBtn = button('pad__settings', undefined, t('ctrl.settings'));
  const top = el('div', 'pad__top');
  top.append(pauseBtn, plate, settingsBtn);
  const notice = el('div', 'pad__notice');

  // Джойстик
  const stick = el('div', 'stick');
  const knob = el('div', 'stick__knob');
  stick.append(knob);

  // Стрелки
  const dpad = el('div', 'dpad');
  const arrows = (['up', 'left', 'right', 'down'] as const).map((dir) => {
    const b = button(`dpad__btn dpad__btn--${dir}`, undefined, dir);
    b.dataset.dir = dir;
    dpad.append(b);
    return b;
  });

  // Наклон: едва заметный круг — справка краем глаза
  const tilt = el('div', 'tilt');
  tilt.append(el('div', 'tilt__dot'));
  const recal = button('pad__recal', undefined, t('ctrl.recalibrate'));

  // Главная кнопка: число и ободок — если их шлёт игра
  const main = button('main-btn');
  const mainValue = el('span', 'main-btn__value');
  const mainOff = el('span', 'main-btn__off');
  main.append(mainValue, mainOff);

  root.append(top, notice, stick, dpad, tilt, recal, main);

  let view: PadView = {
    mode: 'joystick',
    sensitivity: 'mid',
    mainButton: true,
    leader: false,
    muted: false,
    paused: false,
  };

  // ─── Джойстик ───
  let stickPointer: number | null = null;
  const moveStick = (e: PointerEvent): void => {
    const rect = stick.getBoundingClientRect();
    const radius = rect.width / 2;
    const dx = e.clientX - (rect.left + radius);
    const dy = e.clientY - (rect.top + radius);
    const full = radius * JOYSTICK_FULL[view.sensitivity];
    const knobPos = clampUnit(dx / radius, dy / radius);
    knob.style.transform = `translate(${knobPos.x * radius}px, ${knobPos.y * radius}px)`;
    const v = clampUnit(dx / full, dy / full);
    const deadzone = Math.hypot(v.x, v.y) < JOYSTICK_DEADZONE;
    cb.axes(deadzone ? 0 : v.x, deadzone ? 0 : v.y);
  };
  const releaseStick = (): void => {
    stickPointer = null;
    knob.style.transform = '';
    cb.axes(0, 0);
  };
  stick.addEventListener('pointerdown', (e) => {
    stickPointer = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    moveStick(e);
  });
  stick.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickPointer) moveStick(e);
  });
  for (const type of ['pointerup', 'pointercancel'] as const) {
    stick.addEventListener(type, (e) => {
      if (e.pointerId === stickPointer) releaseStick();
    });
  }

  // ─── Стрелки ───
  const held = new Map<number, string>();
  const emitArrows = (): void => {
    const dirs = new Set(held.values());
    const x = (dirs.has('right') ? 1 : 0) - (dirs.has('left') ? 1 : 0);
    const y = (dirs.has('down') ? 1 : 0) - (dirs.has('up') ? 1 : 0);
    const v = clampUnit(x, y);
    for (const b of arrows) b.classList.toggle('is-pressed', dirs.has(b.dataset.dir ?? ''));
    cb.axes(v.x, v.y);
  };
  for (const b of arrows) {
    b.addEventListener('pointerdown', (e) => {
      held.set(e.pointerId, b.dataset.dir ?? '');
      emitArrows();
    });
    for (const type of ['pointerup', 'pointercancel', 'pointerleave'] as const) {
      b.addEventListener(type, (e) => {
        if (held.delete(e.pointerId)) emitArrows();
      });
    }
  }

  // ─── Главная кнопка ───
  let mainPointer: number | null = null;
  let lastValue: number | undefined;
  main.addEventListener('pointerdown', (e) => {
    mainPointer = e.pointerId;
    main.setPointerCapture(e.pointerId);
    // Три сигнала сразу: заливка белеет, кнопка сжимается, вспыхивает кольцо (+ вибрация — в main.ts).
    main.classList.remove('is-flash');
    void main.offsetWidth;
    main.classList.add('is-pressed', 'is-flash');
    cb.button(true);
  });
  for (const type of ['pointerup', 'pointercancel'] as const) {
    main.addEventListener(type, (e) => {
      if (e.pointerId !== mainPointer) return;
      mainPointer = null;
      main.classList.remove('is-pressed');
      cb.button(false);
    });
  }

  pauseBtn.addEventListener('click', () => cb.pause());
  settingsBtn.addEventListener('click', () => cb.settings());
  recal.addEventListener('click', () => cb.recalibrate());

  const release = (): void => {
    if (stickPointer !== null) releaseStick();
    held.clear();
    for (const b of arrows) b.classList.remove('is-pressed');
    if (mainPointer !== null) {
      mainPointer = null;
      main.classList.remove('is-pressed');
      cb.button(false);
    }
    cb.axes(0, 0);
  };

  return {
    el: root,
    notice,
    setView(next) {
      const modeChanged = next.mode !== view.mode;
      view = next;
      root.dataset.mode = next.mode;
      stick.hidden = next.mode !== 'joystick';
      dpad.hidden = next.mode !== 'arrows';
      tilt.hidden = next.mode !== 'gyro';
      recal.hidden = next.mode !== 'gyro';
      main.hidden = !next.mainButton;
      pauseBtn.classList.toggle('is-empty', !next.leader);
      root.classList.toggle('pad--muted', next.muted);
      root.classList.toggle('pad--paused', next.paused);
      if (modeChanged || next.muted || next.paused) release();
    },
    setProfile(nick, color) {
      root.style.setProperty('--player', color);
      plateAvatar.textContent = nick.slice(0, 1).toUpperCase();
      plateNick.textContent = nick;
    },
    setMainButton(state) {
      const value = state?.value;
      // Число выросло (например, добавился патрон) — короткая вспышка кольца; на нуле кнопка серая.
      if (value !== undefined && lastValue !== undefined && value > lastValue) {
        main.classList.remove('is-flash');
        void main.offsetWidth;
        main.classList.add('is-flash');
      }
      lastValue = value;
      main.classList.toggle('is-empty', value === 0 || state?.off === true);
      main.classList.toggle('is-off', state?.off === true);
      mainValue.textContent = value === undefined ? '' : String(value);
      const progress = state?.progress;
      main.classList.toggle('has-ring', progress !== undefined);
      main.style.setProperty('--progress', String(progress ?? 1));
    },
    setTilt(x, y) {
      tilt.style.setProperty('--tx', x.toFixed(3));
      tilt.style.setProperty('--ty', y.toFixed(3));
    },
    release,
  };
}
