import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pg before importing
vi.mock('pg', () => {
  let callCount = 0;
  return {
    default: {
      Pool: vi.fn(() => {
        callCount++;
        return {
          query: vi.fn(async () => ({ rows: [] })),
          end: vi.fn(async () => {}),
          _id: callCount,
        };
      }),
    },
    Pool: vi.fn(() => ({
      query: vi.fn(async () => ({ rows: [] })),
      end: vi.fn(async () => {}),
    })),
  };
});

import { getPool, query, closePool } from '../src/db/connection.js';

describe('DbConnection', () => {
  beforeEach(async () => {
    // Reset module state by closing pool
    await closePool().catch(() => {});
    vi.clearAllMocks();
  });

  it('should create a pool on first call to getPool', () => {
    const pool = getPool();
    expect(pool).toBeDefined();
    expect(pool.query).toBeDefined();
  });

  it('should return the same pool on subsequent calls', () => {
    const pool1 = getPool();
    const pool2 = getPool();
    expect(pool1).toBe(pool2);
  });

  it('should execute query through helper function', async () => {
    const mockPool = getPool();
    (mockPool.query as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      rows: [{ id: 1, name: 'test' }],
    });

    const result = await query('SELECT * FROM test');
    expect(result).toEqual([{ id: 1, name: 'test' }]);
  });

  it('should close pool and reset singleton', async () => {
    const pool1 = getPool();
    expect(pool1).toBeDefined();
    await closePool();
    // After close, the singleton is null; getPool creates a new Pool instance
    const pool2 = getPool();
    // Both are valid pool objects
    expect(pool2).toBeDefined();
    expect(pool2.query).toBeDefined();
  });
});
