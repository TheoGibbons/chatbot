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

/**
 * Example usage:
 * console.log(prettySeconds(86400));             // "1 day"
 * console.log(prettySeconds(86400 * 2));         // "2 days"
 * console.log(prettySeconds((86400 * 2) + 0.5 * 86400)); // "2 days 12 hrs"
 * console.log(prettySeconds(60 * 59));           // "59 mins"
 * console.log(prettySeconds(31536000 * 10 + 2628000)); // "10 years 1 month"
 * console.log(prettySeconds(30.678));            // "30.68 secs"
 * console.log(prettySeconds(0.678));             // "0.68 secs"
 *
 * console.log(prettySeconds(-86400));            // "-1 day"
 * console.log(prettySeconds(-86400 * 2));        // "-2 days"
 * console.log(prettySeconds(-((86400 * 2) + 0.5 * 86400))); // "-2 days -12 hrs"
 * console.log(prettySeconds(-(60 * 59)));        // "-59 mins"
 * console.log(prettySeconds(-(31536000 * 10 + 2628000))); // "-10 years -1 month"
 * console.log(prettySeconds(-(30.678)));         // "-30.68 secs"
 * console.log(prettySeconds(-(0.678)));          // "-0.68 secs"
 *
 * console.log(prettySeconds(86400, true));      // Output: "in 1 day"
 * console.log(prettySeconds(-31536000 * 5, true)); // Output: "5 years ago"
 * console.log(prettySeconds(60 * 45, true));    // Output: "in 45 mins"
 *
 * console.log(prettySeconds(''));    // Output: ""
 * console.log(prettySeconds(null));    // Output: ""
 * console.log(prettySeconds(undefined));    // Output: ""
 *
 * @param {number} inputSeconds eg 86400
 * @param {boolean} addAgoString if true response will be "1 day ago" instead of "1 day"
 * @returns {string} eg "1 day"
 */
export const prettySeconds = (inputSeconds, addAgoString = false) => {

  if(inputSeconds === null || inputSeconds === undefined || inputSeconds === '') return '';

  // Keep track of sign
  const neg = inputSeconds < 0 ? -1 : 1;
  inputSeconds = Math.abs(inputSeconds);

  // Convert to integer and get time components
  const roundedSeconds = Math.round(inputSeconds);
  const years = Math.floor(roundedSeconds / 31536000);
  const months = Math.floor((roundedSeconds % 31536000) / 2628000);
  const weeks = Math.floor((roundedSeconds % 2628000) / 604800);
  const days = Math.floor((roundedSeconds % 604800) / 86400);
  const hours = Math.floor((roundedSeconds % 86400) / 3600);
  const minutes = Math.floor((roundedSeconds % 3600) / 60);
  const seconds = parseFloat((inputSeconds % 60).toFixed(2)); // Keep seconds as float for precision

  let result = "";

  if (years) {
    result = `${years * neg} year${Math.abs(years) > 1 ? "s" : ""}${months ? ` ${months * neg} month${Math.abs(months) > 1 ? "s" : ""}` : ""}`;
  } else if (months) {
    result = `${months * neg} month${Math.abs(months) > 1 ? "s" : ""}${weeks ? ` ${weeks * neg} week${Math.abs(weeks) > 1 ? "s" : ""}` : ""}`;
  } else if (weeks) {
    result = `${weeks * neg} week${Math.abs(weeks) > 1 ? "s" : ""}${days ? ` ${days * neg} day${Math.abs(days) > 1 ? "s" : ""}` : ""}`;
  } else if (days) {
    result = `${days * neg} day${Math.abs(days) > 1 ? "s" : ""}${hours ? ` ${hours * neg} hr${Math.abs(hours) > 1 ? "s" : ""}` : ""}`;
  } else if (hours) {
    result = `${hours * neg} hr${Math.abs(hours) > 1 ? "s" : ""}${minutes ? ` ${minutes * neg} min${Math.abs(minutes) > 1 ? "s" : ""}` : ""}`;
  } else if (minutes) {
    result = `${minutes * neg} min${Math.abs(minutes) > 1 ? "s" : ""}${seconds ? ` ${seconds * neg} sec${Math.abs(seconds) > 1 ? "s" : ""}` : ""}`;
  } else {
    result = `${seconds * neg} sec${Math.abs(seconds) !== 1 ? "s" : ""}`;
  }

  // Add "in" / "ago" if requested
  if (addAgoString) {
    result = neg > 0 ? `in ${result}` : `${result} ago`;
  }

  return result;
}