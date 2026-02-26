/**
 * Tests for conversation history utilities
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { repairConversationHistory } from './history.js';

// Mock logging
vi.mock('../logging/index.js', () => ({
  createStructuredLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('repairConversationHistory', () => {
  it('should return not repaired for empty history', () => {
    const history: any[] = [];
    const result = repairConversationHistory(history);
    
    expect(result.repaired).toBe(false);
    expect(result.removed).toBe(0);
    expect(history).toHaveLength(0);
  });

  it('should not modify valid history with complete tool calls', () => {
    const history: any[] = [
      { role: 'user', content: 'Hello' },
      { 
        role: 'assistant', 
        content: 'Let me check that',
        toolCalls: [{ id: 'tool_1', name: 'search', arguments: {} }]
      },
      { role: 'tool', content: '{"result": "found"}', toolCallId: 'tool_1' },
      { role: 'assistant', content: 'Here is what I found' },
    ];
    
    const result = repairConversationHistory(history);
    
    expect(result.repaired).toBe(false);
    expect(result.removed).toBe(0);
    expect(history).toHaveLength(4);
  });

  it('should remove orphaned tool_use at end of history', () => {
    const history: any[] = [
      { role: 'user', content: 'Hello' },
      { 
        role: 'assistant', 
        content: 'Let me check that',
        toolCalls: [{ id: 'tool_1', name: 'search', arguments: {} }]
      },
      // Missing tool result - simulates timeout
    ];
    
    const result = repairConversationHistory(history);
    
    expect(result.repaired).toBe(true);
    expect(result.removed).toBe(1);
    expect(history).toHaveLength(1);
    expect(history[0].role).toBe('user');
  });

  it('should remove orphaned tool_use with partial results', () => {
    const history: any[] = [
      { role: 'user', content: 'Hello' },
      { 
        role: 'assistant', 
        content: 'Let me check multiple things',
        toolCalls: [
          { id: 'tool_1', name: 'search', arguments: {} },
          { id: 'tool_2', name: 'fetch', arguments: {} },
        ]
      },
      { role: 'tool', content: '{"result": "found"}', toolCallId: 'tool_1' },
      // tool_2 result missing - simulates partial timeout
    ];
    
    const result = repairConversationHistory(history);
    
    expect(result.repaired).toBe(true);
    expect(result.removed).toBe(2); // assistant + partial tool result
    expect(history).toHaveLength(1);
    expect(history[0].role).toBe('user');
  });

  it('should preserve history before corrupted section', () => {
    const history: any[] = [
      { role: 'user', content: 'First question' },
      { role: 'assistant', content: 'First answer' },
      { role: 'user', content: 'Second question' },
      { 
        role: 'assistant', 
        content: 'Let me check',
        toolCalls: [{ id: 'tool_1', name: 'search', arguments: {} }]
      },
      // Missing tool result
    ];
    
    const result = repairConversationHistory(history);
    
    expect(result.repaired).toBe(true);
    expect(result.removed).toBe(1);
    expect(history).toHaveLength(3);
    expect(history[2].content).toBe('Second question');
  });

  it('should handle history with only user messages', () => {
    const history: any[] = [
      { role: 'user', content: 'Hello' },
      { role: 'user', content: 'Are you there?' },
    ];
    
    const result = repairConversationHistory(history);
    
    expect(result.repaired).toBe(false);
    expect(result.removed).toBe(0);
    expect(history).toHaveLength(2);
  });

  it('should handle assistant message without tool calls', () => {
    const history: any[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ];
    
    const result = repairConversationHistory(history);
    
    expect(result.repaired).toBe(false);
    expect(result.removed).toBe(0);
    expect(history).toHaveLength(2);
  });

  it('should stop at user message boundary when scanning', () => {
    const history: any[] = [
      { role: 'user', content: 'Question 1' },
      { 
        role: 'assistant', 
        content: 'Using tool',
        toolCalls: [{ id: 'tool_old', name: 'search', arguments: {} }]
      },
      { role: 'tool', content: '{}', toolCallId: 'tool_old' },
      { role: 'assistant', content: 'Done' },
      { role: 'user', content: 'Question 2' },
      { role: 'assistant', content: 'Simple answer' },
    ];
    
    const result = repairConversationHistory(history);
    
    // Should not try to repair the old completed tool call
    expect(result.repaired).toBe(false);
    expect(result.removed).toBe(0);
    expect(history).toHaveLength(6);
  });

  it('should handle multiple tool calls all completed', () => {
    const history: any[] = [
      { role: 'user', content: 'Do multiple things' },
      { 
        role: 'assistant', 
        content: 'Running tools',
        toolCalls: [
          { id: 'tool_a', name: 'search', arguments: {} },
          { id: 'tool_b', name: 'fetch', arguments: {} },
          { id: 'tool_c', name: 'process', arguments: {} },
        ]
      },
      { role: 'tool', content: '{"a": 1}', toolCallId: 'tool_a' },
      { role: 'tool', content: '{"b": 2}', toolCallId: 'tool_b' },
      { role: 'tool', content: '{"c": 3}', toolCallId: 'tool_c' },
      { role: 'assistant', content: 'All done!' },
    ];
    
    const result = repairConversationHistory(history);
    
    expect(result.repaired).toBe(false);
    expect(result.removed).toBe(0);
    expect(history).toHaveLength(6);
  });
});
