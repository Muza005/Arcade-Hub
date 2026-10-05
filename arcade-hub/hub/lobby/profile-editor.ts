// Профиль клавиатурного игрока в лобби (§11): ник, поля игрока из схемы игры и цвет.
// Телефон меняет то же самое у себя в настройках; этим окном пользуются игроки у экрана.
// Варианты с иконками (например, формы корпуса) — рядами по разделам с подписью; слева — превью выбранного
// крупно в цвете игрока и никнейм; внизу — «Отмена» и «Сохранить» (макет заказчика).
import { NICK_MAX_LEN, PLAYER_COLORS } from '../../shared/config';
import type { LobbyField } from '../../shared/game-manifest';
import { t } from '../../shared/i18n';
import type { LobbyValue } from '../../shared/protocol';
import { h } from '../ui/dom';
import { BACK_EVENT } from '../ui/focus';

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
function groupsOf<T extends { group?: string; groupLabel?: string }>(options: readonly T[]): T[][] {
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

    // Поле с иконками (например, корпус) — сеткой по разделам с подписью; оно же в превью слева.
    const iconField = input.fields.find((f) => f.kind === 'select' && f.options.some((o) => o.icon));
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
          { class: withIcons ? 'pe__row' : 'pe__chips', role: 'radiogroup' },
          withIcons && row[0]?.groupLabel && h('span', { class: 'pe__row-label' }, input.label(row[0].groupLabel)),
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
      return h('section', { class: 'pe__block' }, h('h3', { class: 'pe__title' }, input.label(field.label)), ...rows);
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

    // Превью: выбранный вариант крупно в цвете игрока; под ним — «Раздел · «Название»».
    const chosen = iconField?.kind === 'select' ? iconField.options.find((o) => o.value === (draft.fields[iconField.key] ?? iconField.default)) : undefined;
    const art = h('div', { class: 'pe__art' });
    if (chosen?.icon) art.innerHTML = chosen.icon;
    else art.append(h('span', { class: 'pe__letter' }, (draft.nick || input.defaultNick).slice(0, 1).toUpperCase()));
    const caption = chosen
      ? [chosen.groupLabel ? input.label(chosen.groupLabel) : '', `«${input.label(chosen.label)}»`].filter(Boolean).join(' · ')
      : '';

    const ok = h('button', { class: 'pe__btn pe__btn--ok', type: 'button', 'data-focus-key': 'ok' }, t('lobby.save'));
    const cancel = h('button', { class: 'pe__btn', type: 'button', 'data-focus-key': 'cancel' }, t('lobby.cancel'));
    ok.addEventListener('click', () => {
      input.save({ ...draft, nick: draft.nick.trim() });
      close();
    });
    cancel.addEventListener('click', close);

    el.replaceChildren(
      h(
        'div',
        { class: 'pe' },
        h(
          'aside',
          { class: 'pe__side' },
          art,
          caption && h('p', { class: 'pe__caption' }, caption),
          h('p', { class: 'pe__nick-label' }, t('lobby.nick')),
          nick,
        ),
        h(
          'div',
          { class: 'pe__main' },
          ...fieldBlocks,
          h('section', { class: 'pe__block' }, h('h3', { class: 'pe__title' }, t('lobby.color')), colors),
          h('div', { class: 'pe__buttons' }, cancel, ok),
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
