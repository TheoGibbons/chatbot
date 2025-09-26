# Chat Bot PHP API (Demo)

This folder contains simple PHP endpoint examples that return hardcoded JSON.

They mirror the URLs used by `src/apiClient.js` when `demoMode` is false.

## Endpoints

Messages
- GET /api/messages?since={timestamp} -> messages/index.php
- POST /api/messages/send -> messages/send.php
- POST /api/messages/{id}/edit -> messages/edit.php (via rewrite)
- POST /api/messages/draft -> messages/draft.php
- GET /api/messages/{conversationId}/draft -> messages/getDraft.php (via rewrite)
- POST /api/messages/markAsRead -> messages/markAsRead.php

Files
- POST /api/files/upload -> files/upload.php

Conversations
- POST /api/conversations/start -> conversations/start.php
- POST /api/conversations/{conversationId}/participants -> conversations/addParticipant.php (via rewrite)
- DELETE /api/conversations/{conversationId}/participants/{userId} -> conversations/removeParticipant.php (via rewrite)

Users
- GET /api/users/search?q=... -> users/search.php

## IIS URL Rewrite
`api/web.config` adds rewrite rules so dynamic paths like `/api/messages/123/edit` map to `messages/edit.php?id=123`.
Make sure the IIS URL Rewrite module is installed and enabled.

## Switch the frontend to call these endpoints
The widget defaults to demo mode. Disable it and it will start using the endpoints above.

In your `index.html`, set data-chatbot-settings to include `"demoMode": false` (other options omitted here):

```html
<div data-chatbot-settings='{"demoMode":false}'></div>
<script type="module" src="/src/chatbot.js"></script>
```

No custom URL mapping is required if you keep this folder at `/api`.

## Notes
- These endpoints are static and return demo data only. Replace hardcoded values with your real logic.
- They respond with JSON structures compatible with the frontend (see `src/fakeBackend.js` for shape).
- Upload endpoint echoes back basic file info; it does not store a file.

