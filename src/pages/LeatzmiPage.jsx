// לעצמי — a quiet personal space: the user's own Torah thoughts, a short daily session, gentle review, a look back,
// a surprise chapter, and (by their own screens) בחן אותי and התבודדות. Everything here is kept on the device.
// Routes: #leatzmi · leatzmi/today · leatzmi/chidushim[/new | /<id>[/edit | /send]] · leatzmi/review · leatzmi/surprise
//         leatzmi/quiz… → QuizPage · leatzmi/hitbodedut… → HitbodedutPage
import { Suspense, lazy, useEffect, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import '@fontsource/heebo/300.css';
import '../styles/leatzmi.css';
import LeatzmiHome from '../components/leatzmi/LeatzmiHome.jsx';
import { ChidushimList, ChidushView, ChidushEditor, ChidushSend } from '../components/leatzmi/Chidushim.jsx';
import ReviewSession from '../components/leatzmi/ReviewSession.jsx';
import ForMeToday from '../components/leatzmi/ForMeToday.jsx';
import SurpriseChapter from '../components/leatzmi/SurpriseChapter.jsx';
import { parseLeatzmiRoute, leatzmiRoute } from '../services/leatzmi/routes.mjs';
const QuizPage = lazy(() => import('./QuizPage.jsx'));
const HitbodedutPage = lazy(() => import('./HitbodedutPage.jsx'));

export { parseLeatzmiRoute, leatzmiRoute };

const loading = <p className="loading" role="status">טוען…</p>;

// Offline on the web: the service worker keeps only what was fetched once. While online, the material בשבילי היום and
// חזרה אליי read later (and the two neighbouring screens) is fetched quietly once, so they work offline afterwards.
// The installed app carries all of it already, so nothing is fetched there.
let warmed = false;
function warmOfflineChunks() {
  if (warmed || Capacitor.isNativePlatform() || typeof navigator === 'undefined' || navigator.onLine === false) return;
  warmed = true;
  const idle = globalThis.requestIdleCallback || (callback => setTimeout(callback, 2500));
  idle(() => {
    for (const load of [() => import('../data/tehillim.json'), () => import('../data/practicalHalachaQa.mjs'), () => import('../data/quiz/index.mjs').then(module => module.loadQuizFiles()), () => import('./QuizPage.jsx'), () => import('./HitbodedutPage.jsx')]) load().catch(() => {});
  });
}

export default function LeatzmiPage({ route = 'leatzmi', go, openSource, openPsalm, settings, context }) {
  const parsed = useMemo(() => parseLeatzmiRoute(route), [route]);
  useEffect(warmOfflineChunks, []);
  const tzid = settings?.location?.tzid || 'Asia/Jerusalem';
  const il = (settings?.halachicResidenceStatus || (settings?.il === false ? 'diaspora' : 'israel')) === 'israel'; // as the shell reads it
  const shared = { go, tzid, il };
  let page;
  switch (parsed.view) {
    case 'quiz': return <Suspense fallback={loading}><QuizPage route={route} go={go} tzid={tzid} /></Suspense>;
    case 'hitbodedut': return <Suspense fallback={loading}><HitbodedutPage route={route} go={go} settings={settings} /></Suspense>;
    case 'chidushim': page = <ChidushimList {...shared} />; break;
    case 'chidush': page = <ChidushView key={parsed.id} id={parsed.id} {...shared} />; break;
    case 'chidush-edit': page = <ChidushEditor key={parsed.id || 'new'} id={parsed.id} {...shared} />; break;
    case 'chidush-send': page = <ChidushSend key={parsed.id} id={parsed.id} {...shared} />; break;
    case 'review': page = <ReviewSession {...shared} openSource={openSource} openPsalm={openPsalm} />; break;
    case 'today': page = <ForMeToday {...shared} openPsalm={openPsalm} />; break;
    case 'surprise': page = <SurpriseChapter {...shared} />; break;
    default: page = <LeatzmiHome {...shared} context={context} />;
  }
  return <section className="lz" dir="rtl">{page}</section>;
}
