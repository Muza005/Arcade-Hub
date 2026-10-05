// Словари (ARCADE_HUB_SPEC §0 п. 6, §21). Все видимые строки — только через t() платформы
// или переводчик игры (createTranslator со словарём из папки игры).
import { en } from './en';
import { ru } from './ru';

export type I18nKey = keyof typeof ru;
export type Dictionary = Record<I18nKey, string>;
export type Lang = 'ru' | 'en';
/** Словарь игры: одни и те же ключи на каждом языке. */
export type GameStrings<K extends string = string> = Record<Lang, Record<K, string>>;
export type Params = Record<string, string | number>;

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

/** `{name}` в строке заменяется значением из params. */
function format(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/** Строка платформы по ключу. */
export function t(key: I18nKey, params?: Params): string {
  return format(dictionaries[current][key], params);
}

type PluralBase<K> = K extends `${infer B}_other` ? B : never;
export type PluralKey = PluralBase<I18nKey>;

/** Строка с формой числа: ключ `base_one|few|many|other` выбирается по n (Intl.PluralRules). */
export function tn(base: PluralKey, n: number, params?: Params): string {
  const form = new Intl.PluralRules(current).select(n);
  const key = `${base}_${form}` as I18nKey;
  const template = dictionaries[current][key] ?? dictionaries[current][`${base}_other` as I18nKey];
  return format(template, { n, ...params });
}

/** Переводчик для словаря игры. Неизвестный ключ возвращается как есть — так его видно на экране. */
export function createTranslator<K extends string>(strings: GameStrings<K>): (key: K, params?: Params) => string {
  return (key, params) => format(strings[current][key] ?? key, params);
}
