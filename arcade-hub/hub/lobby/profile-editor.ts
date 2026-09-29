// Профиль клавиатурного игрока в лобби (§11): ник, поля игрока из схемы игры и цвет.
// Телефон меняет то же самое у себя в настройках; этим окном пользуются игроки у экрана.
// Варианты с иконками (например, формы корпуса) — сеткой иконок по группам.
import { NICK_MAX_LEN, PLAYER_COLORS } from '../../shared/config';
import type { LobbyField } from '../../shared/game-manifest';
import { t } from '../../shared/i18n';
import type { LobbyValue } from '../../shared/protocol';
import { h, icon } from '../ui/dom';
import { BACK_EVENT } from '../ui/focus';
import { ICONS } from '../ui/icons';

export interface ProfileDraft {
  nick: string;
  color: string;
  fields: Record<string, LobbyValue>;
}

export interface ProfileEditorInput {
  draft: ProfileDraft;
  /** Ник по умолчанию: пустое поле ника возвращает его. */
  defaultNick: string;
  fields: readonly LobbyField[];
  /** Цвета других игроков — недоступны. */
  taken: ReadonlySet<string>;
  label(key: string): string;
  save(draft: ProfileDraft): void;
}

export interface ProfileEditor {
  readonly el: HTMLDialogElement;
  open(input: ProfileEditorInput): void;
}

/** Ряды вариантов: по группам в порядке появления. */
function groupsOf<T extends { group?: string }>(options: readonly T[]): T[][] {
  const rows = new Map<string, T[]>();
  for (const o of options) {
    const key = o.group ?? '';
    const row = rows.get(key);
    if (row) row.push(o);
    else rows.set(key, [o]);
  }
  return [...rows.values()];
}

export function createProfileEditor(): ProfileEditor {
  const el = h('dialog', { class: 'pe-dialog' }) as HTMLDialogElement;
  let current: ProfileEditorInput | null = null;
  let draft: ProfileDraft = { nick: '', color: '', fields: {} };

  const close = (): void => {
    el.close();
    current = null;
  };

  const render = (focusKey?: string): void => {
    const input = current;
    if (!input) return;
    el.style.setProperty('--player', draft.color);
    const nick = h('input', {
      class: 'pe__nick',
      type: 'text',
      maxlength: String(NICK_MAX_LEN),
      value: draft.nick,
      placeholder: input.defaultNick,
      'aria-label': t('lobby.nick'),
      'data-focusable': true,
      'data-focus-key': 'nick',
      spellcheck: 'false',
      autocomplete: 'off',
    }) as HTMLInputElement;
    nick.addEventListener('input', () => {
      draft.nick = nick.value.slice(0, NICK_MAX_LEN);
    });

    const pick = (key: string, value: LobbyValue): void => {
      draft.fields = { ...draft.fields, [key]: value };
      render(`f:${key}=${value}`);
    };

    const fieldBlocks = input.fields.map((field) => {
      const value = draft.fields[field.key] ?? field.default;
      if (field.kind === 'toggle') {
        const b = h('button', { class: 'field field--toggle', type: 'button', role: 'switch', 'aria-checked': String(value === true), 'data-focus-key': `f:${field.key}` }, input.label(field.label));
        b.addEventListener('click', () => pick(field.key, value !== true));
        return b;
      }
      if (field.kind !== 'select') return null;
      const withIcons = field.options.some((o) => o.icon);
      const rows = groupsOf(field.options).map((row) =>
        h(
          'div',
          { class: withIcons ? 'pe__icons' : 'pe__chips', role: 'radiogroup' },
          ...row.map((o) => {
            const b = h(
              'button',
              {
                class: withIcons ? 'pe__icon' : 'field__option',
                type: 'button',
                role: 'radio',
                'aria-checked': String(o.value === value),
                'aria-label': input.label(o.label),
                title: input.label(o.label),
                'data-focus-key': `f:${field.key}=${o.value}`,
              },
              withIcons ? '' : input.label(o.label),
            );
            if (withIcons && o.icon) b.innerHTML = o.icon;
            b.addEventListener('click', () => pick(field.key, o.value));
            return b;
          }),
        ),
      );
      return h('section', { class: 'pe__block' }, h('p', { class: 'pe__label' }, input.label(field.label)), ...rows);
    });

    const colors = h(
      'div',
      { class: 'pe__colors', role: 'radiogroup' },
      ...PLAYER_COLORS.map((c) => {
        const b = h('button', {
          class: 'pe__color',
          type: 'button',
          role: 'radio',
          style: `--c: ${c}`,
          'aria-checked': String(c === draft.color),
          'aria-label': c,
          'data-focus-key': `c:${c}`,
          disabled: input.taken.has(c),
        });
        b.addEventListener('click', () => {
          draft.color = c;
          render(`c:${c}`);
        });
        return b;
      }),
    );

    const ok = h('button', { class: 'pe__action pe__action--ok', type: 'button', 'aria-label': t('lobby.save'), 'data-focus-key': 'ok' }, icon(ICONS.check));
    const cancel = h('button', { class: 'pe__action', type: 'button', 'aria-label': t('lobby.cancel'), 'data-focus-key': 'cancel' }, icon(ICONS.close));
    ok.addEventListener('click', () => {
      input.save({ ...draft, nick: draft.nick.trim() });
      close();
    });
    cancel.addEventListener('click', close);

    el.replaceChildren(
      h(
        'div',
        { class: 'pe' },
        h('header', { class: 'pe__head' }, h('p', { class: 'pe__label' }, t('lobby.nick')), h('div', { class: 'pe__actions' }, ok, cancel)),
        nick,
        h(
          'div',
          { class: 'pe__body' },
          h('div', { class: 'pe__fields' }, ...fieldBlocks),
          h('section', { class: 'pe__block' }, h('p', { class: 'pe__label' }, t('lobby.color')), colors),
        ),
      ),
    );
    const again = focusKey ? el.querySelector<HTMLElement>(`[data-focus-key="${CSS.escape(focusKey)}"]`) : null;
    (again ?? ok).focus();
  };

  el.addEventListener(BACK_EVENT, close);
  el.addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });

  return {
    el,
    open(input) {
      current = input;
      draft = { nick: input.draft.nick, color: input.draft.color, fields: { ...input.draft.fields } };
      el.showModal();
      render();
    },
  };
}
