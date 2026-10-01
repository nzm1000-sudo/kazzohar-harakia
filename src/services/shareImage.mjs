// "שיתוף כתמונה": a verse, a halacha answer, a blessing card or a Tehillim excerpt as an image in the style of
// כזוהר הרקיע — a cream page in a double golden frame (the About frame's gold), the text with its nikud in the reading
// face, a source line under it, the attribution the text's licence requires, and at the foot the app's emblem and name.
// Drawn offscreen on a canvas at twice the design size (2160 px wide), after the app's fonts are loaded, then handed to
// the native share sheet (Capacitor Share when the plugin is in the app), else the Web Share API with a file, else saved
// as a download. Nothing is uploaded anywhere; the image is made on the device.
//
// The pure parts (the card spec, the line breaking and the layout) take a `measure` function, so they are tested in
// Node; the drawing takes a canvas 2D context (or anything with its methods).

export const SHARE_BRAND = 'כזוהר הרקיע';
export const SHARE_WIDTH = 1080;
export const SHARE_SCALE = 2;
const MIN_HEIGHT = 1080;
const MAX_HEIGHT = 1920;
// The foot under the last text line: a clear gap, the emblem, the app's name, the frame.
const FOOT = 330;

export const SHARE_COLORS = Object.freeze({
  page: '#fbf6ea', pageEdge: '#f1e6cb', ink: '#241e17', muted: '#6b604f', gold: '#b08a3a', goldLight: '#f7e6b0', goldDeep: '#8a6a24',
});
export const SHARE_FONTS = Object.freeze({ reading: '"Noto Serif Hebrew", "Frank Ruhl Libre", serif', ui: 'Heebo, "Noto Sans Hebrew", sans-serif' });

// Te'amim (cantillation marks) are left out of the image — the app's "ניקוד" reading mode; nikud stays. Nothing else in
// the text changes (letters, nikud, maqaf and punctuation are kept exactly).
export const stripCantillation = text => String(text || '').replace(/[֑-֯]/g, '');
const clean = text => stripCantillation(text).replace(/\s+/g, ' ').trim();

const KINDS = { verse: 'פסוק', halacha: 'הלכה', blessing: 'ברכות', tehillim: 'תהילים' };

// The card: what the image says. `source` (where the text is from) is required, and `credit` carries the licence's
// attribution; a notice required by the text's rights (e.g. "באישור המחבר; כל הזכויות שמורות למחבר") goes in `notice`
// and is always drawn in full.
export function shareCardSpec({ kind = 'verse', eyebrow = null, title = null, body, lines = null, source, credit = null, notice = null } = {}) {
  const bodyLines = (lines || [body]).map(clean).filter(Boolean);
  if (!bodyLines.length) throw new Error('אין טקסט לשיתוף');
  if (!String(source || '').trim()) throw new Error('חסרה שורת מקור לשיתוף');
  return {
    kind,
    eyebrow: clean(eyebrow || KINDS[kind] || ''),
    title: title ? clean(title) : null,
    body: bodyLines,
    source: String(source).trim(),
    credit: credit ? String(credit).trim() : null,
    notice: notice ? String(notice).trim() : null,
    brand: SHARE_BRAND,
  };
}

// Greedy word wrap for right-to-left text: words stay whole; a single word wider than the line is broken by letters
// (keeping each letter with its marks).
export function wrapText(text, maxWidth, measure) {
  const words = String(text || '').split(' ').filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure(candidate) <= maxWidth) { line = candidate; continue; }
    if (line) lines.push(line);
    if (measure(word) <= maxWidth) { line = word; continue; }
    const clusters = word.match(/[^֑-ׇ][֑-ׇ]*/g) || [word];
    line = '';
    for (const cluster of clusters) {
      if (line && measure(line + cluster) > maxWidth) { lines.push(line); line = cluster; } else line += cluster;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const font = (family, size, weight = 400) => `${weight} ${size}px ${family}`;

// The layout in design pixels (1080 wide): every text block with its font, colour and baseline. The body's size
// steps down until it fits within the tallest card (9:16); the card is never shorter than a square.
export function layoutShareCard(spec, measureWith, { width = SHARE_WIDTH } = {}) {
  const inner = width - 2 * 132;
  const blocks = [];
  let y = 150;
  const push = (text, size, family, weight, color, lineHeight) => {
    const f = font(family, size, weight);
    for (const line of wrapText(text, inner, value => measureWith(f, value))) {
      y += lineHeight;
      blocks.push({ text: line, font: f, color, y, size });
    }
  };
  if (spec.eyebrow) { push(spec.eyebrow, 34, SHARE_FONTS.ui, 600, SHARE_COLORS.goldDeep, 40); }
  const dividerY = y + 30;
  y += 56;
  if (spec.title) { push(spec.title, 46, SHARE_FONTS.reading, 700, SHARE_COLORS.ink, 64); y += 22; }
  const tail = 90 + 50 + (spec.credit ? 44 : 0) + (spec.notice ? 44 : 0) + FOOT;
  const sizes = [54, 48, 43, 39, 35, 32];
  const pointed = spec.body.some(line => /[\u05B0-\u05C7]/.test(line));
  let body = [];
  let bodyEnd = y;
  let chosen = sizes[sizes.length - 1];
  for (const size of sizes) {
    const f = font(SHARE_FONTS.reading, size, 400);
    // Nikud needs room above and below the letters; plain text reads better closer.
    const lineHeight = Math.round(size * (pointed ? 1.78 : 1.5));
    body = [];
    let at = y;
    spec.body.forEach((paragraph, index) => {
      if (index) at += Math.round(size * 0.55);
      for (const line of wrapText(paragraph, inner, value => measureWith(f, value))) { at += lineHeight; body.push({ text: line, font: f, color: SHARE_COLORS.ink, y: at, size }); }
    });
    bodyEnd = at;
    chosen = size;
    if (at + tail <= MAX_HEIGHT) break;
  }
  blocks.push(...body);
  y = bodyEnd + 70;
  const sourceBlocks = [];
  const pushTail = (text, size, family, weight, color, lineHeight) => {
    const f = font(family, size, weight);
    for (const line of wrapText(text, inner, value => measureWith(f, value))) { y += lineHeight; sourceBlocks.push({ text: line, font: f, color, y, size }); }
  };
  pushTail(spec.source, 34, SHARE_FONTS.ui, 600, SHARE_COLORS.goldDeep, 44);
  if (spec.credit) pushTail(spec.credit, 30, SHARE_FONTS.ui, 400, SHARE_COLORS.muted, 40);
  if (spec.notice) pushTail(spec.notice, 30, SHARE_FONTS.ui, 600, SHARE_COLORS.muted, 40);
  blocks.push(...sourceBlocks);
  // Never cut: a text that does not fit even at the smallest size makes a taller card.
  const height = Math.max(MIN_HEIGHT, y + FOOT);
  // A short text sits in the middle of a square card, not at its top.
  const slack = Math.max(0, height - (y + FOOT));
  const shift = Math.round(slack / 2);
  for (const block of blocks) block.y += shift;
  return { width, height, bodySize: chosen, blocks, dividerY: dividerY + shift, brandY: height - 140, emblemY: height - 262, overflow: y + FOOT > MAX_HEIGHT };
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Draws the laid-out card on a 2D context (already scaled to design pixels). `emblem` is an image or null.
export function drawShareCard(ctx, layout, spec, { emblem = null } = {}) {
  const { width, height } = layout;
  const background = ctx.createRadialGradient ? ctx.createRadialGradient(width / 2, height * 0.42, 60, width / 2, height / 2, height * 0.8) : null;
  if (background) { background.addColorStop(0, SHARE_COLORS.page); background.addColorStop(1, SHARE_COLORS.pageEdge); }
  ctx.fillStyle = background || SHARE_COLORS.page;
  ctx.fillRect(0, 0, width, height);
  // The double golden frame: a strong outer line in a gold gradient, a fine inner line.
  const gold = ctx.createLinearGradient ? ctx.createLinearGradient(0, 0, width, height) : null;
  if (gold) { gold.addColorStop(0, SHARE_COLORS.gold); gold.addColorStop(0.3, SHARE_COLORS.goldLight); gold.addColorStop(0.55, SHARE_COLORS.gold); gold.addColorStop(1, SHARE_COLORS.goldDeep); }
  ctx.strokeStyle = gold || SHARE_COLORS.gold;
  ctx.lineWidth = 6;
  roundedRect(ctx, 44, 44, width - 88, height - 88, 34);
  ctx.stroke();
  ctx.strokeStyle = SHARE_COLORS.gold;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  roundedRect(ctx, 64, 64, width - 128, height - 128, 24);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // A small gold rule with a diamond under the eyebrow.
  const cx = width / 2;
  ctx.strokeStyle = SHARE_COLORS.gold;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - 120, layout.dividerY); ctx.lineTo(cx - 16, layout.dividerY); ctx.moveTo(cx + 16, layout.dividerY); ctx.lineTo(cx + 120, layout.dividerY); ctx.stroke();
  ctx.fillStyle = SHARE_COLORS.gold;
  ctx.beginPath(); ctx.moveTo(cx, layout.dividerY - 9); ctx.lineTo(cx + 9, layout.dividerY); ctx.lineTo(cx, layout.dividerY + 9); ctx.lineTo(cx - 9, layout.dividerY); ctx.closePath(); ctx.fill();
  // The text: centred, right-to-left.
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  for (const block of layout.blocks) {
    ctx.font = block.font;
    ctx.fillStyle = block.color;
    ctx.fillText(block.text, cx, block.y);
  }
  // The foot: the emblem, then the app's name in gold.
  if (emblem) ctx.drawImage(emblem, cx - 44, layout.emblemY, 88, 88);
  ctx.font = font(SHARE_FONTS.reading, 40, 700);
  ctx.fillStyle = SHARE_COLORS.goldDeep;
  ctx.fillText(spec.brand, cx, layout.brandY + 30);
}

// The app's fonts, loaded before drawing (a canvas draws with whatever is loaded at that moment).
export async function loadShareFonts(doc = globalThis.document) {
  const fonts = doc?.fonts;
  if (!fonts?.load) return;
  const sample = 'אָבְגַּ דּ';
  await Promise.all([
    fonts.load(font(SHARE_FONTS.reading, 48, 400), sample),
    fonts.load(font(SHARE_FONTS.reading, 48, 700), sample),
    fonts.load(font(SHARE_FONTS.ui, 34, 400), sample),
    fonts.load(font(SHARE_FONTS.ui, 34, 600), sample),
  ].map(promise => promise.catch(() => null)));
  await fonts.ready;
}

function loadImage(src) {
  return new Promise(resolve => {
    try {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = src;
    } catch { resolve(null); }
  });
}

// The finished image as a PNG Blob (browser only).
export async function renderShareImage(spec, { doc = globalThis.document, baseUrl = '/', scale = SHARE_SCALE } = {}) {
  await loadShareFonts(doc);
  const canvas = doc.createElement('canvas');
  const measureCtx = canvas.getContext('2d');
  measureCtx.direction = 'rtl';
  const layout = layoutShareCard(spec, (f, text) => { measureCtx.font = f; return measureCtx.measureText(text).width; });
  canvas.width = layout.width * scale;
  canvas.height = layout.height * scale;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const emblem = await loadImage(`${baseUrl}branding/kazzohar-emblem.png`);
  drawShareCard(ctx, layout, spec, { emblem });
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('לא ניתן היה ליצור את התמונה');
  return { blob, layout, canvas };
}

export const shareFileName = spec => `kazzohar-${spec.kind}-${Date.now()}.png`;

const blobToBase64 = blob => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(blob);
});

// Makes the image and opens the share sheet. Returns 'shared' | 'saved' | 'cancelled'; throws only when the image
// itself could not be made.
export async function shareAsImage(spec, { baseUrl = '/' } = {}) {
  const { blob } = await renderShareImage(spec, { baseUrl });
  const name = shareFileName(spec);
  const title = spec.title || spec.eyebrow || SHARE_BRAND;
  // In the app: the native share sheet (the Share plugin, with the image written to the cache directory first).
  try {
    const { Capacitor } = await import('@capacitor/core');
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Share')) {
      const [{ Share }, { Filesystem, Directory }] = await Promise.all([import('@capacitor/share'), import('@capacitor/filesystem')]);
      const written = await Filesystem.writeFile({ path: name, data: await blobToBase64(blob), directory: Directory.Cache });
      try { await Share.share({ title, files: [written.uri], dialogTitle: 'שיתוף כתמונה' }); return 'shared'; } catch { return 'cancelled'; }
    }
  } catch { /* not in the native app, or the plugin is not there: the web way */ }
  const file = typeof File === 'function' ? new File([blob], name, { type: 'image/png' }) : null;
  if (file && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return 'shared'; } catch (error) { if (error?.name === 'AbortError') return 'cancelled'; }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name; link.rel = 'noopener';
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'saved';
}
