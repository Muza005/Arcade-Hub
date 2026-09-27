// Настройки хаба (ARCADE_HUB_SPEC §13): каждое изменение применяется сразу, без «Сохранить». Выход — «Назад».
import { PERCENT_STEP, UI_SCALE_RANGE } from '../../shared/config';
import { defaultHubSettings, type HubSettings, type Quality } from '../../shared/hub-settings';
import { LANGS, t, type I18nKey, type Lang } from '../../shared/i18n';
import { h, icon } from '../ui/dom';
import { BACK_EVENT } from '../ui/focus';
import { ICONS } from '../ui/icons';

export interface SettingsScreenOptions {
  get(): HubSettings;
  /** Применить и сохранить. */
  set(next: HubSettings): void;
  changeCode(): void;
  removeAll(): void;
  onBack(): void;
}

export interface SettingsScreen {
  readonly el: HTMLElement;
  show(): void;
  hide(): void;
}

const QUALITIES: readonly Quality[] = ['auto', 'low', 'mid', 'high'];
const PERCENT_MAX = 100;

type PercentKey = 'master' | 'music' | 'effects' | 'flash' | 'shake' | 'bloom';

function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen().catch(() => undefined);
}

export function createSettingsScreen(options: SettingsScreenOptions): SettingsScreen {
  const el = h('main', { class: 'hs', 'data-focus-scope': true, hidden: true });
  let confirmReset = false;

  const patch = (change: Partial<HubSettings>): void => {
    options.set({ ...options.get(), ...change });
    render();
  };

  const btn = (key: string, className: string, content: string | Node, onClick: () => void, extra: Record<string, string | boolean> = {}) => {
    const b = h('button', { class: className, type: 'button', 'data-focus-key': key, ...extra }, content);
    b.addEventListener('click', onClick);
    return b;
  };

  const percentSlider = (key: PercentKey, label: I18nKey): HTMLElement => {
    const value = options.get()[key];
    const step = (dir: 1 | -1) => patch({ [key]: Math.min(PERCENT_MAX, Math.max(0, value + dir * PERCENT_STEP)) });
    return h(
      'div',
      { class: 'field' },
      h('span', { class: 'field__label' }, t(label)),
      h(
        'div',
        { class: 'field__slider' },
        btn(`${key}:-`, 'field__step', '−', () => step(-1), { 'aria-label': `${t(label)} −` }),
        h(
          'span',
          { class: 'field__value hs__meter', style: `--level: ${value / PERCENT_MAX}` },
          t('set.percent', { n: value }),
        ),
        btn(`${key}:+`, 'field__step', '+', () => step(1), { 'aria-label': `${t(label)} +` }),
      ),
    );
  };

  const toggle = (key: string, label: I18nKey, on: boolean, flip: () => void): HTMLElement =>
    btn(key, 'field field--toggle', t(label), flip, { role: 'switch', 'aria-checked': String(on) });

  const section = (svg: string, title: I18nKey, ...content: HTMLElement[]): HTMLElement =>
    h(
      'section',
      { class: 'hs__card' },
      h('h2', { class: 'hs__card-title' }, h('span', { class: 'hs__card-icon' }, icon(svg)), t(title)),
      ...content,
    );

  const render = (): void => {
    const focusKey = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.focusKey : undefined;
    const s = options.get();

    const scaleStep = (dir: 1 | -1) =>
      patch({ uiScale: Math.min(UI_SCALE_RANGE.max, Math.max(UI_SCALE_RANGE.min, s.uiScale + dir * UI_SCALE_RANGE.step)) });

    const reset = confirmReset
      ? h(
          'div',
          { class: 'hs__confirm' },
          h('span', { class: 'hs__confirm-text' }, t('set.resetSure')),
          btn('reset:yes', 'btn btn--danger-fill', t('set.yes'), () => {
            confirmReset = false;
            options.set(defaultHubSettings());
            render();
          }),
          btn('reset:no', 'btn btn--ghost', t('set.no'), () => {
            confirmReset = false;
            render();
          }),
        )
      : btn('reset', 'btn btn--ghost', t('set.resetAll'), () => {
          confirmReset = true;
          render();
          el.querySelector<HTMLElement>('[data-focus-key="reset:no"]')?.focus();
        });

    el.replaceChildren(
      h(
        'header',
        { class: 'hs__head' },
        btn('back', 'rv__back', h('span', {}, icon(ICONS.back), t('lobby.back')), () => options.onBack()),
        h('h1', { class: 'hs__title' }, h('span', { class: 'hs__title-icon' }, icon(ICONS.gear)), t('set.title')),
      ),
      h(
        'div',
        { class: 'hs__grid' },
        section(
          ICONS.soundOn,
          'set.sound',
          percentSlider('master', 'set.master'),
          percentSlider('music', 'set.music'),
          percentSlider('effects', 'set.effects'),
          toggle('menuSounds', 'set.menuSounds', s.menuSounds, () => patch({ menuSounds: !s.menuSounds })),
        ),
        section(
          ICONS.monitor,
          'set.image',
          h(
            'div',
            { class: 'field' },
            h('span', { class: 'field__label' }, t('set.quality')),
            h(
              'div',
              { class: 'field__options', role: 'radiogroup' },
              ...QUALITIES.map((q) =>
                btn(`q:${q}`, 'field__option', t(`set.q.${q}` as I18nKey), () => patch({ quality: q }), {
                  role: 'radio',
                  'aria-checked': String(q === s.quality),
                }),
              ),
            ),
          ),
          toggle('fullscreen', 'set.fullscreen', document.fullscreenElement !== null, () => {
            toggleFullscreen();
            // Состояние полного экрана меняется асинхронно — перерисуем по событию.
          }),
          h(
            'div',
            { class: 'field' },
            h('span', { class: 'field__label' }, t('set.uiScale')),
            h(
              'div',
              { class: 'field__slider' },
              btn('scale:-', 'field__step', '−', () => scaleStep(-1), { 'aria-label': `${t('set.uiScale')} −` }),
              h('span', { class: 'field__value' }, t('set.percent', { n: s.uiScale })),
              btn('scale:+', 'field__step', '+', () => scaleStep(1), { 'aria-label': `${t('set.uiScale')} +` }),
            ),
          ),
        ),
        section(
          ICONS.eye,
          'set.comfort',
          percentSlider('flash', 'set.flash'),
          percentSlider('shake', 'set.shake'),
          percentSlider('bloom', 'set.bloom'),
          toggle('reducedMotion', 'set.reducedMotion', s.reducedMotion, () => patch({ reducedMotion: !s.reducedMotion })),
        ),
        section(
          ICONS.globe,
          'set.language',
          h(
            'div',
            { class: 'field__options hs__langs', role: 'radiogroup' },
            ...LANGS.map((lang: Lang) =>
              btn(`lang:${lang}`, 'field__option', t(`lang.${lang}` as I18nKey), () => patch({ lang }), {
                role: 'radio',
                'aria-checked': String(lang === s.lang),
              }),
            ),
          ),
        ),
        section(
          ICONS.users,
          'set.room',
          btn('changeCode', 'btn btn--ghost', t('set.changeCode'), () => options.changeCode()),
          btn('removeAll', 'btn btn--ghost', t('set.removeAll'), () => options.removeAll()),
        ),
        section(ICONS.refresh, 'set.reset', reset),
      ),
    );
    const again = focusKey ? el.querySelector<HTMLElement>(`[data-focus-key="${CSS.escape(focusKey)}"]`) : null;
    (again ?? el.querySelector<HTMLElement>('[data-focus-key="back"]'))?.focus();
  };

  el.addEventListener(BACK_EVENT, () => {
    if (confirmReset) {
      confirmReset = false;
      render();
    } else options.onBack();
  });
  document.addEventListener('fullscreenchange', () => {
    if (!el.hidden) render();
  });

  return {
    el,
    show() {
      confirmReset = false;
      el.hidden = false;
      (document.activeElement as HTMLElement | null)?.blur();
      render();
    },
    hide() {
      el.hidden = true;
    },
  };
}
