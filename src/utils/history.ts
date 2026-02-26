/**
 * Conversation history utilities
 */

import { Message } from '../providers/types.js';
import { createStructuredLogger } from '../logging/index.js';

const logger = createStructuredLogger('history');

/**
 * Repair conversation history by removing orphaned tool_use blocks
 * This can happen if a request times out mid-tool-loop
 */
export function repairConversationHistory(history: Message[]): { repaired: boolean; removed: number } {
  if (history.length === 0) return { repaired: false, removed: 0 };
  
  let removed = 0;
  
  // Scan from the end to find the last assistant message with tool calls
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    
    if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
      // Found an assistant message with tool calls
      // Check if ALL tool calls have corresponding tool results after it
      const toolCallIds = new Set(msg.toolCalls.map((tc: any) => tc.id));
      
      // Collect tool result IDs that follow this assistant message
      const foundResultIds = new Set<string>();
      for (let j = i + 1; j < history.length; j++) {
        const resultMsg = history[j];
        if (resultMsg.role === 'tool' && resultMsg.toolCallId) {
          foundResultIds.add(resultMsg.toolCallId);
        } else if (resultMsg.role === 'assistant' || resultMsg.role === 'user') {
          // Hit another turn - stop looking
          break;
        }
      }
      
      // Check if any tool calls are missing results
      const missingResults = [...toolCallIds].filter(id => !foundResultIds.has(id));
      
      if (missingResults.length > 0) {
        // Remove the broken assistant message and any partial tool results
        const removeCount = history.length - i;
        history.splice(i, removeCount);
        removed = removeCount;
        logger.warn('Repaired corrupted conversation history', { 
          removedMessages: removeCount, 
          missingToolResults: missingResults.length 
        });
        break;
      }
    }
    
    // If we hit a user message, history before this point should be fine
    if (msg.role === 'user') {
      break;
    }
  }
  
  return { repaired: removed > 0, removed };
}
