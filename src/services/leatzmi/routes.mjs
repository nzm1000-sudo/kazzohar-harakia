// לעצמי routes: #leatzmi · leatzmi/today · leatzmi/chidushim[/new | /<id>[/edit | /send]] · leatzmi/review ·
// leatzmi/surprise[/chapter | /verse | /word] · leatzmi/quiz… (בחן אותי) · leatzmi/hitbodedut… (התבודדות).
const safe = value => { try { return decodeURIComponent(value || ''); } catch { return ''; } };
export function parseLeatzmiRoute(route = 'leatzmi') {
  const [, section = '', id = '', action = ''] = String(route).split('/');
  if (section === 'chidushim') {
    if (!id) return { view: 'chidushim' };
    if (id === 'new') return { view: 'chidush-edit', id: null };
    return { view: action === 'edit' ? 'chidush-edit' : action === 'send' ? 'chidush-send' : 'chidush', id: safe(id) };
  }
  if (section === 'surprise') return ['chapter', 'verse', 'word'].includes(id) ? { view: 'surprise', wheel: id } : { view: 'surprise' };
  if (['today', 'review', 'quiz', 'hitbodedut'].includes(section)) return { view: section };
  return { view: 'home' };
}
export const leatzmiRoute = {
  home: () => 'leatzmi',
  chidushim: () => 'leatzmi/chidushim',
  newChidush: () => 'leatzmi/chidushim/new',
  chidush: id => `leatzmi/chidushim/${encodeURIComponent(id)}`,
  edit: id => `leatzmi/chidushim/${encodeURIComponent(id)}/edit`,
  send: id => `leatzmi/chidushim/${encodeURIComponent(id)}/send`,
  surprise: (wheel = null) => (wheel ? `leatzmi/surprise/${wheel}` : 'leatzmi/surprise'),
};
