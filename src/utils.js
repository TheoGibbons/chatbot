// Utility helpers shared across modules
export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
export const nowIso = () => new Date().toISOString();
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');
export const h = (tag, attrs = {}, children = []) => {
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
export const fmtTime = (iso) => {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleString();
};
export const timeAgo = (iso) => {
  const d = new Date(iso); const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`; const m = Math.floor(s/60);
  if (m < 60) return `${m}m ago`; const h = Math.floor(m/60);
  if (h < 24) return `${h}h ago`; const days = Math.floor(h/24);
  return `${days}d ago`;
};
export const bytes = (n) => {
  const u = ['B','KB','MB','GB']; let i = 0; let x = n;
  while (x >= 1024 && i < u.length-1) { x/=1024; i++; }
  return `${x.toFixed(x<10&&i>0?1:0)} ${u[i]}`;
};
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

