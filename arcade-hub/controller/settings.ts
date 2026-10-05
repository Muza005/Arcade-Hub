// Меню настроек телефона (§10): на весь экран, изменения применяются сразу.
// Настройки не ставят игру на паузу — это не убежище.
import { NICK_MAX_LEN, PLAYER_COLORS, SENS_COLORS } from '../shared/config';
import { t, type I18nKey } from '../shared/i18n';
import type { ControlMode, LobbyPanel, LobbyValue, PhoneField, SlotMsg } from '../shared/protocol';
import { HAND_ICONS, MODE_ICONS, SENS_ICONS } from './icons';
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

const MODES: ControlMode[] = ['joystick', 'gyro'];
const SENS: Sensitivity[] = ['low', 'mid', 'high'];

/** Крупные квадраты: иконка и подпись под ней (вид управления, рука). */
function tiles<T extends string>(
  options: readonly T[],
  current: T,
  icon: (v: T) => string,
  label: (v: T) => string,
  pick: (v: T) => void,
  disabled: (v: T) => boolean = () => false,
): HTMLElement {
  const group = el('div', 'tiles');
  group.setAttribute('role', 'radiogroup');
  for (const option of options) {
    const b = button('tile');
    b.innerHTML = icon(option);
    b.append(el('span', 'tile__label', label(option)));
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

  /** Профиль — черновиком (макет заказчика): применяется по «Сохранить», «Отмена» — без изменений. */
  let draft: { nick: string; color: string; values: Record<string, LobbyValue> } | null = null;
  const openProfile = (c: SettingsContext): void => {
    draft = { nick: c.slot.nick, color: c.slot.color, values: { ...(c.lobby?.values ?? {}) } };
    view = 'profile';
    render();
  };
  const closeProfile = (): void => {
    draft = null;
    view = 'main';
    render();
  };

  const renderProfile = (c: SettingsContext): HTMLElement[] => {
    const { slot, lobby } = c;
    const d = draft ?? { nick: slot.nick, color: slot.color, values: { ...(lobby?.values ?? {}) } };
    draft = d;
    const root = el('div', 'profile');
    root.style.setProperty('--player', d.color);

    // Превью: выбранный вариант с иконкой (корпус) крупно в цвете игрока; иначе — буква ника.
    const iconField = lobby?.fields.find((f) => f.options?.some((o) => o.icon));
    const chosen = iconField?.options?.find((o) => o.value === d.values[iconField.key]);
    const art = el('div', 'profile__art');
    if (chosen?.icon) art.innerHTML = chosen.icon;
    else art.append(el('span', 'profile__letter', (d.nick || slot.nick).slice(0, 1).toUpperCase()));
    const caption = chosen ? [chosen.groupLabel, `«${chosen.label}»`].filter(Boolean).join(' · ') : '';
    const nick = el('input', 'nick profile__nick');
    nick.maxLength = NICK_MAX_LEN;
    nick.value = d.nick;
    nick.autocomplete = 'off';
    nick.enterKeyHint = 'done';
    nick.setAttribute('aria-label', t('ctrl.nick'));
    nick.addEventListener('input', () => (d.nick = nick.value));
    nick.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') nick.blur();
    });
    const card = el('section', 'profile__card');
    const who = el('div', 'profile__who');
    if (caption) who.append(el('p', 'profile__caption', caption));
    who.append(nick);
    card.append(art, who);

    // Поля игрока: варианты с иконками — рядами по разделам, остальные — кнопками.
    const fields = el('div', 'profile__fields');
    for (const field of lobby?.fields ?? []) {
      const value = d.values[field.key];
      const pick = (v: LobbyValue): void => {
        d.values = { ...d.values, [field.key]: v };
        render();
      };
      if (field.kind === 'toggle') {
        fields.append(toggle(field.label, value === true, () => pick(value !== true)));
        continue;
      }
      const options = field.options ?? [];
      const withIcons = options.some((o) => o.icon);
      for (const group of groupsOf(options)) {
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
        fields.append(line);
      }
    }

    const colors = el('div', 'colors');
    const taken = new Set(slot.taken);
    for (const color of PLAYER_COLORS) {
      const b = button('color', undefined, color);
      b.style.setProperty('--c', color);
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(color === d.color));
      b.disabled = taken.has(color) && color !== slot.color;
      b.addEventListener('click', () => {
        d.color = color;
        render();
      });
      colors.append(b);
    }
    const colorBlock = el('section', 'profile__colors');
    colorBlock.append(el('h2', 'set-row__title', t('ctrl.color')), colors);

    const save = button('profile__save', t('lobby.save'));
    save.addEventListener('click', () => {
      const name = d.nick.trim() || slot.nick;
      if (name !== slot.nick || d.color !== slot.color) cb.profile(name, d.color);
      for (const [key, v] of Object.entries(d.values)) if (lobby && lobby.values[key] !== v) cb.lobbyField(key, v);
      if (lobby) lobby.values = { ...d.values };
      closeProfile();
    });
    const cancel = button('profile__cancel', t('lobby.cancel'));
    cancel.addEventListener('click', closeProfile);
    const buttons = el('div', 'profile__buttons');
    buttons.append(cancel, save);

    root.append(card, fields, colorBlock, buttons);
    return [root];
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
    who.addEventListener('click', () => openProfile(c));
    parts.push(who);

    const mode = c.modes.includes(prefs.mode) ? prefs.mode : (c.modes[0] ?? 'joystick');
    // Чувствительность — одной строкой над управлением: цветные полоски, своя у каждого вида.
    const sens = el('section', 'sens');
    const sensOptions = el('div', 'sens__opts');
    sensOptions.setAttribute('role', 'radiogroup');
    for (const s of SENS) {
      const b = button('sens__opt', undefined, t(`ctrl.sens.${s}` as I18nKey));
      b.innerHTML = SENS_ICONS[s];
      b.style.setProperty('--opt', SENS_COLORS[s]);
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(s === prefs.sensitivity[mode]));
      b.addEventListener('click', () => setPrefs({ sensitivity: { ...prefs.sensitivity, [mode]: s } }));
      sensOptions.append(b);
    }
    sens.append(el('h2', 'set-row__title', t('ctrl.sensitivity')), sensOptions);
    parts.push(
      sens,
      row(
        t('ctrl.control'),
        tiles(
          MODES.filter((m) => c.modes.includes(m)),
          mode,
          (m) => MODE_ICONS[m],
          (m) => t(`ctrl.mode.${m}` as I18nKey),
          (m) => setPrefs({ mode: m }),
          (m) => m === 'gyro' && !c.gyroAvailable,
        ),
      ),
    );
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
        tiles(
          ['right', 'left'] as const,
          prefs.hand,
          (h) => HAND_ICONS[h],
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
      draft = null;
      root.hidden = true;
      root.replaceChildren();
    },
  };
}
