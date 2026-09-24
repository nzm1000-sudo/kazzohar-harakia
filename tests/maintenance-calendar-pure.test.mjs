import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkedCivilKey, nextShabbatKey, civilKeyAsLocalDate, selectShabbatReading } from '../src/services/calendarAccuracy.mjs';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/maintenance-calendar.json',import.meta.url),'utf8'));
const monthNames={Nisan:1,Iyar:2,Sivan:3,Tamuz:4,Av:5,Elul:6,Tishri:7,Heshvan:8,Kislev:9,Tevet:10,Shevat:11,Adar:12,'Adar I':12,'Adar II':13};
const formatter=new Intl.DateTimeFormat('en-u-ca-hebrew',{timeZone:'UTC',year:'numeric',month:'long',day:'numeric'});
for(let year=2020;year<=2040;year++) {
  const rows=fixture.rows.filter(row=>row.civil.startsWith(String(year)));
  test(`Independent Hebrew date and Shabbat matrix ${year}`,()=>{
    for(const row of rows) {
      checkedCivilKey(row.civil);
      const d=new Date(`${row.civil}T12:00:00Z`);
      const parts=formatter.formatToParts(d);
      const get=t=>parts.find(p=>p.type===t).value;
      assert.deepEqual([Number(get('year')),monthNames[get('month')],Number(get('day'))],row.hebrew,row.civil);
      const local=civilKeyAsLocalDate(row.civil);
      assert.deepEqual([local.getFullYear(),local.getMonth()+1,local.getDate()],row.civil.split('-').map(Number),row.civil);
      const saturday=new Date(`${nextShabbatKey(row.civil)}T12:00:00Z`);
      assert.equal(saturday.getUTCDay(),6);
      assert.ok(saturday-d>=0 && saturday-d<7*86400000);
    }
  });
}
test('Every reference Shabbat selects its own reading, not the following week',()=>{
  for(const israel of [true,false]) {
    const key=israel?'israel':'diaspora';
    const shabbat=fixture.rows.filter(row=>Object.hasOwn(row,key));
    const items=shabbat.map(row=>({date:row.civil,category:row[key]===null?'holiday':'parashat',subcat:'major',title:row[key]===null?'Holiday reading':JSON.stringify(row[key]),leyning:{torah:'fixture-only'}}));
    for(const item of items) assert.equal(selectShabbatReading(items.filter(e=>e.date>=item.date).slice(0,5),item.date).shabbatReading,item,item.date);
  }
});
