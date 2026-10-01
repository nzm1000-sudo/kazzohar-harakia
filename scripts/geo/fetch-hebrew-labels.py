# Hebrew labels of places from Wikidata (CC0), by GeoNames id (P1566). Usage: python3 fetch-hebrew-labels.py ids.txt out.json
import json,urllib.request,urllib.parse,sys,time
need=[x.strip() for x in open(sys.argv[1])]
out={}
for i in range(0,len(need),250):
    batch=need[i:i+250]
    q='SELECT ?g ?he WHERE { VALUES ?g { %s } ?item wdt:P1566 ?g . ?item rdfs:label ?he . FILTER(LANG(?he)="he") }' % ' '.join('"%s"'%b for b in batch)
    url='https://query.wikidata.org/sparql?format=json&query='+urllib.parse.quote(q)
    req=urllib.request.Request(url,headers={'User-Agent':'kazzohar-build/1.0 (offline city list)'})
    for attempt in range(3):
        try:
            d=json.load(urllib.request.urlopen(req,timeout=90));break
        except Exception as e:
            print('retry',e,file=sys.stderr);time.sleep(5)
    for r in d['results']['bindings']:
        out.setdefault(r['g']['value'],r['he']['value'])
    time.sleep(1)
json.dump(out,open(sys.argv[2],'w'),ensure_ascii=False)
print(len(out))
