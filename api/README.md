# Chat Bot PHP API (Demo)

This folder contains simple PHP endpoint examples that return hardcoded JSON.

They mirror the URLs you can configure in the frontend when `demoMode` is false.

## Endpoints (no dynamic path segments)

Messages
- GET /api/messages/index.php?since={timestamp}
- POST /api/messages/send.php
- POST /api/messages/edit.php  (body: { id, newText })
- POST /api/messages/draft.php (body: { conversationId, text, attachments })
- GET  /api/messages/draft.php?conversationId={conversationId}
- POST /api/messages/markAsRead.php (body: { conversationId, messageIds })

Files
- POST /api/files/upload.php (multipart/form-data, field: file)

Conversations
- POST /api/conversations/start.php (body: { participants: string[] })
- POST /api/conversations/addParticipant.php (body: { conversationId, userId })
- POST /api/conversations/removeParticipant.php (body: { conversationId, userId })

Users
- GET /api/users/search.php?q=...

## URL configuration (required)
There are no default URLs in the frontend when `demoMode` is false. You must specify every endpoint you use via `data-chatbot-settings.urls` in your HTML (see `index.html` for a complete example). If any URL is missing, the frontend throws a clear error at runtime.

Example minimal config:

```html
<div
  id="chatbot-anchor"
  data-chatbot-settings='{
    "demoMode": false,
    "urls": {
      "listMessages": "/api/messages/index.php?since={timestamp}",
      "sendMessage": "/api/messages/send.php",
      "editMessage": "/api/messages/edit.php",
      "uploadFile": "/api/files/upload.php",
      "searchUsers": "/api/users/search.php?q={query}",
      "startConversation": "/api/conversations/start.php",
      "addParticipant": "/api/conversations/addParticipant.php",
      "removeParticipant": "/api/conversations/removeParticipant.php",
      "saveDraft": "/api/messages/draft.php",
      "getDraft": "/api/messages/draft.php?conversationId={conversationId}",
      "markAsRead": "/api/messages/markAsRead.php"
    }
  }'>
</div>
<script type="module" src="/src/chatbot.js"></script>
```

## Notes
- These endpoints are static and return demo data only. Replace hardcoded values with your real logic.
- They respond with JSON structures compatible with the frontend (see `src/fakeBackend.js` for shape).
- Upload endpoint echoes back basic file info; it does not store a file.
