// "מבית ״ניצוצא״ יעוץ רוחני אסטרטגי": small at the foot of every page (app and site pages), large in About and its credits.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HOUSE_CREDIT, HOUSE_NAME } from '../src/data/credits.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('the house credit reads exactly as its owner words it', () => {
  assert.equal(HOUSE_CREDIT, 'מבית ״ניצוצא״ יעוץ רוחני אסטרטגי');
  assert.equal(HOUSE_NAME, 'ניצוצא');
});

test('every app page ends with it, the memorial line kept beneath', () => {
  const app = read('../src/NewApp.jsx');
  assert.match(app, /<p className="app-footer-brand">כזוהר הרקיע · \{HOUSE_CREDIT\}<\/p>\s*<p className="app-footer-memorial">לעילוי נשמת הרבנית זהבית זוהרה בת אסתר<\/p>/);
});

test('About shows it large and in the credits, with the full weather credit', () => {
  const about = read('../src/pages/AboutPage.jsx');
  assert.match(about, /<strong className="about-house-name">״\{HOUSE_NAME\}״<\/strong>/);
  assert.match(about, /<span className="about-house-line">יעוץ רוחני אסטרטגי<\/span>/);
  assert.match(about, /<p>כזוהר הרקיע · \{HOUSE_CREDIT\}<\/p>/);
  assert.match(about, /Weather data by <a href=\{WEATHER_ATTRIBUTION\.url\}/);
  assert.match(about, /WEATHER_ATTRIBUTION\.sourcesUrl/);
});

test('the privacy and support pages carry it too', () => {
  for (const page of ['../public/privacy.html', '../public/support.html']) assert.match(read(page), /<p class="house">כזוהר הרקיע · מבית ״ניצוצא״ יעוץ רוחני אסטרטגי<\/p>/);
});

test('the foot clears the floating tab bar on phones and touch tablets, so the credit is actually seen', () => {
  const css = read('../src/styles/base.css');
  assert.match(css, /@media \(max-width:860px\)\{\.page\{padding-bottom:24px\}\.app-footer\{padding-bottom:calc\(90px \+ env\(safe-area-inset-bottom,0px\)\)\}\}/);
  assert.match(css, /@media \(pointer:coarse\) and \(min-width:861px\)\{\.page\{padding-bottom:24px\}\.app-footer\{padding-bottom:calc\(90px \+ env\(safe-area-inset-bottom,0px\)\)\}\}/);
});

test('About wraps the credit in the ניצוצא mark: five fading rings behind the words, the foot is small elsewhere', () => {
  const about = read('../src/pages/AboutPage.jsx');
  assert.match(about, /<section className="about-house" aria-label=\{HOUSE_CREDIT\}>\s*<NitzotzaMark \/>/);
  assert.match(about, /const NITZOTZA_RINGS = \[\[30, 0\.8\], \[60, 0\.53\], \[90, 0\.33\], \[120, 0\.19\], \[150, 0\.1\]\];/);
  const css = read('../src/styles/base.css');
  assert.match(css, /\.about-house-mark\{position:absolute;z-index:-1;/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{\.nitzotza-ring,\.nitzotza-spark\{animation:none\}\}/);
  assert.match(css, /\.app-footer\{[^}]*font-size:12\.5px;[^}]*\}\n\.app-footer\.is-about\{font-size:var\(--font-ui-caption\)\}/);
  assert.match(read('../src/NewApp.jsx'), /<footer className=\{`app-footer\$\{mode==='about'&&!source\?' is-about':''\}`\}>/);
});
