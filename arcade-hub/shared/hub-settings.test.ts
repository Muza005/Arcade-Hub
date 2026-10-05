import { describe, expect, it } from 'vitest';
import { defaultHubSettings, sanitizeHubSettings } from './hub-settings';

describe('настройки хаба', () => {
  it('чужие значения заменяются, границы соблюдаются', () => {
    const s = sanitizeHubSettings({ master: 250, music: -5, quality: 'ultra', uiScale: 200, lang: 'de', menuSounds: 'yes' });
    expect(s.master).toBe(100);
    expect(s.music).toBe(0);
    expect(s.quality).toBe('auto');
    expect(s.uiScale).toBe(130);
    expect(s.lang).toBe('ru');
    expect(s.menuSounds).toBe(true);
  });

  it('пусто — по умолчанию', () => {
    expect(sanitizeHubSettings(null)).toEqual(defaultHubSettings());
  });
});
