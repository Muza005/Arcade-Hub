// Меню настроек телефона (§10): на весь экран, изменения применяются сразу.
// Настройки не ставят игру на паузу — это не убежище.
import { NICK_MAX_LEN, PLAYER_COLORS } from '../shared/config';
import { t, type I18nKey } from '../shared/i18n';
import type { ControlMode, LobbyPanel, LobbyValue, PhoneField, SlotMsg } from '../shared/protocol';
import { defaultPrefs, type Prefs, type Sensitivity } from './prefs';
import { button, el } from './ui';

export interface SettingsContext {
  slot: SlotMsg;
  /** Какие виды управления можно выбрать сейчас. */
  modes: ControlMode[];
  gyroAvailable: boolean;
  warning?: string;
  prefs: Prefs;
  /** Открыто лобби игры с полями игрока (например, корпус) — выбираются здесь, в профиле. */
  lobby?: LobbyPanel;
}

export interface SettingsCallbacks {
  prefs(next: Prefs): void;
  profile(nick: string, color: string): void;
  recalibrate(): void;
  handoff(targetId: number): void;
  /** Выбор поля игрока из лобби. */
  lobbyField(key: string, value: LobbyValue): void;
  close(): void;
}

export interface Settings {
  readonly el: HTMLElement;
  readonly open: boolean;
  show(ctx: SettingsContext): void;
  /** Обновить, если открыто (пришёл новый слот, изменилась игра). */
  update(ctx: SettingsContext): void;
  hide(): void;
}

const MODES: ControlMode[] = ['arrows', 'gyro', 'joystick'];
const SENS: Sensitivity[] = ['low', 'mid', 'high'];

function segmented<T extends string>(
  options: readonly T[],
  current: T,
  label: (v: T) => string,
  pick: (v: T) => void,
  disabled: (v: T) => boolean = () => false,
): HTMLElement {
  const group = el('div', 'seg');
  group.setAttribute('role', 'radiogroup');
  for (const option of options) {
    const b = button('seg__opt', label(option));
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(option === current));
    b.disabled = disabled(option);
    b.addEventListener('click', () => pick(option));
    group.append(b);
  }
  return group;
}

function toggle(text: string, on: boolean, flip: () => void): HTMLElement {
  const b = button('toggle', text);
  b.setAttribute('role', 'switch');
  b.setAttribute('aria-checked', String(on));
  b.addEventListener('click', flip);
  return b;
}

function row(title: string, ...content: HTMLElement[]): HTMLElement {
  const section = el('section', 'set-row');
  section.append(el('h2', 'set-row__title', title), ...content);
  return section;
}

/** Ряды вариантов по группам (формы корпуса одного вида — в одном ряду). */
function groupsOf(options: NonNullable<PhoneField['options']>): NonNullable<PhoneField['options']>[] {
  const rows = new Map<string, NonNullable<PhoneField['options']>>();
  for (const o of options) {
    const key = o.group ?? '';
    const r = rows.get(key);
    if (r) r.push(o);
    else rows.set(key, [o]);
  }
  return [...rows.values()];
}

export function createSettings(cb: SettingsCallbacks): Settings {
  const root = el('div', 'settings');
  root.hidden = true;
  let ctx: SettingsContext | null = null;
  let view: 'main' | 'profile' | 'handoff' = 'main';

  const setPrefs = (patch: Partial<Prefs>): void => {
    if (!ctx) return;
    ctx.prefs = { ...ctx.prefs, ...patch };
    cb.prefs(ctx.prefs);
    render();
  };

  const header = (title: string, back?: () => void): HTMLElement => {
    const head = el('header', 'settings__head');
    if (back) {
      const b = button('settings__back', '←', t('ctrl.back'));
      b.addEventListener('click', back);
      head.append(b);
    }
    head.append(el('h1', 'title', title));
    return head;
  };

  /** Поля игрока из лобби: варианты с иконками — сеткой по группам, остальные — кнопками. */
  const lobbyRows = (panel: LobbyPanel): HTMLElement[] =>
    panel.fields.map((field) => {
      const value = panel.values[field.key];
      const pick = (v: LobbyValue): void => {
        panel.values = { ...panel.values, [field.key]: v };
        cb.lobbyField(field.key, v);
        render();
      };
      if (field.kind === 'toggle') return toggle(field.label, value === true, () => pick(value !== true));
      const options = field.options ?? [];
      const withIcons = options.some((o) => o.icon);
      const rows = groupsOf(options).map((group) => {
        const line = el('div', withIcons ? 'hulls' : 'seg');
        line.setAttribute('role', 'radiogroup');
        for (const o of group) {
          const b = button(withIcons ? 'hull' : 'seg__opt', withIcons ? undefined : o.label, o.label);
          if (withIcons && o.icon) b.innerHTML = o.icon;
          b.setAttribute('role', 'radio');
          b.setAttribute('aria-checked', String(o.value === value));
          b.addEventListener('click', () => pick(o.value));
          line.append(b);
        }
        return line;
      });
      return row(field.label, ...rows);
    });

  const renderProfile = ({ slot, lobby }: SettingsContext): HTMLElement[] => {
    const nick = el('input', 'nick');
    nick.maxLength = NICK_MAX_LEN;
    nick.value = slot.nick;
    nick.autocomplete = 'off';
    nick.enterKeyHint = 'done';
    nick.setAttribute('aria-label', t('ctrl.nick'));
    nick.addEventListener('change', () => cb.profile(nick.value, slot.color));
    nick.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') nick.blur();
    });
    const colors = el('div', 'colors');
    const taken = new Set(slot.taken);
    for (const color of PLAYER_COLORS) {
      const b = button('color', undefined, color);
      b.style.setProperty('--c', color);
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(color === slot.color));
      b.disabled = taken.has(color);
      b.addEventListener('click', () => cb.profile(nick.value || slot.nick, color));
      colors.append(b);
    }
    return [
      header(t('ctrl.nick'), () => ((view = 'main'), render())),
      nick,
      ...(lobby ? lobbyRows(lobby) : []),
      row(t('ctrl.color'), colors),
    ];
  };

  const renderHandoff = ({ slot }: SettingsContext): HTMLElement[] => {
    const list = el('div', 'handoff');
    for (const player of slot.roster.filter((p) => p.id !== slot.id && p.online)) {
      const b = button('handoff__player');
      const avatar = el('span', 'plate__avatar', player.nick.slice(0, 1).toUpperCase());
      avatar.style.background = player.color;
      b.append(avatar, el('span', '', player.nick));
      b.addEventListener('click', () => {
        cb.handoff(player.id);
        view = 'main';
        render();
      });
      list.append(b);
    }
    return [header(t('ctrl.handoff'), () => ((view = 'main'), render())), list];
  };

  const renderMain = (c: SettingsContext): HTMLElement[] => {
    const { slot, prefs } = c;
    const parts: HTMLElement[] = [header(t('ctrl.settings'))];
    if (c.warning) parts.push(el('p', 'warning', c.warning));

    const who = button('who');
    const avatar = el('span', 'plate__avatar', slot.nick.slice(0, 1).toUpperCase());
    // Выбранный в лобби вариант с иконкой (например, корпус) — вместо буквы: видно, что его меняют здесь.
    const chosen = c.lobby?.fields
      .map((f) => f.options?.find((o) => o.value === c.lobby?.values[f.key])?.icon)
      .find((i) => i !== undefined);
    if (chosen) {
      avatar.textContent = '';
      avatar.classList.add('plate__avatar--icon');
      avatar.innerHTML = chosen;
    }
    who.append(avatar, el('span', 'who__nick', slot.nick), el('span', 'who__edit', '›'));
    who.addEventListener('click', () => ((view = 'profile'), render()));
    parts.push(who);

    const mode = c.modes.includes(prefs.mode) ? prefs.mode : (c.modes[0] ?? 'joystick');
    const modeLabel = (m: ControlMode): string => t(`ctrl.mode.${m}` as I18nKey);
    parts.push(
      row(
        t('ctrl.control'),
        segmented(
          MODES.filter((m) => c.modes.includes(m)),
          mode,
          modeLabel,
          (m) => setPrefs({ mode: m }),
          (m) => m === 'gyro' && !c.gyroAvailable,
        ),
      ),
    );
    // У стрелок нет аналоговой оси — чувствительность им не нужна.
    if (mode !== 'arrows') {
      parts.push(
        row(
          t('ctrl.sensitivity', { mode: modeLabel(mode) }),
          segmented(
            SENS,
            prefs.sensitivity[mode],
            (s) => t(`ctrl.sens.${s}` as I18nKey),
            (s) => setPrefs({ sensitivity: { ...prefs.sensitivity, [mode]: s } }),
          ),
        ),
      );
    }
    if (mode === 'gyro') {
      const recal = button('btn btn--ghost', t('ctrl.recalibrate'));
      recal.addEventListener('click', () => cb.recalibrate());
      parts.push(
        recal,
        toggle(t('ctrl.invertX'), prefs.invertX, () => setPrefs({ invertX: !prefs.invertX })),
        toggle(t('ctrl.invertY'), prefs.invertY, () => setPrefs({ invertY: !prefs.invertY })),
      );
    }
    parts.push(
      row(
        t('ctrl.hand'),
        segmented(
          ['right', 'left'] as const,
          prefs.hand,
          (h) => t(`ctrl.hand.${h}` as I18nKey),
          (h) => setPrefs({ hand: h }),
        ),
      ),
      toggle(t('ctrl.vibration'), prefs.vibration, () => setPrefs({ vibration: !prefs.vibration })),
    );
    if (slot.role === 'leader') {
      const handoff = button('btn btn--ghost', t('ctrl.handoff'));
      handoff.disabled = !slot.roster.some((p) => p.id !== slot.id && p.online);
      handoff.addEventListener('click', () => ((view = 'handoff'), render()));
      parts.push(handoff);
    }

    const foot = el('footer', 'settings__foot');
    const reset = button('link', t('ctrl.resetAll'));
    reset.addEventListener('click', () => setPrefs(defaultPrefs()));
    const done = button('done', '✓', t('ctrl.done'));
    done.addEventListener('click', () => cb.close());
    foot.append(reset, done);
    parts.push(foot);
    return parts;
  };

  const render = (): void => {
    if (!ctx) return;
    root.style.setProperty('--player', ctx.slot.color);
    const body =
      view === 'profile' ? renderProfile(ctx) : view === 'handoff' ? renderHandoff(ctx) : renderMain(ctx);
    // Не перерисовываем поле ника, пока его редактируют.
    if (view === 'profile' && root.contains(document.activeElement) && document.activeElement?.tagName === 'INPUT') {
      return;
    }
    root.replaceChildren(...body);
  };

  return {
    el: root,
    get open() {
      return !root.hidden;
    },
    show(next) {
      ctx = next;
      view = 'main';
      root.hidden = false;
      render();
    },
    update(next) {
      if (root.hidden) return;
      ctx = next;
      render();
    },
    hide() {
      root.hidden = true;
      root.replaceChildren();
    },
  };
}
