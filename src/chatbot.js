// ES module entry: initialize ChatbotWidget and expose window.ChatbotAPI
import { ChatbotWidget } from './chatbotWidget.js';

function parseSettingsFrom(el){
  try { return JSON.parse(el.getAttribute('data-chatbot-settings') || '{}'); } catch(e){ console.warn('Invalid data-chatbot-settings JSON', e); return {}; }
}

function initAll(){
  const anchors = Array.from(document.querySelectorAll('[data-chatbot-settings]'));
  if (!anchors.length) return;
  const el = anchors[0];
  const settings = parseSettingsFrom(el);
  const widget = new ChatbotWidget(el, settings);

  // Expose API
  window.ChatbotAPI = {
    open: () => widget.open(),
    close: () => widget.close(),
    toggle: () => widget.toggle(),
    startConversation: (participants) => widget.startConversation(participants),
    addUserToConversation: (conversationId, userId) => widget.addUserToConversation(conversationId, userId),
    sendMessage: (conversationId, messageDraft) => widget.sendMessage(conversationId, messageDraft),
    editMessage: (messageId, newText) => widget.editMessage(messageId, newText),
    markAsRead: (conversationId, messageIds) => widget.markAsRead(conversationId, messageIds),
    getUnreadCount: () => widget.getUnreadCount(),
    on: (event, cb) => widget.on(event, cb),
    setTheme: (theme) => widget.setTheme(theme),
    addServerMessage: (conversationId, text) => widget.addServerMessage(conversationId, text),
  };
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll);
else initAll();
