/*
  Chatbot Widget - Vanilla JS, backend-agnostic
  - Floating launcher + window
  - Conversations, drafts with file uploads, channels (sms/whatsapp/email)
  - Polling sync (deltas since timestamp)
  - Optimistic UI, typing indicators, presence, read receipts
  - Demo mode with fake backend
  - Exposes window.ChatbotAPI
*/
(function () {
  'use strict';

  // ---------- Utilities ----------
  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  const nowIso = () => new Date().toISOString();
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const escapeHtml = (s) => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  const h = (tag, attrs = {}, children = []) => {
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const isSvg = String(tag).toLowerCase() === 'svg';
    const el = isSvg ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') el.className = v;
      else if (k === 'style') el.setAttribute('style', v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null) el.setAttribute(k, v);
    }
    if (!Array.isArray(children)) children = [children];
    for (const c of children) {
      if (c == null) continue;
      if (c instanceof Node) { el.appendChild(c); continue; }
      if (isSvg && typeof c === 'string') {
        // Parse as SVG to ensure correct namespace for children
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<svg xmlns="${SVG_NS}">${c}</svg>`, 'image/svg+xml');
        const nodes = Array.from(doc.documentElement.childNodes);
        for (const n of nodes) { if (n.nodeType === 1 || (n.nodeType === 3 && n.textContent.trim() === '')) el.appendChild(n); }
        continue;
      }
      el.insertAdjacentHTML('beforeend', typeof c === 'string' ? c : String(c));
    }
    return el;
  };
  const fmtTime = (iso) => {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleString();
  };
  const timeAgo = (iso) => {
    const d = new Date(iso); const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return `${s}s ago`; const m = Math.floor(s/60);
    if (m < 60) return `${m}m ago`; const h = Math.floor(m/60);
    if (h < 24) return `${h}h ago`; const days = Math.floor(h/24);
    return `${days}d ago`;
  };
  const bytes = (n) => {
    const u = ['B','KB','MB','GB']; let i = 0; let x = n;
    while (x >= 1024 && i < u.length-1) { x/=1024; i++; }
    return `${x.toFixed(x<10&&i>0?1:0)} ${u[i]}`;
  };
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  // Simple event emitter
  class Emitter {
    constructor(){ this.map = new Map(); }
    on(evt, fn){ if (!this.map.has(evt)) this.map.set(evt, new Set()); this.map.get(evt).add(fn); }
    off(evt, fn){ this.map.get(evt)?.delete(fn); }
    emit(evt, ...args){ this.map.get(evt)?.forEach(fn => { try{ fn(...args); }catch(e){ console.error(e);} }); }
  }

  // ---------- Demo Fake Backend ----------
  class FakeBackend {
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
      // Return changes since timestamp (ms or ISO). Include new/updated messages and conversations, typing and presence snapshots.
      const sinceMs = since ? (typeof since === 'string' ? Date.parse(since) : since) : 0;
      const changedMsgs = this.messages.filter(m => Date.parse(m.updatedAt) > sinceMs);
      const changedConvos = this.conversations.filter(c => Date.parse(c.updatedAt) > sinceMs || Date.parse(c.createdAt) > sinceMs);
      // Typing: include active typing states
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
      // Simulate opponent typing for a short period before reply (demo)
      const typer = 'u_alex';
      const until = Date.now() + 1500 + Math.floor(Math.random()*1500);
      const tmap = this.typing.get(conversationId) || {}; tmap[typer] = until; this.typing.set(conversationId, tmap); this._touch();
      // Randomly simulate incoming reply
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
      // Simulate upload with progress-like response: return an attachment descriptor with a fake URL
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

  // ---------- API Client (switchable demo/real) ----------
  class ApiClient {
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
  }

  // ---------- Main Widget ----------
  class ChatbotWidget {
    constructor(anchor, settings){
      this.anchor = anchor;
      this.settings = Object.assign({
        pollForMessages: 10000,
        canStartMultipleConversations: true,
        channels: { sms: true, whatsapp: { enabledUntil: null }, email: true },
        fileUpload: { maxFilesPerMessage: 10, maxFileSizeSingleFile: 10_000_000, limitFileTypes: [] },
        urls: {},
        demoMode: true,
        theme: 'auto'
      }, settings || {});
      this.api = new ApiClient(this.settings);
      this.emitter = new Emitter();
      this.state = {
        open: false,
        theme: this.settings.theme || 'auto',
        conversations: [],
        activeId: null,
        messages: new Map(), // conversationId -> array of messages (sorted by createdAt)
        drafts: new Map(), // conversationId -> { text, attachments: [] }
        uploading: new Map(), // attachmentId -> progress 0..1
        presence: new Map(), // userId -> online
        typing: new Map(),   // conversationId -> Set(userIds)
        lastSync: null,
        unread: 0
      };

      this._buildUI();
      this._applyTheme();
      this._wireEvents();
      this._start();
    }

    // ------ UI ------
    _buildUI(){
      // Launcher button
      this.$launcher = h('div', { class: 'cb-launcher', title: 'Open chat' }, [
        this._iconChat(),
        h('span', { class: 'cb-badge-dot', style: 'display:none' })
      ]);
      document.body.appendChild(this.$launcher);

      // Window
      this.$win = h('div', { class: 'cb-window' });
      const header = this.$header = h('div', { class: 'cb-header' }, [
        h('div', { class: 'cb-presence', id: 'cb-presence' }),
        h('div', {}, [
          h('div', { class: 'cb-title' }, 'Chat'),
          h('div', { class: 'cb-subtitle', id: 'cb-subtitle' }, 'We reply in minutes')
        ]),
        h('div', { class: 'cb-spacer' }),
        h('button', { class: 'cb-icon-btn', title: 'Participants', id: 'cb-users' }, this._iconUsers()),
        h('button', { class: 'cb-icon-btn', title: 'New conversation', id: 'cb-new', style: (this.settings.canStartMultipleConversations? '' : 'display:none') }, this._iconPlus()),
        h('button', { class: 'cb-icon-btn', title: 'Theme', id: 'cb-theme' }, this._iconSun()),
        h('button', { class: 'cb-icon-btn', title: 'Close', id: 'cb-close' }, this._iconX())
      ]);

      // Body
      const sidebar = this.$sidebar = h('div', { class: 'cb-sidebar' });
      const messages = this.$messages = h('div', { class: 'cb-messages' });
      const thread = this.$thread = h('div', { class: 'cb-thread' });
      const typing = this.$typing = h('div', { class: 'cb-typing', style: 'display:none' });

      messages.appendChild(thread);
      messages.appendChild(typing);
      const body = this.$body = h('div', { class: 'cb-body' }, [ sidebar, messages ]);

      // Composer
      const composer = this.$composer = h('div', { class: 'cb-composer' });
      // Channel checkboxes (now above the input)
      const checkboxes = this.$checkboxes = h('div', { class: 'cb-checkboxes' });
      const makeChk = (id, label, enabled=true, disabled=false, tip='') => {
        const wrap = h('label', { class: 'cb-tooltip', 'data-tip': tip });
        const input = h('input', { type: 'checkbox', id, ...(enabled?{checked:''}:{}) , ...(disabled?{disabled:''}:{}) });
        const span = h('span', {}, ' '+label);
        wrap.appendChild(input); wrap.appendChild(span);
        return wrap;
      };
      const waUntil = this.settings.channels?.whatsapp?.enabledUntil ? new Date(this.settings.channels.whatsapp.enabledUntil) : null;
      const waOk = !waUntil || Date.now() <= waUntil.getTime();
      const waTip = waUntil ? (waOk ? ('Enabled until '+waUntil.toLocaleString()) : ('Disabled because contact window expired on '+waUntil.toLocaleString())) : '';
      if (this.settings.channels?.sms) checkboxes.appendChild(makeChk('cb-ch-sms','SMS', true, false));
      if (this.settings.channels?.whatsapp) checkboxes.appendChild(makeChk('cb-ch-wa','WhatsApp', waOk, !waOk, waTip));
      if (this.settings.channels?.email) checkboxes.appendChild(makeChk('cb-ch-email','Email', false, false));

      const input = this.$input = h('div', { class: 'cb-input', id: 'cb-input', contenteditable: 'true', 'data-placeholder': 'Write a message…' });
      const actions = this.$actions = h('div', { class: 'cb-actions' });

      // File input button
      const fileBtn = h('button', { class: 'cb-icon-btn', title: 'Attach files', id: 'cb-attach' }, this._iconPaperclip());
      const fileInput = this.$fileInput = h('input', { type: 'file', multiple: '', style: 'display:none' });

      // Send with dropdown
      const sendNowBtn = h('button', { class: 'cb-send-btn', id: 'cb-send' }, 'Send');
      const ddWrap = h('div', { class: 'cb-dropdown' });
      const ddBtn = h('button', { class: 'cb-icon-btn', id: 'cb-dd' }, this._iconChevronUp());
      const menu = this.$menu = h('div', { class: 'cb-menu' }, [
        h('button', { id: 'cb-now' }, 'Send now'),
        h('button', { id: 'cb-sched' }, 'Schedule…')
      ]);
      ddWrap.appendChild(ddBtn); ddWrap.appendChild(menu);

      const send = h('div', { class: 'cb-send' }, [ sendNowBtn, ddWrap ]);

      // Build composer: checkboxes (top) -> input -> actions (attach + send)
      composer.appendChild(checkboxes);
      actions.appendChild(fileBtn);
      actions.appendChild(fileInput);
      actions.appendChild(send);
      composer.appendChild(input);
      composer.appendChild(actions);

      this.$win.appendChild(header);
      this.$win.appendChild(body);
      this.$win.appendChild(composer);
      document.body.appendChild(this.$win);
    }

    _applyTheme(){
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const dark = this.state.theme === 'dark' || (this.state.theme === 'auto' && mql.matches);
      this.$win.classList.toggle('cb-dark', dark);
      this.$launcher.classList.toggle('cb-dark', dark);
    }

    _wireEvents(){
      this.$launcher.addEventListener('click', () => this.toggle());
      this.$header.querySelector('#cb-close').addEventListener('click', () => this.close());
      this.$header.querySelector('#cb-theme').addEventListener('click', () => {
        this.setTheme(this.state.theme === 'light' ? 'dark' : this.state.theme === 'dark' ? 'auto' : 'light');
      });
      this.$header.querySelector('#cb-new').addEventListener('click', () => this._promptNewConversation());
      this.$header.querySelector('#cb-users').addEventListener('click', () => this._openParticipants());

      // Composer events
      this.$input.addEventListener('input', () => this._onDraftChanged());
      this.$input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._sendNow(); }
      });

      const attachBtn = this.$actions.querySelector('#cb-attach');
      attachBtn.addEventListener('click', () => this.$fileInput.click());
      this.$fileInput.addEventListener('change', (e) => this._onFilesSelected(e));

      // Send dropdown
      this.$actions.querySelector('#cb-dd').addEventListener('click', () => this.$menu.classList.toggle('open'));
      document.addEventListener('click', (e) => {
        if (!this.$actions.contains(e.target)) this.$menu.classList.remove('open');
      });
      this.$actions.querySelector('#cb-send').addEventListener('click', () => this._sendNow());
      this.$menu.querySelector('#cb-now').addEventListener('click', () => { this.$menu.classList.remove('open'); this._sendNow(); });
      this.$menu.querySelector('#cb-sched').addEventListener('click', () => { this.$menu.classList.remove('open'); this._openSchedulePicker(); });

      // Resize scroll to bottom when new content size changes (only if near bottom)
      const ro = new ResizeObserver(() => {
        const el = this.$thread; if (!el) return;
        const dist = el.scrollHeight - el.clientHeight - el.scrollTop;
        if (dist < 120) this._scrollThreadToEnd();
      });
      ro.observe(this.$thread);

      // Mutation observer: when new message nodes are added, scroll to bottom (only if near bottom)
      const mo = new MutationObserver((mutations) => {
        const el = this.$thread; if (!el) return;
        for (const m of mutations) {
          if (m.type === 'childList' && m.addedNodes && m.addedNodes.length) {
            const dist = el.scrollHeight - el.clientHeight - el.scrollTop;
            if (dist < 120) this._scrollThreadToEnd();
            break;
          }
        }
      });
      mo.observe(this.$thread, { childList: true });
    }

    async _start(){
      await this._fullSync();
      this._renderConversations();
      this._selectFirstConversation();
      this._updateUnreadBadge();
      this._startPolling();
    }

    // ------ Sync ------
    async _fullSync(){
      const res = await this.api.listChanges(null);
      if (!res?.ok) return;
      this._applyChanges(res.changes);
      this.state.lastSync = res.serverTime || nowIso();
    }
    _applyChanges(changes){
      const { messages = [], conversations = [], typing = [], presence = [] } = changes || {};
      // Conversations merge
      const newConvos = [];
      for (const c of conversations){
        const idx = this.state.conversations.findIndex(x => x.id === c.id);
        if (idx >= 0) this.state.conversations[idx] = Object.assign({}, this.state.conversations[idx], c);
        else { this.state.conversations.push(c); newConvos.push(c); }
      }
      // Messages merge per conversation and collect newly seen
      const newMessages = [];
      for (const m of messages){
        const arr = this.state.messages.get(m.conversationId) || [];
        const ix = arr.findIndex(x => x.id === m.id);
        if (ix >= 0) {
          const prev = arr[ix];
          arr[ix] = Object.assign({}, prev, m);
        } else { arr.push(m); if (m.authorId !== 'me') newMessages.push(m); }
        arr.sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
        this.state.messages.set(m.conversationId, arr);
      }
      // Typing
      const typingMap = new Map();
      for (const t of typing){
        const set = typingMap.get(t.conversationId) || new Set(); set.add(t.userId); typingMap.set(t.conversationId, set);
      }
      this.state.typing = typingMap;
      // Presence
      const pres = new Map();
      for (const p of presence){ pres.set(p.userId, !!p.online); }
      this.state.presence = pres;

      // Update UI
      this._renderConversations();
      this._renderThread();
      this._renderTyping();
      this._renderPresence();

      // Emit events
      for (const c of newConvos) this.emitter.emit('conversation', c);
      for (const m of newMessages) this.emitter.emit('message', m);
      if (typing.length) this.emitter.emit('typing', typing);
      this._updateUnreadBadge();

      // If new messages arrived for the active conversation, scroll to bottom
      if (newMessages.some(m => m.conversationId === this.state.activeId)) {
        this._scrollThreadToEnd();
      }
    }
    _startPolling(){
      const interval = clamp(Number(this.settings.pollForMessages)||10000, 2000, 60000);
      if (this._pollTimer) clearInterval(this._pollTimer);
      this._pollTimer = setInterval(async () => {
        const res = await this.api.listChanges(this.state.lastSync);
        if (res?.ok){ this._applyChanges(res.changes); this.state.lastSync = res.serverTime || nowIso(); }
      }, interval);
    }

    // ------ Conversations ------
    _renderConversations(){
      this.$sidebar.innerHTML = '';
      const convos = [...this.state.conversations].sort((a,b) => new Date(b.updatedAt||b.createdAt) - new Date(a.updatedAt||a.createdAt));
      for (const c of convos){
        const el = h('div', { class: 'cb-convo-item'+(c.id===this.state.activeId?' cb-active':'') });
        const lastMsg = (this.state.messages.get(c.id)||[]).slice(-1)[0];
        const meta = lastMsg ? (escapeHtml(lastMsg.text).slice(0, 28) + (lastMsg.text.length>28?'…':'')) : 'No messages';
        el.appendChild(h('div', { class: 'cb-convo-name' }, escapeHtml(c.name)));
        el.appendChild(h('div', { class: 'cb-convo-meta' }, meta));
        el.addEventListener('click', () => { this.state.activeId = c.id; this._renderConversations(); this._renderThread(true); this._loadDraft(); this._updateUnreadBadge(); this._renderPresence(); });
        this.$sidebar.appendChild(el);
      }
      // Show sidebar (conversation picker) only if user belongs to multiple conversations
      const showSidebar = this.state.conversations.length > 1;
      this.$sidebar.style.display = showSidebar ? 'block' : 'none';
    }
    _selectFirstConversation(){
      if (!this.state.activeId && this.state.conversations.length) {
        this.state.activeId = this.state.conversations[0].id;
        this._renderThread(true);
        this._loadDraft();
      }
    }

    async _promptNewConversation(){
      if (!this.settings.canStartMultipleConversations) return;
      const input = prompt('Enter participant user IDs separated by commas (demo: u_alex, u_sam, u_jamie)');
      if (!input) return;
      const participants = input.split(',').map(s => s.trim()).filter(Boolean);
      const res = await this.api.startConversation(participants);
      if (res?.ok){
        this.state.conversations.push(res.conversation);
        this.state.activeId = res.conversation.id;
        this._renderConversations();
        this._renderThread(true);
        this._saveDraft();
        this.emitter.emit('conversation', res.conversation);
      }
    }

    // ------ Thread & messages ------
    _renderThread(scrollToEnd=false){
      const cid = this.state.activeId; if (!cid){ this.$thread.innerHTML = '<div style="padding:12px;color:var(--cb-muted);font:13px var(--cb-font)">No conversation selected</div>'; return; }
      const msgs = this.state.messages.get(cid) || [];
      this.$thread.innerHTML = '';
      for (const m of msgs){
        const isMe = m.authorId === 'me';
        const wrap = h('div', { class: 'cb-msg'+(isMe?' cb-me':'') });
        const avatarText = (isMe?'Me':(m.authorId||'U')).slice(0,2).toUpperCase();
        wrap.appendChild(h('div', { class: 'cb-avatar' }, avatarText));
        const bubble = h('div', { class: 'cb-bubble' });
        bubble.appendChild(h('div', { class: 'cb-text' }, escapeHtml(m.text || '')));

        if (m.attachments?.length){
          const atts = h('div', { class: 'cb-attachments' });
          for (const a of m.attachments){
            const link = h('a', { href: a.url || '#', target: '_blank', download: a.name || undefined }, escapeHtml(a.name || 'file'));
            atts.appendChild(h('span', { class: 'cb-attachment' }, [this._iconPaperclip(12), link, h('span', { style: 'color:var(--cb-muted)' }, bytes(a.size||0))]));
          }
          bubble.appendChild(atts);
        }

        const meta = h('div', { class: 'cb-msg-meta' }, [
          h('span', {}, fmtTime(m.createdAt)),
          (m.seenBy?.length? h('span', { class: 'cb-tooltip', 'data-tip': m.seenBy.map(s => `${s.userId} at ${fmtTime(s.at)}`).join('\n') }, 'Seen by '+m.seenBy.map(s => s.userId).join(', ')) : ''),
          (isMe ? h('button', { class: 'cb-icon-btn', title: 'Edit', onclick: () => this._inlineEditMessage(m) }, this._iconEdit()) : '')
        ]);
        bubble.appendChild(meta);
        wrap.appendChild(bubble);
        this.$thread.appendChild(wrap);
      }
      if (scrollToEnd) this._scrollThreadToEnd();
    }
    _scrollThreadToEnd(){
      const el = this.$thread; if (!el) return;
      // Use rAF twice to ensure DOM layout is flushed before scrolling
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollHeight;
        });
      });
    }

    _renderTyping(){
      const cid = this.state.activeId; if (!cid){ this.$typing.style.display = 'none'; return; }
      const set = this.state.typing.get(cid) || new Set();
      const others = Array.from(set).filter(u => u !== 'me');
      if (others.length){ this.$typing.style.display = 'block'; this.$typing.textContent = `${others.join(', ')} is typing…`; }
      else { this.$typing.style.display = 'none'; }
    }

    _renderPresence(){
      // Show green dot if any non-me participant in the active conversation is online
      const cid = this.state.activeId;
      let online = false;
      if (cid){
        const c = this.state.conversations.find(x => x.id === cid);
        if (c){
          for (const uid of c.participants || []){
            if (uid !== 'me' && this.state.presence.get(uid)) { online = true; break; }
          }
        }
      }
      const dot = this.$header.querySelector('.cb-presence');
      dot.classList.toggle('cb-online', online);
    }

    // ------ Drafts & files ------
    async _loadDraft(){
      const cid = this.state.activeId; if (!cid) return;
      const res = await this.api.getDraft(cid);
      const d = res?.draft || { text: '', attachments: [] };
      this.state.drafts.set(cid, d);
      this.$input.textContent = d.text || '';
      // attachments in draft are rendered as uploading chips below input
      this._renderDraftAttachments();
    }
    async _saveDraft(){
      const cid = this.state.activeId; if (!cid) return;
      const d = this.state.drafts.get(cid) || { text: '', attachments: [] };
      await this.api.saveDraft(cid, d.text || '', d.attachments || []);
    }
    _onDraftChanged(){
      const cid = this.state.activeId; if (!cid) return;
      const d = this.state.drafts.get(cid) || { text: '', attachments: [] };
      d.text = this.$input.textContent || '';
      this.state.drafts.set(cid, d);
      // debounce save
      clearTimeout(this._draftTimer);
      this._draftTimer = setTimeout(() => this._saveDraft(), 400);
    }

    _renderDraftAttachments(){
      // For simplicity, list under composer as chips
      // Remove old chips
      const prev = this.$composer.querySelectorAll('.cb-chip.file');
      prev.forEach(n => n.remove());
      const cid = this.state.activeId; if (!cid) return;
      const d = this.state.drafts.get(cid) || { attachments: [] };
      for (const a of d.attachments || []){
        const prog = this.state.uploading.get(a.id);
        const chip = h('span', { class: 'cb-chip file'+(prog!=null?' warn':'') });
        chip.appendChild(this._iconPaperclip(12));
        chip.appendChild(h('span', {}, `${a.name} (${bytes(a.size||0)})`));
        if (prog!=null) chip.appendChild(h('span', { style: 'color:var(--cb-warning)' }, ` ${Math.round(prog*100)}%`));
        const rm = h('button', { class: 'cb-icon-btn', title: 'Remove', onclick: () => this._removeDraftAttachment(a.id) }, this._iconX(12));
        chip.appendChild(rm);
        this.$composer.insertBefore(chip, this.$actions);
      }
      this._updateSendDisabled();
    }

    _removeDraftAttachment(attId){
      const cid = this.state.activeId; if (!cid) return;
      const d = this.state.drafts.get(cid) || { attachments: [] };
      d.attachments = (d.attachments || []).filter(a => a.id !== attId);
      this.state.uploading.delete(attId);
      this.state.drafts.set(cid, d);
      this._renderDraftAttachments();
      this._saveDraft();
    }

    async _onFilesSelected(e){
      const files = Array.from(e.target.files || []);
      e.target.value = '';
      if (!files.length) return;
      const cfg = this.settings.fileUpload || {};
      const cid = this.state.activeId; if (!cid) return;
      const d = this.state.drafts.get(cid) || { text:'', attachments: [] };
      const countAllowed = Math.max(0, (cfg.maxFilesPerMessage||10) - (d.attachments?.length||0));
      const toUse = files.slice(0, countAllowed);
      const badType = (f) => (cfg.limitFileTypes?.length ? !cfg.limitFileTypes.some(ext => f.name.toLowerCase().endsWith('.'+ext.toLowerCase())) : false);
      for (const f of toUse){
        if (cfg.maxFileSizeSingleFile && f.size > cfg.maxFileSizeSingleFile){ alert(`File too large: ${f.name} (${bytes(f.size)}). Max is ${bytes(cfg.maxFileSizeSingleFile)}.`); continue; }
        if (badType(f)){ alert(`File type not allowed: ${f.name}`); continue; }
        // Optimistic add placeholder attachment
        const tempId = uid();
        const att = { id: tempId, name: f.name, size: f.size, type: f.type };
        d.attachments = d.attachments || []; d.attachments.push(att);
        this.state.uploading.set(tempId, 0);
        this.state.drafts.set(cid, d);
        this._renderDraftAttachments();

        // Simulate progress and upload
        const upPromise = this.api.uploadFile(f);
        // Fake progress
        const start = Date.now();
        const progTimer = setInterval(() => {
          const p = clamp((Date.now()-start)/1200, 0, 0.9);
          this.state.uploading.set(tempId, p);
          this._renderDraftAttachments();
          if (p>=0.9) { clearInterval(progTimer); }
        }, 120);
        try {
          const res = await upPromise;
          clearInterval(progTimer);
          if (res?.ok){
            // Replace temp with real attachment data
            const arr = d.attachments.map(a => a.id===tempId? res.attachment : a);
            d.attachments = arr;
            this.state.uploading.delete(tempId);
            this._renderDraftAttachments();
            this._saveDraft();
          } else {
            throw new Error('Upload failed');
          }
        } catch (err){
          clearInterval(progTimer);
          alert('Upload failed: '+(err?.message||err));
          // Remove temp
          d.attachments = d.attachments.filter(a => a.id !== tempId);
          this.state.uploading.delete(tempId);
          this._renderDraftAttachments();
        }
      }
    }

    _updateSendDisabled(){
      const uploading = this.state.uploading.size > 0;
      const btn = this.$actions.querySelector('#cb-send');
      btn.disabled = uploading;
      btn.title = uploading ? 'Please wait: files are uploading' : '';
    }

    // ------ Send & schedule ------
    _gatherChannels(){
      const get = (id) => !!(this.$checkboxes.querySelector('#'+id)?.checked);
      const res = { sms: false, whatsapp: false, email: false };
      if (this.settings.channels?.sms) res.sms = get('cb-ch-sms');
      if (this.settings.channels?.whatsapp){
        const waUntil = this.settings.channels.whatsapp.enabledUntil ? new Date(this.settings.channels.whatsapp.enabledUntil) : null;
        const waOk = !waUntil || Date.now() <= waUntil.getTime();
        res.whatsapp = waOk && get('cb-ch-wa');
      }
      if (this.settings.channels?.email) res.email = get('cb-ch-email');
      return res;
    }

    async _sendNow(){
      const cid = this.state.activeId; if (!cid) return;
      if (this.state.uploading.size > 0){ alert('Please wait until files finish uploading.'); return; }
      const text = (this.$input.textContent || '').trim();
      const draft = this.state.drafts.get(cid) || { attachments: [] };
      if (!text && !(draft.attachments?.length)) return; // no-op
      await this._sendMessage({ text, scheduleAt: null });
    }
    _openSchedulePicker(){
      const wrap = h('div', { class: 'cb-menu open', style: 'position: absolute; bottom: 50px; right: 10px; padding: 8px' });
      const input = h('input', { type: 'datetime-local', style: 'margin: 4px' });
      const ok = h('button', { class: 'cb-send-btn', style: 'margin: 4px' }, 'Schedule');
      const cancel = h('button', { class: 'cb-icon-btn', style: 'margin: 4px' }, 'Cancel');
      wrap.appendChild(h('div', { style: 'padding:4px 6px; font: 13px var(--cb-font); color: var(--cb-text);' }, 'Choose date & time'));
      wrap.appendChild(input); wrap.appendChild(ok); wrap.appendChild(cancel);
      this.$composer.appendChild(wrap);
      const close = () => wrap.remove();
      cancel.addEventListener('click', close);
      ok.addEventListener('click', async () => {
        const v = input.value; if (!v) return;
        const dt = new Date(v);
        if (isNaN(dt)) return;
        await this._sendMessage({ text: (this.$input.textContent||'').trim(), scheduleAt: dt.toISOString() });
        close();
      });
      setTimeout(() => { const onDoc = (e) => { if (!wrap.contains(e.target)) { close(); document.removeEventListener('click', onDoc); } }; document.addEventListener('click', onDoc); }, 0);
    }

    async _sendMessage({ text, scheduleAt }){
      const cid = this.state.activeId;
      const draft = this.state.drafts.get(cid) || { attachments: [] };
      const channels = this._gatherChannels();
      const attachments = draft.attachments || [];
      const optimisticId = 'temp_'+uid();
      const createdAt = scheduleAt || nowIso();
      const optimistic = { id: optimisticId, conversationId: cid, authorId: 'me', text, createdAt, updatedAt: createdAt, attachments, channels, seenBy: [] };
      // add to UI immediately
      const arr = this.state.messages.get(cid) || []; arr.push(optimistic); this.state.messages.set(cid, arr);
      this._renderThread(true);

      // clear draft & input
      this.state.drafts.set(cid, { text: '', attachments: [] });
      this.$input.textContent = '';
      this._renderDraftAttachments();
      await this._saveDraft();

      try {
        const res = await this.api.sendMessage({ conversationId: cid, text, attachments, channels, scheduleAt });
        if (res?.ok && res.message){
          // replace optimistic with real
          const msgs = this.state.messages.get(cid) || [];
          const ix = msgs.findIndex(m => m.id === optimisticId);
          if (ix >= 0) msgs[ix] = res.message; else msgs.push(res.message);
          this.state.messages.set(cid, msgs);
          this._renderThread(true);
          this.emitter.emit('message', res.message);
        } else {
          throw new Error(res?.error || 'send_failed');
        }
      } catch (e){
        // mark optimistic as failed
        const msgs = this.state.messages.get(cid) || [];
        const ix = msgs.findIndex(m => m.id === optimisticId);
        if (ix >= 0) msgs[ix].text += ' (failed)';
        this._renderThread();
        alert('Failed to send message');
      }
    }

    _inlineEditMessage(m){
      const cid = m.conversationId; const msgs = this.state.messages.get(cid) || [];
      const idx = msgs.findIndex(x => x.id === m.id); if (idx<0) return;
      // Find bubble in DOM: nth child
      const wrappers = this.$thread.querySelectorAll('.cb-msg');
      const wrap = wrappers[idx]; if (!wrap) return;
      const bubble = wrap.querySelector('.cb-bubble');
      const textEl = bubble.querySelector('.cb-text');
      const original = m.text;
      const ta = h('div', { class: 'cb-input', contenteditable: 'true', style: 'min-height: 32px; margin-top: 6px;' }, escapeHtml(original));
      const btnSave = h('button', { class: 'cb-send-btn', style: 'margin-top:6px;' }, 'Save');
      const btnCancel = h('button', { class: 'cb-icon-btn', style: 'margin-left:6px; margin-top:6px;' }, 'Cancel');
      const box = h('div', {}, [ta, btnSave, btnCancel]);
      textEl.style.display = 'none';
      bubble.insertBefore(box, bubble.lastChild);
      const cleanup = () => { textEl.style.display = ''; box.remove(); };
      btnCancel.addEventListener('click', cleanup);
      btnSave.addEventListener('click', async () => {
        const newText = (ta.textContent||'').trim();
        if (!newText || newText === original) { cleanup(); return; }
        const res = await this.api.editMessage(m.id, newText);
        if (res?.ok){ msgs[idx].text = newText; this._renderThread(); }
        cleanup();
      });
    }

    // ------ Read receipts & unread ------
    _updateUnreadBadge(){
      let count = 0;
      for (const [cid, msgs] of this.state.messages.entries()){
        for (const m of msgs){
          const seen = (m.seenBy||[]).some(s => s.userId === 'me');
          if (!seen && m.authorId !== 'me') count++;
        }
      }
      this.state.unread = count;
      const dot = this.$launcher.querySelector('.cb-badge-dot');
      dot.style.display = count > 0 ? 'block' : 'none';
    }
    async _markThreadAsRead(){
      const cid = this.state.activeId; if (!cid) return;
      const msgs = this.state.messages.get(cid) || [];
      const unreadIds = msgs.filter(m => m.authorId !== 'me' && !(m.seenBy||[]).some(s => s.userId==='me')).map(m => m.id);
      if (!unreadIds.length) return;
      const res = await this.api.markAsRead(cid, unreadIds);
      if (res?.ok){
        for (const m of msgs){ if (unreadIds.includes(m.id)) { const has = m.seenBy?.find(s=>s.userId==='me'); if (has) has.at=nowIso(); else (m.seenBy||(m.seenBy=[])).push({ userId:'me', at: nowIso() }); } }
        this._renderThread();
        this._updateUnreadBadge();
        this.emitter.emit('read', { conversationId: cid, messageIds: unreadIds });
      }
    }

    // ------ Public API ------
    open(){ this.state.open = true; this.$win.classList.add('cb-open'); this._markThreadAsRead(); this._scrollThreadToEnd(); }
    close(){ this.state.open = false; this.$win.classList.remove('cb-open'); }
    toggle(){ this.state.open ? this.close() : this.open(); }
    async startConversation(participants){ const r = await this.api.startConversation(participants); if (r?.ok){ this.state.conversations.push(r.conversation); this.state.activeId = r.conversation.id; this._renderConversations(); this._renderThread(true);} return r.conversation; }
    async addUserToConversation(conversationId, userId){ const r = await this.api.addParticipant(conversationId, userId); if (r?.ok){ const c = this.state.conversations.find(x => x.id===conversationId); if (c && !c.participants.includes(userId)) c.participants.push(userId);} }
    async sendMessage(conversationId, messageDraft){ this.state.activeId = conversationId; await this._sendMessage({ text: messageDraft.text || '', scheduleAt: messageDraft.scheduleAt || null }); }
    async editMessage(messageId, newText){ await this.api.editMessage(messageId, newText); }
    async markAsRead(conversationId, messageIds){ await this.api.markAsRead(conversationId, messageIds); }
    getUnreadCount(){ return this.state.unread; }
    on(evt, cb){ this.emitter.on(evt, cb); }
    setTheme(theme){ this.state.theme = theme; this._applyTheme(); }

    // ------ Icons ------
    _iconChat(sz=22){ return h('svg', { width: sz, height: sz, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, '<path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>' ); }
    _iconX(sz=16){ return h('svg',{width:sz,height:sz,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'2'},'<path d="M18 6 6 18M6 6l12 12"/>'); }
    _iconPlus(sz=16){ return h('svg',{width:sz,height:sz,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'2'},'<path d="M12 5v14M5 12h14"/>'); }
    _iconSun(sz=16){ return h('svg',{width:sz,height:sz,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'2'},'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.364 6.364-1.414-1.414M6.05 6.05 4.636 4.636m12.728 0-1.414 1.414M6.05 17.95l-1.414 1.414"/>'); }
    _iconPaperclip(sz=16){ return h('svg',{width:sz,height:sz,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'2'},'<path d="M21.44 11.05 12.37 20.12a6 6 0 1 1-8.49-8.49l9.19-9.19a4 4 0 1 1 5.66 5.66L9.88 17.15a2 2 0 0 1-2.83-2.83l8.13-8.12"/>'); }
    _iconChevronUp(sz=16){ return h('svg',{width:sz,height:sz,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'2'},'<path d="m18 15-6-6-6 6"/>'); }
    _iconEdit(sz=14){ return h('svg',{width:sz,height:sz,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'2'},'<path d="M3 21v-4a2 2 0 0 1 2-2h4m5-9 3 3M7 17l9-9 3 3-9 9H7z"/>'); }
    _iconUsers(sz=16){ return h('svg',{width:sz,height:sz,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'2'},'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'); }
  }

  // ---------- Auto-init from data-chatbot-settings ----------
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
      setTheme: (theme) => widget.setTheme(theme)
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll);
  else initAll();
})();
