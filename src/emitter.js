// Simple event emitter
export class Emitter {
  constructor(){ this.map = new Map(); }
  on(evt, fn){ if (!this.map.has(evt)) this.map.set(evt, new Set()); this.map.get(evt).add(fn); }
  off(evt, fn){ this.map.get(evt)?.delete(fn); }
  emit(evt, ...args){ this.map.get(evt)?.forEach(fn => { try{ fn(...args); }catch(e){ console.error(e);} }); }
}

