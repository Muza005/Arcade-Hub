// Память телефона: токен комнаты и профиль (ник и цвет переходят во все комнаты и игры, §9).

const KEY_SESSION = 'arcade-hub:session';
const KEY_PROFILE = 'arcade-hub:profile';

export interface Session {
  room: string;
  token: string;
}

export interface Profile {
  nick: string;
  color: string;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // без хранилища вход после перезагрузки будет новым слотом
  }
}

/** Токен есть только для той комнаты, где его выдали. */
export function tokenFor(room: string): string | undefined {
  const session = read<Session>(KEY_SESSION);
  return session?.room === room ? session.token : undefined;
}

export const saveSession = (session: Session): void => write(KEY_SESSION, session);
export const loadProfile = (): Profile | null => read<Profile>(KEY_PROFILE);
export const saveProfile = (profile: Profile): void => write(KEY_PROFILE, profile);
