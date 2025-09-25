// Demo Fake Backend split from main widget
import { uid, nowIso, sleep } from './utils.js';

export class FakeBackend {
  constructor(){
    this.users = [
      { id: 'me', name: 'You', online: true },
      { id: 'u_alex', name: 'Alex', online: true },
      { id: 'u_sam', name: 'Sam', online: false },
      { id: 'u_jamie', name: 'Jamie', online: true },
    ];
    this.conversations = [
      { id: 'c_general', name: 'General', participants: ['me','u_alex','u_jamie'], createdAt: nowIso(), updatedAt: nowIso() },
      { id: 'c_support', name: 'Support', participants: ['me','u_sam'], createdAt: nowIso(), updatedAt: nowIso() },
    ];
    const iso = nowIso();
    this.messages = [
      { id: uid(), conversationId: 'c_general', authorId: 'u_alex', text: 'Welcome to the demo! 🎉', createdAt: iso, updatedAt: iso, attachments: [], channels: {sms:false,whatsapp:true,email:false}, seenBy: [{userId:'me', at: iso}] },
      { id: uid(), conversationId: 'c_support', authorId: 'u_sam', text: 'How can I help?', createdAt: iso, updatedAt: iso, attachments: [], channels: {sms:true,whatsapp:false,email:true}, seenBy: [] },
    ];
    this.drafts = new Map(); // key: conversationId -> { text, attachments }
    this.typing = new Map(); // key: conversationId -> { [userId]: untilTs }
    this.lastChange = Date.now();
  }
  _touch(){ this.lastChange = Date.now(); }
  async listMessages(since){
    const sinceMs = since ? (typeof since === 'string' ? Date.parse(since) : since) : 0;
    const changedMsgs = this.messages.filter(m => Date.parse(m.updatedAt) > sinceMs);
    const changedConvos = this.conversations.filter(c => Date.parse(c.updatedAt) > sinceMs || Date.parse(c.createdAt) > sinceMs);
    const typing = [];
    const now = Date.now();
    for (const [cid, map] of this.typing.entries()){
      for (const [uid_, until] of Object.entries(map)){
        if (until > now) typing.push({ conversationId: cid, userId: uid_, until });
      }
    }
    const presence = this.users.map(u => ({ userId: u.id, online: u.online }));
    return {
      ok: true,
      changes: { messages: changedMsgs, conversations: changedConvos, typing, presence },
      serverTime: nowIso()
    };
  }
  async sendMessage({ conversationId, text, attachments, channels, scheduleAt }){
    await sleep(250 + Math.random()*400);
    const iso = scheduleAt ? new Date(scheduleAt).toISOString() : nowIso();
    const msg = { id: uid(), conversationId, authorId: 'me', text, createdAt: iso, updatedAt: iso, attachments: attachments||[], channels: channels||{}, seenBy: [] };
    this.messages.push(msg);
    const convo = this.conversations.find(c => c.id === conversationId);
    if (convo){ convo.updatedAt = iso; this._touch(); }
    const typer = 'u_alex';
    const until = Date.now() + 1500 + Math.floor(Math.random()*1500);
    const tmap = this.typing.get(conversationId) || {}; tmap[typer] = until; this.typing.set(conversationId, tmap); this._touch();
    setTimeout(() => {
      const reply = { id: uid(), conversationId, authorId: 'u_alex', text: 'Auto-reply (demo): '+(Math.random()<0.5?'👍':'Got it!'), createdAt: nowIso(), updatedAt: nowIso(), attachments: [], channels: { sms: false, whatsapp: true, email: false }, seenBy: [] };
      this.messages.push(reply);
      const c = this.conversations.find(x => x.id === conversationId); if (c){ c.updatedAt = nowIso(); this._touch(); }
    }, 800 + Math.random()*1500);
    return { ok: true, message: msg };
  }
  async editMessage({ id, newText }){
    const m = this.messages.find(x => x.id === id);
    if (!m) return { ok:false, error: 'not_found' };
    m.text = newText; m.updatedAt = nowIso(); this._touch();
    return { ok: true };
  }
  async uploadFile({ file }){
    await sleep(300 + Math.random()*500);
    const id = uid();
    const att = { id, name: file.name, size: file.size, type: file.type || 'application/octet-stream', url: URL.createObjectURL(file) };
    return { ok: true, attachment: att };
  }
  async saveDraft({ conversationId, text, attachments }){
    this.drafts.set(conversationId, { text, attachments: attachments || [] });
    this._touch();
    return { ok: true };
  }
  async getDraft({ conversationId }){
    return { ok: true, draft: this.drafts.get(conversationId) || { text: '', attachments: [] } };
  }
  async startConversation({ participants }){
    const id = 'c_' + uid();
    const name = 'Chat with ' + participants.filter(x => x !== 'me').map(x => this.users.find(u => u.id===x)?.name || x).join(', ');
    const iso = nowIso();
    const convo = { id, name, participants: Array.from(new Set(['me', ...participants])), createdAt: iso, updatedAt: iso };
    this.conversations.push(convo);
    this._touch();
    return { ok: true, conversation: convo };
  }
  async addParticipant({ conversationId, userId }){
    const c = this.conversations.find(x => x.id === conversationId); if (!c) return { ok:false };
    if (!c.participants.includes(userId)) c.participants.push(userId);
    c.updatedAt = nowIso(); this._touch();
    return { ok: true };
  }
  async removeParticipant({ conversationId, userId }){
    const c = this.conversations.find(x => x.id === conversationId); if (!c) return { ok:false };
    c.participants = c.participants.filter(x => x !== userId);
    c.updatedAt = nowIso(); this._touch();
    return { ok: true };
  }
  async markAsRead({ conversationId, messageIds }){
    const iso = nowIso();
    for (const m of this.messages) {
      if (m.conversationId === conversationId && messageIds.includes(m.id)) {
        const has = m.seenBy.find(s => s.userId === 'me');
        if (!has) m.seenBy.push({ userId: 'me', at: iso }); else has.at = iso;
        m.updatedAt = iso;
      }
    }
    this._touch();
    return { ok: true };
  }
}

