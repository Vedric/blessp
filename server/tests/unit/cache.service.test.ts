import { CacheService } from '@core/cache/cache.service';

describe('CacheService', () => {
  let mockRedis: {
    get: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
    scan: jest.Mock;
  };
  let cacheService: CacheService;

  beforeEach(() => {
    mockRedis = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      scan: jest.fn(),
    };
    cacheService = new CacheService(mockRedis as any);
  });

  describe('when Redis is null (no-op mode)', () => {
    let noopCache: CacheService;

    beforeEach(() => {
      noopCache = new CacheService(null);
    });

    it('get returns null', async () => {
      const result = await noopCache.get('any-key');
      expect(result).toBeNull();
    });

    it('set does nothing', async () => {
      await expect(noopCache.set('key', { value: 1 }, 60)).resolves.toBeUndefined();
    });

    it('delete does nothing', async () => {
      await expect(noopCache.delete('key')).resolves.toBeUndefined();
    });

    it('deleteByPattern does nothing', async () => {
      await expect(noopCache.deleteByPattern('key:*')).resolves.toBeUndefined();
    });
  });

  describe('get', () => {
    it('returns parsed JSON when key exists', async () => {
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({ id: '1', name: 'test' }));

      const result = await cacheService.get<{ id: string; name: string }>('products:1');

      expect(result).toEqual({ id: '1', name: 'test' });
      expect(mockRedis.get).toHaveBeenCalledWith('blessp:products:1');
    });

    it('returns null when key does not exist', async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      const result = await cacheService.get('missing-key');

      expect(result).toBeNull();
    });

    it('returns null on Redis error', async () => {
      mockRedis.get.mockRejectedValueOnce(new Error('Connection lost'));

      const result = await cacheService.get('broken-key');

      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('serializes value and stores with TTL', async () => {
      mockRedis.set.mockResolvedValueOnce('OK');

      await cacheService.set('products:1', { id: '1' }, 300);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'blessp:products:1',
        JSON.stringify({ id: '1' }),
        'EX',
        300,
      );
    });

    it('swallows Redis errors', async () => {
      mockRedis.set.mockRejectedValueOnce(new Error('Connection lost'));

      await expect(cacheService.set('key', 'value', 60)).resolves.toBeUndefined();
    });
  });

  describe('delete', () => {
    it('deletes the prefixed key', async () => {
      mockRedis.del.mockResolvedValueOnce(1);

      await cacheService.delete('products:1');

      expect(mockRedis.del).toHaveBeenCalledWith('blessp:products:1');
    });

    it('swallows Redis errors', async () => {
      mockRedis.del.mockRejectedValueOnce(new Error('Connection lost'));

      await expect(cacheService.delete('key')).resolves.toBeUndefined();
    });
  });

  describe('deleteByPattern', () => {
    it('scans and deletes matching keys', async () => {
      mockRedis.scan
        .mockResolvedValueOnce(['5', ['blessp:products:1', 'blessp:products:2']])
        .mockResolvedValueOnce(['0', ['blessp:products:3']]);
      mockRedis.del.mockResolvedValue(1);

      await cacheService.deleteByPattern('products:*');

      expect(mockRedis.scan).toHaveBeenCalledTimes(2);
      expect(mockRedis.del).toHaveBeenCalledWith('blessp:products:1', 'blessp:products:2');
      expect(mockRedis.del).toHaveBeenCalledWith('blessp:products:3');
    });

    it('handles no matching keys', async () => {
      mockRedis.scan.mockResolvedValueOnce(['0', []]);

      await cacheService.deleteByPattern('nothing:*');

      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('swallows Redis errors', async () => {
      mockRedis.scan.mockRejectedValueOnce(new Error('Connection lost'));

      await expect(cacheService.deleteByPattern('key:*')).resolves.toBeUndefined();
    });
  });
});
