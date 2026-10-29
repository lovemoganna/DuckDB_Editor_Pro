import { describe, it, expect, vi, beforeEach } from 'vitest';
import { duckDBService } from './duckdbService';

describe('duckDBService query cancellation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('cancelActiveQuery calls cancelSent on active connections', async () => {
    const mockCancelSent = vi.fn().mockResolvedValue(true);

    // Mock connection
    (duckDBService as any).conn = {
      cancelSent: mockCancelSent,
    };
    (duckDBService as any).readConn = null;

    const result = await duckDBService.cancelActiveQuery();
    expect(mockCancelSent).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('cancelActiveQuery gracefully handles connection without cancelSent or inactive state', async () => {
    (duckDBService as any).conn = null;
    (duckDBService as any).readConn = null;

    const result = await duckDBService.cancelActiveQuery();
    expect(result).toBe(false);
  });
});
