// Requires the REAL app dependency from package-lock.json. Not a mocked Hebcal.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HDate, HebrewCalendar } from '@hebcal/core';
import { civilKeyAsLocalDate } from '../src/services/calendarAccuracy.mjs';
import { JewishContextEngine } from '../src/services/jewishContextEngine.mjs';
import { calendarRequestKey, DEFAULT_SETTINGS, getNextRelevantZman } from '../src/services.mjs';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/maintenance-calendar.json',import.meta.url),'utf8'));
for(let year=2020;year<=2040;year++) test(`Real Hebcal against independent reference ${year}`,()=>{
  for(const row of fixture.rows.filter(row=>row.civil.startsWith(String(year)))) {
    const h=new HDate(civilKeyAsLocalDate(row.civil));
    assert.deepEqual([h.getFullYear(),h.getMonth(),h.getDate()],row.hebrew,row.civil);
    if(!Object.hasOwn(row,'israel')) continue;
    for(const il of [true,false]) {
      const expected=row[il?'israel':'diaspora'];
      const actual=HebrewCalendar.getSedra(h.getFullYear(),il).lookup(h);
      assert.equal(actual.chag,expected===null,`${row.civil} il=${il}`);
      if(expected!==null) assert.deepEqual((Array.isArray(actual.num)?actual.num:[actual.num]).map(n=>n-1),expected,`${row.civil} il=${il}`);
    }
  }
});
const settings={...DEFAULT_SETTINGS,location:{...DEFAULT_SETTINGS.location,tzid:'Asia/Jerusalem'}};
const context=(key,extra={})=>JewishContextEngine({now:new Date(`${key}T10:00:00Z`),settings,...extra});
test('Rosh Hashana is not a Rosh Chodesh prayer prompt',()=>assert.equal(context('2026-09-12').isRoshChodesh,false));
test('Purim Katan is not Al Hanissim',()=>assert.equal(context('2024-02-23').purim,false));
test('Actual leap-year Purim is recognized',()=>assert.equal(context('2024-03-24').purim,true));
test('Chanukah has eight days even after short Kislev',()=>{
  for(let year=5780;year<=5801;year++) {
    const start=new HDate(25,9,year);
    for(let i=0;i<9;i++) {
      const h=new HDate(start.abs()+i); const g=h.greg();
      const key=[g.getFullYear(),String(g.getMonth()+1).padStart(2,'0'),String(g.getDate()).padStart(2,'0')].join('-');
      assert.equal(context(key).chanukah,i<8,key);
    }
  }
});
test('Adar I label retains the year',()=>assert.match(context('2024-02-23').hebrewDate.label,/\u05ea\u05e9\u05e4/));
test('Winter rain season persists through January in diaspora',()=>assert.equal(context('2027-01-15',{settings:{...settings,halachicResidenceStatus:'diaspora'}}).seasonal.vetenTalUmatar,true));
test('Winter rain season ends by Pesach in diaspora',()=>assert.equal(context('2027-04-22',{settings:{...settings,halachicResidenceStatus:'diaspora'}}).seasonal.vetenTalUmatar,false));
test('Friday after verified sunset uses Jewish Saturday',()=>{
  const c=JewishContextEngine({now:new Date('2026-09-18T18:00:00Z'),settings,times:{sunset:'2026-09-18T15:40:00Z'}});
  assert.equal(c.afterSunset,true);assert.equal(c.prayerContext.omitTachanun,true);
});
test('Candle offset changes snapshot identity',()=>assert.notEqual(calendarRequestKey('2026-09-01','2026-09-30',{...settings,candles:20}),calendarRequestKey('2026-09-01','2026-09-30',{...settings,candles:40})));
test('Tomorrow RT remains hidden when disabled',()=>assert.equal(getNextRelevantZman(new Date('2026-09-23T18:00:00Z'),{nextDay:{tzeit72min:'2026-09-24T18:00:00Z'}},{showRT:false}),null));
