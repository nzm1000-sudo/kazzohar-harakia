import { useEffect, useRef } from 'react';

// Small shared pieces for assistive technology. None of them draws anything a sighted reader sees.

// Text for screen readers only (the visible design is unchanged).
export function VisuallyHidden({ children, as: Tag = 'span', ...rest }) {
  return <Tag className="visually-hidden" {...rest}>{children}</Tag>;
}

// One polite live region for the whole app: a short message ("נוסף לסימניות") is read once, never repeated in a loop.
let region = null;
let clearTimer = null;
export function announce(message, { assertive = false } = {}) {
  if (typeof document === 'undefined' || !message) return;
  if (!region || !region.isConnected) {
    region = document.createElement('div');
    region.className = 'visually-hidden';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('aria-atomic', 'true');
    document.body.appendChild(region);
  }
  region.setAttribute('aria-live', assertive ? 'assertive' : 'polite');
  // Clearing first lets the same message be announced again.
  region.textContent = '';
  clearTimeout(clearTimer);
  setTimeout(() => { region.textContent = message; }, 40);
  clearTimer = setTimeout(() => { if (region) region.textContent = ''; }, 6000);
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),summary';
const focusables = node => [...node.querySelectorAll(FOCUSABLE)].filter(el => !el.hidden && !el.closest('[inert],[hidden]') && el.getClientRects().length > 0);

// Everything outside the dialog becomes inert while it is open (a screen reader and the keyboard stay inside it);
// returns the undo. The dialog's own ancestors stay live.
function inertOutside(dialog) {
  const changed = [];
  for (let node = dialog; node && node !== document.body && node.parentElement; node = node.parentElement) {
    for (const sibling of node.parentElement.children) {
      if (sibling === node || sibling.inert || sibling.id === 'kz-dynamic-type-probe' || sibling.getAttribute('aria-live')) continue;
      if (['SCRIPT', 'STYLE', 'LINK'].includes(sibling.tagName)) continue;
      sibling.inert = true;
      changed.push(sibling);
    }
  }
  return () => changed.forEach(node => { node.inert = false; });
}

// A modal dialog or sheet: while open, focus moves into it (its first control, or `initialFocus`), Tab stays inside,
// Escape closes it, the page behind is inert; on close, focus returns to the control that opened it.
export function useModalFocus(ref, open, onClose, { initialFocus = null, inert = true } = {}) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog || typeof document === 'undefined') return undefined;
    const opener = document.activeElement;
    const undo = inert ? inertOutside(dialog) : () => {};
    const first = (initialFocus && dialog.querySelector(initialFocus)) || focusables(dialog)[0] || dialog;
    if (first === dialog && !dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1');
    // After the sheet has laid out (and without scrolling the page under it).
    const timer = setTimeout(() => { try { first.focus({ preventScroll: true }); } catch { first.focus(); } }, 30);
    const onKey = event => {
      if (event.key === 'Escape' && closeRef.current) { event.stopPropagation(); closeRef.current(); return; }
      if (event.key !== 'Tab') return;
      const items = focusables(dialog);
      if (!items.length) { event.preventDefault(); return; }
      const [head, tail] = [items[0], items[items.length - 1]];
      if (event.shiftKey && document.activeElement === head) { event.preventDefault(); tail.focus(); }
      else if (!event.shiftKey && document.activeElement === tail) { event.preventDefault(); head.focus(); }
    };
    dialog.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(timer);
      dialog.removeEventListener('keydown', onKey);
      undo();
      if (opener && opener.isConnected && typeof opener.focus === 'function') { try { opener.focus({ preventScroll: true }); } catch { opener.focus(); } }
    };
  }, [open, ref]);
}

// After a route change: focus the new page's title (without a visible ring for touch users; a screen reader hears
// where it landed). Only when the page changes, never on a re-render of the same page.
export function focusPageTitle(container) {
  if (typeof document === 'undefined') return;
  const title = (container || document).querySelector('main h1, [role="main"] h1, h1');
  if (!title) return;
  if (!title.hasAttribute('tabindex')) title.setAttribute('tabindex', '-1');
  try { title.focus({ preventScroll: true }); } catch { title.focus(); }
}
