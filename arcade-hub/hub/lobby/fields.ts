// Значения полей лобби по схеме игры (§11). Чистые функции.
import type { LobbyField } from '../../shared/game-manifest';
import type { LobbyValue } from '../../shared/protocol';

export type FieldValues = Record<string, LobbyValue>;

export function defaults(fields: readonly LobbyField[]): FieldValues {
  return Object.fromEntries(fields.map((f) => [f.key, f.default]));
}

/** Проверенное значение поля: чужой тип, выход за границы или неизвестный вариант → по умолчанию. */
export function validValue(field: LobbyField, value: unknown): LobbyValue {
  switch (field.kind) {
    case 'toggle':
      return typeof value === 'boolean' ? value : field.default;
    case 'slider': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return field.default;
      const steps = Math.round((value - field.min) / field.step);
      return Math.min(field.max, Math.max(field.min, field.min + steps * field.step));
    }
    case 'select':
      return field.options.some((o) => o.value === value) ? (value as string | number) : field.default;
  }
}

/** Сохранённые значения поверх значений по умолчанию; лишние ключи отбрасываются. */
export function sanitize(fields: readonly LobbyField[], saved: unknown): FieldValues {
  const source = typeof saved === 'object' && saved !== null ? (saved as Record<string, unknown>) : {};
  return Object.fromEntries(fields.map((f) => [f.key, validValue(f, source[f.key])]));
}

/** Шаг значения: ползунок ±step, выбор — соседний вариант, переключатель — наоборот. */
export function stepValue(field: LobbyField, value: LobbyValue, dir: 1 | -1): LobbyValue {
  switch (field.kind) {
    case 'toggle':
      return !value;
    case 'slider':
      return validValue(field, Number(value) + dir * field.step);
    case 'select': {
      const i = field.options.findIndex((o) => o.value === value);
      const next = field.options[Math.min(field.options.length - 1, Math.max(0, i + dir))];
      return next?.value ?? field.default;
    }
  }
}
