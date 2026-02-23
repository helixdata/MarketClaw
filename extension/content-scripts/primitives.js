/**
 * MarketClaw - Generic DOM Primitives
 * 
 * Low-level DOM manipulation functions that can be used on any website.
 * These primitives allow MarketClaw to automate new platforms without
 * requiring extension updates.
 */

console.log('[MarketClaw] Primitives content script loaded');

/**
 * Wait for an element to appear in the DOM
 * @param {string} selector - CSS selector
 * @param {number} timeout - Max wait time in ms
 * @returns {Promise<Element>}
 */
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const check = () => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Element not found: ${selector}`));
      } else {
        setTimeout(check, 100);
      }
    };
    
    check();
  });
}

/**
 * Wait for an element to disappear from the DOM
 * @param {string} selector - CSS selector
 * @param {number} timeout - Max wait time in ms
 * @returns {Promise<void>}
 */
function waitForElementGone(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const check = () => {
      const element = document.querySelector(selector);
      if (!element) {
        resolve();
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Element still present: ${selector}`));
      } else {
        setTimeout(check, 100);
      }
    };
    
    check();
  });
}

/**
 * Delay execution
 * @param {number} ms - Milliseconds to wait
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Click an element
 * @param {string} selector - CSS selector
 * @param {Object} options - Click options
 */
async function clickElement(selector, options = {}) {
  const { waitFor = true, timeout = 10000, index = 0 } = options;
  
  let element;
  if (waitFor) {
    element = await waitForElement(selector, timeout);
  } else {
    const elements = document.querySelectorAll(selector);
    element = elements[index];
  }
  
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  
  // Scroll into view if needed
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await delay(100);
  
  // Simulate realistic click
  element.focus();
  element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  element.click();
  
  return { clicked: true, selector };
}

/**
 * Type text into an element
 * @param {string} selector - CSS selector
 * @param {string} text - Text to type
 * @param {Object} options - Type options
 */
async function typeText(selector, text, options = {}) {
  const { 
    waitFor = true, 
    timeout = 10000, 
    clear = true,
    delay: typeDelay = 0 
  } = options;
  
  let element;
  if (waitFor) {
    element = await waitForElement(selector, timeout);
  } else {
    element = document.querySelector(selector);
  }
  
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  
  // Focus the element
  element.focus();
  element.click();
  await delay(50);
  
  // Clear existing content if requested
  if (clear) {
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      element.value = '';
    } else if (element.isContentEditable || element.contentEditable === 'true') {
      element.textContent = '';
    }
    document.execCommand('selectAll', false, null);
  }
  
  // Type the text
  if (typeDelay > 0) {
    // Type character by character with delay
    for (const char of text) {
      document.execCommand('insertText', false, char);
      await delay(typeDelay);
    }
  } else {
    // Type all at once
    document.execCommand('insertText', false, text);
  }
  
  // Trigger input events
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  
  return { typed: true, selector, length: text.length };
}

/**
 * Find elements matching a selector
 * @param {string} selector - CSS selector
 * @param {Object} options - Find options
 */
function findElements(selector, options = {}) {
  const { limit = 10, attributes = ['id', 'class', 'data-testid', 'aria-label'] } = options;
  
  const elements = document.querySelectorAll(selector);
  const results = [];
  
  for (let i = 0; i < Math.min(elements.length, limit); i++) {
    const el = elements[i];
    const rect = el.getBoundingClientRect();
    
    const attrs = {};
    for (const attr of attributes) {
      if (el.hasAttribute(attr)) {
        attrs[attr] = el.getAttribute(attr);
      }
    }
    
    results.push({
      index: i,
      tagName: el.tagName.toLowerCase(),
      text: el.textContent?.substring(0, 100)?.trim(),
      visible: rect.width > 0 && rect.height > 0,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      attributes: attrs
    });
  }
  
  return { count: elements.length, elements: results };
}

/**
 * Get text content of an element
 * @param {string} selector - CSS selector
 */
async function getText(selector, options = {}) {
  const { waitFor = true, timeout = 10000, trim = true } = options;
  
  let element;
  if (waitFor) {
    element = await waitForElement(selector, timeout);
  } else {
    element = document.querySelector(selector);
  }
  
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  
  let text = element.textContent || '';
  if (trim) text = text.trim();
  
  return { text, selector };
}

/**
 * Get attribute value of an element
 * @param {string} selector - CSS selector
 * @param {string} attribute - Attribute name
 */
async function getAttribute(selector, attribute, options = {}) {
  const { waitFor = true, timeout = 10000 } = options;
  
  let element;
  if (waitFor) {
    element = await waitForElement(selector, timeout);
  } else {
    element = document.querySelector(selector);
  }
  
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  
  const value = element.getAttribute(attribute);
  return { attribute, value, selector };
}

/**
 * Set attribute value on an element
 * @param {string} selector - CSS selector
 * @param {string} attribute - Attribute name
 * @param {string} value - Attribute value
 */
async function setAttribute(selector, attribute, value, options = {}) {
  const { waitFor = true, timeout = 10000 } = options;
  
  let element;
  if (waitFor) {
    element = await waitForElement(selector, timeout);
  } else {
    element = document.querySelector(selector);
  }
  
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  
  element.setAttribute(attribute, value);
  return { attribute, value, selector };
}

/**
 * Scroll the page or an element
 * @param {Object} options - Scroll options
 */
async function scroll(options = {}) {
  const { 
    selector = null, 
    direction = 'down', 
    amount = 300,
    behavior = 'smooth'
  } = options;
  
  const target = selector ? document.querySelector(selector) : window;
  
  if (selector && !target) {
    throw new Error(`Element not found: ${selector}`);
  }
  
  const scrollOptions = { behavior };
  
  switch (direction) {
    case 'down':
      scrollOptions.top = amount;
      break;
    case 'up':
      scrollOptions.top = -amount;
      break;
    case 'left':
      scrollOptions.left = -amount;
      break;
    case 'right':
      scrollOptions.left = amount;
      break;
    case 'top':
      if (target === window) {
        window.scrollTo({ top: 0, behavior });
      } else {
        target.scrollTop = 0;
      }
      return { scrolled: true, direction };
    case 'bottom':
      if (target === window) {
        window.scrollTo({ top: document.body.scrollHeight, behavior });
      } else {
        target.scrollTop = target.scrollHeight;
      }
      return { scrolled: true, direction };
  }
  
  if (target === window) {
    window.scrollBy(scrollOptions);
  } else {
    target.scrollBy(scrollOptions);
  }
  
  return { scrolled: true, direction, amount };
}

/**
 * Hover over an element
 * @param {string} selector - CSS selector
 */
async function hover(selector, options = {}) {
  const { waitFor = true, timeout = 10000 } = options;
  
  let element;
  if (waitFor) {
    element = await waitForElement(selector, timeout);
  } else {
    element = document.querySelector(selector);
  }
  
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await delay(100);
  
  element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
  element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  
  return { hovered: true, selector };
}

/**
 * Focus an element
 * @param {string} selector - CSS selector
 */
async function focus(selector, options = {}) {
  const { waitFor = true, timeout = 10000 } = options;
  
  let element;
  if (waitFor) {
    element = await waitForElement(selector, timeout);
  } else {
    element = document.querySelector(selector);
  }
  
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  
  element.focus();
  return { focused: true, selector };
}

/**
 * Select option(s) in a select element
 * @param {string} selector - CSS selector for select element
 * @param {string|string[]} values - Value(s) to select
 */
async function selectOption(selector, values, options = {}) {
  const { waitFor = true, timeout = 10000 } = options;
  
  let element;
  if (waitFor) {
    element = await waitForElement(selector, timeout);
  } else {
    element = document.querySelector(selector);
  }
  
  if (!element || element.tagName !== 'SELECT') {
    throw new Error(`Select element not found: ${selector}`);
  }
  
  const valueArray = Array.isArray(values) ? values : [values];
  
  for (const option of element.options) {
    option.selected = valueArray.includes(option.value);
  }
  
  element.dispatchEvent(new Event('change', { bubbles: true }));
  
  return { selected: true, selector, values: valueArray };
}

/**
 * Check/uncheck a checkbox or radio button
 * @param {string} selector - CSS selector
 * @param {boolean} checked - Whether to check or uncheck
 */
async function setChecked(selector, checked = true, options = {}) {
  const { waitFor = true, timeout = 10000 } = options;
  
  let element;
  if (waitFor) {
    element = await waitForElement(selector, timeout);
  } else {
    element = document.querySelector(selector);
  }
  
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  
  if (element.checked !== checked) {
    element.click();
  }
  
  return { checked: element.checked, selector };
}

/**
 * Get page info
 */
function getPageInfo() {
  return {
    url: window.location.href,
    title: document.title,
    readyState: document.readyState,
    scrollY: window.scrollY,
    scrollX: window.scrollX,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    documentHeight: document.documentElement.scrollHeight,
    documentWidth: document.documentElement.scrollWidth
  };
}

/**
 * Execute a primitive command
 */
async function executePrimitive(command) {
  const { action, ...params } = command;
  
  try {
    switch (action) {
      case 'click':
        return { success: true, result: await clickElement(params.selector, params.options) };
        
      case 'type':
        return { success: true, result: await typeText(params.selector, params.text, params.options) };
        
      case 'find':
        return { success: true, result: findElements(params.selector, params.options) };
        
      case 'getText':
        return { success: true, result: await getText(params.selector, params.options) };
        
      case 'getAttribute':
        return { success: true, result: await getAttribute(params.selector, params.attribute, params.options) };
        
      case 'setAttribute':
        return { success: true, result: await setAttribute(params.selector, params.attribute, params.value, params.options) };
        
      case 'scroll':
        return { success: true, result: await scroll(params.options || params) };
        
      case 'hover':
        return { success: true, result: await hover(params.selector, params.options) };
        
      case 'focus':
        return { success: true, result: await focus(params.selector, params.options) };
        
      case 'select':
        return { success: true, result: await selectOption(params.selector, params.values, params.options) };
        
      case 'setChecked':
        return { success: true, result: await setChecked(params.selector, params.checked, params.options) };
        
      case 'wait':
        return { success: true, result: await waitForElement(params.selector, params.timeout || 10000).then(() => ({ found: true, selector: params.selector })) };
        
      case 'waitGone':
        return { success: true, result: await waitForElementGone(params.selector, params.timeout || 10000).then(() => ({ gone: true, selector: params.selector })) };
        
      case 'delay':
        await delay(params.ms || 1000);
        return { success: true, result: { delayed: true, ms: params.ms || 1000 } };
        
      case 'pageInfo':
        return { success: true, result: getPageInfo() };
        
      case 'evaluate':
        // Execute arbitrary JavaScript
        const evalResult = eval(params.script);
        return { success: true, result: evalResult };
        
      default:
        return { success: false, error: `Unknown primitive action: ${action}` };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Listen for primitive commands from background script
window.addEventListener('marketclaw:primitive', async (event) => {
  const command = event.detail;
  console.log('[MarketClaw] Executing primitive:', command.action);
  
  const result = await executePrimitive(command);
  
  window.dispatchEvent(new CustomEvent('marketclaw:primitiveResult', {
    detail: result
  }));
});

// Also listen for direct messages from extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'primitive') {
    executePrimitive(message.command).then(sendResponse);
    return true; // Async response
  }
});

// Export for testing
if (typeof module !== 'undefined') {
  module.exports = {
    waitForElement,
    waitForElementGone,
    delay,
    clickElement,
    typeText,
    findElements,
    getText,
    getAttribute,
    setAttribute,
    scroll,
    hover,
    focus,
    selectOption,
    setChecked,
    getPageInfo,
    executePrimitive
  };
}
