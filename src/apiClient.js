import { FakeBackend } from './fakeBackend.js';

export class ApiClient {
  constructor(settings){
    this.settings = settings;
    this.demo = settings.demoMode ? new FakeBackend() : null;
  }
  async listChanges(since){
    if (this.demo) return this.demo.listMessages(since);
    const urlTmpl = this.settings.urls?.listMessages || '/api/messages?since={timestamp}';
    const url = urlTmpl.replace('{timestamp}', encodeURIComponent(since || ''));
    const res = await fetch(url, { credentials: 'include' });
    return res.json();
  }
  async sendMessage(payload){
    if (this.demo) return this.demo.sendMessage(payload);
    const url = this.settings.urls?.sendMessage || '/api/messages/send';
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'include' });
    return res.json();
  }
  async editMessage(id, newText){
    if (this.demo) return this.demo.editMessage({ id, newText });
    const urlTmpl = this.settings.urls?.editMessage || '/api/messages/{id}/edit';
    const url = urlTmpl.replace('{id}', encodeURIComponent(id));
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newText }), credentials: 'include' });
    return res.json();
  }
  async uploadFile(file){
    if (this.demo) return this.demo.uploadFile({ file });
    const url = this.settings.urls?.uploadFile || '/api/files/upload';
    const fd = new FormData(); fd.append('file', file);
    const res = await fetch(url, { method: 'POST', body: fd, credentials: 'include' });
    return res.json();
  }
  async saveDraft(conversationId, text, attachments){
    if (this.demo) return this.demo.saveDraft({ conversationId, text, attachments });
    const url = (this.settings.urls?.saveDraft) || '/api/messages/draft';
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId, text, attachments }), credentials: 'include' });
    return res.json();
  }
  async getDraft(conversationId){
    if (this.demo) return this.demo.getDraft({ conversationId });
    const url = (this.settings.urls?.getDraft) || (`/api/messages/${encodeURIComponent(conversationId)}/draft`);
    const res = await fetch(url, { credentials: 'include' });
    return res.json();
  }
  async startConversation(participants){
    if (this.demo) return this.demo.startConversation({ participants });
    const url = this.settings.urls?.startConversation || '/api/conversations/start';
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ participants }), credentials: 'include' });
    return res.json();
  }
  async addParticipant(conversationId, userId){
    if (this.demo) return this.demo.addParticipant({ conversationId, userId });
    const url = this.settings.urls?.addParticipant || `/api/conversations/${encodeURIComponent(conversationId)}/participants`;
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }), credentials: 'include' });
    return res.json();
  }
  async removeParticipant(conversationId, userId){
    if (this.demo) return this.demo.removeParticipant({ conversationId, userId });
    const url = this.settings.urls?.removeParticipant || `/api/conversations/${encodeURIComponent(conversationId)}/participants/${encodeURIComponent(userId)}`;
    const res = await fetch(url, { method: 'DELETE', credentials: 'include' });
    return res.json();
  }
  async markAsRead(conversationId, messageIds){
    if (this.demo) return this.demo.markAsRead({ conversationId, messageIds });
    const url = this.settings.urls?.markAsRead || `/api/messages/markAsRead`;
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId, messageIds }), credentials: 'include' });
    return res.json();
  }
  async searchUsers(query){
    if (this.demo) return this.demo.searchUsers({ query });
    const urlTmpl = this.settings.urls?.searchUsers || '/api/users/search?q={query}';
    const url = urlTmpl.replace('{query}', encodeURIComponent(query || ''));
    const res = await fetch(url, { credentials: 'include' });
    return res.json();
  }
}
