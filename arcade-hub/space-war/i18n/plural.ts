// Число с подписью в нужной форме («1 удар», «3 удара», «5 ударов»): форма по правилам языка хаба.
import { getLang } from '../../shared/i18n';

export type PluralForm = 'one' | 'few' | 'many' | 'other';

export function pluralForm(n: number): PluralForm {
  const form = new Intl.PluralRules(getLang()).select(n);
  return form === 'one' || form === 'few' || form === 'many' ? form : 'other';
}
