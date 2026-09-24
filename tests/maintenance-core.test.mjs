import { createDeferredLoader } from '../src/services/bookCorpus.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { hebrewNumeral, hebrewLetters } from '../src/services/hebrewNumerals.mjs';
import { routeParts } from '../src/services/safeRoute.mjs';
import { requestJsonResponse } from '../src/services/requestJson.mjs';
import { nextShabbatKey, civilKeyAsLocalDate, checkedCivilKey, selectShabbatReading, calendarIsIsrael } from '../src/services/calendarAccuracy.mjs';
import { civilDateKey, jewishDateKey } from '../src/civilDate.mjs';
import { dayContext } from '../src/dayContext.mjs';
import { JewishContextEngine } from '../src/services/jewishContextEngine.mjs';
import { DEFAULT_SETTINGS } from '../src/services.mjs';
import { serializeReaderNavigation, restoreReaderNavigation } from '../src/services/readerHistory.mjs';
import { assessBook, validateImportBatch, flattenText, shapeCount, compareBookEdition } from '../src/services/bookIntegrity.mjs';
import { buildLocalBookToc } from '../src/services/localBookToc.mjs';

const settings={...DEFAULT_SETTINGS,location:{...DEFAULT_SETTINGS.location,tzid:'Asia/Jerusalem'}};

for (const [n, expected] of [[1,'\u05d0\u05f3'],[15,'\u05d8\u05f4\u05d5'],[16,'\u05d8\u05f4\u05d6'],[115,'\u05e7\u05d8\u05f4\u05d5'],[216,'\u05e8\u05d8\u05f4\u05d6'],[415,'\u05ea\u05d8\u05f4\u05d5'],[916,'\u05ea\u05ea\u05e7\u05d8\u05f4\u05d6']]) {
  test(`Hebrew numeral ${n}`,()=>assert.equal(hebrewNumeral(n),expected));
}
test('Year 5787 retains customary thousands omission',()=>assert.equal(hebrewNumeral(5787,{year:true}),'\u05ea\u05e9\u05e4\u05f4\u05d6'));
test('Exact millennia are not mislabeled as one',()=>assert.equal(hebrewNumeral(5000,{year:true}),'\u05d4\u05f3 \u05d0\u05dc\u05e4\u05d9\u05dd'));
for (const n of [0,-1,1.5,NaN,Infinity,1e15]) test(`Reject unsafe numeral ${n}`,()=>assert.throws(()=>hebrewNumeral(n),RangeError));
test('Talmud-compatible letters retain 115 exception',()=>assert.equal(hebrewLetters(115),'\u05e7\u05d8\u05d5'));
for (const bad of ['talmud/%','halacha/q/%E0%A4%A','talmud/%FF']) test(`Safe route ${bad}`,()=>assert.doesNotThrow(()=>routeParts(bad)));
test('Valid Hebrew route remains decoded',()=>assert.equal(routeParts('halacha/q/%D7%90')[2],'\u05d0'));
for(const key of ['2026-02-30','2026-13-01','junk','2026-9-01']) test(`Reject invalid date ${key}`,()=>assert.throws(()=>checkedCivilKey(key),RangeError));
test('Leap date is accepted',()=>assert.equal(checkedCivilKey('2024-02-29'),'2024-02-29'));
test('HDate input uses host-local civil components',()=>{
  for (const key of ['0099-02-01','2026-09-26','2027-01-01','2024-02-29']) {
    const d=civilKeyAsLocalDate(key);
    assert.deepEqual([d.getFullYear(),d.getMonth()+1,d.getDate()],key.split('-').map(Number));
  }
});
test('Next Shabbat does not skip Saturday itself',()=>assert.equal(nextShabbatKey('2026-09-26'),'2026-09-26'));
test('Next Shabbat at year boundary',()=>assert.equal(nextShabbatKey('2026-12-31'),'2027-01-02'));
const regular={date:'2026-10-10',category:'parashat',title:'Parashat Bereshit',leyning:{torah:'Genesis 1:1-6:8'}};
const sukkot={date:'2026-09-26',category:'holiday',subcat:'major',title:'Sukkot I',leyning:{torah:'Leviticus 22:26-23:44'}};
test('Sukkot replaces regular reading, even with two-week gap',()=>{
  const x=selectShabbatReading([regular,sukkot],'2026-09-23');
  assert.equal(x.shabbatReading,sukkot);assert.equal(x.parasha,regular);assert.equal(x.shabbatKey,'2026-09-26');
});
test('Missing holiday reading NEVER substitutes a future parasha',()=>assert.equal(selectShabbatReading([regular],'2026-09-23').shabbatReading,null));
test('Holiday without leyning is kept as holiday, not Bereshit',()=>assert.equal(selectShabbatReading([{...sukkot,leyning:undefined},regular],'2026-09-23').shabbatReading.title,'Sukkot I'));
test('Normal weekly reading survives minor holidays',()=>assert.equal(selectShabbatReading([{date:'2026-10-10',category:'holiday',title:'Minor'},regular],'2026-10-08').shabbatReading,regular));
test('Selection is sorted and does not mutate caller items',()=>{const items=[regular,sukkot];selectShabbatReading(items,'2026-09-23');assert.equal(items[0],regular)});
test('Israel/Diaspora explicit status overrides legacy il flag',()=>{assert.equal(calendarIsIsrael({halachicResidenceStatus:'diaspora',il:true}),false);assert.equal(calendarIsIsrael({halachicResidenceStatus:'israel',il:false}),true)});
test('Sukkot begins only after the verified sunset transition',()=>{
  const tz='Asia/Jerusalem';
  const beforeSunset=new Date('2026-09-25T15:00:00Z');
  const afterSunset=new Date('2026-09-25T17:00:00Z');
  assert.equal(civilDateKey(beforeSunset,tz),'2026-09-25');
  assert.equal(civilDateKey(afterSunset,tz),'2026-09-25');
  assert.equal(jewishDateKey(beforeSunset,'2026-09-25T15:27:00Z',tz),'2026-09-25');
  assert.equal(jewishDateKey(afterSunset,'2026-09-25T15:27:00Z',tz),'2026-09-26');
  const before = JewishContextEngine({now:beforeSunset,settings:{...settings,location:{...settings.location,tzid:tz}},times:{sunset:'2026-09-25T15:27:00Z'}});
  const after = JewishContextEngine({now:afterSunset,settings:{...settings,location:{...settings.location,tzid:tz}},times:{sunset:'2026-09-25T15:27:00Z'}});
  assert.equal(before.specialDay?.title || before.specialDay?.desc || before.specialDay?.hebrew || null,'Erev Sukkot');
  assert.equal(after.specialDay?.title || after.specialDay?.desc || after.specialDay?.hebrew || null,'Sukkot I');
  assert.equal(before.key,'2026-09-25');
  assert.equal(after.key,'2026-09-26');
});
test('Sukkot holiday reading follows the actual Jewish day after sunset',()=>{
  const settingsIsrael={...settings,location:{...settings.location,tzid:'Asia/Jerusalem'}};
  const items=[
    {date:'2026-09-26',category:'holiday',subcat:'major',title:'Sukkot I',leyning:{torah:'Leviticus 22:26-23:44'}},
    {date:'2026-10-10',category:'parashat',title:'Parashat Bereshit',leyning:{torah:'Genesis 1:1-6:8'}}
  ];
  const before = dayContext(new Date('2026-09-25T15:00:00Z'), settingsIsrael, { sunset:'2026-09-25T15:27:00Z' }, items);
  const after = dayContext(new Date('2026-09-25T17:00:00Z'), settingsIsrael, { sunset:'2026-09-25T15:27:00Z' }, items);
  assert.equal(before.key,'2026-09-25');
  assert.equal(before.shabbatReading?.title,'Sukkot I');
  assert.equal(after.key,'2026-09-26');
  assert.equal(after.shabbatReading?.title,'Sukkot I');
  assert.equal(after.parasha?.title,'Parashat Bereshit');
});
test('Malformed events are ignored',()=>assert.equal(selectShabbatReading([null,{},regular],'2026-10-08').shabbatReading,regular));
test('Reader flow survives structured clone and JSON',()=>{
  const flow=[{reference:'Genesis 1',title:'1',mode:'cantillation'},{reference:'Genesis 2',title:'2',mode:'cantillation'},{reference:'Genesis 3',title:'3',mode:'cantillation'}];
  const spec={flow,index:1,flowKey:'tanakh:Genesis',returnRoute:'books',backLabel:'Back',endLabel:'End',breadcrumbs:[{label:'Books',route:'books'},{label:'2'}]};
  const data=JSON.parse(JSON.stringify(structuredClone(serializeReaderNavigation({...spec,onBack:()=>{}}))));
  let opened;let returned;
  const restored=restoreReaderNavigation(data,{openSource:(...args)=>{opened=args},navigate:id=>{returned=id}});
  assert.equal(restored.previous.reference,'Genesis 1');assert.equal(restored.next.reference,'Genesis 3');
  restored.onSelect(restored.next);assert.equal(opened[0],'Genesis 3');assert.equal(opened[3].next,null);assert.equal(opened[3].previous.reference,'Genesis 2');
  restored.onBack();assert.equal(returned,'books');
});
test('Reject invalid serialized reader index',()=>assert.equal(serializeReaderNavigation({flow:[{reference:'Genesis 1'}],index:5}),null));
test('A matching book count is NOT proof of completeness',()=>{const x=assessBook({hebrew:['text'],indexes:[0],version:'ed',license:'Public Domain'},{expectedSegments:1,sourceReachable:true});assert.equal(x.completeness,'NOT_VERIFIED');assert.deepEqual(x.issues,[])});
test('Book structural problems are retained',()=>{const x=assessBook({hebrew:['x',''],indexes:[0,0]},{expectedSegments:3,sourceReachable:true});assert.ok(x.issues.includes('invalid-indexes'));assert.ok(x.issues.includes('possible-truncation'));assert.ok(x.issues.includes('empty-or-invalid-segments'))});
test('Offline source is unverified rather than complete',()=>assert.equal(assessBook({hebrew:['x'],indexes:[0]}).sourceReachable,false));
test('Failed import cannot overwrite an existing complete book',()=>assert.throws(()=>validateImportBatch(['Book 1','Book 2'],[{he:['one']},null]),/Import aborted/));
test('Empty source response fails closed',()=>assert.throws(()=>validateImportBatch(['Book 1'],[{he:['',' ']}]),/Import aborted/));
test('Source error fails closed',()=>assert.throws(()=>validateImportBatch(['Book 1'],[{he:['text'],error:'oops'}]),/Import aborted/));
test('Valid nested source text preserved exactly',()=>assert.deepEqual(flattenText(['a',['b','c']]),['a','b','c']));
test('Shape counts recursively retain all branches',()=>assert.equal(shapeCount([{chapters:[[2,3],0,[4]]}]),9));
test('All requested responses required',()=>assert.throws(()=>validateImportBatch(['A','B'],[{he:['a']}]),/Incomplete/));
test('Successful JSON response',async()=>{const x=await requestJsonResponse('test',{fetchImpl:async()=>({ok:true,status:200,json:async()=>({ok:1})})});assert.deepEqual(x.data,{ok:1})});
test('Body stalls have an upper bound',async()=>{await assert.rejects(requestJsonResponse('test',{timeoutMs:20,fetchImpl:async()=>({ok:true,status:200,json:()=>new Promise(()=>{})})}),{name:'TimeoutError'})});
test('Headers stall has an upper bound',async()=>{await assert.rejects(requestJsonResponse('test',{timeoutMs:20,fetchImpl:()=>new Promise(()=>{})}),{name:'TimeoutError'})});
test('HTTP failures are not parsed as JSON',async()=>{const x=await requestJsonResponse('test',{fetchImpl:async()=>({ok:false,status:429,json:async()=>{throw Error('should not read')}})});assert.equal(x.response.status,429);assert.equal(x.data,null)});
test('Cancellation remains AbortError',async()=>{const c=new AbortController();const p=requestJsonResponse('test',{signal:c.signal,fetchImpl:()=>new Promise(()=>{})});c.abort();await assert.rejects(p,{name:'AbortError'})});
test('Already cancelled request never reaches transport',async()=>{const c=new AbortController();c.abort();await assert.rejects(requestJsonResponse('test',{signal:c.signal,fetchImpl:()=>{throw Error('transport called')}}),{name:'AbortError'})});

const storedBook={hebrew:['one','two'],indexes:[0,1],version:'edition'};
test('Exact whole edition can match',()=>assert.equal(compareBookEdition('Book',storedBook,{ref:'Book',heVersionTitle:'edition',he:[['one'],['two']]}).completeness,'MATCHES_CURRENT_SOURCE_EDITION'));
test('First chapter is never mistaken for whole book',()=>assert.equal(compareBookEdition('Book',storedBook,{ref:'Book 1',heVersionTitle:'edition',he:['one','two']}).completeness,'NOT_VERIFIED'));
test('Wrong edition is not verified even with identical text',()=>assert.equal(compareBookEdition('Book',storedBook,{ref:'Book',heVersionTitle:'another edition',he:['one','two']}).completeness,'NOT_VERIFIED'));
test('Same paragraph count does not hide a missing/replaced paragraph',()=>assert.equal(compareBookEdition('Book',storedBook,{ref:'Book',heVersionTitle:'edition',he:['one','one']}).completeness,'TEXT_OR_SCOPE_DIFF'));
test('Extra or missing paragraph fails exact comparison',()=>assert.equal(compareBookEdition('Book',storedBook,{ref:'Book',heVersionTitle:'edition',he:['one']}).firstDifference,1));
test('Audit tolerates corrupt non-array index metadata',()=>assert.doesNotThrow(()=>assessBook({...storedBook,indexes:'corrupt'})));
test('Zero Gregorian year is rejected',()=>assert.throws(()=>checkedCivilKey('0000-01-01'),RangeError));
test('Missing region matches engine legacy fallback',()=>assert.equal(calendarIsIsrael({}),false));

test('Book corpus is not loaded during initial module import',async()=>{let calls=0;const load=createDeferredLoader(async()=>{calls++;return 7});assert.equal(calls,0);assert.deepEqual(await Promise.all([load(),load()]),[7,7]);assert.equal(calls,1)});
test('Failed corpus download can be retried',async()=>{let calls=0;const load=createDeferredLoader(async()=>{if(++calls===1)throw Error('offline');return 7});await assert.rejects(load(),/offline/);assert.equal(await load(),7);assert.equal(calls,2)});
test('Local book TOC never invents sections from flattened paragraph offsets',()=>{
  const book={id:'single',title:'ספר',reference:'Single Book'};
  const toc=buildLocalBookToc(book,{'Single Book':{hebrew:['one','two','three'],indexes:[0,1,2]}});
  assert.equal(toc.fallback,true);assert.deepEqual(toc.sections.map(section=>section.ref),['Single Book']);
});
test('Compound local book TOC opens each canonical volume reference',()=>{
  const book={id:'two-parts',title:'ספר שני חלקים',reference:'Book I; Book II'};
  const toc=buildLocalBookToc(book,{'Book I':{hebrew:['one']},'Book II':{hebrew:['two']}});
  assert.equal(toc.fallback,false);assert.deepEqual(toc.sections.map(section=>section.ref),['Book I','Book II']);
});
