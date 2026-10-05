// Лобби (ARCADE_HUB_SPEC §11): одно на все игры. Игроки комнаты, клавиатурные слоты, боты,
// режим и настройки матча по схеме игры. Старт — у ведущего (или с клавиатуры у экрана).
import type { KeyboardScheme } from '../../engine/input';
import { LOBBY_SELECT_CHIPS_MAX, MAX_KEYBOARD_PLAYERS } from '../../shared/config';
import type { GameManifest, GamePlayer, LobbyField, LobbyState, MatchSettings } from '../../shared/game-manifest';
import { createTranslator, t, tn } from '../../shared/i18n';
import type { LobbyPanel, LobbyValue } from '../../shared/protocol';
import type { Room } from '../room';
import { h, icon } from '../ui/dom';
import { BACK_EVENT } from '../ui/focus';
import { ICONS } from '../ui/icons';
import { defaults, sanitize, stepValue, validValue, type FieldValues } from './fields';
import { createProfileEditor } from './profile-editor';
import { buildRoster, type KeyboardProfile, type RosterEntry } from './roster';

export interface LobbyStart {
  game: GameManifest;
  players: GamePlayer[];
  keyboard: ReadonlyMap<string, KeyboardScheme>;
  mode: string;
  settings: MatchSettings;
  /** Играть по сиду дня (§12): один расклад на день у всех. */
  daily: boolean;
}

export interface Lobby {
  readonly el: HTMLElement;
  readonly game: GameManifest | null;
  open(game: GameManifest): void;
  /** Показать снова (после матча) с фокусом на «Старт». */
  show(): void;
  /** Тот же состав и настройки для «Ещё раз»; null — игроков стало меньше минимума. */
  restart(): LobbyStart | null;
  hide(): void;
  setRoom(room: Room): void;
  /** Поля игрока для его телефона; нет лобби или полей — undefined. */
  panelFor(playerId: string): LobbyPanel | undefined;
  /** Выбор с телефона: неизвестное поле или значение не принимается. */
  setPlayerField(playerId: string, key: string, value: unknown): void;
}

const SCHEMES: readonly KeyboardScheme[] = ['wasd', 'arrows'];
/** Клавиша, которой клавиатурный игрок входит в лобби (§11). */
const JOIN_KEYS: Record<string, KeyboardScheme> = { KeyW: 'wasd', ArrowUp: 'arrows' };
const STORE_PREFIX = 'arcade-hub:lobby:';

interface Saved {
  mode?: string;
  settings?: unknown;
  daily?: boolean;
}

function loadSaved(gameId: string): Saved {
  try {
    return (JSON.parse(localStorage.getItem(STORE_PREFIX + gameId) ?? '{}') as Saved) ?? {};
  } catch {
    return {};
  }
}

function save(gameId: string, value: Saved): void {
  try {
    localStorage.setItem(STORE_PREFIX + gameId, JSON.stringify(value));
  } catch {
    // без хранилища настройки живут до перезагрузки
  }
}

export interface LobbyOptions {
  onStart(start: LobbyStart): void;
  onBack(game: GameManifest): void;
  /** Поля игроков или состав поменялись — телефонам пора обновить панель. */
  onFieldsChange?(): void;
  /** Выбран режим, где цвет — команда (или другой): комната разрешает одинаковые цвета. */
  onSharedColors?(on: boolean): void;
}

export function createLobby(options: LobbyOptions): Lobby {
  const el = h('main', { class: 'lobby', 'data-focus-scope': true, hidden: true });
  let game: GameManifest | null = null;
  let room: Room = { code: null, players: [] };
  let keyboard: KeyboardScheme[] = [];
  let bots = 0;
  let mode = '';
  let settings: FieldValues = {};
  let daily = false;
  const playerFields = new Map<string, FieldValues>();
  /** Свой ник и цвет клавиатурных игроков (окно профиля). */
  const profiles = new Map<KeyboardScheme, KeyboardProfile>();
  /** Телефоны, убранные из этого матча: в комнате остаются, могут вернуться. */
  const benched = new Set<string>();
  const editor = createProfileEditor();
  /** Перерисовываемая часть; окно профиля живёт рядом и перерисовкой не закрывается. */
  const content = h('div', { class: 'lobby__content' });
  el.append(content, editor.el);
  /** Фокус ушёл с «Старт» только потому, что он был неактивен, — вернуть, как только станет можно. */
  let startPending = false;

  const schema = (): { settings: LobbyField[]; playerFields: LobbyField[] } => ({
    settings: game?.lobby?.settings ?? [],
    playerFields: game?.lobby?.playerFields ?? [],
  });
  const tg = (key: string): string => (game ? createTranslator(game.strings)(key) : key);
  const sharedMode = (): boolean => game?.modes.find((m) => m.id === mode)?.sharedColors === true;

  const roster = () =>
    buildRoster({
      phones: room.players,
      keyboard,
      profiles,
      benched,
      sharedColors: sharedMode(),
      bots,
      players: game?.players ?? { min: 1, max: 1 },
      names: {
        player: (n) => t('player.default', { n }),
        bot: (n) => t('lobby.bot', { n }),
      },
    });

  const persist = (): void => {
    if (game) save(game.id, { mode, settings, daily });
  };

  const makeStart = (): LobbyStart | null => {
    const now = roster();
    if (!game || now.missing > 0) return null;
    return {
      game,
      players: now.playing.map((p) => ({
        id: p.id,
        nick: p.nick,
        color: p.color,
        kind: p.kind,
        ...(schema().playerFields.length ? { fields: { ...valuesOf(p) } } : {}),
      })),
      keyboard: new Map(now.playing.filter((p) => p.scheme).map((p) => [p.id, p.scheme as KeyboardScheme])),
      mode,
      settings: { ...settings },
      daily,
    };
  };

  const valuesOf = (entry: RosterEntry): FieldValues => {
    let values = playerFields.get(entry.id);
    if (!values) {
      values = defaults(schema().playerFields);
      playerFields.set(entry.id, values);
    }
    return values;
  };

  // ─── Разметка ───

  /** Кнопка с ключом фокуса: после перерисовки фокус возвращается на ту же кнопку. */
  const btn = (key: string, className: string, label: string, onClick: () => void, extra: Record<string, string | boolean> = {}) => {
    const b = h('button', { class: className, type: 'button', 'data-focus-key': key, ...extra }, label);
    b.addEventListener('click', onClick);
    return b;
  };

  const valueLabel = (field: LobbyField, value: LobbyValue): string => {
    if (field.kind === 'select') {
      const option = field.options.find((o) => o.value === value);
      return option ? tg(option.label) : String(value);
    }
    return String(value);
  };

  /** Поле настроек; погашенное (on = false) — без смысла сейчас: кнопки неактивны, значение остаётся. */
  const fieldControl = (scope: string, field: LobbyField, value: LobbyValue, set: (v: LobbyValue) => void, on = true): HTMLElement => {
    const key = `${scope}:${field.key}`;
    const off = on ? {} : { disabled: true };
    const name = (): HTMLElement[] => [
      ...(field.icon ? [icon(field.icon, 'field__icon')] : []),
      h('span', { class: 'field__name' }, tg(field.label)),
    ];
    const wrap = (...children: Array<HTMLElement | false>): HTMLElement => h('div', { class: `field${on ? '' : ' field--off'}` }, ...children);
    if (field.kind === 'toggle') {
      const b = btn(key, 'field field--toggle', '', () => set(stepValue(field, value, 1)), {
        role: 'switch',
        'aria-checked': String(value === true),
        ...off,
      });
      b.append(...name());
      return b;
    }
    if (field.kind === 'select' && field.options.length <= LOBBY_SELECT_CHIPS_MAX) {
      // Варианты с иконками — цветные кнопки без текста; название выбранного — в строке поля, его цветом.
      const iconic = field.options.every((o) => o.icon);
      const chosen = field.options.find((o) => o.value === value);
      return wrap(
        h(
          'span',
          { class: 'field__label' },
          ...name(),
          iconic && chosen && h('span', { class: 'field__current', style: chosen.color ? `color: ${chosen.color}` : undefined }, tg(chosen.label)),
        ),
        h(
          'div',
          { class: `field__options${iconic ? ' field__options--icons' : ''}`, role: 'radiogroup' },
          ...field.options.map((o) => {
            const b = btn(`${key}=${o.value}`, 'field__option', iconic ? '' : tg(o.label), () => set(o.value), {
              role: 'radio',
              'aria-checked': String(o.value === value),
              ...(iconic ? { 'aria-label': tg(o.label), title: tg(o.label) } : {}),
              ...(o.color ? { style: `--opt: ${o.color}` } : {}),
              ...off,
            });
            if (iconic && o.icon) b.append(icon(o.icon, 'field__option-icon'));
            return b;
          }),
        ),
      );
    }
    return wrap(
      h('span', { class: 'field__label' }, ...name()),
      h(
        'div',
        { class: 'field__slider' },
        btn(`${key}:-`, 'field__step', '−', () => set(stepValue(field, value, -1)), { 'aria-label': '−', ...off }),
        h('span', { class: 'field__value' }, valueLabel(field, value)),
        btn(`${key}:+`, 'field__step', '+', () => set(stepValue(field, value, 1)), { 'aria-label': '+', ...off }),
      ),
    );
  };

  /** Иконка выбранного варианта (например, корпус) — вместо буквы в аватаре. */
  const iconOf = (entry: RosterEntry): string | undefined => {
    for (const f of schema().playerFields) {
      if (f.kind !== 'select') continue;
      const value = valuesOf(entry)[f.key] ?? f.default;
      const found = f.options.find((o) => o.value === value)?.icon;
      if (found) return found;
    }
    return undefined;
  };

  /** Ник, поля игрока и цвет клавиатурного игрока — окном на большом экране (у телефона — в его настройках). */
  const editProfile = (entry: RosterEntry): void => {
    const scheme = entry.scheme;
    if (!scheme) return;
    const others = roster().playing.filter((p) => p.id !== entry.id && p.kind !== 'bot');
    const custom = profiles.get(scheme)?.nick;
    editor.open({
      draft: { nick: custom ?? '', color: entry.color, fields: { ...valuesOf(entry) } },
      defaultNick: custom ? '' : entry.nick,
      fields: schema().playerFields,
      // «Цвет — команда»: можно взять цвет товарища.
      taken: new Set(sharedMode() ? [] : others.map((p) => p.color)),
      label: tg,
      save: (draft) => {
        profiles.set(scheme, { ...(draft.nick ? { nick: draft.nick } : {}), color: draft.color });
        for (const f of schema().playerFields) {
          const v = draft.fields[f.key];
          if (v !== undefined) valuesOf(entry)[f.key] = validValue(f, v);
        }
        render();
      },
    });
  };

  /** «Цвет — команда»: товарищи рядом, в порядке появления команды. */
  const byTeam = (list: readonly RosterEntry[]): RosterEntry[] => {
    const order = [...new Set(list.map((p) => p.color))];
    return [...list].sort((a, b) => order.indexOf(a.color) - order.indexOf(b.color));
  };

  const card = (entry: RosterEntry, state: 'playing' | 'waiting' | 'benched'): HTMLElement => {
    const hullIcon = entry.kind === 'bot' ? undefined : iconOf(entry);
    const avatar = h('span', { class: `lcard__avatar${hullIcon ? ' lcard__avatar--icon' : ''}` });
    if (hullIcon) avatar.innerHTML = hullIcon;
    else avatar.append(entry.kind === 'bot' ? icon(ICONS.gamepad) : entry.nick.slice(0, 1).toUpperCase());
    if (entry.leader) avatar.append(icon(ICONS.crown, 'lcard__crown'));
    // Под ником — чем играет: схема клавиш или телефон-джойстик (§11).
    const sub =
      entry.kind === 'keyboard'
        ? h('span', { class: 'lcard__sub lcard__sub--keys' }, t(entry.scheme === 'arrows' ? 'lobby.keys.arrows' : 'lobby.keys.wasd'))
        : entry.kind === 'phone'
          ? h('span', { class: 'lcard__sub' }, icon(ICONS.gamepad), t('lobby.phone'))
          : null;
    const remove = (): void => {
      if (entry.kind === 'keyboard' && entry.scheme) keyboard = keyboard.filter((s) => s !== entry.scheme);
      else if (entry.kind === 'phone') benched.add(entry.id);
      else bots = Math.max(0, bots - 1);
      render();
    };
    return h(
      'li',
      {
        class: `lcard lcard--${entry.kind}${state === 'playing' ? '' : ' lcard--waiting'}${state === 'playing' && sharedMode() ? ' lcard--team' : ''}`,
        style: `--player: ${entry.color}`,
      },
      entry.kind === 'keyboard' &&
        state === 'playing' &&
        (() => {
          const b = btn(`edit:${entry.id}`, 'lcard__edit', '', () => editProfile(entry), { 'aria-label': t('lobby.edit') });
          b.append(icon(ICONS.pencil));
          return b;
        })(),
      avatar,
      h('span', { class: 'lcard__nick' }, entry.nick),
      sub,
      state === 'benched'
        ? btn(`back:${entry.id}`, 'lcard__remove lcard__remove--back', '+', () => {
            benched.delete(entry.id);
            render();
          }, { 'aria-label': t('lobby.return') })
        : btn(`rm:${entry.id}`, 'lcard__remove', '×', remove, { 'aria-label': t('lobby.remove') }),
    );
  };

  /** Свободные клавиатурные слоты: подсказка клавиши, дальше — погашенные «остальные — с телефона». */
  const keyboardSlots = (): HTMLElement[] => {
    const max = game?.players.keyboardMax ?? 0;
    const slots: HTMLElement[] = [];
    SCHEMES.slice(0, MAX_KEYBOARD_PLAYERS).forEach((scheme, i) => {
      if (keyboard.includes(scheme)) return;
      const allowed = i < max;
      slots.push(
        h(
          'li',
          { class: `lslot${allowed ? '' : ' lslot--off'}` },
          allowed ? t(scheme === 'wasd' ? 'lobby.join.wasd' : 'lobby.join.arrows') : t('lobby.phonesOnly'),
        ),
      );
    });
    // Два погашенных слота подряд — одна подпись.
    return slots.filter((s, i) => !(s.classList.contains('lslot--off') && slots[i - 1]?.classList.contains('lslot--off')));
  };

  const render = (): void => {
    if (!game) return;
    options.onSharedColors?.(sharedMode());
    options.onFieldsChange?.();
    const focusKey = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.focusKey : undefined;
    const current = game;
    const r = roster();
    const { settings: settingFields } = schema();
    const full = r.playing.length >= current.players.max;

    // Режимы — иконками; название выбранного — рядом.
    const chosenMode = current.modes.find((m) => m.id === mode);
    const modes =
      current.modes.length > 1
        ? h(
            'div',
            { class: 'lobby__modes', role: 'radiogroup' },
            chosenMode && h('span', { class: 'lobby__mode-name' }, tg(chosenMode.title)),
            ...current.modes.map((m) => {
              const b = btn(`mode:${m.id}`, 'mode-chip', '', () => {
                mode = m.id; // значения настроек при смене режима не меняются
                persist();
                render();
              }, { role: 'radio', 'aria-checked': String(m.id === mode), 'aria-label': tg(m.title), title: tg(m.title) });
              b.append(h('img', { class: 'mode-chip__icon', src: m.icon, alt: '' }));
              return b;
            }),
          )
        : null;
    /** Для полей, которые имеют смысл не всегда (частота усилений, уровень ботов…). */
    const state: LobbyState = { mode, settings, bots };

    const start = btn('start', 'btn btn--play lobby__start', t('lobby.start'), () => {
      const config = makeStart();
      if (config) options.onStart(config);
    }, { 'data-default-focus': true, disabled: r.missing > 0 });
    const dailyToggle = btn('daily', 'field field--toggle', t('lobby.daily'), () => {
      daily = !daily;
      persist();
      render();
    }, { role: 'switch', 'aria-checked': String(daily) });

    el.style.cssText = `--accent: ${current.accent}`;
    content.replaceChildren(
      h(
        'header',
        { class: 'lobby__head' },
        btn('back', 'btn btn--ghost lobby__back', t('lobby.back'), () => options.onBack(current)),
        h('h1', { class: 'lobby__title' }, tg(current.title)),
        modes,
      ),
      h(
        'div',
        { class: 'lobby__body' },
        h(
          'section',
          { class: 'lobby__players' },
          h('ul', { class: 'lobby__cards' }, ...(sharedMode() ? byTeam(r.playing) : r.playing).map((p) => card(p, 'playing')), ...keyboardSlots()),
          r.waiting.length > 0 &&
            h(
              'div',
              { class: 'lobby__waiting' },
              h('p', { class: 'lobby__note' }, tn('lobby.onlyN', current.players.max)),
              h('ul', { class: 'lobby__cards' }, ...r.waiting.map((p) => card(p, 'waiting'))),
            ),
          r.benched.length > 0 &&
            h(
              'div',
              { class: 'lobby__waiting' },
              h('p', { class: 'lobby__note lobby__note--calm' }, t('lobby.benched')),
              h('ul', { class: 'lobby__cards' }, ...r.benched.map((p) => card(p, 'benched'))),
            ),
        ),
        h(
          'aside',
          { class: 'lobby__side' },
          settingFields.length > 0 &&
            h(
              'section',
              { class: 'lobby__settings' },
              h('h2', { class: 'lobby__label' }, t('lobby.settings')),
              ...settingFields.map((f) =>
                fieldControl(
                  's',
                  f,
                  settings[f.key] ?? f.default,
                  (v) => {
                    settings = { ...settings, [f.key]: v };
                    persist();
                    render();
                  },
                  f.active?.(state) ?? true,
                ),
              ),
              btn('reset', 'link-btn', t('lobby.reset'), () => {
                settings = defaults(settingFields);
                persist();
                render();
              }),
            ),
          h(
            'div',
            { class: 'lobby__actions' },
            dailyToggle,
            current.bots &&
              btn('bot', 'btn btn--ghost', t('lobby.addBot'), () => {
                bots++;
                render();
              }, { disabled: full }),
            r.missing > 0 && h('p', { class: 'lobby__note' }, t('badge.needMore', { n: r.missing })),
            start,
          ),
        ),
      ),
    );
    // Открыто окно профиля — фокус остаётся в нём.
    if (editor.el.open) return;
    if (!start.disabled && startPending) {
      startPending = false;
      start.focus();
      return;
    }
    const again = focusKey ? el.querySelector<HTMLElement>(`[data-focus-key="${CSS.escape(focusKey)}"]:not(:disabled)`) : null;
    if (again) again.focus();
    else if (!start.disabled) start.focus();
    else {
      startPending = true;
      el.querySelector<HTMLElement>('button:not(:disabled)')?.focus();
    }
  };

  /** При входе на экран фокус — на главном действии; если «Старт» пока неактивен — вернётся на него сам. */
  const focusStart = (): void => {
    (document.activeElement as HTMLElement | null)?.blur();
    startPending = true;
    render();
  };

  // W или ↑ добавляют клавиатурного игрока — пока его слот свободен; дальше это обычные клавиши навигации.
  document.addEventListener(
    'keydown',
    (e) => {
      if (el.hidden || !game || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
      // Пока открыто окно профиля или печатают ник — клавиши не добавляют игроков.
      if (editor.el.open || e.target instanceof HTMLInputElement) return;
      const scheme = JOIN_KEYS[e.code];
      if (!scheme || keyboard.includes(scheme)) return;
      if (SCHEMES.indexOf(scheme) >= game.players.keyboardMax) return;
      e.preventDefault();
      e.stopPropagation();
      keyboard = [...keyboard, scheme];
      render();
    },
    true,
  );
  el.addEventListener(BACK_EVENT, () => {
    if (game) options.onBack(game);
  });

  return {
    el,
    get game() {
      return game;
    },
    open(next) {
      if (game?.id !== next.id) {
        keyboard = [];
        bots = 0;
        playerFields.clear();
        benched.clear();
      }
      game = next;
      const saved = loadSaved(next.id);
      mode = next.modes.some((m) => m.id === saved.mode) ? (saved.mode as string) : (next.modes[0]?.id ?? '');
      settings = sanitize(schema().settings, saved.settings);
      daily = saved.daily === true;
      el.hidden = false;
      focusStart();
    },
    show() {
      el.hidden = false;
      focusStart();
    },
    hide() {
      el.hidden = true;
      options.onFieldsChange?.();
    },
    restart: () => makeStart(),
    setRoom(next) {
      room = next;
      if (!el.hidden) render();
    },
    panelFor(playerId) {
      if (el.hidden || !game) return undefined;
      const fields = schema().playerFields.filter((f) => f.kind !== 'slider');
      const entry = roster().playing.find((p) => p.id === playerId);
      if (fields.length === 0 || !entry) return undefined;
      const values = valuesOf(entry);
      return {
        fields: fields.map((f) => ({
          key: f.key,
          label: tg(f.label),
          kind: f.kind === 'toggle' ? 'toggle' : 'select',
          ...(f.kind === 'select'
            ? {
                options: f.options.map((o) => ({
                  value: o.value,
                  label: tg(o.label),
                  ...(o.icon ? { icon: o.icon } : {}),
                  ...(o.group ? { group: o.group } : {}),
                  ...(o.groupLabel ? { groupLabel: tg(o.groupLabel) } : {}),
                })),
              }
            : {}),
        })),
        values: Object.fromEntries(fields.map((f) => [f.key, values[f.key] ?? f.default])),
      };
    },
    setPlayerField(playerId, key, value) {
      if (el.hidden) return;
      const field = schema().playerFields.find((f) => f.key === key);
      const entry = roster().playing.find((p) => p.id === playerId);
      if (!field || !entry) return;
      const next = validValue(field, value);
      if (next !== value) return; // чужое значение не подменяем значением по умолчанию
      valuesOf(entry)[key] = next;
      render();
    },
  };
}
