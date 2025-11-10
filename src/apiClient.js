import { FakeBackend } from './fakeBackend.js';

export class ApiClient {
  constructor(settings){
    this.settings = settings;
    this.demo = settings.demoMode ? new FakeBackend() : null;
  }

  // Enforce presence of URLs when not in demo mode
  _requireUrl(name){
    if (this.demo) return ''; // not used in demo paths
    const url = this.settings?.urls?.[name];
    if (!url) throw new Error(`ApiClient: missing settings.urls["${name}"]`);
    return url;
  }

  async listChanges(since){
    if (this.demo) return this.demo.listMessages(since);
    const urlTmpl = this._requireUrl('listMessages');
    const url = urlTmpl.replace('{timestamp}', encodeURIComponent(since || ''));
    const res = await fetch(url, { credentials: 'include' });
    return res.json();
  }
  async sendMessage(payload){
    if (this.demo) return this.demo.sendMessage(payload);
    const url = this._requireUrl('sendMessage');
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'include' });
    return res.json();
  }
  async editMessage(id, newText){
    if (this.demo) return this.demo.editMessage({ id, newText });
    const url = this._requireUrl('editMessage');
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, newText }), credentials: 'include' });
    return res.json();
  }
  async deleteMessage(id){
    if (this.demo) return this.demo.deleteMessage({ id });
    const url = this._requireUrl('deleteMessage');
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }), credentials: 'include' });
    return res.json();
  }
  async canEditMessage(id){
    if (this.demo) return this.demo.canEditMessage({ id });
    const url = this._requireUrl('canEditMessage');
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }), credentials: 'include' });
    return res.json();
  }
  async canDeleteMessage(id){
    if (this.demo) return this.demo.canDeleteMessage({ id });
    const url = this._requireUrl('canDeleteMessage');
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }), credentials: 'include' });
    return res.json();
  }
  async uploadFile(file){
    if (this.demo) return this.demo.uploadFile({ file });
    const url = this._requireUrl('uploadFile');
    const fd = new FormData(); fd.append('file', file);
    const res = await fetch(url, { method: 'POST', body: fd, credentials: 'include' });
    return res.json();
  }
  async saveDraft(conversationId, text, attachments){
    if (this.demo) return this.demo.saveDraft({ conversationId, text, attachments });
    const url = this._requireUrl('saveDraft');
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId, text, attachments }), credentials: 'include' });
    return res.json();
  }
  async getDraft(conversationId){
    if (this.demo) return this.demo.getDraft({ conversationId });
    const urlTmpl = this._requireUrl('getDraft');
    const url = urlTmpl.replace('{conversationId}', encodeURIComponent(conversationId));
    const res = await fetch(url, { credentials: 'include' });
    return res.json();
  }
  async startConversation(participants){
    if (this.demo) return this.demo.startConversation({ participants });
    const url = this._requireUrl('startConversation');
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ participants }), credentials: 'include' });
    return res.json();
  }
  async addParticipant(conversationId, userId){
    if (this.demo) return this.demo.addParticipant({ conversationId, userId });
    const url = this._requireUrl('addParticipant');
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId, userId }), credentials: 'include' });
    return res.json();
  }
  async removeParticipant(conversationId, userId){
    if (this.demo) return this.demo.removeParticipant({ conversationId, userId });
    const url = this._requireUrl('removeParticipant');
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId, userId }), credentials: 'include' });
    return res.json();
  }
  async markAsRead(conversationId, messageIds){
    if (this.demo) return this.demo.markAsRead({ conversationId, messageIds });
    const url = this._requireUrl('markAsRead');
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversationId, messageIds }), credentials: 'include' });
    return res.json();
  }
  async searchUsers(query){
    if (this.demo) return this.demo.searchUsers({ query });
    const urlTmpl = this._requireUrl('searchUsers');
    const url = urlTmpl.replace('{query}', encodeURIComponent(query || ''));
    const res = await fetch(url, { credentials: 'include' });
    return res.json();
  }
  async addServerMessage(conversationId, text){
    if (this.demo) return this.demo.addServerMessage({ conversationId, text });
    // Non-demo: server inserts messages; clients receive via listChanges.
    return { ok: false, error: 'not_supported_in_production' };
  }
}
