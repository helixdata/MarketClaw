/**
 * Per-user message queue to prevent race conditions
 * When multiple messages arrive simultaneously (e.g., media groups),
 * we process them sequentially to avoid corrupting conversation history
 */

import pino from 'pino';

const logger = pino({ name: 'queue' });

export class UserMessageQueue {
  private queues: Map<string, Promise<void>> = new Map();

  /**
   * Execute a task for a user, queued behind any pending tasks
   */
  async enqueue<T>(userId: string, task: () => Promise<T>): Promise<T> {
    const currentQueue = this.queues.get(userId) || Promise.resolve();
    
    let result: T;
    const newQueue = currentQueue.then(async () => {
      result = await task();
    }).catch((err) => {
      // Log but don't break the queue for subsequent messages
      logger.error({ userId, err }, 'Queued task failed');
      throw err;
    });
    
    this.queues.set(userId, newQueue.catch(() => {})); // Swallow errors for queue continuation
    
    await newQueue;
    return result!;
  }

  /**
   * Get the number of users with active queues
   */
  get size(): number {
    return this.queues.size;
  }

  /**
   * Clear all queues (for testing)
   */
  clear(): void {
    this.queues.clear();
  }
}
