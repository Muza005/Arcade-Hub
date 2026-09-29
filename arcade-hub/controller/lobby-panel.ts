// Поля игрока в лобби на телефоне (ARCADE_HUB_SPEC §11): игра объявляет их в схеме лобби,
// экран присылает в st.lobby, игрок выбирает сам — например, форму корпуса. Только DOM, анимаций нет.
import type { LobbyPanel, LobbyValue, PhoneToScreen } from '../shared/protocol';
import { button, el } from './ui';

export interface LobbyPanelView {
  readonly el: HTMLElement;
  /** Панель от экрана; undefined — лобби закрыто или полей нет. */
  update(panel: LobbyPanel | undefined): void;
}

export function createLobbyPanel(send: (msg: PhoneToScreen) => void): LobbyPanelView {
  const root = el('section', 'lpanel');
  root.hidden = true;
  let shown = '';
  /** Выбор до ответа экрана — чтобы кнопка отзывалась сразу. */
  const pending = new Map<string, LobbyValue>();

  const pick = (key: string, value: LobbyValue, panel: LobbyPanel): void => {
    pending.set(key, value);
    send({ t: 'lobby', key, value });
    draw({ ...panel, values: { ...panel.values, [key]: value } });
  };

  const draw = (panel: LobbyPanel): void => {
    root.replaceChildren(
      ...panel.fields.map((field) => {
        const value = panel.values[field.key];
        const row = el('div', 'lpanel__field');
        if (field.kind === 'toggle') {
          const b = button('lpanel__chip lpanel__chip--toggle', field.label);
          b.setAttribute('role', 'switch');
          b.setAttribute('aria-checked', String(value === true));
          b.addEventListener('click', () => pick(field.key, value !== true, panel));
          row.append(b);
          return row;
        }
        const chips = el('div', 'lpanel__chips');
        chips.setAttribute('role', 'radiogroup');
        for (const o of field.options ?? []) {
          const b = button('lpanel__chip', o.label);
          b.setAttribute('role', 'radio');
          b.setAttribute('aria-checked', String(o.value === value));
          b.addEventListener('click', () => pick(field.key, o.value, panel));
          chips.append(b);
        }
        row.append(el('p', 'lpanel__label', field.label), chips);
        return row;
      }),
    );
  };

  return {
    el: root,
    update(panel) {
      root.hidden = panel === undefined;
      if (!panel) {
        shown = '';
        pending.clear();
        return;
      }
      // Экран подтвердил выбор — ожидание снято; ещё не подтвердил — показываем выбранное.
      for (const [key, value] of pending) if (panel.values[key] === value) pending.delete(key);
      const view = { ...panel, values: { ...panel.values, ...Object.fromEntries(pending) } };
      const key = JSON.stringify(view);
      if (key === shown) return;
      shown = key;
      draw(view);
    },
  };
}
