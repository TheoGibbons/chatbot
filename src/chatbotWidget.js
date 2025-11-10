import { clamp, escapeHtml, h, fmtTime, bytes, nowIso, uid, prettySeconds } from './utils.js';
import { Emitter } from './emitter.js';
import { ApiClient } from './apiClient.js';

export class ChatbotWidget {
  constructor(anchor, settings){
    this.anchor = anchor;
    this.settings = Object.assign({
      pollForMessages: 10000,
      canStartMultipleConversations: true,
      channels: { sms: true, whatsapp: { enabledUntil: null }, email: true },
      fileUpload: { maxFilesPerMessage: 10, maxFileSizeSingleFile: 10_000_000, limitFileTypes: [] },
      urls: {},
      demoMode: true,
      theme: 'auto',
      // New: layout modes: 'widget' (default floating), 'page' (full-page), 'embedded' (fills anchor element)
      layout: 'widget'
    }, settings || {});
    this.api = new ApiClient(this.settings);
    this.emitter = new Emitter();
    this.state = {
      open: this.settings.layout !== 'widget', // auto-open for page/embedded
      theme: this.settings.theme || 'auto',
      conversations: [],
      activeId: null,
      messages: new Map(),
      drafts: new Map(),
      uploading: new Map(),
      presence: new Map(),
      typing: new Map(),
      lastSync: null,
      unread: 0,
      // Track inline edit state so we can preserve it across re-renders
      editing: null // { messageId, conversationId, text }
    };

    this._buildUI();
    this._applyTheme();
    this._wireEvents();
    this._start();
  }

  // UI
  _buildUI(){
    const isWidget = this.settings.layout === 'widget';
    const isPage = this.settings.layout === 'page';
    const isEmbedded = this.settings.layout === 'embedded';

    if (isWidget){
      this.$launcher = h('div', { class: 'cb-launcher', role: 'button', tabindex: '0', 'aria-label': 'Open chat' }, [
        this._iconChat(),
        h('span', { class: 'cb-badge-dot', style: 'display:none' })
      ]);
      document.body.appendChild(this.$launcher);
    } else {
      this.$launcher = null; // guard references
    }

    this.$win = h('div', { class: 'cb-window'+(this.state.open?' cb-open':'')+(isPage?' cb-mode-page':'')+(isEmbedded?' cb-mode-embedded':'') });
    const header = this.$header = h('div', { class: 'cb-header' }, [
      h('div', { class: 'cb-presence', id: 'cb-presence' }),
      h('div', {}, [
        h('div', { class: 'cb-title' }, 'Chat'),
        h('div', { class: 'cb-subtitle', id: 'cb-subtitle' }, 'We reply in minutes')
      ]),
      h('div', { class: 'cb-spacer' }),
      h('button', { class: 'cb-icon-btn cb-tooltip', 'data-tip': 'Participants', 'aria-label': 'Participants', id: 'cb-users', type: 'button' }, this._iconUsers()),
      h('button', { class: 'cb-icon-btn cb-tooltip', 'data-tip': 'New conversation', 'aria-label': 'New conversation', id: 'cb-new', style: (this.settings.canStartMultipleConversations? '' : 'display:none'), type: 'button' }, this._iconPlus()),
      h('button', { class: 'cb-icon-btn cb-tooltip', 'data-tip': 'Theme', 'aria-label': 'Theme', id: 'cb-theme', type: 'button' }, this._iconSun()),
      // Fullscreen & Close hidden in page mode (already full) but kept in embedded in case host wants expansion
      h('button', { class: 'cb-icon-btn cb-tooltip', 'data-tip': 'Fullscreen', 'aria-label': 'Fullscreen', id: 'cb-full', type: 'button', style: (isPage?'display:none':'') }, this._iconExpand()),
      h('button', { class: 'cb-icon-btn cb-tooltip', 'data-tip': isWidget? 'Close' : 'Hide', 'aria-label': isWidget? 'Close' : 'Hide', id: 'cb-close', type: 'button', style: (!isWidget && !isEmbedded ? 'display:none' : '') }, this._iconX())
    ]);

    const sidebar = this.$sidebar = h('div', { class: 'cb-sidebar' });
    const messages = this.$messages = h('div', { class: 'cb-messages' });
    const thread = this.$thread = h('div', { class: 'cb-thread' });
    const typing = this.$typing = h('div', { class: 'cb-typing', style: 'display:none' });

    messages.appendChild(thread);
    messages.appendChild(typing);
    const body = this.$body = h('div', { class: 'cb-body' }, [ sidebar, messages ]);

    const composer = this.$composer = h('div', { class: 'cb-composer' });
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

    const fileBtn = h('button', { class: 'cb-icon-btn cb-tooltip', 'data-tip': 'Attach files', 'aria-label': 'Attach files', id: 'cb-attach', type: 'button' }, this._iconPaperclip());
    const fileInput = this.$fileInput = h('input', { type: 'file', multiple: '', style: 'display:none' });

    const sendNowBtn = h('button', { class: 'cb-send-btn cb-tooltip', 'aria-label': 'Send', id: 'cb-send', type: 'button' }, 'Send');
    const ddWrap = h('div', { class: 'cb-dropdown' });
    const ddBtn = h('button', { class: 'cb-icon-btn', id: 'cb-dd', type: 'button' }, this._iconChevronUp());
    const menu = this.$menu = h('div', { class: 'cb-menu' }, [
      h('button', { id: 'cb-now', type: 'button' }, 'Send now'),
      h('button', { id: 'cb-sched', type: 'button' }, 'Schedule…')
    ]);
    ddWrap.appendChild(ddBtn); ddWrap.appendChild(menu);

    const send = h('div', { class: 'cb-send' }, [ sendNowBtn, ddWrap ]);

    composer.appendChild(checkboxes);
    actions.appendChild(fileBtn);
    actions.appendChild(fileInput);
    actions.appendChild(send);
    composer.appendChild(input);
    composer.appendChild(actions);

    this.$win.appendChild(header);
    this.$win.appendChild(body);
    this.$win.appendChild(composer);

    // Append window depending on layout
    if (isPage){
      // Full page: ensure anchor (or body) can host it
      const host = this.anchor || document.body;
      host.appendChild(this.$win);
    } else if (isEmbedded){
      const host = this.anchor || document.body;
      host.appendChild(this.$win);
    } else {
      document.body.appendChild(this.$win);
    }
  }

  _applyTheme(){
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const dark = this.state.theme === 'dark' || (this.state.theme === 'auto' && mql.matches);
    this.$win.classList.toggle('cb-dark', dark);
    if (this.$launcher) this.$launcher.classList.toggle('cb-dark', dark);
    const btn = this.$header?.querySelector('#cb-theme');
    if (btn){
      btn.innerHTML = '';
      if (this.state.theme === 'auto') btn.appendChild(this._iconMonitor());
      else if (this.state.theme === 'dark') btn.appendChild(this._iconMoon());
      else btn.appendChild(this._iconSun());
      btn.setAttribute('data-tip', `Theme: ${this.state.theme}`);
      btn.setAttribute('aria-label', `Theme: ${this.state.theme}`);
      btn.classList.add('cb-tooltip');
    }
  }

  _wireEvents(){
    if (this.$launcher){
      this.$launcher.addEventListener('click', () => this.toggle());
      this.$launcher.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.toggle(); } });
    }
    const closeBtn = this.$header.querySelector('#cb-close');
    if (closeBtn){
      closeBtn.addEventListener('click', () => {
        if (this.settings.layout === 'widget' || this.settings.layout === 'embedded') this.close();
      });
    }
    const themeBtn = this.$header.querySelector('#cb-theme');
    if (themeBtn){
      themeBtn.addEventListener('click', () => {
        const order = ['auto','dark','light'];
        const idx = order.indexOf(this.state.theme);
        const next = order[(idx + 1) % order.length];
        this.setTheme(next);
      });
    }
    const newBtn = this.$header.querySelector('#cb-new');
    if (newBtn) newBtn.addEventListener('click', () => this._openUserPicker({ mode: 'start' }));

    const usersBtn = this.$header.querySelector('#cb-users');
    if (usersBtn){
      const show = () => this._showParticipantsPopover(usersBtn);
      usersBtn.addEventListener('mouseenter', show);
      usersBtn.addEventListener('click', (e) => { e.stopPropagation(); show(); });
    }
    document.addEventListener('click', () => this._hideParticipantsPopover());

    const fullBtn = this.$header.querySelector('#cb-full');
    if (fullBtn){
      fullBtn.addEventListener('click', () => this._toggleFullscreen());
    }

    const sendBtn = this.$actions.querySelector('#cb-send');
    if (sendBtn) sendBtn.addEventListener('click', () => this._sendNow());

    const ddBtn = this.$actions.querySelector('#cb-dd');
    if (ddBtn && this.$menu){
      ddBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.$menu.classList.toggle('open');
      });
      const nowItem = this.$menu.querySelector('#cb-now');
      const schedItem = this.$menu.querySelector('#cb-sched');
      if (nowItem) nowItem.addEventListener('click', () => { this.$menu.classList.remove('open'); this._sendNow(); });
      if (schedItem) schedItem.addEventListener('click', () => { this.$menu.classList.remove('open'); this._openSchedulePicker(); });
      document.addEventListener('click', () => { this.$menu.classList.remove('open'); });
    }

    if (this.$input){
      this.$input.addEventListener('input', () => this._onDraftChanged());
      this.$input.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); this._sendNow(); }
      });
    }

    const attachBtn = this.$actions.querySelector('#cb-attach');
    if (attachBtn && this.$fileInput){
      attachBtn.addEventListener('click', () => this.$fileInput.click());
      this.$fileInput.addEventListener('change', (e) => this._onFilesSelected(e));
    }

    this._updateSendDisabled();

    const mqlTheme = window.matchMedia('(prefers-color-scheme: dark)');
    const onMqlChange = () => { if (this.state.theme === 'auto') this._applyTheme(); };
    if (mqlTheme.addEventListener) mqlTheme.addEventListener('change', onMqlChange);
    else if (mqlTheme.addListener) mqlTheme.addListener(onMqlChange);
  }

  async _start(){
    await this._fullSync();
    this._renderConversations();
    this._selectFirstConversation();
    this._updateUnreadBadge();
    this._updateSendDisabled();
    this._startPolling();
  }

  // Sync
  async _fullSync(){
    const res = await this.api.listChanges(null);
    if (!res?.ok) return;
    this._applyChanges(res.changes);
    this.state.lastSync = res.serverTime || nowIso();
  }
  _applyChanges(changes){
    const { messages = [], conversations = [], typing = [], presence = [] } = changes || {};
    const newConvos = [];
    for (const c of conversations){
      const idx = this.state.conversations.findIndex(x => x.id === c.id);
      if (idx >= 0) this.state.conversations[idx] = Object.assign({}, this.state.conversations[idx], c);
      else { this.state.conversations.push(c); newConvos.push(c); }
    }
    const newMessages = [];
    for (const m of messages){
      const arr = this.state.messages.get(m.conversationId) || [];
      const ix = arr.findIndex(x => x.id === m.id);
      if (ix >= 0) {
        const prev = arr[ix];
        // Preserve in-progress edit text locally if this message is being edited
        const isEditing = this.state.editing && this.state.editing.messageId === m.id;
        const merged = Object.assign({}, prev, m);
        if (isEditing) merged.text = prev.text; // keep local unsaved draft text in UI
        arr[ix] = merged;
      } else { arr.push(m); if (m.authorId !== 'me') newMessages.push(m); }
      arr.sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
      this.state.messages.set(m.conversationId, arr);
    }
    const typingMap = new Map();
    for (const t of typing){
      const set = typingMap.get(t.conversationId) || new Set(); set.add(t.userId); typingMap.set(t.conversationId, set);
    }
    this.state.typing = typingMap;
    const pres = new Map();
    for (const p of presence){ pres.set(p.userId, !!p.online); }
    this.state.presence = pres;

    this._renderConversations();
    this._renderThread();
    this._renderTyping();
    this._renderPresence();

    for (const c of newConvos) this.emitter.emit('conversation', c);
    for (const m of newMessages) this.emitter.emit('message', m);
    if (typing.length) this.emitter.emit('typing', typing);
    this._updateUnreadBadge();

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

  // Participants popover and user picker
  _showParticipantsPopover(btn){
    const cid = this.state.activeId; if (!cid) return;
    this._hideParticipantsPopover();
    const pop = this.$participantsPopover = h('div', { class: 'cb-popover' });
    const c = this.state.conversations.find(x => x.id === cid);
    pop.appendChild(h('h4', {}, 'Participants'));
    const list = h('div', { class: 'cb-pop-list' });
    const others = (c?.participants||[]).filter(u => u !== 'me');
    if (!others.length) list.appendChild(h('div', { style: 'color:var(--cb-muted);font:12px var(--cb-font);' }, 'No other participants'));
    for (const uid_ of others){
      const name = uid_;
      const row = h('div', { class: 'cb-pop-item' }, [
        h('span', {}, escapeHtml(name)),
        h('button', { class: 'cb-icon-btn', 'aria-label': 'Remove participant', onclick: (e) => { e.stopPropagation(); this.api.removeParticipant(cid, uid_).then(r => { if (r?.ok){ c.participants = c.participants.filter(x => x!==uid_); this._renderPresence(); this._hideParticipantsPopover(); this._showParticipantsPopover(btn); } }); } }, this._iconX(14))
      ]);
      list.appendChild(row);
    }
    pop.appendChild(list);
    const actions = h('div', { class: 'cb-pop-actions' }, [
      h('button', { class: 'cb-icon-btn', 'aria-label': 'Add participant', onclick: (e) => { e.stopPropagation(); this._hideParticipantsPopover(); this._openUserPicker({ mode: 'add' }); } }, this._iconPlus(16))
    ]);
    pop.appendChild(actions);

    // Positioning near the users button
    document.body.appendChild(pop);
    const rect = btn.getBoundingClientRect();
    pop.style.top = Math.round(window.scrollY + rect.bottom + 6) + 'px';
    pop.style.left = Math.round(window.scrollX + rect.right - 260) + 'px';

    // Keep open while hovering popover
    pop.addEventListener('mouseenter', () => { clearTimeout(this._popHideTimer); });
    pop.addEventListener('mouseleave', () => this._hideParticipantsPopover());
  }
  _hideParticipantsPopover(){
    clearTimeout(this._popHideTimer);
    if (this.$participantsPopover){ this.$participantsPopover.remove(); this.$participantsPopover = null; }
  }

  _openUserPicker({ mode }){
    const isAdd = mode === 'add';
    const title = isAdd ? 'Add participant' : 'Start a conversation';
    const backdrop = h('div', { class: 'cb-modal-backdrop' });
    const modal = h('div', { class: 'cb-modal' });
    modal.appendChild(h('h3', {}, title));
    const searchRow = h('div', { class: 'row' });
    searchRow.appendChild(h('label', { style: 'font: 12px var(--cb-font); color: var(--cb-muted);' }, 'Search users'));
    const input = h('input', { type: 'text', placeholder: 'Type to search…' });
    searchRow.appendChild(input);
    const selectRow = h('div', { class: 'row' });
    const select = h('select', { size: '8' });
    selectRow.appendChild(select);
    const footer = h('div', { class: 'footer' });
    const cancel = h('button', { class: 'cb-btn secondary' }, 'Cancel');
    const addBtn = h('button', { class: 'cb-btn', disabled: '' }, isAdd ? 'Add' : 'Start');
    footer.appendChild(cancel);
    footer.appendChild(addBtn);
    modal.appendChild(searchRow);
    modal.appendChild(selectRow);
    modal.appendChild(footer);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    const close = () => backdrop.remove();
    cancel.addEventListener('click', close);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

    const cid = this.state.activeId;
    const existing = isAdd ? (this.state.conversations.find(x => x.id===cid)?.participants || []) : [];

    const renderOptions = (items=[]) => {
      select.innerHTML = '';
      for (const u of items){
        if (u.userId === 'me') continue;
        if (isAdd && existing.includes(u.userId)) continue;
        const label = `${u.name || u.userId} (${u.userId})${u.online? ' • online':''}`;
        select.appendChild(h('option', { value: u.userId }, label));
      }
      addBtn.disabled = !select.value;
    };

    let searchTimer;
    const doSearch = async (q) => {
      const res = await this.api.searchUsers(q || '');
      const results = res?.results || [];
      renderOptions(results);
    };
    input.addEventListener('input', () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => doSearch(input.value.trim()), 250); });
    select.addEventListener('change', () => { addBtn.disabled = !select.value; });

    // Initial load
    doSearch('');

    addBtn.addEventListener('click', async () => {
      const userId = select.value; if (!userId) return;
      addBtn.disabled = true;
      try {
        if (isAdd) {
          await this.api.addParticipant(cid, userId);
          const c = this.state.conversations.find(x => x.id===cid); if (c && !c.participants.includes(userId)) c.participants.push(userId);
          this._renderPresence();
        } else {
          const r = await this.api.startConversation([userId]);
            if (r?.ok){
              this.state.conversations.push(r.conversation);
              this.state.activeId = r.conversation.id;
              this._renderConversations();
              this._renderThread(true);
              this._saveDraft();
              this.emitter.emit('conversation', r.conversation);
            }
        }
        close();
      } finally {
        addBtn.disabled = false;
      }
    });
  }

  // Conversations
  _renderConversations(){
    this.$sidebar.innerHTML = '';
    const convos = [...this.state.conversations].sort((a,b) => new Date(b.updatedAt||b.createdAt) - new Date(a.updatedAt||a.createdAt));
    for (const c of convos){
      const el = h('div', { class: 'cb-convo-item'+(c.id===this.state.activeId?' cb-active':'') });
      const lastMsg = (this.state.messages.get(c.id)||[]).slice(-1)[0];
      const meta = lastMsg ? (escapeHtml(lastMsg.text).slice(0, 28) + (lastMsg.text.length>28?'…':'')) : 'No messages';
      el.appendChild(h('div', { class: 'cb-convo-name' }, escapeHtml(c.name)));
      el.appendChild(h('div', { class: 'cb-convo-meta' }, meta));
      el.addEventListener('click', () => { this.state.activeId = c.id; this._renderConversations(); this._renderThread(true); this._loadDraft(); this._updateUnreadBadge(); this._renderPresence(); this._updateSendDisabled(); this._hideParticipantsPopover(); });
      this.$sidebar.appendChild(el);
    }
    const showSidebar = this.state.conversations.length > 1;
    this.$sidebar.style.display = showSidebar ? 'block' : 'none';
  }
  _selectFirstConversation(){
    if (!this.state.activeId && this.state.conversations.length) {
      this.state.activeId = this.state.conversations[0].id;
      this._renderThread(true);
      this._loadDraft();
      this._updateSendDisabled();
    }
  }

  // Thread & messages
  _renderThread(scrollToEnd=false){
    const cid = this.state.activeId; if (!cid){ this.$thread.innerHTML = '<div style="padding:12px;color:var(--cb-muted);font:13px var(--cb-font)">No conversation selected</div>'; return; }
    const msgs = this.state.messages.get(cid) || [];
    this.$thread.innerHTML = '';

    // We'll track if we need to focus the inline editor after render
    let editorToFocus = null;

    for (const m of msgs){
      // Server-side/system message rendering
      if (m.type === 'server'){
        const wrap = h('div', { class: 'cb-msg cb-server' });
        const bubble = h('div', { class: 'cb-bubble cb-server-bubble' });
        bubble.appendChild(h('div', { class: 'cb-text' }, escapeHtml(m.text || '')));
        const meta = h('div', { class: 'cb-msg-meta cb-server-meta' }, [ h('span', {}, fmtTime(m.createdAt)) ]);
        bubble.appendChild(meta);
        wrap.appendChild(bubble);
        this.$thread.appendChild(wrap);
        continue;
      }

      const isMe = m.authorId === 'me';
      const wrap = h('div', { class: 'cb-msg'+(isMe?' cb-me':'') });
      const avatarText = (isMe?'Me':(m.authorId||'U')).slice(0,2).toUpperCase();
      wrap.appendChild(h('div', { class: 'cb-avatar' }, avatarText));
      const bubble = h('div', { class: 'cb-bubble' });

      const isEditing = !!(this.state.editing && this.state.editing.messageId === m.id);

      if (!isEditing){
        bubble.appendChild(h('div', { class: 'cb-text' }, escapeHtml(m.text || '')));
      } else {
        // Inline editor rendering
        const current = (this.state.editing && this.state.editing.text != null) ? this.state.editing.text : (m.text || '');
        const ta = h('div', { class: 'cb-input', contenteditable: 'true', style: 'min-height: 32px; margin-top: 6px;' }, escapeHtml(current));
        ta.setAttribute('data-cb-editor', m.id);
        ta.addEventListener('input', () => {
          if (this.state.editing && this.state.editing.messageId === m.id){ this.state.editing.text = ta.textContent || ''; }
        });
        const btnSave = h('button', { class: 'cb-send-btn', style: 'margin-top:6px;' }, 'Save');
        const btnCancel = h('button', { class: 'cb-icon-btn', style: 'margin-left:6px; margin-top:6px;' }, 'Cancel');
        btnCancel.addEventListener('click', () => { this.state.editing = null; this._renderThread(); });
        btnSave.addEventListener('click', async () => {
          const newText = (ta.textContent||'').trim();
          if (!newText || newText === m.text) { this.state.editing = null; this._renderThread(); return; }
          const res = await this.api.editMessage(m.id, newText);
          if (res?.ok){
            const arr = this.state.messages.get(cid) || [];
            const ix = arr.findIndex(x => x.id === m.id);
            if (ix >= 0) arr[ix] = Object.assign({}, arr[ix], { text: newText, updatedAt: nowIso() });
            this.state.messages.set(cid, arr);
            this.emitter.emit('message', Object.assign({}, m, { text: newText }));
          }
          this.state.editing = null;
          this._renderThread();
        });
        bubble.appendChild(ta);
        bubble.appendChild(btnSave);
        bubble.appendChild(btnCancel);
        editorToFocus = ta;
      }

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
        (!isEditing && isMe ? h('button', { class: 'cb-icon-btn cb-tooltip', 'data-tip': 'Edit', 'aria-label': 'Edit message', onclick: () => this._inlineEditMessage(m), type: 'button' }, this._iconEdit()) : '')
      ]);
      bubble.appendChild(meta);
      wrap.appendChild(bubble);
      this.$thread.appendChild(wrap);
    }

    if (scrollToEnd) this._scrollThreadToEnd();

    // After rendering, if editing, focus the editor and move caret to end
    if (editorToFocus){
      setTimeout(() => {
        try {
          editorToFocus.focus();
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(editorToFocus);
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        } catch (_) {}
      }, 0);
    }
  }
  _scrollThreadToEnd(){
    const el = this.$messages || this.$thread; if (!el) return;
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
    const cid = this.state.activeId;
    let online = false;
    if (cid){
      const c = this.state.conversations.find(x => x.id === cid);
      if (c){
        for (const uid_ of c.participants || []){
          if (uid_ !== 'me' && this.state.presence.get(uid_)) { online = true; break; }
        }
      }
    }
    const dot = this.$header.querySelector('.cb-presence');
    dot.classList.toggle('cb-online', online);
  }

  // Drafts & files
  async _loadDraft(){
    const cid = this.state.activeId; if (!cid) return;
    const res = await this.api.getDraft(cid);
    const d = res?.draft || { text: '', attachments: [] };
    this.state.drafts.set(cid, d);
    this.$input.textContent = d.text || '';
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
    clearTimeout(this._draftTimer);
    this._draftTimer = setTimeout(() => this._saveDraft(), 400);
  }

  _renderDraftAttachments(){
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
      const rm = h('button', { class: 'cb-icon-btn cb-tooltip', 'data-tip': 'Remove', 'aria-label': 'Remove attachment', onclick: () => this._removeDraftAttachment(a.id) }, this._iconX(12));
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
      const tempId = uid();
      const att = { id: tempId, name: f.name, size: f.size, type: f.type };
      d.attachments = d.attachments || []; d.attachments.push(att);
      this.state.uploading.set(tempId, 0);
      this.state.drafts.set(cid, d);
      this._renderDraftAttachments();

      const upPromise = this.api.uploadFile(f);
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
        d.attachments = d.attachments.filter(a => a.id !== tempId);
        this.state.uploading.delete(tempId);
        this._renderDraftAttachments();
      }
    }
  }

  _updateSendDisabled(){
    const uploading = this.state.uploading.size > 0;
    const notReady = !this.state.activeId;
    const btn = this.$actions.querySelector('#cb-send');
    btn.disabled = uploading || notReady;
    const tip = uploading ? 'Please wait: files are uploading' : (notReady ? 'Select a conversation to start messaging' : 'Send');
    btn.setAttribute('data-tip', tip);
    btn.setAttribute('aria-label', tip);
    btn.classList.add('cb-tooltip');
  }

  // Send & schedule
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
    const cid = this.state.activeId; if (!cid) { alert('No conversation selected yet.'); return; }
    if (this.state.uploading.size > 0){ alert('Please wait until files finish uploading.'); return; }
    const text = (this.$input.textContent || '').trim();
    const draft = this.state.drafts.get(cid) || { attachments: [] };
    if (!text && !(draft.attachments?.length)) return;
    await this._sendMessage({ text, scheduleIn: null });
  }
  _openSchedulePicker(){
    const wrap = h('div', { class: 'cb-menu open', style: 'position: absolute; bottom: 50px; right: 10px; padding: 8px' });
    const input = h('input', { type: 'datetime-local', style: 'margin: 4px' });
    const ok = h('button', { class: 'cb-send-btn', style: 'margin: 4px' }, 'Schedule');
    const cancel = h('button', { class: 'cb-icon-btn', style: 'margin: 4px' }, 'Cancel');
    const timeAgoString = h('span', { id: 'cb-schedule-time-ago-string' });
    const getScheduleInFromInput = (input) => {
      const v = input.value;
      if (!v) {
        return {
          scheduleIn: null,
          error: 'Please choose date & time',
          prettyString: '',
        };
      }
      const dt = new Date(v);
      if (isNaN(dt)) {
        return {
          scheduleIn: null,
          error: 'Invalid date & time',
          prettyString: '',
        }
      }
      const scheduleIn = Math.floor((new Date(v).getTime() - new Date().getTime()) / 1000);
      if (scheduleIn < 60) {
        return {
          scheduleIn: null,
          error: "Must > 1min from now",
          prettyString: prettySeconds(scheduleIn, true),
        }
      }

      return {
        scheduleIn,
        error: null,
        prettyString: prettySeconds(scheduleIn, true),
      }
    }
    wrap.appendChild(h('div', { style: 'padding:4px 6px; font: 13px var(--cb-font); color: var(--cb-text);' }, [
        'Choose date & time',
        timeAgoString,
    ]));
    wrap.appendChild(input); wrap.appendChild(ok); wrap.appendChild(cancel);
    this.$composer.appendChild(wrap);
    const close = () => wrap.remove();
    cancel.addEventListener('click', close);
    ok.addEventListener('click', async () => {
      const {scheduleIn, error, prettyString} = getScheduleInFromInput(input);
      if (error) {
        timeAgoString.innerText = error;
        timeAgoString.style.color = '#F00';
      } else {
        timeAgoString.innerText = prettyString;
        timeAgoString.style.color = '';
        await this._sendMessage({text: (this.$input.textContent || '').trim(), scheduleIn: scheduleIn});
        close();
      }
    });
    input.addEventListener('input', () => {
      const {scheduleIn, error, prettyString} = getScheduleInFromInput(input);
      if (error) {
        timeAgoString.innerText = error;
        timeAgoString.style.color = '#F00';
      } else {
        timeAgoString.innerText = prettyString;
        timeAgoString.style.color = '';
      }
    });
    setTimeout(() => { const onDoc = (e) => { if (!wrap.contains(e.target)) { close(); document.removeEventListener('click', onDoc); } }; document.addEventListener('click', onDoc); }, 0);

  }


  async _sendMessage({ text, scheduleIn }){
    const cid = this.state.activeId;
    const draft = this.state.drafts.get(cid) || { attachments: [] };
    const channels = this._gatherChannels();
    const attachments = draft.attachments || [];
    const optimisticId = 'temp_'+uid();
    const createdAt = scheduleIn || 0;
    const optimistic = { id: optimisticId, conversationId: cid, authorId: 'me', text, createdAt, updatedAt: createdAt, attachments, channels, seenBy: [] };
    const arr = this.state.messages.get(cid) || []; arr.push(optimistic); this.state.messages.set(cid, arr);
    this._renderThread(true);

    this.state.drafts.set(cid, { text: '', attachments: [] });
    this.$input.textContent = '';
    this._renderDraftAttachments();
    await this._saveDraft();

    try {
      const res = await this.api.sendMessage({ conversationId: cid, text, attachments, channels, scheduleIn });
      if (res?.ok && res.message){
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
      const msgs = this.state.messages.get(cid) || [];
      const ix = msgs.findIndex(m => m.id === optimisticId);
      if (ix >= 0) msgs[ix].text += ' (failed)';
      this._renderThread();
      alert('Failed to send message');
    }
  }

  _inlineEditMessage(m){
    // Activate editing state and re-render; this preserves edit mode across future re-renders
    if (m.authorId !== 'me') return;
    this.state.editing = { messageId: m.id, conversationId: m.conversationId, text: m.text || '' };
    this._renderThread();
  }

  // Unread/read
  _updateUnreadBadge(){
    let count = 0;
    for (const [cid, msgs] of this.state.messages.entries()){
      for (const m of msgs){
        const seen = (m.seenBy||[]).some(s => s.userId === 'me');
        if (m.type !== 'server' && !seen && m.authorId !== 'me') count++;
      }
    }
    this.state.unread = count;
    if (this.$launcher){
      const dot = this.$launcher.querySelector('.cb-badge-dot');
      if (dot) dot.style.display = count > 0 ? 'block' : 'none';
    }
  }
  async _markThreadAsRead(){
    const cid = this.state.activeId; if (!cid) return;
    const msgs = this.state.messages.get(cid) || [];
    const unreadIds = msgs.filter(m => m.type !== 'server' && m.authorId !== 'me' && !(m.seenBy||[]).some(s => s.userId==='me')).map(m => m.id);
    if (!unreadIds.length) return;
    const res = await this.api.markAsRead(cid, unreadIds);
    if (res?.ok){
      for (const m of msgs){ if (unreadIds.includes(m.id)) { const has = m.seenBy?.find(s=>s.userId==='me'); if (has) has.at=nowIso(); else (m.seenBy||(m.seenBy=[])).push({ userId:'me', at: nowIso() }); } }
      this._renderThread();
      this._updateUnreadBadge();
      this.emitter.emit('read', { conversationId: cid, messageIds: unreadIds });
    }
  }

  // Public API
  open(){ this.state.open = true; this.$win.classList.add('cb-open'); this._markThreadAsRead(); this._scrollThreadToEnd(); }
  close(){
    if (this.settings.layout === 'widget' || this.settings.layout === 'embedded'){ this.state.open = false; this.$win.classList.remove('cb-open'); this._hideParticipantsPopover(); }
  }
  toggle(){ (this.state.open ? this.close() : this.open()); }
  _toggleFullscreen(){
    if (this.settings.layout !== 'widget' && this.settings.layout !== 'embedded') return; // disable in page mode
    const btn = this.$header.querySelector('#cb-full');
    const isFull = this.$win.classList.toggle('cb-full');
    if (btn){
      btn.innerHTML = '';
      btn.appendChild(isFull ? this._iconCompress() : this._iconExpand());
      btn.setAttribute('data-tip', isFull ? 'Exit fullscreen' : 'Fullscreen');
      btn.setAttribute('aria-label', isFull ? 'Exit fullscreen' : 'Fullscreen');
      btn.classList.add('cb-tooltip');
    }
  }
  async startConversation(participants){ const r = await this.api.startConversation(participants); if (r?.ok){ this.state.conversations.push(r.conversation); this.state.activeId = r.conversation.id; this._renderConversations(); this._renderThread(true); this._updateSendDisabled();} return r.conversation; }
  async addUserToConversation(conversationId, userId){ const r = await this.api.addParticipant(conversationId, userId); if (r?.ok){ const c = this.state.conversations.find(x => x.id===conversationId); if (c && !c.participants.includes(userId)) c.participants.push(userId);} }
  async sendMessage(conversationId, messageDraft){ this.state.activeId = conversationId; this._updateSendDisabled(); await this._sendMessage({ text: messageDraft.text || '', scheduleIn: messageDraft.scheduleIn || null }); }
  async editMessage(messageId, newText){ await this.api.editMessage(messageId, newText); }
  async markAsRead(conversationId, messageIds){ await this.api.markAsRead(conversationId, messageIds); }
  getUnreadCount(){ return this.state.unread; }
  on(evt, cb){ this.emitter.on(evt, cb); }
  setTheme(theme){ this.state.theme = theme; this._applyTheme(); }

  // Create a server/system message via backend (restored)
  async addServerMessage(conversationId, text){
    const res = await this.api.addServerMessage(conversationId, text);
    if (res?.ok && res.message){
      const m = res.message;
      const arr = this.state.messages.get(m.conversationId) || [];
      const ix = arr.findIndex(x => x.id === m.id);
      if (ix >= 0) arr[ix] = Object.assign({}, arr[ix], m); else arr.push(m);
      arr.sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
      this.state.messages.set(m.conversationId, arr);
      if (this.state.activeId === m.conversationId) { this._renderThread(true); this._updateUnreadBadge(); }
      this.emitter.emit('message', m);
    }
    return res;
  }

  // Icons (restored)
  _iconChat(sz=22){ return h('svg', { width: sz, height: sz, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2' }, '<path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>' ); }
  _iconX(sz=16){ return h('svg',{width:sz,height:sz,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'2'},'<path d="M18 6 6 18M6 6l12 12"/>' ); }
  _iconPlus(sz=16){ return h('svg',{width:sz,height:sz,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'2'},'<path d="M12 5v14M5 12h14"/>' ); }
  _iconSun(sz=16){ return h('svg',{width:sz,height:sz,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'2'},'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2m10-10h-2M4 12H2m15.364 6.364-1.414-1.414M6.05 6.05 4.636 4.636m12.728 0-1.414 1.414M6.05 17.95l-1.414 1.414"/>' ); }
  _iconMoon(sz=16){ return h('svg',{width:sz,height:sz,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'2'},'<path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79"/>' ); }
  _iconPaperclip(sz=16){ return h('svg',{width:sz,height:sz,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'2'},'<path d="M21.44 11.05 12.37 20.12a6 6 0 1 1-8.49-8.49l9.19-9.19a4 4 0 1 1 5.66 5.66L9.88 17.15a2 2 0 0 1-2.83-2.83l8.13-8.12"/>' ); }
  _iconChevronUp(sz=16){ return h('svg',{width:sz,height:sz,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'2'},'<path d="m18 15-6-6-6 6"/>' ); }
  _iconEdit(sz=14){ return h('svg',{width:sz,height:sz,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'2'},'<path d="M3 21v-4a2 2 0 0 1 2-2h4m5-9 3 3M7 17l9-9 3 3-9 9H7z"/>' ); }
  _iconUsers(sz=16){ return h('svg',{width:sz,height:sz,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'2'},'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' ); }
  _iconExpand(sz=16){ return h('svg',{width:sz,height:sz,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'2'},'<path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="M9 21H3v-6"/><path d="m3 21 7-7"/>' ); }
  _iconCompress(sz=16){ return h('svg',{width:sz,height:sz,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'2'},'<path d="M9 3H3v6"/><path d="m3 3 7 7"/><path d="M15 21h6v-6"/><path d="m21 21-7-7"/>' ); }
  _iconMonitor(sz=16){ return h('svg',{width:sz,height:sz,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'2'},'<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>' ); }
}

