// בחן אותי — the loader of every question file in this folder (format: SCHEMA.md). Adding a file needs no change here:
// under Vite every sibling *.mjs is found by import.meta.glob (each its own lazy chunk, fetched only when the quiz opens);
// under Node (the tests) the folder is read from disk. Returns { 'tanakh.mjs': [ … ], … } — validation is in
// src/services/quiz/bank.mjs.

const fileName = path => path.split('/').pop();

function viteModules() {
  try {
    return import.meta.glob(['./*.mjs', '!./index.mjs']);
  } catch {
    return null; // not under Vite
  }
}

async function nodeModules() {
  const fsName = 'node:fs/promises';
  const { readdir } = await import(/* @vite-ignore */ fsName);
  const dir = new URL('./', import.meta.url);
  const names = (await readdir(dir)).filter(name => name.endsWith('.mjs') && name !== 'index.mjs').sort();
  return Object.fromEntries(names.map(name => [`./${name}`, () => import(/* @vite-ignore */ new URL(name, dir).href)]));
}

export async function loadQuizFiles() {
  const modules = viteModules() || (await nodeModules());
  const entries = await Promise.all(Object.entries(modules).map(async ([path, load]) => {
    try {
      const mod = await load();
      return [fileName(path), mod.default ?? mod.questions ?? []];
    } catch {
      return [fileName(path), null]; // a broken file is reported by the validator, the rest still play
    }
  }));
  return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b)));
}
