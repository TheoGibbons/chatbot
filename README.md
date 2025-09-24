# Chatbot Widget (Vanilla JS)

A backend-agnostic, drop-in JavaScript chatbot widget that floats on the bottom-right of any website. Includes a zero-config demo mode so it works out-of-the-box from a Git clone.

- Floating launcher + responsive chat window
- Conversations, participants manager (add/remove)
- Drafts autosaved (server-side in demo), file uploads with progress, attachments on messages
- Channels: SMS / WhatsApp / Email with per-channel checkboxes and WhatsApp 24h window tooltip
- Send now or schedule delivery (date/time picker)
- Polling sync (first full sync, then deltas since last timestamp)
- Read receipts with timestamps, typing indicators, online presence
- Optimistic UI with reconciliation on server ack
- Exposes a tiny JS API via `window.ChatbotAPI`


## Quick start

1) Clone and open the demo page

- Just open `index.html` in your browser. Demo mode is enabled by default so no server is required.

2) Try it

- Click the blue launcher to open the chat.
- Send a message; the demo backend will auto-reply and simulate typing and presence.

To embed in any site, copy the `<link>`, `<script>`, and the settings `<div>` from `index.html` into your page.


## Embed snippet

```html
<link rel="stylesheet" href="/path/to/src/chatbot.css" />
<div
  data-chatbot-settings='{
    "pollForMessages": 10000,
    "canStartMultipleConversations": true,
    "channels": {
      "sms": true,
      "whatsapp": { "enabledUntil": "2025-09-24T12:34:54Z" },
      "email": true
    },
    "fileUpload": {
      "maxFilesPerMessage": 10,
      "maxFileSizeSingleFile": 10000000,
      "limitFileTypes": ["png","jpg","pdf","xls","gif","jpeg"]
    },
    "urls": {
      "listMessages": "/api/messages?since={timestamp}",
      "sendMessage": "/api/messages/send",
      "editMessage": "/api/messages/{id}/edit",
      "uploadFile": "/api/files/upload"
    },
    "demoMode": true
  }'
></div>
<script src="/path/to/src/chatbot.js"></script>
```

- Place the `<div>` anywhere in your HTML. The widget self-initializes on DOM load.
- Set `demoMode: true` for the built-in fake backend; set `false` to call your real endpoints.


## Configuration

Top-level options (JSON on `data-chatbot-settings`):

- pollForMessages: number (ms), default 10000
- canStartMultipleConversations: boolean, default true. If false, the New conversation button is hidden
- channels: object with feature flags:
  - sms: boolean
  - whatsapp: { enabledUntil: ISO8601 | null } — disables the WhatsApp checkbox outside the 24-hour window and shows a tooltip explaining why
  - email: boolean
- fileUpload: limits
  - maxFilesPerMessage: number (default 10)
  - maxFileSizeSingleFile: number in bytes (default 10MB)
  - limitFileTypes: array of extensions without dot (e.g., ["png","pdf"]) — optional
- urls: only used when demoMode is false
  - listMessages: string, supports `{timestamp}` token
  - sendMessage: string
  - editMessage: string, supports `{id}` token
  - uploadFile: string
  - Optional (if you implement them):
    - startConversation, addParticipant, removeParticipant, saveDraft, getDraft, markAsRead
- demoMode: boolean, default true
- theme: 'light' | 'dark' | 'auto' (default 'auto')


## Demo mode

When `demoMode: true`, the widget routes all API calls to an in-memory fake backend:

- Two preloaded conversations and a few users with presence status
- Saves drafts per conversation while you type
- Simulates file uploads and returns blob URLs so you can download attachments
- Randomly posts auto-replies and emits typing activity

When you switch `demoMode` off, the widget uses `fetch()` to call your provided URLs.


## Switching to a real backend

Set `demoMode: false` and provide URLs:

```json
{
  "demoMode": false,
  "urls": {
    "listMessages": "/api/messages?since={timestamp}",
    "sendMessage": "/api/messages/send",
    "editMessage": "/api/messages/{id}/edit",
    "uploadFile": "/api/files/upload",
    "startConversation": "/api/conversations/start",
    "addParticipant": "/api/conversations/{conversationId}/participants",
    "removeParticipant": "/api/conversations/{conversationId}/participants/{userId}",
    "saveDraft": "/api/messages/draft",
    "getDraft": "/api/messages/{conversationId}/draft",
    "markAsRead": "/api/messages/markAsRead"
  }
}
```

Expected payloads (you can adapt on your side):

- listMessages: GET, returns `{ ok, changes: { messages, conversations, typing, presence }, serverTime }`
  - Should include changes updated after `since`. For first load, a full snapshot is fine.
- sendMessage: POST `{ conversationId, text, attachments, channels, scheduleAt }` → `{ ok, message }`
- editMessage: POST `{ newText }` → `{ ok }`
- uploadFile: POST multipart form-data `file` → `{ ok, attachment }` where `attachment = { id, name, size, type, url }`
- saveDraft / getDraft: saves or fetches `{ text, attachments }` per conversation
- startConversation: POST `{ participants: string[] }` → `{ ok, conversation }`
- addParticipant/removeParticipant: add or remove a user in a conversation
- markAsRead: POST `{ conversationId, messageIds }` → `{ ok }`


## Public JS API

A global `window.ChatbotAPI` is exposed after load:

```ts
ChatbotAPI = {
  open(): void
  close(): void
  toggle(): void
  startConversation(participants: string[]): Promise<Conversation>
  addUserToConversation(conversationId: string, userId: string): Promise<void>
  sendMessage(conversationId: string, message: { text: string, scheduleAt?: string }): Promise<void>
  editMessage(messageId: string, newText: string): Promise<void>
  markAsRead(conversationId: string, messageIds: string[]): Promise<void>
  getUnreadCount(): number
  on(event: 'message' | 'conversation' | 'typing' | 'read', callback: Function): void
  setTheme(theme: 'light' | 'dark' | 'auto'): void
}
```

Examples:

```html
<button onclick="ChatbotAPI.open()">Contact us</button>
<script>
  ChatbotAPI.on('message', (m) => console.log('New message', m));
  ChatbotAPI.setTheme('auto');
</script>
```


## Styling and theming

- Uses CSS variables; toggles a `cb-dark` class for dark theme.
- You can override variables in your page to tweak colors/font.


## Notes and constraints

- While any file is uploading, the Send button is disabled.
- WhatsApp checkbox is auto-disabled if the 24-hour window (`channels.whatsapp.enabledUntil`) has passed; a tooltip indicates the reason.
- Conversation picker (sidebar) appears only when the user belongs to more than one conversation.


## Developing locally

- Demo works by opening `index.html` directly in a browser (no server needed).
- If you want a local static server, any will do. Examples:

Windows cmd (Python installed):

```bat
python -m http.server 8080
```

Node (npx):

```bat
npx serve . -l 8080
```

Then open http://localhost:8080/ in your browser.


## License

MIT (or choose your preferred license).

