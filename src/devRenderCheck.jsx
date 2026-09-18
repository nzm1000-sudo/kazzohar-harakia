// Minimal repro entry: renders only the NEW components with mock props.
// Used by tests/newshell-ssr.cjs to isolate parse/JSX/runtime errors.
import { renderToStaticMarkup } from 'react-dom/server';
import Shell from './components/Shell.jsx';
import TodayPage from './pages/TodayPage.jsx';
import ZmanimPage from './pages/ZmanimPage.jsx';

const noop = () => {};
const now = new Date('2026-09-18T17:30:00+03:00'); // after mincha ketana, before sunset
const solar = {
  loading: false,
  data: {
    alotHaShachar: '2026-09-18T05:14:00+03:00',
    misheyakir: '2026-09-18T05:36:00+03:00',
    sunrise: '2026-09-18T06:26:00+03:00',
    sofZmanShma: '2026-09-18T09:31:00+03:00',
    sofZmanTfilla: '2026-09-18T10:32:00+03:00',
    chatzot: '2026-09-18T12:35:00+03:00',
    minchaGedola: '2026-09-18T13:06:00+03:00',
    minchaKetana: '2026-09-18T16:10:00+03:00',
    plagHaMincha: '2026-09-18T17:26:00+03:00',
    sunset: '2026-09-18T18:43:00+03:00',
    tzeit85deg: '2026-09-18T19:19:00+03:00',
    tzeit72min: '2026-09-18T19:55:00+03:00',
  },
  error: null,
};
const settings = {
  location: { name: 'תל אביב', latitude: 32.0853, longitude: 34.7818, tzid: 'Asia/Jerusalem' },
  il: true,
};

const checks = [];
const check = (name, ok, extra = '') => checks.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' · ' + extra : ''}`);

try {
  const shell = renderToStaticMarkup(
    <Shell page="today" onNav={noop} query="" setQuery={noop} dark={false} onToggleDark={noop} />,
  );
  check('shell renders brand', shell.includes('כזוהר הרקיע'));
  check('shell nav has 4 main items', ['היום', 'לוח שנה', 'תהילים', 'סידור'].every(t => shell.includes(t)));
  check('shell has no emoji', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(shell));

  const today = renderToStaticMarkup(
    <TodayPage now={now} tz="Asia/Jerusalem" hebrew="ז׳ תשרי תשפ״ז"
      events={[{ n: 'שבת שובה', t: 'spec' }]} solar={solar}
      parasha={['האזינו']} locationName="תל אביב" afterSunset={false} onNav={noop} />,
  );
  check('today renders hebrew date', today.includes('ז׳ תשרי תשפ״ז'));
  check('today renders next zman', today.includes('הזמן הבא') && today.includes('שקיעה') && today.includes('18:43'));
  check('today renders parasha', today.includes('האזינו'));
  check('today has no emoji', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(today));

  const zmanim = renderToStaticMarkup(
    <ZmanimPage solar={solar} settings={settings} setSettings={noop} />,
  );
  check('zmanim renders list', zmanim.includes('עלות השחר') && zmanim.includes('שקיעה'));
  check('zmanim shows method note', zmanim.includes('Hebcal'));
} catch (error) {
  console.error('RENDER THREW:', error.message);
  console.error(error.stack?.split('\n').slice(0, 6).join('\n'));
  process.exitCode = 1;
}
console.log(checks.join('\n'));
if (checks.some(c => c.startsWith('FAIL'))) process.exitCode = 1;
