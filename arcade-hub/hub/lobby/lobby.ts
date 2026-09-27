// Лобби (ARCADE_HUB_SPEC §11): одно на все игры. Игроки комнаты, клавиатурные слоты, боты,
// режим и настройки матча по схеме игры. Старт — у ведущего (или с клавиатуры у экрана).
import type { KeyboardScheme } from '../../engine/input';
import { MAX_KEYBOARD_PLAYERS } from '../../shared/config';
import type { GameManifest, GamePlayer, LobbyField, MatchSettings } from '../../shared/game-manifest';
import { createTranslator, t, tn } from '../../shared/i18n';
import type { LobbyValue } from '../../shared/protocol';
import type { Room } from '../room';
import { h, icon } from '../ui/dom';
import { BACK_EVENT } from '../ui/focus';
import { ICONS } from '../ui/icons';
import { defaults, sanitize, stepValue, type FieldValues } from './fields';
import { buildRoster, type RosterEntry } from './roster';

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

export function createLobby(options: { onStart(start: LobbyStart): void; onBack(game: GameManifest): void }): Lobby {
  const el = h('main', { class: 'lobby', 'data-focus-scope': true, hidden: true });
  let game: GameManifest | null = null;
  let room: Room = { code: null, players: [] };
  let keyboard: KeyboardScheme[] = [];
  let bots = 0;
  let mode = '';
  let settings: FieldValues = {};
  let daily = false;
  const playerFields = new Map<string, FieldValues>();
  /** Фокус ушёл с «Старт» только потому, что он был неактивен, — вернуть, как только станет можно. */
  let startPending = false;

  const schema = (): { settings: LobbyField[]; playerFields: LobbyField[] } => ({
    settings: game?.lobby?.settings ?? [],
    playerFields: game?.lobby?.playerFields ?? [],
  });
  const tg = (key: string): string => (game ? createTranslator(game.strings)(key) : key);

  const roster = () =>
    buildRoster({
      phones: room.players,
      keyboard,
      bots,
      players: game?.players ?? { min: 1, max: 1 },
      names: {
        keyboard: (scheme) => t(scheme === 'wasd' ? 'lobby.kb.wasd' : 'lobby.kb.arrows'),
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

  const fieldControl = (scope: string, field: LobbyField, value: LobbyValue, set: (v: LobbyValue) => void): HTMLElement => {
    const key = `${scope}:${field.key}`;
    if (field.kind === 'toggle') {
      return btn(key, 'field field--toggle', tg(field.label), () => set(stepValue(field, value, 1)), {
        role: 'switch',
        'aria-checked': String(value === true),
      });
    }
    if (field.kind === 'select') {
      return h(
        'div',
        { class: 'field' },
        h('span', { class: 'field__label' }, tg(field.label)),
        h(
          'div',
          { class: 'field__options', role: 'radiogroup' },
          ...field.options.map((o) =>
            btn(`${key}=${o.value}`, 'field__option', tg(o.label), () => set(o.value), {
              role: 'radio',
              'aria-checked': String(o.value === value),
            }),
          ),
        ),
      );
    }
    return h(
      'div',
      { class: 'field' },
      h('span', { class: 'field__label' }, tg(field.label)),
      h(
        'div',
        { class: 'field__slider' },
        btn(`${key}:-`, 'field__step', '−', () => set(stepValue(field, value, -1)), { 'aria-label': '−' }),
        h('span', { class: 'field__value' }, valueLabel(field, value)),
        btn(`${key}:+`, 'field__step', '+', () => set(stepValue(field, value, 1)), { 'aria-label': '+' }),
      ),
    );
  };

  const card = (entry: RosterEntry, playing: boolean): HTMLElement => {
    const removable = entry.kind === 'keyboard' || entry.kind === 'bot';
    // Под клавиатурным игроком — схема клавиш (§11).
    const sub = entry.kind === 'keyboard' ? t(entry.scheme === 'arrows' ? 'lobby.keys.arrows' : 'lobby.keys.wasd') : '';
    const fields = playing
      ? schema().playerFields.map((f) =>
          fieldControl(`p:${entry.id}`, f, valuesOf(entry)[f.key] ?? f.default, (v) => {
            valuesOf(entry)[f.key] = v;
            render();
          }),
        )
      : [];
    return h(
      'li',
      { class: `lcard lcard--${entry.kind}${playing ? '' : ' lcard--waiting'}`, style: `--player: ${entry.color}` },
      h(
        'span',
        { class: 'lcard__avatar' },
        entry.kind === 'bot' ? icon(ICONS.gamepad) : entry.nick.slice(0, 1).toUpperCase(),
        entry.leader && icon(ICONS.crown, 'lcard__crown'),
      ),
      h('span', { class: 'lcard__nick' }, entry.nick),
      sub && h('span', { class: 'lcard__sub' }, sub),
      ...fields,
      removable &&
        btn(`rm:${entry.id}`, 'lcard__remove', '×', () => {
          if (entry.kind === 'keyboard' && entry.scheme) keyboard = keyboard.filter((s) => s !== entry.scheme);
          else bots = Math.max(0, bots - 1);
          render();
        }, { 'aria-label': t('lobby.remove') }),
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
    const focusKey = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.focusKey : undefined;
    const current = game;
    const r = roster();
    const { settings: settingFields } = schema();
    const full = r.playing.length >= current.players.max;

    const modes =
      current.modes.length > 1
        ? h(
            'div',
            { class: 'lobby__modes', role: 'radiogroup' },
            ...current.modes.map((m) =>
              btn(`mode:${m.id}`, 'mode-chip', tg(m.title), () => {
                mode = m.id; // значения настроек при смене режима не меняются
                persist();
                render();
              }, { role: 'radio', 'aria-checked': String(m.id === mode) }),
            ),
          )
        : null;

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
    el.replaceChildren(
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
          h('ul', { class: 'lobby__cards' }, ...r.playing.map((p) => card(p, true)), ...keyboardSlots()),
          r.waiting.length > 0 &&
            h(
              'div',
              { class: 'lobby__waiting' },
              h('p', { class: 'lobby__note' }, tn('lobby.onlyN', current.players.max)),
              h('ul', { class: 'lobby__cards' }, ...r.waiting.map((p) => card(p, false))),
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
                fieldControl('s', f, settings[f.key] ?? f.default, (v) => {
                  settings = { ...settings, [f.key]: v };
                  persist();
                  render();
                }),
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
    },
    restart: () => makeStart(),
    setRoom(next) {
      room = next;
      if (!el.hidden) render();
    },
  };
}
