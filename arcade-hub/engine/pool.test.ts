import { describe, expect, it } from 'vitest';
import { Pool } from './pool';

describe('Pool', () => {
  it('переиспользует освобождённые объекты и сбрасывает их', () => {
    let created = 0;
    const pool = new Pool(
      () => ({ id: created++, used: false }),
      (o) => (o.used = false),
      2,
    );
    expect(pool.freeCount).toBe(2);
    const a = pool.acquire();
    a.used = true;
    pool.release(a);
    const b = pool.acquire();
    expect(b).toBe(a);
    expect(b.used).toBe(false);
    expect(created).toBe(2);
  });

  it('releaseAll возвращает все активные', () => {
    const pool = new Pool(() => ({}), () => {});
    pool.acquire();
    pool.acquire();
    expect(pool.activeCount).toBe(2);
    pool.releaseAll();
    expect(pool.activeCount).toBe(0);
    expect(pool.freeCount).toBe(2);
  });
});
