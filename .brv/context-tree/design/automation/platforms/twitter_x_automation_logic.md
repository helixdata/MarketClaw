## Raw Concept
**Task:**
Document DOM-based automation for Twitter/X

**Files:**
- extension/content-scripts/twitter.js

**Flow:**
dismissModals -> open composer (if needed) -> find composer element -> focus & typeText (execCommand) -> find post button -> click post -> verify success

**Timestamp:** 2026-02-23

## Narrative
### Structure
The script uses specific `data-testid` selectors to interact with Twitter's React-based UI. It handles both the inline composer and the dedicated compose page.

### Features
Modal dismissal (popups like "You've unlocked more on X"), natural text typing via `execCommand`, and post-verification logic.

### Rules
1. Use `data-testid="tweetTextarea_0"` to find the main text area.
2. Use `data-testid="tweetButton"` or `data-testid="tweetButtonInline"` for the submit action.
3. Dismiss modals before and after posting to ensure UI clarity.
4. Use `document.execCommand("insertText", ...)` for reliable text insertion into Draft.js editors.

### Examples
Composer Selectors Used:
- `[data-testid="tweetTextarea_0"]`
- `[role="textbox"][data-testid="tweetTextarea_0"]`
- `.public-DraftEditor-content`
