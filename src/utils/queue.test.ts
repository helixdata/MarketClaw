/**
 * Tests for UserMessageQueue
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserMessageQueue } from './queue.js';

// Mock pino
vi.mock('pino', () => ({
  default: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('UserMessageQueue', () => {
  let queue: UserMessageQueue;

  beforeEach(() => {
    queue = new UserMessageQueue();
  });

  it('should execute a single task immediately', async () => {
    const result = await queue.enqueue('user1', async () => 'hello');
    expect(result).toBe('hello');
  });

  it('should execute tasks sequentially for same user', async () => {
    const executionOrder: number[] = [];
    
    const task1 = queue.enqueue('user1', async () => {
      await new Promise(r => setTimeout(r, 50));
      executionOrder.push(1);
      return 1;
    });
    
    const task2 = queue.enqueue('user1', async () => {
      executionOrder.push(2);
      return 2;
    });
    
    const task3 = queue.enqueue('user1', async () => {
      executionOrder.push(3);
      return 3;
    });
    
    const results = await Promise.all([task1, task2, task3]);
    
    expect(results).toEqual([1, 2, 3]);
    expect(executionOrder).toEqual([1, 2, 3]); // Sequential, not interleaved
  });

  it('should execute tasks in parallel for different users', async () => {
    const startTimes: Record<string, number> = {};
    const start = Date.now();
    
    const task1 = queue.enqueue('user1', async () => {
      startTimes['user1'] = Date.now() - start;
      await new Promise(r => setTimeout(r, 50));
      return 'user1';
    });
    
    const task2 = queue.enqueue('user2', async () => {
      startTimes['user2'] = Date.now() - start;
      await new Promise(r => setTimeout(r, 50));
      return 'user2';
    });
    
    await Promise.all([task1, task2]);
    
    // Both should start nearly simultaneously (within 20ms)
    expect(Math.abs(startTimes['user1'] - startTimes['user2'])).toBeLessThan(20);
  });

  it('should return task result correctly', async () => {
    const result = await queue.enqueue('user1', async () => {
      return { data: 'test', count: 42 };
    });
    
    expect(result).toEqual({ data: 'test', count: 42 });
  });

  it('should propagate errors from tasks', async () => {
    await expect(
      queue.enqueue('user1', async () => {
        throw new Error('Task failed');
      })
    ).rejects.toThrow('Task failed');
  });

  it('should continue processing after error', async () => {
    // First task fails
    await expect(
      queue.enqueue('user1', async () => {
        throw new Error('First failed');
      })
    ).rejects.toThrow('First failed');
    
    // Second task should still execute
    const result = await queue.enqueue('user1', async () => 'recovered');
    expect(result).toBe('recovered');
  });

  it('should handle async errors correctly', async () => {
    await expect(
      queue.enqueue('user1', async () => {
        await new Promise(r => setTimeout(r, 10));
        throw new Error('Async error');
      })
    ).rejects.toThrow('Async error');
  });

  it('should track queue size', async () => {
    expect(queue.size).toBe(0);
    
    const task1 = queue.enqueue('user1', async () => {
      await new Promise(r => setTimeout(r, 50));
    });
    
    // Queue should have entry after enqueue
    expect(queue.size).toBe(1);
    
    await task1;
  });

  it('should clear queues', async () => {
    await queue.enqueue('user1', async () => 'done');
    await queue.enqueue('user2', async () => 'done');
    
    expect(queue.size).toBe(2);
    
    queue.clear();
    
    expect(queue.size).toBe(0);
  });

  it('should handle rapid sequential enqueues', async () => {
    const results: number[] = [];
    
    // Rapidly enqueue 10 tasks
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        queue.enqueue('user1', async () => {
          results.push(i);
          return i;
        })
      );
    }
    
    const returnValues = await Promise.all(promises);
    
    // All should execute in order
    expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(returnValues).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('should isolate errors between users', async () => {
    // User1 fails
    const user1Promise = queue.enqueue('user1', async () => {
      throw new Error('User1 error');
    }).catch(e => e.message);
    
    // User2 should succeed
    const user2Promise = queue.enqueue('user2', async () => 'user2 success');
    
    const [user1Result, user2Result] = await Promise.all([user1Promise, user2Promise]);
    
    expect(user1Result).toBe('User1 error');
    expect(user2Result).toBe('user2 success');
  });
});
