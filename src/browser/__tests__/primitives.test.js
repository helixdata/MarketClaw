/**
 * Unit tests for MarketClaw Extension Primitives
 * 
 * These tests verify the primitive functions work correctly.
 * Run with: npx vitest extension/__tests__/primitives.test.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// Set up DOM environment
let dom;
let document;
let window;

beforeEach(() => {
  dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
      <body>
        <input id="email" type="text" value="old@example.com" />
        <input id="password" type="password" />
        <button id="submit" data-testid="submitBtn">Submit</button>
        <button id="cancel">Cancel</button>
        <div id="content">Hello World</div>
        <div id="hidden" style="display: none;">Hidden Content</div>
        <select id="country">
          <option value="us">United States</option>
          <option value="uk">United Kingdom</option>
          <option value="nz">New Zealand</option>
        </select>
        <input id="agree" type="checkbox" />
        <a href="https://example.com" id="link" class="external-link">Example</a>
        <div id="container" style="height: 100px; overflow: auto;">
          <div style="height: 500px;">Scrollable content</div>
        </div>
      </body>
    </html>
  `, {
    url: 'https://test.example.com/page',
    runScripts: 'dangerously'
  });
  
  document = dom.window.document;
  window = dom.window;
  
  // Mock execCommand for type operations
  document.execCommand = vi.fn((command, showUI, value) => {
    if (command === 'insertText') {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        active.value += value;
      } else if (active && active.isContentEditable) {
        active.textContent += value;
      }
    } else if (command === 'selectAll') {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
        active.value = '';
      }
    }
    return true;
  });
  
  // Make globals available
  global.document = document;
  global.window = window;
  global.MouseEvent = window.MouseEvent;
  global.Event = window.Event;
});

afterEach(() => {
  dom = null;
  document = null;
  window = null;
});

// Helper to execute primitives (simulating the extension's logic)
async function executePrimitive(command) {
  const { action, selector, text, attribute, value, values, checked, ms, script, timeout = 10000, options = {} } = command;
  
  const waitForElement = (sel, time = 10000) => {
    return new Promise((resolve, reject) => {
      const el = document.querySelector(sel);
      if (el) resolve(el);
      else reject(new Error(`Element not found: ${sel}`));
    });
  };
  
  const delay = (milliseconds) => new Promise(r => setTimeout(r, milliseconds));
  
  try {
    switch (action) {
      case 'click': {
        const el = await waitForElement(selector, timeout);
        el.click();
        return { success: true, result: { clicked: true, selector } };
      }
      
      case 'type': {
        const el = await waitForElement(selector, timeout);
        el.focus();
        if (options.clear !== false) {
          document.execCommand('selectAll', false, null);
        }
        document.execCommand('insertText', false, text);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true, result: { typed: true, selector, length: text.length } };
      }
      
      case 'find': {
        const elements = document.querySelectorAll(selector);
        const limit = options.limit || 10;
        const results = [];
        for (let i = 0; i < Math.min(elements.length, limit); i++) {
          const el = elements[i];
          results.push({
            index: i,
            tagName: el.tagName.toLowerCase(),
            text: el.textContent?.substring(0, 100)?.trim(),
            id: el.id,
            className: el.className
          });
        }
        return { success: true, result: { count: elements.length, elements: results } };
      }
      
      case 'getText': {
        const el = await waitForElement(selector, timeout);
        return { success: true, result: { text: el.textContent?.trim(), selector } };
      }
      
      case 'getAttribute': {
        const el = await waitForElement(selector, timeout);
        return { success: true, result: { attribute, value: el.getAttribute(attribute), selector } };
      }
      
      case 'setAttribute': {
        const el = await waitForElement(selector, timeout);
        el.setAttribute(attribute, value);
        return { success: true, result: { attribute, value, selector } };
      }
      
      case 'select': {
        const el = await waitForElement(selector, timeout);
        const vals = Array.isArray(values) ? values : [values];
        for (const opt of el.options) {
          opt.selected = vals.includes(opt.value);
        }
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true, result: { selected: true, selector, values: vals } };
      }
      
      case 'setChecked': {
        const el = await waitForElement(selector, timeout);
        if (el.checked !== checked) el.click();
        return { success: true, result: { checked: el.checked, selector } };
      }
      
      case 'focus': {
        const el = await waitForElement(selector, timeout);
        el.focus();
        return { success: true, result: { focused: true, selector } };
      }
      
      case 'wait': {
        await waitForElement(selector, timeout);
        return { success: true, result: { found: true, selector } };
      }
      
      case 'pageInfo': {
        return {
          success: true,
          result: {
            url: window.location.href,
            title: document.title
          }
        };
      }
      
      default:
        return { success: false, error: `Unknown primitive: ${action}` };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

describe('Primitives', () => {
  describe('click', () => {
    it('should click an element by selector', async () => {
      let clicked = false;
      document.getElementById('submit').addEventListener('click', () => {
        clicked = true;
      });
      
      const result = await executePrimitive({
        action: 'click',
        selector: '#submit'
      });
      
      expect(result.success).toBe(true);
      expect(result.result.clicked).toBe(true);
      expect(clicked).toBe(true);
    });
    
    it('should click by data-testid', async () => {
      let clicked = false;
      document.querySelector('[data-testid="submitBtn"]').addEventListener('click', () => {
        clicked = true;
      });
      
      const result = await executePrimitive({
        action: 'click',
        selector: '[data-testid="submitBtn"]'
      });
      
      expect(result.success).toBe(true);
      expect(clicked).toBe(true);
    });
    
    it('should fail for non-existent element', async () => {
      const result = await executePrimitive({
        action: 'click',
        selector: '#nonexistent'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });
  
  describe('type', () => {
    it('should type text into an input', async () => {
      const result = await executePrimitive({
        action: 'type',
        selector: '#email',
        text: 'new@example.com'
      });
      
      expect(result.success).toBe(true);
      expect(result.result.typed).toBe(true);
      expect(result.result.length).toBe(15);
    });
    
    it('should clear existing content by default', async () => {
      const input = document.getElementById('email');
      input.value = 'old@example.com';
      
      await executePrimitive({
        action: 'type',
        selector: '#email',
        text: 'new@example.com'
      });
      
      // Mock clears on selectAll, so value should be the new text
      expect(input.value).toBe('new@example.com');
    });
    
    it('should not clear if options.clear is false', async () => {
      const input = document.getElementById('email');
      input.value = 'existing';
      
      await executePrimitive({
        action: 'type',
        selector: '#email',
        text: '-appended',
        options: { clear: false }
      });
      
      expect(input.value).toBe('existing-appended');
    });
  });
  
  describe('find', () => {
    it('should find elements matching selector', async () => {
      const result = await executePrimitive({
        action: 'find',
        selector: 'button'
      });
      
      expect(result.success).toBe(true);
      expect(result.result.count).toBe(2);
      expect(result.result.elements).toHaveLength(2);
      expect(result.result.elements[0].tagName).toBe('button');
      expect(result.result.elements[0].text).toBe('Submit');
    });
    
    it('should respect limit option', async () => {
      const result = await executePrimitive({
        action: 'find',
        selector: 'button',
        options: { limit: 1 }
      });
      
      expect(result.result.count).toBe(2);
      expect(result.result.elements).toHaveLength(1);
    });
    
    it('should return empty array for no matches', async () => {
      const result = await executePrimitive({
        action: 'find',
        selector: '.nonexistent'
      });
      
      expect(result.success).toBe(true);
      expect(result.result.count).toBe(0);
      expect(result.result.elements).toHaveLength(0);
    });
  });
  
  describe('getText', () => {
    it('should get text content of element', async () => {
      const result = await executePrimitive({
        action: 'getText',
        selector: '#content'
      });
      
      expect(result.success).toBe(true);
      expect(result.result.text).toBe('Hello World');
    });
    
    it('should fail for non-existent element', async () => {
      const result = await executePrimitive({
        action: 'getText',
        selector: '#nonexistent'
      });
      
      expect(result.success).toBe(false);
    });
  });
  
  describe('getAttribute', () => {
    it('should get attribute value', async () => {
      const result = await executePrimitive({
        action: 'getAttribute',
        selector: '#link',
        attribute: 'href'
      });
      
      expect(result.success).toBe(true);
      expect(result.result.value).toBe('https://example.com');
    });
    
    it('should get class attribute', async () => {
      const result = await executePrimitive({
        action: 'getAttribute',
        selector: '#link',
        attribute: 'class'
      });
      
      expect(result.result.value).toBe('external-link');
    });
    
    it('should return null for missing attribute', async () => {
      const result = await executePrimitive({
        action: 'getAttribute',
        selector: '#link',
        attribute: 'data-missing'
      });
      
      expect(result.success).toBe(true);
      expect(result.result.value).toBeNull();
    });
  });
  
  describe('setAttribute', () => {
    it('should set attribute value', async () => {
      const result = await executePrimitive({
        action: 'setAttribute',
        selector: '#link',
        attribute: 'data-custom',
        value: 'test-value'
      });
      
      expect(result.success).toBe(true);
      expect(document.getElementById('link').getAttribute('data-custom')).toBe('test-value');
    });
  });
  
  describe('select', () => {
    it('should select single option', async () => {
      const result = await executePrimitive({
        action: 'select',
        selector: '#country',
        values: 'nz'
      });
      
      expect(result.success).toBe(true);
      expect(document.getElementById('country').value).toBe('nz');
    });
    
    it('should handle array of values', async () => {
      const result = await executePrimitive({
        action: 'select',
        selector: '#country',
        values: ['uk']
      });
      
      expect(result.success).toBe(true);
      expect(document.getElementById('country').value).toBe('uk');
    });
  });
  
  describe('setChecked', () => {
    it('should check a checkbox', async () => {
      const checkbox = document.getElementById('agree');
      expect(checkbox.checked).toBe(false);
      
      const result = await executePrimitive({
        action: 'setChecked',
        selector: '#agree',
        checked: true
      });
      
      expect(result.success).toBe(true);
      expect(result.result.checked).toBe(true);
    });
    
    it('should uncheck a checkbox', async () => {
      const checkbox = document.getElementById('agree');
      checkbox.checked = true;
      
      const result = await executePrimitive({
        action: 'setChecked',
        selector: '#agree',
        checked: false
      });
      
      expect(result.success).toBe(true);
      expect(result.result.checked).toBe(false);
    });
  });
  
  describe('focus', () => {
    it('should focus an element', async () => {
      const result = await executePrimitive({
        action: 'focus',
        selector: '#password'
      });
      
      expect(result.success).toBe(true);
      expect(result.result.focused).toBe(true);
      expect(document.activeElement).toBe(document.getElementById('password'));
    });
  });
  
  describe('wait', () => {
    it('should succeed immediately for existing element', async () => {
      const result = await executePrimitive({
        action: 'wait',
        selector: '#submit'
      });
      
      expect(result.success).toBe(true);
      expect(result.result.found).toBe(true);
    });
    
    it('should fail for non-existent element', async () => {
      const result = await executePrimitive({
        action: 'wait',
        selector: '#nonexistent',
        timeout: 100
      });
      
      expect(result.success).toBe(false);
    });
  });
  
  describe('pageInfo', () => {
    it('should return page information', async () => {
      const result = await executePrimitive({
        action: 'pageInfo'
      });
      
      expect(result.success).toBe(true);
      expect(result.result.url).toBe('https://test.example.com/page');
    });
  });
  
  describe('unknown action', () => {
    it('should return error for unknown action', async () => {
      const result = await executePrimitive({
        action: 'unknownAction'
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown primitive');
    });
  });
});

describe('Primitive Edge Cases', () => {
  it('should handle special characters in text', async () => {
    const result = await executePrimitive({
      action: 'type',
      selector: '#email',
      text: 'test+special@example.com'
    });
    
    expect(result.success).toBe(true);
  });
  
  it('should handle unicode in text', async () => {
    const result = await executePrimitive({
      action: 'type',
      selector: '#email',
      text: '你好世界 🦀'
    });
    
    expect(result.success).toBe(true);
    expect(result.result.length).toBe(7);
  });
  
  it('should handle complex CSS selectors', async () => {
    const result = await executePrimitive({
      action: 'find',
      selector: 'input[type="text"], input[type="password"]'
    });
    
    expect(result.success).toBe(true);
    expect(result.result.count).toBe(2);
  });
  
  it('should handle selector with special characters', async () => {
    const result = await executePrimitive({
      action: 'click',
      selector: '[data-testid="submitBtn"]'
    });
    
    expect(result.success).toBe(true);
  });
});
