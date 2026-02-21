# Document Reading Support

MarketClaw can read and extract text from PDF, Word, and plain text documents. When you send a document, MarketClaw automatically extracts the text content and includes it in the conversation context.

## Supported Formats

| Format | Extension | MIME Type | Notes |
|--------|-----------|-----------|-------|
| PDF | `.pdf` | `application/pdf` | Standard PDFs; scanned/image-only PDFs may have limited support |
| Word (DOCX) | `.docx` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | Full support |
| Word (DOC) | `.doc` | `application/msword` | Limited support; DOCX recommended |
| Plain Text | `.txt` | `text/plain` | Full UTF-8 support |

## How to Send Documents

### Telegram
Simply send the document as a file attachment. You can optionally include a caption/message with the document.

### Discord
Upload the file as an attachment. Mention the bot or use the command prefix to ensure it processes the document.

### Slack
Share the file in a DM or channel where the bot is present. In channels, mention the bot to trigger processing.

## Size Limits

- **Text Extraction Limit**: Documents are truncated to the first **50,000 characters** to prevent token limit issues
- **Platform Limits**: Each platform (Telegram, Discord, Slack) has its own file size limits:
  - Telegram: Up to 50MB for documents
  - Discord: Up to 25MB (or 100MB with Nitro)
  - Slack: Depends on workspace plan

## Example Usage

### Telegram
```
[Send a PDF document]

User: [Attaches contract.pdf]
User: "Can you summarize this contract?"

MarketClaw: "Based on the document you sent, here's a summary of the contract:
- The agreement is between Company A and Company B
- Duration: 12 months starting January 1st, 2024
- Key terms include..."
```

### With Caption
```
User: [Attaches report.docx]
User: "What are the main findings in this report?"

MarketClaw: "The report highlights three main findings:
1. Revenue increased by 15% year-over-year
2. Customer retention improved to 92%
3. New market expansion opportunities in Asia..."
```

## Technical Details

### Parsing Libraries
- **PDF**: Uses `pdf-parse` for text extraction
- **Word (DOCX/DOC)**: Uses `mammoth` for conversion to text
- **Plain Text**: Direct UTF-8 decoding

### Message Structure
When a document is processed, the extracted text is included in the message content. The `ChannelMessage` object includes:

```typescript
{
  text: "User's caption or document text",
  documents: [{
    id: "doc_filename_timestamp_random",
    filename: "document.pdf",
    mimeType: "application/pdf",
    text: "Extracted document content...",
    pageCount: 5,        // For PDFs
    wordCount: 1234
  }],
  metadata: {
    hasDocument: true,
    filename: "document.pdf"
  }
}
```

## Limitations

1. **Scanned PDFs**: PDFs that are scanned images (not text-based) cannot be parsed. The extracted text will be empty or minimal.

2. **Complex Formatting**: Tables, images, and complex layouts may not preserve their structure in extracted text.

3. **DOC Files**: Legacy `.doc` files have limited support. Convert to `.docx` for better results.

4. **Encrypted Documents**: Password-protected documents cannot be read.

5. **Large Documents**: Documents exceeding 50,000 characters are truncated with a notice.

## Troubleshooting

### "Unsupported file type" Error
The file format is not supported. Check that your document is a PDF, DOCX, DOC, or TXT file.

### Empty or Missing Text
- For PDFs: The document may be scanned/image-based
- For DOC files: Try converting to DOCX format
- The file may be corrupted or encrypted

### Truncated Content
Documents over 50,000 characters are automatically truncated. The response will include a notice: `[Document truncated - showing first 50,000 characters]`
