// The one text-interaction layer of the word lookup (browser only). Installed once for the whole app: a handful of
// capture-phase listeners on the window and one bubble element, reused. No span per word, no listener per word, no
// React state per word — the readers only mark their text containers with data-lookup="<family>" (and optionally
// data-lookup-work / data-lookup-layer), and the word under a tap is found from the caret position the browser already
// knows (caretRangeFromPoint), so the text on the screen is never touched.
//
// Dismiss-first (see gesture.mjs): with the bubble open, a press anywhere outside it closes it and the whole gesture is
// consumed in the capture phase — before any reader handler runs. A scroll closes it and keeps scrolling; a layout
// change, a route change, a panel that closes or a rotation closes it too (the word it points at is watched every
// frame while it is open, so it can never float detached).
//
// Nothing here reaches the network, stores what was looked up, or reports anything: errors are swallowed (a dev-only
// console line), and an unknown word does nothing at all.
import { createGestureMachine } from './gesture.mjs';
import { placeGloss, sizeGloss } from './placement.mjs';
import { tokenAt, isWordChar } from './normalize.mjs';
import { getShortGloss, isDictionaryReady, loadWordDictionary, resolveWordContext } from './engine.mjs';

const INTERACTIVE = 'button, a[href], input, select, textarea, label, summary, [role="button"], [role="tab"], [contenteditable="true"], sup, .library-unit-n, .iyun-badges, [data-lookup="off"]';
const BLOCK_STOP = /^(P|DIV|LI|ARTICLE|SECTION|ASIDE|BLOCKQUOTE|TD|TH|H1|H2|H3|H4|H5|H6|HEADER|FOOTER|BR|UL|OL|FIGURE)$/;
const TOP_BARS = ['.shell-head-safe', '.talmud-modes-bar'];
const BOTTOM_BARS = ['.tabbar', '.iyun-panel.is-open'];
const CLOSE_LABEL = 'סגירת פירוש המילה';
const devLog = (...args) => { try { if (import.meta.env?.DEV) console.warn('[word-lookup]', ...args); } catch { /* no console */ } };

// ---------- The word under a point ----------
function caretAt(doc, x, y) {
  if (doc.caretRangeFromPoint) { const range = doc.caretRangeFromPoint(x, y); return range ? { node: range.startContainer, offset: range.startOffset } : null; }
  if (doc.caretPositionFromPoint) { const pos = doc.caretPositionFromPoint(x, y); return pos ? { node: pos.offsetNode, offset: pos.offset } : null; }
  return null;
}
const hiddenState = node => Boolean(node.parentElement?.closest('[aria-hidden="true"]'));
// Are two neighbouring text nodes one run of inline text (a word may continue from one to the other)?
function inlineJoined(a, b, zone) {
  if (hiddenState(a) !== hiddenState(b)) return false;
  const path = new Set();
  for (let el = a.parentElement; el && el !== zone; el = el.parentElement) path.add(el);
  const common = (() => { for (let el = b.parentElement; el; el = el.parentElement) { if (el === zone || path.has(el)) return el; } return zone; })();
  const blocked = el => { if (el.matches?.(INTERACTIVE) || BLOCK_STOP.test(el.tagName)) return true; try { return !/^inline/.test(getComputedStyle(el).display); } catch { return true; } };
  for (let el = a.parentElement; el && el !== common; el = el.parentElement) if (blocked(el)) return false;
  for (let el = b.parentElement; el && el !== common; el = el.parentElement) if (blocked(el)) return false;
  return true;
}
// The run of inline text around the hit node, up to the first boundary on each side (at most a few nodes).
function textRun(doc, zone, hit) {
  const walker = doc.createTreeWalker(zone, 4 /* NodeFilter.SHOW_TEXT */);
  const nodes = [hit];
  walker.currentNode = hit;
  for (let i = 0, cur = hit; i < 4; i += 1) {
    const text = cur.nodeValue || '';
    if (text && !isWordChar(text[0])) break;
    const prev = walker.previousNode();
    if (!prev || !inlineJoined(prev, cur, zone) || prev.parentElement?.closest(INTERACTIVE)) break;
    nodes.unshift(prev); cur = prev;
  }
  walker.currentNode = hit;
  for (let i = 0, cur = hit; i < 4; i += 1) {
    const text = cur.nodeValue || '';
    if (text && !isWordChar(text[text.length - 1])) break;
    const next = walker.nextNode();
    if (!next || !inlineJoined(cur, next, zone) || next.parentElement?.closest(INTERACTIVE)) break;
    nodes.push(next); cur = next;
  }
  return nodes;
}
function rangeFor(doc, nodes, start, end) {
  const range = doc.createRange();
  let pos = 0;
  let startSet = false;
  for (const node of nodes) {
    const len = (node.nodeValue || '').length;
    if (!startSet && start <= pos + len) { range.setStart(node, start - pos); startSet = true; }
    if (startSet && end <= pos + len) { range.setEnd(node, end - pos); return range; }
    pos += len;
  }
  return null;
}
// { raw, rect, zone, element } of the word at (x, y), or null — only inside a lookup zone, on real text (not on the
// space beside a line, not on a button, footnote mark or number inside the zone).
export function wordAtPoint(doc, x, y) {
  const target = doc.elementFromPoint(x, y);
  const zone = target?.closest?.('[data-lookup]');
  if (!zone || zone.getAttribute('data-lookup') === 'off') return null;
  const control = target.closest(INTERACTIVE);
  if (control && zone.contains(control) && control !== zone) return null;
  const caret = caretAt(doc, x, y);
  if (!caret || caret.node?.nodeType !== 3 || !zone.contains(caret.node)) return null;
  const nodes = textRun(doc, zone, caret.node);
  const text = nodes.map(node => node.nodeValue || '').join('');
  const before = nodes.slice(0, nodes.indexOf(caret.node)).reduce((sum, node) => sum + (node.nodeValue || '').length, 0);
  const token = tokenAt(text, before + caret.offset);
  if (!token) return null;
  const range = rangeFor(doc, nodes, token.start, token.end);
  if (!range) return null;
  const rects = [...range.getClientRects()];
  const rect = rects.find(r => x >= r.left - 2 && x <= r.right + 2 && y >= r.top - 2 && y <= r.bottom + 2);
  if (!rect) return null;
  // A few words around it, for context rules (never stored, never sent).
  const aroundFrom = Math.max(0, token.start - 60);
  const around = text.slice(aroundFrom, Math.min(text.length, token.end + 60));
  return { raw: token.raw, rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }, range, zone, element: caret.node.parentElement, around, aroundStart: token.start - aroundFrom };
}

// ---------- The bubble ----------
// The app's own bars that must stay uncovered: the header and the Talmud's sticky reading-mode bar above the word, the
// tab bar and an open commentary sheet below it.
function barInsets(doc, win, anchorEl, anchor) {
  let top = 0;
  let bottom = 0;
  const visible = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? r : null; };
  for (const sel of TOP_BARS) doc.querySelectorAll(sel).forEach(el => { if (el.contains(anchorEl)) return; const r = visible(el); if (r && r.bottom <= anchor.top + 1 && r.top < win.innerHeight / 2) top = Math.max(top, r.bottom); });
  for (const sel of BOTTOM_BARS) doc.querySelectorAll(sel).forEach(el => { if (el.contains(anchorEl)) return; const r = visible(el); if (r && r.bottom >= win.innerHeight - 2 && getComputedStyle(el).visibility !== 'hidden') bottom = Math.max(bottom, win.innerHeight - r.top); });
  return { top, bottom };
}
function safeInsets(doc) {
  const probe = doc.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  doc.body.appendChild(probe);
  const style = getComputedStyle(probe);
  const value = { top: parseFloat(style.paddingTop) || 0, right: parseFloat(style.paddingRight) || 0, bottom: parseFloat(style.paddingBottom) || 0, left: parseFloat(style.paddingLeft) || 0 };
  probe.remove();
  return value;
}

export function installWordLookup({ win = window, doc = document } = {}) {
  const machine = createGestureMachine();
  let bubble = null;
  let textEl = null;
  let spoken = null;
  let current = null; // { range, rect, frame }
  let frame = 0;
  let viewport = { w: win.innerWidth, h: win.innerHeight };

  const build = () => {
    bubble = doc.createElement('div');
    bubble.className = 'word-gloss';
    bubble.setAttribute('dir', 'rtl');
    bubble.hidden = true;
    const close = doc.createElement('button');
    close.type = 'button';
    close.className = 'word-gloss-close';
    close.setAttribute('aria-label', CLOSE_LABEL);
    close.textContent = '✕';
    close.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); hide(); });
    textEl = doc.createElement('span');
    textEl.className = 'word-gloss-text';
    textEl.setAttribute('aria-hidden', 'true');
    const mirror = doc.createElement('span');
    mirror.className = 'word-gloss-mirror';
    mirror.setAttribute('aria-hidden', 'true');
    spoken = doc.createElement('span');
    spoken.className = 'word-gloss-spoken';
    spoken.setAttribute('aria-live', 'polite');
    // Physical order in an RTL row: mirror (right) · gloss · X (left).
    bubble.append(mirror, textEl, close, spoken);
    bubble.addEventListener('click', event => event.stopPropagation());
    doc.body.appendChild(bubble);
  };

  function hide() {
    machine.closed();
    cancelAnimationFrame(frame);
    current = null;
    if (!bubble || bubble.hidden) return;
    bubble.hidden = true;
    bubble.classList.remove('is-shown');
    textEl.textContent = '';
    spoken.textContent = '';
  }

  // While open, the word is watched: if it moves (scroll, a panel sliding, a layout change) or leaves the page, the
  // bubble closes — it never floats detached.
  const watch = () => {
    if (!current) return;
    const node = current.range.startContainer;
    let moved = !node.isConnected;
    if (!moved) {
      const r = current.range.getBoundingClientRect();
      moved = Math.abs(r.top - current.box.top) > 3 || Math.abs(r.left - current.box.left) > 3 || (r.width === 0 && r.height === 0);
    }
    if (moved) { hide(); return; }
    frame = requestAnimationFrame(watch);
  };

  function show(hit, gloss) {
    if (!bubble) build();
    textEl.textContent = gloss;
    spoken.textContent = `${hit.raw.replace(/[\u0591-\u05C7]/g, '')}, ${gloss}`;
    bubble.hidden = false;
    bubble.classList.remove('is-shown', 'is-below', 'is-wrapped');
    // 1. The gloss's own one-line width, measured at the screen's left edge with nothing constraining it.
    bubble.style.left = '0px';
    bubble.style.top = '0px';
    bubble.style.width = 'max-content';
    const textWidth = textEl.getBoundingClientRect().width;
    const safe = safeInsets(doc);
    // 2. The bubble's width from the gloss alone (wrapping at spaces only if the gloss is wider than the screen).
    const box = sizeGloss({ textWidth, viewportWidth: win.innerWidth, insets: safe });
    bubble.style.width = `${box.width}px`;
    if (box.wrap) bubble.classList.add('is-wrapped');
    const size = { width: bubble.offsetWidth, height: bubble.offsetHeight };
    // 3. The position from the word, clamped inside the safe area; the width never changes to fit.
    const bars = barInsets(doc, win, hit.element, hit.rect);
    const place = placeGloss({ anchor: hit.rect, size, viewport: { width: win.innerWidth, height: win.innerHeight }, insets: { top: Math.max(safe.top, bars.top), bottom: Math.max(safe.bottom, bars.bottom), left: safe.left, right: safe.right } });
    bubble.style.left = `${place.left}px`;
    bubble.style.top = `${place.top}px`;
    if (place.placement === 'below') bubble.classList.add('is-below');
    // Next frame: fade in (CSS decides the motion; reduced motion → opacity only).
    requestAnimationFrame(() => bubble && !bubble.hidden && bubble.classList.add('is-shown'));
    machine.opened();
    current = { range: hit.range, box: hit.range.getBoundingClientRect() };
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(watch);
  }

  const inBubble = target => Boolean(bubble && !bubble.hidden && target && bubble.contains(target));
  const consume = event => { if (event.cancelable) event.preventDefault(); event.stopImmediatePropagation(); event.stopPropagation(); };
  const guard = fn => event => { try { fn(event); } catch (error) { devLog(error); } };

  const onPointerDown = guard(event => {
    if (!event.isPrimary && event.isPrimary !== undefined) return;
    const decision = machine.pointerDown({ x: event.clientX, y: event.clientY, insideBubble: inBubble(event.target) });
    if (decision.close) hide();
    // Not preventDefault: a scroll that starts here must go on. Only the handlers behind are kept out.
    if (decision.consume) { event.stopImmediatePropagation(); event.stopPropagation(); }
    else if (!isDictionaryReady() && event.target?.closest?.('[data-lookup]')) loadWordDictionary().catch(() => {});
  });
  const onPointerMove = guard(event => { machine.pointerMove({ x: event.clientX, y: event.clientY }); });
  const onCompanion = guard(event => {
    if (inBubble(event.target)) return;
    if (machine.companion().consume) { event.stopImmediatePropagation(); event.stopPropagation(); }
  });
  const onTouchEnd = guard(event => {
    if (inBubble(event.target)) return;
    if (machine.preventTouchEnd()) { if (event.cancelable) event.preventDefault(); event.stopImmediatePropagation(); event.stopPropagation(); }
    else if (machine.companion().consume) { event.stopImmediatePropagation(); event.stopPropagation(); }
  });
  const onClick = guard(event => {
    const insideBubble = inBubble(event.target);
    const selection = (() => { try { const sel = win.getSelection(); return Boolean(sel && !sel.isCollapsed && String(sel).trim()); } catch { return false; } })();
    const decision = machine.click({ x: event.clientX, y: event.clientY, insideBubble, keyboard: event.detail === 0, selection });
    if (decision.close) hide();
    if (decision.consume) { consume(event); return; }
    if (insideBubble) return; // the X handles itself; the body is inert (the bubble stops its own clicks)
    if (!decision.lookup || !isDictionaryReady()) return;
    const hit = wordAtPoint(doc, event.clientX, event.clientY);
    if (!hit) return;
    const context = resolveWordContext({ family: hit.zone.getAttribute('data-lookup'), workId: hit.element.closest('[data-lookup-work]')?.getAttribute('data-lookup-work') || '', layer: hit.element.closest('[data-lookup-layer]')?.getAttribute('data-lookup-layer') || '', around: hit.around, aroundStart: hit.aroundStart });
    const gloss = getShortGloss(hit.raw, context);
    if (!gloss) return; // unknown: the reader's own tap goes on
    consume(event);
    show(hit, gloss);
  });
  const onDblClick = guard(event => { if (inBubble(event.target)) return; if (machine.dblclick().consume) consume(event); });
  const onKey = guard(event => { if (event.key === 'Escape' && machine.isOpen) { hide(); event.stopPropagation(); } });
  const onScroll = guard(() => { if (current) watch(); });
  const onResize = guard(() => {
    const w = win.innerWidth; const h = win.innerHeight;
    // A rotation or a real resize closes it (the toolbar sliding on iOS is a small height change: the word watch decides).
    if (Math.abs(w - viewport.w) > 40 || Math.abs(h - viewport.h) > 160) hide();
    viewport = { w, h };
  });
  // The dictionary is loaded (from the app bundle, no network) once a reader with lookup text is on the screen.
  let preloadTimer = 0;
  const preload = () => {
    clearTimeout(preloadTimer);
    if (isDictionaryReady()) return;
    preloadTimer = setTimeout(() => { try { if (doc.querySelector('[data-lookup]')) loadWordDictionary().catch(() => {}); else preloadTimer = setTimeout(preload, 2500); } catch { /* never interrupts reading */ } }, 900);
  };
  const onRoute = guard(() => { hide(); preload(); });

  const capture = { capture: true };
  const passive = { capture: true, passive: true };
  const listeners = [
    ['pointerdown', onPointerDown, capture], ['pointermove', onPointerMove, passive], ['pointerup', onCompanion, capture], ['pointercancel', onCompanion, capture],
    ['touchstart', onCompanion, passive], ['touchend', onTouchEnd, { capture: true, passive: false }], ['mousedown', onCompanion, capture], ['mouseup', onCompanion, capture],
    ['contextmenu', onCompanion, capture], ['click', onClick, capture], ['dblclick', onDblClick, capture], ['keydown', onKey, capture],
    ['scroll', onScroll, passive], ['resize', onResize, passive], ['orientationchange', onRoute, passive], ['hashchange', onRoute, passive], ['popstate', onRoute, passive],
  ];
  listeners.forEach(([type, fn, options]) => win.addEventListener(type, fn, options));
  const onHidden = () => { if (doc.visibilityState === 'hidden') hide(); };
  doc.addEventListener('visibilitychange', onHidden);
  preload();
  return () => {
    listeners.forEach(([type, fn, options]) => win.removeEventListener(type, fn, options));
    doc.removeEventListener('visibilitychange', onHidden);
    clearTimeout(preloadTimer);
    hide();
    bubble?.remove();
    bubble = null;
  };
}
