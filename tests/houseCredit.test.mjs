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
  assert.match(read('../src/NewApp.jsx'), /<footer className="app-footer">/);
});
