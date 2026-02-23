## Raw Concept
**Task:**
Document DOM-based automation for LinkedIn posting

**Files:**
- extension/content-scripts/linkedin.js

**Flow:**
click "Start a post" -> find .ql-editor -> focus & type content (execCommand) -> find post button -> click post -> verify success

**Timestamp:** 2026-02-23

## Narrative
### Structure
The script targets LinkedIn's Quill-based editor (`.ql-editor`) and uses standard CSS classes for interaction. It handles the multi-step process of opening the share modal and publishing content.

### Features
Support for multi-line content using `insertLineBreak`, automated modal trigger, and post-publication verification.

### Rules
1. Use `.ql-editor` or `[data-test-ql-editor="true"]` to locate the content editable area.
2. Use `.share-actions__primary-action` or `[data-control-name="share.post"]` for the final post action.
3. Content must be inserted line-by-line using `insertText` followed by `insertLineBreak` for proper formatting.

### Examples
LinkedIn Editor Selectors:
- `.ql-editor`
- `[data-test-ql-editor="true"]`
- `.share-creation-state__text-editor .ql-editor`
- `[contenteditable="true"]`
