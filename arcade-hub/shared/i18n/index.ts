// Словарь платформы (ARCADE_HUB_SPEC §0 п. 6, §21). Все видимые строки — только через t().
import { en } from './en';
import { ru } from './ru';

export type I18nKey = keyof typeof ru;
export type Dictionary = Record<I18nKey, string>;
export type Lang = 'ru' | 'en';

export const LANGS: readonly Lang[] = ['ru', 'en'];
export const DEFAULT_LANG: Lang = 'ru';

const dictionaries: Record<Lang, Dictionary> = { ru, en };

let current: Lang = DEFAULT_LANG;

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang): void {
  current = lang;
}

/** Строка по ключу; `{name}` в строке заменяется значением из params. */
export function t(key: I18nKey, params?: Record<string, string | number>): string {
  const template = dictionaries[current][key];
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
